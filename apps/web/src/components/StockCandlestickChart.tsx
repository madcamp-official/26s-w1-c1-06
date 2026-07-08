import { BASE_STOCK_PRICE } from "@latestock/shared";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ChartPoint, Verdict } from "../hooks/useStockChart";
import { FALL_COLOR, RISE_COLOR } from "../theme";

interface StockCandlestickChartProps {
  data: ChartPoint[];
  theme?: "light" | "dark";
  height?: number;
}

interface Candle {
  promiseId: string;
  date: number;
  open: number;
  close: number;
  high: number;
  low: number;
  isUp: boolean;
  verdict: Verdict;
  lateMinutes: number;
}

function toCandles(points: ChartPoint[]): Candle[] {
  let prev = BASE_STOCK_PRICE;
  return points.map((p) => {
    const open = prev;
    const close = p.settledPrice;
    prev = close;
    return {
      promiseId: p.promiseId,
      date: new Date(p.promisedAt).getTime(),
      open,
      close,
      high: Math.max(open, close),
      low: Math.min(open, close),
      isUp: close >= open,
      verdict: p.verdict,
      lateMinutes: p.lateMinutes,
    };
  });
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("ko-KR", {
    year: "2-digit",
    month: "short",
    day: "numeric",
  });
}

function verdictLabel(c: Candle): string {
  if (c.verdict === "on_time") return "정시 도착";
  if (c.verdict === "no_show") return "노쇼";
  return `${c.lateMinutes}분 지각`;
}

const VERDICT_DOT_COLOR: Record<Verdict, string> = {
  on_time: "#2ecc71",
  late: "#f5a623",
  no_show: "#e74c3c",
};

function daysSince(ts: number): number {
  return Math.floor((Date.now() - ts) / (24 * 60 * 60 * 1000));
}

interface Point {
  x: number;
  y: number;
}

/** Catmull-Rom → 3차 베지어 변환으로 각진 꺾은선을 부드러운 곡선 path로 만든다. */
function smoothLinePath(points: Point[]): string {
  if (points.length === 0) return "";
  if (points.length < 3) {
    return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x},${p.y}`).join(" ");
  }
  let d = `M ${points[0]!.x},${points[0]!.y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return d;
}

/** 정산 구간별 시가·종가 캔들 (한국식: 상승=빨강, 하락=파랑). */
export function StockCandlestickChart({
  data,
  theme = "dark",
  height = 360,
}: StockCandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hovered, setHovered] = useState<Candle | null>(null);
  const gradientId = `candle-area-gradient-${useId()}`;

  const isDark = theme === "dark";
  const gridColor = isDark ? "#2a2a2a" : "#e8e8e8";
  const textColor = isDark ? "#888" : "#888";
  const emptyColor = isDark ? "#666" : "#888";

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setWidth(entry?.contentRect.width ?? 0);
    });
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const candles = useMemo(() => toCandles(data), [data]);

  const padding = { top: 16, right: 16, bottom: 28, left: 52 };
  const innerW = Math.max(width - padding.left - padding.right, 0);
  const innerH = height - padding.top - padding.bottom;

  const { yMin, yMax, yTicks } = useMemo(() => {
    if (candles.length === 0) {
      return { yMin: 0, yMax: BASE_STOCK_PRICE * 1.2, yTicks: [0, 5000, 10000] };
    }
    const lows = candles.map((c) => c.low);
    const highs = candles.map((c) => c.high);
    const minP = Math.min(...lows, BASE_STOCK_PRICE);
    const maxP = Math.max(...highs, BASE_STOCK_PRICE);
    const pad = Math.max((maxP - minP) * 0.12, 500);
    const lo = Math.floor((minP - pad) / 100) * 100;
    const hi = Math.ceil((maxP + pad) / 100) * 100;
    const step = Math.max(Math.round((hi - lo) / 4 / 100) * 100, 100);
    const ticks: number[] = [];
    for (let v = lo; v <= hi; v += step) ticks.push(v);
    return { yMin: lo, yMax: hi, yTicks: ticks };
  }, [candles]);

  const yScale = (price: number) =>
    padding.top + innerH * (1 - (price - yMin) / (yMax - yMin || 1));

  if (data.length === 0) {
    return (
      <div
        className="stock-chart-empty"
        style={{
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: emptyColor,
        }}
      >
        아직 정산된 약속이 없어요
      </div>
    );
  }

  const slotW = innerW / candles.length;
  const bodyW = Math.max(Math.min(slotW * 0.55, 36), 8);
  const lastCandle = candles[candles.length - 1]!;
  const daysSinceLast = daysSince(lastCandle.date);

  return (
    <div
      ref={containerRef}
      className="candle-chart"
      style={{ height, width: "100%", position: "relative" }}
    >
      <div className="candle-chart__last-settled">
        {daysSinceLast <= 0 ? "오늘 정산" : `마지막 정산 ${daysSinceLast}일 전`}
      </div>

      {hovered && (
        <div className="candle-chart__tooltip">
          <div>{formatDate(hovered.date)}</div>
          <div>
            시가 {hovered.open.toLocaleString()} → 종가{" "}
            <strong>{hovered.close.toLocaleString()}원</strong>
          </div>
          <div className="candle-chart__tooltip-muted">{verdictLabel(hovered)}</div>
        </div>
      )}

      <svg width={width} height={height} role="img" aria-label="주가 캔들 차트">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fee500" stopOpacity={isDark ? 0.28 : 0.35} />
            <stop offset="100%" stopColor="#fee500" stopOpacity={0} />
          </linearGradient>
        </defs>

        {yTicks.map((tick) => {
          const y = yScale(tick);
          return (
            <g key={tick}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke={gridColor}
                strokeOpacity={0.5}
                strokeDasharray="3 5"
              />
              <text x={padding.left - 8} y={y + 4} textAnchor="end" fill={textColor} fontSize={13}>
                {tick.toLocaleString()}
              </text>
            </g>
          );
        })}

        {candles.length > 1 &&
          (() => {
            const closePoints: Point[] = candles.map((c, i) => ({
              x: padding.left + slotW * i + slotW / 2,
              y: yScale(c.close),
            }));
            const linePath = smoothLinePath(closePoints);
            const baseline = height - padding.bottom;
            const areaPath = `${linePath} L ${closePoints[closePoints.length - 1]!.x},${baseline} L ${closePoints[0]!.x},${baseline} Z`;
            return (
              <>
                <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
                <path d={linePath} fill="none" stroke="#fee500" strokeWidth={1.75} strokeOpacity={0.85} />
              </>
            );
          })()}

        {candles.map((c, i) => {
          const cx = padding.left + slotW * i + slotW / 2;
          const color = c.isUp ? RISE_COLOR : FALL_COLOR;
          const yHigh = yScale(c.high);
          const yLow = yScale(c.low);
          const yOpen = yScale(c.open);
          const yClose = yScale(c.close);
          const bodyTop = Math.min(yOpen, yClose);
          const bodyH = Math.max(Math.abs(yClose - yOpen), 2);

          return (
            <g
              key={c.promiseId}
              onMouseEnter={() => setHovered(c)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: "pointer" }}
            >
              <line x1={cx} y1={yHigh} x2={cx} y2={yLow} stroke={color} strokeWidth={2} />
              <rect
                x={cx - bodyW / 2}
                y={bodyTop}
                width={bodyW}
                height={bodyH}
                fill={color}
                rx={1}
              />
              <circle cx={cx} cy={height - 18} r={3} fill={VERDICT_DOT_COLOR[c.verdict]} />
              <text x={cx} y={height - 8} textAnchor="middle" fill={textColor} fontSize={12}>
                {formatDate(c.date)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
