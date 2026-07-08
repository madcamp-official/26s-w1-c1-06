/**
 * 게임 경제 수치 — 단일 소스 (구현계획 M0-2).
 *
 * 명세 9장 #2의 미정값 + 스키마 CHECK로 못 박힌 확정값을 한곳에 모은다.
 * 여기서만 고치면 FE·BE·테스트가 함께 바뀐다.
 *
 * 확정값(설계에서 이미 결정 — 재론 금지): 모델 B, INT 원 단위,
 * 시스템 카운터파티, 자기주식 특례(P-5), α=0.25 · p₀=0.5.
 *
 * ⚠️ 아래 "구현 시 결정" 값들은 이 계획의 채택값이다. schema.sql이 다른 값을
 * CHECK로 강제하면 schema.sql이 원본이므로 그쪽에 맞춰 이 파일을 갱신할 것.
 */

/** 가입 시 자동 발행되는 지각 주식의 기본가 (원). 전역 단일 가격 (R-3). */
export const BASE_STOCK_PRICE = 10_000;

/** 신규 가입 시 지급되는 초기 가상 포인트 (F-09). */
export const INITIAL_POINTS = 100_000;

/**
 * 정시 도착 시 적용되는 고정 상승률 (F-07).
 * [구현 시 결정] 채택값 3%.
 */
export const ON_TIME_RISE_RATE = 0.03;

/**
 * 지각 1분당 하락률 (F-07, 단리).
 * 제약: 분당 하락률 × 60 ≤ 100% (1차 방어선).
 * [test_schema 골든 케이스] "32분 지각 → 10000→6800" = 32% 하락 = 분당 1%.
 */
export const LATE_DROP_RATE_PER_MIN = 0.01;

/**
 * 하한가 (원). 지각 하락은 이 값에서 클램프된다 (F-07).
 * [구현 시 결정] 채택값 기본가의 10%.
 */
export const FLOOR_PRICE = 1_000;

/**
 * 상한가 (원). 정시 상승은 이 값에서 클램프된다.
 * 명세에는 하한가만 있고 상한가가 없었음 — 정시 복리 상승(3%/회)이 누적되면
 * current_price(DB INTEGER, 최대 약 21억) 범위를 넘어 오버플로우가 나는 걸 방어.
 * 채택값: 기본가의 20배.
 */
export const CEILING_PRICE = BASE_STOCK_PRICE * 20;

/** GPS 도착 인증 허용 반경 (m) — F-05. */
export const CHECKIN_RADIUS_METERS = 50;

/** 노쇼(미인증) 상한 시간 (분). 약속 종료 시각 = 약속 시각 + 이 값 (F-06). */
export const NO_SHOW_MINUTES = 60;

/**
 * 정시 방어 보상 고정 포인트 (F-15).
 * 포인트 보유량과 무관하게 지급 → 파산 유저의 무자본 회복 경로.
 * [구현 시 결정] 채택값 500P.
 */
export const DEFENSE_REWARD_POINTS = 500;

/**
 * 자기 주식 특별 매수(F-17) 이벤트당 수량 한도 (주).
 * [구현 시 결정] 채택값 3주 (명세 "2~3주").
 */
export const SELF_STOCK_OPTION_LIMIT = 3;

/** 특별 매수 권한 유효기간 (시간) — F-17. */
export const SELF_STOCK_OPTION_TTL_HOURS = 24;

/** EWMA 지각 확률 평활 계수 (확정값). */
export const EWMA_ALPHA = 0.25;

/** EWMA 지각 확률 초기값 (확정값). */
export const EWMA_P0 = 0.5;

/** 밈 등급 라벨 고정 매핑 (F-20, I-3 · P-4를 코드 구조로 보장). */
export const MEME_LABELS = {
  ON_TIME: "상한가 🔼",
  LATE_1_10: "숨고르기 😮‍💨",
  LATE_11_30: "폭락장 😱",
  LATE_31_PLUS: "서킷브레이커 🚨",
  NO_SHOW: "상장폐지 💀",
} as const;

/** 각 밈 라벨이 어떤 판정 구간을 뜻하는지 (범례 표시용). */
export const MEME_LABEL_CRITERIA: Record<keyof typeof MEME_LABELS, string> = {
  ON_TIME: "정시 도착",
  LATE_1_10: "1~10분 지각",
  LATE_11_30: "11~30분 지각",
  LATE_31_PLUS: "31~59분 지각",
  NO_SHOW: "노쇼 (60분/미인증)",
};

/**
 * late_minutes(및 노쇼 여부)로 밈 등급 라벨을 결정한다.
 * 경계값 정확성은 유닛 테스트로 고정 (구현계획 M1.3-3).
 */
export function memeLabel(lateMinutes: number, isNoShow: boolean): string {
  if (isNoShow) return MEME_LABELS.NO_SHOW;
  if (lateMinutes <= 0) return MEME_LABELS.ON_TIME;
  if (lateMinutes <= 10) return MEME_LABELS.LATE_1_10;
  if (lateMinutes <= 30) return MEME_LABELS.LATE_11_30;
  return MEME_LABELS.LATE_31_PLUS;
}

/** 레버리지 베팅 허용 배율 (S-05). */
export const ALLOWED_MULTIPLIERS = [1, 3, 5, 10] as const;

/**
 * 정산 결과 이모지 리액션 화이트리스트 (S-09).
 * 자유 텍스트 없음 — P-4 톤 가드레일을 구조로 보장. DB CHECK와 값 동일하게 유지.
 */
export const ALLOWED_REACTIONS = ["😱", "📉", "🛡️", "🔥"] as const;
export type ReactionEmoji = (typeof ALLOWED_REACTIONS)[number];
