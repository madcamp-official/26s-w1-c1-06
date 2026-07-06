import { BASE_STOCK_PRICE } from "@latestock/shared";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartPoint, Verdict } from "../hooks/useStockChart";
import { FALL_COLOR, RISE_COLOR } from "../theme";

interface StockChartProps {
  data: ChartPoint[];
}

interface ChartDatum {
  date: number;
  price: number;
  verdict: Verdict | null;
  lateMinutes: number | null;
}

function toChartData(points: ChartPoint[]): ChartDatum[] {
  const start: ChartDatum = {
    date:
      points.length > 0
        ? new Date(points[0]!.promisedAt).getTime() - 1
        : Date.now(),
    price: BASE_STOCK_PRICE,
    verdict: null,
    lateMinutes: null,
  };
  const rest: ChartDatum[] = points.map((p) => ({
    date: new Date(p.promisedAt).getTime(),
    price: p.settledPrice,
    verdict: p.verdict,
    lateMinutes: p.lateMinutes,
  }));
  return [start, ...rest];
}

function verdictLabel(verdict: Verdict | null, lateMinutes: number | null): string {
  if (verdict === null) return "시작가";
  if (verdict === "on_time") return "정시 도착";
  if (verdict === "no_show") return "노쇼";
  return `${lateMinutes}분 지각`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("ko-KR", {
    year: "2-digit",
    month: "short",
    day: "numeric",
  });
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: ChartDatum }[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]!.payload;
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #ddd",
        borderRadius: 8,
        padding: "8px 12px",
        fontSize: 13,
        color: "#222",
      }}
    >
      <div>{formatDate(point.date)}</div>
      <div style={{ fontWeight: 700 }}>{point.price.toLocaleString()}원</div>
      <div style={{ color: "#888" }}>
        {verdictLabel(point.verdict, point.lateMinutes)}
      </div>
    </div>
  );
}

function OnTimeDot(props: {
  cx?: number;
  cy?: number;
  payload?: ChartDatum;
  index?: number;
}) {
  const { cx, cy, payload, index } = props;
  if (!payload || payload.verdict !== "on_time" || cx == null || cy == null) {
    return <g key={`dot-${index}`} />;
  }
  return (
    <circle
      key={`dot-${index}`}
      cx={cx}
      cy={cy}
      r={4}
      fill={RISE_COLOR}
      stroke="#fff"
      strokeWidth={1.5}
    />
  );
}

/** SC-14(본인)/SC-11(친구) 공용 주가 차트 (F-08/F-13). */
export function StockChart({ data }: StockChartProps) {
  if (data.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "#888" }}>
        아직 정산된 약속이 없어요
      </div>
    );
  }

  const chartData = toChartData(data);
  const lastPrice = chartData[chartData.length - 1]!.price;
  const color = lastPrice >= BASE_STOCK_PRICE ? RISE_COLOR : FALL_COLOR;
  const gradientId = "stock-chart-gradient";

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
        <XAxis
          dataKey="date"
          tickFormatter={formatDate}
          tick={{ fontSize: 11 }}
          minTickGap={24}
        />
        <YAxis
          domain={["auto", "auto"]}
          tick={{ fontSize: 11 }}
          width={48}
          tickFormatter={(v: number) => v.toLocaleString()}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="price"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#${gradientId})`}
          dot={OnTimeDot}
          activeDot={{ r: 5 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
