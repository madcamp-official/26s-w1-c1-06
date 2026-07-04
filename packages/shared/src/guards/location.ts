import type { LatLng } from "../types.js";
import { CHECKIN_RADIUS_METERS } from "../constants.js";

const EARTH_RADIUS_M = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * 두 좌표 간 대권 거리(m) — Haversine 공식 (구현계획 M0-5 가드 c).
 */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 인증 반경(기본 50m) 이내인가. */
export function withinCheckinRadius(
  origin: LatLng,
  point: LatLng,
  radiusMeters: number = CHECKIN_RADIUS_METERS,
): boolean {
  return haversineMeters(origin, point) <= radiusMeters;
}

/**
 * 인증 가능 시간 구간 검사 (F-05).
 * 구간 = 약속 생성 ~ 약속 종료 시각(약속 시각 + 노쇼 60분).
 * 조기 도착 인증은 허용(정시로 처리), 종료 시각 이후는 거부(노쇼 확정).
 */
export function isCheckinWindowOpen(
  now: Date,
  createdAt: Date,
  settleDueAt: Date,
): boolean {
  const t = now.getTime();
  return t >= createdAt.getTime() && t <= settleDueAt.getTime();
}

export interface CheckinGuardInput {
  now: Date;
  createdAt: Date;
  settleDueAt: Date;
  promisedLocation: LatLng;
  checkinLocation: LatLng;
  isAcceptedParticipant: boolean;
  radiusMeters?: number;
}

export type CheckinDenyReason =
  | "not_participant"
  | "out_of_window"
  | "out_of_radius";

export interface CheckinGuardResult {
  allowed: boolean;
  reason?: CheckinDenyReason;
}

/**
 * F-05 인증 종합 가드: 수락 참여자 & 시간 구간 & 반경 50m 를 한 번에 판정.
 * (재인증 원자 차단은 `checkin_at IS NULL` 조건 UPDATE로 DB 계층에서 처리.)
 */
export function canCheckin(input: CheckinGuardInput): CheckinGuardResult {
  if (!input.isAcceptedParticipant) {
    return { allowed: false, reason: "not_participant" };
  }
  if (!isCheckinWindowOpen(input.now, input.createdAt, input.settleDueAt)) {
    return { allowed: false, reason: "out_of_window" };
  }
  if (
    !withinCheckinRadius(
      input.promisedLocation,
      input.checkinLocation,
      input.radiusMeters,
    )
  ) {
    return { allowed: false, reason: "out_of_radius" };
  }
  return { allowed: true };
}
