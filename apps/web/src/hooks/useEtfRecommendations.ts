import { useCallback, useEffect, useState } from "react";
import { getEtfRecommendations } from "../lib/endpoints";
import type { EtfRecommendationView } from "../types/api";

interface UseEtfRecommendationsResult {
  recommendations: EtfRecommendationView[];
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

/** 추천 ETF (실시간 계산, 저장 안 함 — S-03). */
export function useEtfRecommendations(): UseEtfRecommendationsResult {
  const [recommendations, setRecommendations] = useState<EtfRecommendationView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setError(null);
    getEtfRecommendations()
      .then(({ recommendations: items }) => setRecommendations(items))
      .catch((err) => {
        setError(err instanceof Error ? err.message : "추천 ETF를 불러오지 못했습니다.");
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { recommendations, isLoading, error, reload };
}
