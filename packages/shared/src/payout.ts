import type { PositionDirection } from "./types.js";

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

/** 포지션 개설 시 잠금 포인트 (D3). */
export function computeLockedPoints(
  quantity: number,
  openPrice: number,
): number {
  return quantity * openPrice;
}
