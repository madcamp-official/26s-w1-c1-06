/**
 * 가상 친구 계정 생성 + 특정 유저와 친구 수락 + 시장 가격 다양화.
 *
 * 사용: npx tsx scripts/seed-market-friends.ts
 *       npx tsx scripts/seed-market-friends.ts --target "허서준2"
 */
import "../src/load-env.js";
import bcrypt from "bcryptjs";
import { INITIAL_POINTS } from "@latestock/shared";
import pg from "pg";

const TARGET_NICKNAME = process.argv.includes("--target")
  ? process.argv[process.argv.indexOf("--target") + 1] ?? "허서준2"
  : "허서준2";

const VIRTUAL_FRIENDS = [
  { email: "market.kim@test.local", nickname: "김민지", currentPrice: 11_500 },
  { email: "market.park@test.local", nickname: "박준호", currentPrice: 9_200 },
  { email: "market.lee@test.local", nickname: "이서연", currentPrice: 10_800 },
  { email: "market.choi@test.local", nickname: "최도윤", currentPrice: 8_600 },
  { email: "market.jung@test.local", nickname: "정하은", currentPrice: 12_300 },
] as const;

const DEFAULT_PASSWORD = "password12";

async function findUserByNickname(
  client: pg.PoolClient,
  nickname: string,
): Promise<{ id: string; email: string; nickname: string } | null> {
  const r = await client.query<{ id: string; email: string; nickname: string }>(
    `SELECT id::text, email, nickname FROM users WHERE nickname = $1 LIMIT 1`,
    [nickname],
  );
  return r.rows[0] ?? null;
}

async function ensureVirtualUser(
  client: pg.PoolClient,
  email: string,
  nickname: string,
  currentPrice: number,
): Promise<string> {
  const existing = await client.query<{ id: string }>(
    `SELECT id::text FROM users WHERE email = $1`,
    [email],
  );
  if (existing.rows[0]) {
    await client.query(
      `UPDATE users SET current_price = $2, nickname = $3, auto_accept_invites = true WHERE id = $1`,
      [existing.rows[0].id, currentPrice, nickname],
    );
    return existing.rows[0].id;
  }

  const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const inserted = await client.query<{ id: string }>(
    `INSERT INTO users (email, password_hash, nickname, available_points, current_price, auto_accept_invites)
     VALUES ($1, $2, $3, 0, $4, true)
     RETURNING id::text`,
    [email, hash, nickname, currentPrice],
  );
  const userId = inserted.rows[0]!.id;

  await client.query(
    `INSERT INTO point_transactions (user_id, amount, tx_type) VALUES ($1, $2, 'signup_grant')`,
    [userId, INITIAL_POINTS],
  );
  await client.query(`UPDATE users SET available_points = $2 WHERE id = $1`, [
    userId,
    INITIAL_POINTS,
  ]);

  return userId;
}

async function ensureFriendship(
  client: pg.PoolClient,
  targetId: string,
  friendId: string,
): Promise<"created" | "exists"> {
  const pair = await client.query<{ id: string; status: string }>(
    `SELECT id::text, status FROM friendships
     WHERE (requester_id = $1 AND addressee_id = $2)
        OR (requester_id = $2 AND addressee_id = $1)
     LIMIT 1`,
    [targetId, friendId],
  );

  if (pair.rows[0]) {
    if (pair.rows[0].status !== "accepted") {
      await client.query(
        `UPDATE friendships SET status = 'accepted', responded_at = now() WHERE id = $1`,
        [pair.rows[0].id],
      );
      return "created";
    }
    return "exists";
  }

  await client.query(
    `INSERT INTO friendships (requester_id, addressee_id, status, responded_at)
     VALUES ($1, $2, 'accepted', now())`,
    [friendId, targetId],
  );
  return "created";
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
    const target = await findUserByNickname(client, TARGET_NICKNAME);
    if (!target) {
      console.error(`'${TARGET_NICKNAME}' 닉네임 사용자를 찾을 수 없습니다.`);
      const all = await client.query(
        `SELECT id::text, email, nickname FROM users ORDER BY id DESC LIMIT 20`,
      );
      console.log("\n최근 가입 사용자:");
      for (const u of all.rows) {
        console.log(`  [${u.id}] ${u.nickname} <${u.email}>`);
      }
      process.exit(1);
    }

    console.log(`대상: [${target.id}] ${target.nickname} <${target.email}>`);

    await client.query("BEGIN");

    const results: { nickname: string; id: string; friendship: string }[] = [];

    for (const f of VIRTUAL_FRIENDS) {
      const friendId = await ensureVirtualUser(client, f.email, f.nickname, f.currentPrice);
      const friendship = await ensureFriendship(client, target.id, friendId);
      results.push({ nickname: f.nickname, id: friendId, friendship });
    }

    await client.query("COMMIT");

    console.log("\n✔ 가상 친구 시장 구성 완료\n");
    console.log("| 닉네임 | ID | 현재가 | 친구 관계 |");
    console.log("|--------|-----|--------|-----------|");
    for (let i = 0; i < VIRTUAL_FRIENDS.length; i++) {
      const f = VIRTUAL_FRIENDS[i]!;
      const r = results[i]!;
      console.log(
        `| ${f.nickname} | ${r.id} | ${f.currentPrice.toLocaleString()}원 | ${r.friendship === "exists" ? "기존" : "신규"} |`,
      );
    }

    const friends = await client.query(
      `SELECT u.nickname, u.current_price
       FROM friendships f
       JOIN users u ON u.id = CASE
         WHEN f.requester_id = $1::bigint THEN f.addressee_id
         ELSE f.requester_id
       END
       WHERE f.status = 'accepted'
         AND (f.requester_id = $1::bigint OR f.addressee_id = $1::bigint)
       ORDER BY u.current_price DESC`,
      [target.id],
    );

    console.log(`\n${target.nickname}의 친구 시장 (${friends.rowCount}명):`);
    for (const row of friends.rows) {
      console.log(`  - ${row.nickname}: ${Number(row.current_price).toLocaleString()}원`);
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
