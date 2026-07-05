import { getPool } from "./pool.js";

export interface DbHealthResult {
  status: "ok" | "error" | "not_configured";
  message?: string;
  tableCount?: number;
  serverTime?: string;
}

/** DB 연결 + public 스키마 테이블 수 조회 (Neon 이전 검증용). */
export async function checkDbHealth(): Promise<DbHealthResult> {
  const pool = getPool();
  if (!pool) {
    return {
      status: "not_configured",
      message: "DATABASE_URL이 설정되지 않았습니다.",
    };
  }

  try {
    const result = await pool.query<{
      table_count: string;
      server_time: Date;
    }>(`
      SELECT
        (SELECT count(*)::text
         FROM information_schema.tables
         WHERE table_schema = 'public') AS table_count,
        now() AS server_time
    `);

    const row = result.rows[0];
    if (!row) {
      return { status: "error", message: "헬스 쿼리 결과가 비어 있습니다." };
    }

    return {
      status: "ok",
      tableCount: Number(row.table_count),
      serverTime: row.server_time.toISOString(),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: "error", message };
  }
}
