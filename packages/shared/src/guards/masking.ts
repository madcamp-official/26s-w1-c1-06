import type { MaskedParticipantView, ParticipantView } from "../types.js";

/**
 * 가드 (b) — 인증 현황 마스킹 (구현계획 M0-5, R-1 · F-05).
 *
 * 약속 시각(promisedAt) 전에는 타인의 checkin_at을 숨긴다(표현 계층).
 * 조기 인증의 "확정 정시" 정보가 베팅 마감 전에 유출되어 무위험 차익이
 * 생기는 것을 차단. 본인 인증 상태는 항상 보인다. 약속 시각 후에는 전체 공개.
 *
 * 비친구 참여자는 이름만 노출되고 베팅 진입점이 없다(bettable=false, R-5).
 */
export function maskParticipant(
  p: ParticipantView,
  viewerId: string,
  promisedAt: Date,
  now: Date,
): MaskedParticipantView {
  const isSelf = p.userId === viewerId;
  const beforeDeadline = now.getTime() < promisedAt.getTime();
  const shouldMask = beforeDeadline && !isSelf;

  return {
    userId: p.userId,
    displayName: p.displayName,
    inviteStatus: p.inviteStatus,
    checkinAt: shouldMask ? null : p.checkinAt,
    checkinMasked: shouldMask,
    // 베팅 진입점: 본인 제외 + accepted 친구 + accepted 참여자만 (R-5).
    bettable:
      !isSelf && p.isFriendOfViewer && p.inviteStatus === "accepted",
    isSelf,
  };
}

/** 참여자 현황 리스트 전체에 마스킹을 적용한다. */
export function maskParticipants(
  participants: readonly ParticipantView[],
  viewerId: string,
  promisedAt: Date,
  now: Date,
): MaskedParticipantView[] {
  return participants.map((p) => maskParticipant(p, viewerId, promisedAt, now));
}
