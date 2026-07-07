import { useCallback, useEffect, useRef, useState } from "react";
import { getUnconfirmedSettlements } from "../lib/endpoints";
import type { UnconfirmedSettlements } from "../types/api";

interface UseUnconfirmedSettlementsResult {
  data: UnconfirmedSettlements | null;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * GET /me/unconfirmed-settlements — 미확인 정산 배너 데이터 (F-12).
 *
 * reload()는 폴링(예: AutoSettlementReveal의 20초 주기)으로 여러 번 호출될 수 있어,
 * 단순 useEffect cleanup의 cancelled 플래그로는 "먼저 시작했지만 늦게 도착한 응답"이
 * 최신 응답을 덮어쓰는 걸 막을 수 없다(그 가드는 effect 재실행/언마운트에만 반응하고
 * 외부에서 반복 호출되는 reload()는 감지하지 못함). 매 호출마다 증가하는 요청 ID로
 * "가장 마지막에 시작된 요청"만 상태에 반영되게 한다.
 */
export function useUnconfirmedSettlements(): UseUnconfirmedSettlementsResult {
  const [data, setData] = useState<UnconfirmedSettlements | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latestRequestRef = useRef(0);

  const reload = useCallback(() => {
    const requestId = ++latestRequestRef.current;
    setIsLoading(true);
    setError(null);

    getUnconfirmedSettlements()
      .then((result) => {
        if (latestRequestRef.current !== requestId) return;
        setData(result);
      })
      .catch((err) => {
        if (latestRequestRef.current !== requestId) return;
        setError(
          err instanceof Error ? err.message : "미확인 정산 정보를 불러오지 못했습니다.",
        );
      })
      .finally(() => {
        if (latestRequestRef.current !== requestId) return;
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    reload();
    return () => {
      // 언마운트 이후 도착하는 응답은 어떤 요청 ID와도 일치하지 않게 무효화한다.
      latestRequestRef.current = -1;
    };
  }, [reload]);

  return { data, isLoading, error, reload };
}
