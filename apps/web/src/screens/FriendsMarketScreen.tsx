import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/api";

interface FriendView {
  userId: string;
  nickname: string;
  currentPrice: number;
}

export function FriendsMarketScreen() {
  const [friends, setFriends] = useState<FriendView[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ friends: FriendView[] }>("/api/friends")
      .then(({ friends }) => setFriends(friends))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "친구 목록을 불러오지 못했습니다."),
      );
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h1>친구·시장 화면 (준비 중)</h1>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {friends.length === 0 && !error && <p>친구가 없습니다.</p>}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {friends.map((f) => (
          <li key={f.userId}>
            <Link to={`/friends/${f.userId}`}>
              {f.nickname} · {f.currentPrice.toLocaleString()}원
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
