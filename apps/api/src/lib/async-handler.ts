import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../lib/errors.js";

type AsyncHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<void>;

/** async 라우트에서 HttpError → JSON 응답. */
export function asyncHandler(fn: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    void fn(req, res, next).catch((err: unknown) => {
      if (err instanceof HttpError) {
        res.status(err.status).json({ ...err.details, error: err.message });
        return;
      }
      next(err);
    });
  };
}
