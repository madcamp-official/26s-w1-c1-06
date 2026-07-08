import type { ShopItemType, ShopRarity } from "./types.js";

export interface ShopItemDef {
  key: string;
  label: string;
  type: ShopItemType;
  rarity: ShopRarity;
  price: number;
  /** 배지 전용 — 순서상 이 값(tier-1)을 가진 배지를 먼저 사야 구매 가능(순차 구매). 칭호는 없음. */
  tier?: number;
}

/** 칭호 카탈로그 — 순수 과시용 소비처(P-4 톤 가드레일 안에서 재미 요소). */
export const SHOP_TITLES: ShopItemDef[] = [
  { key: "title_destiny_ant", label: "운명의 개미", type: "title", rarity: "rare", price: 20_000 },
  { key: "title_prophet", label: "예언자", type: "title", rarity: "epic", price: 50_000 },
  { key: "title_legendary_trader", label: "전설의 트레이더", type: "title", rarity: "legendary", price: 90_000 },
  { key: "title_warren_buffett", label: "지각주의 워렌버핏", type: "title", rarity: "legendary", price: 100_000 },
  { key: "title_market_ruler", label: "시장을 지배하는 자", type: "title", rarity: "mythic", price: 200_000 },
];

/**
 * 배지 카탈로그 — 군 계급 컨셉의 9단계 진급 체계(개미→원수). tier 순서대로만 구매 가능
 * (이전 tier를 보유해야 다음 tier 구매 가능 — services/shop.ts purchaseShopItem에서 강제).
 */
export const SHOP_BADGES: ShopItemDef[] = [
  { key: "badge_ant", label: "개미", type: "badge", rarity: "rare", price: 5_000, tier: 1 },
  { key: "badge_worker_ant", label: "일개미", type: "badge", rarity: "rare", price: 12_000, tier: 2 },
  { key: "badge_fire_ant", label: "불개미", type: "badge", rarity: "epic", price: 25_000, tier: 3 },
  { key: "badge_king_ant", label: "왕개미", type: "badge", rarity: "epic", price: 45_000, tier: 4 },
  { key: "badge_super_ant", label: "슈퍼개미", type: "badge", rarity: "legendary", price: 80_000, tier: 5 },
  { key: "badge_institution", label: "기관", type: "badge", rarity: "legendary", price: 140_000, tier: 6 },
  { key: "badge_yeouido_shark", label: "여의도 타짜", type: "badge", rarity: "mythic", price: 220_000, tier: 7 },
  { key: "badge_stock_master", label: "주식도사", type: "badge", rarity: "mythic", price: 350_000, tier: 8 },
  { key: "badge_warren_buffett", label: "워렌버핏", type: "badge", rarity: "mythic", price: 550_000, tier: 9 },
];

export const SHOP_ITEMS: ShopItemDef[] = [...SHOP_TITLES, ...SHOP_BADGES];

export function findShopItem(key: string): ShopItemDef | undefined {
  return SHOP_ITEMS.find((item) => item.key === key);
}
