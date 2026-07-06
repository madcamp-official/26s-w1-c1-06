import cors from "cors";
import express from "express";
import { env } from "./env.js";
import { requireAuth } from "./auth/middleware.js";
import { checkDbHealth } from "./db/health.js";
import { demoRouter } from "./routes/demo.js";

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

  // TODO(M1.1~): /auth, /friends, /promises, /positions ... (7절 인벤토리)

  return app;
}
