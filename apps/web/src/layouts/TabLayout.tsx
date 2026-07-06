import { NavLink, Outlet } from "react-router-dom";

const TABS = [
  { to: "/home", label: "홈" },
  { to: "/friends", label: "친구·시장" },
  { to: "/promises", label: "약속" },
  { to: "/assets", label: "자산" },
  { to: "/demo", label: "데모" },
] as const;

export function TabLayout() {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>
      <nav
        style={{
          display: "flex",
          borderTop: "1px solid #ddd",
          position: "sticky",
          bottom: 0,
          background: "#fff",
        }}
      >
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            style={({ isActive }) => ({
              flex: 1,
              textAlign: "center",
              padding: "12px 0",
              textDecoration: "none",
              color: isActive ? "#000" : "#888",
              fontWeight: isActive ? 700 : 400,
            })}
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
