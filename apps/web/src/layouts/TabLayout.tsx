import { NavLink, Outlet } from "react-router-dom";

const TABS = [
  { to: "/home", label: "홈", icon: "🏠" },
  { to: "/friends", label: "친구·시장", icon: "👥" },
  { to: "/promises", label: "약속", icon: "📅" },
  { to: "/assets", label: "자산", icon: "💰" },
  { to: "/demo", label: "데모", icon: "🧪" },
] as const;

export function TabLayout() {
  return (
    <div className="tab-layout">
      <main className="tab-layout__main">
        <Outlet />
      </main>
      <nav className="tab-bar" aria-label="메인 탭">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `tab-bar__item${isActive ? " tab-bar__item--active" : ""}`
            }
          >
            <span className="tab-bar__icon" aria-hidden>
              {tab.icon}
            </span>
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
