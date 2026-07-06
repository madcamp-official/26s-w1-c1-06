/**
 * M1.3 미확인 정산 배너 통합 테스트 — DATABASE_URL 필요.
 */
import "./load-env.js";
import { afterAll, describe, expect, it } from "vitest";
import { getPool } from "./db/pool.js";
import { signupUser } from "./services/auth.js";
import {
  acceptFriendRequest,
  sendFriendRequest,
} from "./services/friends.js";
import { confirmPosition, openPosition } from "./services/positions.js";
import {
  checkinToPromise,
  confirmParticipation,
  createPromise,
  respondToInvite,
} from "./services/promises.js";
import { getUnconfirmedSettlements } from "./services/settlement-inbox.js";
import { runSettlement } from "./settlement/run-settlement.js";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.runIf(hasDb)("unconfirmed settlements API (M1.3)", () => {
  const pool = getPool()!;
  const runId = `inbox-it-${Date.now()}`;
  const emailA = `${runId}-a@test.local`;
  const emailB = `${runId}-b@test.local`;

  const promisedAt = new Date("2035-06-01T12:00:00.000Z");
  const settleAt = new Date("2035-06-01T13:01:00.000Z");
  const venue = { lat: 36.374, lng: 127.365 };

  let userAId: string; // 투자자(철수) — 영희에 공매도
  let userBId: string; // 종목(영희) — 32분 지각
  let promiseId: string;
  let positionId: string;

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

  it("가입·친구·약속·포지션 준비", async () => {
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

    const position = await openPosition(userAId, {
      stockUserId: userBId,
      promiseId,
      direction: "short",
      quantity: 3,
    });
    positionId = position.id;
  });

  it("정산 전: 양쪽 다 미확인 목록 비어있음", async () => {
    expect(await getUnconfirmedSettlements(userAId)).toEqual({
      asStock: [],
      asInvestor: [],
      totalCount: 0,
    });
    expect(await getUnconfirmedSettlements(userBId)).toEqual({
      asStock: [],
      asInvestor: [],
      totalCount: 0,
    });
  });

  it("32분 지각 정산 후: 영희는 asStock에, 철수는 asInvestor에 뜬다", async () => {
    const lateCheckin = new Date(promisedAt.getTime() + 32 * 60_000);
    await checkinToPromise(userAId, promiseId, venue.lat, venue.lng);
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

    const bInbox = await getUnconfirmedSettlements(userBId);
    expect(bInbox.totalCount).toBe(1);
    expect(bInbox.asStock).toEqual([
      expect.objectContaining({
        promiseId,
        verdict: "late",
        lateMinutes: 32,
        settledPrice: 6800,
      }),
    ]);
    expect(bInbox.asInvestor).toEqual([]);

    // 철수는 투자자(공매도 포지션)이면서 동시에 자기 약속의 참여자(정시 도착)라
    // asStock에 본인 판정, asInvestor에 포지션 손익이 둘 다 잡힌다.
    const aInbox = await getUnconfirmedSettlements(userAId);
    expect(aInbox.totalCount).toBe(2);
    expect(aInbox.asStock).toEqual([
      expect.objectContaining({ promiseId, verdict: "on_time", lateMinutes: 0 }),
    ]);
    expect(aInbox.asInvestor).toEqual([
      expect.objectContaining({
        positionId,
        promiseId,
        stockUserId: userBId,
        payout: 9600,
      }),
    ]);
  });

  it("확인 처리 후 각자 목록에서 사라진다", async () => {
    await confirmParticipation(userBId, promiseId);
    expect((await getUnconfirmedSettlements(userBId)).totalCount).toBe(0);

    await confirmParticipation(userAId, promiseId);
    await confirmPosition(userAId, positionId);
    expect((await getUnconfirmedSettlements(userAId)).totalCount).toBe(0);
  });

  it("중복 확인은 409", async () => {
    await expect(
      confirmParticipation(userBId, promiseId),
    ).rejects.toMatchObject({ status: 409 });
    await expect(confirmPosition(userAId, positionId)).rejects.toMatchObject({
      status: 409,
    });
  });

  it("남의 포지션 확인 시도는 403", async () => {
    await expect(confirmPosition(userBId, positionId)).rejects.toMatchObject({
      status: 403,
    });
  });

  it("존재하지 않는 참여/포지션 확인 시도는 404", async () => {
    await expect(
      confirmParticipation(userAId, "0"),
    ).rejects.toMatchObject({ status: 404 });
    await expect(confirmPosition(userAId, "0")).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe.runIf(!hasDb)("unconfirmed settlements API (M1.3)", () => {
  it.skip("DATABASE_URL 없음 — 통합 테스트 스킵", () => {});
});
