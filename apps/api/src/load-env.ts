import { config } from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// 루트 .env → apps/api/.env 순 (나중 것이 우선, 이미 설정된 값은 덮지 않음)
config({ path: resolve(apiRoot, "../../.env") });
config({ path: resolve(apiRoot, ".env") });
