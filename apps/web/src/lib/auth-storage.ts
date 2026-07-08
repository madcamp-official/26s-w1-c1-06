export interface AuthUser {
  id: string;
  email: string;
  nickname: string;
  availablePoints: number;
  currentPrice: number;
  equippedTitleKey: string | null;
  equippedBadgeKey: string | null;
}

const TOKEN_KEY = "latestock_token";
const USER_KEY = "latestock_user";

/** api.ts가 401 응답을 받으면 이 이벤트를 쏘고, AuthContext가 구독해 로그아웃 상태로 전환한다. */
export const UNAUTHORIZED_EVENT = "latestock:unauthorized";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setAuth(token: string, user: AuthUser): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
