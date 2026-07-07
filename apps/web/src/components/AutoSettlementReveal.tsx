import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useUnconfirmedSettlements } from "../hooks/useUnconfirmedSettlements";
import { confirmSettlement } from "../lib/endpoints";
import {
  buildVMFromUnconfirmedInvestor,
  buildVMFromUnconfirmedStock,
  formatPoints,
  type SettlementResultVM,
} from "../lib/settlement-result";
import { FALL_COLOR, RISE_COLOR } from "../theme";
import { ReactionBar } from "./ReactionBar";
import { SettlementHero } from "./SettlementHero";

interface QueueItem {
  vm: SettlementResultVM;
  confirmKind: "position" | "participant";
  confirmRefId: string;
}

function isWinResult(vm: SettlementResultVM): boolean {
  if (vm.payout !== undefined) return vm.payout > 0;
  return vm.verdict === "on_time";
}

const CONFETTI_COLORS = ["#fee500", "#d60000", "#0051c7", "#2ecc71", "#f5a623"];

/** 외부 라이브러리 없이 CSS 애니메이션만으로 구현한 승리 컨페티. */
function Confetti() {
  const pieces = Array.from({ length: 16 }, (_, i) => i);
  return (
    <div className="confetti" aria-hidden>
      {pieces.map((i) => (
        <span
          key={i}
          className="confetti__piece"
          style={{
            left: `${(i * 6.25) % 100}%`,
            background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            animationDelay: `${(i % 5) * 0.12}s`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * M6-1: 미확인 정산이 있으면 홈 진입 즉시 결과를 모달로 띄운다.
 * useUnconfirmedSettlements가 이미 verdict·payout 등을 다 갖고 있어서 별도 조회 없이
 * 즉석에서 결과 VM을 만든다(buildVMFromUnconfirmed*).
 */
export function AutoSettlementReveal() {
  const { user } = useAuth();
  const { data, reload } = useUnconfirmedSettlements();
  const [queue, setQueue] = useState<QueueItem[] | null>(null);
  const [index, setIndex] = useState(0);
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    if (!data || !user) return;
    if (data.totalCount === 0) {
      setQueue(null);
      return;
    }
    const investorItems: QueueItem[] = data.asInvestor.map((item) => ({
      vm: buildVMFromUnconfirmedInvestor(item, user.id),
      confirmKind: "position",
      confirmRefId: item.positionId,
    }));
    const stockItems: QueueItem[] = data.asStock.map((item) => ({
      vm: buildVMFromUnconfirmedStock(item, user.nickname, user.id),
      confirmKind: "participant",
      confirmRefId: item.promiseId,
    }));
    setQueue([...investorItems, ...stockItems]);
    setIndex(0);
  }, [data, user]);

  if (!user || !queue || queue.length === 0 || index >= queue.length) {
    return null;
  }

  const current = queue[index]!;
  const win = isWinResult(current.vm);
  const isLast = index + 1 >= queue.length;

  async function handleNext() {
    setIsConfirming(true);
    await confirmSettlement(current!.confirmKind, current!.confirmRefId);
    setIsConfirming(false);
    if (isLast) {
      setQueue(null);
      reload();
    } else {
      setIndex((i) => i + 1);
    }
  }

  return (
    <div className="auto-reveal-overlay" role="dialog" aria-modal="true">
      <div
        key={current.vm.promiseId}
        className={`auto-reveal-modal${win ? " auto-reveal-modal--win" : " auto-reveal-modal--lose"}`}
      >
        {win && <Confetti />}
        <SettlementHero vm={current.vm} />

        {current.vm.payout !== undefined && (
          <p
            className="auto-reveal-payout"
            style={{ color: current.vm.payout >= 0 ? RISE_COLOR : FALL_COLOR }}
          >
            {formatPoints(current.vm.payout)}
          </p>
        )}

        <div className="auto-reveal-reactions">
          <ReactionBar promiseId={current.vm.promiseId} />
        </div>

        <button
          type="button"
          className="btn btn--primary btn--block"
          disabled={isConfirming}
          onClick={() => void handleNext()}
        >
          {isConfirming ? "처리 중..." : isLast ? "확인" : `다음 (${index + 1}/${queue.length})`}
        </button>
      </div>
    </div>
  );
}
