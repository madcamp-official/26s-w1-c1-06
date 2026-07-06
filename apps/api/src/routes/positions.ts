import { Router } from "express";
import { requireAuth } from "../auth/middleware.js";
import { asyncHandler } from "../lib/async-handler.js";
import { HttpError } from "../lib/errors.js";
import {
  confirmPosition,
  listPositions,
  openPosition,
} from "../services/positions.js";
import {
  exerciseOption,
  listActiveOptions,
  listLots,
  sellLot,
} from "../services/self-stock.js";

export const positionsRouter = Router();

positionsRouter.use(requireAuth);

positionsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const { stockUserId, promiseId, direction, quantity } = req.body ?? {};

    if (typeof stockUserId !== "string" || typeof promiseId !== "string") {
      throw new HttpError(400, "stockUserId와 promiseId가 필요합니다.");
    }
    if (direction !== "buy" && direction !== "short") {
      throw new HttpError(400, 'direction은 "buy" 또는 "short"여야 합니다.');
    }
    if (typeof quantity !== "number") {
      throw new HttpError(400, "quantity가 필요합니다.");
    }

    const position = await openPosition(req.user!.id, {
      stockUserId,
      promiseId,
      direction,
      quantity,
    });
    res.status(201).json({ position });
  }),
);

positionsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const status = req.query.status;
    let filter: "open" | "settled" | undefined;
    if (status === "open" || status === "settled") {
      filter = status;
    } else if (status !== undefined && status !== "") {
      throw new HttpError(400, "status는 open 또는 settled여야 합니다.");
    }

    const positions = await listPositions(req.user!.id, filter);
    res.json({ positions });
  }),
);

positionsRouter.post(
  "/:id/confirm",
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    if (!id) throw new HttpError(400, "포지션 id가 필요합니다.");
    await confirmPosition(req.user!.id, id);
    res.json({ ok: true });
  }),
);

export const meRouter = Router();

meRouter.use(requireAuth);

meRouter.get(
  "/options",
  asyncHandler(async (req, res) => {
    const options = await listActiveOptions(req.user!.id);
    res.json({ options });
  }),
);

meRouter.post(
  "/options/:id/exercise",
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    if (!id) throw new HttpError(400, "권한 id가 필요합니다.");
    const quantity = req.body?.quantity;
    if (typeof quantity !== "number") {
      throw new HttpError(400, "quantity가 필요합니다.");
    }

    const lot = await exerciseOption(req.user!.id, id, quantity);
    res.status(201).json({ lot });
  }),
);

meRouter.get(
  "/lots",
  asyncHandler(async (req, res) => {
    const includeSold = req.query.includeSold === "true";
    const lots = await listLots(req.user!.id, undefined, includeSold);
    res.json({ lots });
  }),
);

meRouter.post(
  "/lots/:id/sell",
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    if (!id) throw new HttpError(400, "로트 id가 필요합니다.");

    const result = await sellLot(req.user!.id, id);
    res.json(result);
  }),
);
