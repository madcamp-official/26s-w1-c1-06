import { useCallback, useEffect, useState } from "react";
import { getUnconfirmedSettlements } from "../lib/endpoints";
import type { UnconfirmedSettlements } from "../types/api";

interface UseUnconfirmedSettlementsResult {
  data: UnconfirmedSettlements | null;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

/** GET /me/unconfirmed-settlements — 미확인 정산 배너 데이터 (F-12). */
export function useUnconfirmedSettlements(): UseUnconfirmedSettlementsResult {
  const [data, setData] = useState<UnconfirmedSettlements | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setIsLoading(true);
    setError(null);

    getUnconfirmedSettlements()
      .then((result) => {
        setData(result);
      })
      .catch((err) => {
        setError(
          err instanceof Error ? err.message : "미확인 정산 정보를 불러오지 못했습니다.",
        );
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, isLoading, error, reload };
}
