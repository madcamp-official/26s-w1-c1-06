import { apiFetch } from "./api";
import type {
  BettablePromiseView,
  ChartPoint,
  DemoSettleResult,
  FriendView,
  PositionView,
  PromiseParticipantsView,
  PromiseView,
  UnconfirmedSettlements,
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

export function getPromiseParticipants(promiseId: string) {
  return apiFetch<PromiseParticipantsView>(
    `/api/promises/${promiseId}/participants`,
  );
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

export function closePosition(positionId: string) {
  return apiFetch<{ position: PositionView }>(`/api/positions/${positionId}/close`, {
    method: "POST",
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

export function getStockPromises(userId: string) {
  return apiFetch<{ promises: BettablePromiseView[] }>(`/api/stocks/${userId}/promises`);
}

export function demoSettle(body?: { now?: string; promiseId?: string | number }) {
  return apiFetch<DemoSettleResult>("/api/demo/settle", {
    method: "POST",
    body: JSON.stringify(body ?? {}),
  });
}

export function getUnconfirmedSettlements() {
  return apiFetch<UnconfirmedSettlements>("/api/me/unconfirmed-settlements");
}

/**
 * kind별로 실제 confirm 엔드포인트가 분리되어 있음 (F-12):
 * - "position": 투자자 본인이 자신의 포지션 정산을 확인 → /api/positions/:id/confirm
 * - "participant": 종목 본인이 자신의 약속 정산을 확인 → /api/me/participations/:promiseId/confirm
 *
 * 정산 결과 화면(useSettlementResult)은 결과 조회의 loading/error와 분리해 이 함수를
 * try/catch 밖에서 베스트 에포트로 호출한다. 두 엔드포인트 모두 멱등적이지 않아 재방문 시
 * 409(이미 확인됨)를 반환할 수 있는데, confirm 실패가 이미 그려진 결과 화면을 에러로
 * 덮어쓰지 않도록 어떤 사유로든 실패해도 던지지 않는다 (배너는 다음 조회 때 갱신된다).
 */
export async function confirmSettlement(
  kind: "position" | "participant",
  refId: string,
): Promise<void> {
  const path =
    kind === "position"
      ? `/api/positions/${refId}/confirm`
      : `/api/me/participations/${refId}/confirm`;
  try {
    await apiFetch(path, { method: "POST" });
  } catch (err) {
    console.warn("정산 확인 처리 실패:", err);
  }
}
