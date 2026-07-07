import { useEffect, useState } from "react";

const URGENT_THRESHOLD_MS = 10 * 60 * 1000;

function formatRemaining(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}시간 ${m}분`;
  if (m > 0) return `${m}분 ${s}초`;
  return `${s}초`;
}

interface BettingCountdownProps {
  /** 약속 시각(ISO) — 베팅 마감 시점(4장 정의: 약속 생성 ~ 약속 시각). */
  deadline: string;
  /**
   * 마감 여부가 바뀔 때(마운트 시 1회 포함) 호출된다. 이 컴포넌트 내부의 1초 타이머는
   * 부모를 리렌더하지 않으므로, 부모의 버튼 disabled 상태를 이 콜백 없이 자체 계산에만
   * 맡기면 실제로 마감된 후에도 부모가 리렌더될 때까지 버튼이 계속 눌리는 문제가 생긴다.
   */
  onClosedChange?: (closed: boolean) => void;
}

/** 베팅 마감까지 남은 시간을 1초마다 갱신해 보여준다(스펙 I-2). */
export function BettingCountdown({ deadline, onClosedChange }: BettingCountdownProps) {
  const target = new Date(deadline).getTime();
  const [remaining, setRemaining] = useState(() => target - Date.now());

  useEffect(() => {
    const id = setInterval(() => setRemaining(target - Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);

  const closed = remaining <= 0;

  useEffect(() => {
    onClosedChange?.(closed);
    // onClosedChange는 매 렌더 새 함수일 수 있어 의존성에서 제외 — closed 전이 시에만 알린다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closed]);

  const urgent = !closed && remaining <= URGENT_THRESHOLD_MS;

  return (
    <p
      className={`betting-countdown${urgent ? " betting-countdown--urgent" : ""}${
        closed ? " betting-countdown--closed" : ""
      }`}
    >
      {closed ? "⏱ 베팅 마감됨" : `⏱ 베팅 마감까지 ${formatRemaining(remaining)}`}
    </p>
  );
}
