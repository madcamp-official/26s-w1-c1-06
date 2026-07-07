import { useCallback, useEffect, useState } from "react";
import { getFriendActivityFeed } from "../lib/endpoints";
import type { FriendActivityItem } from "../types/api";

interface UseFriendActivityFeedResult {
  items: FriendActivityItem[];
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

/** 나·친구의 최근 정산 소식 (M6-6). */
export function useFriendActivityFeed(): UseFriendActivityFeedResult {
  const [items, setItems] = useState<FriendActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setIsLoading(true);
    setError(null);
    getFriendActivityFeed()
      .then(({ items: result }) => setItems(result))
      .catch((err) => {
        setError(err instanceof Error ? err.message : "소식을 불러오지 못했습니다.");
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { items, isLoading, error, reload: load };
}
