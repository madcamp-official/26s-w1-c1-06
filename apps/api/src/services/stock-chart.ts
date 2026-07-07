import type { Verdict } from "@latestock/shared";
import { getPool } from "../db/pool.js";
import { HttpError, requirePool } from "../lib/errors.js";

export interface ChartPoint {
  promiseId: string;
  promisedAt: string;
  verdict: Verdict;
  lateMinutes: number;
  settledPrice: number;
}

interface ChartRow {
  promise_id: string;
  promised_at: Date;
  verdict: Verdict;
  late_minutes: number;
  settled_price: number;
}

function mapChartPoint(row: ChartRow): ChartPoint {
  return {
    promiseId: row.promise_id,
    promisedAt: row.promised_at.toISOString(),
    verdict: row.verdict,
    lateMinutes: row.late_minutes,
    settledPrice: row.settled_price,
  };
}

async function isAcceptedFriend(
  pool: import("pg").Pool,
  userId: string,
  friendId: string,
): Promise<boolean> {
  const result = await pool.query(
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
 * GET /me/stock, GET /stocks/:userId — 종목 주가 차트 (F-08/F-13).
 * 본인 조회는 무조건 허용, 타인 조회는 친구(accepted)만 허용(R-5).
 */
export async function getStockChart(
  viewerId: string,
  targetUserId: string,
): Promise<ChartPoint[]> {
  const pool = getPool();
  requirePool(pool);

  if (viewerId !== targetUserId) {
    const target = await pool.query(`SELECT 1 FROM users WHERE id = $1`, [
      targetUserId,
    ]);
    if ((target.rowCount ?? 0) === 0) {
      throw new HttpError(404, "사용자를 찾을 수 없습니다.");
    }
    const isFriend = await isAcceptedFriend(pool, viewerId, targetUserId);
    if (!isFriend) {
      throw new HttpError(403, "친구의 차트만 조회할 수 있습니다.");
    }
  }

  const result = await pool.query<ChartRow>(
    `SELECT pp.promise_id, pr.promised_at, pp.verdict, pp.late_minutes, pp.settled_price
     FROM promise_participants pp
     JOIN promises pr ON pr.id = pp.promise_id
     WHERE pp.user_id = $1 AND pp.verdict IS NOT NULL
     ORDER BY pr.settled_at ASC`,
    [targetUserId],
  );

  return result.rows.map(mapChartPoint);
}
