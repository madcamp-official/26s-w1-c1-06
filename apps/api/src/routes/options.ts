import { Router } from "express";
import { requireAuth } from "../auth/middleware.js";
import { asyncHandler } from "../lib/async-handler.js";
import { HttpError } from "../lib/errors.js";
import { buyOption, listOptions } from "../services/options.js";

export const optionsRouter = Router();

optionsRouter.use(requireAuth);

optionsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const { stockUserId, promiseId, optionType, quantity } = req.body ?? {};

    if (typeof stockUserId !== "string" || typeof promiseId !== "string") {
      throw new HttpError(400, "stockUserId와 promiseId가 필요합니다.");
    }
    if (optionType !== "call" && optionType !== "put") {
      throw new HttpError(400, 'optionType은 "call" 또는 "put"이어야 합니다.');
    }
    if (typeof quantity !== "number") {
      throw new HttpError(400, "quantity가 필요합니다.");
    }

    const option = await buyOption(req.user!.id, {
      stockUserId,
      promiseId,
      optionType,
      quantity,
    });
    res.status(201).json({ option });
  }),
);

optionsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const status = req.query.status;
    let filter: "open" | "settled" | undefined;
    if (status === "open" || status === "settled") {
      filter = status;
    } else if (status !== undefined && status !== "") {
      throw new HttpError(400, "status는 open 또는 settled여야 합니다.");
    }

    const options = await listOptions(req.user!.id, filter);
    res.json({ options });
  }),
);
