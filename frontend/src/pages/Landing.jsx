// src/pages/Landing.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const stats = [
  ["50K+", "Bookings / Month"],
  ["99.9%", "Uptime SLA"],
  ["< 2s",  "Slot Lock Time"],
  ["AI",    "Demand Forecast"],
];

export default function Landing() {
  const nav = useNavigate();

  return (
    <div className="landing">
      {/* Navbar */}
      <nav className="nav">
        <div className="logo">
          <div className="logo-icon">🅿</div>
          ParkSmart AI
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button className="btn-outline" onClick={() => nav("/user/login")}>User Login</button>
          <button className="btn-admin-outline" onClick={() => nav("/admin/login")}>Admin Login</button>
        </div>
      </nav>

      {/* Hero */}
      <motion.div className="hero" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
        <div className="hero-badge">🤖 AI-POWERED SMART PARKING</div>
        <h1 className="hero-title">Book Smarter.<br />Park Faster.</h1>
        <p className="hero-sub">Real-time parking intelligence for malls, airports, offices & more</p>

        {/* Portal Cards */}
        <div className="portal-cards">
          <motion.div whileHover={{ y: -6 }} className="portal-card user-card" onClick={() => nav("/user/login")}>
            <div className="portal-icon user">🚗</div>
            <div className="portal-title">Driver Portal</div>
            <div className="portal-desc">Book parking slots, scan QR codes, track bookings in real-time</div>
            <div className="portal-arrow">→</div>
          </motion.div>
          <motion.div whileHover={{ y: -6 }} className="portal-card admin-card" onClick={() => nav("/admin/login")}>
            <div className="portal-icon admin">🏢</div>
            <div className="portal-title">Admin Portal</div>
            <div className="portal-desc">Build dynamic layouts, manage bookings, view analytics & control access</div>
            <div className="portal-arrow">→</div>
          </motion.div>
        </div>

        {/* Stats */}
        <div className="stats-row">
          {stats.map(([n, l]) => (
            <div className="stat" key={l}>
              <div className="stat-num">{n}</div>
              <div className="stat-label">{l}</div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
