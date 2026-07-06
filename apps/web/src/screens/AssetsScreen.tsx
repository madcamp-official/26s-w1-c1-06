import { StockChart } from "../components/StockChart";
import { useStockChart } from "../hooks/useStockChart";

export function AssetsScreen() {
  const { data, isLoading, error } = useStockChart();

  return (
    <div style={{ padding: 24 }}>
      <h1>자산 화면 (준비 중)</h1>
      {isLoading && <p>차트 불러오는 중...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
      {!isLoading && !error && <StockChart data={data} />}
    </div>
  );
}
