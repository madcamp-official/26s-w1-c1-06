import { createApp } from "./app.js";
import { env } from "./env.js";
import { startSettlementScheduler } from "./settlement/scheduler.js";

const app = createApp();
const server = app.listen(env.port, () => {
  console.log(`[latestock-api] listening on http://localhost:${env.port}`);
  startSettlementScheduler();
});

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `[latestock-api] 포트 ${env.port}이(가) 이미 사용 중입니다. 다른 터미널의 dev:api를 Ctrl+C로 종료한 뒤 다시 실행하세요.`,
    );
    process.exit(1);
  }
  throw err;
});
