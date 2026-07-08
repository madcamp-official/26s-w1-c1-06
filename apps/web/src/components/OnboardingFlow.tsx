const STEPS = [
  { emoji: "⏰", title: "지각 발생", desc: "약속 시각 대비 도착 시각" },
  { emoji: "⚖️", title: "시스템 판정", desc: "정시·지각·노쇼 자동 확정" },
  { emoji: "📈", title: "주가 변동", desc: "판정 결과로만 가격이 움직임" },
  { emoji: "💰", title: "배당·정산", desc: "베팅 손익 + 방어 보상 지급" },
] as const;

/** 서비스 핵심 흐름을 한눈에 보여주는 온보딩 다이어그램 — 홈 화면 상단, 말로 설명할 필요를 줄인다. */
export function OnboardingFlow() {
  return (
    <section className="onboarding-flow" aria-label="서비스 작동 방식">
      <h2 className="onboarding-flow__title">이렇게 작동해요</h2>
      <div className="onboarding-flow__track">
        {STEPS.map((step, i) => (
          <div className="onboarding-flow__step-wrap" key={step.title}>
            <div className="onboarding-flow__step">
              <span className="onboarding-flow__emoji" aria-hidden>
                {step.emoji}
              </span>
              <p className="onboarding-flow__step-title">{step.title}</p>
              <p className="onboarding-flow__step-desc">{step.desc}</p>
            </div>
            {i < STEPS.length - 1 && (
              <span className="onboarding-flow__arrow" aria-hidden>
                →
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
