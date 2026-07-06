import { useAuth } from "../context/AuthContext";

export function HomeScreen() {
  const { user, logout } = useAuth();

  return (
    <div style={{ padding: 24 }}>
      <h1>홈 화면 (준비 중)</h1>
      {user && (
        <p>
          {user.nickname}님, 가용 포인트 {user.availablePoints.toLocaleString()}P
        </p>
      )}
      <button onClick={logout}>로그아웃</button>
    </div>
  );
}
