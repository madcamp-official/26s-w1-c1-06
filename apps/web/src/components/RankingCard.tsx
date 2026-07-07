import { useEffect, useState } from "react";
import { getFriendRanking } from "../lib/endpoints";
import { FALL_COLOR, RISE_COLOR } from "../theme";
import type { RankingEntryView } from "../types/api";
import { AnimatedNumber } from "./AnimatedNumber";

const MEDALS = ["🥇", "🥈", "🥉"];

/** 친구 범위 수익률 랭킹 (S-06) — 절대 포인트가 아닌 수익률 기준. */
export function RankingCard() {
  const [rankings, setRankings] = useState<RankingEntryView[]>([]);

  useEffect(() => {
    getFriendRanking()
      .then(({ rankings: items }) => setRankings(items))
      .catch(() => setRankings([]));
  }, []);

  if (rankings.length === 0) return null;

  return (
    <section className="ranking-card" aria-label="친구 수익률 랭킹">
      <header className="ranking-card__header">
        <h2>수익률 랭킹</h2>
      </header>
      <ol className="ranking-card__list">
        {rankings.map((r, index) => {
          const isUp = r.returnPct >= 0;
          const medal = MEDALS[index];
          return (
            <li
              key={r.userId}
              className={`ranking-card__row${medal ? " ranking-card__row--top" : ""}`}
            >
              <span className="ranking-card__rank">{medal ?? index + 1}</span>
              <span className="ranking-card__name">{r.nickname}</span>
              <span
                className="ranking-card__pct"
                style={{ color: isUp ? RISE_COLOR : FALL_COLOR }}
              >
                <AnimatedNumber
                  value={r.returnPct}
                  format={(n) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`}
                />
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
