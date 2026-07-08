import { Router } from "express";
import { requireAuth } from "../auth/middleware.js";
import { env } from "../env.js";
import { runSettlementNow } from "../settlement/scheduler.js";
import { seedAllVerdictResults } from "../services/demo-settlement-memes.js";

export const demoRouter = Router();

/** F-16 데모: 강제 정산. 비프로덕션 또는 DEMO_MODE=true 에서만 허용. */
demoRouter.post("/settle", async (req, res) => {
  if (env.isProd && process.env.DEMO_MODE !== "true") {
    res.status(403).json({ error: "데모 정산은 비프로덕션 환경에서만 사용 가능합니다." });
    return;
  }

  try {
    const now =
      typeof req.body?.now === "string" ? new Date(req.body.now) : undefined;
    const promiseId =
      typeof req.body?.promiseId === "number"
        ? req.body.promiseId
        : typeof req.body?.promiseId === "string"
          ? Number(req.body.promiseId)
          : undefined;

    if (now !== undefined && Number.isNaN(now.getTime())) {
      res.status(400).json({ error: "now는 유효한 ISO 시각 문자열이어야 합니다." });
      return;
    }

    const result = await runSettlementNow({ now, promiseId });
    if (result.failedIds.length > 0) {
      res
        .status(500)
        .json({ ok: false, ...result, error: "일부 약속 정산에 실패했습니다." });
      return;
    }
    res.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * F-16/F-20 데모: 정산 결과 팝업(AutoSettlementReveal)이 등급별로 어떻게 보이는지
 * 한 번에 보여주기 위해, 밈 등급 5종(상한가/숨고르기/폭락장/서킷브레이커/상장폐지)에
 * 해당하는 미확인 정산을 로그인한 유저 앞으로 만들어준다. 홈 화면에 뜨는
 * AutoSettlementReveal이 이 5건을 큐로 잡아 순서대로 보여준다.
 * 비프로덕션 또는 DEMO_MODE=true 에서만 허용.
 */
demoRouter.post("/seed-settlement-memes", requireAuth, async (req, res) => {
  if (env.isProd && process.env.DEMO_MODE !== "true") {
    res.status(403).json({ error: "데모 기능은 비프로덕션 환경에서만 사용 가능합니다." });
    return;
  }

  try {
    await seedAllVerdictResults(req.user!.id);
    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});
