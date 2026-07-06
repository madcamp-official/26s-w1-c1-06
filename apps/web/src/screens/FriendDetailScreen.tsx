import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AsyncState } from "../components/AsyncState";
import { StockChart } from "../components/StockChart";
import { useStockChart } from "../hooks/useStockChart";
import { apiFetch } from "../lib/api";

interface FriendView {
  userId: string;
  nickname: string;
  currentPrice: number;
}

export function FriendDetailScreen() {
  const { userId } = useParams<{ userId: string }>();
  const { data, isLoading, error } = useStockChart(userId);
  const [friend, setFriend] = useState<FriendView | null>(null);

  useEffect(() => {
    apiFetch<{ friends: FriendView[] }>("/api/friends")
      .then(({ friends }) => {
        setFriend(friends.find((f) => f.userId === userId) ?? null);
      })
      .catch(() => setFriend(null));
  }, [userId]);

  return (
    <div className="screen">
      <p style={{ marginBottom: 8 }}>
        <Link to="/friends" className="btn btn--secondary">
          ← 친구·시장
        </Link>
      </p>
      <header className="screen-header">
        <h1>{friend ? `${friend.nickname}의 주식` : "친구 차트"}</h1>
        {friend && (
          <p className="screen-header__sub">
            현재가 {friend.currentPrice.toLocaleString()}원
          </p>
        )}
      </header>

      <AsyncState loading={isLoading} error={error}>
        <StockChart data={data} />
      </AsyncState>
    </div>
  );
}
