import type { TransactionView, TxType } from "../hooks/useAssets";

export type TxFilter = "all" | "lock" | "settlement";

export const TX_TYPE_META: Record<TxType, { label: string }> = {
  signup_grant: { label: "가입 지급" },
  position_lock: { label: "베팅 잠금" },
  position_unlock: { label: "잠금 해제" },
  position_payout: { label: "정산 손익" },
  defense_reward: { label: "정시 방어 보상" },
  self_stock_buy: { label: "자기주식 매수" },
  self_stock_sell: { label: "자기주식 매도" },
  option_premium: { label: "옵션 프리미엄" },
  option_payout: { label: "옵션 행사 배당" },
  shop_purchase: { label: "상점 구매" },
};

/**
 * "전체/잠금/정산" 필터 그룹 — F-14 자산 화면 탭.
 * signup_grant, self_stock_buy/sell, option_premium/option_payout, shop_purchase는
 * 잠금·정산 어느 쪽도 아니라 전체에서만 보임.
 */
const LOCK_TYPES: ReadonlySet<TxType> = new Set(["position_lock", "position_unlock"]);
const SETTLEMENT_TYPES: ReadonlySet<TxType> = new Set(["position_payout", "defense_reward"]);

export function matchesTxFilter(txType: TxType, filter: TxFilter): boolean {
  if (filter === "all") return true;
  if (filter === "lock") return LOCK_TYPES.has(txType);
  return SETTLEMENT_TYPES.has(txType);
}

export interface TransactionGroup {
  dateKey: string;
  dateLabel: string;
  transactions: TransactionView[];
}

/**
 * 날짜별 묶음(내림차순 입력 가정 — 백엔드가 이미 created_at DESC로 정렬해 줌).
 * 같은 날짜가 연속으로 오지 않는 입력에선 그룹이 여러 번 생길 수 있으니 호출 전 정렬 상태를 유지할 것.
 */
export function groupTransactionsByDate(
  transactions: readonly TransactionView[],
): TransactionGroup[] {
  const groups: TransactionGroup[] = [];
  let current: TransactionGroup | null = null;

  for (const tx of transactions) {
    const d = new Date(tx.createdAt);
    const dateKey = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

    if (!current || current.dateKey !== dateKey) {
      current = {
        dateKey,
        dateLabel: d.toLocaleDateString("ko-KR", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        transactions: [],
      };
      groups.push(current);
    }

    current.transactions.push(tx);
  }

  return groups;
}
