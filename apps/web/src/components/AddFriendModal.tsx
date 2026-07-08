import { useEffect, useState } from "react";
import { ApiError } from "../lib/api";
import { searchUsers, sendFriendRequest } from "../lib/endpoints";
import type { UserSearchResult } from "../types/api";

interface AddFriendModalProps {
  onClose: () => void;
}

type RequestState = "idle" | "sending" | "sent" | "error";

/** 닉네임/이메일로 사용자를 검색해 친구 요청을 보내는 모달. */
export function AddFriendModal({ onClose }: AddFriendModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [requestStates, setRequestStates] = useState<Record<string, RequestState>>({});
  const [requestErrors, setRequestErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      setResults(null);
      setSearchError(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = window.setTimeout(() => {
      searchUsers(trimmed)
        .then(({ users }) => {
          setResults(users);
          setSearchError(null);
        })
        .catch((err) => {
          setResults(null);
          setSearchError(err instanceof ApiError ? err.message : "검색에 실패했습니다.");
        })
        .finally(() => setIsSearching(false));
    }, 300);

    return () => window.clearTimeout(timer);
  }, [query]);

  async function handleSendRequest(target: UserSearchResult) {
    setRequestStates((prev) => ({ ...prev, [target.id]: "sending" }));
    setRequestErrors((prev) => ({ ...prev, [target.id]: "" }));
    try {
      await sendFriendRequest(target.id);
      setRequestStates((prev) => ({ ...prev, [target.id]: "sent" }));
    } catch (err) {
      setRequestStates((prev) => ({ ...prev, [target.id]: "error" }));
      setRequestErrors((prev) => ({
        ...prev,
        [target.id]:
          err instanceof ApiError ? err.message : "친구 요청을 보내지 못했습니다.",
      }));
    }
  }

  function requestButtonLabel(state: RequestState): string {
    switch (state) {
      case "sending":
        return "보내는 중...";
      case "sent":
        return "요청 완료";
      case "error":
        return "다시 시도";
      default:
        return "요청 보내기";
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-box modal-box--add-friend modal-box--dark"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-box__header">
          <span className="modal-box__title">친구 추가</span>
          <button type="button" className="modal-box__close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>

        <p className="modal-box__hint">닉네임이나 이메일로 검색해서 친구 요청을 보내세요.</p>

        <input
          type="text"
          className="trade-field__input add-friend__search"
          placeholder="닉네임 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />

        <div className="add-friend__results">
          {isSearching && <p className="modal-box__hint">검색 중...</p>}

          {!isSearching && searchError && (
            <p className="modal-box__error" role="alert">
              {searchError}
            </p>
          )}

          {!isSearching && !searchError && query.trim().length > 0 && results?.length === 0 && (
            <p className="modal-box__hint">일치하는 사용자가 없어요.</p>
          )}

          {!isSearching &&
            results?.map((user) => {
              const state = requestStates[user.id] ?? "idle";
              return (
                <div key={user.id} className="add-friend__row">
                  <div className="add-friend__row-info">
                    <span className="add-friend__row-nickname">{user.nickname}</span>
                    <span className="add-friend__row-email">{user.email}</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn--secondary add-friend__row-btn"
                    disabled={state === "sending" || state === "sent"}
                    onClick={() => handleSendRequest(user)}
                  >
                    {requestButtonLabel(state)}
                  </button>
                  {state === "error" && requestErrors[user.id] && (
                    <p className="modal-box__error add-friend__row-error" role="alert">
                      {requestErrors[user.id]}
                    </p>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
