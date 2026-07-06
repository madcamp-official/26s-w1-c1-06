import { apiFetch } from "./api";
import type {
  ChartPoint,
  DemoSettleResult,
  FriendView,
  PositionView,
  PromiseView,
} from "../types/api";

export function listFriends() {
  return apiFetch<{ friends: FriendView[] }>("/api/friends");
}

export function listPromises(status?: "upcoming" | "ongoing" | "ended") {
  const q = status ? `?status=${status}` : "";
  return apiFetch<{ promises: PromiseView[] }>(`/api/promises${q}`);
}

export function getPromise(id: string) {
  return apiFetch<{ promise: PromiseView }>(`/api/promises/${id}`);
}

export function createPromise(body: {
  title: string;
  placeName: string;
  latitude: number;
  longitude: number;
  promisedAt: string;
  inviteUserIds: string[];
}) {
  return apiFetch<{ id: string }>("/api/promises", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function checkinPromise(
  promiseId: string,
  latitude: number,
  longitude: number,
) {
  return apiFetch<{ checkinAt: string }>(`/api/promises/${promiseId}/checkin`, {
    method: "POST",
    body: JSON.stringify({ latitude, longitude }),
  });
}

export function listPositions(status?: "open" | "settled") {
  const q = status ? `?status=${status}` : "";
  return apiFetch<{ positions: PositionView[] }>(`/api/positions${q}`);
}

export function openPosition(body: {
  stockUserId: string;
  promiseId: string;
  direction: "buy" | "short";
  quantity: number;
}) {
  return apiFetch<{ position: PositionView }>("/api/positions", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getMyAssets() {
  return apiFetch<{ availablePoints: number; lockedPoints: number }>("/api/me/assets");
}

export function getMyStockChart() {
  return apiFetch<{ points: ChartPoint[] }>("/api/me/stock");
}

export function getStockChart(userId: string) {
  return apiFetch<{ points: ChartPoint[] }>(`/api/stocks/${userId}`);
}

export function demoSettle(body?: { now?: string; promiseId?: string | number }) {
  return apiFetch<DemoSettleResult>("/demo/settle", {
    method: "POST",
    body: JSON.stringify(body ?? {}),
  });
}

/** F-12 미확인 정산 확인 — 베스트 에포트(실패해도 결과 화면은 유지). */
export async function confirmSettlement(
  kind: "position" | "participant",
  refId: string,
): Promise<void> {
  try {
    const path =
      kind === "position"
        ? `/api/positions/${refId}/confirm`
        : `/api/me/participations/${refId}/confirm`;
    await apiFetch(path, { method: "POST", body: JSON.stringify({}) });
  } catch {
    // confirm은 부가 효과 — 409·404 등 실패해도 결과 조회 UI를 망가뜨리지 않음
  }
}
