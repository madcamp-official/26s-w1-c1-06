import { useState } from "react";

/** seed-classmates.ts로 만든 1분반 더미 계정 명단과 동일해야 한다. */
const CLASSMATE_NAMES = [
  "권순호",
  "김태현",
  "김희서",
  "라태형",
  "박준서",
  "안종화",
  "유나연",
  "유영석",
  "이서진",
  "이예원",
  "이유담",
  "이종혁",
  "이지민",
  "정서영",
  "주성민",
];

/** seed-classmates.ts의 비밀번호·이메일 생성 규칙과 동일하게 맞춰야 한다. */
const CLASSMATE_PASSWORD = "password12";

function classmateEmail(nickname: string): string {
  return `classmate.${encodeURIComponent(nickname)}@test.local`.toLowerCase();
}

interface ClassmateLoginHelperProps {
  /** 지정하면 결과 옆에 "이 정보로 채우기" 버튼이 뜬다(로그인 화면 전용 — 회원가입 화면은 이미 있는
   * 계정이라 채워도 가입 시 이메일 중복 에러만 나므로 버튼을 넘기지 않는다). */
  onUseCredentials?: (email: string, password: string) => void;
}

/** 1분반 멤버가 자기 이름으로 더미 계정의 이메일/비밀번호를 바로 찾을 수 있게 하는 헬퍼. */
export function ClassmateLoginHelper({ onUseCredentials }: ClassmateLoginHelperProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");

  const matched = CLASSMATE_NAMES.find((name) => name === query.trim());

  return (
    <div className="classmate-helper">
      <button
        type="button"
        className="classmate-helper__toggle"
        onClick={() => setIsOpen((v) => !v)}
      >
        {isOpen ? "닫기" : "1분반이신가요? 계정 정보 찾기"}
      </button>

      {isOpen && (
        <div className="classmate-helper__panel">
          <input
            className="classmate-helper__input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="이름을 입력하세요 (예: 권순호)"
          />

          {query.trim().length > 0 && !matched && (
            <p className="classmate-helper__hint">명단에서 일치하는 이름을 찾지 못했어요.</p>
          )}

          {matched && (
            <div className="classmate-helper__result">
              <p>
                <span className="classmate-helper__result-label">이메일</span>
                {classmateEmail(matched)}
              </p>
              <p>
                <span className="classmate-helper__result-label">비밀번호</span>
                {CLASSMATE_PASSWORD}
              </p>
              {onUseCredentials ? (
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => onUseCredentials(classmateEmail(matched), CLASSMATE_PASSWORD)}
                >
                  이 정보로 채우기
                </button>
              ) : (
                <p className="classmate-helper__hint">이미 있는 계정이에요 — 로그인 화면에서 위 정보로 로그인하세요.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
