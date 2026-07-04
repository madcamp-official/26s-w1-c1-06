import { describe, expect, it } from "vitest";
import {
  haversineMeters,
  withinCheckinRadius,
  isCheckinWindowOpen,
  canCheckin,
} from "./location.js";
import type { LatLng } from "../types.js";

// KAIST 본관 부근 기준점.
const origin: LatLng = { lat: 36.3721, lng: 127.3604 };

describe("haversineMeters / withinCheckinRadius (M0-5 가드 c)", () => {
  it("같은 좌표는 거리 0", () => {
    expect(haversineMeters(origin, origin)).toBeCloseTo(0, 5);
  });

  it("약 30m 떨어진 점은 반경 50m 이내", () => {
    // 위도 1도 ≈ 111,320m → 30m ≈ 0.00027도
    const near: LatLng = { lat: origin.lat + 0.00027, lng: origin.lng };
    expect(haversineMeters(origin, near)).toBeLessThan(50);
    expect(withinCheckinRadius(origin, near)).toBe(true);
  });

  it("약 100m 떨어진 점은 반경 밖", () => {
    const far: LatLng = { lat: origin.lat + 0.0009, lng: origin.lng };
    expect(haversineMeters(origin, far)).toBeGreaterThan(50);
    expect(withinCheckinRadius(origin, far)).toBe(false);
  });
});

describe("isCheckinWindowOpen (F-05)", () => {
  const createdAt = new Date("2026-07-04T10:00:00Z");
  const settleDueAt = new Date("2026-07-04T13:00:00Z"); // 약속12:00 + 60분

  it("구간 내이면 열림 (조기 도착 포함)", () => {
    expect(
      isCheckinWindowOpen(new Date("2026-07-04T11:00:00Z"), createdAt, settleDueAt),
    ).toBe(true);
  });

  it("생성 전이면 닫힘", () => {
    expect(
      isCheckinWindowOpen(new Date("2026-07-04T09:59:00Z"), createdAt, settleDueAt),
    ).toBe(false);
  });

  it("종료 시각 이후이면 닫힘 (노쇼 확정)", () => {
    expect(
      isCheckinWindowOpen(new Date("2026-07-04T13:00:01Z"), createdAt, settleDueAt),
    ).toBe(false);
  });
});

describe("canCheckin 종합 가드", () => {
  const base = {
    now: new Date("2026-07-04T11:00:00Z"),
    createdAt: new Date("2026-07-04T10:00:00Z"),
    settleDueAt: new Date("2026-07-04T13:00:00Z"),
    promisedLocation: origin,
    checkinLocation: { lat: origin.lat + 0.00027, lng: origin.lng },
    isAcceptedParticipant: true,
  };

  it("수락 참여자 · 구간 내 · 반경 내면 허용", () => {
    expect(canCheckin(base)).toEqual({ allowed: true });
  });

  it("미수락자는 거부", () => {
    expect(canCheckin({ ...base, isAcceptedParticipant: false })).toEqual({
      allowed: false,
      reason: "not_participant",
    });
  });

  it("종료 후는 거부", () => {
    expect(
      canCheckin({ ...base, now: new Date("2026-07-04T13:30:00Z") }),
    ).toEqual({ allowed: false, reason: "out_of_window" });
  });

  it("반경 밖은 거부", () => {
    expect(
      canCheckin({
        ...base,
        checkinLocation: { lat: origin.lat + 0.0009, lng: origin.lng },
      }),
    ).toEqual({ allowed: false, reason: "out_of_radius" });
  });
});
