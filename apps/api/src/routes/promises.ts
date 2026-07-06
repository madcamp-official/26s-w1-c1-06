import { Router } from "express";
import { requireAuth } from "../auth/middleware.js";
import { asyncHandler } from "../lib/async-handler.js";
import { HttpError } from "../lib/errors.js";
import {
  checkinToPromise,
  createPromise,
  getPromise,
  getPromiseParticipants,
  listPromises,
  respondToInvite,
} from "../services/promises.js";

export const promisesRouter = Router();

promisesRouter.use(requireAuth);

promisesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const {
      title,
      placeName,
      latitude,
      longitude,
      promisedAt,
      inviteUserIds,
    } = req.body ?? {};

    if (typeof title !== "string" || typeof placeName !== "string") {
      throw new HttpError(400, "title과 placeName이 필요합니다.");
    }
    if (typeof latitude !== "number" || typeof longitude !== "number") {
      throw new HttpError(400, "latitude와 longitude가 필요합니다.");
    }
    if (typeof promisedAt !== "string") {
      throw new HttpError(400, "promisedAt(ISO 문자열)이 필요합니다.");
    }
    if (!Array.isArray(inviteUserIds)) {
      throw new HttpError(400, "inviteUserIds 배열이 필요합니다.");
    }

    const invites = inviteUserIds.map((id: unknown) => String(id));
    const parsedAt = new Date(promisedAt);
    if (Number.isNaN(parsedAt.getTime())) {
      throw new HttpError(400, "promisedAt이 유효한 ISO 시각이 아닙니다.");
    }

    const result = await createPromise(req.user!.id, {
      title,
      placeName,
      latitude,
      longitude,
      promisedAt: parsedAt,
      inviteUserIds: invites,
    });
    res.status(201).json(result);
  }),
);

promisesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const status = req.query.status;
    let filter: "upcoming" | "ongoing" | "ended" | undefined;
    if (status === "upcoming" || status === "ongoing" || status === "ended") {
      filter = status;
    } else if (status !== undefined && status !== "") {
      throw new HttpError(400, "status는 upcoming, ongoing, ended 중 하나여야 합니다.");
    }

    const promises = await listPromises(req.user!.id, filter);
    res.json({ promises });
  }),
);

promisesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    if (!id) throw new HttpError(400, "약속 id가 필요합니다.");
    const promise = await getPromise(req.user!.id, id);
    res.json({ promise });
  }),
);

promisesRouter.post(
  "/:id/respond",
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    if (!id) throw new HttpError(400, "약속 id가 필요합니다.");
    const action = req.body?.action;
    if (action !== "accept" && action !== "decline") {
      throw new HttpError(400, 'action은 "accept" 또는 "decline"이어야 합니다.');
    }
    await respondToInvite(req.user!.id, id, action);
    res.json({ ok: true });
  }),
);

promisesRouter.post(
  "/:id/checkin",
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    if (!id) throw new HttpError(400, "약속 id가 필요합니다.");
    const { latitude, longitude } = req.body ?? {};
    if (typeof latitude !== "number" || typeof longitude !== "number") {
      throw new HttpError(400, "latitude와 longitude가 필요합니다.");
    }
    const result = await checkinToPromise(
      req.user!.id,
      id,
      latitude,
      longitude,
    );
    res.json(result);
  }),
);

promisesRouter.get(
  "/:id/participants",
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    if (!id) throw new HttpError(400, "약속 id가 필요합니다.");
    const result = await getPromiseParticipants(req.user!.id, id);
    res.json(result);
  }),
);
