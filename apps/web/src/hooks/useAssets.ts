import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

export type TxType =
  | "signup_grant"
  | "position_lock"
  | "position_unlock"
  | "position_payout"
  | "defense_reward"
  | "self_stock_buy"
  | "self_stock_sell";

export interface AssetSummary {
  availablePoints: number;
  lockedPoints: number;
}

export interface TransactionView {
  id: string;
  amount: number;
  txType: TxType;
  refId: string | null;
  createdAt: string;
}

interface UseAssetsResult {
  summary: AssetSummary | null;
  transactions: TransactionView[];
  isLoading: boolean;
  error: string | null;
}

/** GET /me/assets, GET /me/transactions — 자산 화면(SC-14/15) 데이터 (F-14). */
export function useAssets(): UseAssetsResult {
  const [summary, setSummary] = useState<AssetSummary | null>(null);
  const [transactions, setTransactions] = useState<TransactionView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    Promise.all([
      apiFetch<AssetSummary>("/api/me/assets"),
      apiFetch<{ transactions: TransactionView[] }>("/api/me/transactions"),
    ])
      .then(([assetSummary, { transactions: txs }]) => {
        if (cancelled) return;
        setSummary(assetSummary);
        setTransactions(txs);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "자산 정보를 불러오지 못했습니다.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { summary, transactions, isLoading, error };
}
