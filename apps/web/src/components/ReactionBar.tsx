import { ALLOWED_REACTIONS, type ReactionEmoji } from "@latestock/shared";
import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

interface ReactionSummary {
  counts: Record<ReactionEmoji, number>;
  myReaction: ReactionEmoji | null;
}

interface ReactionBarProps {
  promiseId: string;
}

interface Burst {
  id: number;
  emoji: ReactionEmoji;
  left: number;
}

/** 정산 결과 이모지 리액션 (S-09) — 자유 텍스트 없음. */
export function ReactionBar({ promiseId }: ReactionBarProps) {
  const [summary, setSummary] = useState<ReactionSummary | null>(null);
  const [bursts, setBursts] = useState<Burst[]>([]);

  useEffect(() => {
    apiFetch<ReactionSummary>(`/api/promises/${promiseId}/reactions`)
      .then(setSummary)
      .catch(() => setSummary(null));
  }, [promiseId]);

  async function handleClick(emoji: ReactionEmoji) {
    setBursts((b) => [...b, { id: Date.now() + Math.random(), emoji, left: 10 + Math.random() * 80 }]);
    try {
      await apiFetch(`/api/promises/${promiseId}/reactions`, {
        method: "POST",
        body: JSON.stringify({ emoji }),
      });
      const updated = await apiFetch<ReactionSummary>(
        `/api/promises/${promiseId}/reactions`,
      );
      setSummary(updated);
    } catch {
      // 리액션 실패는 결과 화면 자체를 방해하지 않도록 조용히 무시
    }
  }

  if (!summary) return null;

  return (
    <section className="reaction-bar" aria-label="이모지 리액션">
      {bursts.map((b) => (
        <span
          key={b.id}
          className="reaction-burst"
          style={{ left: `${b.left}%` }}
          onAnimationEnd={() => setBursts((bs) => bs.filter((x) => x.id !== b.id))}
        >
          {b.emoji}
        </span>
      ))}
      {ALLOWED_REACTIONS.map((emoji) => {
        const isMine = summary.myReaction === emoji;
        return (
          <button
            key={emoji}
            type="button"
            className={`reaction-bar__btn${isMine ? " reaction-bar__btn--active" : ""}`}
            onClick={() => handleClick(emoji)}
          >
            <span>{emoji}</span>
            <span className="reaction-bar__count">{summary.counts[emoji]}</span>
          </button>
        );
      })}
    </section>
  );
}
