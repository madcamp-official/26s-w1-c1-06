import { Link } from "react-router-dom";

export function FriendsMarketScreen() {
  return (
    <div className="screen">
      <header className="screen-header">
        <h1>친구·시장</h1>
        <p className="screen-header__sub">친구 종목과 시장 가격을 확인합니다.</p>
      </header>
      <div className="state-panel">
        <div className="state-icon" aria-hidden>
          👥
        </div>
        <p className="state-title">아직 친구 시장이 비어 있어요</p>
        <p className="state-message">
          친구를 추가하면 종목 리스트가 여기에 표시됩니다.
          데모 화면에서 약속·정산 루프를 먼저 체험해 보세요.
        </p>
        <Link to="/demo" className="btn btn--primary">
          데모로 이동
        </Link>
      </div>
    </div>
  );
}
