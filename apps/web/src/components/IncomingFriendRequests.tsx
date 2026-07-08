import { useCallback, useEffect, useState } from "react";
import { usePolling } from "../hooks/usePolling";
import { ApiError } from "../lib/api";
import {
  acceptFriendRequest,
  listIncomingFriendRequests,
  rejectFriendRequest,
} from "../lib/endpoints";
import type { FriendRequestView } from "../types/api";

interface IncomingFriendRequestsProps {
  onSuccess?: () => void;
}

type ActionState = "idle" | "processing" | "error";

/** 받은 친구 요청 목록 — 수락/거절 처리. */
export function IncomingFriendRequests({ onSuccess }: IncomingFriendRequestsProps) {
  const [requests, setRequests] = useState<FriendRequestView[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionStates, setActionStates] = useState<Record<string, ActionState>>({});
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    listIncomingFriendRequests()
      .then(({ requests: items }) => {
        setRequests(items);
        setLoadError(null);
      })
      .catch((err) => {
        setLoadError(
          err instanceof ApiError ? err.message : "받은 친구 요청을 불러오지 못했습니다.",
        );
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  usePolling(load, 3000);

  async function handleAction(id: string, action: "accept" | "reject") {
    setActionStates((prev) => ({ ...prev, [id]: "processing" }));
    setActionErrors((prev) => ({ ...prev, [id]: "" }));
    try {
      if (action === "accept") {
        await acceptFriendRequest(id);
      } else {
        await rejectFriendRequest(id);
      }
      setRequests((prev) => prev?.filter((r) => r.id !== id) ?? prev);
      onSuccess?.();
    } catch (err) {
      setActionStates((prev) => ({ ...prev, [id]: "error" }));
      if (err instanceof ApiError && err.status === 409) {
        // 이미 처리된 요청 — 목록에서 제거
        setRequests((prev) => prev?.filter((r) => r.id !== id) ?? prev);
        return;
      }
      setActionErrors((prev) => ({
        ...prev,
        [id]:
          err instanceof ApiError
            ? err.message
            : action === "accept"
              ? "친구 요청을 수락하지 못했습니다."
              : "친구 요청을 거절하지 못했습니다.",
      }));
    }
  }

  if (requests === null) {
    return loadError ? (
      <p className="incoming-requests__error" role="alert">
        {loadError}
      </p>
    ) : null;
  }
  if (requests.length === 0) return null;

  return (
    <section className="incoming-requests" aria-label="받은 친구 요청">
      <h2 className="incoming-requests__title">받은 친구 요청 ({requests.length})</h2>
      <div className="incoming-requests__list">
        {requests.map((request) => {
          const state = actionStates[request.id] ?? "idle";
          const isProcessing = state === "processing";
          return (
            <div key={request.id} className="incoming-requests__row">
              <span className="incoming-requests__nickname">
                {request.requesterNickname}
              </span>
              <div className="incoming-requests__actions">
                <button
                  type="button"
                  className="btn btn--primary incoming-requests__btn"
                  disabled={isProcessing}
                  onClick={() => handleAction(request.id, "accept")}
                >
                  수락
                </button>
                <button
                  type="button"
                  className="btn btn--secondary incoming-requests__btn"
                  disabled={isProcessing}
                  onClick={() => handleAction(request.id, "reject")}
                >
                  거절
                </button>
              </div>
              {state === "error" && actionErrors[request.id] && (
                <p className="incoming-requests__error" role="alert">
                  {actionErrors[request.id]}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
