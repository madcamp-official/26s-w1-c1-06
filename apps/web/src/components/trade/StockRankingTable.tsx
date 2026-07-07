import { BASE_STOCK_PRICE } from "@latestock/shared";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { getFavorites, toggleFavorite } from "../../lib/favorites";
import { FALL_COLOR, RISE_COLOR } from "../../theme";
import type { FriendView } from "../../types/api";
import { AnimatedNumber } from "../AnimatedNumber";

const MEDALS = ["🥇", "🥈", "🥉"];

interface StockRankingTableProps {
  friends: FriendView[];
  selectedId: string | null;
  onSelect: (friend: FriendView) => void;
}

export function StockRankingTable({ friends, selectedId, onSelect }: StockRankingTableProps) {
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState<string[]>(() => getFavorites());
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());
  const prevRectsRef = useRef(new Map<string, DOMRect>());

  function handleToggleFavorite(userId: string) {
    setFavorites(toggleFavorite(userId));
  }

  const ranked = useMemo(() => {
    const filtered = query.trim()
      ? friends.filter((f) => f.nickname.toLowerCase().includes(query.trim().toLowerCase()))
      : friends;
    return [...filtered].sort((a, b) => {
      const aFav = favorites.includes(a.userId);
      const bFav = favorites.includes(b.userId);
      if (aFav !== bFav) return aFav ? -1 : 1;
      return b.currentPrice - a.currentPrice;
    });
  }, [friends, query, favorites]);

  /** FLIP: 시세 갱신으로 순위가 바뀌면 행이 순간이동하지 않고 미끄러지듯 이동한다. */
  useLayoutEffect(() => {
    const newRects = new Map<string, DOMRect>();
    rowRefs.current.forEach((el, id) => newRects.set(id, el.getBoundingClientRect()));

    rowRefs.current.forEach((el, id) => {
      const prev = prevRectsRef.current.get(id);
      const next = newRects.get(id);
      if (!prev || !next) return;
      const deltaY = prev.top - next.top;
      if (Math.abs(deltaY) < 1) return;
      el.style.transition = "none";
      el.style.transform = `translateY(${deltaY}px)`;
      requestAnimationFrame(() => {
        el.style.transition = "transform 0.35s ease";
        el.style.transform = "";
      });
    });

    prevRectsRef.current = newRects;
  }, [ranked]);

  return (
    <section className="trade-ranking" aria-label="주식 랭킹">
      <header className="trade-ranking__header">
        <h2>주식 랭킹</h2>
        <span className="trade-ranking__count">{ranked.length}개 종목</span>
      </header>

      <input
        type="search"
        className="trade-ranking__search"
        placeholder="종목 검색"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="종목 검색"
      />

      <div className="trade-ranking__table-wrap">
        <table className="trade-ranking__table">
          <thead>
            <tr>
              <th />
              <th>순위</th>
              <th>종목</th>
              <th>현재가</th>
              <th>등락</th>
              <th>스트릭</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {ranked.map((friend, index) => {
              const diff = friend.currentPrice - BASE_STOCK_PRICE;
              const isUp = diff >= 0;
              const pct = (diff / BASE_STOCK_PRICE) * 100;
              const isSelected = friend.userId === selectedId;
              const isFav = favorites.includes(friend.userId);
              const medal = MEDALS[index];

              return (
                <tr
                  key={friend.userId}
                  ref={(el) => {
                    if (el) rowRefs.current.set(friend.userId, el);
                    else rowRefs.current.delete(friend.userId);
                  }}
                  className={isSelected ? "trade-ranking__row--selected" : undefined}
                  onClick={() => onSelect(friend)}
                >
                  <td>
                    <button
                      type="button"
                      className={`trade-ranking__favorite${isFav ? " trade-ranking__favorite--active" : ""}`}
                      aria-label={isFav ? "관심종목 해제" : "관심종목 추가"}
                      aria-pressed={isFav}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleFavorite(friend.userId);
                      }}
                    >
                      {isFav ? "★" : "☆"}
                    </button>
                  </td>
                  <td className="trade-ranking__rank">{medal ?? index + 1}</td>
                  <td>
                    <div className="trade-ranking__stock">
                      <span className="trade-ranking__avatar">{friend.nickname.slice(0, 1)}</span>
                      <div>
                        <div>{friend.nickname}</div>
                        <div className="trade-ranking__risk">
                          지각 위험도 {friend.lateRiskPct}%
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="trade-ranking__price">
                    <AnimatedNumber
                      value={friend.currentPrice}
                      format={(n) => `${Math.round(n).toLocaleString()}원`}
                    />
                  </td>
                  <td
                    className="trade-ranking__change"
                    style={{ color: isUp ? RISE_COLOR : FALL_COLOR }}
                  >
                    <AnimatedNumber value={pct} format={(n) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`} />
                  </td>
                  <td
                    className={`trade-ranking__streak${friend.onTimeStreak >= 3 ? " trade-ranking__streak--hot" : ""}`}
                  >
                    {friend.onTimeStreak > 0 ? `🔥 ${friend.onTimeStreak}` : "—"}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="trade-ranking__btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(friend);
                      }}
                    >
                      거래
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
