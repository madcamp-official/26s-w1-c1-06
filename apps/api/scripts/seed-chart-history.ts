/**
 * 친구들의 주가 차트 이력(더미) 생성 — 약속을 만들어 과거 시각으로 당긴 뒤 다양한 지각
 * 패턴으로 체크인을 심어두고, 실제 정산 엔진(runSettlementNow)으로 한 번에 정산한다.
 * 가격 계산 로직은 손대지 않고 그대로 재사용하므로 결과가 실제 서비스 로직과 항상 일치한다.
 *
 * 전제: seed-market-friends.ts로 만든 친구 5명이 이미 있어야 한다.
 *
 * 사용: npx tsx scripts/seed-chart-history.ts --target "허서준1"
 */
import "../src/load-env.js";
import { NO_SHOW_MINUTES } from "@latestock/shared";
import pg from "pg";
import { runSettlementNow } from "../src/settlement/scheduler.js";

const TARGET_NICKNAME = process.argv.includes("--target")
  ? (process.argv[process.argv.indexOf("--target") + 1] ?? "허서준1")
  : "허서준1";

/** null = 노쇼(체크인 없음), 숫자 = 그만큼 지각(0 = 정시). 앞쪽이 더 과거 시점. */
const FRIEND_SCENARIOS: Record<string, (number | null)[]> = {
  김민지: [0, 0, 5, 0, 0, 20, 0, 0],
  박준호: [45, 30, 20, null, 15, 10, 50, 40],
  이서연: [0, 45, 0, 10, null, 0, 5, 0],
  최도윤: [null, 45, 30, 10, 0, 0, 0, 5],
  정하은: [0, 0, 10, 20, 45, null, 50, 0],
};

const HOURS_BETWEEN = 6;

interface UserRow {
  id: string;
  nickname: string;
}

async function findUserByNickname(
  client: pg.PoolClient,
  nickname: string,
): Promise<UserRow | null> {
  const r = await client.query<UserRow>(
    `SELECT id::text, nickname FROM users WHERE nickname = $1 LIMIT 1`,
    [nickname],
  );
  return r.rows[0] ?? null;
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL 없음");
    process.exit(1);
  }

  const pool = new pg.Pool({
    connectionString: url,
    ssl:
      url.includes("neon.tech") || url.includes("sslmode=require")
        ? { rejectUnauthorized: false }
        : undefined,
  });

  const client = await pool.connect();
  try {
    const target = await findUserByNickname(client, TARGET_NICKNAME);
    if (!target) {
      console.error(`'${TARGET_NICKNAME}' 닉네임 사용자를 찾을 수 없습니다.`);
      process.exit(1);
    }
    console.log(`대상: [${target.id}] ${target.nickname}`);

    let created = 0;

    for (const [friendNick, scenario] of Object.entries(FRIEND_SCENARIOS)) {
      const friend = await findUserByNickname(client, friendNick);
      if (!friend) {
        console.warn(`'${friendNick}' 없음 — seed-market-friends.ts 먼저 실행하세요. 스킵.`);
        continue;
      }

      await client.query("BEGIN");
      for (let i = 0; i < scenario.length; i++) {
        const lateMinutes = scenario[i]!;
        const promisedAt = new Date(
          Date.now() - (scenario.length - i) * HOURS_BETWEEN * 60 * 60 * 1000,
        );
        const settleDueAt = new Date(promisedAt.getTime() + NO_SHOW_MINUTES * 60_000);

        const inserted = await client.query<{ id: string }>(
          `INSERT INTO promises (creator_id, title, place_name, latitude, longitude, promised_at, settle_due_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id::text`,
          [
            target.id,
            `${friendNick}와의 약속 #${i + 1}`,
            "강남역 스타벅스",
            37.4979,
            127.0276,
            promisedAt,
            settleDueAt,
          ],
        );
        const promiseId = inserted.rows[0]!.id;

        await client.query(
          `INSERT INTO promise_participants (promise_id, user_id, invite_status, responded_at, checkin_at)
           VALUES ($1, $2, 'accepted', now(), $3)`,
          [promiseId, target.id, promisedAt],
        );

        const friendCheckinAt =
          lateMinutes === null ? null : new Date(promisedAt.getTime() + lateMinutes * 60_000);
        await client.query(
          `INSERT INTO promise_participants (promise_id, user_id, invite_status, responded_at, checkin_at)
           VALUES ($1, $2, 'accepted', now(), $3)`,
          [promiseId, friend.id, friendCheckinAt],
        );

        created += 1;
      }
      await client.query("COMMIT");
      console.log(`${friendNick}: 약속 ${scenario.length}개 생성`);
    }

    console.log(`\n총 ${created}개 약속 생성. 정산 실행 중...`);
    const result = await runSettlementNow({});
    console.log(`정산 완료: settled=${result.settledIds.length} failed=${result.failedIds.length}`);
    if (result.failedIds.length > 0) {
      console.error("실패 목록:", result.failedIds);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
