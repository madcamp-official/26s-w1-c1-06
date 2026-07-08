import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AsyncState } from "../components/AsyncState";
import { listPromises } from "../lib/endpoints";
import type { PromiseView } from "../types/api";

type StatusTab = "upcoming" | "ongoing" | "ended";

const TABS: { key: StatusTab; label: string }[] = [
  { key: "upcoming", label: "예정" },
  { key: "ongoing", label: "진행" },
  { key: "ended", label: "종료" },
];

const INVITE_STATUS_LABEL: Record<PromiseView["myInviteStatus"], string> = {
  invited: "응답 대기",
  accepted: "참여 확정",
  declined: "거절함",
  auto_declined: "미응답 마감",
};

export function PromisesScreen() {
  const [tab, setTab] = useState<StatusTab>("upcoming");
  const [promises, setPromises] = useState<PromiseView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((status: StatusTab) => {
    setError(null);
    setPromises(null);
    listPromises(status)
      .then(({ promises: items }) => setPromises(items))
      .catch((err) => {
        setError(err instanceof Error ? err.message : "약속 목록을 불러오지 못했습니다.");
      });
  }, []);

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  return (
    <div className="screen">
      <header className="screen-header">
        <h1>약속</h1>
        <p className="screen-header__sub">예정·진행·종료 약속을 관리합니다.</p>
      </header>

      <div className="promises-toolbar">
        <div className="promises-tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`promises-tabs__item${tab === t.key ? " promises-tabs__item--active" : ""}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Link to="/promises/new" className="btn btn--primary">
          새 약속
        </Link>
      </div>

      <AsyncState
        loading={promises === null && !error}
        error={error}
        onRetry={() => load(tab)}
        empty={promises?.length === 0}
        emptyIcon="📅"
        emptyTitle="표시할 약속이 없어요"
        emptyMessage="새 약속을 만들어 친구를 초대해 보세요."
      >
        <ul className="promises-list">
          {promises?.map((p) => (
            <li key={p.id}>
              <Link to={`/promises/${p.id}`} className="promises-list__item">
                <div className="promises-list__main">
                  <span className="promises-list__title">{p.title}</span>
                  <span className="promises-list__place">{p.placeName}</span>
                </div>
                <div className="promises-list__meta">
                  <span className="promises-list__time">
                    {new Date(p.promisedAt).toLocaleString("ko-KR")}
                  </span>
                  <span className="promises-list__status">
                    {INVITE_STATUS_LABEL[p.myInviteStatus]}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </AsyncState>
    </div>
  );
}
