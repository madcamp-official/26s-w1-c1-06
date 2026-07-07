import {
  MEME_LABELS,
  memeLabel,
  type Verdict,
} from "@latestock/shared";
import { maskStockName } from "./masking";
import type {
  ChartPoint,
  PositionView,
  PromiseView,
  UnconfirmedAsInvestor,
  UnconfirmedAsStock,
} from "../types/api";

export type SettlementKind = "investor" | "stock";

export interface SettlementResultVM {
  kind: SettlementKind;
  promiseId: string;
  promiseTitle: string;
  promisedAt: string;
  /** "early_exit" = 약속 판정을 기다리지 않고 조기 청산(M3-2)한 경우, 판정 등급 없음. */
  verdict: Verdict | "early_exit";
  lateMinutes: number;
  memeLabel: string;
  memeBgKey: keyof typeof MEME_LABELS | "EARLY_EXIT";
  settledPrice: number;
  priceBefore?: number;
  priceAfter?: number;
  direction?: "buy" | "short";
  quantity?: number;
  payout?: number;
  lockedPoints?: number;
  positionId?: string;
  stockUserId?: string;
  stockDisplayName: string;
}

export function memeLabelKey(
  lateMinutes: number,
  isNoShow: boolean,
): keyof typeof MEME_LABELS {
  if (isNoShow) return "NO_SHOW";
  if (lateMinutes <= 0) return "ON_TIME";
  if (lateMinutes <= 10) return "LATE_1_10";
  if (lateMinutes <= 30) return "LATE_11_30";
  return "LATE_31_PLUS";
}

/**
 * 판정(verdict)으로부터 밈 등급을 결정하는 단일 소스 — 차트 포인트든, 미확인 정산
 * 목록이든, 어디서 온 값이든 이 함수 하나만 거치면 항상 같은 라벨이 나온다.
 * verdict가 null이면 조기 청산(M3-2) — 약속이 판정 안 나서 등급 자체가 없는 경우.
 */
function memeFromVerdict(
  verdict: Verdict | null,
  lateMinutes: number | null,
  settledPrice: number,
): Pick<
  SettlementResultVM,
  "verdict" | "lateMinutes" | "memeLabel" | "memeBgKey" | "settledPrice"
> {
  if (!verdict) {
    return {
      verdict: "early_exit",
      lateMinutes: 0,
      memeLabel: "조기 청산 💰",
      memeBgKey: "EARLY_EXIT",
      settledPrice,
    };
  }
  const isNoShow = verdict === "no_show";
  const mins = lateMinutes ?? 0;
  return {
    verdict,
    lateMinutes: mins,
    memeLabel: memeLabel(mins, isNoShow),
    memeBgKey: memeLabelKey(mins, isNoShow),
    settledPrice,
  };
}

export function buildInvestorResult(
  position: PositionView,
  chartPoint: ChartPoint | null,
  viewerId: string,
): SettlementResultVM {
  const meme = chartPoint
    ? memeFromVerdict(chartPoint.verdict, chartPoint.lateMinutes, chartPoint.settledPrice)
    : memeFromVerdict(null, null, position.priceAfter ?? position.openPrice);
  const vm: SettlementResultVM = {
    kind: "investor",
    promiseId: position.promiseId,
    promiseTitle: position.promiseTitle,
    promisedAt: position.promisedAt,
    ...meme,
    priceBefore: position.priceBefore ?? undefined,
    priceAfter: position.priceAfter ?? undefined,
    direction: position.direction,
    quantity: position.quantity,
    payout: position.payout ?? undefined,
    lockedPoints: position.lockedPoints,
    positionId: position.id,
    stockUserId: position.stockUserId,
    stockDisplayName: maskStockName(
      position.stockNickname,
      viewerId,
      position.stockUserId,
    ),
  };
  return vm;
}

export function buildStockResult(
  chartPoint: ChartPoint,
  promise: PromiseView,
  stockNickname: string,
  viewerId: string,
  stockUserId: string,
): SettlementResultVM {
  const meme = memeFromVerdict(chartPoint.verdict, chartPoint.lateMinutes, chartPoint.settledPrice);
  return {
    kind: "stock",
    promiseId: promise.id,
    promiseTitle: promise.title,
    promisedAt: promise.promisedAt,
    ...meme,
    stockUserId,
    stockDisplayName: maskStockName(stockNickname, viewerId, stockUserId),
  };
}

/** M6-1: 미확인 정산(종목 본인 쪽)을 별도 조회 없이 즉석에서 결과 VM으로 변환. */
export function buildVMFromUnconfirmedStock(
  item: UnconfirmedAsStock,
  viewerNickname: string,
  viewerId: string,
): SettlementResultVM {
  const meme = memeFromVerdict(item.verdict, item.lateMinutes, item.settledPrice);
  return {
    kind: "stock",
    promiseId: item.promiseId,
    promiseTitle: item.promiseTitle,
    promisedAt: item.promisedAt,
    ...meme,
    stockUserId: viewerId,
    stockDisplayName: maskStockName(viewerNickname, viewerId, viewerId),
  };
}

/** M6-1: 미확인 정산(투자자 쪽)을 별도 조회 없이 즉석에서 결과 VM으로 변환. */
export function buildVMFromUnconfirmedInvestor(
  item: UnconfirmedAsInvestor,
  viewerId: string,
): SettlementResultVM {
  const meme = memeFromVerdict(item.verdict, item.lateMinutes, item.priceAfter);
  return {
    kind: "investor",
    promiseId: item.promiseId,
    promiseTitle: item.promiseTitle,
    promisedAt: item.settledAt,
    ...meme,
    priceBefore: item.priceBefore,
    priceAfter: item.priceAfter,
    direction: item.direction,
    payout: item.payout,
    positionId: item.positionId,
    stockUserId: item.stockUserId,
    stockDisplayName: maskStockName(item.stockNickname, viewerId, item.stockUserId),
  };
}

export function formatPoints(value: number): string {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toLocaleString()}P`;
}

export function directionLabel(direction: "buy" | "short"): string {
  return direction === "buy" ? "매수" : "공매도";
}

/** 판정을 사람이 읽는 짧은 문구로 — SettlementHero 부제, 관계형 손익 카피(M6-3) 등에서 공용. */
export function verdictPhrase(vm: SettlementResultVM): string {
  if (vm.verdict === "early_exit") return "약속 판정 전 조기 청산";
  if (vm.verdict === "on_time") return "정시 도착";
  if (vm.verdict === "no_show") return "노쇼 (미인증)";
  return `${vm.lateMinutes}분 지각`;
}
