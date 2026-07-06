import { Link } from "react-router-dom";
import { useUnconfirmedSettlements } from "../hooks/useUnconfirmedSettlements";
import type { UnconfirmedSettlements } from "../types/api";

/** 여러 건이 쌓여 있을 때 가장 최근 정산 하나로 이동시킨다. 나머지는 결과 확인 후 재조회 시 남은 건수로 갱신된다. */
function pickLatestPath(data: UnconfirmedSettlements): string | null {
  const latestStock = data.asStock[0];
  const latestInvestor = data.asInvestor[0];

  if (latestStock && !latestInvestor) return `/results/stock/${latestStock.promiseId}`;
  if (latestInvestor && !latestStock) return `/results/position/${latestInvestor.positionId}`;
  if (!latestStock || !latestInvestor) return null;

  const stockAt = new Date(latestStock.promisedAt).getTime();
  const investorAt = new Date(latestInvestor.settledAt).getTime();
  return stockAt >= investorAt
    ? `/results/stock/${latestStock.promiseId}`
    : `/results/position/${latestInvestor.positionId}`;
}

/** 정산 결과 확인을 유도하는 배너 (F-12). confirm 호출은 이동 대상인 정산 결과 화면이 담당한다. */
export function UnconfirmedSettlementsBanner() {
  const { data } = useUnconfirmedSettlements();

  if (!data || data.totalCount === 0) return null;

  const path = pickLatestPath(data);
  if (!path) return null;

  return (
    <Link to={path} className="settlement-banner">
      <span className="settlement-banner__icon" aria-hidden>
        🔔
      </span>
      <span className="settlement-banner__text">
        확인 안 한 결과 {data.totalCount}건
      </span>
      <span className="settlement-banner__arrow" aria-hidden>
        →
      </span>
    </Link>
  );
}
