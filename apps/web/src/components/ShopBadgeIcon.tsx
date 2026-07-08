import type { ShopItemType, ShopRarity } from "@latestock/shared";
import titleEpic from "../assets/badges/epic.jpg";
import titleLegendary from "../assets/badges/legendary.jpg";
import titleMythic from "../assets/badges/mythic.jpg";
import titleRare from "../assets/badges/rare.jpg";
import rankAnt from "../assets/rank-badges/ant.png";
import rankFireAnt from "../assets/rank-badges/fire-ant.png";
import rankInstitution from "../assets/rank-badges/institution.png";
import rankKingAnt from "../assets/rank-badges/king-ant.png";
import rankStockMaster from "../assets/rank-badges/stock-master.png";
import rankSuperAnt from "../assets/rank-badges/super-ant.png";
import rankWarrenBuffett from "../assets/rank-badges/warren-buffett.png";
import rankWorkerAnt from "../assets/rank-badges/worker-ant.png";
import rankYeouidoShark from "../assets/rank-badges/yeouido-shark.png";

interface ShopBadgeIconProps {
  item: { key: string; type: ShopItemType; rarity: ShopRarity };
  size?: number;
}

/** 배지(badge)는 9단계 군 계급 컨셉이라 등급이 아니라 항목 키로 정확히 한 장씩 매칭한다. */
const RANK_BADGE_IMAGE: Record<string, string> = {
  badge_ant: rankAnt,
  badge_worker_ant: rankWorkerAnt,
  badge_fire_ant: rankFireAnt,
  badge_king_ant: rankKingAnt,
  badge_super_ant: rankSuperAnt,
  badge_institution: rankInstitution,
  badge_yeouido_shark: rankYeouidoShark,
  badge_stock_master: rankStockMaster,
  badge_warren_buffett: rankWarrenBuffett,
};

/** 칭호(title)는 기존처럼 등급별 공통 아이콘 하나를 재사용한다. */
const TITLE_RARITY_IMAGE: Record<ShopRarity, string> = {
  rare: titleRare,
  epic: titleEpic,
  legendary: titleLegendary,
  mythic: titleMythic,
};

const TITLE_RARITY_GLOW: Record<ShopRarity, string> = {
  rare: "#60a5fa",
  epic: "#e879f9",
  legendary: "#ef4444",
  mythic: "#a78bfa",
};

/** 상점 아이콘 — 배지는 계급장 이미지 원본 그대로, 칭호는 등급별 공용 아이콘(원형 크롭). */
export function ShopBadgeIcon({ item, size = 40 }: ShopBadgeIconProps) {
  if (item.type === "badge") {
    const src = RANK_BADGE_IMAGE[item.key];
    if (!src) return null;
    return (
      <img
        src={src}
        alt={item.key}
        style={{
          width: size,
          height: size,
          objectFit: "contain",
          filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.35))",
        }}
      />
    );
  }

  const src = TITLE_RARITY_IMAGE[item.rarity];
  return (
    <img
      src={src}
      alt={`${item.rarity} 등급 칭호`}
      width={size}
      height={size}
      style={{
        borderRadius: "50%",
        objectFit: "cover",
        filter: `drop-shadow(0 2px 6px ${TITLE_RARITY_GLOW[item.rarity]}88)`,
      }}
    />
  );
}
