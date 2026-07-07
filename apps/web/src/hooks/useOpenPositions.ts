import { computePayout } from "@latestock/shared";
import { useCallback, useEffect, useState } from "react";
import { listFriends, listPositions } from "../lib/endpoints";
import type { PositionView } from "../types/api";

export interface OpenPositionRow extends PositionView {
  currentPrice: number;
  unrealizedPayout: number;
}

interface UseOpenPositionsResult {
  positions: OpenPositionRow[];
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

/** 보유(미정산) 포지션 + 평가손익 (M2-1). */
export function useOpenPositions(): UseOpenPositionsResult {
  const [positions, setPositions] = useState<OpenPositionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setError(null);
    Promise.all([listPositions("open"), listFriends()])
      .then(([{ positions: openPositions }, { friends }]) => {
        const priceByStock = new Map(friends.map((f) => [f.userId, f.currentPrice]));
        const rows = openPositions.map((p) => {
          const currentPrice = priceByStock.get(p.stockUserId) ?? p.openPrice;
          return {
            ...p,
            currentPrice,
            unrealizedPayout: computePayout(
              p.direction,
              p.quantity,
              p.openPrice,
              currentPrice,
              p.lockedPoints,
            ),
          };
        });
        setPositions(rows);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "보유 포지션을 불러오지 못했습니다.");
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { positions, isLoading, error, reload };
}
