import { Router } from "express";
import { requireAuth } from "../auth/middleware.js";
import { asyncHandler } from "../lib/async-handler.js";
import { HttpError } from "../lib/errors.js";
import { getNotifications } from "../services/notifications.js";
import { confirmParticipation } from "../services/promises.js";
import { getUnconfirmedSettlements } from "../services/settlement-inbox.js";

/** GET /me/unconfirmed-settlements, POST /me/participations/:promiseId/confirm (F-12). */
export const settlementInboxRouter = Router();

settlementInboxRouter.use(requireAuth);

settlementInboxRouter.get(
  "/unconfirmed-settlements",
  asyncHandler(async (req, res) => {
    const result = await getUnconfirmedSettlements(req.user!.id);
    res.json(result);
  }),
);

settlementInboxRouter.get(
  "/notifications",
  asyncHandler(async (req, res) => {
    const result = await getNotifications(req.user!.id);
    res.json(result);
  }),
);

settlementInboxRouter.post(
  "/participations/:promiseId/confirm",
  asyncHandler(async (req, res) => {
    const promiseId = req.params.promiseId;
    if (!promiseId) throw new HttpError(400, "promiseId가 필요합니다.");
    await confirmParticipation(req.user!.id, promiseId);
    res.json({ ok: true });
  }),
);
