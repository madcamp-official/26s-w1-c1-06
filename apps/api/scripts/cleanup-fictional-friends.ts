/**
 * 분반 명단에 없는 가상 친구(seed-market-friends.ts가 만든 김민지·박준호·이서연·최도윤·정하은)와
 * 그들이 얽힌 데이터를 전부 지우고, 남은(분반 실명) 더미 약속 중 아직 정산 안 된 게 있으면
 * 마저 정산한다(option_positions 테이블 누락 버그로 실패했던 것들 재시도).
 *
 * 사용: npx tsx scripts/cleanup-fictional-friends.ts
 */
import "../src/load-env.js";
import pg from "pg";
import { runSettlementNow } from "../src/settlement/scheduler.js";

const FICTIONAL_NICKNAMES = ["김민지", "박준호", "이서연", "최도윤", "정하은"];

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
    const ids = await client.query<{ id: string; nickname: string }>(
      `SELECT id::text, nickname FROM users WHERE nickname = ANY($1)`,
      [FICTIONAL_NICKNAMES],
    );

    if (ids.rows.length === 0) {
      console.log("삭제할 가상 친구가 없습니다(이미 정리됐거나 애초에 없음).");
    } else {
      const fictionalIds = ids.rows.map((r) => r.id);
      console.log("삭제 대상:", ids.rows.map((r) => r.nickname).join(", "));

      await client.query("BEGIN");

      await client.query(
        `DELETE FROM reactions WHERE user_id = ANY($1::bigint[])
           OR promise_id IN (SELECT id FROM promises WHERE creator_id = ANY($1::bigint[]))`,
        [fictionalIds],
      );
      await client.query(
        `DELETE FROM option_positions WHERE investor_id = ANY($1::bigint[]) OR stock_user_id = ANY($1::bigint[])`,
        [fictionalIds],
      );
      await client.query(
        `DELETE FROM positions WHERE investor_id = ANY($1::bigint[]) OR stock_user_id = ANY($1::bigint[])`,
        [fictionalIds],
      );
      await client.query(
        `DELETE FROM self_stock_lots WHERE option_id IN (SELECT id FROM self_stock_options WHERE user_id = ANY($1::bigint[]))`,
        [fictionalIds],
      );
      await client.query(`DELETE FROM self_stock_options WHERE user_id = ANY($1::bigint[])`, [fictionalIds]);
      await client.query(
        `DELETE FROM promise_participants WHERE user_id = ANY($1::bigint[])
           OR promise_id IN (SELECT id FROM promises WHERE creator_id = ANY($1::bigint[]))`,
        [fictionalIds],
      );
      await client.query(`DELETE FROM promises WHERE creator_id = ANY($1::bigint[])`, [fictionalIds]);
      await client.query(`DELETE FROM point_transactions WHERE user_id = ANY($1::bigint[])`, [fictionalIds]);
      await client.query(
        `DELETE FROM friendships WHERE requester_id = ANY($1::bigint[]) OR addressee_id = ANY($1::bigint[])`,
        [fictionalIds],
      );
      await client.query(`DELETE FROM users WHERE id = ANY($1::bigint[])`, [fictionalIds]);

      await client.query("COMMIT");
      console.log(`삭제 완료: ${ids.rows.length}명 + 관련 데이터 전부 제거.`);
    }

    console.log("\n남은 미정산 약속 정산 재시도 중...");
    const result = await runSettlementNow({});
    console.log(`정산 완료: settled=${result.settledIds.length} failed=${result.failedIds.length}`);
    if (result.failedIds.length > 0) {
      console.error("실패 목록:", result.failedIds);
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
