/**
 * R-4 — 공유 카드 마스킹: 종목 본인만 실명, 타인은 이니셜.
 */
export function maskStockName(
  nickname: string,
  viewerId: string,
  stockUserId: string,
): string {
  if (viewerId === stockUserId) return nickname;
  const initial = nickname.trim().charAt(0) || "?";
  return `친구 ${initial}`;
}
