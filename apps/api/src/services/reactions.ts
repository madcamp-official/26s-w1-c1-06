import { ALLOWED_REACTIONS, type ReactionEmoji } from "@latestock/shared";
import { getPool } from "../db/pool.js";
import { HttpError, requirePool } from "../lib/errors.js";

export interface ReactionSummary {
  counts: Record<ReactionEmoji, number>;
  myReaction: ReactionEmoji | null;
}

function isAllowedEmoji(value: unknown): value is ReactionEmoji {
  return (
    typeof value === "string" &&
    (ALLOWED_REACTIONS as readonly string[]).includes(value)
  );
}

async function assertParticipant(
  promiseId: string,
  userId: string,
): Promise<void> {
  const pool = getPool();
  requirePool(pool);
  const result = await pool.query(
    `SELECT 1 FROM promise_participants WHERE promise_id = $1 AND user_id = $2`,
    [promiseId, userId],
  );
  if ((result.rowCount ?? 0) === 0) {
    throw new HttpError(403, "이 약속의 참여자만 반응할 수 있습니다.");
  }
}

/** POST /promises/:id/reactions (S-09) — 화이트리스트 이모지만 허용, 재반응은 갱신. */
export async function setReaction(
  promiseId: string,
  userId: string,
  emoji: unknown,
): Promise<void> {
  if (!isAllowedEmoji(emoji)) {
    throw new HttpError(400, "허용되지 않은 이모지입니다.");
  }
  await assertParticipant(promiseId, userId);

  const pool = getPool();
  requirePool(pool);
  await pool.query(
    `INSERT INTO reactions (promise_id, user_id, emoji)
     VALUES ($1, $2, $3)
     ON CONFLICT (promise_id, user_id)
     DO UPDATE SET emoji = EXCLUDED.emoji, created_at = now()`,
    [promiseId, userId, emoji],
  );
}

/** GET /promises/:id/reactions (S-09) */
export async function getReactionSummary(
  promiseId: string,
  userId: string,
): Promise<ReactionSummary> {
  await assertParticipant(promiseId, userId);

  const pool = getPool();
  requirePool(pool);

  const counts: Record<ReactionEmoji, number> = Object.fromEntries(
    ALLOWED_REACTIONS.map((e) => [e, 0]),
  ) as Record<ReactionEmoji, number>;

  const result = await pool.query<{ emoji: ReactionEmoji; count: string }>(
    `SELECT emoji, count(*)::text AS count
     FROM reactions
     WHERE promise_id = $1
     GROUP BY emoji`,
    [promiseId],
  );
  for (const row of result.rows) {
    counts[row.emoji] = Number(row.count);
  }

  const mine = await pool.query<{ emoji: ReactionEmoji }>(
    `SELECT emoji FROM reactions WHERE promise_id = $1 AND user_id = $2`,
    [promiseId, userId],
  );

  return { counts, myReaction: mine.rows[0]?.emoji ?? null };
}
