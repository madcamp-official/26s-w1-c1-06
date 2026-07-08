import type { ShopRarity } from "@latestock/shared";
import badgeEpic from "../assets/badges/epic.jpg";
import badgeLegendary from "../assets/badges/legendary.jpg";
import badgeMythic from "../assets/badges/mythic.jpg";
import badgeRare from "../assets/badges/rare.jpg";

interface ShopBadgeIconProps {
  rarity: ShopRarity;
  size?: number;
}

const RARITY_IMAGE: Record<ShopRarity, string> = {
  rare: badgeRare,
  epic: badgeEpic,
  legendary: badgeLegendary,
  mythic: badgeMythic,
};

const RARITY_GLOW: Record<ShopRarity, string> = {
  rare: "#60a5fa",
  epic: "#e879f9",
  legendary: "#ef4444",
  mythic: "#a78bfa",
};

/** 등급별 상점 배지 아이콘 (실제 디자인 배지 이미지). */
export function ShopBadgeIcon({ rarity, size = 40 }: ShopBadgeIconProps) {
  return (
    <img
      src={RARITY_IMAGE[rarity]}
      alt={`${rarity} 등급 배지`}
      width={size}
      height={size}
      style={{
        borderRadius: "50%",
        objectFit: "cover",
        filter: `drop-shadow(0 2px 6px ${RARITY_GLOW[rarity]}88)`,
      }}
    />
  );
}
