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
}

/** 베팅 마감까지 남은 시간을 1초마다 갱신해 보여준다(스펙 I-2). */
export function BettingCountdown({ deadline }: BettingCountdownProps) {
  const target = new Date(deadline).getTime();
  const [remaining, setRemaining] = useState(() => target - Date.now());

  useEffect(() => {
    const id = setInterval(() => setRemaining(target - Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);

  const closed = remaining <= 0;
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
