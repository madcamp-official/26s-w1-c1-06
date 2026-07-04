import { describe, expect, it } from "vitest";
import { isBettable, filterBettable } from "./betting.js";
import type { BettableContext } from "../types.js";

const now = new Date("2026-07-04T12:00:00Z");
const future = new Date("2026-07-04T13:00:00Z");
const past = new Date("2026-07-04T11:00:00Z");

function ctx(overrides: Partial<BettableContext> = {}): BettableContext {
  return {
    isFriendAccepted: true,
    targetInviteStatus: "accepted",
    promisedAt: future,
    isSelf: false,
    ...overrides,
  };
}

describe("isBettable (M0-5 가드 a)", () => {
  it("친구·수락참여·마감 전이면 베팅 가능", () => {
    expect(isBettable(ctx(), now)).toBe(true);
  });

  it("자기주식은 베팅 불가 (P-5)", () => {
    expect(isBettable(ctx({ isSelf: true }), now)).toBe(false);
  });

  it("친구가 아니면 불가", () => {
    expect(isBettable(ctx({ isFriendAccepted: false }), now)).toBe(false);
  });

  it("수락 참여자가 아니면 불가 (F-19)", () => {
    expect(isBettable(ctx({ targetInviteStatus: "invited" }), now)).toBe(false);
    expect(isBettable(ctx({ targetInviteStatus: "declined" }), now)).toBe(false);
    expect(isBettable(ctx({ targetInviteStatus: "auto_declined" }), now)).toBe(
      false,
    );
  });

  it("마감(약속 시각) 이후이면 불가 — 확정 정보 베팅 차단", () => {
    expect(isBettable(ctx({ promisedAt: past }), now)).toBe(false);
  });

  it("약속 시각 정각(경계)은 불가 (promised_at > now 엄격)", () => {
    expect(isBettable(ctx({ promisedAt: now }), now)).toBe(false);
  });

  it("filterBettable는 마감된 약속을 제외한다", () => {
    const items = [ctx(), ctx({ promisedAt: past }), ctx({ isSelf: true })];
    expect(filterBettable(items, now)).toHaveLength(1);
  });
});
