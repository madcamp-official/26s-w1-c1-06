import { BASE_STOCK_PRICE } from "@latestock/shared";
import type { ChartPoint } from "../hooks/useStockChart";

export interface DailyCandle {
  /** "YYYY-MM-DD" (lightweight-charts business-day 문자열 포맷) */
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  /** 그날 발생한 정산(지각비) 이벤트 개수 */
  volume: number;
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * 정산 이벤트(약속 단위) 배열을 날짜별 OHLC + 거래량(그날 지각비 발생 횟수) 캔들로 집계한다.
 * 이벤트가 없는 날은 봉을 만들지 않는다 — 실제 주식 차트가 휴장일을 건너뛰듯,
 * 다음 실제 이벤트가 있는 날의 open이 마지막 이벤트가 있던 날의 close를 그대로 이어받는다.
 */
export function aggregateDailyCandles(points: ChartPoint[]): DailyCandle[] {
  const sorted = [...points].sort(
    (a, b) => new Date(a.promisedAt).getTime() - new Date(b.promisedAt).getTime(),
  );

  const groups = new Map<string, ChartPoint[]>();
  for (const p of sorted) {
    const key = dayKey(p.promisedAt);
    const bucket = groups.get(key);
    if (bucket) bucket.push(p);
    else groups.set(key, [p]);
  }

  const candles: DailyCandle[] = [];
  let prevClose = BASE_STOCK_PRICE;

  for (const [time, dayPoints] of groups) {
    const open = prevClose;
    const close = dayPoints[dayPoints.length - 1]!.settledPrice;
    const prices = dayPoints.map((p) => p.settledPrice);
    candles.push({
      time,
      open,
      close,
      high: Math.max(open, close, ...prices),
      low: Math.min(open, close, ...prices),
      volume: dayPoints.length,
    });
    prevClose = close;
  }

  return candles;
}
