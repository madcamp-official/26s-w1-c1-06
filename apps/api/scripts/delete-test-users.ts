/**
 * 테스트 가입 계정 삭제 (수동 실행용, 커밋하지 않아도 됨).
 * 사용: npx tsx scripts/delete-test-users.ts
 *       npx tsx scripts/delete-test-users.ts --list
 */
import "../src/load-env.js";
import pg from "pg";

const listOnly = process.argv.includes("--list");

/** 수동 테스트 + 통합 테스트 이메일 패턴 */
const EMAIL_PATTERNS = [
  "chulsoo@test.com",
  "younghee@test.com",
  "test@example.com",
  "%@test.local",
];

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
    const found = await client.query<{ id: string; email: string; nickname: string }>(
      `SELECT id, email, nickname FROM users
       WHERE email = ANY($1::text[])
          OR email LIKE ANY($2::text[])
       ORDER BY id`,
      [
        EMAIL_PATTERNS.filter((p) => !p.includes("%")),
        EMAIL_PATTERNS.filter((p) => p.includes("%")),
      ],
    );

    if (found.rows.length === 0) {
      console.log("삭제할 테스트 계정이 없습니다.");
      return;
    }

    console.log("대상 계정:");
    for (const u of found.rows) {
      console.log(`  - [${u.id}] ${u.email} (${u.nickname})`);
    }

    if (listOnly) return;

    const ids = found.rows.map((r) => Number(r.id));
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
      `DELETE FROM point_transactions WHERE user_id = ANY($1::bigint[])`,
      [ids],
    );
    await client.query(
      `DELETE FROM positions
       WHERE investor_id = ANY($1::bigint[]) OR stock_user_id = ANY($1::bigint[])`,
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
    const deleted = await client.query(
      `DELETE FROM users WHERE id = ANY($1::bigint[]) RETURNING email`,
      [ids],
    );

    await client.query("COMMIT");
    console.log(`\n✔ ${deleted.rowCount}명 삭제 완료`);
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
