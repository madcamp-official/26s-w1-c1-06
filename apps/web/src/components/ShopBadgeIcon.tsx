import { useId } from "react";
import type { ShopRarity } from "@latestock/shared";

interface ShopBadgeIconProps {
  rarity: ShopRarity;
  size?: number;
}

const RARITY_CONFIG: Record<
  ShopRarity,
  { shape: "diamond" | "shield" | "star" | "circle"; from: string; to: string; glow: string }
> = {
  rare: { shape: "diamond", from: "#93c5fd", to: "#1d4ed8", glow: "#60a5fa" },
  epic: { shape: "shield", from: "#d8b4fe", to: "#7c3aed", glow: "#a78bfa" },
  legendary: { shape: "star", from: "#fde68a", to: "#d97706", glow: "#fbbf24" },
  mythic: { shape: "circle", from: "#fbcfe8", to: "#818cf8", glow: "#f472b6" },
};

function shapePath(shape: "diamond" | "shield" | "star" | "circle"): string {
  switch (shape) {
    case "diamond":
      return "M50 6 L88 50 L50 94 L12 50 Z";
    case "shield":
      return "M50 6 L86 18 V50 C86 74 70 90 50 96 C30 90 14 74 14 50 V18 Z";
    case "star":
      return "M50 4 L61 36 L96 36 L68 57 L79 92 L50 71 L21 92 L32 57 L4 36 L39 36 Z";
    case "circle":
      return "";
  }
}

/** 참고 이미지(보석·별·방패·홀로그램 배지 콜라주) 톤을 CSS 그라디언트로 재현한 등급별 상점 아이콘. */
export function ShopBadgeIcon({ rarity, size = 40 }: ShopBadgeIconProps) {
  const gradientId = `shop-badge-gradient-${useId()}`;
  const highlightId = `shop-badge-highlight-${useId()}`;
  const config = RARITY_CONFIG[rarity];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={`${rarity} 등급 배지`}
      style={{ filter: `drop-shadow(0 2px 6px ${config.glow}88)` }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={config.from} />
          <stop offset="100%" stopColor={config.to} />
        </linearGradient>
        <radialGradient id={highlightId} cx="35%" cy="25%" r="60%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0.85} />
          <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
        </radialGradient>
      </defs>

      {config.shape === "circle" ? (
        <circle cx="50" cy="50" r="46" fill={`url(#${gradientId})`} />
      ) : (
        <path d={shapePath(config.shape)} fill={`url(#${gradientId})`} />
      )}

      {config.shape === "circle" ? (
        <circle cx="50" cy="50" r="46" fill={`url(#${highlightId})`} />
      ) : (
        <path d={shapePath(config.shape)} fill={`url(#${highlightId})`} />
      )}
    </svg>
  );
}
