import type { BettableContext } from "../types.js";

/**
 * 가드 (a) — 베팅 가능 약속 필터 (구현계획 M0-5, R-5/R-6/F-19).
 *
 * 조건: 내 친구(friendships accepted) AND 그 종목이 해당 약속의 accepted 참여자
 *       AND promised_at > now() (베팅 마감 전) AND 자기주식 아님(P-5).
 *
 * SC-11 리스트 · SC-12/13 선택지 · 포지션 개설 검증이 전부 이 함수를 쓴다.
 * 시각은 인자로 주입한다(전역 시계 의존 금지 — 테스트/데모 override 용이).
 */
export function isBettable(ctx: BettableContext, now: Date): boolean {
  if (ctx.isSelf) return false;
  if (!ctx.isFriendAccepted) return false;
  if (ctx.targetInviteStatus !== "accepted") return false;
  return ctx.promisedAt.getTime() > now.getTime();
}

/** 베팅 가능 약속만 남기는 필터 헬퍼. */
export function filterBettable<T extends BettableContext>(
  items: readonly T[],
  now: Date,
): T[] {
  return items.filter((item) => isBettable(item, now));
}
