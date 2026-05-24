// src/pages/admin/AdminBookings.jsx
import React, { useEffect, useState } from "react";
import Sidebar from "../../components/shared/Sidebar.jsx";
import useToast from "../../hooks/useToast.jsx";
import { getAllBookings, updateBookingStatus } from "../../services/firestoreService.js";
import { motion } from "framer-motion";

const ADMIN_MENUS = [
  { path: "/admin/dashboard",          icon: "📊", label: "Dashboard"      },
  { path: "/admin/layout-builder",     icon: "🏗️", label: "Layout Builder" },
  { path: "/admin/parking-management", icon: "🅿",  label: "Parking Mgmt"  },
  { path: "/admin/bookings",           icon: "📋", label: "Bookings"       },
  { path: "/admin/scanner",            icon: "📷", label: "QR Scanner"     },
  { path: "/admin/analytics",          icon: "📈", label: "Analytics"      },
  { path: "/admin/penalties",          icon: "⚠️", label: "Penalties"      },
];

const STATUS_COLORS = {
  active:    { bg: "rgba(16,185,129,0.15)",  color: "#10b981" },
  completed: { bg: "rgba(107,114,128,0.15)", color: "#6b7280" },
  overtime:  { bg: "rgba(239,68,68,0.15)",   color: "#ef4444" },
  cancelled: { bg: "rgba(107,114,128,0.1)",  color: "#374151" },
  delayed:   { bg: "rgba(249,115,22,0.15)",  color: "#f97316" },
  reassigned:{ bg: "rgba(139,92,246,0.15)",  color: "#a78bfa" },
};

export default function AdminBookings() {
  const { show, ToastContainer } = useToast();
  const [bookings, setBookings] = useState([]);
  const [filter,   setFilter]   = useState("All");
  const [search,   setSearch]   = useState("");
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    getAllBookings().then((data) => { setBookings(data); setLoading(false); });
  }, []);

  const handleStatusUpdate = async (bookingId, status) => {
    try {
      await updateBookingStatus(bookingId, { bookingStatus: status });
      setBookings((prev) =>
        prev.map((b) => b.bookingId === bookingId ? { ...b, bookingStatus: status } : b)
      );
      show(`Booking marked as ${status}`, "success");
    } catch {
      show("Update failed", "error");
    }
  };

  const filtered = bookings
    .filter((b) => filter === "All" || b.bookingStatus === filter)
    .filter((b) =>
      !search ||
      b.bookingId?.toLowerCase().includes(search.toLowerCase()) ||
      b.userId?.toLowerCase().includes(search.toLowerCase()) ||
      b.parkingAreaName?.toLowerCase().includes(search.toLowerCase())
    );

  return (
    <div className="dashboard">
      <ToastContainer />
      <Sidebar menus={ADMIN_MENUS} />

      <div className="main-content">
        <div className="page-title">All Bookings 📋</div>
        <div className="page-sub">Complete booking registry across all parking areas</div>

        {/* Search + Filters */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
          <input
            className="form-input"
            style={{ maxWidth: 260 }}
            placeholder="🔍 Search by ID, user, area..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["All", "active", "completed", "overtime", "cancelled", "delayed", "reassigned"].map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                style={{
                  background: filter === s ? "rgba(59,130,246,0.2)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${filter === s ? "#3b82f6" : "#1e2a45"}`,
                  borderRadius: 20, padding: "4px 12px",
                  color: filter === s ? "#60a5fa" : "#6b7280",
                  cursor: "pointer", fontSize: 12, fontWeight: 600,
                }}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Summary counts */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          {Object.entries(STATUS_COLORS).map(([s, style]) => {
            const count = bookings.filter((b) => b.bookingStatus === s).length;
            return (
              <div key={s} style={{ background: style.bg, border: `1px solid ${style.color}30`, borderRadius: 8, padding: "6px 14px", fontSize: 12 }}>
                <span style={{ color: style.color, fontWeight: 700 }}>{count}</span>
                <span style={{ color: "#6b7280", marginLeft: 5 }}>{s}</span>
              </div>
            );
          })}
        </div>

        {loading && <div style={{ color: "#4b5563", padding: 20 }}>Loading bookings...</div>}

        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: 60, color: "#374151" }}>No bookings found.</div>
        )}

        {filtered.map((b, i) => {
          const sc = STATUS_COLORS[b.bookingStatus] || STATUS_COLORS.completed;
          return (
            <motion.div
              key={b.bookingId}
              className="booking-item"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <div style={{ fontSize: 26, minWidth: 40 }}>🅿</div>

              <div className="booking-info" style={{ flex: 1 }}>
                <div className="booking-slot">
                  {b.parkingAreaName} · {b.zone} · Slot {b.slotLabel}
                </div>
                <div className="booking-time">
                  👤 User: {b.userId?.slice(0, 12)}... · 📅 {b.bookingDate} · ⏰ {b.startTime}–{b.endTime}
                </div>
                <div className="booking-time" style={{ marginTop: 2 }}>
                  🆔 #{b.bookingId} · 📱 QR: {b.qrStatus}
                  {b.penaltyAmount > 0 && (
                    <span style={{ color: "#ef4444", marginLeft: 10 }}>⚠ Penalty: ₹{b.penaltyAmount}</span>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, minWidth: 130 }}>
                <span style={{ padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.color }}>
                  {b.bookingStatus}
                </span>

                {b.bookingStatus === "active" && (
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => handleStatusUpdate(b.bookingId, "completed")}
                      style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 6, padding: "4px 8px", color: "#10b981", cursor: "pointer", fontSize: 11 }}>
                      ✓ Complete
                    </button>
                    <button onClick={() => handleStatusUpdate(b.bookingId, "overtime")}
                      style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, padding: "4px 8px", color: "#f87171", cursor: "pointer", fontSize: 11 }}>
                      ⏰ Overtime
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
