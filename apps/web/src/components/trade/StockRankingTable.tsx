import { BASE_STOCK_PRICE } from "@latestock/shared";
import { FALL_COLOR, RISE_COLOR } from "../../theme";
import type { FriendView } from "../../types/api";

interface StockRankingTableProps {
  friends: FriendView[];
  selectedId: string | null;
  onSelect: (friend: FriendView) => void;
}

export function StockRankingTable({ friends, selectedId, onSelect }: StockRankingTableProps) {
  const ranked = [...friends].sort((a, b) => b.currentPrice - a.currentPrice);

  return (
    <section className="trade-ranking" aria-label="주식 랭킹">
      <header className="trade-ranking__header">
        <h2>주식 랭킹</h2>
        <span className="trade-ranking__count">{ranked.length}개 종목</span>
      </header>

      <div className="trade-ranking__table-wrap">
        <table className="trade-ranking__table">
          <thead>
            <tr>
              <th>순위</th>
              <th>종목</th>
              <th>현재가</th>
              <th>등락</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {ranked.map((friend, index) => {
              const diff = friend.currentPrice - BASE_STOCK_PRICE;
              const isUp = diff >= 0;
              const pct = ((diff / BASE_STOCK_PRICE) * 100).toFixed(1);
              const isSelected = friend.userId === selectedId;

              return (
                <tr
                  key={friend.userId}
                  className={isSelected ? "trade-ranking__row--selected" : undefined}
                  onClick={() => onSelect(friend)}
                >
                  <td className="trade-ranking__rank">{index + 1}</td>
                  <td>
                    <div className="trade-ranking__stock">
                      <span className="trade-ranking__avatar">{friend.nickname.slice(0, 1)}</span>
                      <span>{friend.nickname}</span>
                    </div>
                  </td>
                  <td className="trade-ranking__price">{friend.currentPrice.toLocaleString()}원</td>
                  <td
                    className="trade-ranking__change"
                    style={{ color: isUp ? RISE_COLOR : FALL_COLOR }}
                  >
                    {isUp ? "+" : ""}
                    {pct}%
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
