import {
  computeLockedPoints,
  ETF_BASKET_MAX_LEGS,
  ETF_BASKET_MIN_LEGS,
  isBettable,
  suggestEtfThemes,
  type FriendLateStat,
  type InviteStatus,
  type PositionDirection,
} from "@latestock/shared";
import type pg from "pg";
import { getPool } from "../db/pool.js";
import { HttpError, requirePool } from "../lib/errors.js";
import type { PositionView } from "./positions.js";
import { listBettablePromisesForStock } from "./promises.js";

export interface EtfLegInput {
  stockUserId: string;
  promiseId: string;
}

export interface OpenEtfBasketInput {
  direction: PositionDirection;
  quantity: number;
  label?: string;
  themeKey?: string;
  legs: EtfLegInput[];
}

export interface EtfBasketView {
  id: string;
  label: string;
  themeKey: string | null;
  direction: PositionDirection;
  legs: PositionView[];
  totalLocked: number;
  realizedPayout: number;
  isFullySettled: boolean;
  createdAt: string;
}

export interface EtfRecommendationLeg {
  stockUserId: string;
  stockNickname: string;
  promiseId: string;
  promiseTitle: string;
}

export interface EtfRecommendationView {
  themeKey: string;
  name: string;
  emoji: string;
  direction: PositionDirection;
  legs: EtfRecommendationLeg[];
}

interface BasketRow {
  order_id: string;
  label: string;
  theme_key: string | null;
  order_direction: PositionDirection;
  order_created_at: Date;
  position_id: string;
  stock_user_id: string;
  stock_nickname: string;
  promise_id: string;
  promise_title: string;
  promised_at: Date;
  leg_direction: PositionDirection;
  quantity: number;
  open_price: number;
  locked_points: number;
  multiplier: number;
  status: "open" | "settled" | "cancelled";
  price_before: number | null;
  price_after: number | null;
  payout: number | null;
  leg_created_at: Date;
  settled_at: Date | null;
}

function groupBasketRows(rows: BasketRow[]): EtfBasketView[] {
  const orderIds: string[] = [];
  const grouped = new Map<string, { header: BasketRow; legs: PositionView[] }>();

  for (const row of rows) {
    let entry = grouped.get(row.order_id);
    if (!entry) {
      entry = { header: row, legs: [] };
      grouped.set(row.order_id, entry);
      orderIds.push(row.order_id);
    }
    entry.legs.push({
      id: row.position_id,
      stockUserId: row.stock_user_id,
      stockNickname: row.stock_nickname,
      promiseId: row.promise_id,
      promiseTitle: row.promise_title,
      promisedAt: row.promised_at.toISOString(),
      direction: row.leg_direction,
      quantity: row.quantity,
      openPrice: row.open_price,
      lockedPoints: row.locked_points,
      multiplier: row.multiplier,
      status: row.status,
      priceBefore: row.price_before,
      priceAfter: row.price_after,
      payout: row.payout,
      createdAt: row.leg_created_at.toISOString(),
      settledAt: row.settled_at?.toISOString() ?? null,
    });
  }

  return orderIds.map((id) => {
    const { header, legs } = grouped.get(id)!;
    const totalLocked = legs.reduce((sum, leg) => sum + leg.lockedPoints, 0);
    const realizedPayout = legs.reduce(
      (sum, leg) => sum + (leg.status === "settled" ? (leg.payout ?? 0) : 0),
      0,
    );
    const isFullySettled = legs.every((leg) => leg.status === "settled");
    return {
      id,
      label: header.label,
      themeKey: header.theme_key,
      direction: header.order_direction,
      legs,
      totalLocked,
      realizedPayout,
      isFullySettled,
      createdAt: header.order_created_at.toISOString(),
    };
  });
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

/**
 * ETF 바스켓 개설 (S-03). F-10/F-11의 leg별 검증(약속 조회 → 참여자 확인 →
 * 친구 확인 → 베팅 가능 여부 → 중복 확인 → 가격 조회)을 leg마다 반복하고,
 * 총 잠금액을 한 번에 검증한 뒤 한 트랜잭션으로 개설한다(전부 성공 아니면 전부 롤백).
 *
 * leg는 그냥 positions 행이다(etf_order_id만 공통으로 태깅) — 정산은 기존
 * settle-promise.ts가 각 leg의 promise_id 기준으로 그대로 처리하므로
 * 이 함수는 "개설"만 책임진다.
 */
export async function openEtfBasket(
  investorId: string,
  input: OpenEtfBasketInput,
  now: Date = new Date(),
): Promise<EtfBasketView> {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new HttpError(400, "quantity는 1 이상의 정수여야 합니다.");
  }
  if (input.direction !== "buy" && input.direction !== "short") {
    throw new HttpError(400, 'direction은 "buy" 또는 "short"여야 합니다.');
  }
  if (
    !Array.isArray(input.legs) ||
    input.legs.length < ETF_BASKET_MIN_LEGS ||
    input.legs.length > ETF_BASKET_MAX_LEGS
  ) {
    throw new HttpError(
      400,
      `legs는 ${ETF_BASKET_MIN_LEGS}~${ETF_BASKET_MAX_LEGS}개여야 합니다.`,
    );
  }
  const stockUserIds = input.legs.map((leg) => leg.stockUserId);
  if (new Set(stockUserIds).size !== stockUserIds.length) {
    throw new HttpError(400, "구성 종목이 중복되었습니다.");
  }
  if (stockUserIds.includes(investorId)) {
    throw new HttpError(403, "자기 주식은 바스켓에 포함할 수 없습니다.");
  }

  const label = input.label?.trim() || "내가 만든 펀드";

  // 데드락 방지: 여러 유저 행을 한 트랜잭션에서 FOR UPDATE로 잠글 때
  // 항상 같은 순서(stockUserId 오름차순)로 잠가야 두 바스켓 개설 트랜잭션이
  // 서로 다른 순서로 잠그다 맞물리는 상황을 막을 수 있다.
  const legsSorted = [...input.legs].sort((a, b) =>
    a.stockUserId.localeCompare(b.stockUserId),
  );

  const pool = getPool();
  requirePool(pool);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const orderResult = await client.query<{ id: string }>(
      `INSERT INTO etf_orders (investor_id, label, theme_key, direction)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [investorId, label, input.themeKey ?? null, input.direction],
    );
    const etfOrderId = orderResult.rows[0]?.id;
    if (!etfOrderId) {
      throw new HttpError(500, "바스켓 생성에 실패했습니다.");
    }

    const investorResult = await client.query<{ available_points: number }>(
      `SELECT available_points FROM users WHERE id = $1 FOR UPDATE`,
      [investorId],
    );
    const investor = investorResult.rows[0];
    if (!investor) {
      throw new HttpError(404, "사용자를 찾을 수 없습니다.");
    }

    let totalLocked = 0;
    const preparedLegs: {
      stockUserId: string;
      promiseId: string;
      openPrice: number;
      lockedPoints: number;
    }[] = [];

    for (const leg of legsSorted) {
      const promiseResult = await client.query<{
        promised_at: Date;
        settled_at: Date | null;
      }>(
        `SELECT promised_at, settled_at FROM promises WHERE id = $1 FOR UPDATE`,
        [leg.promiseId],
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
        [leg.promiseId, leg.stockUserId],
      );
      const targetInviteStatus = participantResult.rows[0]?.invite_status;
      if (!targetInviteStatus) {
        throw new HttpError(404, "해당 종목이 이 약속의 참여자가 아닙니다.");
      }

      const isFriend = await isAcceptedFriend(
        client,
        investorId,
        leg.stockUserId,
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
          throw new HttpError(
            403,
            "약속을 수락한 참여자에만 베팅할 수 있습니다.",
          );
        }
        throw new HttpError(409, "베팅 마감된 약속입니다.");
      }

      const duplicate = await client.query(
        `SELECT 1 FROM positions
         WHERE investor_id = $1 AND stock_user_id = $2 AND promise_id = $3`,
        [investorId, leg.stockUserId, leg.promiseId],
      );
      if ((duplicate.rowCount ?? 0) > 0) {
        throw new HttpError(409, "이미 해당 약속·종목에 포지션이 있습니다.");
      }

      const stockResult = await client.query<{ current_price: number }>(
        `SELECT current_price FROM users WHERE id = $1 FOR UPDATE`,
        [leg.stockUserId],
      );
      const openPrice = stockResult.rows[0]?.current_price;
      if (openPrice === undefined) {
        throw new HttpError(404, "종목을 찾을 수 없습니다.");
      }

      const lockedPoints = computeLockedPoints(input.quantity, openPrice);
      totalLocked += lockedPoints;
      preparedLegs.push({
        stockUserId: leg.stockUserId,
        promiseId: leg.promiseId,
        openPrice,
        lockedPoints,
      });
    }

    if (investor.available_points < totalLocked) {
      throw new HttpError(402, "가용 포인트가 부족합니다.");
    }

    for (const leg of preparedLegs) {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO positions (
           investor_id, stock_user_id, promise_id, direction,
           quantity, open_price, locked_points, multiplier, etf_order_id
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8)
         RETURNING id`,
        [
          investorId,
          leg.stockUserId,
          leg.promiseId,
          input.direction,
          input.quantity,
          leg.openPrice,
          leg.lockedPoints,
          etfOrderId,
        ],
      );
      const positionId = inserted.rows[0]?.id;
      if (!positionId) {
        throw new HttpError(500, "포지션 생성에 실패했습니다.");
      }
      await client.query(
        `INSERT INTO point_transactions (user_id, amount, tx_type, ref_id)
         VALUES ($1, $2, 'position_lock', $3)`,
        [investorId, -leg.lockedPoints, positionId],
      );
    }

    await client.query(
      `UPDATE users SET available_points = available_points - $2 WHERE id = $1`,
      [investorId, totalLocked],
    );

    await client.query("COMMIT");

    const basket = await getEtfBasket(investorId, etfOrderId);
    if (!basket) {
      throw new HttpError(500, "생성된 바스켓을 조회할 수 없습니다.");
    }
    return basket;
  } catch (err) {
    await client.query("ROLLBACK");
    if (err && typeof err === "object" && "code" in err && err.code === "23505") {
      throw new HttpError(409, "이미 해당 약속·종목에 포지션이 있습니다.");
    }
    throw err;
  } finally {
    client.release();
  }
}

/** GET /etf/baskets — 내 바스켓 목록. status는 그룹 전체 기준(open=leg 중 하나라도 진행중, settled=전부 정산). */
export async function listEtfBaskets(
  investorId: string,
  status?: "open" | "settled",
): Promise<EtfBasketView[]> {
  const pool = getPool();
  requirePool(pool);

  const result = await pool.query<BasketRow>(
    `SELECT eo.id AS order_id, eo.label, eo.theme_key,
            eo.direction AS order_direction, eo.created_at AS order_created_at,
            p.id AS position_id, p.stock_user_id, u.nickname AS stock_nickname,
            p.promise_id, pr.title AS promise_title, pr.promised_at,
            p.direction AS leg_direction, p.quantity, p.open_price,
            p.locked_points, p.multiplier, p.status,
            p.price_before, p.price_after, p.payout,
            p.created_at AS leg_created_at, p.settled_at
     FROM etf_orders eo
     JOIN positions p ON p.etf_order_id = eo.id
     JOIN users u ON u.id = p.stock_user_id
     JOIN promises pr ON pr.id = p.promise_id
     WHERE eo.investor_id = $1::bigint
     ORDER BY eo.created_at DESC, p.stock_user_id ASC`,
    [investorId],
  );

  const baskets = groupBasketRows(result.rows);
  if (status === "open") return baskets.filter((b) => !b.isFullySettled);
  if (status === "settled") return baskets.filter((b) => b.isFullySettled);
  return baskets;
}

async function getEtfBasket(
  investorId: string,
  etfOrderId: string,
): Promise<EtfBasketView | undefined> {
  const baskets = await listEtfBaskets(investorId);
  return baskets.find((b) => b.id === etfOrderId);
}

/**
 * GET /etf/recommendations — 추천 ETF (실시간 계산, 저장 안 함).
 * "지금 베팅 가능한 약속이 있는 친구"만 후보로 남겨서, 추천했는데 못 사는
 * 상황을 애초에 막는다. 멤버별로 가장 이른 베팅 가능 약속을 leg로 채운다.
 */
export async function getEtfRecommendations(
  investorId: string,
  now: Date = new Date(),
): Promise<EtfRecommendationView[]> {
  const pool = getPool();
  requirePool(pool);

  const friendsResult = await pool.query<{
    id: string;
    nickname: string;
    ewma_late_p: number;
  }>(
    `SELECT u.id, u.nickname, u.ewma_late_p
     FROM friendships f
     JOIN users u ON u.id = CASE
       WHEN f.requester_id = $1::bigint THEN f.addressee_id
       ELSE f.requester_id
     END
     WHERE f.status = 'accepted'
       AND (f.requester_id = $1::bigint OR f.addressee_id = $1::bigint)`,
    [investorId],
  );

  const candidateLegs = new Map<string, EtfRecommendationLeg>();
  const stats: FriendLateStat[] = [];

  for (const friend of friendsResult.rows) {
    const promises = await listBettablePromisesForStock(
      investorId,
      friend.id,
      now,
    );
    const soonest = promises[0];
    if (!soonest) continue; // 지금 베팅 가능한 약속이 없으면 후보에서 제외

    candidateLegs.set(friend.id, {
      stockUserId: friend.id,
      stockNickname: friend.nickname,
      promiseId: soonest.id,
      promiseTitle: soonest.title,
    });
    stats.push({ userId: friend.id, ewmaLateP: friend.ewma_late_p });
  }

  if (stats.length === 0) return [];

  const themes = suggestEtfThemes(stats);

  return themes.map((theme) => ({
    themeKey: theme.key,
    name: theme.name,
    emoji: theme.emoji,
    direction: theme.direction,
    legs: theme.memberUserIds.map((userId) => candidateLegs.get(userId)!),
  }));
}
