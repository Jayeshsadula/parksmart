// src/pages/admin/Analytics.jsx
import React, { useEffect, useState } from "react";
import Sidebar from "../../components/shared/Sidebar.jsx";
import MetricCard from "../../components/shared/MetricCard.jsx";
import BarChart from "../../components/shared/BarChart.jsx";
import { getAllBookings } from "../../services/firestoreService.js";

const ADMIN_MENUS = [
  { path: "/admin/dashboard",          icon: "📊", label: "Dashboard"      },
  { path: "/admin/layout-builder",     icon: "🏗️", label: "Layout Builder" },
  { path: "/admin/parking-management", icon: "🅿",  label: "Parking Mgmt"  },
  { path: "/admin/bookings",           icon: "📋", label: "Bookings"       },
  { path: "/admin/scanner",            icon: "📷", label: "QR Scanner"     },
  { path: "/admin/analytics",          icon: "📈", label: "Analytics"      },
  { path: "/admin/penalties",          icon: "⚠️", label: "Penalties"      },
];

export default function Analytics() {
  const [bookings, setBookings] = useState([]);

  useEffect(() => { getAllBookings().then(setBookings); }, []);

  const totalRevenue  = bookings.length * 120;
  const avgDuration   = "2.4 hrs";
  const overtimeCount = bookings.filter((b) => b.bookingStatus === "overtime").length;

  // Simulated hourly occupancy (0–23h, every 2h label)
  const hourlyData   = [15,22,45,78,90,85,70,65,88,94,89,72,60,55,48,65,89,94,80,60,40,30,20,12];
  const hourlyLabels = ["12A","2A","4A","6A","8A","10A","12P","2P","4P","6P","8P","10P"];

  const weekData   = [42,58,71,65,89,94,76];
  const weekLabels = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

  const monthData   = [320,410,380,520,490,600,580,710,690,730,680,760];
  const monthLabels = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  const areaRevenue = [
    { name: "CityMall Parking",  value: 58200, pct: 41 },
    { name: "RGIA Airport",      value: 47100, pct: 33 },
    { name: "Hitech Office Hub", value: 37200, pct: 26 },
  ];

  return (
    <div className="dashboard">
      <Sidebar menus={ADMIN_MENUS} />

      <div className="main-content">
        <div className="page-title">Analytics 📈</div>
        <div className="page-sub">Revenue, occupancy, and usage insights across all parking areas</div>

        {/* Top metrics */}
        <div className="cards-grid">
          <MetricCard icon="💰" label="Monthly Revenue"      value={`₹${totalRevenue.toLocaleString()}`} change="↑ 18% vs last month" accent="#10b981" />
          <MetricCard icon="⏱" label="Avg. Session Duration" value={avgDuration}                          change="Normal range"         accent="#3b82f6" />
          <MetricCard icon="📊" label="Peak Occupancy"        value="94%"                                 change="Saturday evening"     accent="#f59e0b" />
          <MetricCard icon="⚠️" label="Overtime Incidents"    value={overtimeCount}                        change="This month"           accent="#ef4444" />
        </div>

        {/* Charts row 1 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div className="card">
            <div style={{ fontSize: 14, fontWeight: 600, color: "#9ca3af", marginBottom: 4 }}>⏰ Hourly Occupancy — Today</div>
            <div style={{ fontSize: 11, color: "#374151", marginBottom: 12 }}>% of slots occupied per hour</div>
            <BarChart data={hourlyData} labels={hourlyLabels} height={120} color="#3b82f6" />
          </div>

          <div className="card">
            <div style={{ fontSize: 14, fontWeight: 600, color: "#9ca3af", marginBottom: 4 }}>📅 Bookings — This Week</div>
            <div style={{ fontSize: 11, color: "#374151", marginBottom: 12 }}>Total booking count per day</div>
            <BarChart data={weekData} labels={weekLabels} height={120} color="#10b981" />
          </div>
        </div>

        {/* Charts row 2 */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 16 }}>
          <div className="card">
            <div style={{ fontSize: 14, fontWeight: 600, color: "#9ca3af", marginBottom: 4 }}>📆 Monthly Booking Trend</div>
            <div style={{ fontSize: 11, color: "#374151", marginBottom: 12 }}>Yearly overview</div>
            <BarChart data={monthData} labels={monthLabels} height={120} color="#8b5cf6" />
          </div>

          <div className="card">
            <div style={{ fontSize: 14, fontWeight: 600, color: "#9ca3af", marginBottom: 14 }}>💰 Revenue by Area</div>
            {areaRevenue.map(({ name, value, pct }) => (
              <div key={name} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                  <span style={{ color: "#c4c9d6" }}>{name}</span>
                  <span style={{ color: "#10b981", fontWeight: 600 }}>₹{value.toLocaleString()}</span>
                </div>
                <div className="availability-bar" style={{ height: 6 }}>
                  <div className="availability-fill" style={{ width: `${pct}%` }} />
                </div>
                <div style={{ fontSize: 10, color: "#374151", marginTop: 2 }}>{pct}% of total</div>
              </div>
            ))}
          </div>
        </div>

        {/* Booking breakdown table */}
        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 600, color: "#9ca3af", marginBottom: 14 }}>📋 Booking Status Breakdown</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10 }}>
            {[
              { label: "Active",     count: bookings.filter(b=>b.bookingStatus==="active").length,    color: "#10b981" },
              { label: "Completed",  count: bookings.filter(b=>b.bookingStatus==="completed").length, color: "#6b7280" },
              { label: "Overtime",   count: bookings.filter(b=>b.bookingStatus==="overtime").length,  color: "#ef4444" },
              { label: "Cancelled",  count: bookings.filter(b=>b.bookingStatus==="cancelled").length, color: "#374151" },
              { label: "Delayed",    count: bookings.filter(b=>b.bookingStatus==="delayed").length,   color: "#f97316" },
              { label: "Reassigned", count: bookings.filter(b=>b.bookingStatus==="reassigned").length,color: "#a78bfa" },
            ].map(({ label, count, color }) => (
              <div key={label} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #1e2a45", borderRadius: 10, padding: 14, textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 800, color }}>{count}</div>
                <div style={{ fontSize: 12, color: "#4b5563", marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* AI forecasting placeholder */}
        <div className="card" style={{ marginTop: 16, background: "rgba(139,92,246,0.04)", border: "1px solid rgba(139,92,246,0.15)" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#a78bfa", marginBottom: 10 }}>
            🤖 LSTM Occupancy Forecast — Coming Soon
          </div>
          <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.7 }}>
            The AI module will use <strong style={{ color: "#c4c9d6" }}>TensorFlow/Keras LSTM</strong> trained on historical
            booking data to predict: peak-hour occupancy · daily demand curves · overtime probability ·
            slot utilisation scores. The Python FastAPI backend endpoint{" "}
            <code style={{ background: "#0a0e1a", padding: "2px 6px", borderRadius: 4, fontSize: 12, color: "#06b6d4" }}>/api/ai/forecast</code>{" "}
            is already scaffolded and ready for model integration.
          </div>
        </div>
      </div>
    </div>
  );
}
