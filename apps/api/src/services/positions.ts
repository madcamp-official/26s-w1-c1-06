import {
  ALLOWED_MULTIPLIERS,
  computeLockedPoints,
  computePayout,
  isBettable,
  type InviteStatus,
  type PositionDirection,
} from "@latestock/shared";
import type pg from "pg";
import { getPool } from "../db/pool.js";
import { HttpError, requirePool } from "../lib/errors.js";

export interface OpenPositionInput {
  stockUserId: string;
  promiseId: string;
  direction: PositionDirection;
  quantity: number;
  multiplier?: number;
}

export interface PositionView {
  id: string;
  stockUserId: string;
  stockNickname: string;
  promiseId: string;
  promiseTitle: string;
  promisedAt: string;
  direction: PositionDirection;
  quantity: number;
  openPrice: number;
  lockedPoints: number;
  multiplier: number;
  status: "open" | "settled" | "cancelled";
  priceBefore: number | null;
  priceAfter: number | null;
  payout: number | null;
  createdAt: string;
  settledAt: string | null;
}

interface PositionRow {
  id: string;
  stock_user_id: string;
  stock_nickname: string;
  promise_id: string;
  promise_title: string;
  promised_at: Date;
  direction: PositionDirection;
  quantity: number;
  open_price: number;
  locked_points: number;
  multiplier: number;
  status: "open" | "settled" | "cancelled";
  price_before: number | null;
  price_after: number | null;
  payout: number | null;
  created_at: Date;
  settled_at: Date | null;
}

function mapPosition(row: PositionRow): PositionView {
  return {
    id: row.id,
    stockUserId: row.stock_user_id,
    stockNickname: row.stock_nickname,
    promiseId: row.promise_id,
    promiseTitle: row.promise_title,
    promisedAt: row.promised_at.toISOString(),
    direction: row.direction,
    quantity: row.quantity,
    openPrice: row.open_price,
    lockedPoints: row.locked_points,
    multiplier: row.multiplier,
    status: row.status,
    priceBefore: row.price_before,
    priceAfter: row.price_after,
    payout: row.payout,
    createdAt: row.created_at.toISOString(),
    settledAt: row.settled_at?.toISOString() ?? null,
  };
}

async function isAcceptedFriend(
  client: pg.Pool | pg.PoolClient,
  userId: string,
  friendId: string,
): Promise<boolean> {
  const result = await client.query(
    `SELECT 1 FROM friendships
     WHERE status = 'accepted'
       AND (
         (requester_id = $1::bigint AND addressee_id = $2::bigint)
         OR (requester_id = $2::bigint AND addressee_id = $1::bigint)
       )`,
    [userId, friendId],
  );
  return (result.rowCount ?? 0) > 0;
}

/** T1: 포지션 개설 (F-10/F-11). */
export async function openPosition(
  investorId: string,
  input: OpenPositionInput,
  now: Date = new Date(),
): Promise<PositionView> {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new HttpError(400, "quantity는 1 이상의 정수여야 합니다.");
  }
  if (input.direction !== "buy" && input.direction !== "short") {
    throw new HttpError(400, 'direction은 "buy" 또는 "short"여야 합니다.');
  }
  if (investorId === input.stockUserId) {
    throw new HttpError(403, "자기 주식에는 베팅할 수 없습니다.");
  }
  const multiplier = input.multiplier ?? 1;
  if (!(ALLOWED_MULTIPLIERS as readonly number[]).includes(multiplier)) {
    throw new HttpError(
      400,
      `multiplier는 ${ALLOWED_MULTIPLIERS.join("/")} 중 하나여야 합니다.`,
    );
  }

  const pool = getPool();
  requirePool(pool);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const promiseResult = await client.query<{
      id: string;
      promised_at: Date;
      settled_at: Date | null;
      title: string;
    }>(
      `SELECT id, promised_at, settled_at, title
       FROM promises
       WHERE id = $1
       FOR UPDATE`,
      [input.promiseId],
    );
    const promise = promiseResult.rows[0];
    if (!promise) {
      throw new HttpError(404, "약속을 찾을 수 없습니다.");
    }
    if (promise.settled_at !== null) {
      throw new HttpError(409, "이미 정산된 약속에는 베팅할 수 없습니다.");
    }

    const participantResult = await client.query<{
      invite_status: InviteStatus;
    }>(
      `SELECT invite_status FROM promise_participants
       WHERE promise_id = $1 AND user_id = $2`,
      [input.promiseId, input.stockUserId],
    );
    const targetInviteStatus = participantResult.rows[0]?.invite_status;
    if (!targetInviteStatus) {
      throw new HttpError(404, "해당 종목이 이 약속의 참여자가 아닙니다.");
    }

    const isFriend = await isAcceptedFriend(
      client,
      investorId,
      input.stockUserId,
    );

    const bettable = isBettable(
      {
        isFriendAccepted: isFriend,
        targetInviteStatus,
        promisedAt: promise.promised_at,
        isSelf: false,
      },
      now,
    );
    if (!bettable) {
      if (!isFriend) {
        throw new HttpError(403, "친구인 종목에만 베팅할 수 있습니다.");
      }
      if (targetInviteStatus !== "accepted") {
        throw new HttpError(403, "약속을 수락한 참여자에만 베팅할 수 있습니다.");
      }
      throw new HttpError(409, "베팅 마감된 약속입니다.");
    }

    const duplicate = await client.query(
      `SELECT 1 FROM positions
       WHERE investor_id = $1 AND stock_user_id = $2 AND promise_id = $3`,
      [investorId, input.stockUserId, input.promiseId],
    );
    if ((duplicate.rowCount ?? 0) > 0) {
      throw new HttpError(
        409,
        "이미 해당 약속·종목에 포지션이 있습니다.",
      );
    }

    const stockResult = await client.query<{ current_price: number }>(
      `SELECT current_price FROM users WHERE id = $1 FOR UPDATE`,
      [input.stockUserId],
    );
    if (!stockResult.rows[0]) {
      throw new HttpError(404, "종목을 찾을 수 없습니다.");
    }

    const investorResult = await client.query<{ available_points: number }>(
      `SELECT available_points FROM users WHERE id = $1 FOR UPDATE`,
      [investorId],
    );
    const investor = investorResult.rows[0];
    if (!investor) {
      throw new HttpError(404, "사용자를 찾을 수 없습니다.");
    }

    const openPrice = stockResult.rows[0]!.current_price;
    const lockedPoints = computeLockedPoints(input.quantity, openPrice);

    if (investor.available_points < lockedPoints) {
      throw new HttpError(402, "가용 포인트가 부족합니다.");
    }

    const inserted = await client.query<{ id: string }>(
      `INSERT INTO positions (
         investor_id, stock_user_id, promise_id, direction,
         quantity, open_price, locked_points, multiplier
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        investorId,
        input.stockUserId,
        input.promiseId,
        input.direction,
        input.quantity,
        openPrice,
        lockedPoints,
        multiplier,
      ],
    );
    const positionId = inserted.rows[0]?.id;
    if (!positionId) {
      throw new HttpError(500, "포지션 생성에 실패했습니다.");
    }

    await client.query(
      `INSERT INTO point_transactions (user_id, amount, tx_type, ref_id)
       VALUES ($1, $2, 'position_lock', $3)`,
      [investorId, -lockedPoints, positionId],
    );
    await client.query(
      `UPDATE users SET available_points = available_points - $2 WHERE id = $1`,
      [investorId, lockedPoints],
    );

    await client.query("COMMIT");

    const list = await listPositions(investorId, undefined, positionId);
    const created = list[0];
    if (!created) {
      throw new HttpError(500, "생성된 포지션을 조회할 수 없습니다.");
    }
    return created;
  } catch (err) {
    await client.query("ROLLBACK");
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      err.code === "23505"
    ) {
      throw new HttpError(
        409,
        "이미 해당 약속·종목에 포지션이 있습니다.",
      );
    }
    throw err;
  } finally {
    client.release();
  }
}

/** POST /positions/:id/confirm — 투자자의 미확인 정산 배너 소거 (F-12). */
export async function confirmPosition(
  investorId: string,
  positionId: string,
): Promise<void> {
  const pool = getPool();
  requirePool(pool);

  const updated = await pool.query(
    `UPDATE positions
     SET confirmed_at = now()
     WHERE id = $1 AND investor_id = $2
       AND status = 'settled' AND confirmed_at IS NULL`,
    [positionId, investorId],
  );
  if (updated.rowCount === 0) {
    const check = await pool.query<{
      investor_id: string;
      status: string;
      confirmed_at: Date | null;
    }>(
      `SELECT investor_id, status, confirmed_at FROM positions WHERE id = $1`,
      [positionId],
    );
    const row = check.rows[0];
    if (!row) throw new HttpError(404, "포지션을 찾을 수 없습니다.");
    if (row.investor_id !== investorId) {
      throw new HttpError(403, "본인 포지션만 확인할 수 있습니다.");
    }
    if (row.status !== "settled") {
      throw new HttpError(409, "아직 정산되지 않았습니다.");
    }
    throw new HttpError(409, "이미 확인한 정산입니다.");
  }
}

/**
 * POST /positions/:id/close — 조기 청산 (M3-2).
 * 약속 정산을 기다리지 않고 현재가 기준으로 즉시 포지션을 정산한다.
 */
export async function closePosition(
  investorId: string,
  positionId: string,
  now: Date = new Date(),
): Promise<PositionView> {
  const pool = getPool();
  requirePool(pool);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const positionResult = await client.query<{
      investor_id: string;
      stock_user_id: string;
      direction: PositionDirection;
      quantity: number;
      open_price: number;
      locked_points: number;
      multiplier: number;
      status: "open" | "settled" | "cancelled";
    }>(
      `SELECT investor_id, stock_user_id, direction, quantity, open_price, locked_points, multiplier, status
       FROM positions
       WHERE id = $1
       FOR UPDATE`,
      [positionId],
    );
    const position = positionResult.rows[0];
    if (!position) {
      throw new HttpError(404, "포지션을 찾을 수 없습니다.");
    }
    if (position.investor_id !== investorId) {
      throw new HttpError(403, "본인 포지션만 청산할 수 있습니다.");
    }
    if (position.status !== "open") {
      throw new HttpError(409, "이미 정산되었거나 취소된 포지션입니다.");
    }

    const stockResult = await client.query<{ current_price: number }>(
      `SELECT current_price FROM users WHERE id = $1 FOR UPDATE`,
      [position.stock_user_id],
    );
    const currentPrice = stockResult.rows[0]?.current_price;
    if (currentPrice === undefined) {
      throw new HttpError(404, "종목을 찾을 수 없습니다.");
    }

    const payout = computePayout(
      position.direction,
      position.quantity,
      position.open_price,
      currentPrice,
      position.locked_points,
      position.multiplier,
    );

    await client.query(
      `UPDATE positions
       SET status = 'settled',
           price_before = $2,
           price_after = $3,
           payout = $4,
           settled_at = $5
       WHERE id = $1`,
      [positionId, position.open_price, currentPrice, payout, now],
    );

    await client.query(
      `INSERT INTO point_transactions (user_id, amount, tx_type, ref_id)
       VALUES ($1, $2, 'position_unlock', $3)`,
      [investorId, position.locked_points, positionId],
    );
    if (payout !== 0) {
      await client.query(
        `INSERT INTO point_transactions (user_id, amount, tx_type, ref_id)
         VALUES ($1, $2, 'position_payout', $3)`,
        [investorId, payout, positionId],
      );
    }
    await client.query(
      `UPDATE users SET available_points = available_points + $2 WHERE id = $1`,
      [investorId, position.locked_points + payout],
    );

    await client.query("COMMIT");

    const list = await listPositions(investorId, undefined, positionId);
    const closed = list[0];
    if (!closed) {
      throw new HttpError(500, "청산된 포지션을 조회할 수 없습니다.");
    }
    return closed;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export interface BettorSummary {
  buyCount: number;
  shortCount: number;
  buyQuantity: number;
  shortQuantity: number;
}

/** GET /stocks/:userId/promises/:promiseId/bettors — 베팅 현황 공개 (M6-5). */
export async function getBettorSummary(
  viewerId: string,
  stockUserId: string,
  promiseId: string,
): Promise<BettorSummary> {
  const pool = getPool();
  requirePool(pool);

  if (viewerId !== stockUserId) {
    const isFriend = await isAcceptedFriend(pool, viewerId, stockUserId);
    if (!isFriend) {
      throw new HttpError(403, "친구의 종목의 베팅 현황만 조회할 수 있습니다.");
    }
  }

  const participant = await pool.query(
    `SELECT 1 FROM promise_participants WHERE promise_id = $1 AND user_id = $2`,
    [promiseId, stockUserId],
  );
  if ((participant.rowCount ?? 0) === 0) {
    throw new HttpError(404, "해당 종목이 이 약속의 참여자가 아닙니다.");
  }

  const result = await pool.query<{
    direction: PositionDirection;
    bettor_count: string;
    total_quantity: string;
  }>(
    `SELECT direction, COUNT(*)::text AS bettor_count,
            COALESCE(SUM(quantity), 0)::text AS total_quantity
     FROM positions
     WHERE stock_user_id = $1 AND promise_id = $2
     GROUP BY direction`,
    [stockUserId, promiseId],
  );

  const summary: BettorSummary = {
    buyCount: 0,
    shortCount: 0,
    buyQuantity: 0,
    shortQuantity: 0,
  };
  for (const row of result.rows) {
    if (row.direction === "buy") {
      summary.buyCount = Number(row.bettor_count);
      summary.buyQuantity = Number(row.total_quantity);
    } else {
      summary.shortCount = Number(row.bettor_count);
      summary.shortQuantity = Number(row.total_quantity);
    }
  }
  return summary;
}

/** GET /positions — 내 포지션 목록. */
export async function listPositions(
  investorId: string,
  status?: "open" | "settled",
  positionId?: string,
): Promise<PositionView[]> {
  const pool = getPool();
  requirePool(pool);

  const params: (string | undefined)[] = [investorId];
  let statusClause = "";
  if (status) {
    params.push(status);
    statusClause = `AND p.status = $${params.length}`;
  }
  let idClause = "";
  if (positionId) {
    params.push(positionId);
    idClause = `AND p.id = $${params.length}`;
  }

  const result = await pool.query<PositionRow>(
    `SELECT p.id, p.stock_user_id, u.nickname AS stock_nickname,
            p.promise_id, pr.title AS promise_title, pr.promised_at,
            p.direction, p.quantity, p.open_price, p.locked_points, p.multiplier,
            p.status, p.price_before, p.price_after, p.payout,
            p.created_at, p.settled_at
     FROM positions p
     JOIN users u ON u.id = p.stock_user_id
     JOIN promises pr ON pr.id = p.promise_id
     WHERE p.investor_id = $1::bigint
       AND p.etf_order_id IS NULL
       ${statusClause}
       ${idClause}
     ORDER BY p.created_at DESC`,
    params,
  );

  return result.rows.map(mapPosition);
}
