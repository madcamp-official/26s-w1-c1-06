import type { ShopItemType, ShopRarity } from "./types.js";

export interface ShopItemDef {
  key: string;
  label: string;
  type: ShopItemType;
  rarity: ShopRarity;
  price: number;
}

/** 칭호 카탈로그 — 순수 과시용 소비처(P-4 톤 가드레일 안에서 재미 요소). */
export const SHOP_TITLES: ShopItemDef[] = [
  { key: "title_destiny_ant", label: "운명의 개미", type: "title", rarity: "rare", price: 20_000 },
  { key: "title_prophet", label: "예언자", type: "title", rarity: "epic", price: 50_000 },
  { key: "title_legendary_trader", label: "전설의 트레이더", type: "title", rarity: "legendary", price: 90_000 },
  { key: "title_warren_buffett", label: "지각주의 워렌버핏", type: "title", rarity: "legendary", price: 100_000 },
  { key: "title_market_ruler", label: "시장을 지배하는 자", type: "title", rarity: "mythic", price: 200_000 },
];

/** 배지 카탈로그 — 칭호와 동일한 등급 체계를 공유(가격은 절반 수준). */
export const SHOP_BADGES: ShopItemDef[] = [
  { key: "badge_sprout", label: "새싹 뱃지", type: "badge", rarity: "rare", price: 10_000 },
  { key: "badge_analyst", label: "분석가 뱃지", type: "badge", rarity: "epic", price: 25_000 },
  { key: "badge_legend", label: "레전드 뱃지", type: "badge", rarity: "legendary", price: 45_000 },
  { key: "badge_market_ruler", label: "시장지배자 뱃지", type: "badge", rarity: "mythic", price: 100_000 },
];

export const SHOP_ITEMS: ShopItemDef[] = [...SHOP_TITLES, ...SHOP_BADGES];

export function findShopItem(key: string): ShopItemDef | undefined {
  return SHOP_ITEMS.find((item) => item.key === key);
}
