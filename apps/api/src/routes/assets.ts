import { Router } from "express";
import { requireAuth } from "../auth/middleware.js";
import { asyncHandler } from "../lib/async-handler.js";
import { getAssetSummary, listTransactions } from "../services/assets.js";

export const assetsRouter = Router();

assetsRouter.use(requireAuth);

assetsRouter.get(
  "/assets",
  asyncHandler(async (req, res) => {
    const summary = await getAssetSummary(req.user!.id);
    res.json(summary);
  }),
);

assetsRouter.get(
  "/transactions",
  asyncHandler(async (req, res) => {
    const transactions = await listTransactions(req.user!.id);
    res.json({ transactions });
  }),
);
