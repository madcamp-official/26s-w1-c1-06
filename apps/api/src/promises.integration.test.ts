/**
 * M1.1-3/4 통합 테스트 — DATABASE_URL 필요.
 */
import "./load-env.js";
import { BASE_STOCK_PRICE } from "@latestock/shared";
import { afterAll, describe, expect, it } from "vitest";
import { getPool } from "./db/pool.js";
import { signupUser, getUserProfile } from "./services/auth.js";
import {
  acceptFriendRequest,
  sendFriendRequest,
} from "./services/friends.js";
import {
  checkinToPromise,
  createPromise,
  getPromiseParticipants,
  respondToInvite,
} from "./services/promises.js";
import { runSettlement } from "./settlement/run-settlement.js";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.runIf(hasDb)("promises & GPS integration (M1.1)", () => {
  const pool = getPool()!;
  const runId = `promise-it-${Date.now()}`;
  const emailA = `${runId}-a@test.local`;
  const emailB = `${runId}-b@test.local`;

  const promisedAt = new Date("2030-06-01T12:00:00.000Z");
  const settleAt = new Date("2030-06-01T13:01:00.000Z");
  const venue = { lat: 36.374, lng: 127.365 };
  const nearVenue = { lat: 36.3741, lng: 127.3651 };
  const farVenue = { lat: 36.383, lng: 127.365 };

  let userAId: string;
  let userBId: string;
  let promiseId: string;

  afterAll(async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const users = await client.query<{ id: string }>(
        `SELECT id FROM users WHERE email = ANY($1::text[])`,
        [[emailA, emailB]],
      );
      const ids = users.rows.map((r) => r.id);
      if (ids.length > 0) {
        await client.query(
          `DELETE FROM self_stock_options
           WHERE user_id = ANY($1::bigint[])
              OR source_promise_id IN (
                SELECT id FROM promises WHERE creator_id = ANY($1::bigint[])
              )`,
          [ids],
        );
        await client.query(
          `DELETE FROM positions WHERE investor_id = ANY($1::bigint[])
             OR stock_user_id = ANY($1::bigint[])`,
          [ids],
        );
        await client.query(
          `DELETE FROM promise_participants WHERE user_id = ANY($1::bigint[])`,
          [ids],
        );
        await client.query(
          `DELETE FROM promises WHERE creator_id = ANY($1::bigint[])`,
          [ids],
        );
        await client.query(
          `DELETE FROM friendships
           WHERE requester_id = ANY($1::bigint[]) OR addressee_id = ANY($1::bigint[])`,
          [ids],
        );
        await client.query(
          `DELETE FROM point_transactions WHERE user_id = ANY($1::bigint[])`,
          [ids],
        );
        await client.query(`DELETE FROM users WHERE id = ANY($1::bigint[])`, [
          ids,
        ]);
      }
      await client.query("COMMIT");
    } catch {
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });

  it("가입·친구·약속 생성·수락", async () => {
    const a = await signupUser(emailA, "password12", "철수");
    userAId = a.id;
    const b = await signupUser(emailB, "password12", "영희");
    userBId = b.id;

    const req = await sendFriendRequest(userAId, userBId);
    await acceptFriendRequest(req.id, userBId);

    const created = await createPromise(userAId, {
      title: "점심",
      placeName: "카이스트",
      latitude: venue.lat,
      longitude: venue.lng,
      promisedAt,
      inviteUserIds: [userBId],
    });
    promiseId = created.id;

    await respondToInvite(
      userBId,
      promiseId,
      "accept",
      new Date("2030-06-01T10:00:00.000Z"),
    );
  });

  it("비친구 초대 거부", async () => {
    const stranger = await signupUser(
      `${runId}-x@test.local`,
      "password12",
      "낯선이",
    );
    try {
      await expect(
        createPromise(stranger.id, {
          title: "실패",
          placeName: "어딘가",
          latitude: venue.lat,
          longitude: venue.lng,
          promisedAt,
          inviteUserIds: [userBId],
        }),
      ).rejects.toMatchObject({ status: 400 });
    } finally {
      await pool.query(
        `DELETE FROM point_transactions WHERE user_id = $1`,
        [stranger.id],
      );
      await pool.query(`DELETE FROM users WHERE id = $1`, [stranger.id]);
    }
  });

  it("반경 밖 checkin 거부", async () => {
    await expect(
      checkinToPromise(
        userBId,
        promiseId,
        farVenue.lat,
        farVenue.lng,
        new Date("2030-06-01T12:10:00.000Z"),
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("GPS 인증: 정시·지각 후 강제 정산 → 주가 변동", async () => {
    await checkinToPromise(
      userAId,
      promiseId,
      nearVenue.lat,
      nearVenue.lng,
      new Date("2030-06-01T11:55:00.000Z"),
    );
    await checkinToPromise(
      userBId,
      promiseId,
      nearVenue.lat,
      nearVenue.lng,
      new Date("2030-06-01T12:32:00.000Z"),
    );

    const result = await runSettlement(pool, {
      now: settleAt,
      promiseId: Number(promiseId),
    });
    expect(result.settledIds).toEqual([Number(promiseId)]);

    const chulsoo = await getUserProfile(userAId);
    const younghee = await getUserProfile(userBId);
    expect(chulsoo.currentPrice).toBe(
      BASE_STOCK_PRICE + Math.floor(BASE_STOCK_PRICE * 0.03),
    );
    expect(younghee.currentPrice).toBe(6800);

    const verdicts = await pool.query<{
      user_id: string;
      verdict: string;
      late_minutes: number;
    }>(
      `SELECT user_id, verdict, late_minutes
       FROM promise_participants WHERE promise_id = $1`,
      [promiseId],
    );
    const byUser = Object.fromEntries(
      verdicts.rows.map((r) => [r.user_id, r]),
    );
    expect(byUser[userAId]?.verdict).toBe("on_time");
    expect(byUser[userBId]?.verdict).toBe("late");
    expect(byUser[userBId]?.late_minutes).toBe(32);
  });

  it("재인증 거부", async () => {
    await expect(
      checkinToPromise(
        userAId,
        promiseId,
        nearVenue.lat,
        nearVenue.lng,
        new Date("2030-06-01T12:00:00.000Z"),
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe.runIf(hasDb)("promises masking (R-1)", () => {
  const pool = getPool()!;
  const runId = `mask-it-${Date.now()}`;
  const emailA = `${runId}-a@test.local`;
  const emailB = `${runId}-b@test.local`;
  const promisedAt = new Date("2031-01-15T12:00:00.000Z");
  const venue = { lat: 37.0, lng: 127.0 };
  const nearVenue = { lat: 37.0001, lng: 127.0001 };

  let userAId: string;
  let userBId: string;
  let promiseId: string;

  afterAll(async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const users = await client.query<{ id: string }>(
        `SELECT id FROM users WHERE email = ANY($1::text[])`,
        [[emailA, emailB]],
      );
      const ids = users.rows.map((r) => r.id);
      if (ids.length > 0) {
        await client.query(
          `DELETE FROM promise_participants WHERE user_id = ANY($1::bigint[])`,
          [ids],
        );
        await client.query(
          `DELETE FROM promises WHERE creator_id = ANY($1::bigint[])`,
          [ids],
        );
        await client.query(
          `DELETE FROM friendships
           WHERE requester_id = ANY($1::bigint[]) OR addressee_id = ANY($1::bigint[])`,
          [ids],
        );
        await client.query(
          `DELETE FROM point_transactions WHERE user_id = ANY($1::bigint[])`,
          [ids],
        );
        await client.query(`DELETE FROM users WHERE id = ANY($1::bigint[])`, [
          ids,
        ]);
      }
      await client.query("COMMIT");
    } catch {
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });

  it("약속 시각 전 타인 checkin 마스킹", async () => {
    const a = await signupUser(emailA, "password12", "철수");
    userAId = a.id;
    const b = await signupUser(emailB, "password12", "영희");
    userBId = b.id;

    const req = await sendFriendRequest(userAId, userBId);
    await acceptFriendRequest(req.id, userBId);

    const created = await createPromise(userAId, {
      title: "마스킹 테스트",
      placeName: "테스트",
      latitude: venue.lat,
      longitude: venue.lng,
      promisedAt,
      inviteUserIds: [userBId],
    });
    promiseId = created.id;
    await respondToInvite(
      userBId,
      promiseId,
      "accept",
      new Date("2031-01-15T10:00:00.000Z"),
    );

    await checkinToPromise(
      userAId,
      promiseId,
      nearVenue.lat,
      nearVenue.lng,
      new Date("2031-01-15T11:50:00.000Z"),
    );

    const beforeDeadline = await getPromiseParticipants(
      userBId,
      promiseId,
      new Date("2031-01-15T11:55:00.000Z"),
    );
    const chulsooBefore = beforeDeadline.participants.find(
      (p) => p.userId === userAId,
    );
    expect(chulsooBefore?.checkinMasked).toBe(true);
    expect(chulsooBefore?.checkinAt).toBeNull();

    const afterDeadline = await getPromiseParticipants(
      userBId,
      promiseId,
      new Date("2031-01-15T12:05:00.000Z"),
    );
    const chulsooAfter = afterDeadline.participants.find(
      (p) => p.userId === userAId,
    );
    expect(chulsooAfter?.checkinMasked).toBe(false);
    expect(chulsooAfter?.checkinAt).not.toBeNull();
  });
});

describe.runIf(!hasDb)("promises integration (M1.1)", () => {
  it.skip("DATABASE_URL 없음 — 통합 테스트 스킵", () => {});
});
