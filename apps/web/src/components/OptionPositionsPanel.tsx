import { AsyncState } from "./AsyncState";
import type { OptionPositionView } from "../types/api";

const OPTION_TYPE_LABEL: Record<"call" | "put", string> = {
  call: "콜(정시)",
  put: "풋(지각)",
};

interface OptionPositionsPanelProps {
  options: OptionPositionView[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}

/** 보유(정산 대기) 옵션 패널 (S-04). 정산은 약속 정산 시 자동 처리되어 별도 조작 없음. */
export function OptionPositionsPanel({
  options,
  isLoading,
  error,
  onRetry,
}: OptionPositionsPanelProps) {
  return (
    <section className="open-positions" aria-label="보유 옵션">
      <header className="open-positions__header">
        <h2>보유 옵션</h2>
        <span className="open-positions__count">{options.length}건</span>
      </header>

      <AsyncState
        loading={isLoading}
        error={error}
        onRetry={onRetry}
        empty={options.length === 0}
        emptyTitle="보유 중인 옵션이 없어요"
        emptyMessage="친구·시장에서 콜/풋 옵션을 매수해 보세요."
      >
        <ul className="open-positions__list">
          {options.map((o) => (
            <li key={o.id} className="open-positions__item">
              <div className="open-positions__item-left">
                <span className="open-positions__avatar">
                  {o.stockNickname.slice(0, 1)}
                </span>
                <div>
                  <div className="open-positions__stock-row">
                    <span className="open-positions__stock-name">{o.stockNickname}</span>
                    <span
                      className={`open-positions__direction${
                        o.optionType === "put" ? " open-positions__direction--short" : ""
                      }`}
                    >
                      {OPTION_TYPE_LABEL[o.optionType]}
                    </span>
                  </div>
                  <div className="open-positions__meta">
                    {o.quantity}계약 · 기준가 {o.referencePrice.toLocaleString()}원 · 프리미엄{" "}
                    {o.premiumPaid.toLocaleString()}P
                  </div>
                  <div className="open-positions__promise">{o.promiseTitle}</div>
                </div>
              </div>
              <div className="open-positions__payout">정산 대기</div>
            </li>
          ))}
        </ul>
      </AsyncState>
    </section>
  );
}
