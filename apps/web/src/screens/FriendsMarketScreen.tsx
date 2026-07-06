import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AsyncState } from "../components/AsyncState";
import { apiFetch } from "../lib/api";

interface FriendView {
  userId: string;
  nickname: string;
  currentPrice: number;
}

export function FriendsMarketScreen() {
  const [friends, setFriends] = useState<FriendView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ friends: FriendView[] }>("/api/friends")
      .then(({ friends }) => setFriends(friends))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "친구 목록을 불러오지 못했습니다."),
      );
  }, []);

  return (
    <div className="screen">
      <header className="screen-header">
        <h1>친구·시장</h1>
        <p className="screen-header__sub">친구 종목과 시장 가격을 확인합니다.</p>
      </header>

      <AsyncState
        loading={friends === null && !error}
        error={error}
        empty={friends?.length === 0}
        emptyTitle="아직 친구 시장이 비어 있어요"
        emptyMessage="친구를 추가하면 종목 리스트가 여기에 표시됩니다. 데모 화면에서 약속·정산 루프를 먼저 체험해 보세요."
      >
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {friends?.map((f) => (
            <li key={f.userId} style={{ marginBottom: 8 }}>
              <Link to={`/friends/${f.userId}`} className="link-card">
                {f.nickname} · {f.currentPrice.toLocaleString()}원
              </Link>
            </li>
          ))}
        </ul>
      </AsyncState>
    </div>
  );
}
