/**
 * S-03 ETF 바스켓 통합 테스트 — DATABASE_URL 필요.
 * 3-leg 바스켓 개설 → leg별로 서로 다른 검증에 걸리는 케이스 → 각 leg가
 * 서로 다른 시각에 개별 정산되며 부분 정산 상태가 정확히 반영되는지 확인한다.
 */
import "./load-env.js";
import { BASE_STOCK_PRICE, INITIAL_POINTS } from "@latestock/shared";
import { afterAll, describe, expect, it } from "vitest";
import { getPool } from "./db/pool.js";
import { signupUser } from "./services/auth.js";
import { acceptFriendRequest, sendFriendRequest } from "./services/friends.js";
import {
  getEtfRecommendations,
  listEtfBaskets,
  openEtfBasket,
} from "./services/etf.js";
import { listPositions } from "./services/positions.js";
import { createPromise, respondToInvite } from "./services/promises.js";
import { runSettlement } from "./settlement/run-settlement.js";
import { assertLedgerInvariant } from "./settlement/test-helpers.js";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.runIf(hasDb)("ETF 바스켓 (S-03)", () => {
  const pool = getPool()!;
  const runId = `etf-it-${Date.now()}`;
  const emailInvestor = `${runId}-cheolsu@test.local`;
  const emailA = `${runId}-younghee@test.local`;
  const emailB = `${runId}-minsu@test.local`;
  const emailC = `${runId}-jihoon@test.local`;
  const emailStranger = `${runId}-stranger@test.local`;

  const promisedAt = new Date("2033-01-01T12:00:00.000Z");
  const venue = { lat: 37.49, lng: 127.02 };

  let investorId: string;
  let youngheeId: string;
  let minsuId: string;
  let jihoonId: string;
  let strangerId: string;
  let promiseA: string; // 영희 대상
  let promiseB: string; // 민수 대상
  let promiseC: string; // 지훈 대상

  afterAll(async () => {
    const ids = [investorId, youngheeId, minsuId, jihoonId, strangerId]
      .filter(Boolean)
      .map(Number);
    if (ids.length === 0) return;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
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
        `DELETE FROM etf_orders WHERE investor_id = ANY($1::bigint[])`,
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
      await client.query(`DELETE FROM promises WHERE creator_id = ANY($1::bigint[])`, [
        ids,
      ]);
      await client.query(
        `DELETE FROM friendships
         WHERE requester_id = ANY($1::bigint[]) OR addressee_id = ANY($1::bigint[])`,
        [ids],
      );
      await client.query(`DELETE FROM users WHERE id = ANY($1::bigint[])`, [ids]);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  });

  it("가입·친구·약속 3건 준비", async () => {
    // 원격 Neon DB 왕복(가입 5회 + 친구 6회 + 약속 6회)이 기본 타임아웃(5s)보다 오래 걸릴 수 있음.
    const investor = await signupUser(emailInvestor, "password12", "철수");
    investorId = investor.id;
    const a = await signupUser(emailA, "password12", "영희");
    youngheeId = a.id;
    const b = await signupUser(emailB, "password12", "민수");
    minsuId = b.id;
    const c = await signupUser(emailC, "password12", "지훈");
    jihoonId = c.id;
    const stranger = await signupUser(emailStranger, "password12", "모르는사람");
    strangerId = stranger.id;

    for (const friendId of [youngheeId, minsuId, jihoonId]) {
      const req = await sendFriendRequest(investorId, friendId);
      await acceptFriendRequest(req.id, friendId);
    }

    const pA = await createPromise(investorId, {
      title: "약속A",
      placeName: "강남역",
      latitude: venue.lat,
      longitude: venue.lng,
      promisedAt,
      inviteUserIds: [youngheeId],
    });
    promiseA = pA.id;
    await respondToInvite(youngheeId, promiseA, "accept");

    const pB = await createPromise(investorId, {
      title: "약속B",
      placeName: "강남역",
      latitude: venue.lat,
      longitude: venue.lng,
      promisedAt,
      inviteUserIds: [minsuId],
    });
    promiseB = pB.id;
    await respondToInvite(minsuId, promiseB, "accept");

    const pC = await createPromise(investorId, {
      title: "약속C",
      placeName: "강남역",
      latitude: venue.lat,
      longitude: venue.lng,
      promisedAt,
      inviteUserIds: [jihoonId],
    });
    promiseC = pC.id;
    await respondToInvite(jihoonId, promiseC, "accept");
  }, 20_000);

  it("이 약속의 참여자가 아닌 유저 포함 → 404, 전체 롤백(포인트 안 깎임)", async () => {
    await expect(
      openEtfBasket(investorId, {
        direction: "short",
        quantity: 2,
        legs: [
          { stockUserId: youngheeId, promiseId: promiseA },
          { stockUserId: strangerId, promiseId: promiseA },
        ],
      }),
    ).rejects.toMatchObject({ status: 404 });

    const balance = await pool.query<{ available_points: number }>(
      `SELECT available_points FROM users WHERE id = $1`,
      [investorId],
    );
    expect(balance.rows[0]!.available_points).toBe(INITIAL_POINTS);
  });

  it("legs 2개 미만 → 400", async () => {
    await expect(
      openEtfBasket(investorId, {
        direction: "short",
        quantity: 1,
        legs: [{ stockUserId: youngheeId, promiseId: promiseA }],
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("가용 포인트 부족 → 402, 전체 롤백(부분 개설 없음)", async () => {
    await expect(
      openEtfBasket(investorId, {
        direction: "short",
        quantity: 10_000,
        legs: [
          { stockUserId: youngheeId, promiseId: promiseA },
          { stockUserId: minsuId, promiseId: promiseB },
        ],
      }),
    ).rejects.toMatchObject({ status: 402 });

    const balance = await pool.query<{ available_points: number }>(
      `SELECT available_points FROM users WHERE id = $1`,
      [investorId],
    );
    expect(balance.rows[0]!.available_points).toBe(INITIAL_POINTS);

    const baskets = await listEtfBaskets(investorId);
    expect(baskets).toHaveLength(0);
  });

  it("3-leg 바스켓 개설 → 잠금 60,000 반영", async () => {
    const basket = await openEtfBasket(investorId, {
      direction: "short",
      quantity: 2,
      label: "시한폭탄 트리오",
      legs: [
        { stockUserId: youngheeId, promiseId: promiseA },
        { stockUserId: minsuId, promiseId: promiseB },
        { stockUserId: jihoonId, promiseId: promiseC },
      ],
    });

    expect(basket.legs).toHaveLength(3);
    expect(basket.totalLocked).toBe(2 * BASE_STOCK_PRICE * 3);
    expect(basket.isFullySettled).toBe(false);
    expect(basket.legs.every((leg) => leg.status === "open")).toBe(true);

    const balance = await pool.query<{ available_points: number }>(
      `SELECT available_points FROM users WHERE id = $1`,
      [investorId],
    );
    expect(balance.rows[0]!.available_points).toBe(
      INITIAL_POINTS - 2 * BASE_STOCK_PRICE * 3,
    );
    await assertLedgerInvariant(pool, Number(investorId));
  });

  it("이미 바스켓에 들어간 (종목,약속) 재사용 시도 → 409", async () => {
    await expect(
      openEtfBasket(investorId, {
        direction: "buy",
        quantity: 1,
        legs: [
          { stockUserId: youngheeId, promiseId: promiseA },
          { stockUserId: minsuId, promiseId: promiseB },
        ],
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("영희(약속A) 25분 지각 정산 → leg 1개만 부분 정산", async () => {
    const lateCheckin = new Date(promisedAt.getTime() + 25 * 60_000);
    await pool.query(
      `UPDATE promise_participants SET checkin_at = $3 WHERE promise_id = $1 AND user_id = $2`,
      [promiseA, youngheeId, lateCheckin],
    );

    await runSettlement(pool, { promiseId: Number(promiseA), now: lateCheckin });

    const [basket] = await listEtfBaskets(investorId);
    expect(basket).toBeDefined();
    expect(basket!.isFullySettled).toBe(false);
    expect(basket!.realizedPayout).toBe(5000); // 2 * (10000 - 7500)

    const youngheeLeg = basket!.legs.find((leg) => leg.stockUserId === youngheeId);
    expect(youngheeLeg?.status).toBe("settled");
    expect(youngheeLeg?.payout).toBe(5000);

    const minsuLeg = basket!.legs.find((leg) => leg.stockUserId === minsuId);
    expect(minsuLeg?.status).toBe("open");

    await assertLedgerInvariant(pool, Number(investorId));
  });

  it("민수(약속B) 정시 정산 → 손실 반영, 여전히 부분 정산", async () => {
    await pool.query(
      `UPDATE promise_participants SET checkin_at = $3 WHERE promise_id = $1 AND user_id = $2`,
      [promiseB, minsuId, promisedAt],
    );
    await runSettlement(pool, { promiseId: Number(promiseB), now: promisedAt });

    const [basket] = await listEtfBaskets(investorId);
    expect(basket!.isFullySettled).toBe(false);
    expect(basket!.realizedPayout).toBe(5000 - 600); // 2 * (10000 - 10300) = -600

    await assertLedgerInvariant(pool, Number(investorId));
  });

  it("지훈(약속C) 노쇼 정산 → 바스켓 전체 정산 완료", async () => {
    const settleTime = new Date(promisedAt.getTime() + 61 * 60_000);
    await runSettlement(pool, { promiseId: Number(promiseC), now: settleTime });

    const [basket] = await listEtfBaskets(investorId);
    expect(basket!.isFullySettled).toBe(true);
    expect(basket!.realizedPayout).toBe(5000 - 600 + 12000); // 2 * (10000 - 4000) = 12000

    const balance = await pool.query<{ available_points: number }>(
      `SELECT available_points FROM users WHERE id = $1`,
      [investorId],
    );
    expect(balance.rows[0]!.available_points).toBe(
      INITIAL_POINTS - 60_000 + 60_000 + 16_400,
    );
    await assertLedgerInvariant(pool, Number(investorId));
  });

  it("일반 포지션 목록에는 ETF leg가 보이지 않는다 (중복 표시 방지)", async () => {
    const positions = await listPositions(investorId);
    expect(positions.some((p) => p.stockUserId === youngheeId)).toBe(false);
  });

  it("추천 ETF는 저장 없이 계산되며, 베팅 가능 약속이 없으면 빈 배열", async () => {
    const recs = await getEtfRecommendations(investorId);
    expect(recs).toEqual([]);
  });
});
