import type { InviteStatus, PositionDirection, Verdict } from "@latestock/shared";

export interface PositionView {
  id: string;
  stockUserId: string;
  stockNickname: string;
  promiseId: string;
  promiseTitle: string;
  promisedAt: string;
  direction: PositionDirection;
  quantity: number;
  openPrice: number;
  lockedPoints: number;
  status: "open" | "settled" | "cancelled";
  priceBefore: number | null;
  priceAfter: number | null;
  payout: number | null;
  createdAt: string;
  settledAt: string | null;
}

export interface ChartPoint {
  promiseId: string;
  promisedAt: string;
  verdict: Verdict;
  lateMinutes: number;
  settledPrice: number;
}

export interface PromiseView {
  id: string;
  creatorId: string;
  title: string;
  placeName: string;
  latitude: number;
  longitude: number;
  promisedAt: string;
  settleDueAt: string;
  settledAt: string | null;
  createdAt: string;
  myInviteStatus: InviteStatus;
}

export interface FriendView {
  userId: string;
  nickname: string;
  currentPrice: number;
}

export interface DemoSettleResult {
  ok: boolean;
  settledIds: number[];
  skippedIds: number[];
  failedIds: number[];
}

export interface UnconfirmedAsStock {
  promiseId: string;
  promiseTitle: string;
  promisedAt: string;
  verdict: Verdict;
  lateMinutes: number;
  settledPrice: number;
}

export interface UnconfirmedAsInvestor {
  positionId: string;
  promiseId: string;
  promiseTitle: string;
  stockUserId: string;
  stockNickname: string;
  direction: PositionDirection;
  payout: number;
  priceBefore: number;
  priceAfter: number;
  settledAt: string;
}

export interface UnconfirmedSettlements {
  asStock: UnconfirmedAsStock[];
  asInvestor: UnconfirmedAsInvestor[];
  totalCount: number;
}
