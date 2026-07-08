import { AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { TutorialModal } from "../components/TutorialModal";
import { useTutorialGate } from "../hooks/useTutorialGate";
import { apiFetch } from "../lib/api";
import { usePolling } from "../hooks/usePolling";

const TABS = [
  { to: "/home", label: "홈", icon: "🏠" },
  { to: "/friends", label: "친구·시장", icon: "👥" },
  { to: "/promises", label: "약속", icon: "📅" },
  { to: "/assets", label: "자산", icon: "💰" },
  { to: "/history", label: "내역", icon: "🧾" },
  { to: "/notifications", label: "알림", icon: "🔔" },
  { to: "/demo", label: "데모", icon: "🧪" },
] as const;

function useNotificationCount(): number {
  const [count, setCount] = useState(0);

  function load() {
    apiFetch<{ totalCount: number }>("/api/me/notifications")
      .then((r) => setCount(r.totalCount))
      .catch(() => setCount(0));
  }

  useEffect(() => {
    load();
  }, []);
  usePolling(load, 30000);

  return count;
}

function NavItems({ className }: { className: string }) {
  const notificationCount = useNotificationCount();

  return (
    <>
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            `${className}${isActive ? ` ${className}--active` : ""}`
          }
        >
          <span className="tab-bar__icon" aria-hidden>
            {tab.icon}
          </span>
          <span>{tab.label}</span>
          {tab.to === "/notifications" && notificationCount > 0 && (
            <span className="tab-badge">{notificationCount}</span>
          )}
        </NavLink>
      ))}
    </>
  );
}

export function TabLayout() {
  const tutorial = useTutorialGate();

  return (
    <div className="tab-layout">
      <aside className="tab-sidebar" aria-label="메인 메뉴">
        <div className="tab-sidebar__brand">
          <span className="tab-sidebar__logo" aria-hidden>
            📈
          </span>
          Latestock
        </div>
        <nav className="tab-sidebar__nav">
          <NavItems className="tab-sidebar__item" />
        </nav>
      </aside>

      <main className="tab-layout__main">
        <Outlet />
      </main>

      <nav className="tab-bar" aria-label="메인 탭">
        <NavItems className="tab-bar__item" />
      </nav>

      <AnimatePresence>
        {tutorial.show && <TutorialModal key="tutorial" onClose={tutorial.dismiss} />}
      </AnimatePresence>
    </div>
  );
}
