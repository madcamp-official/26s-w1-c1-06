import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../env.js";

export interface AuthTokenPayload {
  /** 유저 ID (users.id). */
  sub: string;
}

/** 로그인/회원가입 시 액세스 토큰 발급 (F-01). */
export function signAuthToken(userId: string): string {
  const payload: AuthTokenPayload = { sub: userId };
  const options: SignOptions = {
    expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"],
  };
  return jwt.sign(payload, env.jwtSecret, options);
}

/** 토큰 검증. 실패 시 throw. */
export function verifyAuthToken(token: string): AuthTokenPayload {
  const decoded = jwt.verify(token, env.jwtSecret);
  if (typeof decoded === "string" || typeof decoded.sub !== "string") {
    throw new Error("잘못된 토큰 페이로드");
  }
  return { sub: decoded.sub };
}
