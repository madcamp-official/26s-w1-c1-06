import { useEffect, useState } from "react";
import { ApiError } from "../lib/api";
import {
  confirmSettlement,
  getMyStockChart,
  getPromise,
  getStockChart,
  listPositions,
} from "../lib/endpoints";
import {
  buildInvestorResult,
  buildStockResult,
  type SettlementResultVM,
} from "../lib/settlement-result";

interface UseSettlementResultOptions {
  kind: "investor" | "stock";
  positionId?: string;
  promiseId?: string;
  viewerId: string;
  viewerNickname: string;
}

export function useSettlementResult({
  kind,
  positionId,
  promiseId,
  viewerId,
  viewerNickname,
}: UseSettlementResultOptions) {
  const [data, setData] = useState<SettlementResultVM | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      let confirmKind: "position" | "participant" | null = null;
      let confirmRefId: string | null = null;

      try {
        if (kind === "investor") {
          if (!positionId) throw new Error("포지션 ID가 필요합니다.");
          const { positions } = await listPositions("settled");
          const position = positions.find((p) => p.id === positionId);
          if (!position) {
            throw new Error("정산된 포지션을 찾을 수 없습니다.");
          }
          const { points } = await getStockChart(position.stockUserId);
          // 조기 청산(M3-2)된 포지션은 약속이 아직 판정 안 나서 차트 포인트가 없을 수 있다 —
          // 이 경우 에러 대신 포지션 자체 데이터로 결과를 구성한다(fromEarlyExit).
          const chartPoint =
            points.find((p) => p.promiseId === position.promiseId) ?? null;
          const vm = buildInvestorResult(position, chartPoint, viewerId);
          if (!cancelled) setData(vm);
          confirmKind = "position";
          confirmRefId = position.id;
        } else {
          if (!promiseId) throw new Error("약속 ID가 필요합니다.");
          const [{ promise }, { points }] = await Promise.all([
            getPromise(promiseId),
            getMyStockChart(),
          ]);
          const chartPoint = points.find((p) => p.promiseId === promiseId);
          if (!chartPoint) {
            throw new Error("아직 정산되지 않았거나 차트 데이터가 없습니다.");
          }
          const vm = buildStockResult(
            chartPoint,
            promise,
            viewerNickname,
            viewerId,
            viewerId,
          );
          if (!cancelled) setData(vm);
          confirmKind = "participant";
          confirmRefId = promiseId;
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) {
          setError(err.message);
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("결과를 불러오지 못했습니다.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }

      // confirm은 결과 조회 성공 후의 부가 효과 — try 밖에서 호출해 로딩 해제가
      // confirm 왕복을 기다리지 않게 하고, 언마운트된 뒤에는 발사하지 않는다.
      if (!cancelled && confirmKind && confirmRefId) {
        await confirmSettlement(confirmKind, confirmRefId);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [kind, positionId, promiseId, viewerId, viewerNickname]);

  return { data, loading, error };
}
