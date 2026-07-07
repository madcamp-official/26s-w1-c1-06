import { BASE_STOCK_PRICE } from "@latestock/shared";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AsyncState } from "../components/AsyncState";
import { StockCandlestickChart } from "../components/StockCandlestickChart";
import { OrderPanel } from "../components/trade/OrderPanel";
import { StockRankingTable } from "../components/trade/StockRankingTable";
import { UnconfirmedSettlementsBanner } from "../components/UnconfirmedSettlementsBanner";
import { useAssets } from "../hooks/useAssets";
import { useStockChart } from "../hooks/useStockChart";
import { useUpcomingPromises } from "../hooks/useUpcomingPromises";
import { listFriends } from "../lib/endpoints";
import { matchesTxFilter, TX_TYPE_META, type TxFilter } from "../lib/tx-type";
import { FALL_COLOR, RISE_COLOR } from "../theme";
import type { FriendView } from "../types/api";

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
  const [searchParams, setSearchParams] = useSearchParams();
  const [friends, setFriends] = useState<FriendView[]>([]);
  const [friendsError, setFriendsError] = useState<string | null>(null);

  const selectedId = searchParams.get("stock");
  const selectedFriend = friends.find((f) => f.userId === selectedId) ?? null;

  const ownChart = useStockChart();
  const friendChart = useStockChart(selectedFriend?.userId);
  const assets = useAssets();
  const { promises, isLoading: promisesLoading } = useUpcomingPromises();
  const [filter, setFilter] = useState<TxFilter>("all");

  const chart = selectedFriend ? friendChart : ownChart;
  const chartTitle = selectedFriend ? `${selectedFriend.nickname}의 주식` : "내 주식";
  const currentPrice = selectedFriend
    ? selectedFriend.currentPrice
    : ownChart.data.length > 0
      ? ownChart.data[ownChart.data.length - 1]!.settledPrice
      : BASE_STOCK_PRICE;

  const loadFriends = useCallback(() => {
    listFriends()
      .then(({ friends: items }) => setFriends(items))
      .catch((err) => {
        setFriendsError(err instanceof Error ? err.message : "친구 목록을 불러오지 못했습니다.");
      });
  }, []);

  useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  function handleSelectStock(friend: FriendView) {
    setSearchParams({ stock: friend.userId });
  }

  function handleClearStock() {
    setSearchParams({});
  }

  const filteredTransactions = assets.transactions.filter((tx) =>
    matchesTxFilter(tx.txType, filter),
  );

  const priceDiff = currentPrice - BASE_STOCK_PRICE;
  const isUp = priceDiff >= 0;

  return (
    <div className="trade-dashboard trade-dashboard--assets">
      <header className="trade-dashboard__topbar">
        <div>
          <h1 className="trade-dashboard__title">자산</h1>
          <p className="trade-dashboard__subtitle">가용·잠금 포인트와 거래 내역을 확인합니다.</p>
        </div>
        {assets.summary && (
          <div className="trade-dashboard__topbar-right">
            <div className="trade-dashboard__balance">
              <span>가용 포인트</span>
              <strong>{assets.summary.availablePoints.toLocaleString()}P</strong>
            </div>
            <div className="trade-dashboard__balance trade-dashboard__balance--muted">
              <span>잠금 포인트</span>
              <strong>{assets.summary.lockedPoints.toLocaleString()}P</strong>
            </div>
          </div>
        )}
      </header>

      <UnconfirmedSettlementsBanner />

      <AsyncState
        loading={assets.isLoading && ownChart.isLoading}
        error={assets.error ?? ownChart.error ?? friendsError}
        onRetry={() => {
          loadFriends();
        }}
      >
        <div className="trade-dashboard__body">
          <div className="trade-dashboard__main">
            <section className="trade-chart" aria-label="주가 차트">
              <header className="trade-chart__header">
                <div className="trade-chart__pair">
                  <span className="trade-chart__avatar">
                    {selectedFriend ? selectedFriend.nickname.slice(0, 1) : "나"}
                  </span>
                  <div>
                    <h2>{chartTitle}</h2>
                    <p>{selectedFriend ? "친구 주식 · KRW" : "내 주식 · KRW"}</p>
                  </div>
                </div>
                <div className="trade-chart__quote">
                  <span className="trade-chart__price">{currentPrice.toLocaleString()}원</span>
                  <span
                    className="trade-chart__change"
                    style={{ color: isUp ? RISE_COLOR : FALL_COLOR }}
                  >
                    {isUp ? "+" : ""}
                    {priceDiff.toLocaleString()}원 (
                    {((priceDiff / BASE_STOCK_PRICE) * 100).toFixed(1)}%)
                  </span>
                </div>
              </header>

              {selectedFriend && (
                <button type="button" className="trade-chart__back" onClick={handleClearStock}>
                  ← 내 주식으로 돌아가기
                </button>
              )}

              <div className="trade-chart__canvas">
                <AsyncState loading={chart.isLoading} error={chart.error}>
                  <StockCandlestickChart data={chart.data} theme="dark" height={400} />
                </AsyncState>
              </div>

              <div className="trade-chart__legend">
                <span className="trade-chart__legend-item trade-chart__legend-item--up">상승</span>
                <span className="trade-chart__legend-item trade-chart__legend-item--down">하락</span>
              </div>
            </section>

            {selectedFriend ? (
              <OrderPanel
                stock={selectedFriend}
                promises={promises}
                promisesLoading={promisesLoading}
                availablePoints={assets.summary?.availablePoints ?? null}
                onSuccess={() => {
                  loadFriends();
                }}
              />
            ) : (
              <aside className="trade-order trade-order--placeholder">
                <h3 className="trade-order__placeholder-title">주문</h3>
                <p className="trade-order__hint">
                  아래 <strong>주식 랭킹</strong>에서 친구 종목을 선택하면 오른쪽에서 매수·공매도할 수
                  있습니다.
                </p>
                <div className="trade-order__summary">
                  <div className="trade-order__summary-row">
                    <span>가용 포인트</span>
                    <strong>{assets.summary?.availablePoints.toLocaleString() ?? "—"}P</strong>
                  </div>
                  <div className="trade-order__summary-row">
                    <span>잠금 포인트</span>
                    <strong>{assets.summary?.lockedPoints.toLocaleString() ?? "—"}P</strong>
                  </div>
                </div>
              </aside>
            )}
          </div>

          {friends.length > 0 && (
            <StockRankingTable
              friends={friends}
              selectedId={selectedFriend?.userId ?? null}
              onSelect={handleSelectStock}
            />
          )}

          <section className="assets-history">
            <header className="assets-history__header">
              <h2>거래 내역</h2>
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
            </header>

            {filteredTransactions.length === 0 ? (
              <p className="assets-history__empty">내역이 없습니다.</p>
            ) : (
              <ul className="assets-history__list">
                {filteredTransactions.map((tx) => {
                  const meta = TX_TYPE_META[tx.txType];
                  const isPositive = tx.amount > 0;
                  return (
                    <li key={tx.id} className="assets-history__item">
                      <div className="assets-history__item-left">
                        <span className="assets-history__icon">{meta.icon}</span>
                        <div>
                          <div>{meta.label}</div>
                          <div className="assets-history__date">{formatDate(tx.createdAt)}</div>
                        </div>
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
            )}
          </section>
        </div>
      </AsyncState>
    </div>
  );
}
