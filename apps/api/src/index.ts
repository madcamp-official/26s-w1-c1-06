import { createApp } from "./app.js";
import { env } from "./env.js";
import { startSettlementScheduler } from "./settlement/scheduler.js";

const app = createApp();
app.listen(env.port, () => {
  console.log(`[latestock-api] listening on http://localhost:${env.port}`);
  startSettlementScheduler();
});
