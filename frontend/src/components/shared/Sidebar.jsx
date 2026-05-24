// src/components/shared/Sidebar.jsx
import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { logout } from "../../services/authService.js";
import { useAuth } from "../../context/AuthContext.jsx";

export default function Sidebar({ menus }) {
  const nav = useNavigate();
  const loc = useLocation();
  const { currentUser, setCurrentUser, setRole } = useAuth();

  const handleLogout = async () => {
    await logout();
    setCurrentUser(null);
    setRole(null);
    nav("/");
  };

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <div className="logo">
          <div className="logo-icon">🅿</div>
          ParkSmart AI
        </div>
      </div>

      <nav className="sidebar-nav">
        {menus.map((m) => (
          <div
            key={m.path}
            className={`nav-item ${loc.pathname === m.path ? "active" : ""}`}
            onClick={() => nav(m.path)}
          >
            <span className="nav-icon">{m.icon}</span>
            {m.label}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div style={{ fontSize: 12, color: "#4b5563", marginBottom: 4 }}>
          {currentUser?.name || currentUser?.ownerName}
        </div>
        <div style={{ fontSize: 11, color: "#374151", marginBottom: 10 }}>
          {currentUser?.email}
        </div>
        <div className="nav-item" onClick={handleLogout} style={{ cursor: "pointer" }}>
          <span className="nav-icon">🚪</span> Sign Out
        </div>
      </div>
    </div>
  );
}
