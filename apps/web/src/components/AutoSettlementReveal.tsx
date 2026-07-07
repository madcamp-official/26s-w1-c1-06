import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useUnconfirmedSettlements } from "../hooks/useUnconfirmedSettlements";
import { usePolling } from "../hooks/usePolling";
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

  /**
   * 정산은 1분 주기 백그라운드 스케줄러(F-12)로도 일어난다. 홈 화면을 계속 보고 있는 동안
   * 정산이 발생해도 팝업이 뜨도록 주기적으로 다시 확인한다(최초 마운트 시 1회 조회로는
   * 이미 열려 있는 홈에서 새로 끝난 약속을 못 잡아냄).
   */
  usePolling(reload, 20000);

  useEffect(() => {
    if (!data || !user) return;
    if (data.totalCount === 0) {
      setQueue(null);
      return;
    }
    // 이미 팝업을 보여주는 중이면 백그라운드 폴링으로 큐를 갈아치우지 않는다
    // (다 확인하고 나면 queue가 null이 되어 다음 폴링에서 새로 잡힌다).
    if (queue && queue.length > 0) return;
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
  }, [data, user, queue]);

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
