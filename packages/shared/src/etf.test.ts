import { describe, expect, it } from "vitest";
import { suggestEtfThemes, type FriendLateStat } from "./etf.js";

function friend(userId: string, ewmaLateP: number): FriendLateStat {
  return { userId, ewmaLateP };
}

describe("suggestEtfThemes", () => {
  it("친구 4명 — risky 3인 중간 구간(시한폭탄 트리오) + safe 1인 극단(등대지기) 매치", () => {
    const candidates = [
      friend("영희", 0.68),
      friend("민수", 0.52),
      friend("지훈", 0.3),
      friend("수아", 0.08),
    ];
    const result = suggestEtfThemes(candidates);

    expect(result).toHaveLength(2);

    const risky = result.find((s) => s.key === "risky-3-mid");
    expect(risky).toBeDefined();
    expect(risky?.direction).toBe("short");
    expect(risky?.memberUserIds).toEqual(["영희", "민수", "지훈"]);

    const safe = result.find((s) => s.key === "safe-1-extreme");
    expect(safe).toBeDefined();
    expect(safe?.direction).toBe("buy");
    expect(safe?.memberUserIds).toEqual(["수아"]);
  });

  it("평균이 임계값에 정확히 같으면 매치(경계값, >=)", () => {
    // risky-3-high 임계값 0.6 — 평균이 정확히 0.6
    const candidates = [friend("a", 0.7), friend("b", 0.6), friend("c", 0.5)];
    const result = suggestEtfThemes(candidates);
    expect(result.some((s) => s.key === "risky-3-high")).toBe(true);
  });

  it("친구 수가 그룹 크기보다 적으면 해당 규모의 규칙은 전부 건너뛴다", () => {
    // 2명뿐이라 groupSize=3 규칙(대부분)은 스킵되고 groupSize=1만 시도된다.
    const candidates = [friend("a", 0.9), friend("b", 0.85)];
    const result = suggestEtfThemes(candidates);

    const risky = result.find((s) => s.direction === "short");
    expect(risky?.key).toBe("risky-1-extreme");
    expect(risky?.memberUserIds).toEqual(["a"]);
  });

  it("아무 임계값도 못 넘으면 해당 side는 추천이 아예 없다", () => {
    // 다들 무난한 중간값 — 어떤 규칙도 매치 안 됨
    const candidates = [friend("a", 0.5), friend("b", 0.45), friend("c", 0.5)];
    const result = suggestEtfThemes(candidates);

    // risky 쪽: 3인 평균 0.483... < 0.6이지만 >= 0.4라서 risky-3-mid는 매치됨을 확인
    expect(result.some((s) => s.key === "risky-3-mid")).toBe(true);
    // safe 쪽: 3인 평균 0.483...은 어떤 safe 임계값(<=0.35)도 못 넘으므로 safe(buy)는 없음
    expect(result.some((s) => s.direction === "buy")).toBe(false);
  });

  it("후보가 아예 없으면 추천도 없다", () => {
    expect(suggestEtfThemes([])).toEqual([]);
  });

  it("같은 side 안에서는 그룹 크기가 다른 최대 1개 테마만 채택한다", () => {
    const candidates = [
      friend("a", 0.9),
      friend("b", 0.85),
      friend("c", 0.8),
    ];
    const result = suggestEtfThemes(candidates);
    const riskyMatches = result.filter((s) => s.direction === "short");
    expect(riskyMatches).toHaveLength(1);
    // 1인 극단(0.75 이상)이 3인 규칙보다 먼저 검사되므로 이게 채택된다.
    expect(riskyMatches[0]?.key).toBe("risky-1-extreme");
  });
});
