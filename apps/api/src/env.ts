import "./load-env.js";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === "") {
    throw new Error(`환경 변수 ${name} 이(가) 설정되지 않았습니다. .env.example 참고.`);
  }
  return value;
}

function parseCorsOrigins(raw: string): string[] {
  return raw
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

const corsOriginRaw = process.env.CORS_ORIGIN ?? "http://localhost:5173";

export const env = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: required("JWT_SECRET", "dev-only-insecure-secret"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  /** @deprecated corsOrigins 사용 */
  corsOrigin: parseCorsOrigins(corsOriginRaw)[0] ?? "http://localhost:5173",
  corsOrigins: parseCorsOrigins(corsOriginRaw),
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProd: process.env.NODE_ENV === "production",
};
