import {
  MEME_LABELS,
  memeLabel,
  type Verdict,
} from "@latestock/shared";
import { maskStockName } from "./masking";
import type { UnconfirmedAsInvestor, UnconfirmedAsStock, ChartPoint, PositionView, PromiseView } from "../types/api";

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

function fromChartPoint(
  point: ChartPoint,
): Pick<
  SettlementResultVM,
  "verdict" | "lateMinutes" | "memeLabel" | "memeBgKey" | "settledPrice"
> {
  const isNoShow = point.verdict === "no_show";
  const label = memeLabel(point.lateMinutes, isNoShow);
  return {
    verdict: point.verdict,
    lateMinutes: point.lateMinutes,
    memeLabel: label,
    memeBgKey: memeLabelKey(point.lateMinutes, isNoShow),
    settledPrice: point.settledPrice,
  };
}

function fromEarlyExit(
  position: PositionView,
): Pick<
  SettlementResultVM,
  "verdict" | "lateMinutes" | "memeLabel" | "memeBgKey" | "settledPrice"
> {
  return {
    verdict: "early_exit",
    lateMinutes: 0,
    memeLabel: "조기 청산 💰",
    memeBgKey: "EARLY_EXIT",
    settledPrice: position.priceAfter ?? position.openPrice,
  };
}

/** 판정(verdict)으로 밈·등급을 결정 — 차트 포인트·미확인 정산 목록 공통. */
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
  const meme = chartPoint ? fromChartPoint(chartPoint) : fromEarlyExit(position);
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

/** M6-1: 미확인 정산(종목 본인) — 별도 조회 없이 목록에서 결과 VM으로 변환. */
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

/** M6-1: 미확인 정산(투자자) — 별도 조회 없이 목록에서 결과 VM으로 변환. */
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
