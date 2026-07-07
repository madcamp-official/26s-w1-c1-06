import { useEffect, useState } from "react";
import { getUnconfirmedSettlements } from "../lib/endpoints";
import type { UnconfirmedSettlements } from "../types/api";

interface UseUnconfirmedSettlementsResult {
  data: UnconfirmedSettlements | null;
  isLoading: boolean;
  error: string | null;
}

/** GET /me/unconfirmed-settlements — 미확인 정산 배너 데이터 (F-12). */
export function useUnconfirmedSettlements(): UseUnconfirmedSettlementsResult {
  const [data, setData] = useState<UnconfirmedSettlements | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    getUnconfirmedSettlements()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "미확인 정산 정보를 불러오지 못했습니다.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { data, isLoading, error };
}
