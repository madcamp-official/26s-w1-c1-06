import { Link } from "react-router-dom";

export function AssetsScreen() {
  return (
    <div className="screen">
      <header className="screen-header">
        <h1>자산</h1>
        <p className="screen-header__sub">가용·잠금 포인트와 거래 내역을 확인합니다.</p>
      </header>
      <div className="state-panel">
        <div className="state-icon" aria-hidden>
          💰
        </div>
        <p className="state-title">자산 내역을 준비 중이에요</p>
        <p className="state-message">
          팀원이 자산 화면을 구현하면 가용/잠금 포인트와 원장이 여기에 표시됩니다.
        </p>
        <Link to="/home" className="btn btn--secondary">
          홈으로
        </Link>
      </div>
    </div>
  );
}
