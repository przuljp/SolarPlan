import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { Brand } from "./Brand";
import { GridIcon, LogoutIcon, RoofIcon, SettingsIcon } from "./Icons";

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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
        <Brand compact />
        <nav className="side-nav" aria-label="Main navigation">
          <NavLink to="/dashboard">
            <GridIcon />
            Overview
          </NavLink>
          <NavLink to="/projects">
            <RoofIcon />
            Projects
          </NavLink>
          <NavLink to="/settings">
            <SettingsIcon />
            Settings
          </NavLink>
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
          <Brand compact />
          <div className="mobile-account">
            <span className="avatar" aria-hidden="true">{initials}</span>
            <button className="icon-button mobile-logout" type="button" onClick={handleLogout}>
              <LogoutIcon />
              <span>Log out</span>
            </button>
          </div>
        </header>
        <Outlet />
        <nav className="mobile-nav" aria-label="Mobile navigation">
          <NavLink to="/dashboard"><GridIcon /><span>Overview</span></NavLink>
          <NavLink to="/projects"><RoofIcon /><span>Projects</span></NavLink>
          <NavLink to="/settings"><SettingsIcon /><span>Settings</span></NavLink>
        </nav>
      </div>
    </div>
  );
}
