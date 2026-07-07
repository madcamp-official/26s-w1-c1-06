import { Link } from "react-router-dom";
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

interface UnconfirmedSettlementsBannerProps {
  data: UnconfirmedSettlements | null;
}

/**
 * 정산 결과 확인을 유도하는 배너 (F-12). confirm 호출은 이동 대상인 정산 결과 화면이 담당한다.
 * data는 호출부(화면)가 useUnconfirmedSettlements()로 소유·전달한다 — 같은 화면에
 * AutoSettlementReveal처럼 같은 데이터를 쓰는 컴포넌트가 있을 때, 각자 따로 훅을 호출하면
 * 상태가 따로 놀아서 한쪽에서 확인 처리해도 다른 쪽이 갱신 안 되는 문제가 생긴다.
 */
export function UnconfirmedSettlementsBanner({ data }: UnconfirmedSettlementsBannerProps) {
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
