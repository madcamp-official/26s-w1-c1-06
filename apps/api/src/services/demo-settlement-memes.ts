import { NO_SHOW_MINUTES } from "@latestock/shared";
import type { Verdict } from "@latestock/shared";
import bcrypt from "bcryptjs";
import { getPool } from "../db/pool.js";
import { requirePool } from "../lib/errors.js";

const COUNTERPART_EMAIL = "demo.notifier@test.local";
const COUNTERPART_NICKNAME = "데모알림이";
const PLACE_NAME = "서울특별시청";
const LAT = 37.5665;
const LNG = 126.978;

/** memeLabel() 판정 경계값(F-06/F-20)을 전부 지나가도록 고른 5개 등급. */
const TIERS: {
  verdict: Verdict;
  lateMinutes: number;
  checkinOffsetMin: number | null;
  settledPrice: number;
}[] = [
  { verdict: "on_time", lateMinutes: 0, checkinOffsetMin: 0, settledPrice: 10300 }, // 상한가
  { verdict: "late", lateMinutes: 5, checkinOffsetMin: 5, settledPrice: 9950 }, // 숨고르기
  { verdict: "late", lateMinutes: 20, checkinOffsetMin: 20, settledPrice: 8000 }, // 폭락장
  { verdict: "late", lateMinutes: 45, checkinOffsetMin: 45, settledPrice: 5500 }, // 서킷브레이커
  { verdict: "no_show", lateMinutes: 60, checkinOffsetMin: null, settledPrice: 4000 }, // 상장폐지
];

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
     VALUES ($1, $2, $3, 100000, 10000, true)
     RETURNING id::text`,
    [COUNTERPART_EMAIL, hash, COUNTERPART_NICKNAME],
  );
  return inserted.rows[0]!.id;
}

/**
 * 데모용: 정산 결과 팝업(AutoSettlementReveal, S-07/F-20)이 등급별로 어떻게 보이는지
 * 한 번에 보여주기 위해, 5개 밈 등급(상한가/숨고르기/폭락장/서킷브레이커/상장폐지)에
 * 해당하는 "내가 종목인" 미확인 정산을 만들어 준다. 정산 엔진을 거치지 않고
 * getUnconfirmedSettlements가 보는 컬럼(verdict/late_minutes/result_confirmed_at)을
 * 직접 채워 넣는 픽스처 — 실제 정산 로직 검증용이 아니라 UI 시연 전용.
 * 홈 화면에 있는 AutoSettlementReveal이 이 5건을 큐로 잡아 순서대로 보여준다.
 */
export async function seedAllVerdictResults(userId: string): Promise<void> {
  const rawPool = getPool();
  requirePool(rawPool);
  const pool = rawPool;
  const counterpartId = await ensureCounterpart();
  const now = Date.now();

  for (const tier of TIERS) {
    const promisedAt = new Date(now - 2 * 60 * 60_000);
    const settleDueAt = new Date(promisedAt.getTime() + NO_SHOW_MINUTES * 60_000);
    const settledAt = new Date(now - 60 * 60_000);

    const inserted = await pool.query<{ id: string }>(
      `INSERT INTO promises (creator_id, title, place_name, latitude, longitude, promised_at, settle_due_at, settled_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id::text`,
      [counterpartId, "데모 정산 결과용 약속", PLACE_NAME, LAT, LNG, promisedAt, settleDueAt, settledAt],
    );
    const promiseId = inserted.rows[0]!.id;

    await pool.query(
      `INSERT INTO promise_participants (promise_id, user_id, invite_status, responded_at, checkin_at)
       VALUES ($1, $2, 'accepted', now(), $3)`,
      [promiseId, counterpartId, promisedAt],
    );

    const checkinAt =
      tier.checkinOffsetMin === null ? null : new Date(promisedAt.getTime() + tier.checkinOffsetMin * 60_000);
    await pool.query(
      `INSERT INTO promise_participants
         (promise_id, user_id, invite_status, responded_at, checkin_at, verdict, late_minutes, settled_price, result_confirmed_at)
       VALUES ($1, $2, 'accepted', now(), $3, $4, $5, $6, NULL)`,
      [promiseId, userId, checkinAt, tier.verdict, tier.lateMinutes, tier.settledPrice],
    );
  }
}
