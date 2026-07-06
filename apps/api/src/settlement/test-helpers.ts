import type pg from "pg";

const INITIAL_POINTS = 100_000;

export interface GoldenCaseSeed {
  runId: string;
  chulsooId: number;
  youngheeId: number;
  promiseId: number;
  positionId: number;
  promisedAt: Date;
}

/** test_schema 골든 케이스: 철수 공매도 3주, 영희 32분 지각. */
export async function seedGoldenCase(pool: pg.Pool): Promise<GoldenCaseSeed> {
  const runId = `it-${Date.now()}`;
  const client = await pool.connect();
  const promisedAt = new Date("2020-06-01T12:00:00Z");
  const settleDueAt = new Date("2020-06-01T14:00:00Z");
  const youngheeCheckin = new Date(promisedAt.getTime() + 32 * 60_000);
  const chulsooCheckin = new Date("2020-06-01T11:55:00Z");

  try {
    await client.query("BEGIN");

    const users = await client.query<{ id: string }>(
      `INSERT INTO users (email, nickname, available_points)
       VALUES ($1, '철수', $2), ($3, '영희', $2)
       RETURNING id`,
      [
        `settle-${runId}-chul@test.local`,
        INITIAL_POINTS,
        `settle-${runId}-young@test.local`,
      ],
    );
    const chulsooId = Number(users.rows[0]!.id);
    const youngheeId = Number(users.rows[1]!.id);

    for (const uid of [chulsooId, youngheeId]) {
      await client.query(
        `INSERT INTO point_transactions (user_id, amount, tx_type) VALUES ($1, $2, 'signup_grant')`,
        [uid, INITIAL_POINTS],
      );
    }

    await client.query(
      `INSERT INTO friendships (requester_id, addressee_id, status, responded_at)
       VALUES ($1, $2, 'accepted', now())`,
      [chulsooId, youngheeId],
    );

    const promise = await client.query<{ id: string }>(
      `INSERT INTO promises (creator_id, title, place_name, latitude, longitude, promised_at, settle_due_at)
       VALUES ($1, '점심', '강남역', 37.49, 127.02, $2, $3)
       RETURNING id`,
      [chulsooId, promisedAt, settleDueAt],
    );
    const promiseId = Number(promise.rows[0]!.id);

    await client.query(
      `INSERT INTO promise_participants (promise_id, user_id, invite_status, responded_at, checkin_at)
       VALUES ($1, $2, 'accepted', now(), $3),
              ($1, $4, 'accepted', now(), $5)`,
      [promiseId, chulsooId, chulsooCheckin, youngheeId, youngheeCheckin],
    );

    const pos = await client.query<{ id: string }>(
      `INSERT INTO positions (investor_id, stock_user_id, promise_id, direction, quantity, open_price, locked_points)
       VALUES ($1, $2, $3, 'short', 3, 10000, 30000)
       RETURNING id`,
      [chulsooId, youngheeId, promiseId],
    );
    const positionId = Number(pos.rows[0]!.id);

    await client.query(
      `INSERT INTO point_transactions (user_id, amount, tx_type, ref_id)
       VALUES ($1, -30000, 'position_lock', $2)`,
      [chulsooId, positionId],
    );
    await client.query(
      `UPDATE users SET available_points = available_points - 30000 WHERE id = $1`,
      [chulsooId],
    );

    await client.query("COMMIT");

    return {
      runId,
      chulsooId,
      youngheeId,
      promiseId,
      positionId,
      promisedAt,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function cleanupGoldenCase(
  pool: pg.Pool,
  seed: GoldenCaseSeed,
): Promise<void> {
  const client = await pool.connect();
  const userIds = [seed.chulsooId, seed.youngheeId];
  try {
    await client.query("BEGIN");
    await client.query(
      `DELETE FROM self_stock_lots WHERE user_id = ANY($1::bigint[])`,
      [userIds],
    );
    await client.query(
      `DELETE FROM self_stock_options WHERE user_id = ANY($1::bigint[])`,
      [userIds],
    );
    await client.query(
      `DELETE FROM point_transactions WHERE user_id = ANY($1::bigint[])`,
      [userIds],
    );
    await client.query(`DELETE FROM positions WHERE promise_id = $1`, [
      seed.promiseId,
    ]);
    await client.query(`DELETE FROM promise_participants WHERE promise_id = $1`, [
      seed.promiseId,
    ]);
    await client.query(`DELETE FROM promises WHERE id = $1`, [seed.promiseId]);
    await client.query(
      `DELETE FROM friendships
       WHERE requester_id = ANY($1::bigint[]) OR addressee_id = ANY($1::bigint[])`,
      [userIds],
    );
    await client.query(`DELETE FROM users WHERE id = ANY($1::bigint[])`, [
      userIds,
    ]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function getChulsooBalance(
  pool: pg.Pool,
  userId: number,
): Promise<number> {
  const r = await pool.query<{ available_points: number }>(
    `SELECT available_points FROM users WHERE id = $1`,
    [userId],
  );
  return r.rows[0]!.available_points;
}

export async function assertLedgerInvariant(
  pool: pg.Pool,
  userId: number,
): Promise<void> {
  const r = await pool.query<{
    balance: number;
    ledger_sum: string;
  }>(
    `SELECT u.available_points AS balance,
            COALESCE(SUM(t.amount), 0)::text AS ledger_sum
     FROM users u
     LEFT JOIN point_transactions t ON t.user_id = u.id
     WHERE u.id = $1
     GROUP BY u.id`,
    [userId],
  );
  const row = r.rows[0];
  if (!row || row.balance !== Number(row.ledger_sum)) {
    throw new Error(
      `원장 불변식 위반 user=${userId}: balance=${row?.balance} ledger=${row?.ledger_sum}`,
    );
  }
}
