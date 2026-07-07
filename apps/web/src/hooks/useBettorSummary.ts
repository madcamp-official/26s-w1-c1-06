import { useCallback, useEffect, useState } from "react";
import { getBettorSummary } from "../lib/endpoints";
import type { BettorSummary } from "../types/api";

interface UseBettorSummaryResult {
  summary: BettorSummary | null;
  isLoading: boolean;
  reload: () => void;
}

/** 선택된 종목·약속 조합의 베팅 현황 (M6-5). 종목·약속이 바뀌거나 reload() 호출 시 다시 조회한다. */
export function useBettorSummary(
  stockUserId: string | undefined,
  promiseId: string | undefined,
): UseBettorSummaryResult {
  const [summary, setSummary] = useState<BettorSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!stockUserId || !promiseId) {
      setSummary(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    getBettorSummary(stockUserId, promiseId)
      .then((result) => {
        if (!cancelled) setSummary(result);
      })
      .catch(() => {
        if (!cancelled) setSummary(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [stockUserId, promiseId, reloadKey]);

  return { summary, isLoading, reload };
}
