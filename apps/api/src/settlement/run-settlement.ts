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
  /** 정산 중 예외가 발생한 약속. 다음 폴링에서 재시도되며, 나머지 약속 처리를 막지 않는다. */
  failedIds: number[];
}

/**
 * 미정산 약속을 settle_due_at ASC 순으로 정산 (M1.0-2 순서 보장).
 * 한 약속의 정산 실패가 나머지 약속의 정산까지 막지 않도록 개별적으로 격리한다.
 */
export async function runSettlement(
  pool: pg.Pool,
  options: RunSettlementOptions = {},
): Promise<RunSettlementResult> {
  const now = options.now ?? new Date();

  let dueIds: number[];
  if (options.promiseId !== undefined) {
    dueIds = [options.promiseId];
  } else {
    const listClient = await pool.connect();
    try {
      const result = await listClient.query<{ id: string }>(
        `SELECT id FROM promises
         WHERE settled_at IS NULL AND settle_due_at <= $1
         ORDER BY settle_due_at ASC`,
        [now],
      );
      dueIds = result.rows.map((r) => Number(r.id));
    } finally {
      listClient.release();
    }
  }

  const settledIds: number[] = [];
  const skippedIds: number[] = [];
  const failedIds: number[] = [];

  for (const id of dueIds) {
    const txClient = await pool.connect();
    try {
      const settled = await settleOnePromise(txClient, id, now);
      if (settled) settledIds.push(id);
      else skippedIds.push(id);
    } catch (err) {
      failedIds.push(id);
      console.error(
        `[settlement] promise ${id} 정산 실패 (다음 폴링에서 재시도):`,
        err,
      );
    } finally {
      txClient.release();
    }
  }

  return { settledIds, skippedIds, failedIds };
}
