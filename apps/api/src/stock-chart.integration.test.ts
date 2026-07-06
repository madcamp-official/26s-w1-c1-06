/**
 * M1.3 차트 API 통합 테스트 — DATABASE_URL 필요.
 */
import "./load-env.js";
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
import { getStockChart } from "./services/stock-chart.js";
import { runSettlement } from "./settlement/run-settlement.js";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.runIf(hasDb)("stock chart API (M1.3)", () => {
  const pool = getPool()!;
  const runId = `chart-it-${Date.now()}`;
  const emailA = `${runId}-a@test.local`;
  const emailB = `${runId}-b@test.local`;
  const emailC = `${runId}-c@test.local`;

  const promisedAt = new Date("2035-06-01T12:00:00.000Z");
  const settleAt = new Date("2035-06-01T13:01:00.000Z");
  const venue = { lat: 36.374, lng: 127.365 };
  const nearVenue = { lat: 36.3741, lng: 127.3651 };

  let userAId: string;
  let userBId: string;
  let userCId: string;
  let promiseId: string;

  afterAll(async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const users = await client.query<{ id: string }>(
        `SELECT id FROM users WHERE email = ANY($1::text[])`,
        [[emailA, emailB, emailC]],
      );
      const ids = users.rows.map((r) => r.id);
      if (ids.length > 0) {
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
    const c = await signupUser(emailC, "password12", "민수");
    userCId = c.id;

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

  it("정산 전: 본인/친구 차트 모두 빈 배열", async () => {
    expect(await getStockChart(userBId, userBId)).toEqual([]);
    expect(await getStockChart(userAId, userBId)).toEqual([]);
  });

  it("32분 지각 정산 후: 본인·친구 차트에 판정 포인트 반영", async () => {
    const lateCheckin = new Date(promisedAt.getTime() + 32 * 60_000);
    await checkinToPromise(userAId, promiseId, nearVenue.lat, nearVenue.lng);
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

    const ownChart = await getStockChart(userBId, userBId);
    expect(ownChart).toEqual([
      {
        promiseId,
        promisedAt: promisedAt.toISOString(),
        verdict: "late",
        lateMinutes: 32,
        settledPrice: 6800,
      },
    ]);

    const friendChart = await getStockChart(userAId, userBId);
    expect(friendChart).toEqual(ownChart);
  });

  it("비친구 조회 거부(403)", async () => {
    await expect(getStockChart(userCId, userBId)).rejects.toMatchObject({
      status: 403,
    });
  });

  it("존재하지 않는 사용자 조회(404)", async () => {
    await expect(getStockChart(userAId, "0")).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe.runIf(!hasDb)("stock chart API (M1.3)", () => {
  it.skip("DATABASE_URL 없음 — 통합 테스트 스킵", () => {});
});
