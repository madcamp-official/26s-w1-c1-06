import type { NextFunction, Request, Response } from "express";
import { verifyAuthToken } from "./jwt.js";

/** 요청에 주입되는 인증 주체. */
export interface AuthUser {
  id: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function extractBearer(req: Request): string | null {
  const header = req.header("authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}

/**
 * 보호 라우트 미들웨어 (M0-4).
 * 토큰 없음/무효 → 401. 유효 → req.user.id 주입.
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const token = extractBearer(req);
  if (!token) {
    res.status(401).json({ error: "인증 토큰이 필요합니다." });
    return;
  }
  try {
    const payload = verifyAuthToken(token);
    req.user = { id: payload.sub };
    next();
  } catch {
    res.status(401).json({ error: "유효하지 않은 토큰입니다." });
  }
}
