import { useEffect, useState } from "react";
import { ApiError } from "../lib/api";
import { getStockChart } from "../lib/endpoints";
import { buildStockResult, type SettlementResultVM } from "../lib/settlement-result";
import type { ParticipantStatusView, PromiseView } from "../types/api";
import { SettlementHero } from "./SettlementHero";

interface ParticipantResultModalProps {
  promise: PromiseView;
  participant: ParticipantStatusView;
  viewerId: string;
  onClose: () => void;
}

/**
 * 참여자 클릭 시 뜨는 상세 모달 (SC-09).
 * checkinMasked/inviteStatus에 따라 분기하되, 마스킹된 참여자는 서버가 애초에
 * checkinAt을 null로 내려주므로(R-1) 이 컴포넌트는 그 값을 그대로 신뢰하고
 * "공개 안 됨" 문구만 보여준다 — 도착 여부를 추정해서 보여주지 않는다.
 */
export function ParticipantResultModal({
  promise,
  participant,
  viewerId,
  onClose,
}: ParticipantResultModalProps) {
  const shouldFetch = !participant.checkinMasked && participant.checkinAt !== null;

  const [vm, setVm] = useState<SettlementResultVM | null>(null);
  const [loading, setLoading] = useState(shouldFetch);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shouldFetch) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    getStockChart(participant.userId)
      .then(({ points }) => {
        if (cancelled) return;
        const chartPoint = points.find((p) => p.promiseId === promise.id);
        if (chartPoint) {
          setVm(
            buildStockResult(
              chartPoint,
              promise,
              participant.displayName,
              viewerId,
              participant.userId,
            ),
          );
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "결과를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [promise, participant, viewerId, shouldFetch]);

  let body: React.ReactNode;
  if (participant.checkinMasked) {
    body = <p className="modal-box__hint">약속 시각 전에는 도착 여부가 공개되지 않아요.</p>;
  } else if (participant.inviteStatus === "declined" || participant.inviteStatus === "auto_declined") {
    body = <p className="modal-box__hint">이 약속에 참여하지 않았어요.</p>;
  } else if (!participant.checkinAt) {
    body = <p className="modal-box__hint">아직 도착 전이에요.</p>;
  } else if (loading) {
    body = <p className="modal-box__hint">불러오는 중...</p>;
  } else if (error) {
    body = <p className="modal-box__error">{error}</p>;
  } else if (vm) {
    body = <SettlementHero vm={vm} />;
  } else {
    body = (
      <p className="modal-box__hint">
        {new Date(participant.checkinAt).toLocaleTimeString("ko-KR")}에 도착 인증을 완료했어요.
        아직 정산 전입니다.
      </p>
    );
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-box__header">
          <span className="modal-box__title">{participant.displayName}</span>
          <button
            type="button"
            className="modal-box__close"
            onClick={onClose}
            aria-label="닫기"
          >
            ✕
          </button>
        </div>
        {body}
      </div>
    </div>
  );
}
