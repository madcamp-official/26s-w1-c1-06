import { Router } from "express";
import { requireAuth } from "../auth/middleware.js";
import { asyncHandler } from "../lib/async-handler.js";
import { HttpError } from "../lib/errors.js";
import { equipShopItem, getShopState, purchaseShopItem } from "../services/shop.js";

export const shopRouter = Router();

shopRouter.use(requireAuth);

shopRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const state = await getShopState(req.user!.id);
    res.json(state);
  }),
);

shopRouter.post(
  "/purchase",
  asyncHandler(async (req, res) => {
    const itemKey = req.body?.itemKey;
    if (typeof itemKey !== "string") {
      throw new HttpError(400, "itemKey가 필요합니다.");
    }
    await purchaseShopItem(req.user!.id, itemKey);
    res.status(201).json({ ok: true });
  }),
);

shopRouter.post(
  "/equip",
  asyncHandler(async (req, res) => {
    const { itemType, itemKey } = req.body ?? {};
    if (itemType !== "title" && itemType !== "badge") {
      throw new HttpError(400, 'itemType은 "title" 또는 "badge"여야 합니다.');
    }
    if (itemKey !== null && typeof itemKey !== "string") {
      throw new HttpError(400, "itemKey는 문자열이거나 null이어야 합니다.");
    }
    await equipShopItem(req.user!.id, itemType, itemKey);
    res.json({ ok: true });
  }),
);
