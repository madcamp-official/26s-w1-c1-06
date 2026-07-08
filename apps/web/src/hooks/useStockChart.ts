import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { usePolling } from "./usePolling";

export type Verdict = "on_time" | "late" | "no_show";

export interface ChartPoint {
  promiseId: string;
  promisedAt: string;
  verdict: Verdict;
  lateMinutes: number;
  settledPrice: number;
}

interface UseStockChartResult {
  data: ChartPoint[];
  isLoading: boolean;
  error: string | null;
}

const POLL_INTERVAL_MS = 3000;

/**
 * 본인(userId 미지정) 또는 친구(userId 지정) 차트 데이터를 가져온다.
 * 3초 폴링 — 다른 창에서 체결·정산이 일어나도 새로고침 없이 곧 반영되도록 한다.
 */
export function useStockChart(userId?: string): UseStockChartResult {
  const [data, setData] = useState<ChartPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    (isInitial: boolean) => {
      if (isInitial) setIsLoading(true);
      const path = userId ? `/api/stocks/${userId}` : "/api/me/stock";
      apiFetch<{ points: ChartPoint[] }>(path)
        .then(({ points }) => {
          setData(points);
          setError(null);
        })
        .catch((err) => {
          if (isInitial) {
            setError(err instanceof Error ? err.message : "차트를 불러오지 못했습니다.");
          }
        })
        .finally(() => {
          if (isInitial) setIsLoading(false);
        });
    },
    [userId],
  );

  useEffect(() => {
    load(true);
  }, [load]);

  usePolling(() => load(false), POLL_INTERVAL_MS);

  return { data, isLoading, error };
}
