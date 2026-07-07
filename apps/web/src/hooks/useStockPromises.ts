import { useEffect, useState } from "react";
import { getStockPromises } from "../lib/endpoints";
import type { BettablePromiseView } from "../types/api";

interface UseStockPromisesResult {
  promises: BettablePromiseView[];
  isLoading: boolean;
  error: string | null;
}

/** 선택된 종목(친구)에게 베팅 가능한 약속 목록 (M3-1). */
export function useStockPromises(stockUserId: string | undefined): UseStockPromisesResult {
  const [promises, setPromises] = useState<BettablePromiseView[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!stockUserId) {
      setPromises([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    getStockPromises(stockUserId)
      .then(({ promises: items }) => {
        if (!cancelled) setPromises(items);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "약속 목록을 불러오지 못했습니다.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [stockUserId]);

  return { promises, isLoading, error };
}
