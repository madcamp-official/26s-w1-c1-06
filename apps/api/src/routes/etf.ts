import { Router } from "express";
import { requireAuth } from "../auth/middleware.js";
import { asyncHandler } from "../lib/async-handler.js";
import { HttpError } from "../lib/errors.js";
import {
  getEtfRecommendations,
  listEtfBaskets,
  openEtfBasket,
} from "../services/etf.js";

export const etfRouter = Router();

etfRouter.use(requireAuth);

etfRouter.get(
  "/recommendations",
  asyncHandler(async (req, res) => {
    const recommendations = await getEtfRecommendations(req.user!.id);
    res.json({ recommendations });
  }),
);

etfRouter.post(
  "/baskets",
  asyncHandler(async (req, res) => {
    const { direction, quantity, label, themeKey, legs } = req.body ?? {};

    if (direction !== "buy" && direction !== "short") {
      throw new HttpError(400, 'direction은 "buy" 또는 "short"여야 합니다.');
    }
    if (typeof quantity !== "number") {
      throw new HttpError(400, "quantity가 필요합니다.");
    }
    if (!Array.isArray(legs)) {
      throw new HttpError(400, "legs 배열이 필요합니다.");
    }
    for (const leg of legs) {
      if (
        typeof leg?.stockUserId !== "string" ||
        typeof leg?.promiseId !== "string"
      ) {
        throw new HttpError(
          400,
          "legs의 각 항목은 stockUserId와 promiseId가 필요합니다.",
        );
      }
    }
    if (label !== undefined && typeof label !== "string") {
      throw new HttpError(400, "label은 문자열이어야 합니다.");
    }
    if (themeKey !== undefined && typeof themeKey !== "string") {
      throw new HttpError(400, "themeKey는 문자열이어야 합니다.");
    }

    const basket = await openEtfBasket(req.user!.id, {
      direction,
      quantity,
      label,
      themeKey,
      legs,
    });
    res.status(201).json({ basket });
  }),
);

etfRouter.get(
  "/baskets",
  asyncHandler(async (req, res) => {
    const status = req.query.status;
    let filter: "open" | "settled" | undefined;
    if (status === "open" || status === "settled") {
      filter = status;
    } else if (status !== undefined && status !== "") {
      throw new HttpError(400, "status는 open 또는 settled여야 합니다.");
    }

    const baskets = await listEtfBaskets(req.user!.id, filter);
    res.json({ baskets });
  }),
);
