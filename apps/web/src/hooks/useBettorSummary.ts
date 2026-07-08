import { useCallback, useEffect, useState } from "react";
import { getBettorSummary } from "../lib/endpoints";
import type { BettorSummary } from "../types/api";
import { usePolling } from "./usePolling";

interface UseBettorSummaryResult {
  summary: BettorSummary | null;
  isLoading: boolean;
  reload: () => void;
}

const POLL_INTERVAL_MS = 3000;

/**
 * 선택한 종목·약속 조합의 베팅 현황 (M6-5).
 * 3초 폴링 — 다른 창에서 베팅이 들어오면 새로고침 없이 곧 숫자가 갱신되도록 한다.
 */
export function useBettorSummary(
  stockUserId: string | undefined,
  promiseId: string | undefined,
): UseBettorSummaryResult {
  const [summary, setSummary] = useState<BettorSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  const fetchSummary = useCallback(
    (isInitial: boolean) => {
      if (!stockUserId || !promiseId) {
        setSummary(null);
        return;
      }
      if (isInitial) setIsLoading(true);
      getBettorSummary(stockUserId, promiseId)
        .then((result) => setSummary(result))
        .catch(() => {
          if (isInitial) setSummary(null);
        })
        .finally(() => {
          if (isInitial) setIsLoading(false);
        });
    },
    [stockUserId, promiseId],
  );

  useEffect(() => {
    fetchSummary(true);
  }, [fetchSummary, reloadKey]);

  usePolling(() => fetchSummary(false), POLL_INTERVAL_MS);

  return { summary, isLoading, reload };
}
