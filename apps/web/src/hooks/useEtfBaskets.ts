import { useCallback, useEffect, useState } from "react";
import { listEtfBaskets } from "../lib/endpoints";
import type { EtfBasketView } from "../types/api";

interface UseEtfBasketsResult {
  baskets: EtfBasketView[];
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

/** 내 ETF 바스켓 목록 (S-03). status를 안 주면 전체(진행중+정산완료) 조회. */
export function useEtfBaskets(status?: "open" | "settled"): UseEtfBasketsResult {
  const [baskets, setBaskets] = useState<EtfBasketView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setError(null);
    listEtfBaskets(status)
      .then(({ baskets: items }) => setBaskets(items))
      .catch((err) => {
        setError(err instanceof Error ? err.message : "ETF 바스켓을 불러오지 못했습니다.");
      })
      .finally(() => setIsLoading(false));
  }, [status]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { baskets, isLoading, error, reload };
}
