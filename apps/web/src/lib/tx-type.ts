import type { TxType } from "../hooks/useAssets";

export type TxFilter = "all" | "lock" | "settlement";

export const TX_TYPE_META: Record<TxType, { label: string; icon: string }> = {
  signup_grant: { label: "가입 지급", icon: "🎁" },
  position_lock: { label: "베팅 잠금", icon: "🔒" },
  position_unlock: { label: "잠금 해제", icon: "🔓" },
  position_payout: { label: "정산 손익", icon: "💹" },
  defense_reward: { label: "정시 방어 보상", icon: "🛡️" },
  self_stock_buy: { label: "자기주식 매수", icon: "🏷️" },
  self_stock_sell: { label: "자기주식 매도", icon: "💵" },
};

/**
 * "전체/잠금/정산" 필터 그룹 — F-14 자산 화면 탭.
 * signup_grant, self_stock_buy/sell은 잠금·정산 어느 쪽도 아니라 전체에서만 보임.
 */
const LOCK_TYPES: ReadonlySet<TxType> = new Set(["position_lock", "position_unlock"]);
const SETTLEMENT_TYPES: ReadonlySet<TxType> = new Set(["position_payout", "defense_reward"]);

export function matchesTxFilter(txType: TxType, filter: TxFilter): boolean {
  if (filter === "all") return true;
  if (filter === "lock") return LOCK_TYPES.has(txType);
  return SETTLEMENT_TYPES.has(txType);
}
