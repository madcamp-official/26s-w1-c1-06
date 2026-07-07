import { LATE_DROP_RATE_PER_MIN, NO_SHOW_MINUTES, ON_TIME_RISE_RATE } from "./constants.js";
import type { OptionType, PositionDirection, Verdict } from "./types.js";

/**
 * D3: 공매도 qty×(before-after), 매수 qty×(after-before), 손실은 잠금 초과 불가.
 * multiplier(S-05 레버리지)는 손익 폭만 배로 늘리고 잠금(마진)은 그대로 두므로,
 * 배율이 클수록 같은 지각분에도 손실이 잠금 한도(클램프)에 더 빨리 도달한다(L-02).
 */
export function computePayout(
  direction: PositionDirection,
  quantity: number,
  priceBefore: number,
  priceAfter: number,
  lockedPoints: number,
  multiplier: number = 1,
): number {
  const raw =
    direction === "short"
      ? quantity * (priceBefore - priceAfter)
      : quantity * (priceAfter - priceBefore);
  return Math.max(-lockedPoints, raw * multiplier);
}

/**
 * 포지션 개설 시 잠금 포인트 (D3).
 * 배율(S-05)과 무관하게 고정 — 배율은 손익 폭에만 곱해지고, 잠금(마진)은
 * 그대로라서 배율이 클수록 같은 지각분에도 손실이 잠금 한도에 더 빨리 도달한다(L-02).
 */
export function computeLockedPoints(
  quantity: number,
  openPrice: number,
): number {
  return quantity * openPrice;
}

export interface LiquidationThreshold {
  /** 매수(BUY): 이만큼 지각하면 잠금 전액 청산(도달 불가면 null). 공매도는 사용 안 함. */
  lateMinutesThreshold: number | null;
  /** 공매도(SHORT): 정시 도착이라는 단발 이벤트만으로 전액 청산되는지. */
  onTimeLiquidates: boolean;
}

/**
 * L-02: 레버리지 포지션 개설 시점에 청산 조건을 결정론적으로 계산(S-05 연계).
 * 매수는 "지각 분"이 늘어날수록 손실이 커지는 연속량이라 임계 분을 역산할 수 있지만,
 * 공매도의 위험 이벤트(정시 도착)는 단발이라 임계값이 아니라 참/거짓으로만 판정한다.
 */
export function computeLiquidationThreshold(
  direction: PositionDirection,
  multiplier: number,
): LiquidationThreshold {
  if (direction === "short") {
    return {
      lateMinutesThreshold: null,
      onTimeLiquidates: ON_TIME_RISE_RATE * multiplier >= 1,
    };
  }

  const rawThreshold = 1 / (LATE_DROP_RATE_PER_MIN * multiplier);
  return {
    lateMinutesThreshold:
      rawThreshold <= NO_SHOW_MINUTES ? Math.ceil(rawThreshold) : null,
    onTimeLiquidates: false,
  };
}

/**
 * S-04/L-01: 옵션 프리미엄. 가중치=수량으로 확정 —
 * 풋 = 기준가×p×수량, 콜 = 기준가×(1-p)×수량.
 * 행사 성공 배당(quantity*referencePrice)과 짝을 이루면 기대값이 0에 수렴하는
 * 공정 가격 구조가 된다(별도 house edge 상수 불필요).
 */
export function computeOptionPremium(
  optionType: OptionType,
  referencePrice: number,
  quantity: number,
  p: number,
): number {
  const prob = optionType === "put" ? p : 1 - p;
  return Math.round(referencePrice * prob * quantity);
}

/**
 * S-04: 옵션 행사 판정 — strike 없이 이진(콜=정시, 풋=지각/노쇼).
 * 승리 시 고정 배당(quantity*referencePrice), 패배 시 0(프리미엄은 이미 지불했으므로
 * 추가 손실 없음 — 옵션은 손실이 프리미엄으로 상한선이 고정된 상품).
 */
export function computeOptionPayout(
  optionType: OptionType,
  verdict: Verdict,
  quantity: number,
  referencePrice: number,
): number {
  const won = optionType === "call" ? verdict === "on_time" : verdict !== "on_time";
  return won ? quantity * referencePrice : 0;
}
