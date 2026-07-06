import { useNavigate, useParams } from "react-router-dom";
import { AsyncState } from "../components/AsyncState";
import { SettlementHero } from "../components/SettlementHero";
import { ShareCard } from "../components/ShareCard";
import { useAuth } from "../context/AuthContext";
import { useSettlementResult } from "../hooks/useSettlementResult";
import {
  directionLabel,
  formatPoints,
  type SettlementResultVM,
} from "../lib/settlement-result";
import { FALL_COLOR, RISE_COLOR } from "../theme";

interface SettlementResultPageProps {
  kind: "investor" | "stock";
}

function PayoutDetails({ vm }: { vm: SettlementResultVM }) {
  if (vm.kind !== "investor" || vm.payout === undefined) return null;

  const payoutColor =
    vm.payout > 0 ? RISE_COLOR : vm.payout < 0 ? FALL_COLOR : "#333";

  return (
    <section className="result-details">
      <h2 className="section-title">포지션 정산</h2>
      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-card__label">종목</span>
          <span className="stat-card__value">{vm.stockDisplayName}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__label">방향</span>
          <span className="stat-card__value">
            {vm.direction ? directionLabel(vm.direction) : "—"}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-card__label">수량</span>
          <span className="stat-card__value">{vm.quantity}주</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__label">잠금 반환</span>
          <span className="stat-card__value">
            {vm.lockedPoints?.toLocaleString()}P
          </span>
        </div>
        <div className="stat-card stat-card--highlight">
          <span className="stat-card__label">실현 손익</span>
          <span className="stat-card__value" style={{ color: payoutColor }}>
            {formatPoints(vm.payout)}
          </span>
        </div>
        {vm.priceBefore != null && vm.priceAfter != null && (
          <div className="stat-card">
            <span className="stat-card__label">주가</span>
            <span className="stat-card__value">
              {vm.priceBefore.toLocaleString()} → {vm.priceAfter.toLocaleString()}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

function StockDetails({ vm }: { vm: SettlementResultVM }) {
  if (vm.kind !== "stock") return null;

  return (
    <section className="result-details">
      <h2 className="section-title">내 주가 정산</h2>
      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-card__label">정산가</span>
          <span className="stat-card__value">
            {vm.settledPrice.toLocaleString()}원
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-card__label">판정</span>
          <span className="stat-card__value">
            {vm.verdict === "on_time"
              ? "정시"
              : vm.verdict === "no_show"
                ? "노쇼"
                : `${vm.lateMinutes}분 지각`}
          </span>
        </div>
      </div>
    </section>
  );
}

export function SettlementResultPage({ kind }: SettlementResultPageProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { positionId, promiseId } = useParams();

  const { data, loading, error } = useSettlementResult({
    kind,
    positionId,
    promiseId,
    viewerId: user?.id ?? "",
    viewerNickname: user?.nickname ?? "",
  });

  return (
    <div className="result-page">
      <header className="result-page__header">
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => navigate(-1)}
        >
          ← 뒤로
        </button>
      </header>

      <AsyncState loading={loading} error={error}>
        {data && (
          <>
            <SettlementHero vm={data} />
            <div className="result-page__body">
              <PayoutDetails vm={data} />
              <StockDetails vm={data} />
              <ShareCard vm={data} viewerNickname={user?.nickname ?? ""} />
            </div>
          </>
        )}
      </AsyncState>
    </div>
  );
}
