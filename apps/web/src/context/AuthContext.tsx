import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { apiFetch } from "../lib/api";
import {
  clearAuth,
  getStoredUser,
  getToken,
  setAuth,
  UNAUTHORIZED_EVENT,
  type AuthUser,
} from "../lib/auth-storage";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    email: string,
    password: string,
    nickname: string,
  ) => Promise<void>;
  logout: () => void;
  /** 상점 구매/장착처럼 서버에서 내 정보가 바뀐 뒤 최신 상태로 다시 받아온다. */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(getStoredUser());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  useEffect(() => {
    if (!getToken()) {
      setIsLoading(false);
      return;
    }
    apiFetch<{ user: AuthUser }>("/api/auth/me")
      .then(({ user: fresh }) => setUser(fresh))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const { token, user: loggedInUser } = await apiFetch<{
      token: string;
      user: AuthUser;
    }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setAuth(token, loggedInUser);
    setUser(loggedInUser);
  }

  async function signup(email: string, password: string, nickname: string) {
    const { token, user: newUser } = await apiFetch<{
      token: string;
      user: AuthUser;
    }>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password, nickname }),
    });
    setAuth(token, newUser);
    setUser(newUser);
  }

  function logout() {
    apiFetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    clearAuth();
    setUser(null);
  }

  async function refreshUser() {
    const { user: fresh } = await apiFetch<{ user: AuthUser }>("/api/auth/me");
    const token = getToken();
    if (token) setAuth(token, fresh);
    setUser(fresh);
  }

  return (
    <AuthContext.Provider
      value={{ user, isLoading, login, signup, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth는 AuthProvider 내부에서만 사용할 수 있습니다.");
  return ctx;
}
