import { describe, expect, it } from "vitest";
import { maskParticipants } from "./masking.js";
import type { ParticipantView } from "../types.js";

const promisedAt = new Date("2026-07-04T12:00:00Z");
const beforeDeadline = new Date("2026-07-04T11:30:00Z");
const afterDeadline = new Date("2026-07-04T12:30:00Z");
const checkinAt = new Date("2026-07-04T11:20:00Z");

const participants: ParticipantView[] = [
  {
    userId: "me",
    displayName: "나",
    inviteStatus: "accepted",
    checkinAt,
    isFriendOfViewer: false,
  },
  {
    userId: "friend",
    displayName: "친구",
    inviteStatus: "accepted",
    checkinAt,
    isFriendOfViewer: true,
  },
  {
    userId: "stranger",
    displayName: "비친구",
    inviteStatus: "accepted",
    checkinAt,
    isFriendOfViewer: false,
  },
];

describe("maskParticipants (M0-5 가드 b, R-1/R-5)", () => {
  it("약속 시각 전에는 타인의 checkin_at을 마스킹한다", () => {
    const result = maskParticipants(participants, "me", promisedAt, beforeDeadline);
    const friend = result.find((r) => r.userId === "friend")!;
    expect(friend.checkinAt).toBeNull();
    expect(friend.checkinMasked).toBe(true);
  });

  it("본인 인증 상태는 마감 전에도 항상 보인다", () => {
    const result = maskParticipants(participants, "me", promisedAt, beforeDeadline);
    const me = result.find((r) => r.userId === "me")!;
    expect(me.checkinAt).toEqual(checkinAt);
    expect(me.checkinMasked).toBe(false);
  });

  it("약속 시각 후에는 전체 공개", () => {
    const result = maskParticipants(participants, "me", promisedAt, afterDeadline);
    for (const r of result) {
      expect(r.checkinMasked).toBe(false);
      expect(r.checkinAt).toEqual(checkinAt);
    }
  });

  it("비친구 참여자는 베팅 진입점이 없다 (R-5)", () => {
    const result = maskParticipants(participants, "me", promisedAt, afterDeadline);
    expect(result.find((r) => r.userId === "friend")!.bettable).toBe(true);
    expect(result.find((r) => r.userId === "stranger")!.bettable).toBe(false);
    expect(result.find((r) => r.userId === "me")!.bettable).toBe(false);
  });
});
