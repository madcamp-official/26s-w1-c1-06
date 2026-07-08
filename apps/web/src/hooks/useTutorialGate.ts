import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";

function storageKey(userId: string): string {
  return `hasSeenTutorial:${userId}`;
}

/** 홈 화면의 "다시보기" 버튼이 이 이벤트를 쏘면, 최초 방문 여부와 무관하게 튜토리얼 모달을 다시 연다. */
const REOPEN_TUTORIAL_EVENT = "latestock:reopen-tutorial";

export function reopenTutorial(): void {
  window.dispatchEvent(new Event(REOPEN_TUTORIAL_EVENT));
}

/** 계정별 최초 방문 여부를 localStorage로 판단해 튜토리얼 모달 노출을 제어한다. */
export function useTutorialGate(): { show: boolean; dismiss: () => void } {
  const { user } = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!user) {
      setShow(false);
      return;
    }
    setShow(!localStorage.getItem(storageKey(user.id)));
  }, [user]);

  useEffect(() => {
    function reopen() {
      setShow(true);
    }
    window.addEventListener(REOPEN_TUTORIAL_EVENT, reopen);
    return () => window.removeEventListener(REOPEN_TUTORIAL_EVENT, reopen);
  }, []);

  function dismiss() {
    if (user) localStorage.setItem(storageKey(user.id), "true");
    setShow(false);
  }

  return { show, dismiss };
}
