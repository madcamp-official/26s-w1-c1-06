import { AsyncState } from "./AsyncState";
import { FALL_COLOR, RISE_COLOR } from "../theme";
import type { EtfBasketView } from "../types/api";

const DIRECTION_LABEL: Record<"buy" | "short", string> = {
  buy: "매수",
  short: "공매도",
};

interface EtfBasketsPanelProps {
  baskets: EtfBasketView[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}

/**
 * ETF 바스켓 패널 (S-03). 한 바스켓의 leg들은 서로 다른 약속이 걸려 있어
 * 각자 다른 시각에 정산되므로, "N건 중 M건 정산 완료" 같은 부분 정산 상태를
 * 그대로 보여준다 — 정산 자체는 기존 정산 엔진이 leg 단위로 처리한 결과다.
 */
export function EtfBasketsPanel({ baskets, isLoading, error, onRetry }: EtfBasketsPanelProps) {
  return (
    <section className="open-positions" aria-label="ETF 바스켓">
      <header className="open-positions__header">
        <h2>ETF 바스켓</h2>
        <span className="open-positions__count">{baskets.length}건</span>
      </header>

      <AsyncState
        loading={isLoading}
        error={error}
        onRetry={onRetry}
        empty={baskets.length === 0}
        emptyIcon="🧺"
        emptyTitle="보유 중인 ETF 바스켓이 없어요"
        emptyMessage="친구·시장에서 추천 ETF를 사거나, 직접 펀드를 만들어 보세요."
      >
        <ul className="open-positions__list">
          {baskets.map((basket) => {
            const settledLegs = basket.legs.filter((leg) => leg.status === "settled").length;
            const isProfit = basket.realizedPayout >= 0;
            return (
              <li key={basket.id} className="open-positions__item open-positions__item--basket">
                <div className="etf-basket__summary">
                  <div className="open-positions__item-left">
                    <div>
                      <div className="open-positions__stock-row">
                        <span className="open-positions__stock-name">{basket.label}</span>
                        <span
                          className={`open-positions__direction${
                            basket.direction === "short" ? " open-positions__direction--short" : ""
                          }`}
                        >
                          {DIRECTION_LABEL[basket.direction]}
                        </span>
                      </div>
                      <div className="open-positions__meta">
                        잠금 {basket.totalLocked.toLocaleString()}P ·{" "}
                        {basket.isFullySettled
                          ? "전체 정산 완료"
                          : `${settledLegs}/${basket.legs.length}건 정산 완료`}
                      </div>
                    </div>
                  </div>
                  <div className="open-positions__item-right">
                    <div
                      className="open-positions__payout"
                      style={{ color: isProfit ? RISE_COLOR : FALL_COLOR }}
                    >
                      {isProfit ? "+" : ""}
                      {basket.realizedPayout.toLocaleString()}P
                    </div>
                  </div>
                </div>

                <ul className="etf-basket__legs">
                  {basket.legs.map((leg) => (
                    <li key={leg.id} className="etf-basket__leg">
                      <span className="etf-basket__leg-name">{leg.stockNickname}</span>
                      <span className="etf-basket__leg-promise">{leg.promiseTitle}</span>
                      <span className="etf-basket__leg-status">
                        {leg.status === "settled"
                          ? `정산완료 ${(leg.payout ?? 0) >= 0 ? "+" : ""}${(leg.payout ?? 0).toLocaleString()}P`
                          : `진행 중 (${new Date(leg.promisedAt).toLocaleString("ko-KR")} 마감)`}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      </AsyncState>
    </section>
  );
}
