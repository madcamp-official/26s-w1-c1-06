import type { PositionDirection } from "@latestock/shared";

/** D3: 공매도 qty×(before-after), 매수 qty×(after-before), 손실은 잠금 초과 불가. */
export function computePayout(
  direction: PositionDirection,
  quantity: number,
  priceBefore: number,
  priceAfter: number,
  lockedPoints: number,
): number {
  const raw =
    direction === "short"
      ? quantity * (priceBefore - priceAfter)
      : quantity * (priceAfter - priceBefore);
  return Math.max(-lockedPoints, raw);
}
