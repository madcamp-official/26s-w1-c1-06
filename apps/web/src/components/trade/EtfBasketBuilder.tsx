import {
  ETF_BASKET_MAX_LEGS,
  ETF_BASKET_MIN_LEGS,
  type PositionDirection,
} from "@latestock/shared";
import { useState } from "react";
import { ApiError } from "../../lib/api";
import { getStockPromises, openEtfBasket } from "../../lib/endpoints";
import type { BettablePromiseView, FriendView } from "../../types/api";

interface EtfBasketBuilderProps {
  friends: FriendView[];
  availablePoints: number | null;
  onClose: () => void;
  onSuccess: () => void;
}

/** 직접 만들기 ETF 바스켓 모달 (S-03) — 친구 2~5명 + 방향 1개 + 종목별 약속 선택. */
export function EtfBasketBuilder({
  friends,
  availablePoints,
  onClose,
  onSuccess,
}: EtfBasketBuilderProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [direction, setDirection] = useState<PositionDirection>("short");
  const [quantity, setQuantity] = useState(1);
  const [label, setLabel] = useState("");
  const [legPromises, setLegPromises] = useState<
    Record<string, BettablePromiseView[]>
  >({});
  const [legPromisesLoading, setLegPromisesLoading] = useState<
    Record<string, boolean>
  >({});
  const [chosenPromiseId, setChosenPromiseId] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function toggleFriend(friendId: string) {
    setError(null);
    setSelectedIds((prev) => {
      if (prev.includes(friendId)) {
        return prev.filter((id) => id !== friendId);
      }
      if (prev.length >= ETF_BASKET_MAX_LEGS) {
        return prev;
      }
      if (!legPromises[friendId] && !legPromisesLoading[friendId]) {
        setLegPromisesLoading((p) => ({ ...p, [friendId]: true }));
        getStockPromises(friendId)
          .then(({ promises }) => {
            setLegPromises((p) => ({ ...p, [friendId]: promises }));
          })
          .catch(() => {
            setLegPromises((p) => ({ ...p, [friendId]: [] }));
          })
          .finally(() => {
            setLegPromisesLoading((p) => ({ ...p, [friendId]: false }));
          });
      }
      return [...prev, friendId];
    });
  }

  async function handleSubmit() {
    if (selectedIds.length < ETF_BASKET_MIN_LEGS) {
      setError(`친구를 ${ETF_BASKET_MIN_LEGS}명 이상 선택해 주세요.`);
      return;
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setError("수량은 1 이상의 정수여야 합니다.");
      return;
    }
    const legs = selectedIds.map((id) => ({
      stockUserId: id,
      promiseId: chosenPromiseId[id] ?? "",
    }));
    if (legs.some((leg) => !leg.promiseId)) {
      setError("선택한 친구마다 대상 약속을 골라 주세요.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await openEtfBasket({
        direction,
        quantity,
        label: label.trim() || undefined,
        legs,
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "바스켓 개설에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-box modal-box--etf-builder modal-box--dark"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-box__header">
          <span className="modal-box__title">펀드 직접 만들기</span>
          <button type="button" className="modal-box__close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>

        <p className="modal-box__hint">
          친구 {ETF_BASKET_MIN_LEGS}~{ETF_BASKET_MAX_LEGS}명을 골라 한 바스켓으로 묶어 베팅합니다.
        </p>

        <div className="etf-builder__friends" role="group" aria-label="구성 친구 선택">
          {friends.map((friend) => {
            const checked = selectedIds.includes(friend.userId);
            return (
              <label key={friend.userId} className="etf-builder__friend">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleFriend(friend.userId)}
                  disabled={!checked && selectedIds.length >= ETF_BASKET_MAX_LEGS}
                />
                <span>{friend.nickname}</span>
              </label>
            );
          })}
        </div>

        {selectedIds.length > 0 && (
          <div className="etf-builder__legs">
            {selectedIds.map((id) => {
              const friend = friends.find((f) => f.userId === id);
              const promises = legPromises[id] ?? [];
              const loading = legPromisesLoading[id] ?? false;
              return (
                <label key={id} className="trade-field">
                  <span className="trade-field__label">{friend?.nickname ?? id}의 대상 약속</span>
                  <select
                    className="trade-field__select"
                    value={chosenPromiseId[id] ?? ""}
                    onChange={(e) =>
                      setChosenPromiseId((prev) => ({ ...prev, [id]: e.target.value }))
                    }
                    disabled={loading}
                  >
                    <option value="">
                      {loading ? "불러오는 중..." : "약속 선택"}
                    </option>
                    {promises.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} · {new Date(p.promisedAt).toLocaleString("ko-KR")}
                      </option>
                    ))}
                  </select>
                </label>
              );
            })}
          </div>
        )}

        <div className="trade-order__tabs" role="tablist" aria-label="방향">
          <button
            type="button"
            role="tab"
            aria-selected={direction === "buy"}
            className={`trade-order__tab${direction === "buy" ? " trade-order__tab--active" : ""}`}
            onClick={() => setDirection("buy")}
          >
            매수(다 정시에 오면 이득)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={direction === "short"}
            className={`trade-order__tab trade-order__tab--short${direction === "short" ? " trade-order__tab--active" : ""}`}
            onClick={() => setDirection("short")}
          >
            공매도(다 지각하면 이득)
          </button>
        </div>

        <label className="trade-field">
          <span className="trade-field__label">수량 (바스켓 공통)</span>
          <input
            className="trade-field__input"
            type="number"
            min={1}
            step={1}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
          />
        </label>

        <label className="trade-field">
          <span className="trade-field__label">펀드 이름 (선택)</span>
          <input
            className="trade-field__input"
            type="text"
            placeholder="내가 만든 펀드"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={40}
          />
        </label>

        <div className="trade-order__summary">
          <div className="trade-order__summary-row">
            <span>매수 가능</span>
            <strong>{availablePoints != null ? `${availablePoints.toLocaleString()}P` : "—"}</strong>
          </div>
        </div>

        {error && (
          <p className="modal-box__error" role="alert">
            {error}
          </p>
        )}

        <button
          type="button"
          className={`trade-order__submit${direction === "short" ? " trade-order__submit--short" : ""}`}
          disabled={isSubmitting}
          onClick={handleSubmit}
        >
          {isSubmitting ? "처리 중..." : direction === "short" ? "바스켓 공매도" : "바스켓 매수"}
        </button>
      </div>
    </div>
  );
}
