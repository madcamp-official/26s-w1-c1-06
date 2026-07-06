import { Router } from "express";
import { signAuthToken } from "../auth/jwt.js";
import { requireAuth } from "../auth/middleware.js";
import { asyncHandler } from "../lib/async-handler.js";
import { HttpError } from "../lib/errors.js";
import { getUserProfile, loginUser, signupUser } from "../services/auth.js";

export const authRouter = Router();

function tokenResponse(user: Awaited<ReturnType<typeof signupUser>>) {
  const token = signAuthToken(user.id);
  return { token, user };
}

authRouter.post(
  "/signup",
  asyncHandler(async (req, res) => {
    const { email, password, nickname } = req.body ?? {};
    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      typeof nickname !== "string"
    ) {
      throw new HttpError(400, "email, password, nickname이 필요합니다.");
    }
    const user = await signupUser(email, password, nickname);
    res.status(201).json(tokenResponse(user));
  }),
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body ?? {};
    if (typeof email !== "string" || typeof password !== "string") {
      throw new HttpError(400, "email, password가 필요합니다.");
    }
    const user = await loginUser(email, password);
    res.json(tokenResponse(user));
  }),
);

authRouter.post(
  "/logout",
  requireAuth,
  (_req, res) => {
    res.json({ ok: true });
  },
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await getUserProfile(req.user!.id);
    res.json({ user });
  }),
);
