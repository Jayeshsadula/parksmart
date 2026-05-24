// src/pages/user/MyBookings.jsx
import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import Sidebar from "../../components/shared/Sidebar.jsx";
import QRTicket from "../../components/shared/QRTicket.jsx";
import { getBookingsByUser, updateBookingStatus } from "../../services/firestoreService.js";
import useToast from "../../hooks/useToast.jsx";
import { motion } from "framer-motion";

const USER_MENUS = [
  { path: "/user/dashboard", icon: "🏠", label: "Dashboard"   },
  { path: "/user/book",      icon: "🚗", label: "Book Slot"   },
  { path: "/user/bookings",  icon: "📋", label: "My Bookings" },
  { path: "/user/profile",   icon: "👤", label: "Profile"     },
];

const STATUS_FILTERS = ["All", "active", "completed", "overtime", "cancelled"];

const STATUS_COLORS = {
  active:     { bg: "rgba(16,185,129,0.15)",  color: "#10b981" },
  occupied:   { bg: "rgba(59,130,246,0.15)",  color: "#3b82f6" },
  completed:  { bg: "rgba(107,114,128,0.15)", color: "#6b7280" },
  overtime:   { bg: "rgba(239,68,68,0.15)",   color: "#ef4444" },
  cancelled:  { bg: "rgba(107,114,128,0.1)",  color: "#374151" },
  reassigned: { bg: "rgba(139,92,246,0.15)",  color: "#a78bfa" },
};

export default function MyBookings() {
  const { currentUser } = useAuth();
  const { show, ToastContainer } = useToast();
  const [bookings, setBookings] = useState([]);
  const [filter,   setFilter]   = useState("All");
  const [ticket,   setTicket]   = useState(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    if (!currentUser?.uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const fetchBookings = async () => {
      try {
        const data = await getBookingsByUser(currentUser.uid);
        setBookings(data || []);
      } catch (err) {
        console.error("Error loading bookings:", err);
        setBookings([]);
      } finally {
        setLoading(false);
      }
    };
    fetchBookings();
  }, [currentUser]);

  const handleCancel = async (bookingId) => {
    try {
      await updateBookingStatus(bookingId, {
        bookingStatus: "cancelled",
        qrStatus:      "cancelled",
      });
      setBookings((prev) =>
        prev.map((b) =>
          b.bookingId === bookingId
            ? { ...b, bookingStatus: "cancelled", qrStatus: "cancelled" }
            : b
        )
      );
      show("Booking cancelled", "success");
    } catch {
      show("Failed to cancel", "error");
    }
  };

  // Check if booking time has passed
  const isExpired = (b) => {
    try {
      const now = new Date();
      const [year, month, day] = b.bookingDate.split("-").map(Number);
      const [hour, min]        = b.endTime.split(":").map(Number);
      return now > new Date(year, month - 1, day, hour, min);
    } catch { return false; }
  };

  const filtered = filter === "All"
    ? bookings
    : bookings.filter((b) => b.bookingStatus === filter);

  // Summary counts
  const activeCount   = bookings.filter((b) => b.bookingStatus === "active").length;
  const overtimeCount = bookings.filter((b) => b.bookingStatus === "overtime").length;
  const totalPenalty  = bookings.reduce((sum, b) => sum + (b.penaltyAmount || 0), 0);

  return (
    <div className="dashboard">
      <ToastContainer />
      {ticket && <QRTicket booking={ticket} onClose={() => setTicket(null)} />}
      <Sidebar menus={USER_MENUS} />

      <div className="main-content">
        <div className="page-title">My Bookings 📋</div>
        <div className="page-sub">Full history of all your parking sessions</div>

        {/* ── Summary Cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
          <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 12, padding: 14, textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#10b981" }}>{activeCount}</div>
            <div style={{ fontSize: 11, color: "#4b5563", marginTop: 3 }}>Active Bookings</div>
          </div>
          <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, padding: 14, textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#ef4444" }}>{overtimeCount}</div>
            <div style={{ fontSize: 11, color: "#4b5563", marginTop: 3 }}>Overtime Cases</div>
          </div>
          <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 12, padding: 14, textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#f59e0b" }}>
              {totalPenalty > 0 ? `₹${totalPenalty}` : "₹0"}
            </div>
            <div style={{ fontSize: 11, color: "#4b5563", marginTop: 3 }}>Total Penalties</div>
          </div>
        </div>

        {/* ── Filter Chips ── */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {STATUS_FILTERS.map((s) => (
            <button key={s} onClick={() => setFilter(s)} style={{
              background: filter === s ? "rgba(59,130,246,0.2)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${filter === s ? "#3b82f6" : "#1e2a45"}`,
              borderRadius: 20, padding: "5px 14px",
              color: filter === s ? "#60a5fa" : "#6b7280",
              cursor: "pointer", fontSize: 12, fontWeight: 600,
            }}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
              {s !== "All" && (
                <span style={{ marginLeft: 5, fontSize: 10, opacity: 0.7 }}>
                  ({bookings.filter((b) => b.bookingStatus === s).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div style={{ color: "#4b5563", padding: 20, textAlign: "center" }}>
            ⏳ Loading bookings...
          </div>
        )}

        {/* ── Empty State ── */}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: 60, color: "#374151" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🅿</div>
            <div style={{ marginBottom: 8 }}>No bookings found.</div>
            <span
              style={{ color: "#3b82f6", cursor: "pointer", fontSize: 13 }}
              onClick={() => window.location.href = "/user/book"}
            >
              Book your first slot →
            </span>
          </div>
        )}

        {/* ── Booking List ── */}
        {filtered.map((b, i) => {
          const sc      = STATUS_COLORS[b.bookingStatus] || STATUS_COLORS.completed;
          const expired = isExpired(b);

          return (
            <motion.div
              key={b.bookingId || i}
              className="booking-item"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              style={{ flexDirection: "column", alignItems: "stretch" }}
            >
              {/* ── Top Row ── */}
              <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>

                {/* Icon */}
                <div style={{ textAlign: "center", minWidth: 48 }}>
                  <div style={{ fontSize: 28 }}>🅿</div>
                  <div style={{ fontSize: 10, color: "#374151", marginTop: 2 }}>
                    {b.parkingAreaId?.slice(0, 6)}
                  </div>
                </div>

                {/* Info */}
                <div className="booking-info" style={{ flex: 1 }}>
                  <div className="booking-slot">
                    {b.parkingAreaName} · {b.zone} · Slot {b.slotLabel}
                  </div>
                  <div className="booking-time">
                    📅 {b.bookingDate} · ⏰ {b.startTime}–{b.endTime} · {b.floorName}
                  </div>
                  <div className="booking-time" style={{ marginTop: 2, fontFamily: "monospace", fontSize: 11 }}>
                    🆔 #{b.bookingId}
                  </div>
                </div>

                {/* Status + Actions */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, minWidth: 110 }}>

                  {/* Status badge */}
                  <span style={{
                    padding: "4px 10px", borderRadius: 20,
                    fontSize: 11, fontWeight: 600,
                    background: sc.bg, color: sc.color
                  }}>
                    {b.bookingStatus}
                  </span>

                  {/* QR Ticket button — show if active and not time-expired */}
                  {(b.qrStatus === "active" || b.qrStatus === "used") && !expired && (
                    <button onClick={() => setTicket(b)} style={{
                      background: "rgba(59,130,246,0.1)",
                      border: "1px solid rgba(59,130,246,0.2)",
                      borderRadius: 8, padding: "5px 12px",
                      color: "#60a5fa", cursor: "pointer", fontSize: 12
                    }}>
                      📱 QR Ticket
                    </button>
                  )}

                  {/* Expired QR badge */}
                  {expired && b.qrStatus !== "completed" && b.bookingStatus !== "cancelled" && (
                    <span style={{
                      background: "rgba(107,114,128,0.1)",
                      border: "1px solid rgba(107,114,128,0.2)",
                      borderRadius: 8, padding: "5px 12px",
                      color: "#6b7280", fontSize: 11
                    }}>
                      🔒 QR Expired
                    </span>
                  )}

                  {/* Completed badge */}
                  {b.qrStatus === "completed" && (
                    <span style={{
                      background: "rgba(16,185,129,0.1)",
                      border: "1px solid rgba(16,185,129,0.2)",
                      borderRadius: 8, padding: "5px 12px",
                      color: "#10b981", fontSize: 11
                    }}>
                      ✓ Exited
                    </span>
                  )}

                  {/* Cancel button */}
                  {b.bookingStatus === "active" && !expired && (
                    <button onClick={() => handleCancel(b.bookingId)} style={{
                      background: "rgba(239,68,68,0.08)",
                      border: "1px solid rgba(239,68,68,0.2)",
                      borderRadius: 8, padding: "5px 12px",
                      color: "#f87171", cursor: "pointer", fontSize: 12
                    }}>
                      Cancel
                    </button>
                  )}
                </div>
              </div>

              {/* ── Penalty Notice ── */}
              {(b.penaltyAmount > 0 || b.bookingStatus === "overtime") && (
                <div style={{
                  marginTop: 12,
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.25)",
                  borderRadius: 10, padding: 14,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#ef4444", marginBottom: 4 }}>
                        ⚠️ Overtime Penalty
                      </div>
                      <div style={{ fontSize: 11, color: "#6b7280" }}>
                        {b.overtimeMinutes > 0
                          ? `${b.overtimeMinutes} minutes overtime`
                          : "Booking time exceeded"}
                      </div>
                      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                        {b.penaltyAmount === 0   ? "Within grace period (0–15 min)"  :
                         b.penaltyAmount === 50  ? "15–30 min overtime tier"         :
                         b.penaltyAmount === 100 ? "30–60 min overtime tier"         :
                                                   "60+ min overtime tier"}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 26, fontWeight: 800, color: "#ef4444" }}>
                        {b.penaltyAmount > 0 ? `₹${b.penaltyAmount}` : "⚠"}
                      </div>
                      <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>
                        {b.penaltyAmount > 0 ? "penalty due" : "warning"}
                      </div>
                    </div>
                  </div>

                  {/* Penalty progress bar */}
                  <div style={{ marginTop: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#374151", marginBottom: 4 }}>
                      <span>Grace ₹0</span>
                      <span>₹50</span>
                      <span>₹100</span>
                      <span>₹200</span>
                    </div>
                    <div style={{ height: 6, background: "#1e2a45", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{
                        height: "100%", borderRadius: 3,
                        background:
                          b.penaltyAmount === 0   ? "#f59e0b" :
                          b.penaltyAmount === 50  ? "#f97316" :
                          b.penaltyAmount === 100 ? "#ef4444" : "#dc2626",
                        width:
                          b.penaltyAmount === 0   ? "15%" :
                          b.penaltyAmount === 50  ? "40%" :
                          b.penaltyAmount === 100 ? "70%" : "100%",
                        transition: "width 0.5s ease"
                      }} />
                    </div>
                  </div>
                </div>
              )}

            </motion.div>
          );
        })}

      </div>
    </div>
  );
}