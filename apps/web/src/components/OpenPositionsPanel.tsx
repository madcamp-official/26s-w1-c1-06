import { useState } from "react";
import { AsyncState } from "./AsyncState";
import type { OpenPositionRow } from "../hooks/useOpenPositions";
import { ApiError } from "../lib/api";
import { closePosition } from "../lib/endpoints";
import { FALL_COLOR, RISE_COLOR } from "../theme";

const DIRECTION_LABEL: Record<"buy" | "short", string> = {
  buy: "매수",
  short: "공매도",
};

interface OpenPositionsPanelProps {
  positions: OpenPositionRow[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onClosed: () => void;
}

export function OpenPositionsPanel({
  positions,
  isLoading,
  error,
  onRetry,
  onClosed,
}: OpenPositionsPanelProps) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [closeError, setCloseError] = useState<string | null>(null);

  async function handleClose(positionId: string) {
    setClosingId(positionId);
    setCloseError(null);
    try {
      await closePosition(positionId);
      setConfirmingId(null);
      onClosed();
    } catch (err) {
      setCloseError(err instanceof ApiError ? err.message : "청산에 실패했습니다.");
    } finally {
      setClosingId(null);
    }
  }

  return (
    <section className="open-positions" aria-label="보유 포지션">
      <header className="open-positions__header">
        <h2>보유 포지션</h2>
        <span className="open-positions__count">{positions.length}건</span>
      </header>

      {closeError && (
        <p className="open-positions__error" role="alert">
          {closeError}
        </p>
      )}

      <AsyncState
        loading={isLoading}
        error={error}
        onRetry={onRetry}
        empty={positions.length === 0}
        emptyTitle="보유 중인 포지션이 없어요"
        emptyMessage="친구·시장에서 종목을 골라 매수·공매도해 보세요."
      >
        <ul className="open-positions__list">
          {positions.map((p) => {
            const isProfit = p.unrealizedPayout >= 0;
            const isBeforeDeadline = new Date(p.promisedAt).getTime() > Date.now();
            const actionLabel = isBeforeDeadline ? "취소" : "조기 청산";
            const confirmLabel = isBeforeDeadline ? "정말 취소?" : "정말 청산?";
            return (
              <li key={p.id} className="open-positions__item">
                <div className="open-positions__item-left">
                  <span className="open-positions__avatar">
                    {p.stockNickname.slice(0, 1)}
                  </span>
                  <div>
                    <div className="open-positions__stock-row">
                      <span className="open-positions__stock-name">{p.stockNickname}</span>
                      <span
                        className={`open-positions__direction${
                          p.direction === "short" ? " open-positions__direction--short" : ""
                        }`}
                      >
                        {DIRECTION_LABEL[p.direction]}
                      </span>
                    </div>
                    <div className="open-positions__meta">
                      {p.quantity}주 · 개설가 {p.openPrice.toLocaleString()}원 · 현재가{" "}
                      {p.currentPrice.toLocaleString()}원
                    </div>
                    <div className="open-positions__promise">{p.promiseTitle}</div>
                  </div>
                </div>
                <div className="open-positions__item-right">
                  <div
                    className="open-positions__payout"
                    style={{ color: isProfit ? RISE_COLOR : FALL_COLOR }}
                  >
                    {isProfit ? "+" : ""}
                    {p.unrealizedPayout.toLocaleString()}P
                  </div>
                  {confirmingId === p.id ? (
                    <button
                      type="button"
                      className="open-positions__close-btn open-positions__close-btn--confirm"
                      disabled={closingId === p.id}
                      onClick={() => handleClose(p.id)}
                    >
                      {closingId === p.id ? "처리 중..." : confirmLabel}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="open-positions__close-btn"
                      onClick={() => setConfirmingId(p.id)}
                    >
                      {actionLabel}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </AsyncState>
    </section>
  );
}
