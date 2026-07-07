import {
  computeOptionPayout,
  computeOptionPremium,
  isBettable,
  type InviteStatus,
  type OptionType,
} from "@latestock/shared";
import type pg from "pg";
import { getPool } from "../db/pool.js";
import { HttpError, requirePool } from "../lib/errors.js";

export interface BuyOptionInput {
  stockUserId: string;
  promiseId: string;
  optionType: OptionType;
  quantity: number;
}

export interface OptionPositionView {
  id: string;
  stockUserId: string;
  stockNickname: string;
  promiseId: string;
  promiseTitle: string;
  promisedAt: string;
  optionType: OptionType;
  quantity: number;
  referencePrice: number;
  premiumPaid: number;
  status: "open" | "settled" | "cancelled";
  payout: number | null;
  createdAt: string;
  settledAt: string | null;
}

interface OptionRow {
  id: string;
  stock_user_id: string;
  stock_nickname: string;
  promise_id: string;
  promise_title: string;
  promised_at: Date;
  option_type: OptionType;
  quantity: number;
  reference_price: number;
  premium_paid: number;
  status: "open" | "settled" | "cancelled";
  payout: number | null;
  created_at: Date;
  settled_at: Date | null;
}

function mapOption(row: OptionRow): OptionPositionView {
  return {
    id: row.id,
    stockUserId: row.stock_user_id,
    stockNickname: row.stock_nickname,
    promiseId: row.promise_id,
    promiseTitle: row.promise_title,
    promisedAt: row.promised_at.toISOString(),
    optionType: row.option_type,
    quantity: row.quantity,
    referencePrice: row.reference_price,
    premiumPaid: row.premium_paid,
    status: row.status,
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

/** POST /options — 옵션 매수 (S-04). 프리미엄=가중치(수량), 이진 행사(strike 없음). */
export async function buyOption(
  investorId: string,
  input: BuyOptionInput,
  now: Date = new Date(),
): Promise<OptionPositionView> {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new HttpError(400, "quantity는 1 이상의 정수여야 합니다.");
  }
  if (input.optionType !== "call" && input.optionType !== "put") {
    throw new HttpError(400, 'optionType은 "call" 또는 "put"이어야 합니다.');
  }
  if (investorId === input.stockUserId) {
    throw new HttpError(403, "자기 주식에는 베팅할 수 없습니다.");
  }

  const pool = getPool();
  requirePool(pool);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const promiseResult = await client.query<{
      promised_at: Date;
      settled_at: Date | null;
    }>(
      `SELECT promised_at, settled_at FROM promises WHERE id = $1 FOR UPDATE`,
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

    const isFriend = await isAcceptedFriend(client, investorId, input.stockUserId);

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
      `SELECT 1 FROM option_positions
       WHERE investor_id = $1 AND stock_user_id = $2 AND promise_id = $3 AND option_type = $4`,
      [investorId, input.stockUserId, input.promiseId, input.optionType],
    );
    if ((duplicate.rowCount ?? 0) > 0) {
      throw new HttpError(409, "이미 해당 약속·종목·유형의 옵션이 있습니다.");
    }

    const stockResult = await client.query<{
      current_price: number;
      ewma_late_p: number;
    }>(
      `SELECT current_price, ewma_late_p FROM users WHERE id = $1 FOR UPDATE`,
      [input.stockUserId],
    );
    if (!stockResult.rows[0]) {
      throw new HttpError(404, "종목을 찾을 수 없습니다.");
    }
    const referencePrice = stockResult.rows[0].current_price;
    const p = stockResult.rows[0].ewma_late_p;

    const investorResult = await client.query<{ available_points: number }>(
      `SELECT available_points FROM users WHERE id = $1 FOR UPDATE`,
      [investorId],
    );
    const investor = investorResult.rows[0];
    if (!investor) {
      throw new HttpError(404, "사용자를 찾을 수 없습니다.");
    }

    const premium = computeOptionPremium(input.optionType, referencePrice, input.quantity, p);
    if (investor.available_points < premium) {
      throw new HttpError(402, "가용 포인트가 부족합니다.");
    }

    const inserted = await client.query<{ id: string }>(
      `INSERT INTO option_positions (
         investor_id, stock_user_id, promise_id, option_type,
         quantity, reference_price, premium_paid, p_at_purchase
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        investorId,
        input.stockUserId,
        input.promiseId,
        input.optionType,
        input.quantity,
        referencePrice,
        premium,
        p,
      ],
    );
    const optionId = inserted.rows[0]?.id;
    if (!optionId) {
      throw new HttpError(500, "옵션 생성에 실패했습니다.");
    }

    await client.query(
      `INSERT INTO point_transactions (user_id, amount, tx_type, ref_id)
       VALUES ($1, $2, 'option_premium', $3)`,
      [investorId, -premium, optionId],
    );
    await client.query(
      `UPDATE users SET available_points = available_points - $2 WHERE id = $1`,
      [investorId, premium],
    );

    await client.query("COMMIT");

    const list = await listOptions(investorId, undefined, optionId);
    const created = list[0];
    if (!created) {
      throw new HttpError(500, "생성된 옵션을 조회할 수 없습니다.");
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
      throw new HttpError(409, "이미 해당 약속·종목·유형의 옵션이 있습니다.");
    }
    throw err;
  } finally {
    client.release();
  }
}

/** GET /options — 내 옵션 목록. */
export async function listOptions(
  investorId: string,
  status?: "open" | "settled",
  optionId?: string,
): Promise<OptionPositionView[]> {
  const pool = getPool();
  requirePool(pool);

  const params: (string | undefined)[] = [investorId];
  let statusClause = "";
  if (status) {
    params.push(status);
    statusClause = `AND o.status = $${params.length}`;
  }
  let idClause = "";
  if (optionId) {
    params.push(optionId);
    idClause = `AND o.id = $${params.length}`;
  }

  const result = await pool.query<OptionRow>(
    `SELECT o.id, o.stock_user_id, u.nickname AS stock_nickname,
            o.promise_id, pr.title AS promise_title, pr.promised_at,
            o.option_type, o.quantity, o.reference_price, o.premium_paid,
            o.status, o.payout, o.created_at, o.settled_at
     FROM option_positions o
     JOIN users u ON u.id = o.stock_user_id
     JOIN promises pr ON pr.id = o.promise_id
     WHERE o.investor_id = $1::bigint
       ${statusClause}
       ${idClause}
     ORDER BY o.created_at DESC`,
    params,
  );

  return result.rows.map(mapOption);
}

/**
 * 약속 정산(settle-promise.ts)에서 호출 — 해당 약속·종목에 걸린 open 옵션을
 * 이진 판정(strike 없음: 콜=정시, 풋=지각/노쇼)으로 정산한다.
 * 승리 시에만 point_transactions에 기록(0은 amount<>0 CHECK 위반이라 스킵).
 */
export async function settleOptionsForStock(
  client: pg.PoolClient,
  promiseId: number,
  stockUserId: number,
  verdict: import("@latestock/shared").Verdict,
  now: Date,
): Promise<void> {
  const openOptions = await client.query<{
    id: string;
    investor_id: string;
    option_type: OptionType;
    quantity: number;
    reference_price: number;
  }>(
    `SELECT id, investor_id, option_type, quantity, reference_price
     FROM option_positions
     WHERE promise_id = $1 AND stock_user_id = $2 AND status = 'open'
     FOR UPDATE`,
    [promiseId, stockUserId],
  );

  for (const opt of openOptions.rows) {
    const payout = computeOptionPayout(
      opt.option_type,
      verdict,
      opt.quantity,
      opt.reference_price,
    );
    const investorId = Number(opt.investor_id);
    const optionId = Number(opt.id);

    await client.query(
      `UPDATE option_positions
       SET status = 'settled', payout = $2, settled_at = $3
       WHERE id = $1`,
      [optionId, payout, now],
    );

    if (payout !== 0) {
      await client.query(
        `INSERT INTO point_transactions (user_id, amount, tx_type, ref_id)
         VALUES ($1, $2, 'option_payout', $3)`,
        [investorId, payout, optionId],
      );
      await client.query(
        `UPDATE users SET available_points = available_points + $2 WHERE id = $1`,
        [investorId, payout],
      );
    }
  }
}
