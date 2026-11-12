import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { Brand } from "./Brand";
import { GridIcon, LogoutIcon, RoofIcon, SettingsIcon } from "./Icons";

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdminArea = useLocation().pathname.startsWith("/admin");
  const navigation = isAdminArea ? <>
    <NavLink to="/admin" end><GridIcon /><span>Dashboard</span></NavLink>
    <NavLink to="/admin/panels"><RoofIcon /><span>Panel catalog</span></NavLink>
    <NavLink to="/admin/users"><SettingsIcon /><span>Users</span></NavLink>
  </> : <>
    <NavLink to="/dashboard"><GridIcon /><span>Overview</span></NavLink>
    <NavLink to="/projects"><RoofIcon /><span>Projects</span></NavLink>
    <NavLink to="/settings"><SettingsIcon /><span>Settings</span></NavLink>
    {user?.role === "ADMIN" && <NavLink to="/admin"><GridIcon /><span>Administration</span></NavLink>}
  </>;

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  const initials = user?.full_name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand compact to={isAdminArea ? "/admin" : "/dashboard"} />
        <nav className="side-nav" aria-label="Main navigation">
          {navigation}
        </nav>
        <div className="account-block">
          <span className="avatar" aria-hidden="true">{initials}</span>
          <span className="account-copy">
            <strong>{user?.full_name}</strong>
            <small>{user?.email}</small>
          </span>
          <button className="icon-button" type="button" onClick={handleLogout} aria-label="Log out">
            <LogoutIcon />
          </button>
        </div>
      </aside>
      <div className="app-workspace">
        <header className="mobile-header">
          <Brand compact to={isAdminArea ? "/admin" : "/dashboard"} />
          <div className="mobile-account">
            <span className="avatar" aria-hidden="true">{initials}</span>
            <button className="icon-button mobile-logout" type="button" onClick={handleLogout}>
              <LogoutIcon />
              <span>Log out</span>
            </button>
          </div>
        </header>
        <Outlet />
        <nav className={`mobile-nav ${user?.role === "ADMIN" && !isAdminArea ? "admin-mobile-nav" : ""}`} aria-label="Mobile navigation">
          {navigation}
        </nav>
      </div>
    </div>
  );
}
