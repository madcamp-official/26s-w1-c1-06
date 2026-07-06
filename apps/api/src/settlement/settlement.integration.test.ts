/**
 * M1.0 통합 테스트 — DATABASE_URL(Neon 등) 필요.
 * 로컬: 프로젝트 루트 .env 설정 후 `npm run test:integration --workspace @latestock/api`
 */
import "../load-env.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFENSE_REWARD_POINTS } from "@latestock/shared";
import { getPool } from "../db/pool.js";
import { runSettlement } from "./run-settlement.js";
import {
  assertLedgerInvariant,
  cleanupGoldenCase,
  getChulsooBalance,
  seedGoldenCase,
  type GoldenCaseSeed,
} from "./test-helpers.js";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.runIf(hasDb)("settlement integration (M1.0)", () => {
  const pool = getPool()!;
  let seed: GoldenCaseSeed;
  const settleNow = new Date("2020-06-01T15:00:00Z");

  beforeAll(async () => {
    seed = await seedGoldenCase(pool);
  });

  afterAll(async () => {
    if (seed) await cleanupGoldenCase(pool, seed);
  });

  it("골든 케이스: 영희 32분 지각 → 6800, 공매도 수익 +9600", async () => {
    const first = await runSettlement(pool, {
      promiseId: seed.promiseId,
      now: settleNow,
    });
    expect(first.settledIds).toEqual([seed.promiseId]);
    expect(first.skippedIds).toEqual([]);

    const younghee = await pool.query<{ current_price: number }>(
      `SELECT current_price FROM users WHERE id = $1`,
      [seed.youngheeId],
    );
    expect(younghee.rows[0]!.current_price).toBe(6800);

    const pos = await pool.query<{
      payout: number;
      price_before: number;
      price_after: number;
      status: string;
    }>(`SELECT payout, price_before, price_after, status FROM positions WHERE id = $1`, [
      seed.positionId,
    ]);
    expect(pos.rows[0]).toMatchObject({
      payout: 9600,
      price_before: 10_000,
      price_after: 6800,
      status: "settled",
    });

    const pp = await pool.query<{ verdict: string; late_minutes: number }>(
      `SELECT verdict, late_minutes FROM promise_participants
       WHERE promise_id = $1 AND user_id = $2`,
      [seed.promiseId, seed.youngheeId],
    );
    expect(pp.rows[0]).toMatchObject({ verdict: "late", late_minutes: 32 });

    // 철수: 잠금 해제 +9600 + 정시 방어 보상 500 (M1.0-1 ⑥)
    const expectedBalance =
      100_000 - 30_000 + 30_000 + 9600 + DEFENSE_REWARD_POINTS;
    expect(await getChulsooBalance(pool, seed.chulsooId)).toBe(expectedBalance);

    await assertLedgerInvariant(pool, seed.chulsooId);
    await assertLedgerInvariant(pool, seed.youngheeId);

    const promise = await pool.query<{ settled_at: Date | null }>(
      `SELECT settled_at FROM promises WHERE id = $1`,
      [seed.promiseId],
    );
    expect(promise.rows[0]!.settled_at).not.toBeNull();
  });

  it("멱등: 두 번째 정산은 skipped이고 잔액·가격 변화 없음", async () => {
    const balanceBefore = await getChulsooBalance(pool, seed.chulsooId);
    const priceBefore = (
      await pool.query<{ current_price: number }>(
        `SELECT current_price FROM users WHERE id = $1`,
        [seed.youngheeId],
      )
    ).rows[0]!.current_price;
    const txCountBefore = (
      await pool.query<{ cnt: string }>(
        `SELECT count(*)::text AS cnt FROM point_transactions WHERE user_id = $1`,
        [seed.chulsooId],
      )
    ).rows[0]!.cnt;

    const second = await runSettlement(pool, {
      promiseId: seed.promiseId,
      now: settleNow,
    });
    expect(second.settledIds).toEqual([]);
    expect(second.skippedIds).toEqual([seed.promiseId]);

    expect(await getChulsooBalance(pool, seed.chulsooId)).toBe(balanceBefore);
    const priceAfter = (
      await pool.query<{ current_price: number }>(
        `SELECT current_price FROM users WHERE id = $1`,
        [seed.youngheeId],
      )
    ).rows[0]!.current_price;
    expect(priceAfter).toBe(priceBefore);

    const txCountAfter = (
      await pool.query<{ cnt: string }>(
        `SELECT count(*)::text AS cnt FROM point_transactions WHERE user_id = $1`,
        [seed.chulsooId],
      )
    ).rows[0]!.cnt;
    expect(txCountAfter).toBe(txCountBefore);
  });
});

describe.runIf(!hasDb)("settlement integration (M1.0)", () => {
  it.skip("DATABASE_URL 없음 — 통합 테스트 스킵", () => {});
});
