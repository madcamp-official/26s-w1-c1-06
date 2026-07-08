import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type Time,
} from "lightweight-charts";
import { useEffect, useMemo, useRef, useState } from "react";
import { aggregateDailyCandles, type DailyCandle } from "../lib/aggregateDailyCandles";
import type { ChartPoint } from "../hooks/useStockChart";
import { FALL_COLOR, RISE_COLOR } from "../theme";

interface StockCandlestickChartProps {
  data: ChartPoint[];
  height?: number;
}

interface TooltipState {
  x: number;
  candle: DailyCandle;
}

const GRID_COLOR = "rgba(255, 255, 255, 0.06)";
const AXIS_TEXT_COLOR = "#8B95A1";
const BACKGROUND_COLOR = "#18181b";

/** lightweight-charts가 business-day 문자열을 BusinessDay 객체로 넘겨줄 수도 있어 두 형태 모두 받는다. */
function timeKey(time: Time): string {
  if (typeof time === "string") return time;
  if (typeof time === "object" && "year" in time) {
    return `${time.year}-${String(time.month).padStart(2, "0")}-${String(time.day).padStart(2, "0")}`;
  }
  return String(time);
}

function formatTickMark(time: Time): string {
  const key = timeKey(time);
  const [, month, day] = key.split("-");
  return `${month}/${day}`;
}

function formatTooltipDate(time: Time): string {
  const key = timeKey(time);
  const [year, month, day] = key.split("-");
  return `${year}.${month}.${day}`;
}

/** 일별 OHLC 캔들스틱 + 거래량(그날 지각비 발생 횟수) 분리 패널 (다크 모드 전용). */
export function StockCandlestickChart({ data, height = 400 }: StockCandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const candlesRef = useRef<Map<string, DailyCandle>>(new Map());
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const candles = useMemo(() => aggregateDailyCandles(data), [data]);
  const isEmpty = candles.length === 0;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: BACKGROUND_COLOR },
        textColor: AXIS_TEXT_COLOR,
        panes: { separatorColor: GRID_COLOR },
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: GRID_COLOR },
        horzLines: { color: GRID_COLOR },
      },
      rightPriceScale: { borderColor: GRID_COLOR },
      timeScale: {
        borderColor: GRID_COLOR,
        tickMarkFormatter: formatTickMark,
      },
      localization: { dateFormat: "MM/dd" },
    });
    chartRef.current = chart;

    const candleSeries = chart.addSeries(
      CandlestickSeries,
      {
        upColor: RISE_COLOR,
        downColor: FALL_COLOR,
        borderVisible: false,
        wickUpColor: RISE_COLOR,
        wickDownColor: FALL_COLOR,
      },
      0,
    );
    candleSeriesRef.current = candleSeries;

    const volumeSeries = chart.addSeries(
      HistogramSeries,
      {
        priceFormat: { type: "volume" },
        priceScaleId: "",
      },
      1,
    );
    volumeSeriesRef.current = volumeSeries;

    const panes = chart.panes();
    panes[0]?.setStretchFactor(3);
    panes[1]?.setStretchFactor(1);

    function handleCrosshairMove(param: MouseEventParams<Time>) {
      if (!param.time || !param.point) {
        setTooltip(null);
        return;
      }
      const match = candlesRef.current.get(timeKey(param.time));
      if (!match) {
        setTooltip(null);
        return;
      }
      setTooltip({ x: param.point.x, candle: match });
    }

    chart.subscribeCrosshairMove(handleCrosshairMove);

    return () => {
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    candlesRef.current = new Map(candles.map((c) => [c.time, c]));
    candleSeriesRef.current?.setData(
      candles.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close })),
    );
    volumeSeriesRef.current?.setData(
      candles.map((c) => ({
        time: c.time,
        value: c.volume,
        color: c.close >= c.open ? RISE_COLOR : FALL_COLOR,
      })),
    );
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  return (
    <div style={{ position: "relative", width: "100%", height }}>
      <div
        ref={containerRef}
        style={{ width: "100%", height: "100%", visibility: isEmpty ? "hidden" : "visible" }}
      />

      {isEmpty && (
        <div
          className="stock-chart-empty"
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            color: AXIS_TEXT_COLOR,
          }}
        >
          <span style={{ fontSize: "1.8rem" }} aria-hidden>
            📉
          </span>
          아직 정산된 약속이 없어요
        </div>
      )}

      {tooltip && (
        <div className="candle-chart__tooltip" style={{ left: tooltip.x + 16, top: 12 }}>
          <div>{formatTooltipDate(tooltip.candle.time)}</div>
          <div>
            시가 {tooltip.candle.open.toLocaleString()} · 고가 {tooltip.candle.high.toLocaleString()}
            <br />
            저가 {tooltip.candle.low.toLocaleString()} · 종가{" "}
            <strong>{tooltip.candle.close.toLocaleString()}원</strong>
          </div>
          <div className="candle-chart__tooltip-muted">지각비 발생 {tooltip.candle.volume}건</div>
        </div>
      )}
    </div>
  );
}
