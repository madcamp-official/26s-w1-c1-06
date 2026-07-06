import { useEffect, useState } from "react";
import { listPromises } from "../lib/endpoints";
import type { PromiseView } from "../types/api";

/** 베팅에 쓸 수 있는 예정 약속 목록. */
export function useUpcomingPromises() {
  const [promises, setPromises] = useState<PromiseView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    listPromises("upcoming")
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
  }, []);

  return { promises, isLoading, error };
}
