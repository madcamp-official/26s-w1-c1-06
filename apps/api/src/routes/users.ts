import { Router } from "express";
import { requireAuth } from "../auth/middleware.js";
import { asyncHandler } from "../lib/async-handler.js";
import { HttpError } from "../lib/errors.js";
import { searchUsers } from "../services/friends.js";

export const usersRouter = Router();

usersRouter.use(requireAuth);

usersRouter.get(
  "/search",
  asyncHandler(async (req, res) => {
    const q = req.query.q;
    if (typeof q !== "string") {
      throw new HttpError(400, "쿼리 파라미터 q가 필요합니다.");
    }
    const users = await searchUsers(req.user!.id, q);
    res.json({ users });
  }),
);
