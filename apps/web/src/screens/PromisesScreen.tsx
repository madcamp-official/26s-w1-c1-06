import { Link } from "react-router-dom";

export function PromisesScreen() {
  return (
    <div className="screen">
      <header className="screen-header">
        <h1>약속</h1>
        <p className="screen-header__sub">예정·진행·종료 약속을 관리합니다.</p>
      </header>
      <div className="state-panel">
        <div className="state-icon" aria-hidden>
          📅
        </div>
        <p className="state-title">표시할 약속이 없어요</p>
        <p className="state-message">
          새 약속을 만들거나 데모 컨트롤에서 테스트 약속을 생성해 보세요.
        </p>
        <Link to="/demo" className="btn btn--primary">
          데모에서 약속 만들기
        </Link>
      </div>
    </div>
  );
}
