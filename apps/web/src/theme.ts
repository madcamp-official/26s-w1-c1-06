import { MEME_LABELS } from "@latestock/shared";

/**
 * 등락 색상 — 한국 주식 관례(상승 빨강/하락 파랑, 미국식과 반대).
 * 토스증권류 파스텔 톤으로 통일(다크 모드 캔들차트 기준값).
 */
export const RISE_COLOR = "#F04452";
export const FALL_COLOR = "#3182F6";
export const NEUTRAL_COLOR = "#888888";

/**
 * 스포티파이 랩드 스타일 등급별 배경색.
 * [팀 합의 전 임시값] MEME_LABELS(@latestock/shared) 키와 1:1 대응.
 * EARLY_EXIT은 약속 판정을 기다리지 않고 조기 청산(M3-2)한 경우 — 판정 등급이 없어 별도 색.
 */
export const MEME_BG_COLORS: Record<keyof typeof MEME_LABELS | "EARLY_EXIT", string> = {
  ON_TIME: "#0b3d91",
  LATE_1_10: "#6b6b1a",
  LATE_11_30: "#7a2d00",
  LATE_31_PLUS: "#8c0000",
  NO_SHOW: "#1a1a1a",
  EARLY_EXIT: "#3d3d0b",
};
