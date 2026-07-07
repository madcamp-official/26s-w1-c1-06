import { memeLabel } from "@latestock/shared";
import { Link } from "react-router-dom";
import { useFriendActivityFeed } from "../hooks/useFriendActivityFeed";

function formatAt(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** 나·친구의 최근 정산 소식 피드 (M6-6) — 홈에서 시장의 살아있는 느낌을 전달. */
export function FriendActivityFeed() {
  const { items } = useFriendActivityFeed();

  if (items.length === 0) return null;

  return (
    <section className="activity-feed" aria-label="친구 소식">
      <header className="activity-feed__header">
        <h2>친구 소식</h2>
      </header>
      <ul className="activity-feed__list">
        {items.map((item) => (
          <li key={`${item.promiseId}-${item.stockUserId}`} className="activity-feed__item">
            <Link to={`/results/stock/${item.promiseId}`} className="activity-feed__link">
              <span className="activity-feed__badge">
                {memeLabel(item.lateMinutes, item.verdict === "no_show")}
              </span>
              <div className="activity-feed__body">
                <p className="activity-feed__text">
                  <strong>{item.stockNickname}</strong>의 &ldquo;{item.promiseTitle}&rdquo;
                </p>
                <p className="activity-feed__meta">
                  {formatAt(item.settledAt)}
                  {item.reactionCount > 0 && ` · 반응 ${item.reactionCount}개`}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
