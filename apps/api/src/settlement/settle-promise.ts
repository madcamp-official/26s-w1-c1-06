import {
  DEFENSE_REWARD_POINTS,
  SELF_STOCK_OPTION_LIMIT,
  SELF_STOCK_OPTION_TTL_HOURS,
} from "@latestock/shared";
import type pg from "pg";
import { settleOptionsForStock } from "../services/options.js";
import { computePayout } from "./payout.js";
import { computeEwmaLateP, computeNewPrice } from "./pricing.js";
import { computeVerdict } from "./verdict.js";

interface PromiseRow {
  id: string;
  promised_at: Date;
  settled_at: Date | null;
}

interface ParticipantRow {
  user_id: string;
  invite_status: string;
  checkin_at: Date | null;
}

interface UserPriceRow {
  id: string;
  current_price: number;
  ewma_late_p: number;
  on_time_streak: number;
}

interface PositionRow {
  id: string;
  investor_id: string;
  stock_user_id: string;
  direction: "buy" | "short";
  quantity: number;
  locked_points: number;
  multiplier: number;
}

/**
 * T2 정산 ①~⑦을 한 트랜잭션으로 실행.
 * @returns 정산 완료 시 true, 이미 정산됐거나 대상 아님 시 false
 */
export async function settleOnePromise(
  client: pg.PoolClient,
  promiseId: number,
  now: Date,
): Promise<boolean> {
  await client.query("BEGIN");
  try {
    const promiseResult = await client.query<PromiseRow>(
      `SELECT id, promised_at, settled_at
       FROM promises
       WHERE id = $1
       FOR UPDATE`,
      [promiseId],
    );
    const promise = promiseResult.rows[0];
    if (!promise) {
      await client.query("ROLLBACK");
      return false;
    }
    if (promise.settled_at !== null) {
      await client.query("ROLLBACK");
      return false;
    }

    // ② 미응답 초대 auto_declined
    await client.query(
      `UPDATE promise_participants
       SET invite_status = 'auto_declined', responded_at = $2
       WHERE promise_id = $1 AND invite_status = 'invited'`,
      [promiseId, now],
    );

    // ③ 수락 참여자 판정 대상
    const participantsResult = await client.query<ParticipantRow>(
      `SELECT user_id, invite_status, checkin_at
       FROM promise_participants
       WHERE promise_id = $1 AND invite_status = 'accepted'`,
      [promiseId],
    );
    const participants = participantsResult.rows;
    const stockUserIds = participants.map((p) => Number(p.user_id));

    const priceBefore = new Map<number, number>();
    const priceAfter = new Map<number, number>();

    if (stockUserIds.length > 0) {
      const usersResult = await client.query<UserPriceRow>(
        `SELECT id, current_price, ewma_late_p, on_time_streak
         FROM users
         WHERE id = ANY($1::bigint[])
         FOR UPDATE`,
        [stockUserIds],
      );
      const userMap = new Map(
        usersResult.rows.map((u) => [Number(u.id), u]),
      );

      const promisedAt = new Date(promise.promised_at);

      // ③④ 판정 + 종목별 가격 갱신
      for (const p of participants) {
        const userId = Number(p.user_id);
        const user = userMap.get(userId);
        if (!user) continue;

        const before = user.current_price;
        priceBefore.set(userId, before);

        const { verdict, lateMinutes } = computeVerdict(
          promisedAt,
          p.checkin_at ? new Date(p.checkin_at) : null,
        );
        const after = computeNewPrice(before, verdict, lateMinutes);
        const ewma = computeEwmaLateP(user.ewma_late_p, verdict);
        const streak = verdict === "on_time" ? user.on_time_streak + 1 : 0;

        priceAfter.set(userId, after);
        user.current_price = after;
        user.ewma_late_p = ewma;
        user.on_time_streak = streak;

        await client.query(
          `UPDATE promise_participants
           SET verdict = $3, late_minutes = $4, settled_price = $5
           WHERE promise_id = $1 AND user_id = $2`,
          [promiseId, userId, verdict, lateMinutes, after],
        );

        await client.query(
          `UPDATE users SET current_price = $2, ewma_late_p = $3, on_time_streak = $4 WHERE id = $1`,
          [userId, after, ewma, streak],
        );

        // S-04 옵션 정산 — strike 없는 이진 행사(콜=정시, 풋=지각/노쇼)
        await settleOptionsForStock(client, promiseId, userId, verdict, now);
      }
    }

    // ⑤ open 포지션 정산
    const positionsResult = await client.query<PositionRow>(
      `SELECT id, investor_id, stock_user_id, direction, quantity, locked_points, multiplier
       FROM positions
       WHERE promise_id = $1 AND status = 'open'
       FOR UPDATE`,
      [promiseId],
    );

    for (const pos of positionsResult.rows) {
      const stockId = Number(pos.stock_user_id);
      const before = priceBefore.get(stockId);
      const after = priceAfter.get(stockId);
      if (before === undefined || after === undefined) continue;

      const payout = computePayout(
        pos.direction,
        pos.quantity,
        before,
        after,
        pos.locked_points,
        pos.multiplier,
      );
      const investorId = Number(pos.investor_id);
      const positionId = Number(pos.id);

      await client.query(
        `UPDATE positions
         SET status = 'settled',
             price_before = $2,
             price_after = $3,
             payout = $4,
             settled_at = $5
         WHERE id = $1`,
        [positionId, before, after, payout, now],
      );

      await client.query(
        `INSERT INTO point_transactions (user_id, amount, tx_type, ref_id)
         VALUES ($1, $2, 'position_unlock', $3)`,
        [investorId, pos.locked_points, positionId],
      );
      await client.query(
        `INSERT INTO point_transactions (user_id, amount, tx_type, ref_id)
         VALUES ($1, $2, 'position_payout', $3)`,
        [investorId, payout, positionId],
      );
      await client.query(
        `UPDATE users
         SET available_points = available_points + $2
         WHERE id = $1`,
        [investorId, pos.locked_points + payout],
      );
    }

    // ⑥ 정시자 방어 보상 + F-17 권한 발급
    for (const p of participants) {
      const userId = Number(p.user_id);
      const verdictRow = await client.query<{ verdict: string }>(
        `SELECT verdict FROM promise_participants
         WHERE promise_id = $1 AND user_id = $2`,
        [promiseId, userId],
      );
      if (verdictRow.rows[0]?.verdict !== "on_time") continue;

      await client.query(
        `INSERT INTO point_transactions (user_id, amount, tx_type, ref_id)
         VALUES ($1, $2, 'defense_reward', $3)`,
        [userId, DEFENSE_REWARD_POINTS, promiseId],
      );
      await client.query(
        `UPDATE users SET available_points = available_points + $2 WHERE id = $1`,
        [userId, DEFENSE_REWARD_POINTS],
      );

      const expiresAt = new Date(
        now.getTime() + SELF_STOCK_OPTION_TTL_HOURS * 60 * 60 * 1000,
      );
      await client.query(
        `INSERT INTO self_stock_options (user_id, source_promise_id, quantity_limit, granted_at, expires_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, source_promise_id) DO NOTHING`,
        [userId, promiseId, SELF_STOCK_OPTION_LIMIT, now, expiresAt],
      );
    }

    // ⑦ 약속 정산 완료 (멱등 키)
    await client.query(`UPDATE promises SET settled_at = $2 WHERE id = $1`, [
      promiseId,
      now,
    ]);

    await client.query("COMMIT");
    return true;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}
