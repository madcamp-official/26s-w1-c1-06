/**
 * 김민지와 베팅 테스트용 예정 약속 생성.
 *
 * 사용: npx tsx scripts/seed-kimminji-promises.ts
 *       npx tsx scripts/seed-kimminji-promises.ts --target "허서준2"
 */
import "../src/load-env.js";
import { NO_SHOW_MINUTES } from "@latestock/shared";
import pg from "pg";

const TARGET_NICKNAME = process.argv.includes("--target")
  ? (process.argv[process.argv.indexOf("--target") + 1] ?? "허서준2")
  : "허서준2";

const FRIEND_NICKNAME = "김민지";

const PROMISES = [
  { title: "강남 카페 만남", placeName: "스타벅스 강남역점", hoursFromNow: 24 },
  { title: "점심 약속", placeName: "코엑스 몰", hoursFromNow: 48 },
  { title: "스터디 모임", placeName: "서울대입구역", hoursFromNow: 72 },
  { title: "저녁 식사", placeName: "홍대입구역", hoursFromNow: 96 },
] as const;

const LAT = 37.4979;
const LNG = 127.0276;

async function findUser(
  client: pg.PoolClient,
  nickname: string,
): Promise<{ id: string; email: string } | null> {
  const r = await client.query<{ id: string; email: string }>(
    `SELECT id::text, email FROM users WHERE nickname = $1 LIMIT 1`,
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
    ssl: url.includes("neon.tech") || url.includes("sslmode=require")
      ? { rejectUnauthorized: false }
      : undefined,
  });

  const client = await pool.connect();
  try {
    const target = await findUser(client, TARGET_NICKNAME);
    const friend = await findUser(client, FRIEND_NICKNAME);
    if (!target) {
      console.error(`'${TARGET_NICKNAME}' 사용자를 찾을 수 없습니다.`);
      process.exit(1);
    }
    if (!friend) {
      console.error(
        `'${FRIEND_NICKNAME}' 사용자를 찾을 수 없습니다. 먼저 seed-market-friends.ts를 실행하세요.`,
      );
      process.exit(1);
    }

    const friendship = await client.query(
      `SELECT 1 FROM friendships
       WHERE status = 'accepted'
         AND (
           (requester_id = $1::bigint AND addressee_id = $2::bigint)
           OR (requester_id = $2::bigint AND addressee_id = $1::bigint)
         )`,
      [target.id, friend.id],
    );
    if ((friendship.rowCount ?? 0) === 0) {
      console.error(`${TARGET_NICKNAME}와 ${FRIEND_NICKNAME}가 친구가 아닙니다.`);
      process.exit(1);
    }

    console.log(`대상: [${target.id}] ${TARGET_NICKNAME}`);
    console.log(`종목: [${friend.id}] ${FRIEND_NICKNAME}\n`);

    await client.query("BEGIN");

    const created: { id: string; title: string; promisedAt: Date }[] = [];

    for (const p of PROMISES) {
      const dup = await client.query<{ id: string }>(
        `SELECT p.id::text
         FROM promises p
         JOIN promise_participants pp ON pp.promise_id = p.id AND pp.user_id = $2::bigint
         WHERE p.creator_id = $1::bigint
           AND p.title = $3
           AND p.settled_at IS NULL
           AND p.promised_at > now()
         LIMIT 1`,
        [target.id, friend.id, p.title],
      );
      if (dup.rows[0]) {
        console.log(`⏭ 이미 있음: ${p.title} (id=${dup.rows[0].id})`);
        continue;
      }

      const promisedAt = new Date(Date.now() + p.hoursFromNow * 60 * 60 * 1000);
      const settleDueAt = new Date(
        promisedAt.getTime() + NO_SHOW_MINUTES * 60 * 1000,
      );

      const inserted = await client.query<{ id: string }>(
        `INSERT INTO promises
           (creator_id, title, place_name, latitude, longitude, promised_at, settle_due_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id::text`,
        [target.id, p.title, p.placeName, LAT, LNG, promisedAt, settleDueAt],
      );
      const promiseId = inserted.rows[0]!.id;

      await client.query(
        `INSERT INTO promise_participants (promise_id, user_id, invite_status, responded_at)
         VALUES ($1, $2, 'accepted', now())`,
        [promiseId, target.id],
      );
      await client.query(
        `INSERT INTO promise_participants (promise_id, user_id, invite_status, responded_at)
         VALUES ($1, $2, 'accepted', now())`,
        [promiseId, friend.id],
      );

      created.push({ id: promiseId, title: p.title, promisedAt });
    }

    await client.query("COMMIT");

    if (created.length === 0) {
      console.log("\n신규 약속 없음 (이미 모두 존재).");
    } else {
      console.log(`\n✔ ${created.length}개 약속 생성 완료\n`);
      console.log("| ID | 제목 | 약속 시각 |");
      console.log("|----|------|-----------|");
      for (const row of created) {
        console.log(
          `| ${row.id} | ${row.title} | ${row.promisedAt.toLocaleString("ko-KR")} |`,
        );
      }
    }

    const upcoming = await client.query<{
      id: string;
      title: string;
      promised_at: Date;
    }>(
      `SELECT p.id::text, p.title, p.promised_at
       FROM promises p
       JOIN promise_participants creator_pp
         ON creator_pp.promise_id = p.id AND creator_pp.user_id = $1::bigint
       JOIN promise_participants friend_pp
         ON friend_pp.promise_id = p.id
        AND friend_pp.user_id = $2::bigint
        AND friend_pp.invite_status = 'accepted'
       WHERE p.promised_at > now()
         AND p.settled_at IS NULL
       ORDER BY p.promised_at ASC`,
      [target.id, friend.id],
    );

    console.log(`\n${TARGET_NICKNAME} ↔ ${FRIEND_NICKNAME} 베팅 가능 약속 (${upcoming.rowCount}건):`);
    for (const row of upcoming.rows) {
      console.log(
        `  - [${row.id}] ${row.title} · ${row.promised_at.toLocaleString("ko-KR")}`,
      );
    }
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
