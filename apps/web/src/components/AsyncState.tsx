import type { ReactNode } from "react";

interface AsyncStateProps {
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  emptyIcon?: string;
  emptyTitle?: string;
  emptyMessage?: string;
  emptyAction?: ReactNode;
  onRetry?: () => void;
  children: ReactNode;
}

export function AsyncState({
  loading,
  error,
  empty,
  emptyIcon = "💬",
  emptyTitle = "아직 내용이 없어요",
  emptyMessage = "새로운 활동이 생기면 여기에 표시됩니다.",
  emptyAction,
  onRetry,
  children,
}: AsyncStateProps) {
  if (loading) {
    return (
      <div className="state-panel state-panel--loading" aria-busy="true" aria-label="불러오는 중">
        <div className="skeleton-block skeleton-block--icon" />
        <div className="skeleton-block skeleton-block--line skeleton-block--line-lg" />
        <div className="skeleton-block skeleton-block--line skeleton-block--line-sm" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="state-panel state-panel--error">
        <div className="state-icon" aria-hidden>
          ⚠️
        </div>
        <p className="state-title">문제가 발생했어요</p>
        <p className="state-message">{error}</p>
        {onRetry && (
          <button type="button" className="btn btn--primary" onClick={onRetry}>
            다시 시도
          </button>
        )}
      </div>
    );
  }

  if (empty) {
    return (
      <div className="state-panel">
        <div className="state-icon" aria-hidden>
          {emptyIcon}
        </div>
        <p className="state-title">{emptyTitle}</p>
        <p className="state-message">{emptyMessage}</p>
        {emptyAction}
      </div>
    );
  }

  return <>{children}</>;
}
