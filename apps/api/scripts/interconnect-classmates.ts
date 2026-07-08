/**
 * 분반 멤버(가상 계정) 15명끼리 서로 친구로 만든다 — 지금까지는 허서준(target) 중심의
 * 별 모양 구조라, 다른 멤버 계정으로 로그인해도 서로가 안 보였다. 이 스크립트로 15명을
 * 전부 서로 친구(모든 쌍, C(15,2)=105개)로 묶어 어느 계정으로 데모해도 전원이 보이게 한다.
 *
 * 가상 계정 로그인 정보: seed-classmates.ts가 만든 계정 그대로(비밀번호 password12).
 * 이메일은 encodeURIComponent(닉네임)이 섞여 있어 손으로 치기 번거로우므로,
 * 이 스크립트 실행 결과 마지막에 사람별 실제 이메일을 그대로 출력해준다.
 *
 * 사용: npx tsx scripts/interconnect-classmates.ts
 */
import "../src/load-env.js";
import pg from "pg";

const MEMBER_NICKNAMES = [
  "권순호", "김태현", "김희서", "라태형", "박준서",
  "안종화", "유나연", "유영석", "이서진", "이예원",
  "이유담", "이종혁", "이지민", "정서영", "주성민",
];

interface UserRow {
  id: string;
  nickname: string;
  email: string;
}

async function ensureFriendship(client: pg.PoolClient, aId: string, bId: string): Promise<boolean> {
  const existing = await client.query(
    `SELECT 1 FROM friendships
     WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)`,
    [aId, bId],
  );
  if ((existing.rowCount ?? 0) > 0) return false;
  await client.query(
    `INSERT INTO friendships (requester_id, addressee_id, status, responded_at)
     VALUES ($1, $2, 'accepted', now())`,
    [aId, bId],
  );
  return true;
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL 없음");
    process.exit(1);
  }

  const pool = new pg.Pool({
    connectionString: url,
    ssl: url.includes("neon.tech") || url.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined,
  });

  const client = await pool.connect();
  try {
    const result = await client.query<UserRow>(
      `SELECT id::text, nickname, email FROM users WHERE nickname = ANY($1)`,
      [MEMBER_NICKNAMES],
    );
    const found = result.rows;
    const missing = MEMBER_NICKNAMES.filter((n) => !found.some((r) => r.nickname === n));
    if (missing.length > 0) {
      console.warn("찾을 수 없는 멤버(스킵):", missing.join(", "));
    }
    console.log(`대상 ${found.length}명: ${found.map((r) => r.nickname).join(", ")}`);

    await client.query("BEGIN");
    let created = 0;
    let skipped = 0;
    for (let i = 0; i < found.length; i++) {
      for (let j = i + 1; j < found.length; j++) {
        const didCreate = await ensureFriendship(client, found[i]!.id, found[j]!.id);
        if (didCreate) created += 1;
        else skipped += 1;
      }
    }
    await client.query("COMMIT");

    console.log(`\n친구관계 생성: ${created}개 신규, ${skipped}개 기존.`);
    console.log("\n가상 계정 로그인 정보 (비밀번호 전부 password12):");
    for (const r of found) {
      console.log(`  ${r.nickname.padEnd(4, " ")} ${r.email}`);
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
