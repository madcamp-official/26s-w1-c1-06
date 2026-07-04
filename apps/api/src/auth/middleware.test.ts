import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { requireAuth } from "./middleware.js";
import { signAuthToken } from "./jwt.js";

function mockRes() {
  const res = {} as Response & { statusCode?: number; body?: unknown };
  res.status = vi.fn(function (this: typeof res, code: number) {
    this.statusCode = code;
    return this;
  }) as unknown as Response["status"];
  res.json = vi.fn(function (this: typeof res, payload: unknown) {
    this.body = payload;
    return this;
  }) as unknown as Response["json"];
  return res;
}

function mockReq(authHeader?: string): Request {
  return {
    header: (name: string) =>
      name.toLowerCase() === "authorization" ? authHeader : undefined,
  } as unknown as Request;
}

describe("requireAuth (M0-4)", () => {
  it("토큰 없으면 401", () => {
    const res = mockRes();
    const next = vi.fn();
    requireAuth(mockReq(), res as Response, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("잘못된 토큰이면 401", () => {
    const res = mockRes();
    const next = vi.fn();
    requireAuth(mockReq("Bearer not-a-real-token"), res as Response, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("유효 토큰이면 req.user.id 주입 후 next 호출", () => {
    const token = signAuthToken("user-123");
    const req = mockReq(`Bearer ${token}`);
    const res = mockRes();
    const next = vi.fn();
    requireAuth(req, res as Response, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.user?.id).toBe("user-123");
  });
});
