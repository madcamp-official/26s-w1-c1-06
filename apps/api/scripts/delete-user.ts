/**
 * 특정 유저 1명 + 그 유저와 얽힌 데이터를 전부 삭제한다(테스트용 더미 계정 정리).
 * 다른 유저의 계정·데이터는 건드리지 않는다 — 대상 유저가 만든 약속에 다른 유저가
 * 참여했었다면 그 참여 기록(promise_participants)만 함께 지워지고(약속 자체가 지워지므로
 * 불가피함), 다른 유저 본인 계정·포인트·다른 약속 등은 전혀 영향받지 않는다.
 *
 * 사용: npx tsx scripts/delete-user.ts --nickname "dd"
 */
import "../src/load-env.js";
import pg from "pg";

const nickname = process.argv.includes("--nickname")
  ? process.argv[process.argv.indexOf("--nickname") + 1]
  : undefined;

async function main(): Promise<void> {
  if (!nickname) {
    console.error('사용법: npx tsx scripts/delete-user.ts --nickname "닉네임"');
    process.exit(1);
  }

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
    const found = await client.query<{ id: string; nickname: string; email: string }>(
      `SELECT id::text, nickname, email FROM users WHERE nickname = $1`,
      [nickname],
    );

    if (found.rows.length === 0) {
      console.log(`'${nickname}' 닉네임의 유저를 찾을 수 없습니다.`);
      return;
    }
    if (found.rows.length > 1) {
      console.error(
        `'${nickname}' 닉네임이 여러 계정(${found.rows.map((r) => r.email).join(", ")})에 걸쳐 있습니다. 삭제를 중단합니다.`,
      );
      process.exit(1);
    }

    const target = found.rows[0]!;
    const ids = [target.id];
    console.log(`삭제 대상: [${target.id}] ${target.nickname} (${target.email})`);

    await client.query("BEGIN");

    await client.query(
      `DELETE FROM reactions WHERE user_id = ANY($1::bigint[])
         OR promise_id IN (SELECT id FROM promises WHERE creator_id = ANY($1::bigint[]))`,
      [ids],
    );
    await client.query(`DELETE FROM shop_purchases WHERE user_id = ANY($1::bigint[])`, [ids]);
    await client.query(
      `DELETE FROM option_positions WHERE investor_id = ANY($1::bigint[]) OR stock_user_id = ANY($1::bigint[])`,
      [ids],
    );
    await client.query(
      `DELETE FROM positions WHERE investor_id = ANY($1::bigint[]) OR stock_user_id = ANY($1::bigint[])`,
      [ids],
    );
    await client.query(`DELETE FROM etf_orders WHERE investor_id = ANY($1::bigint[])`, [ids]);
    await client.query(`DELETE FROM self_stock_lots WHERE user_id = ANY($1::bigint[])`, [ids]);
    await client.query(`DELETE FROM self_stock_options WHERE user_id = ANY($1::bigint[])`, [ids]);
    await client.query(
      `DELETE FROM promise_participants WHERE user_id = ANY($1::bigint[])
         OR promise_id IN (SELECT id FROM promises WHERE creator_id = ANY($1::bigint[]))`,
      [ids],
    );
    await client.query(`DELETE FROM promises WHERE creator_id = ANY($1::bigint[])`, [ids]);
    await client.query(`DELETE FROM point_transactions WHERE user_id = ANY($1::bigint[])`, [ids]);
    await client.query(
      `DELETE FROM friendships WHERE requester_id = ANY($1::bigint[]) OR addressee_id = ANY($1::bigint[])`,
      [ids],
    );
    await client.query(`DELETE FROM users WHERE id = ANY($1::bigint[])`, [ids]);

    await client.query("COMMIT");
    console.log("삭제 완료.");
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
