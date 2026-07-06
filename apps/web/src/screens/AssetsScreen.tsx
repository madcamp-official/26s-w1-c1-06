import { useState } from "react";
import { StockChart } from "../components/StockChart";
import { useAssets } from "../hooks/useAssets";
import { useStockChart } from "../hooks/useStockChart";
import { matchesTxFilter, TX_TYPE_META, type TxFilter } from "../lib/tx-type";
import { FALL_COLOR, RISE_COLOR } from "../theme";

const FILTER_TABS: { key: TxFilter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "lock", label: "잠금" },
  { key: "settlement", label: "정산" },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  });
}

export function AssetsScreen() {
  const chart = useStockChart();
  const assets = useAssets();
  const [filter, setFilter] = useState<TxFilter>("all");

  const filteredTransactions = assets.transactions.filter((tx) =>
    matchesTxFilter(tx.txType, filter),
  );

  return (
    <div style={{ padding: 24 }}>
      <h1>자산</h1>

      {chart.isLoading && <p>차트 불러오는 중...</p>}
      {chart.error && <p style={{ color: "red" }}>{chart.error}</p>}
      {!chart.isLoading && !chart.error && <StockChart data={chart.data} />}

      {assets.error && <p style={{ color: "red" }}>{assets.error}</p>}
      {assets.isLoading && <p>자산 정보 불러오는 중...</p>}

      {assets.summary && (
        <div style={{ display: "flex", gap: 12, margin: "16px 0" }}>
          <div
            style={{
              flex: 1,
              padding: 16,
              borderRadius: 12,
              background: "#f5f5f5",
            }}
          >
            <div style={{ fontSize: 13, color: "#888" }}>가용 포인트</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>
              {assets.summary.availablePoints.toLocaleString()}P
            </div>
          </div>
          <div
            style={{
              flex: 1,
              padding: 16,
              borderRadius: 12,
              background: "#f5f5f5",
            }}
          >
            <div style={{ fontSize: 13, color: "#888" }}>잠금 포인트</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>
              {assets.summary.lockedPoints.toLocaleString()}P
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            style={{
              padding: "6px 14px",
              borderRadius: 16,
              border: "1px solid #ddd",
              background: filter === tab.key ? "#222" : "#fff",
              color: filter === tab.key ? "#fff" : "#222",
              cursor: "pointer",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filteredTransactions.length === 0 && !assets.isLoading && (
        <p style={{ color: "#888" }}>내역이 없습니다.</p>
      )}

      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {filteredTransactions.map((tx) => {
          const meta = TX_TYPE_META[tx.txType];
          const isPositive = tx.amount > 0;
          return (
            <li
              key={tx.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 0",
                borderBottom: "1px solid #eee",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18 }}>{meta.icon}</span>
                <div>
                  <div>{meta.label}</div>
                  <div style={{ fontSize: 12, color: "#888" }}>
                    {formatDate(tx.createdAt)}
                  </div>
                </div>
              </div>
              <div
                style={{
                  fontWeight: 700,
                  color: isPositive ? RISE_COLOR : FALL_COLOR,
                }}
              >
                {isPositive ? "+" : ""}
                {tx.amount.toLocaleString()}P
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
