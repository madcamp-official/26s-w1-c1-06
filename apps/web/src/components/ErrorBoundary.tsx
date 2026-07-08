import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/** 자식 트리의 렌더링 예외를 흰 화면 대신 재시도 UI로 대체한다. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  override render() {
    if (this.state.error) {
      return (
        <div className="state-panel state-panel--error">
          <div className="state-icon" aria-hidden>
            ⚠️
          </div>
          <p className="state-title">문제가 발생했어요</p>
          <p className="state-message">
            화면을 불러오는 중 오류가 발생했습니다. 새로고침해도 계속되면 알려주세요.
          </p>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => window.location.reload()}
          >
            새로고침
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
