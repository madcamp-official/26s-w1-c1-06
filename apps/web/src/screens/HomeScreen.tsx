import { Link } from "react-router-dom";
import { UnconfirmedSettlementsBanner } from "../components/UnconfirmedSettlementsBanner";
import { useAuth } from "../context/AuthContext";

export function HomeScreen() {
  const { user, logout } = useAuth();

  return (
    <div className="screen">
      <header className="screen-header">
        <h1>홈</h1>
        <p className="screen-header__sub">지각비 주식 시장에 오신 것을 환영합니다.</p>
      </header>

      <UnconfirmedSettlementsBanner />

      {user && (
        <div className="home-card">
          <p className="screen-header__sub">가용 포인트</p>
          <p className="home-card__points">
            {user.availablePoints.toLocaleString()}P
          </p>
          <p className="screen-header__sub">{user.nickname}님</p>
        </div>
      )}

      <div className="home-links">
        <Link to="/demo" className="link-card">
          🧪 데모 시연 시작하기
        </Link>
        <Link to="/promises" className="link-card">
          📅 내 약속 보기
        </Link>
        <Link to="/friends" className="link-card">
          👥 친구·시장
        </Link>
      </div>

      <button type="button" className="btn btn--secondary logout-btn" onClick={logout}>
        로그아웃
      </button>
    </div>
  );
}
