import { describe, expect, it } from "vitest";
import { computePayout } from "./payout.js";
import { computeEwmaLateP, computeNewPrice } from "./pricing.js";
import { computeVerdict } from "./verdict.js";

describe("computeVerdict (F-06)", () => {
  const promisedAt = new Date("2026-01-01T12:00:00Z");

  it("미인증 → 노쇼 60분", () => {
    expect(computeVerdict(promisedAt, null)).toEqual({
      verdict: "no_show",
      lateMinutes: 60,
    });
  });

  it("조기 인증 → 정시", () => {
    expect(computeVerdict(promisedAt, new Date("2026-01-01T11:50:00Z"))).toEqual({
      verdict: "on_time",
      lateMinutes: 0,
    });
  });

  it("32분 지각 → late 32 (올림)", () => {
    expect(computeVerdict(promisedAt, new Date("2026-01-01T12:32:00Z"))).toEqual({
      verdict: "late",
      lateMinutes: 32,
    });
  });

  it("1초 지각도 1분으로 올림", () => {
    expect(computeVerdict(promisedAt, new Date("2026-01-01T12:00:01Z"))).toEqual({
      verdict: "late",
      lateMinutes: 1,
    });
  });
});

describe("computeNewPrice (F-07) — test_schema 골든 케이스", () => {
  it("32분 지각: 10000 → 6800", () => {
    expect(computeNewPrice(10_000, "late", 32)).toBe(6800);
  });

  it("정시 3% 상승: 10000 → 10300", () => {
    expect(computeNewPrice(10_000, "on_time", 0)).toBe(10_300);
  });

  it("노쇼 60분 하락: 10000 → 4000", () => {
    expect(computeNewPrice(10_000, "no_show", 60)).toBe(4000);
  });

  it("하한가 클램프", () => {
    expect(computeNewPrice(1_500, "no_show", 60)).toBe(1_000);
  });
});

describe("computePayout — 골든 케이스", () => {
  it("공매도 3주 10000→6800 수익 +9600", () => {
    expect(computePayout("short", 3, 10_000, 6800, 30_000)).toBe(9600);
  });

  it("손실 클램프: 잠금 초과 손실 불가", () => {
    expect(computePayout("short", 2, 10_000, 25_000, 20_000)).toBe(-20_000);
  });
});

describe("computeEwmaLateP", () => {
  it("지각 시 EWMA 갱신 (test_schema 공식)", () => {
    expect(computeEwmaLateP(0.5, "late")).toBeCloseTo(0.625);
  });

  it("정시 시 EWMA 유지 방향", () => {
    expect(computeEwmaLateP(0.5, "on_time")).toBeCloseTo(0.375);
  });
});
