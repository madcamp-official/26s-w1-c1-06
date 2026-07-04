/**
 * 도메인 타입 — 스키마 v1의 ENUM/핵심 컬럼을 TS로 반영 (구현계획 M0-2).
 *
 * ⚠️ schema.sql이 원본이다 (스키마 문서 4장). M0-3에서 Prisma `db pull`로
 * 정확한 생성 타입을 뽑기 전까지, 공용 가드(M0-5)가 컴파일되도록 하는 최소
 * 도메인 타입을 여기 둔다. schema.sql 도착 후 ENUM 값이 다르면 여기에 맞춘다.
 */

export type FriendshipStatus = "pending" | "accepted";

export type InviteStatus = "pending" | "accepted" | "rejected" | "auto_declined";

export type Verdict = "on_time" | "late" | "no_show";

export type PositionDirection = "buy" | "short";

export type PositionStatus = "open" | "settled";

/** 위경도 좌표 (도 단위). */
export interface LatLng {
  lat: number;
  lng: number;
}

/** 베팅 가능 여부 판정에 필요한 최소 컨텍스트 (M0-5 가드 a). */
export interface BettableContext {
  /** 조회 주체(투자자)와 종목이 accepted 친구 관계인가. */
  isFriendAccepted: boolean;
  /** 그 종목이 해당 약속의 accepted 참여자인가 (F-19). */
  targetInviteStatus: InviteStatus;
  /** 약속 시각 (= 베팅 마감). */
  promisedAt: Date;
  /** 대상 종목이 조회 주체 본인인가 (자기주식 = 베팅 불가, P-5). */
  isSelf: boolean;
}

/** 참여자 현황 1행 (마스킹 가드 입력, M0-5 가드 b). */
export interface ParticipantView {
  userId: string;
  displayName: string;
  inviteStatus: InviteStatus;
  /** 서버 기록 인증 시각. 미인증이면 null. */
  checkinAt: Date | null;
  /** 조회 주체가 이 참여자와 accepted 친구인가 (비친구 → 베팅 진입점 없음, R-5). */
  isFriendOfViewer: boolean;
}

/** 마스킹 적용 후 응답 1행. */
export interface MaskedParticipantView {
  userId: string;
  displayName: string;
  inviteStatus: InviteStatus;
  /** 마스킹 규칙에 의해 숨겨졌으면 null (약속 시각 전 타인). */
  checkinAt: Date | null;
  /** 인증 여부 자체가 마스킹되었는지 (UI 표기용). */
  checkinMasked: boolean;
  /** 베팅 진입점 노출 가능 여부 (친구가 아니면 false, R-5). */
  bettable: boolean;
  isSelf: boolean;
}
