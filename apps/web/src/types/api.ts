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

export interface BettablePromiseView {
  id: string;
  title: string;
  placeName: string;
  promisedAt: string;
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

/** GET /promises/:id/participants 참여자 1행 (F-05/F-06/F-19, R-1/R-5 마스킹 적용됨). */
export interface ParticipantStatusView {
  userId: string;
  displayName: string;
  inviteStatus: InviteStatus;
  /** 마스킹 규칙에 의해 숨겨졌으면 null (약속 시각 전 타인). */
  checkinAt: string | null;
  /** 인증 여부 자체가 마스킹되었는지 (UI 표기용). */
  checkinMasked: boolean;
  /** 베팅 진입점 노출 가능 여부 (친구가 아니면 false, R-5). */
  bettable: boolean;
  isSelf: boolean;
}

export interface PromiseParticipantsView {
  promisedAt: string;
  participants: ParticipantStatusView[];
}
