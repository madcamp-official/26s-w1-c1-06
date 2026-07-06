/** HTTP 상태와 함께 던지는 서비스 계층 오류. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function requirePool<T>(
  pool: T | null,
): asserts pool is NonNullable<T> {
  if (!pool) {
    throw new HttpError(503, "DATABASE_URL이 설정되지 않았습니다.");
  }
}
