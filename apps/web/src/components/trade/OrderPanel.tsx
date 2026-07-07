import {
  ALLOWED_MULTIPLIERS,
  computeLiquidationThreshold,
  computeLockedPoints,
} from "@latestock/shared";
import { useState } from "react";
import { ApiError } from "../../lib/api";
import { openPosition } from "../../lib/endpoints";
import type { BettablePromiseView, FriendView } from "../../types/api";

type TradeSide = "buy" | "short";

interface OrderPanelProps {
  stock: FriendView | null;
  promises: BettablePromiseView[];
  promisesLoading: boolean;
  availablePoints: number | null;
  onSuccess: () => void;
}

export function OrderPanel({
  stock,
  promises,
  promisesLoading,
  availablePoints,
  onSuccess,
}: OrderPanelProps) {
  const [side, setSide] = useState<TradeSide>("buy");
  const [promiseId, setPromiseId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [multiplier, setMultiplier] = useState<number>(1);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentPrice = stock?.currentPrice ?? 0;
  const lockedEstimate =
    stock && quantity > 0 ? computeLockedPoints(quantity, currentPrice) : 0;
  const liquidation = computeLiquidationThreshold(side, multiplier);

  async function handleSubmit() {
    if (!stock) {
      setError("종목을 선택해 주세요.");
      return;
    }
    if (!promiseId) {
      setError("약속을 선택해 주세요.");
      return;
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setError("수량은 1 이상의 정수여야 합니다.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await openPosition({
        stockUserId: stock.userId,
        promiseId,
        direction: side,
        quantity,
        multiplier,
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "주문에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <aside className="trade-order">
      <div className="trade-order__tabs" role="tablist" aria-label="주문 유형">
        <button
          type="button"
          role="tab"
          aria-selected={side === "buy"}
          className={`trade-order__tab${side === "buy" ? " trade-order__tab--active" : ""}`}
          onClick={() => setSide("buy")}
        >
          매수
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={side === "short"}
          className={`trade-order__tab trade-order__tab--short${side === "short" ? " trade-order__tab--active" : ""}`}
          onClick={() => setSide("short")}
        >
          공매도
        </button>
      </div>

      <p className="trade-order__side-hint">
        {side === "buy"
          ? "정시 도착에 투자합니다. 정시일수록 이익이 커집니다."
          : "지각·노쇼에 베팅합니다. 늦을수록 이익이 커집니다."}
      </p>

      {stock ? (
        <div className="trade-order__stock">
          <span className="trade-order__stock-avatar">{stock.nickname.slice(0, 1)}</span>
          <div>
            <p className="trade-order__stock-name">{stock.nickname}</p>
            <p className="trade-order__stock-price">{stock.currentPrice.toLocaleString()}원</p>
          </div>
        </div>
      ) : (
        <p className="trade-order__hint">아래 랭킹에서 종목을 선택하세요.</p>
      )}

      <label className="trade-field">
        <span className="trade-field__label">약속</span>
        <select
          className="trade-field__select"
          value={promiseId}
          onChange={(e) => setPromiseId(e.target.value)}
          disabled={promisesLoading || !stock}
        >
          <option value="">
            {promisesLoading ? "불러오는 중..." : "베팅할 약속 선택"}
          </option>
          {promises.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title} · {new Date(p.promisedAt).toLocaleString("ko-KR")}
            </option>
          ))}
        </select>
      </label>

      <label className="trade-field">
        <span className="trade-field__label">수량 (주)</span>
        <input
          className="trade-field__input"
          type="number"
          min={1}
          step={1}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
          disabled={!stock}
        />
      </label>

      <div className="trade-field">
        <span className="trade-field__label">배율</span>
        <div className="trade-order__multiplier" role="radiogroup" aria-label="배율">
          {ALLOWED_MULTIPLIERS.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={multiplier === m}
              className={`trade-order__multiplier-btn${multiplier === m ? " trade-order__multiplier-btn--active" : ""}`}
              disabled={!stock}
              onClick={() => setMultiplier(m)}
            >
              {m}x
            </button>
          ))}
        </div>
      </div>

      <div className="trade-order__summary">
        <div className="trade-order__summary-row">
          <span>매수 가능</span>
          <strong>{availablePoints != null ? `${availablePoints.toLocaleString()}P` : "—"}</strong>
        </div>
        <div className="trade-order__summary-row">
          <span>예상 잠금</span>
          <strong>{lockedEstimate.toLocaleString()}P</strong>
        </div>
        <div className="trade-order__summary-row">
          <span>주문 유형</span>
          <strong>{side === "buy" ? "매수" : "공매도"}</strong>
        </div>
      </div>

      {stock && multiplier > 1 && (
        <p className="trade-order__liquidation-notice">
          {side === "buy"
            ? liquidation.lateMinutesThreshold !== null
              ? `이번 약속에서 ${stock.nickname}이(가) ${liquidation.lateMinutesThreshold}분 이상 지각하면 잠금 포인트 전액이 청산됩니다.`
              : "이 배율에서는 이번 약속 결과만으로 잠금 포인트가 전액 청산되지 않습니다."
            : liquidation.onTimeLiquidates
              ? `이번 약속에서 ${stock.nickname}이(가) 정시 도착하면 잠금 포인트 전액이 청산됩니다.`
              : "이 배율에서는 이번 약속 결과만으로 잠금 포인트가 전액 청산되지 않습니다."}
        </p>
      )}

      <p className="trade-order__note">현재가로 즉시 체결됩니다 (지정가 주문 없음).</p>

      {error && (
        <p className="trade-order__error" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        className={`trade-order__submit${side === "short" ? " trade-order__submit--short" : ""}`}
        disabled={!stock || isSubmitting}
        onClick={handleSubmit}
      >
        {isSubmitting ? "처리 중..." : side === "buy" ? "매수하기" : "공매도하기"}
      </button>
    </aside>
  );
}
