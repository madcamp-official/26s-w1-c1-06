import {
  EWMA_ALPHA,
  FLOOR_PRICE,
  LATE_DROP_RATE_PER_MIN,
  NO_SHOW_MINUTES,
  ON_TIME_RISE_RATE,
} from "@latestock/shared";
import type { Verdict } from "@latestock/shared";

/** F-07: 정시 상승 / 지각·노쇼 하락(단리), 하한가 클램프. INT 원 단위 정수 연산. */
export function computeNewPrice(
  currentPrice: number,
  verdict: Verdict,
  lateMinutes: number,
): number {
  let raw: number;
  if (verdict === "on_time") {
    raw = currentPrice + Math.floor(currentPrice * ON_TIME_RISE_RATE);
  } else if (verdict === "no_show") {
    raw =
      currentPrice -
      Math.floor(currentPrice * NO_SHOW_MINUTES * LATE_DROP_RATE_PER_MIN);
  } else {
    raw =
      currentPrice -
      Math.floor(currentPrice * lateMinutes * LATE_DROP_RATE_PER_MIN);
  }
  return Math.max(FLOOR_PRICE, raw);
}

/** L-01 EWMA: 지각/노쇼=1, 정시=0. */
export function computeEwmaLateP(current: number, verdict: Verdict): number {
  const indicator = verdict === "on_time" ? 0 : 1;
  return EWMA_ALPHA * indicator + (1 - EWMA_ALPHA) * current;
}
