import { Router } from "express";
import { requireAuth } from "../auth/middleware.js";
import { asyncHandler } from "../lib/async-handler.js";
import { HttpError } from "../lib/errors.js";
import { listBettablePromisesForStock } from "../services/promises.js";
import { getBettorSummary } from "../services/positions.js";
import { getStockChart } from "../services/stock-chart.js";

/** GET /me/stock — 본인 차트 (F-08/F-13). */
export const meStockRouter = Router();

meStockRouter.use(requireAuth);

meStockRouter.get(
  "/stock",
  asyncHandler(async (req, res) => {
    const points = await getStockChart(req.user!.id, req.user!.id);
    res.json({ points });
  }),
);

/** GET /stocks/:userId — 친구 차트 (F-08/F-13, R-5). */
export const stocksRouter = Router();

stocksRouter.use(requireAuth);

stocksRouter.get(
  "/:userId",
  asyncHandler(async (req, res) => {
    const userId = req.params.userId;
    if (!userId) throw new HttpError(400, "userId가 필요합니다.");
    const points = await getStockChart(req.user!.id, userId);
    res.json({ points });
  }),
);

/** GET /stocks/:userId/promises — 종목 기준 베팅 가능 약속 (R-5, M3-1). */
stocksRouter.get(
  "/:userId/promises",
  asyncHandler(async (req, res) => {
    const userId = req.params.userId;
    if (!userId) throw new HttpError(400, "userId가 필요합니다.");
    const promises = await listBettablePromisesForStock(req.user!.id, userId);
    res.json({ promises });
  }),
);

/** GET /stocks/:userId/promises/:promiseId/bettors — 베팅 현황 공개 (M6-5). */
stocksRouter.get(
  "/:userId/promises/:promiseId/bettors",
  asyncHandler(async (req, res) => {
    const userId = req.params.userId;
    const promiseId = req.params.promiseId;
    if (!userId || !promiseId) {
      throw new HttpError(400, "userId와 promiseId가 필요합니다.");
    }
    const summary = await getBettorSummary(req.user!.id, userId, promiseId);
    res.json(summary);
  }),
);
