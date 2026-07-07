import { useState } from "react";
import { AsyncState } from "../components/AsyncState";
import { useAssets } from "../hooks/useAssets";
import { groupTransactionsByDate, matchesTxFilter, TX_TYPE_META, type TxFilter } from "../lib/tx-type";
import { FALL_COLOR, RISE_COLOR } from "../theme";

const FILTER_TABS: { key: TxFilter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "lock", label: "잠금" },
  { key: "settlement", label: "정산" },
];

/** 거래 내역 전용 화면 (자산 화면에서 분리). */
export function HistoryScreen() {
  const assets = useAssets();
  const [filter, setFilter] = useState<TxFilter>("all");

  const filteredTransactions = assets.transactions.filter((tx) =>
    matchesTxFilter(tx.txType, filter),
  );
  const transactionGroups = groupTransactionsByDate(filteredTransactions);

  return (
    <div className="trade-dashboard trade-dashboard--history">
      <header className="trade-dashboard__topbar">
        <div>
          <h1 className="trade-dashboard__title">거래 내역</h1>
          <p className="trade-dashboard__subtitle">포인트 입출금과 정산 손익을 확인합니다.</p>
        </div>
      </header>

      <AsyncState loading={assets.isLoading} error={assets.error} onRetry={assets.reload}>
        <section className="assets-history">
          <div className="assets-history__inner">
            <div className="assets-history__tabs">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`assets-history__tab${filter === tab.key ? " assets-history__tab--active" : ""}`}
                  onClick={() => setFilter(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {filteredTransactions.length === 0 ? (
              <p className="assets-history__empty">내역이 없습니다.</p>
            ) : (
              <div className="assets-history__groups">
                {transactionGroups.map((group) => (
                  <div key={group.dateKey} className="assets-history__group">
                    <p className="assets-history__date-header">{group.dateLabel}</p>
                    <ul className="assets-history__list">
                      {group.transactions.map((tx) => {
                        const meta = TX_TYPE_META[tx.txType];
                        const isPositive = tx.amount > 0;
                        const tint = isPositive
                          ? "rgba(214, 0, 0, 0.12)"
                          : "rgba(0, 81, 199, 0.12)";
                        return (
                          <li key={tx.id} className="assets-history__item">
                            <div className="assets-history__item-left">
                              <span
                                className="assets-history__direction"
                                style={{
                                  background: tint,
                                  color: isPositive ? RISE_COLOR : FALL_COLOR,
                                }}
                                aria-hidden
                              >
                                {isPositive ? "↑" : "↓"}
                              </span>
                              <span className="assets-history__label">{meta.label}</span>
                            </div>
                            <div
                              className="assets-history__amount"
                              style={{ color: isPositive ? RISE_COLOR : FALL_COLOR }}
                            >
                              {isPositive ? "+" : ""}
                              {tx.amount.toLocaleString()}P
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </AsyncState>
    </div>
  );
}
