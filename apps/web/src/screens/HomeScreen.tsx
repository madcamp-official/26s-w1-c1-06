import { Link } from "react-router-dom";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { AutoSettlementReveal } from "../components/AutoSettlementReveal";
import { FriendActivityFeed } from "../components/FriendActivityFeed";
import { MarketSummaryCard } from "../components/MarketSummaryCard";
import { RankingCard } from "../components/RankingCard";
import { UnconfirmedSettlementsBanner } from "../components/UnconfirmedSettlementsBanner";
import { useAuth } from "../context/AuthContext";
import { useAssets } from "../hooks/useAssets";
import { usePolling } from "../hooks/usePolling";
import { useUnconfirmedSettlements } from "../hooks/useUnconfirmedSettlements";

export function HomeScreen() {
  const { user, logout } = useAuth();
  const assets = useAssets();
  const unconfirmed = useUnconfirmedSettlements();

  usePolling(assets.reload, 25000);
  /**
   * 정산은 1분 주기 백그라운드 스케줄러(F-12)로도 일어난다. 홈 화면을 계속 보고 있는 동안
   * 정산이 발생해도 반영되도록 주기적으로 다시 확인한다(최초 마운트 시 1회 조회로는
   * 이미 열려 있는 홈에서 새로 끝난 약속을 못 잡아냄). AutoSettlementReveal과
   * UnconfirmedSettlementsBanner가 이 화면 하나의 조회 결과를 함께 보므로 한 번만 폴링한다.
   */
  usePolling(unconfirmed.reload, 20000);

  return (
    <div className="screen">
      <AutoSettlementReveal data={unconfirmed.data} reload={unconfirmed.reload} />

      <header className="screen-header">
        <h1>홈</h1>
        <p className="screen-header__sub">지각비 주식 시장에 오신 것을 환영합니다.</p>
      </header>

      <UnconfirmedSettlementsBanner data={unconfirmed.data} />

      {user && (
        <div className="home-card">
          <p className="screen-header__sub">가용 포인트</p>
          <p className="home-card__points">
            <AnimatedNumber
              value={assets.summary?.availablePoints ?? user.availablePoints}
              format={(n) => `${Math.round(n).toLocaleString()}P`}
            />
          </p>
          <p className="screen-header__sub">{user.nickname}님</p>
        </div>
      )}

      <MarketSummaryCard />

      <RankingCard />

      <FriendActivityFeed />

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
