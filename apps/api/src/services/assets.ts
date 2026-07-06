import { getPool } from "../db/pool.js";
import { HttpError, requirePool } from "../lib/errors.js";

export interface AssetSummary {
  availablePoints: number;
  lockedPoints: number;
}

export interface TransactionView {
  id: string;
  amount: number;
  txType: string;
  refId: string | null;
  createdAt: string;
}

/** GET /me/assets — 가용/잠금 포인트 (F-14 일부) */
export async function getAssetSummary(userId: string): Promise<AssetSummary> {
  const pool = getPool();
  requirePool(pool);

  const result = await pool.query<{
    available_points: number;
    locked_points: string;
  }>(
    `SELECT
       u.available_points,
       COALESCE((
         SELECT SUM(p.locked_points) FROM positions p
         WHERE p.investor_id = u.id AND p.status = 'open'
       ), 0) AS locked_points
     FROM users u
     WHERE u.id = $1`,
    [userId],
  );

  const row = result.rows[0];
  if (!row) throw new HttpError(404, "사용자를 찾을 수 없습니다.");

  return {
    availablePoints: row.available_points,
    lockedPoints: Number(row.locked_points),
  };
}

/**
 * GET /me/transactions — 포인트 원장 (F-14 일부).
 * 정산은 여러 원장 기록을 한 트랜잭션에서 남기므로 created_at이 동률일 수 있어,
 * id를 2차 정렬 기준으로 둬 최신 기록이 먼저 오도록 보장한다.
 */
export async function listTransactions(
  userId: string,
): Promise<TransactionView[]> {
  const pool = getPool();
  requirePool(pool);

  const result = await pool.query<{
    id: string;
    amount: number;
    tx_type: string;
    ref_id: string | null;
    created_at: Date;
  }>(
    `SELECT id, amount, tx_type, ref_id, created_at
     FROM point_transactions
     WHERE user_id = $1
     ORDER BY created_at DESC, id DESC`,
    [userId],
  );

  return result.rows.map((r) => ({
    id: r.id,
    amount: r.amount,
    txType: r.tx_type,
    refId: r.ref_id,
    createdAt: r.created_at.toISOString(),
  }));
}
