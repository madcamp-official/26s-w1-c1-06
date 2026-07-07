import type { InviteStatus, OptionType, PositionDirection, Verdict } from "@latestock/shared";

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
  multiplier: number;
  status: "open" | "settled" | "cancelled";
  priceBefore: number | null;
  priceAfter: number | null;
  payout: number | null;
  createdAt: string;
  settledAt: string | null;
}

export interface OptionPositionView {
  id: string;
  stockUserId: string;
  stockNickname: string;
  promiseId: string;
  promiseTitle: string;
  promisedAt: string;
  optionType: OptionType;
  quantity: number;
  referencePrice: number;
  premiumPaid: number;
  status: "open" | "settled" | "cancelled";
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

/** M6-5: 베팅 현황 공개 — 개별 투자자 신원은 감추고 매수/공매도 합계만 노출. */
export interface BettorSummary {
  buyCount: number;
  shortCount: number;
  buyQuantity: number;
  shortQuantity: number;
}

/** M6-6: 친구 소식 피드 — 나·친구의 최근 정산 소식. */
export interface FriendActivityItem {
  promiseId: string;
  promiseTitle: string;
  stockUserId: string;
  stockNickname: string;
  verdict: Verdict;
  lateMinutes: number;
  settledPrice: number;
  settledAt: string;
  reactionCount: number;
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
  onTimeStreak: number;
  lateRiskPct: number;
}

export interface RankingEntryView {
  userId: string;
  nickname: string;
  totalPayout: number;
  totalLocked: number;
  returnPct: number;
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
  /** 조기 청산(M3-2)된 포지션은 약속이 판정 안 나서 둘 다 null. */
  verdict: Verdict | null;
  lateMinutes: number | null;
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
