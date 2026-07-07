import { BASE_STOCK_PRICE } from "@latestock/shared";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AsyncState } from "../components/AsyncState";
import { StockCandlestickChart } from "../components/StockCandlestickChart";
import { OrderPanel } from "../components/trade/OrderPanel";
import { StockRankingTable } from "../components/trade/StockRankingTable";
import { useAuth } from "../context/AuthContext";
import { usePolling } from "../hooks/usePolling";
import { useStockChart } from "../hooks/useStockChart";
import { useStockPromises } from "../hooks/useStockPromises";
import { getMyAssets, listFriends } from "../lib/endpoints";
import { FALL_COLOR, RISE_COLOR } from "../theme";
import type { FriendView } from "../types/api";

export function FriendsMarketScreen() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [friends, setFriends] = useState<FriendView[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [availablePoints, setAvailablePoints] = useState<number | null>(null);

  const selectedId = searchParams.get("stock");
  const selected = friends?.find((f) => f.userId === selectedId) ?? friends?.[0] ?? null;

  const chart = useStockChart(selected?.userId);
  const { promises, isLoading: promisesLoading } = useStockPromises(selected?.userId);

  const loadMarket = useCallback(() => {
    setLoadError(null);
    Promise.all([listFriends(), getMyAssets()])
      .then(([{ friends: items }, assets]) => {
        setFriends(items);
        setAvailablePoints(assets.availablePoints);
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : "시장 정보를 불러오지 못했습니다.");
      });
  }, []);

  useEffect(() => {
    loadMarket();
  }, [loadMarket]);

  usePolling(loadMarket, 25000);

  useEffect(() => {
    if (!friends || friends.length === 0) return;
    if (!selectedId || !friends.some((f) => f.userId === selectedId)) {
      setSearchParams({ stock: friends[0]!.userId }, { replace: true });
    }
  }, [friends, selectedId, setSearchParams]);

  function handleSelectStock(friend: FriendView) {
    setSearchParams({ stock: friend.userId });
  }

  const priceDiff = selected ? selected.currentPrice - BASE_STOCK_PRICE : 0;
  const isUp = priceDiff >= 0;

  return (
    <div className="trade-dashboard trade-dashboard--market">
      <header className="trade-dashboard__topbar">
        <div>
          <h1 className="trade-dashboard__title">친구·시장</h1>
          <p className="trade-dashboard__subtitle">친구 종목을 거래하고 시장 가격을 확인합니다.</p>
        </div>
        <div className="trade-dashboard__topbar-right">
          {user && (
            <div className="trade-dashboard__user">
              <span>{user.nickname}</span>
            </div>
          )}
          {availablePoints != null && (
            <div className="trade-dashboard__balance">
              <span>매수 가능</span>
              <strong>{availablePoints.toLocaleString()}P</strong>
            </div>
          )}
        </div>
      </header>

      <AsyncState
        loading={friends === null && !loadError}
        error={loadError}
        onRetry={loadMarket}
        empty={friends?.length === 0}
        emptyTitle="아직 친구 시장이 비어 있어요"
        emptyMessage="친구를 추가하면 종목 리스트가 여기에 표시됩니다."
      >
        <div className="trade-dashboard__body">
          <div className="trade-dashboard__main">
            <section className="trade-chart" aria-label="주가 차트">
              {selected && (
                <header className="trade-chart__header">
                  <div className="trade-chart__pair">
                    <span className="trade-chart__avatar">{selected.nickname.slice(0, 1)}</span>
                    <div>
                      <h2>{selected.nickname}</h2>
                      <p>친구 주식 · KRW</p>
                    </div>
                  </div>
                  <div className="trade-chart__quote">
                    <span className="trade-chart__price">
                      {selected.currentPrice.toLocaleString()}원
                    </span>
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

            <OrderPanel
              stock={selected}
              promises={promises}
              promisesLoading={promisesLoading}
              availablePoints={availablePoints}
              onSuccess={loadMarket}
            />
          </div>

          {friends && friends.length > 0 && (
            <StockRankingTable
              friends={friends}
              selectedId={selected?.userId ?? null}
              onSelect={handleSelectStock}
            />
          )}
        </div>
      </AsyncState>
    </div>
  );
}
