import { INITIAL_POINTS, NO_SHOW_MINUTES } from "@latestock/shared";
import bcrypt from "bcryptjs";
import { getPool } from "../db/pool.js";
import { requirePool } from "../lib/errors.js";

const COUNTERPART_EMAIL = "demo.notifier@test.local";
const COUNTERPART_NICKNAME = "데모알림이";
const PLACE_NAME = "서울특별시청";
const LAT = 37.5665;
const LNG = 126.978;

async function ensureCounterpart(): Promise<string> {
  const pool = getPool();
  requirePool(pool);

  const existing = await pool.query<{ id: string }>(`SELECT id::text FROM users WHERE email = $1`, [
    COUNTERPART_EMAIL,
  ]);
  if (existing.rows[0]) return existing.rows[0].id;

  const hash = await bcrypt.hash("password12", 10);
  const inserted = await pool.query<{ id: string }>(
    `INSERT INTO users (email, password_hash, nickname, available_points, current_price, auto_accept_invites)
     VALUES ($1, $2, $3, 0, 10000, true)
     RETURNING id::text`,
    [COUNTERPART_EMAIL, hash, COUNTERPART_NICKNAME],
  );
  const id = inserted.rows[0]!.id;
  await pool.query(
    `INSERT INTO point_transactions (user_id, amount, tx_type) VALUES ($1, $2, 'signup_grant')`,
    [id, INITIAL_POINTS],
  );
  await pool.query(`UPDATE users SET available_points = $2 WHERE id = $1`, [id, INITIAL_POINTS]);
  return id;
}

/**
 * 데모용: 알림함(S-07)의 4가지 종류(정시 정산 확인 대상 2종 + 친구요청 + 약속초대)를
 * 현재 로그인한 유저 앞으로 한 번에 만들어준다. 정산 엔진을 거치지 않고 알림 조회 쿼리가
 * 보는 컬럼(verdict/result_confirmed_at/confirmed_at/invite_status 등)을 직접 채워 넣는다
 * — 실제 정산 로직 검증용이 아니라 순수히 알림함 UI를 시연하기 위한 픽스처이기 때문.
 */
export async function seedAllNotificationTypes(userId: string): Promise<void> {
  const rawPool = getPool();
  requirePool(rawPool);
  const pool = rawPool;
  const counterpartId = await ensureCounterpart();
  const now = Date.now();

  async function createPromiseRow(promisedAtMs: number, settledAtMs: number | null): Promise<string> {
    const promisedAt = new Date(promisedAtMs);
    const settleDueAt = new Date(promisedAtMs + NO_SHOW_MINUTES * 60_000);
    const settledAt = settledAtMs === null ? null : new Date(settledAtMs);
    const inserted = await pool.query<{ id: string }>(
      `INSERT INTO promises (creator_id, title, place_name, latitude, longitude, promised_at, settle_due_at, settled_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id::text`,
      [counterpartId, "데모 알림용 약속", PLACE_NAME, LAT, LNG, promisedAt, settleDueAt, settledAt],
    );
    return inserted.rows[0]!.id;
  }

  // ① settlement_stock: 내가 종목으로 이미 판정났지만 아직 확인 안 한 정산
  const stockPromiseId = await createPromiseRow(now - 2 * 60 * 60_000, now - 60 * 60_000);
  await pool.query(
    `INSERT INTO promise_participants (promise_id, user_id, invite_status, responded_at, checkin_at)
     VALUES ($1, $2, 'accepted', now(), now())`,
    [stockPromiseId, counterpartId],
  );
  await pool.query(
    `INSERT INTO promise_participants
       (promise_id, user_id, invite_status, responded_at, checkin_at, verdict, late_minutes, settled_price, result_confirmed_at)
     VALUES ($1, $2, 'accepted', now(), now(), 'late', 5, 9800, NULL)`,
    [stockPromiseId, userId],
  );

  // ② settlement_investor: 내가 상대에게 건 베팅이 정산됐지만 아직 확인 안 함
  const investorPromiseId = await createPromiseRow(now - 3 * 60 * 60_000, now - 2 * 60 * 60_000);
  await pool.query(
    `INSERT INTO promise_participants
       (promise_id, user_id, invite_status, responded_at, checkin_at, verdict, late_minutes, settled_price, result_confirmed_at)
     VALUES ($1, $2, 'accepted', now(), now(), 'on_time', 0, 10300, now())`,
    [investorPromiseId, counterpartId],
  );
  await pool.query(
    `INSERT INTO positions
       (investor_id, stock_user_id, promise_id, direction, quantity, open_price, locked_points,
        price_before, price_after, payout, status, confirmed_at, settled_at)
     VALUES ($1, $2, $3, 'buy', 1, 10000, 10000, 10000, 10300, 300, 'settled', NULL, now() - interval '2 hours')`,
    [userId, counterpartId, investorPromiseId],
  );

  // ③ promise_invite: 아직 응답 안 한 약속 초대(미래 약속)
  const invitePromiseId = await createPromiseRow(now + 24 * 60 * 60_000, null);
  await pool.query(
    `INSERT INTO promise_participants (promise_id, user_id, invite_status, responded_at, checkin_at)
     VALUES ($1, $2, 'accepted', now(), NULL)`,
    [invitePromiseId, counterpartId],
  );
  await pool.query(
    `INSERT INTO promise_participants (promise_id, user_id, invite_status)
     VALUES ($1, $2, 'invited')`,
    [invitePromiseId, userId],
  );

  // ④ friend_request: 상대가 나에게 보낸 친구 요청(대기 중)
  await pool.query(
    `INSERT INTO friendships (requester_id, addressee_id, status, created_at, responded_at)
     VALUES ($1, $2, 'pending', now(), NULL)
     ON CONFLICT (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id))
     DO UPDATE SET status = 'pending', requester_id = EXCLUDED.requester_id,
                   addressee_id = EXCLUDED.addressee_id, responded_at = NULL, created_at = now()`,
    [counterpartId, userId],
  );
}
