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

/** 팀원 confirm API 연동 전까지 실패해도 무시 */
export async function confirmSettlement(
  kind: "position" | "participant",
  refId: string,
): Promise<void> {
  try {
    await apiFetch("/api/settlements/confirm", {
      method: "POST",
      body: JSON.stringify({ kind, refId }),
    });
  } catch {
    // API 미구현 시 무시 (구현계획 H-3)
  }
}
