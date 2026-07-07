import { useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { listFriends } from "../lib/endpoints";
import { rankMovers, type MoverView } from "../lib/market";
import { FALL_COLOR, RISE_COLOR } from "../theme";

function MoverRow({ mover }: { mover: MoverView }) {
  const isUp = mover.changePct >= 0;
  const tint = isUp ? "rgba(214, 0, 0, 0.08)" : "rgba(0, 81, 199, 0.08)";
  return (
    <li
      className="market-summary__row"
      style={{ "--row-tint": tint } as CSSProperties}
    >
      <span className="market-summary__name">{mover.nickname}</span>
      <span className="market-summary__pct" style={{ color: isUp ? RISE_COLOR : FALL_COLOR }}>
        {isUp ? "+" : ""}
        {mover.changePct.toFixed(1)}%
      </span>
    </li>
  );
}

/** 홈 "오늘의 시장" 요약 — 친구 종목 상승·하락 상위 (M2-3). */
export function MarketSummaryCard() {
  const [gainers, setGainers] = useState<MoverView[]>([]);
  const [losers, setLosers] = useState<MoverView[]>([]);
  const [hasFriends, setHasFriends] = useState(true);

  useEffect(() => {
    listFriends()
      .then(({ friends }) => {
        setHasFriends(friends.length > 0);
        const movers = rankMovers(friends);
        setGainers(movers.gainers);
        setLosers(movers.losers);
      })
      .catch(() => {
        setHasFriends(false);
      });
  }, []);

  if (!hasFriends) return null;

  return (
    <section className="market-summary" aria-label="오늘의 시장">
      <header className="market-summary__header">
        <h2>오늘의 시장</h2>
        <Link to="/friends" className="market-summary__link">
          전체 보기 →
        </Link>
      </header>
      <div className="market-summary__cols">
        <div>
          <p className="market-summary__col-title">상승 상위</p>
          <ul className="market-summary__list">
            {gainers.map((m) => (
              <MoverRow key={m.userId} mover={m} />
            ))}
          </ul>
        </div>
        <div>
          <p className="market-summary__col-title">하락 상위</p>
          <ul className="market-summary__list">
            {losers.map((m) => (
              <MoverRow key={m.userId} mover={m} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
