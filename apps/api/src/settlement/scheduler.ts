import type pg from "pg";
import { getPool } from "../db/pool.js";
import { runSettlement, type RunSettlementOptions } from "./run-settlement.js";

const POLL_INTERVAL_MS = 60_000;

let timer: ReturnType<typeof setInterval> | null = null;

/** 1분 주기 정산 폴링 (F-12). 서버 재기동 시 미정산 약속 자동 복구. */
export function startSettlementScheduler(): void {
  const pool = getPool();
  if (!pool) {
    console.warn("[settlement] DATABASE_URL 없음 — 스케줄러 미시작");
    return;
  }
  if (timer) return;

  const tick = () => {
    void runSettlementSafe(pool);
  };

  timer = setInterval(tick, POLL_INTERVAL_MS);
  console.log("[settlement] 스케줄러 시작 (1분 주기)");
  void runSettlementSafe(pool);
}

export function stopSettlementScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

async function runSettlementSafe(pool: pg.Pool): Promise<void> {
  try {
    const { settledIds, failedIds } = await runSettlement(pool);
    if (settledIds.length > 0) {
      console.log(`[settlement] 정산 완료: promise ids ${settledIds.join(", ")}`);
    }
    if (failedIds.length > 0) {
      console.error(
        `[settlement] 정산 실패(다음 틱 재시도): promise ids ${failedIds.join(", ")}`,
      );
    }
  } catch (err) {
    console.error("[settlement] 정산 오류:", err);
  }
}

export async function runSettlementNow(
  options: RunSettlementOptions = {},
): Promise<ReturnType<typeof runSettlement>> {
  const pool = getPool();
  if (!pool) {
    throw new Error("DATABASE_URL이 설정되지 않았습니다.");
  }
  return runSettlement(pool, options);
}
