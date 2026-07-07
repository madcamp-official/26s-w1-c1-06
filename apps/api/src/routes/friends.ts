import { Router } from "express";
import { requireAuth } from "../auth/middleware.js";
import { asyncHandler } from "../lib/async-handler.js";
import { HttpError } from "../lib/errors.js";
import {
  acceptFriendRequest,
  getFriendRanking,
  listFriends,
  listIncomingFriendRequests,
  rejectFriendRequest,
  sendFriendRequest,
} from "../services/friends.js";

export const friendsRouter = Router();

friendsRouter.use(requireAuth);

friendsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const friends = await listFriends(req.user!.id);
    res.json({ friends });
  }),
);

friendsRouter.get(
  "/rankings",
  asyncHandler(async (req, res) => {
    const rankings = await getFriendRanking(req.user!.id);
    res.json({ rankings });
  }),
);

friendsRouter.get(
  "/requests",
  asyncHandler(async (req, res) => {
    const requests = await listIncomingFriendRequests(req.user!.id);
    res.json({ requests });
  }),
);

friendsRouter.post(
  "/requests",
  asyncHandler(async (req, res) => {
    const addresseeId = req.body?.addresseeId;
    if (
      typeof addresseeId !== "number" &&
      typeof addresseeId !== "string"
    ) {
      throw new HttpError(400, "addresseeId가 필요합니다.");
    }
    const result = await sendFriendRequest(
      req.user!.id,
      String(addresseeId),
    );
    res.status(201).json(result);
  }),
);

friendsRouter.post(
  "/requests/:id/accept",
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    if (!id) throw new HttpError(400, "요청 id가 필요합니다.");
    await acceptFriendRequest(id, req.user!.id);
    res.json({ ok: true });
  }),
);

friendsRouter.post(
  "/requests/:id/reject",
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    if (!id) throw new HttpError(400, "요청 id가 필요합니다.");
    await rejectFriendRequest(id, req.user!.id);
    res.json({ ok: true });
  }),
);
