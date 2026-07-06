import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
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
    <div style={{ padding: 24 }}>
      <p>
        <Link to="/friends">← 친구·시장</Link>
      </p>
      <h1>
        {friend ? `${friend.nickname}의 주식` : "친구 차트"}
      </h1>
      {friend && <p>현재가 {friend.currentPrice.toLocaleString()}원</p>}
      {isLoading && <p>차트 불러오는 중...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
      {!isLoading && !error && <StockChart data={data} />}
    </div>
  );
}
