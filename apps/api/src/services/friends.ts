import type pg from "pg";
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

  await getFriendshipForAction(pool, requestId, addresseeId);
  await pool.query(
    `UPDATE friendships
     SET status = 'accepted', responded_at = now()
     WHERE id = $1`,
    [requestId],
  );
}

/** POST /friends/requests/:id/reject — 거절 = 행 삭제 */
export async function rejectFriendRequest(
  requestId: string,
  addresseeId: string,
): Promise<void> {
  const pool = getPool();
  requirePool(pool);

  await getFriendshipForAction(pool, requestId, addresseeId);
  await pool.query(`DELETE FROM friendships WHERE id = $1`, [requestId]);
}

/** GET /friends (F-03) */
export async function listFriends(userId: string): Promise<FriendView[]> {
  const pool = getPool();
  requirePool(pool);

  const result = await pool.query<{
    friend_id: string;
    nickname: string;
    current_price: number;
  }>(
    `SELECT
       CASE
         WHEN f.requester_id = $1::bigint THEN f.addressee_id
         ELSE f.requester_id
       END AS friend_id,
       u.nickname,
       u.current_price
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
