import { computeLockedPoints, computePayout } from "./payout.js";
import { computeNewPrice } from "./pricing.js";
import type { PositionDirection } from "./types.js";

export interface PositionPreviewScenario {
  label: string;
  verdict: "on_time" | "late" | "no_show";
  lateMinutes: number;
  priceAfter: number;
  payout: number;
}

/** I-1: 베팅 모달 손익 미리보기 (결정론적 클라이언트 계산). */
export function previewPositionScenarios(
  direction: PositionDirection,
  quantity: number,
  currentPrice: number,
  lateMinuteSamples: number[] = [0, 10, 32, 60],
): PositionPreviewScenario[] {
  const locked = computeLockedPoints(quantity, currentPrice);
  const scenarios: PositionPreviewScenario[] = [];

  const onTimeAfter = computeNewPrice(currentPrice, "on_time", 0);
  scenarios.push({
    label: "정시",
    verdict: "on_time",
    lateMinutes: 0,
    priceAfter: onTimeAfter,
    payout: computePayout(
      direction,
      quantity,
      currentPrice,
      onTimeAfter,
      locked,
    ),
  });

  for (const mins of lateMinuteSamples.filter((m) => m > 0 && m < 60)) {
    const after = computeNewPrice(currentPrice, "late", mins);
    scenarios.push({
      label: `${mins}분 지각`,
      verdict: "late",
      lateMinutes: mins,
      priceAfter: after,
      payout: computePayout(direction, quantity, currentPrice, after, locked),
    });
  }

  const noShowAfter = computeNewPrice(currentPrice, "no_show", 60);
  scenarios.push({
    label: "노쇼",
    verdict: "no_show",
    lateMinutes: 60,
    priceAfter: noShowAfter,
    payout: computePayout(
      direction,
      quantity,
      currentPrice,
      noShowAfter,
      locked,
    ),
  });

  return scenarios;
}
