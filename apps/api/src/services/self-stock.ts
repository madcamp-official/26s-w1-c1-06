import type pg from "pg";
import { getPool } from "../db/pool.js";
import { HttpError, requirePool } from "../lib/errors.js";

export interface SelfStockOptionView {
  id: string;
  sourcePromiseId: string;
  sourcePromiseTitle: string;
  quantityLimit: number;
  grantedAt: string;
  expiresAt: string;
  currentPrice: number;
}

export interface SelfStockLotView {
  id: string;
  quantity: number;
  acquiredPrice: number;
  acquiredAt: string;
  currentPrice: number;
  canSell: boolean;
  unrealizedGain: number | null;
}

/** GET /me/options — 유효한 F-17 권한 목록. */
export async function listActiveOptions(
  userId: string,
  now: Date = new Date(),
): Promise<SelfStockOptionView[]> {
  const pool = getPool();
  requirePool(pool);

  const result = await pool.query<{
    id: string;
    source_promise_id: string;
    source_promise_title: string;
    quantity_limit: number;
    granted_at: Date;
    expires_at: Date;
    current_price: number;
  }>(
    `SELECT o.id, o.source_promise_id, pr.title AS source_promise_title,
            o.quantity_limit, o.granted_at, o.expires_at, u.current_price
     FROM self_stock_options o
     JOIN promises pr ON pr.id = o.source_promise_id
     JOIN users u ON u.id = o.user_id
     WHERE o.user_id = $1
       AND o.exercised_at IS NULL
       AND o.expires_at > $2
     ORDER BY o.expires_at ASC`,
    [userId, now],
  );

  return result.rows.map((row) => ({
    id: row.id,
    sourcePromiseId: row.source_promise_id,
    sourcePromiseTitle: row.source_promise_title,
    quantityLimit: row.quantity_limit,
    grantedAt: row.granted_at.toISOString(),
    expiresAt: row.expires_at.toISOString(),
    currentPrice: row.current_price,
  }));
}

/** T3: F-17 특별 매수 행사. */
export async function exerciseOption(
  userId: string,
  optionId: string,
  quantity: number,
  now: Date = new Date(),
): Promise<SelfStockLotView> {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new HttpError(400, "quantity는 1 이상의 정수여야 합니다.");
  }

  const pool = getPool();
  requirePool(pool);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const optionResult = await client.query<{
      id: string;
      quantity_limit: number;
      exercised_at: Date | null;
      expires_at: Date;
    }>(
      `SELECT id, quantity_limit, exercised_at, expires_at
       FROM self_stock_options
       WHERE id = $1 AND user_id = $2
       FOR UPDATE`,
      [optionId, userId],
    );
    const option = optionResult.rows[0];
    if (!option) {
      throw new HttpError(404, "권한을 찾을 수 없습니다.");
    }
    if (option.exercised_at !== null) {
      throw new HttpError(409, "이미 행사한 권한입니다.");
    }
    if (option.expires_at.getTime() <= now.getTime()) {
      throw new HttpError(410, "만료된 권한입니다.");
    }
    if (quantity > option.quantity_limit) {
      throw new HttpError(
        400,
        `행사 수량은 한도(${option.quantity_limit}주)를 초과할 수 없습니다.`,
      );
    }

    const userResult = await client.query<{ current_price: number; available_points: number }>(
      `SELECT current_price, available_points FROM users WHERE id = $1 FOR UPDATE`,
      [userId],
    );
    const user = userResult.rows[0];
    if (!user) {
      throw new HttpError(404, "사용자를 찾을 수 없습니다.");
    }

    const acquiredPrice = user.current_price;
    const cost = quantity * acquiredPrice;
    if (user.available_points < cost) {
      throw new HttpError(402, "가용 포인트가 부족합니다.");
    }

    const exercised = await client.query(
      `UPDATE self_stock_options
       SET exercised_at = $2
       WHERE id = $1 AND exercised_at IS NULL`,
      [optionId, now],
    );
    if ((exercised.rowCount ?? 0) === 0) {
      throw new HttpError(409, "이미 행사한 권한입니다.");
    }

    const lotResult = await client.query<{ id: string }>(
      `INSERT INTO self_stock_lots (user_id, option_id, quantity, acquired_price, acquired_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [userId, optionId, quantity, acquiredPrice, now],
    );
    const lotId = lotResult.rows[0]?.id;
    if (!lotId) {
      throw new HttpError(500, "자기주식 로트 생성에 실패했습니다.");
    }

    await client.query(
      `INSERT INTO point_transactions (user_id, amount, tx_type, ref_id)
       VALUES ($1, $2, 'self_stock_buy', $3)`,
      [userId, -cost, lotId],
    );
    await client.query(
      `UPDATE users SET available_points = available_points - $2 WHERE id = $1`,
      [userId, cost],
    );

    await client.query("COMMIT");

    const lots = await listLots(userId, lotId);
    const lot = lots[0];
    if (!lot) {
      throw new HttpError(500, "생성된 로트를 조회할 수 없습니다.");
    }
    return lot;
  } catch (err) {
    await client.query("ROLLBACK");
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      err.code === "23505"
    ) {
      throw new HttpError(409, "이미 행사한 권한입니다.");
    }
    throw err;
  } finally {
    client.release();
  }
}

/** GET /me/lots — 보유 자기주식 로트. */
export async function listLots(
  userId: string,
  lotId?: string,
  includeSold = false,
): Promise<SelfStockLotView[]> {
  const pool = getPool();
  requirePool(pool);

  const params: string[] = [userId];
  let idClause = "";
  if (lotId) {
    params.push(lotId);
    idClause = `AND l.id = $${params.length}`;
  }
  let soldClause = "AND l.sold_at IS NULL";
  if (includeSold) {
    soldClause = "";
  }

  const result = await pool.query<{
    id: string;
    quantity: number;
    acquired_price: number;
    acquired_at: Date;
    current_price: number;
  }>(
    `SELECT l.id, l.quantity, l.acquired_price, l.acquired_at, u.current_price
     FROM self_stock_lots l
     JOIN users u ON u.id = l.user_id
     WHERE l.user_id = $1::bigint
       ${soldClause}
       ${idClause}
     ORDER BY l.acquired_at DESC`,
    params,
  );

  return result.rows.map((row) => {
    const canSell = row.current_price > row.acquired_price;
    const unrealizedGain = canSell
      ? row.quantity * (row.current_price - row.acquired_price)
      : null;
    return {
      id: row.id,
      quantity: row.quantity,
      acquiredPrice: row.acquired_price,
      acquiredAt: row.acquired_at.toISOString(),
      currentPrice: row.current_price,
      canSell,
      unrealizedGain,
    };
  });
}

/** T4: F-18 자기주식 매도. */
export async function sellLot(
  userId: string,
  lotId: string,
  now: Date = new Date(),
): Promise<{ proceeds: number; soldPrice: number }> {
  const pool = getPool();
  requirePool(pool);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const lotResult = await client.query<{
      id: string;
      quantity: number;
      acquired_price: number;
      sold_at: Date | null;
    }>(
      `SELECT id, quantity, acquired_price, sold_at
       FROM self_stock_lots
       WHERE id = $1 AND user_id = $2
       FOR UPDATE`,
      [lotId, userId],
    );
    const lot = lotResult.rows[0];
    if (!lot) {
      throw new HttpError(404, "보유 로트를 찾을 수 없습니다.");
    }
    if (lot.sold_at !== null) {
      throw new HttpError(409, "이미 매도한 로트입니다.");
    }

    const userResult = await client.query<{ current_price: number }>(
      `SELECT current_price FROM users WHERE id = $1 FOR UPDATE`,
      [userId],
    );
    const user = userResult.rows[0];
    if (!user) {
      throw new HttpError(404, "사용자를 찾을 수 없습니다.");
    }

    const soldPrice = user.current_price;
    if (soldPrice <= lot.acquired_price) {
      throw new HttpError(
        400,
        "취득가 이하에서는 매도(손절)할 수 없습니다.",
      );
    }

    const proceeds = lot.quantity * soldPrice;

    const updated = await client.query(
      `UPDATE self_stock_lots
       SET sold_price = $2, sold_at = $3
       WHERE id = $1 AND sold_at IS NULL`,
      [lotId, soldPrice, now],
    );
    if ((updated.rowCount ?? 0) === 0) {
      throw new HttpError(409, "이미 매도한 로트입니다.");
    }

    await client.query(
      `INSERT INTO point_transactions (user_id, amount, tx_type, ref_id)
       VALUES ($1, $2, 'self_stock_sell', $3)`,
      [userId, proceeds, lotId],
    );
    await client.query(
      `UPDATE users SET available_points = available_points + $2 WHERE id = $1`,
      [userId, proceeds],
    );

    await client.query("COMMIT");
    return { proceeds, soldPrice };
  } catch (err) {
    await client.query("ROLLBACK");
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      err.code === "23514"
    ) {
      throw new HttpError(
        400,
        "취득가 이하에서는 매도(손절)할 수 없습니다.",
      );
    }
    throw err;
  } finally {
    client.release();
  }
}
