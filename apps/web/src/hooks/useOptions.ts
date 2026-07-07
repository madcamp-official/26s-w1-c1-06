import { useCallback, useEffect, useState } from "react";
import { listOptions } from "../lib/endpoints";
import type { OptionPositionView } from "../types/api";

interface UseOptionsResult {
  options: OptionPositionView[];
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

/** 보유(미정산) 옵션 목록 (S-04). */
export function useOptions(): UseOptionsResult {
  const [options, setOptions] = useState<OptionPositionView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setError(null);
    listOptions("open")
      .then(({ options: items }) => setOptions(items))
      .catch((err) => {
        setError(err instanceof Error ? err.message : "보유 옵션을 불러오지 못했습니다.");
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { options, isLoading, error, reload };
}
