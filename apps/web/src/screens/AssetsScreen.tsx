import { useState } from "react";
import { AsyncState } from "../components/AsyncState";
import { StockChart } from "../components/StockChart";
import { UnconfirmedSettlementsBanner } from "../components/UnconfirmedSettlementsBanner";
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
    <div className="screen">
      <header className="screen-header">
        <h1>자산</h1>
        <p className="screen-header__sub">가용·잠금 포인트와 거래 내역을 확인합니다.</p>
      </header>

      <UnconfirmedSettlementsBanner />

      <AsyncState loading={chart.isLoading || assets.isLoading} error={chart.error ?? assets.error}>
        <StockChart data={chart.data} />

        {assets.summary && (
          <div className="stat-grid" style={{ margin: "16px 0" }}>
            <div className="stat-card">
              <span className="stat-card__label">가용 포인트</span>
              <span className="stat-card__value">
                {assets.summary.availablePoints.toLocaleString()}P
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-card__label">잠금 포인트</span>
              <span className="stat-card__value">
                {assets.summary.lockedPoints.toLocaleString()}P
              </span>
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`btn ${filter === tab.key ? "btn--primary" : "btn--secondary"}`}
              onClick={() => setFilter(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {filteredTransactions.length === 0 ? (
          <p className="screen-header__sub">내역이 없습니다.</p>
        ) : (
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
                    borderBottom: "1px solid var(--kakao-gray-200)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 18 }}>{meta.icon}</span>
                    <div>
                      <div>{meta.label}</div>
                      <div className="screen-header__sub">{formatDate(tx.createdAt)}</div>
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
        )}
      </AsyncState>
    </div>
  );
}
