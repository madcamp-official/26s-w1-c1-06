import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AsyncState } from "../components/AsyncState";
import { apiFetch } from "../lib/api";

type NotificationItem =
  | { type: "settlement_stock"; promiseId: string; promiseTitle: string; at: string }
  | {
      type: "settlement_investor";
      positionId: string;
      promiseId: string;
      promiseTitle: string;
      stockNickname: string;
      at: string;
    }
  | { type: "friend_request"; requestId: string; requesterNickname: string; at: string }
  | { type: "promise_invite"; promiseId: string; promiseTitle: string; at: string };

interface NotificationsResult {
  items: NotificationItem[];
  totalCount: number;
}

function formatAt(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function itemLink(item: NotificationItem): string {
  switch (item.type) {
    case "settlement_stock":
      return `/results/stock/${item.promiseId}`;
    case "settlement_investor":
      return `/results/position/${item.positionId}`;
    case "friend_request":
      return "/friends";
    case "promise_invite":
      return "/promises";
  }
}

function itemText(item: NotificationItem): string {
  switch (item.type) {
    case "settlement_stock":
      return `"${item.promiseTitle}" 정산 결과가 나왔어요`;
    case "settlement_investor":
      return `${item.stockNickname}에게 건 "${item.promiseTitle}" 베팅이 정산됐어요`;
    case "friend_request":
      return `${item.requesterNickname}님이 친구 요청을 보냈어요`;
    case "promise_invite":
      return `"${item.promiseTitle}" 약속에 초대됐어요`;
  }
}

/** 인앱 알림함 (S-07 1차) — 미확인 정산/친구요청/약속초대 통합. */
export function NotificationsScreen() {
  const [data, setData] = useState<NotificationsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setError(null);
    apiFetch<NotificationsResult>("/api/me/notifications")
      .then(setData)
      .catch((err) => {
        setError(err instanceof Error ? err.message : "알림을 불러오지 못했습니다.");
      });
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="screen">
      <header className="screen-header">
        <h1>알림</h1>
        <p className="screen-header__sub">정산·친구·약속 소식을 한곳에서 확인합니다.</p>
      </header>

      <AsyncState
        loading={!data && !error}
        error={error}
        onRetry={load}
        empty={data?.items.length === 0}
        emptyIcon="🔔"
        emptyTitle="새 알림이 없어요"
        emptyMessage="정산·친구요청·약속초대가 생기면 여기에 표시됩니다."
      >
        <ul className="notification-list">
          {data?.items.map((item, index) => (
            <li key={`${item.type}-${index}`} className="notification-list__item">
              <Link to={itemLink(item)} className="notification-list__link">
                <span className="notification-list__text">{itemText(item)}</span>
                <span className="notification-list__at">{formatAt(item.at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </AsyncState>
    </div>
  );
}
