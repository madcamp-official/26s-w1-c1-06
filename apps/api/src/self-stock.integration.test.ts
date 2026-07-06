/**
 * M1.2 자기주식 API 통합 테스트 — DATABASE_URL 필요.
 */
import "./load-env.js";
import { INITIAL_POINTS, SELF_STOCK_OPTION_LIMIT } from "@latestock/shared";
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
import {
  exerciseOption,
  listActiveOptions,
  listLots,
  sellLot,
} from "./services/self-stock.js";
import { runSettlement } from "./settlement/run-settlement.js";
import { assertLedgerInvariant } from "./settlement/test-helpers.js";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.runIf(hasDb)("self-stock API (M1.2)", () => {
  const pool = getPool()!;
  const runId = `self-it-${Date.now()}`;
  const emailA = `${runId}-a@test.local`;
  const emailB = `${runId}-b@test.local`;

  const promisedAt1 = new Date("2036-06-01T12:00:00.000Z");
  const settleAt1 = new Date("2036-06-01T13:01:00.000Z");
  const promisedAt2 = new Date("2036-06-02T12:00:00.000Z");
  const settleAt2 = new Date("2036-06-02T13:01:00.000Z");
  const venue = { lat: 36.374, lng: 127.365 };
  const nearVenue = { lat: 36.3741, lng: 127.3651 };

  let userAId: string;
  let userBId: string;
  let promise1Id: string;
  let promise2Id: string;

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

  it("준비: 가입·친구·약속 2건", async () => {
    const a = await signupUser(emailA, "password12", "철수");
    userAId = a.id;
    const b = await signupUser(emailB, "password12", "영희");
    userBId = b.id;

    const req = await sendFriendRequest(userAId, userBId);
    await acceptFriendRequest(req.id, userBId);

    const p1 = await createPromise(userAId, {
      title: "정시 약속",
      placeName: "강남역",
      latitude: venue.lat,
      longitude: venue.lng,
      promisedAt: promisedAt1,
      inviteUserIds: [userBId],
    });
    promise1Id = p1.id;
    await respondToInvite(userBId, promise1Id, "accept");

    const p2 = await createPromise(userAId, {
      title: "가격 상승 약속",
      placeName: "강남역",
      latitude: venue.lat,
      longitude: venue.lng,
      promisedAt: promisedAt2,
      inviteUserIds: [userBId],
    });
    promise2Id = p2.id;
    await respondToInvite(userBId, promise2Id, "accept");
  });

  it("정시 정산 → F-17 권한 발급", async () => {
    await checkinToPromise(userAId, promise1Id, nearVenue.lat, nearVenue.lng);
    await checkinToPromise(userBId, promise1Id, nearVenue.lat, nearVenue.lng);

    await runSettlement(pool, {
      promiseId: Number(promise1Id),
      now: settleAt1,
    });

    const options = await listActiveOptions(userBId);
    expect(options).toHaveLength(1);
    expect(options[0]).toMatchObject({
      sourcePromiseId: promise1Id,
      quantityLimit: SELF_STOCK_OPTION_LIMIT,
    });
  });

  it("권한 행사 → 로트 생성", async () => {
    const options = await listActiveOptions(userBId);
    const optionId = options[0]!.id;
    const priceAtExercise = (
      await pool.query<{ current_price: number }>(
        `SELECT current_price FROM users WHERE id = $1`,
        [userBId],
      )
    ).rows[0]!.current_price;

    const lot = await exerciseOption(userBId, optionId, 2);
    expect(lot).toMatchObject({
      quantity: 2,
      acquiredPrice: priceAtExercise,
      canSell: false,
      unrealizedGain: null,
    });

    const balance = await pool.query<{ available_points: number }>(
      `SELECT available_points FROM users WHERE id = $1`,
      [userBId],
    );
    expect(balance.rows[0]!.available_points).toBe(
      INITIAL_POINTS + 500 - 2 * priceAtExercise,
    );
    await assertLedgerInvariant(pool, userBId);

    await expect(exerciseOption(userBId, optionId, 1)).rejects.toMatchObject({
      status: 409,
    });
  });

  it("취득가 이하 매도 거부 → 가격 상승 후 매도", async () => {
    const lotsBefore = await listLots(userBId);
    const lotId = lotsBefore[0]!.id;

    await expect(sellLot(userBId, lotId)).rejects.toMatchObject({
      status: 400,
    });

    await checkinToPromise(userAId, promise2Id, nearVenue.lat, nearVenue.lng);
    await checkinToPromise(userBId, promise2Id, nearVenue.lat, nearVenue.lng);
    await runSettlement(pool, {
      promiseId: Number(promise2Id),
      now: settleAt2,
    });

    const lotsAfter = await listLots(userBId);
    expect(lotsAfter[0]!.canSell).toBe(true);

    const acquiredPrice = lotsAfter[0]!.acquiredPrice;
    const currentPrice = lotsAfter[0]!.currentPrice;
    expect(currentPrice).toBeGreaterThan(acquiredPrice);

    const { proceeds, soldPrice } = await sellLot(userBId, lotId);
    expect(soldPrice).toBe(currentPrice);
    expect(proceeds).toBe(2 * currentPrice);

    const holding = await listLots(userBId);
    expect(holding).toHaveLength(0);
    await assertLedgerInvariant(pool, userBId);
  });
});
