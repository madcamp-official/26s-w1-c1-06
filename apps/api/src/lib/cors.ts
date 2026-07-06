import type { CorsOptions } from "cors";
import { env } from "../env.js";

/** CORS_ORIGIN: 단일 URL 또는 쉼표 구분 목록. dev에서는 localhost 임의 포트 허용. */
export function createCorsOptions(): CorsOptions {
  const allowed = new Set(
    env.corsOrigins.map((o) => o.trim()).filter(Boolean),
  );

  return {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowed.has(origin)) {
        callback(null, true);
        return;
      }
      if (!env.isProd && /^http:\/\/localhost:\d+$/.test(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS blocked: ${origin}`));
    },
  };
}
