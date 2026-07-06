import { NavLink, Outlet } from "react-router-dom";

const TABS = [
  { to: "/home", label: "홈", icon: "🏠" },
  { to: "/friends", label: "친구·시장", icon: "👥" },
  { to: "/promises", label: "약속", icon: "📅" },
  { to: "/assets", label: "자산", icon: "💰" },
  { to: "/demo", label: "데모", icon: "🧪" },
] as const;

function NavItems({ className }: { className: string }) {
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
        </NavLink>
      ))}
    </>
  );
}

export function TabLayout() {
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
    </div>
  );
}
