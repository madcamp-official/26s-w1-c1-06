import bcrypt from "bcryptjs";
import { INITIAL_POINTS } from "@latestock/shared";
import type pg from "pg";
import { getPool } from "../db/pool.js";
import { HttpError, requirePool } from "../lib/errors.js";
import {
  assertNickname,
  assertPassword,
  isValidEmail,
} from "../lib/validation.js";

const BCRYPT_ROUNDS = 10;

export interface UserProfile {
  id: string;
  email: string;
  nickname: string;
  availablePoints: number;
  currentPrice: number;
}

interface UserRow {
  id: string;
  email: string;
  nickname: string;
  password_hash: string | null;
  available_points: number;
  current_price: number;
}

function mapProfile(row: Omit<UserRow, "password_hash">): UserProfile {
  return {
    id: row.id,
    email: row.email,
    nickname: row.nickname,
    availablePoints: row.available_points,
    currentPrice: row.current_price,
  };
}

/** F-01/F-09: 가입 + signup_grant 원장 (트랜잭션). */
export async function signupUser(
  email: string,
  password: string,
  nickname: string,
): Promise<UserProfile> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!isValidEmail(normalizedEmail)) {
    throw new HttpError(400, "이메일 형식이 올바르지 않습니다.");
  }
  const passwordErr = assertPassword(password);
  if (passwordErr) throw new HttpError(400, passwordErr);
  const nicknameErr = assertNickname(nickname);
  if (nicknameErr) throw new HttpError(400, nicknameErr);

  const pool = getPool();
  requirePool(pool);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const inserted = await client.query<UserRow>(
      `INSERT INTO users (email, password_hash, nickname, available_points)
       VALUES ($1, $2, $3, 0)
       RETURNING id, email, nickname, available_points, current_price`,
      [normalizedEmail, hash, nickname.trim()],
    );
    const user = inserted.rows[0];
    if (!user) throw new HttpError(500, "가입 처리에 실패했습니다.");

    await client.query(
      `INSERT INTO point_transactions (user_id, amount, tx_type)
       VALUES ($1, $2, 'signup_grant')`,
      [user.id, INITIAL_POINTS],
    );
    await client.query(
      `UPDATE users SET available_points = $2 WHERE id = $1`,
      [user.id, INITIAL_POINTS],
    );

    await client.query("COMMIT");
    return mapProfile({ ...user, available_points: INITIAL_POINTS });
  } catch (err) {
    await client.query("ROLLBACK");
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      err.code === "23505"
    ) {
      throw new HttpError(409, "이미 사용 중인 이메일입니다.");
    }
    throw err;
  } finally {
    client.release();
  }
}

/** F-01: 이메일·비밀번호 로그인. */
export async function loginUser(
  email: string,
  password: string,
): Promise<UserProfile> {
  const pool = getPool();
  requirePool(pool);

  const normalizedEmail = email.trim().toLowerCase();
  const result = await pool.query<UserRow>(
    `SELECT id, email, nickname, password_hash, available_points, current_price
     FROM users WHERE email = $1`,
    [normalizedEmail],
  );
  const user = result.rows[0];
  if (!user?.password_hash) {
    throw new HttpError(401, "이메일 또는 비밀번호가 올바르지 않습니다.");
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    throw new HttpError(401, "이메일 또는 비밀번호가 올바르지 않습니다.");
  }

  return mapProfile(user);
}

/** GET /auth/me */
export async function getUserProfile(userId: string): Promise<UserProfile> {
  const pool = getPool();
  requirePool(pool);

  const result = await pool.query<UserRow>(
    `SELECT id, email, nickname, password_hash, available_points, current_price
     FROM users WHERE id = $1`,
    [userId],
  );
  const user = result.rows[0];
  if (!user) {
    throw new HttpError(404, "사용자를 찾을 수 없습니다.");
  }
  return mapProfile(user);
}

/** 원장 합계 = 잔액 (테스트·검증용). */
export async function getLedgerSum(userId: string): Promise<number> {
  const pool = getPool();
  requirePool(pool);
  const r = await pool.query<{ sum: string }>(
    `SELECT COALESCE(SUM(amount), 0)::text AS sum
     FROM point_transactions WHERE user_id = $1`,
    [userId],
  );
  return Number(r.rows[0]?.sum ?? 0);
}
