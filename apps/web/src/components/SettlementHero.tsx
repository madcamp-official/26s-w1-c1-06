import type { SettlementResultVM } from "../lib/settlement-result";
import { MEME_BG_COLORS } from "../theme";

interface SettlementHeroProps {
  vm: SettlementResultVM;
}

export function SettlementHero({ vm }: SettlementHeroProps) {
  const verdictText =
    vm.verdict === "early_exit"
      ? "약속 판정 전 조기 청산"
      : vm.verdict === "on_time"
        ? "정시 도착"
        : vm.verdict === "no_show"
          ? "노쇼 (미인증)"
          : `${vm.lateMinutes}분 지각`;

  return (
    <section
      className="settlement-hero"
      style={{ background: MEME_BG_COLORS[vm.memeBgKey] }}
    >
      <p className="settlement-hero__eyebrow">정산 결과</p>
      <h1 className="settlement-hero__title">{vm.memeLabel}</h1>
      <p className="settlement-hero__subtitle">{verdictText}</p>
      <p className="settlement-hero__promise">{vm.promiseTitle}</p>
    </section>
  );
}
