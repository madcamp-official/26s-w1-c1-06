import pg from "pg";
import { env } from "../env.js";

let pool: pg.Pool | null = null;

/** Neon 등 원격 Postgres용 SSL 옵션 (connection string에 sslmode=require 포함 시). */
function sslOption(connectionString: string): pg.ConnectionConfig["ssl"] {
  if (
    connectionString.includes("sslmode=require") ||
    connectionString.includes("neon.tech")
  ) {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

/** DATABASE_URL이 설정된 경우에만 Pool을 반환한다. */
export function getPool(): pg.Pool | null {
  if (!env.databaseUrl) return null;
  if (!pool) {
    pool = new pg.Pool({
      connectionString: env.databaseUrl,
      ssl: sslOption(env.databaseUrl),
      max: 10,
    });
  }
  return pool;
}

/** 연결 테스트용 단일 클라이언트 (스크립트·헬스체크). */
export async function withDbClient<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const p = getPool();
  if (!p) {
    throw new Error("DATABASE_URL이 설정되지 않았습니다.");
  }
  const client = await p.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}
