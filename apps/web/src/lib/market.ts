import { BASE_STOCK_PRICE } from "@latestock/shared";
import type { FriendView } from "../types/api";

export interface MoverView extends FriendView {
  changePct: number;
}

function withChange(friend: FriendView): MoverView {
  return {
    ...friend,
    changePct: ((friend.currentPrice - BASE_STOCK_PRICE) / BASE_STOCK_PRICE) * 100,
  };
}

/** 홈 화면 "오늘의 시장" 상승·하락 상위 종목 (M2-3). */
export function rankMovers(
  friends: FriendView[],
  limit = 3,
): { gainers: MoverView[]; losers: MoverView[] } {
  const withPct = friends.map(withChange);
  const gainers = [...withPct].sort((a, b) => b.changePct - a.changePct).slice(0, limit);
  const losers = [...withPct]
    .sort((a, b) => a.changePct - b.changePct)
    .slice(0, limit);
  return { gainers, losers };
}
