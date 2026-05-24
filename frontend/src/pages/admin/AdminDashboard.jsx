// src/pages/admin/AdminDashboard.jsx
import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import Sidebar from "../../components/shared/Sidebar.jsx";
import MetricCard from "../../components/shared/MetricCard.jsx";
import BarChart from "../../components/shared/BarChart.jsx";
import { getAllBookings, getParkingAreasByAdmin } from "../../services/firestoreService.js";

const ADMIN_MENUS = [
  { path: "/admin/dashboard",          icon: "📊", label: "Dashboard"      },
  { path: "/admin/layout-builder",     icon: "🏗️", label: "Layout Builder" },
  { path: "/admin/parking-management", icon: "🅿",  label: "Parking Mgmt"  },
  { path: "/admin/bookings",           icon: "📋", label: "Bookings"       },
  { path: "/admin/scanner",            icon: "📷", label: "QR Scanner"     },
  { path: "/admin/analytics",          icon: "📈", label: "Analytics"      },
  { path: "/admin/penalties",          icon: "⚠️", label: "Penalties"      },
];

export default function AdminDashboard() {
  const { currentUser } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [areas, setAreas]       = useState([]);

  useEffect(() => {
    getAllBookings().then(setBookings);
    if (currentUser?.uid) getParkingAreasByAdmin(currentUser.uid).then(setAreas);
  }, [currentUser]);

  const active    = bookings.filter((b) => b.bookingStatus === "active").length;
  const overtime  = bookings.filter((b) => b.bookingStatus === "overtime").length;
  const revenue   = bookings.length * 120; // placeholder ₹120 avg

  const weekBookings = [42, 58, 71, 65, 89, 94, 76];
  const weekLabels   = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="dashboard">
      <Sidebar menus={ADMIN_MENUS} />
      <div className="main-content">
        <div className="page-title">Admin Dashboard 📊</div>
        <div className="page-sub">
          Welcome, {currentUser?.ownerName} · {currentUser?.businessName}
        </div>

        {/* Metric cards */}
        <div className="cards-grid">
          <MetricCard icon="📋" label="Total Bookings"  value={bookings.length} change="↑ 12% this week" accent="#3b82f6" />
          <MetricCard icon="🚗" label="Active Now"      value={active}          change="Live count"       accent="#10b981" />
          <MetricCard icon="💰" label="Revenue Today"   value={`₹${revenue.toLocaleString()}`} change="↑ 18% vs yesterday" accent="#f59e0b" />
          <MetricCard icon="⏰" label="Overtime Cases"  value={overtime}        change="Needs attention"  accent="#ef4444" />
          <MetricCard icon="🏢" label="Parking Areas"   value={areas.length}    change="Managed by you"  accent="#8b5cf6" />
          <MetricCard icon="⚠️" label="Penalty Pending" value="₹250"            change="2 cases"         accent="#f97316" />
        </div>

        {/* Charts row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
          <div className="card">
            <div style={{ fontSize: 14, fontWeight: 600, color: "#9ca3af", marginBottom: 12 }}>
              📈 Bookings This Week
            </div>
            <BarChart data={weekBookings} labels={weekLabels} height={100} color="#3b82f6" />
          </div>

          <div className="card">
            <div style={{ fontSize: 14, fontWeight: 600, color: "#9ca3af", marginBottom: 14 }}>
              🅿 Area Occupancy
            </div>
            {areas.length === 0 && (
              <div style={{ color: "#374151", fontSize: 13 }}>No areas created yet. Use Layout Builder.</div>
            )}
            {areas.map((a) => (
              <div key={a.parkingAreaId} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                  <span style={{ color: "#c4c9d6" }}>{a.name}</span>
                  <span style={{ color: "#6b7280" }}>{a.available}/{a.totalSlots}</span>
                </div>
                <div className="availability-bar" style={{ height: 6 }}>
                  <div className="availability-fill" style={{ width: `${((a.available || 0) / (a.totalSlots || 1)) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* IoT Monitoring Panel */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#06b6d4", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18 }}>📡</span>
            IoT Sensor Network — Real-time Monitoring
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
            {[
              { label: "Total Sensors",    value: "0",        color: "#06b6d4", status: "Awaiting deployment" },
              { label: "Online",           value: "0",        color: "#10b981", status: "Ready for ESP32" },
              { label: "Last Update",      value: "--",       color: "#f59e0b", status: "No data yet" },
              { label: "Webhook Status",   value: "Active ✓", color: "#8b5cf6", status: "POST /api/slots/iot/update" },
            ].map((item) => (
              <div key={item.label} style={{ background: "rgba(6,182,212,0.04)", border: "1px solid rgba(6,182,212,0.15)", borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 11, color: "#4b5563", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>{item.label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: item.color, marginBottom: 4 }}>{item.value}</div>
                <div style={{ fontSize: 10, color: "#374151" }}>{item.status}</div>
              </div>
            ))}
          </div>

          <div style={{ background: "rgba(6,182,212,0.06)", border: "1px solid rgba(6,182,212,0.15)", borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#67e8f9", marginBottom: 8 }}>
              🔌 Hardware Integration Ready — Phase 2
            </div>
            <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.6 }}>
              • <strong>ESP32 Microcontrollers</strong> with IR/Ultrasonic sensors detect vehicle presence<br/>
              • Sensors POST to <code style={{ background: "#0a0e1a", padding: "2px 6px", borderRadius: 4, color: "#06b6d4", fontSize: 11 }}>POST /api/slots/iot/update</code> webhook<br/>
              • Real-time Firestore listeners update frontend instantly (already wired)<br/>
              • Manual admin control available in <strong>Parking Management</strong> until sensors are deployed
            </div>
          </div>
        </div>

        {/* AI Insights placeholder */}
        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 600, color: "#a78bfa", marginBottom: 14 }}>
            🤖 AI Insights — LSTM Forecast Engine (Placeholder)
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
            {[
              { icon: "📈", title: "Peak Hours Today",      val: "5–8 PM",     sub: "High demand expected" },
              { icon: "🚗", title: "Predicted Occupancy",   val: "87%",        sub: "Tomorrow 6–9 PM" },
              { icon: "💡", title: "Recommendation",        val: "Expand Zone B", sub: "Based on overflow data" },
            ].map((item) => (
              <div key={item.title} style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.15)", borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>{item.icon}</div>
                <div style={{ fontSize: 11, color: "#7c3aed", fontWeight: 700, marginBottom: 2, textTransform: "uppercase" }}>{item.title}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 2 }}>{item.val}</div>
                <div style={{ fontSize: 11, color: "#4b5563" }}>{item.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
