/**
 * db/schema.sql → DATABASE_URL(Neon 등)에 적용
 * 사용: npm run db:apply-schema  (루트 또는 apps/api)
 */
import "../src/load-env.js";
import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const schemaPath = resolve(repoRoot, "db/schema.sql");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("✖ DATABASE_URL이 없습니다.");
  console.error("  apps/api/.env 또는 프로젝트 루트 .env 에 Neon connection string을 넣으세요.");
  process.exit(1);
}

const sql = readFileSync(schemaPath, "utf8");

const client = new pg.Client({
  connectionString: DATABASE_URL,
  ssl:
    DATABASE_URL.includes("neon.tech") ||
    DATABASE_URL.includes("sslmode=require")
      ? { rejectUnauthorized: false }
      : undefined,
});

async function main(): Promise<void> {
  console.log("→ schema 적용:", schemaPath);
  console.log("→ 대상 DB:", DATABASE_URL.replace(/:[^:@/]+@/, ":****@"));

  await client.connect();
  try {
    await client.query(sql);
    const { rows } = await client.query<{ cnt: string }>(
      `SELECT count(*)::text AS cnt
       FROM information_schema.tables
       WHERE table_schema = 'public'`,
    );
    console.log(`✔ schema.sql 적용 완료 (public 테이블 ${rows[0]?.cnt ?? "?"}개)`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("already exists")) {
      console.error("✖ 이미 스키마가 적용된 DB일 수 있습니다 (타입/테이블 중복).");
      console.error("  Neon에서 새 브랜치를 만들거나, 빈 DB에 다시 실행하세요.");
    }
    console.error("✖", msg);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
