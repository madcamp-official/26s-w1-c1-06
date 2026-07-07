import { useState } from "react";
import { useEtfRecommendations } from "../hooks/useEtfRecommendations";
import { ApiError } from "../lib/api";
import { openEtfBasket } from "../lib/endpoints";
import type { EtfRecommendationView } from "../types/api";

interface EtfRecommendationsSectionProps {
  onSuccess: () => void;
}

/**
 * 추천 ETF 카드 목록 (S-03) — 실시간 계산, 저장 안 함.
 * 이 화면을 보는 유저 본인의 친구 데이터로만 계산되므로 다른 유저에게는
 * 노출되지도, 살 수도 없다(별도 권한 테이블 없이 계산 범위 자체로 보장).
 */
export function EtfRecommendationsSection({ onSuccess }: EtfRecommendationsSectionProps) {
  const { recommendations, isLoading, reload } = useEtfRecommendations();

  if (isLoading || recommendations.length === 0) return null;

  function handleSuccess() {
    reload();
    onSuccess();
  }

  return (
    <section className="etf-recommend" aria-label="추천 ETF">
      <header className="etf-recommend__header">
        <h2>추천 ETF</h2>
        <p className="etf-recommend__hint">내 친구들의 지각 이력을 기반으로 뽑은 조합이에요.</p>
      </header>
      <div className="etf-recommend__list">
        {recommendations.map((rec) => (
          <EtfRecommendationCard
            key={rec.themeKey}
            recommendation={rec}
            onSuccess={handleSuccess}
          />
        ))}
      </div>
    </section>
  );
}

function EtfRecommendationCard({
  recommendation,
  onSuccess,
}: {
  recommendation: EtfRecommendationView;
  onSuccess: () => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isShort = recommendation.direction === "short";

  async function handleBuy() {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setError("수량은 1 이상의 정수여야 합니다.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await openEtfBasket({
        direction: recommendation.direction,
        quantity,
        label: recommendation.name,
        themeKey: recommendation.themeKey,
        legs: recommendation.legs.map((leg) => ({
          stockUserId: leg.stockUserId,
          promiseId: leg.promiseId,
        })),
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "바스켓 매수에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <article className="etf-recommend-card">
      <header className="etf-recommend-card__header">
        <span className="etf-recommend-card__emoji" aria-hidden="true">
          {recommendation.emoji}
        </span>
        <div>
          <h3>{recommendation.name}</h3>
          <p className="etf-recommend-card__members">
            {recommendation.legs.map((leg) => leg.stockNickname).join(" · ")}
          </p>
        </div>
      </header>

      <p className="etf-recommend-card__note">
        {isShort
          ? "이 조합이 지각할수록 이득 (공매도 전용)"
          : "이 조합이 정시에 올수록 이득 (매수 전용)"}
      </p>

      <label className="trade-field">
        <span className="trade-field__label">수량</span>
        <input
          className="trade-field__input"
          type="number"
          min={1}
          step={1}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
        />
      </label>

      {error && (
        <p className="trade-order__error" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        className={`trade-order__submit${isShort ? " trade-order__submit--short" : ""}`}
        disabled={isSubmitting}
        onClick={handleBuy}
      >
        {isSubmitting ? "처리 중..." : isShort ? "공매도" : "매수"}
      </button>
    </article>
  );
}
