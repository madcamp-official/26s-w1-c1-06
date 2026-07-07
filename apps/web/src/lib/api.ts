import { clearAuth, getToken, UNAUTHORIZED_EVENT } from "./auth-storage";

/** dev: 비우면 Vite 프록시(동일 오리진). 배포 시 VITE_API_BASE_URL 설정. */
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new ApiError(
      0,
      "서버에 연결할 수 없습니다. API가 실행 중인지 확인해 주세요.",
    );
  }

  if (res.status === 401) {
    clearAuth();
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    throw new ApiError(401, "인증이 만료되었습니다. 다시 로그인해주세요.");
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, body?.error ?? "요청에 실패했습니다.", body ?? undefined);
  }
  return body as T;
}
