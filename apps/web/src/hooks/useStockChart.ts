import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

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

/** 본인(userId 미지정) 또는 친구(userId 지정) 차트 데이터를 가져온다. */
export function useStockChart(userId?: string): UseStockChartResult {
  const [data, setData] = useState<ChartPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const path = userId ? `/api/stocks/${userId}` : "/api/me/stock";
    apiFetch<{ points: ChartPoint[] }>(path)
      .then(({ points }) => {
        if (!cancelled) setData(points);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "차트를 불러오지 못했습니다.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { data, isLoading, error };
}
