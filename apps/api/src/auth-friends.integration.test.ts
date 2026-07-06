/**
 * M1.1-1/1-2 통합 테스트 — DATABASE_URL 필요.
 */
import "./load-env.js";
import { INITIAL_POINTS, BASE_STOCK_PRICE } from "@latestock/shared";
import { afterAll, describe, expect, it } from "vitest";
import { getPool } from "./db/pool.js";
import {
  getLedgerSum,
  getUserProfile,
  loginUser,
  signupUser,
} from "./services/auth.js";
import {
  acceptFriendRequest,
  listFriends,
  listIncomingFriendRequests,
  sendFriendRequest,
} from "./services/friends.js";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.runIf(hasDb)("auth & friends integration (M1.1)", () => {
  const pool = getPool()!;
  const runId = `auth-it-${Date.now()}`;
  const emailA = `${runId}-a@test.local`;
  const emailB = `${runId}-b@test.local`;
  let userAId: string;
  let userBId: string;
  let requestId: string;

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
          `DELETE FROM point_transactions WHERE user_id = ANY($1::bigint[])`,
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

  it("가입: 포인트 100000, 주가 10000, 원장 불변식", async () => {
    const a = await signupUser(emailA, "password12", "철수");
    userAId = a.id;
    expect(a.availablePoints).toBe(INITIAL_POINTS);
    expect(a.currentPrice).toBe(BASE_STOCK_PRICE);
    expect(await getLedgerSum(a.id)).toBe(INITIAL_POINTS);

    const b = await signupUser(emailB, "password12", "영희");
    userBId = b.id;
    expect(b.availablePoints).toBe(INITIAL_POINTS);
  });

  it("로그인 및 프로필 조회", async () => {
    const loggedIn = await loginUser(emailA, "password12");
    expect(loggedIn.id).toBe(userAId);

    const profile = await getUserProfile(userAId);
    expect(profile.nickname).toBe("철수");
  });

  it("친구 요청 → 수락 → 목록에 표시", async () => {
    const req = await sendFriendRequest(userAId, userBId);
    requestId = req.id;

    const incoming = await listIncomingFriendRequests(userBId);
    expect(incoming.some((r) => r.id === requestId)).toBe(true);

    await acceptFriendRequest(requestId, userBId);

    const friendsA = await listFriends(userAId);
    const friendsB = await listFriends(userBId);
    expect(friendsA.some((f) => f.userId === userBId)).toBe(true);
    expect(friendsB.some((f) => f.userId === userAId)).toBe(true);
  });

  it("자기 요청 및 중복 요청 거부", async () => {
    await expect(sendFriendRequest(userAId, userAId)).rejects.toMatchObject({
      status: 400,
    });
    await expect(sendFriendRequest(userAId, userBId)).rejects.toMatchObject({
      status: 409,
    });
  });
});

describe.runIf(!hasDb)("auth & friends integration (M1.1)", () => {
  it.skip("DATABASE_URL 없음 — 통합 테스트 스킵", () => {});
});
