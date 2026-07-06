import {
  MEME_LABELS,
  memeLabel,
  type Verdict,
} from "@latestock/shared";
import { maskStockName } from "./masking";
import type { ChartPoint, PositionView, PromiseView } from "../types/api";

export type SettlementKind = "investor" | "stock";

export interface SettlementResultVM {
  kind: SettlementKind;
  promiseId: string;
  promiseTitle: string;
  promisedAt: string;
  verdict: Verdict;
  lateMinutes: number;
  memeLabel: string;
  memeBgKey: keyof typeof MEME_LABELS;
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
  promiseTitle: string,
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

export function buildInvestorResult(
  position: PositionView,
  chartPoint: ChartPoint,
  viewerId: string,
): SettlementResultVM {
  const meme = fromChartPoint(chartPoint, position.promiseTitle);
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
  const meme = fromChartPoint(chartPoint, promise.title);
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

export function formatPoints(value: number): string {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toLocaleString()}P`;
}

export function directionLabel(direction: "buy" | "short"): string {
  return direction === "buy" ? "매수" : "공매도";
}
