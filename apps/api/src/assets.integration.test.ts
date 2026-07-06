/**
 * M1.2-3 통합 테스트 — DATABASE_URL 필요.
 */
import "./load-env.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPool } from "./db/pool.js";
import { getAssetSummary, listTransactions } from "./services/assets.js";
import {
  cleanupGoldenCase,
  seedGoldenCase,
  type GoldenCaseSeed,
} from "./settlement/test-helpers.js";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.runIf(hasDb)("assets & ledger integration (M1.2-3)", () => {
  const pool = getPool()!;
  let seed: GoldenCaseSeed;

  beforeAll(async () => {
    seed = await seedGoldenCase(pool);
  });

  afterAll(async () => {
    if (seed) await cleanupGoldenCase(pool, seed);
  });

  it("가용/잠금 포인트: 철수는 공매도 포지션만큼 잠겨 있고, 영희는 전액 가용", async () => {
    const chulsoo = await getAssetSummary(seed.chulsooId.toString());
    expect(chulsoo).toEqual({ availablePoints: 70_000, lockedPoints: 30_000 });

    const younghee = await getAssetSummary(seed.youngheeId.toString());
    expect(younghee).toEqual({ availablePoints: 100_000, lockedPoints: 0 });
  });

  it("원장: 철수는 잠금 내역이 최신순으로 가입 지급 위에 온다", async () => {
    const transactions = await listTransactions(seed.chulsooId.toString());
    expect(transactions).toHaveLength(2);
    expect(transactions[0]).toMatchObject({
      amount: -30_000,
      txType: "position_lock",
      refId: seed.positionId.toString(),
    });
    expect(transactions[1]).toMatchObject({
      amount: 100_000,
      txType: "signup_grant",
      refId: null,
    });
  });

  it("원장: 영희는 가입 지급 내역만 있다", async () => {
    const transactions = await listTransactions(seed.youngheeId.toString());
    expect(transactions).toEqual([
      expect.objectContaining({
        amount: 100_000,
        txType: "signup_grant",
        refId: null,
      }),
    ]);
  });
});

describe.runIf(!hasDb)("assets & ledger integration (M1.2-3)", () => {
  it.skip("DATABASE_URL 없음 — 통합 테스트 스킵", () => {});
});
