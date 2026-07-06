import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <div>로딩 중...</div>;
  if (!user) return <Navigate to="/login" replace />;

  return <Outlet />;
}
