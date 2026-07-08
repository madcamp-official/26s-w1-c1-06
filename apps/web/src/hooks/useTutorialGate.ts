import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";

function storageKey(userId: string): string {
  return `hasSeenTutorial:${userId}`;
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

  function dismiss() {
    if (user) localStorage.setItem(storageKey(user.id), "true");
    setShow(false);
  }

  return { show, dismiss };
}
