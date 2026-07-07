import type pg from "pg";
import type { Verdict } from "@latestock/shared";
import { getPool } from "../db/pool.js";
import { HttpError, requirePool } from "../lib/errors.js";

export interface FriendRequestView {
  id: string;
  requesterId: string;
  requesterNickname: string;
  createdAt: string;
}

export interface FriendView {
  userId: string;
  nickname: string;
  currentPrice: number;
  onTimeStreak: number;
  lateRiskPct: number;
}

export interface UserSearchResult {
  id: string;
  nickname: string;
  email: string;
}

/** POST /friends/requests (F-02) */
export async function sendFriendRequest(
  requesterId: string,
  addresseeId: string,
): Promise<{ id: string }> {
  if (requesterId === addresseeId) {
    throw new HttpError(400, "자기 자신에게 친구 요청을 보낼 수 없습니다.");
  }

  const pool = getPool();
  requirePool(pool);

  const addressee = await pool.query(`SELECT id FROM users WHERE id = $1`, [
    addresseeId,
  ]);
  if (addressee.rowCount === 0) {
    throw new HttpError(404, "대상 사용자를 찾을 수 없습니다.");
  }

  try {
    const inserted = await pool.query<{ id: string }>(
      `INSERT INTO friendships (requester_id, addressee_id, status)
       VALUES ($1, $2, 'pending')
       RETURNING id`,
      [requesterId, addresseeId],
    );
    const row = inserted.rows[0];
    if (!row) throw new HttpError(500, "친구 요청 생성에 실패했습니다.");
    return { id: row.id };
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      err.code === "23505"
    ) {
      throw new HttpError(409, "이미 친구 요청이 존재하거나 친구 관계입니다.");
    }
    throw err;
  }
}

/** GET /friends/requests — 받은 pending 요청 */
export async function listIncomingFriendRequests(
  userId: string,
): Promise<FriendRequestView[]> {
  const pool = getPool();
  requirePool(pool);

  const result = await pool.query<{
    id: string;
    requester_id: string;
    nickname: string;
    created_at: Date;
  }>(
    `SELECT f.id, f.requester_id, u.nickname, f.created_at
     FROM friendships f
     JOIN users u ON u.id = f.requester_id
     WHERE f.addressee_id = $1 AND f.status = 'pending'
     ORDER BY f.created_at DESC`,
    [userId],
  );

  return result.rows.map((r) => ({
    id: r.id,
    requesterId: r.requester_id,
    requesterNickname: r.nickname,
    createdAt: r.created_at.toISOString(),
  }));
}

async function getFriendshipForAction(
  client: pg.Pool | pg.PoolClient,
  requestId: string,
  addresseeId: string,
) {
  const result = await client.query<{
    id: string;
    requester_id: string;
    addressee_id: string;
    status: string;
  }>(
    `SELECT id, requester_id, addressee_id, status
     FROM friendships WHERE id = $1`,
    [requestId],
  );
  const row = result.rows[0];
  if (!row) throw new HttpError(404, "친구 요청을 찾을 수 없습니다.");
  if (row.addressee_id !== addresseeId) {
    throw new HttpError(403, "이 요청을 처리할 권한이 없습니다.");
  }
  if (row.status !== "pending") {
    throw new HttpError(409, "이미 처리된 친구 요청입니다.");
  }
  return row;
}

/** POST /friends/requests/:id/accept */
export async function acceptFriendRequest(
  requestId: string,
  addresseeId: string,
): Promise<void> {
  const pool = getPool();
  requirePool(pool);

  // 조건(addressee_id, status='pending')까지 WHERE에 넣어 확인·실행을 한 쿼리로 원자화한다.
  // 동시에 accept/reject가 들어와도 둘 중 하나만 이 WHERE에 걸리고 나머지는 rowCount=0이 된다.
  const updated = await pool.query(
    `UPDATE friendships
     SET status = 'accepted', responded_at = now()
     WHERE id = $1 AND addressee_id = $2 AND status = 'pending'`,
    [requestId, addresseeId],
  );
  if (updated.rowCount === 0) {
    // 실패 원인(없음/권한 없음/이미 처리됨)을 구분해 정확한 에러를 던진다.
    await getFriendshipForAction(pool, requestId, addresseeId);
    throw new HttpError(409, "이미 처리된 친구 요청입니다.");
  }
}

/** POST /friends/requests/:id/reject — 거절 = 행 삭제 */
export async function rejectFriendRequest(
  requestId: string,
  addresseeId: string,
): Promise<void> {
  const pool = getPool();
  requirePool(pool);

  const deleted = await pool.query(
    `DELETE FROM friendships
     WHERE id = $1 AND addressee_id = $2 AND status = 'pending'`,
    [requestId, addresseeId],
  );
  if (deleted.rowCount === 0) {
    await getFriendshipForAction(pool, requestId, addresseeId);
    throw new HttpError(409, "이미 처리된 친구 요청입니다.");
  }
}

/** GET /friends (F-03) */
export async function listFriends(userId: string): Promise<FriendView[]> {
  const pool = getPool();
  requirePool(pool);

  const result = await pool.query<{
    friend_id: string;
    nickname: string;
    current_price: number;
    on_time_streak: number;
    ewma_late_p: number;
  }>(
    `SELECT
       CASE
         WHEN f.requester_id = $1::bigint THEN f.addressee_id
         ELSE f.requester_id
       END AS friend_id,
       u.nickname,
       u.current_price,
       u.on_time_streak,
       u.ewma_late_p
     FROM friendships f
     JOIN users u ON u.id = CASE
       WHEN f.requester_id = $1::bigint THEN f.addressee_id
       ELSE f.requester_id
     END
     WHERE f.status = 'accepted'
       AND ($1::bigint IN (f.requester_id, f.addressee_id))
     ORDER BY u.nickname`,
    [userId],
  );

  return result.rows.map((r) => ({
    userId: r.friend_id,
    nickname: r.nickname,
    currentPrice: r.current_price,
    onTimeStreak: r.on_time_streak,
    lateRiskPct: Math.round(r.ewma_late_p * 100),
  }));
}

export interface RankingEntryView {
  userId: string;
  nickname: string;
  totalPayout: number;
  totalLocked: number;
  returnPct: number;
}

/** GET /me/rankings (S-06) — 내 친구 범위 한정, 절대 포인트가 아닌 수익률 기준. */
export async function getFriendRanking(userId: string): Promise<RankingEntryView[]> {
  const pool = getPool();
  requirePool(pool);

  const result = await pool.query<{
    user_id: string;
    nickname: string;
    total_payout: number;
    total_locked: number;
  }>(
    `SELECT u.id::text AS user_id, u.nickname,
            COALESCE(SUM(p.payout), 0)::int AS total_payout,
            COALESCE(SUM(p.locked_points), 0)::int AS total_locked
     FROM (
       SELECT $1::bigint AS id
       UNION
       SELECT CASE WHEN f.requester_id = $1::bigint THEN f.addressee_id ELSE f.requester_id END
       FROM friendships f
       WHERE f.status = 'accepted' AND $1::bigint IN (f.requester_id, f.addressee_id)
     ) scope
     JOIN users u ON u.id = scope.id
     LEFT JOIN positions p ON p.investor_id = u.id AND p.status = 'settled'
     GROUP BY u.id, u.nickname`,
    [userId],
  );

  return result.rows
    .map((r) => ({
      userId: r.user_id,
      nickname: r.nickname,
      totalPayout: r.total_payout,
      totalLocked: r.total_locked,
      returnPct: r.total_locked === 0 ? 0 : (r.total_payout / r.total_locked) * 100,
    }))
    .sort((a, b) => b.returnPct - a.returnPct);
}

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

/** GET /friends/activity-feed (M6-6) — 나·친구들의 최근 정산 소식. */
export async function getFriendActivityFeed(
  userId: string,
  limit = 20,
): Promise<FriendActivityItem[]> {
  const pool = getPool();
  requirePool(pool);

  const result = await pool.query<{
    promise_id: string;
    promise_title: string;
    stock_user_id: string;
    nickname: string;
    verdict: Verdict;
    late_minutes: number;
    settled_price: number;
    settled_at: Date;
    reaction_count: string;
  }>(
    `SELECT pp.promise_id, p.title AS promise_title, pp.user_id AS stock_user_id,
            u.nickname, pp.verdict, pp.late_minutes, pp.settled_price, p.settled_at,
            (SELECT COUNT(*) FROM reactions r WHERE r.promise_id = pp.promise_id)::text
              AS reaction_count
     FROM promise_participants pp
     JOIN promises p ON p.id = pp.promise_id
     JOIN users u ON u.id = pp.user_id
     WHERE pp.verdict IS NOT NULL
       AND (
         pp.user_id = $1::bigint
         OR EXISTS (
           SELECT 1 FROM friendships f
           WHERE f.status = 'accepted'
             AND (
               (f.requester_id = pp.user_id AND f.addressee_id = $1::bigint)
               OR (f.requester_id = $1::bigint AND f.addressee_id = pp.user_id)
             )
         )
       )
     ORDER BY p.settled_at DESC
     LIMIT $2`,
    [userId, limit],
  );

  return result.rows.map((r) => ({
    promiseId: r.promise_id,
    promiseTitle: r.promise_title,
    stockUserId: r.stock_user_id,
    stockNickname: r.nickname,
    verdict: r.verdict,
    lateMinutes: r.late_minutes,
    settledPrice: r.settled_price,
    settledAt: r.settled_at.toISOString(),
    reactionCount: Number(r.reaction_count),
  }));
}

/** GET /users/search?q= */
export async function searchUsers(
  viewerId: string,
  query: string,
): Promise<UserSearchResult[]> {
  const q = query.trim();
  if (q.length < 1) {
    throw new HttpError(400, "검색어를 입력하세요.");
  }

  const pool = getPool();
  requirePool(pool);

  const pattern = `%${q}%`;
  const result = await pool.query<{
    id: string;
    nickname: string;
    email: string;
  }>(
    `SELECT id, nickname, email
     FROM users
     WHERE id <> $1
       AND (nickname ILIKE $2 OR email ILIKE $2)
     ORDER BY nickname
     LIMIT 20`,
    [viewerId, pattern],
  );

  return result.rows.map((r) => ({
    id: r.id,
    nickname: r.nickname,
    email: r.email,
  }));
}
