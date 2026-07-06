import { NO_SHOW_MINUTES } from "@latestock/shared";
import type { Verdict } from "@latestock/shared";

export interface VerdictResult {
  verdict: Verdict;
  lateMinutes: number;
}

/**
 * F-06 판정: 조기 인증=정시, 지각분=올림(ceil), 미인증=노쇼(60분).
 * 스키마 CHECK: late는 1~59, no_show는 checkin_at NULL + late_minutes=60.
 */
export function computeVerdict(
  promisedAt: Date,
  checkinAt: Date | null,
): VerdictResult {
  if (checkinAt === null) {
    return { verdict: "no_show", lateMinutes: NO_SHOW_MINUTES };
  }

  if (checkinAt.getTime() <= promisedAt.getTime()) {
    return { verdict: "on_time", lateMinutes: 0 };
  }

  const lateMinutes = Math.ceil(
    (checkinAt.getTime() - promisedAt.getTime()) / 60_000,
  );
  // 인증은 했으나 60분 이상 지각 → late 최대 59 (no_show는 미인증 전용)
  return {
    verdict: "late",
    lateMinutes: Math.min(59, lateMinutes),
  };
}
