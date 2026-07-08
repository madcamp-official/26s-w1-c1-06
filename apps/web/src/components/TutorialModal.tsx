import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

const STEPS = [
  { emoji: "⏰", title: "지각 발생", desc: "약속 시각 대비 실제 도착 시각을 GPS로 인증해요." },
  { emoji: "⚖️", title: "시스템 판정", desc: "정시·지각·노쇼가 규칙대로 자동 확정돼요." },
  { emoji: "📈", title: "주가 변동", desc: "오직 이 판정 결과로만 주가가 오르내려요." },
  { emoji: "💰", title: "배당·정산", desc: "베팅 손익과 정시 방어 보상이 지급돼요." },
] as const;

interface TutorialModalProps {
  onClose: () => void;
}

/** 첫 방문 시 서비스 핵심 흐름을 스테퍼로 보여주는 온보딩 모달(Framer Motion). */
export function TutorialModal({ onClose }: TutorialModalProps) {
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;
  const current = STEPS[step]!;

  return (
    <motion.div
      className="tutorial-backdrop"
      role="dialog"
      aria-modal="true"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="tutorial-modal"
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 24 }}
      >
        <p className="tutorial-modal__eyebrow">지각비 주식 시장, 이렇게 작동해요</p>

        <div className="tutorial-modal__dots">
          {STEPS.map((s, i) => (
            <span
              key={s.title}
              className={`tutorial-modal__dot${i === step ? " tutorial-modal__dot--active" : ""}`}
            />
          ))}
        </div>

        <div className="tutorial-modal__stage">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              className="tutorial-modal__step"
              initial={{ x: 48, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -48, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 26 }}
            >
              <span className="tutorial-modal__emoji" aria-hidden>
                {current.emoji}
              </span>
              <h2 className="tutorial-modal__title">{current.title}</h2>
              <p className="tutorial-modal__desc">{current.desc}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="tutorial-modal__actions">
          {!isLast && (
            <button type="button" className="btn btn--ghost tutorial-modal__skip" onClick={onClose}>
              건너뛰기
            </button>
          )}
          <button
            type="button"
            className="btn btn--primary btn--block"
            onClick={() => (isLast ? onClose() : setStep((s) => s + 1))}
          >
            {isLast ? "시작하기" : "다음"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
