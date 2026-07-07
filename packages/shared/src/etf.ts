import type { PositionDirection } from "./types.js";

/**
 * ETF(S-03) — 여러 친구를 묶은 바스켓 주문.
 *
 * 정산 구조: 바스켓은 여러 개의 평범한 positions 행(leg)의 묶음일 뿐이다.
 * 각 leg는 그 leg가 걸린 약속이 정산될 때 기존 정산 엔진(settle-promise.ts)이
 * 그대로 처리한다 — 이 파일은 "추천 테마를 어떻게 고를지"만 순수 함수로 담당한다.
 */

export type EtfSide = "risky" | "safe";

export interface EtfThemeRule {
  key: string;
  side: EtfSide;
  groupSize: 3;
  /** risky=short 고정, safe=buy 고정 (바스켓 전체 단일 방향). */
  direction: PositionDirection;
  /** risky: 그룹 평균 ewma_late_p가 이 값 "이상"이어야 매치. safe: 이 값 "이하"여야 매치. */
  threshold: number;
  name: string;
  emoji: string;
}

/**
 * 추천 테마 고정 매핑 (P-4 톤 가드레일을 코드 구조로 보장 — 자유 텍스트 없음).
 * 각 side 안에서 심한 순서대로 나열한다: suggestEtfThemes가 위에서부터 첫 매치만 채택한다.
 * 새 테마를 추가할 때는 이 배열에 행만 추가하면 되고, 아래 함수 로직은 건드릴 필요가 없다.
 */
export const ETF_THEME_RULES: readonly EtfThemeRule[] = [
  {
    key: "risky-3-high",
    side: "risky",
    groupSize: 3,
    direction: "short",
    threshold: 0.6,
    name: "노답 3형제",
    emoji: "😱",
  },
  {
    key: "risky-3-mid",
    side: "risky",
    groupSize: 3,
    direction: "short",
    threshold: 0.4,
    name: "시한폭탄 트리오",
    emoji: "⏰",
  },
  {
    key: "safe-3-high",
    side: "safe",
    groupSize: 3,
    direction: "buy",
    threshold: 0.2,
    name: "원숭이도 나무에서 떨어진다",
    emoji: "🐒",
  },
  {
    key: "safe-3-mid",
    side: "safe",
    groupSize: 3,
    direction: "buy",
    threshold: 0.35,
    name: "모범생 클럽",
    emoji: "🛡️",
  },
] as const;

/** 직접 만들기 바스켓의 구성 종목 수 제한 (자유 값 — 구현 시 결정). */
export const ETF_BASKET_MIN_LEGS = 2;
export const ETF_BASKET_MAX_LEGS = 5;

export interface FriendLateStat {
  userId: string;
  ewmaLateP: number;
}

export interface EtfThemeSuggestion {
  key: string;
  name: string;
  emoji: string;
  direction: PositionDirection;
  memberUserIds: string[];
}

/**
 * 추천 ETF 테마 산정 (실시간 계산, 저장 안 함).
 *
 * candidates는 호출부가 이미 "지금 베팅 가능한 약속이 있는 친구"로 걸러서 넘겨야 한다
 * (추천했는데 못 사는 상황을 막기 위함 — 이 함수는 순위·임계값 계산만 담당).
 *
 * side(risky/safe)별로 규칙을 위에서부터 순서대로 시도해 첫 매치만 채택한다
 * (한 side당 테마 최대 1개 — 구간이 겹치는 여러 테마가 동시에 뜨지 않도록).
 */
export function suggestEtfThemes(
  candidates: readonly FriendLateStat[],
): EtfThemeSuggestion[] {
  const suggestions: EtfThemeSuggestion[] = [];

  for (const side of ["risky", "safe"] as const) {
    const sorted = [...candidates].sort((a, b) =>
      side === "risky" ? b.ewmaLateP - a.ewmaLateP : a.ewmaLateP - b.ewmaLateP,
    );
    const rules = ETF_THEME_RULES.filter((rule) => rule.side === side);

    for (const rule of rules) {
      if (sorted.length < rule.groupSize) continue;
      const group = sorted.slice(0, rule.groupSize);
      const avg =
        group.reduce((sum, f) => sum + f.ewmaLateP, 0) / group.length;
      const matched =
        side === "risky" ? avg >= rule.threshold : avg <= rule.threshold;
      if (matched) {
        suggestions.push({
          key: rule.key,
          name: rule.name,
          emoji: rule.emoji,
          direction: rule.direction,
          memberUserIds: group.map((f) => f.userId),
        });
        break;
      }
    }
  }

  return suggestions;
}
