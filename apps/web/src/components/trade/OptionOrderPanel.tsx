import { computeOptionPremium, type OptionType } from "@latestock/shared";
import { useEffect, useState } from "react";
import { ApiError } from "../../lib/api";
import { buyOption } from "../../lib/endpoints";
import { InlineToast } from "../InlineToast";
import { RippleButton } from "../RippleButton";
import type { BettablePromiseView, FriendView } from "../../types/api";
import { BettingCountdown } from "./BettingCountdown";

interface OptionOrderPanelProps {
  stock: FriendView | null;
  promises: BettablePromiseView[];
  promisesLoading: boolean;
  availablePoints: number | null;
  onSuccess: () => void;
}

/** S-04 옵션(콜/풋) 주문 패널 — strike 없는 이진 행사, 프리미엄=수량 가중. */
export function OptionOrderPanel({
  stock,
  promises,
  promisesLoading,
  availablePoints,
  onSuccess,
}: OptionOrderPanelProps) {
  const [optionType, setOptionType] = useState<OptionType>("put");
  const [promiseId, setPromiseId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ key: number; message: string } | null>(null);

  const currentPrice = stock?.currentPrice ?? 0;
  const p = (stock?.lateRiskPct ?? 0) / 100;
  const premiumEstimate =
    stock && quantity > 0
      ? computeOptionPremium(optionType, currentPrice, quantity, p)
      : 0;
  const payoutEstimate = stock && quantity > 0 ? currentPrice * quantity : 0;
  const selectedPromise = promises.find((item) => item.id === promiseId) ?? null;
  const [bettingClosed, setBettingClosed] = useState(false);

  useEffect(() => {
    if (!selectedPromise) setBettingClosed(false);
  }, [selectedPromise]);

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
      await buyOption({
        stockUserId: stock.userId,
        promiseId,
        optionType,
        quantity,
      });
      setToast({
        key: Date.now(),
        message: `${optionType === "call" ? "콜" : "풋"} 매수 체결! ${quantity}계약`,
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "옵션 매수에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <aside className="trade-order trade-order--option">
      <h3 className="trade-order__placeholder-title">옵션(콜/풋)</h3>

      <div className="trade-order__tabs" role="tablist" aria-label="옵션 유형">
        <button
          type="button"
          role="tab"
          aria-selected={optionType === "call"}
          className={`trade-order__tab${optionType === "call" ? " trade-order__tab--active" : ""}`}
          onClick={() => setOptionType("call")}
        >
          콜(정시)
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={optionType === "put"}
          className={`trade-order__tab trade-order__tab--short${optionType === "put" ? " trade-order__tab--active" : ""}`}
          onClick={() => setOptionType("put")}
        >
          풋(지각)
        </button>
      </div>

      <p className="trade-order__side-hint">
        {optionType === "call"
          ? "정시 도착하면 고정 배당, 아니면 프리미엄 전액 소멸."
          : "지각·노쇼하면 고정 배당, 정시면 프리미엄 전액 소멸."}
      </p>

      <label className="trade-field">
        <span className="trade-field__label">약속</span>
        <select
          className="trade-field__select"
          value={promiseId}
          onChange={(e) => setPromiseId(e.target.value)}
          disabled={promisesLoading || !stock}
        >
          <option value="">
            {promisesLoading ? "불러오는 중..." : "옵션을 걸 약속 선택"}
          </option>
          {promises.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title} · {new Date(p.promisedAt).toLocaleString("ko-KR")}
            </option>
          ))}
        </select>
      </label>

      {selectedPromise && (
        <BettingCountdown
          key={selectedPromise.id}
          deadline={selectedPromise.promisedAt}
          onClosedChange={setBettingClosed}
        />
      )}

      <label className="trade-field">
        <span className="trade-field__label">수량 (계약)</span>
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

      <div className="trade-order__summary">
        <div className="trade-order__summary-row">
          <span>매수 가능</span>
          <strong>{availablePoints != null ? `${availablePoints.toLocaleString()}P` : "—"}</strong>
        </div>
        <div className="trade-order__summary-row">
          <span>프리미엄(즉시 지불)</span>
          <strong>{premiumEstimate.toLocaleString()}P</strong>
        </div>
        <div className="trade-order__summary-row">
          <span>성공 시 배당</span>
          <strong>{payoutEstimate.toLocaleString()}P</strong>
        </div>
      </div>

      <p className="trade-order__note">
        행사 성공(이진 판정)이면 고정 배당, 실패하면 프리미엄만 잃습니다(추가 손실 없음).
      </p>

      {error && (
        <p className="trade-order__error" role="alert">
          {error}
        </p>
      )}

      {toast && <InlineToast toastKey={toast.key} message={toast.message} />}

      <RippleButton
        type="button"
        className={`trade-order__submit${optionType === "put" ? " trade-order__submit--short" : ""}`}
        disabled={!stock || isSubmitting || bettingClosed}
        onClick={handleSubmit}
      >
        {isSubmitting
          ? "처리 중..."
          : bettingClosed
            ? "베팅 마감됨"
            : optionType === "call"
              ? "콜 매수"
              : "풋 매수"}
      </RippleButton>
    </aside>
  );
}
