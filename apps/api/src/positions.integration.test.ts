/**
 * M1.2 포지션 API 통합 테스트 — DATABASE_URL 필요.
 */
import "./load-env.js";
import { BASE_STOCK_PRICE, INITIAL_POINTS } from "@latestock/shared";
import { afterAll, describe, expect, it } from "vitest";
import { getPool } from "./db/pool.js";
import { signupUser } from "./services/auth.js";
import {
  acceptFriendRequest,
  sendFriendRequest,
} from "./services/friends.js";
import {
  checkinToPromise,
  createPromise,
  respondToInvite,
} from "./services/promises.js";
import { listPositions, openPosition } from "./services/positions.js";
import { runSettlement } from "./settlement/run-settlement.js";
import {
  assertLedgerInvariant,
} from "./settlement/test-helpers.js";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.runIf(hasDb)("positions API (M1.2)", () => {
  const pool = getPool()!;
  const runId = `pos-it-${Date.now()}`;
  const emailA = `${runId}-a@test.local`;
  const emailB = `${runId}-b@test.local`;

  const promisedAt = new Date("2035-06-01T12:00:00.000Z");
  const settleAt = new Date("2035-06-01T13:01:00.000Z");
  const venue = { lat: 36.374, lng: 127.365 };
  const nearVenue = { lat: 36.3741, lng: 127.3651 };

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
          `DELETE FROM self_stock_lots WHERE user_id = ANY($1::bigint[])`,
          [ids],
        );
        await client.query(
          `DELETE FROM self_stock_options WHERE user_id = ANY($1::bigint[])`,
          [ids],
        );
        await client.query(
          `DELETE FROM positions WHERE investor_id = ANY($1::bigint[])`,
          [ids],
        );
        await client.query(
          `DELETE FROM point_transactions WHERE user_id = ANY($1::bigint[])`,
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

  it("가입·친구·약속 준비", async () => {
    const a = await signupUser(emailA, "password12", "철수");
    userAId = a.id;
    const b = await signupUser(emailB, "password12", "영희");
    userBId = b.id;

    const req = await sendFriendRequest(userAId, userBId);
    await acceptFriendRequest(req.id, userBId);

    const created = await createPromise(userAId, {
      title: "점심",
      placeName: "강남역",
      latitude: venue.lat,
      longitude: venue.lng,
      promisedAt,
      inviteUserIds: [userBId],
    });
    promiseId = created.id;
    await respondToInvite(userBId, promiseId, "accept");
  });

  it("잔액 부족·자기주식 거부", async () => {
    await expect(
      openPosition(userBId, {
        stockUserId: userBId,
        promiseId,
        direction: "buy",
        quantity: 1,
      }),
    ).rejects.toMatchObject({ status: 403 });

    await expect(
      openPosition(userAId, {
        stockUserId: userBId,
        promiseId,
        direction: "short",
        quantity: 10_000,
      }),
    ).rejects.toMatchObject({ status: 402 });
  });

  it("공매도 포지션 개설 → 잠금 반영", async () => {
    const position = await openPosition(userAId, {
      stockUserId: userBId,
      promiseId,
      direction: "short",
      quantity: 3,
    });

    expect(position).toMatchObject({
      stockUserId: userBId,
      promiseId,
      direction: "short",
      quantity: 3,
      openPrice: BASE_STOCK_PRICE,
      lockedPoints: 30_000,
      status: "open",
    });

    const balance = await pool.query<{ available_points: number }>(
      `SELECT available_points FROM users WHERE id = $1`,
      [userAId],
    );
    expect(balance.rows[0]!.available_points).toBe(INITIAL_POINTS - 30_000);
    await assertLedgerInvariant(pool, userAId);
  });

  it("중복 포지션 거부", async () => {
    await expect(
      openPosition(userAId, {
        stockUserId: userBId,
        promiseId,
        direction: "buy",
        quantity: 1,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("지각 정산 후 손익 반영", async () => {
    await checkinToPromise(userAId, promiseId, nearVenue.lat, nearVenue.lng);
    const lateCheckin = new Date(promisedAt.getTime() + 32 * 60_000);
    await pool.query(
      `UPDATE promise_participants SET checkin_at = $3
       WHERE promise_id = $1 AND user_id = $2`,
      [promiseId, userBId, lateCheckin],
    );

    const result = await runSettlement(pool, {
      promiseId: Number(promiseId),
      now: settleAt,
    });
    expect(result.settledIds).toContain(Number(promiseId));

    const positions = await listPositions(userAId, "settled");
    const settled = positions.find((p) => p.promiseId === promiseId);
    expect(settled).toMatchObject({
      payout: 9600,
      priceBefore: 10_000,
      priceAfter: 6800,
      status: "settled",
    });

    const balance = await pool.query<{ available_points: number }>(
      `SELECT available_points FROM users WHERE id = $1`,
      [userAId],
    );
    expect(balance.rows[0]!.available_points).toBe(
      INITIAL_POINTS - 30_000 + 30_000 + 9600 + 500,
    );
    await assertLedgerInvariant(pool, userAId);
  });

  it("베팅 마감 후 개설 거부", async () => {
    const runId2 = `${runId}-late`;
    const emailC = `${runId2}-c@test.local`;
    const emailD = `${runId2}-d@test.local`;
    const c = await signupUser(emailC, "password12", "민수");
    const d = await signupUser(emailD, "password12", "지수");
    const req = await sendFriendRequest(c.id, d.id);
    await acceptFriendRequest(req.id, d.id);

    const pastPromisedAt = new Date("2020-01-01T12:00:00Z");
    const pastSettleDue = new Date("2020-01-01T13:00:00Z");
    const inserted = await pool.query<{ id: string }>(
      `INSERT INTO promises (creator_id, title, place_name, latitude, longitude, promised_at, settle_due_at)
       VALUES ($1, '과거 약속', '서울', $2, $3, $4, $5)
       RETURNING id`,
      [c.id, venue.lat, venue.lng, pastPromisedAt, pastSettleDue],
    );
    const pastPromiseId = inserted.rows[0]!.id;
    await pool.query(
      `INSERT INTO promise_participants (promise_id, user_id, invite_status, responded_at)
       VALUES ($1, $2, 'accepted', now()), ($1, $3, 'accepted', now())`,
      [pastPromiseId, c.id, d.id],
    );

    await expect(
      openPosition(c.id, {
        stockUserId: d.id,
        promiseId: pastPromiseId,
        direction: "short",
        quantity: 1,
      }),
    ).rejects.toMatchObject({ status: 409 });

    await pool.query(
      `DELETE FROM point_transactions WHERE user_id = ANY($1::bigint[])`,
      [[c.id, d.id]],
    );
    await pool.query(
      `DELETE FROM promise_participants WHERE promise_id = $1`,
      [pastPromiseId],
    );
    await pool.query(`DELETE FROM promises WHERE id = $1`, [pastPromiseId]);
    await pool.query(
      `DELETE FROM friendships
       WHERE requester_id = ANY($1::bigint[]) OR addressee_id = ANY($1::bigint[])`,
      [[c.id, d.id]],
    );
    await pool.query(`DELETE FROM users WHERE id = ANY($1::bigint[])`, [
      [c.id, d.id],
    ]);
  });
});
