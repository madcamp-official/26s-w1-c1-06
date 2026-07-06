import type pg from "pg";
import { settleOnePromise } from "./settle-promise.js";

export interface RunSettlementOptions {
  /** F-16 데모: 주입 가능한 현재 시각 (기본값 = 실제 now). */
  now?: Date;
  /** 지정 시 해당 약속만 강제 정산 (settle_due_at 무시). */
  promiseId?: number;
}

export interface RunSettlementResult {
  settledIds: number[];
  skippedIds: number[];
}

/**
 * 미정산 약속을 settle_due_at ASC 순으로 정산 (M1.0-2 순서 보장).
 */
export async function runSettlement(
  pool: pg.Pool,
  options: RunSettlementOptions = {},
): Promise<RunSettlementResult> {
  const now = options.now ?? new Date();
  const client = await pool.connect();

  try {
    let dueIds: number[];

    if (options.promiseId !== undefined) {
      dueIds = [options.promiseId];
    } else {
      const result = await client.query<{ id: string }>(
        `SELECT id FROM promises
         WHERE settled_at IS NULL AND settle_due_at <= $1
         ORDER BY settle_due_at ASC`,
        [now],
      );
      dueIds = result.rows.map((r) => Number(r.id));
    }

    const settledIds: number[] = [];
    const skippedIds: number[] = [];

    for (const id of dueIds) {
      const txClient = await pool.connect();
      try {
        const settled = await settleOnePromise(txClient, id, now);
        if (settled) settledIds.push(id);
        else skippedIds.push(id);
      } finally {
        txClient.release();
      }
    }

    return { settledIds, skippedIds };
  } finally {
    client.release();
  }
}
