import cors from "cors";
import express from "express";
import { env } from "./env.js";
import { requireAuth } from "./auth/middleware.js";
import { checkDbHealth } from "./db/health.js";
import { demoRouter } from "./routes/demo.js";
import { authRouter } from "./routes/auth.js";
import { friendsRouter } from "./routes/friends.js";
import { usersRouter } from "./routes/users.js";
import { promisesRouter } from "./routes/promises.js";
import { positionsRouter, meRouter } from "./routes/positions.js";
import { assetsRouter } from "./routes/assets.js";

export function createApp(): express.Express {
  const app = express();

  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json());

  // 배포 도달성 확인용 (구현계획 M0-6).
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "latestock-api", ts: Date.now() });
  });

  // Neon 등 DB 연결·쿼리 검증용.
  app.get("/api/db/health", async (_req, res) => {
    const db = await checkDbHealth();
    const httpStatus =
      db.status === "ok" ? 200 : db.status === "not_configured" ? 503 : 500;
    res.status(httpStatus).json(db);
  });

  // 보호 라우트 동작 확인용 데모 엔드포인트 (M0-4 검증).
  app.get("/api/me/ping", requireAuth, (req, res) => {
    res.json({ userId: req.user?.id });
  });

  // F-16 데모: 강제 정산 (M1.0-3).
  app.use("/demo", demoRouter);

  // M1.1-1 인증 (F-01, F-09)
  app.use("/api/auth", authRouter);

  // M1.1-2 친구 (F-02, F-03)
  app.use("/api/friends", friendsRouter);
  app.use("/api/users", usersRouter);

  // M1.1-3/4 약속·GPS (F-04, F-05, F-19)
  app.use("/api/promises", promisesRouter);

  // M1.2 포지션·자기주식 (F-10/F-11, F-17/F-18)
  app.use("/api/positions", positionsRouter);
  app.use("/api/me", meRouter);

  // M1.2-3 자산 화면 — 가용/잠금 포인트, 원장 (F-14 일부)
  app.use("/api/me", assetsRouter);

  return app;
}
