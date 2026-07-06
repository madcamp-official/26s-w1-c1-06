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
      try {
        if (kind === "investor") {
          if (!positionId) throw new Error("포지션 ID가 필요합니다.");
          const { positions } = await listPositions("settled");
          const position = positions.find((p) => p.id === positionId);
          if (!position) {
            throw new Error("정산된 포지션을 찾을 수 없습니다.");
          }
          const { points } = await getStockChart(position.stockUserId);
          const chartPoint = points.find((p) => p.promiseId === position.promiseId);
          if (!chartPoint) {
            throw new Error("차트 데이터를 찾을 수 없습니다.");
          }
          const vm = buildInvestorResult(position, chartPoint, viewerId);
          if (!cancelled) setData(vm);
          await confirmSettlement("position", position.id);
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
          await confirmSettlement("participant", promiseId);
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
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [kind, positionId, promiseId, viewerId, viewerNickname]);

  return { data, loading, error };
}
