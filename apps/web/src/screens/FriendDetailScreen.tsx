import { Navigate, useParams } from "react-router-dom";

/** 친구 상세는 시장 대시보드로 통합 — /friends?stock=:userId 로 리다이렉트. */
export function FriendDetailScreen() {
  const { userId } = useParams<{ userId: string }>();
  if (!userId) return <Navigate to="/friends" replace />;
  return <Navigate to={`/friends?stock=${userId}`} replace />;
}
