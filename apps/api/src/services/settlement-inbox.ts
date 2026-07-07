import type { PositionDirection, Verdict } from "@latestock/shared";
import { getPool } from "../db/pool.js";
import { requirePool } from "../lib/errors.js";

export interface UnconfirmedAsStock {
  promiseId: string;
  promiseTitle: string;
  promisedAt: string;
  verdict: Verdict;
  lateMinutes: number;
  settledPrice: number;
}

export interface UnconfirmedAsInvestor {
  positionId: string;
  promiseId: string;
  promiseTitle: string;
  stockUserId: string;
  stockNickname: string;
  direction: PositionDirection;
  payout: number;
  priceBefore: number;
  priceAfter: number;
  settledAt: string;
  verdict: Verdict | null;
  lateMinutes: number | null;
}

export interface UnconfirmedSettlements {
  asStock: UnconfirmedAsStock[];
  asInvestor: UnconfirmedAsInvestor[];
  totalCount: number;
}

interface AsStockRow {
  promise_id: string;
  promise_title: string;
  promised_at: Date;
  verdict: Verdict;
  late_minutes: number;
  settled_price: number;
}

interface AsInvestorRow {
  id: string;
  promise_id: string;
  promise_title: string;
  stock_user_id: string;
  stock_nickname: string;
  direction: PositionDirection;
  payout: number;
  price_before: number;
  price_after: number;
  settled_at: Date;
  verdict: Verdict | null;
  late_minutes: number | null;
}

/**
 * GET /me/unconfirmed-settlements — 미확인 정산 배너 (F-12).
 * idx_pp_unconfirmed(종목 본인)와 idx_pos_unconfirmed(투자자) 두 부분 인덱스를 각각 조회해 합친다.
 */
export async function getUnconfirmedSettlements(
  userId: string,
): Promise<UnconfirmedSettlements> {
  const pool = getPool();
  requirePool(pool);

  const asStockResult = await pool.query<AsStockRow>(
    `SELECT pp.promise_id, pr.title AS promise_title, pr.promised_at,
            pp.verdict, pp.late_minutes, pp.settled_price
     FROM promise_participants pp
     JOIN promises pr ON pr.id = pp.promise_id
     WHERE pp.user_id = $1 AND pp.verdict IS NOT NULL AND pp.result_confirmed_at IS NULL
     ORDER BY pr.promised_at DESC`,
    [userId],
  );

  const asInvestorResult = await pool.query<AsInvestorRow>(
    `SELECT p.id, p.promise_id, pr.title AS promise_title,
            p.stock_user_id, u.nickname AS stock_nickname,
            p.direction, p.payout, p.price_before, p.price_after, p.settled_at,
            pp.verdict, pp.late_minutes
     FROM positions p
     JOIN promises pr ON pr.id = p.promise_id
     JOIN users u ON u.id = p.stock_user_id
     LEFT JOIN promise_participants pp
       ON pp.promise_id = p.promise_id AND pp.user_id = p.stock_user_id
     WHERE p.investor_id = $1 AND p.status = 'settled' AND p.confirmed_at IS NULL
     ORDER BY p.settled_at DESC`,
    [userId],
  );

  const asStock = asStockResult.rows.map((r) => ({
    promiseId: r.promise_id,
    promiseTitle: r.promise_title,
    promisedAt: r.promised_at.toISOString(),
    verdict: r.verdict,
    lateMinutes: r.late_minutes,
    settledPrice: r.settled_price,
  }));

  const asInvestor = asInvestorResult.rows.map((r) => ({
    positionId: r.id,
    promiseId: r.promise_id,
    promiseTitle: r.promise_title,
    stockUserId: r.stock_user_id,
    stockNickname: r.stock_nickname,
    direction: r.direction,
    payout: r.payout,
    priceBefore: r.price_before,
    priceAfter: r.price_after,
    settledAt: r.settled_at.toISOString(),
    verdict: r.verdict,
    lateMinutes: r.late_minutes,
  }));

  return {
    asStock,
    asInvestor,
    totalCount: asStock.length + asInvestor.length,
  };
}
