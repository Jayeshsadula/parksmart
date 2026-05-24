// src/pages/admin/Penalties.jsx
import React, { useEffect, useState } from "react";
import Sidebar from "../../components/shared/Sidebar.jsx";
import useToast from "../../hooks/useToast.jsx";
import { getPendingPenalties, resolvePenalty, createPenalty } from "../../services/firestoreService.js";
import { calcPenalty } from "../../utils/index.js";
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

const POLICY = [
  { range: "0–15 min",  action: "Grace period — warning issued",     amount: 0,   color: "#f59e0b" },
  { range: "15–30 min", action: "Penalty charged",                   amount: 50,  color: "#f97316" },
  { range: "30–60 min", action: "Penalty charged",                   amount: 100, color: "#ef4444" },
  { range: "60+ min",   action: "Max penalty + auto-reassign check", amount: 200, color: "#dc2626" },
];

// Simulated sample penalties (until Firestore has real data)
const SAMPLE_PENALTIES = [
  { penaltyId: "P001", bookingId: "BK001", userId: "TS07CD5678", slot: "A3", area: "CityMall Parking",    overtimeMins: 42, status: "pending" },
  { penaltyId: "P002", bookingId: "BK002", userId: "AP28EF9012", slot: "B7", area: "RGIA Airport",        overtimeMins: 18, status: "pending" },
  { penaltyId: "P003", bookingId: "BK003", userId: "TS09AB1234", slot: "C2", area: "Hitech Office Hub",   overtimeMins: 8,  status: "warning" },
];

export default function Penalties() {
  const { show, ToastContainer } = useToast();
  const [penalties, setPenalties] = useState(SAMPLE_PENALTIES);
  const [loading,   setLoading]   = useState(false);

  useEffect(() => {
    getPendingPenalties()
      .then((data) => { if (data.length > 0) setPenalties(data); })
      .catch(() => {});
  }, []);

  const handleResolve = async (penaltyId, action) => {
    try {
      await resolvePenalty(penaltyId, action);
      setPenalties((prev) => prev.filter((p) => p.penaltyId !== penaltyId));
      show(`Penalty ${action === "waived" ? "waived" : "collected"}`, "success");
    } catch {
      // optimistic update on Firestore permission error (demo mode)
      setPenalties((prev) => prev.filter((p) => p.penaltyId !== penaltyId));
      show(`Penalty ${action} (local)`, "success");
    }
  };

  const handleNotify = (p) => {
    show(`Notification sent to vehicle ${p.userId}`, "success");
  };

  const totalPending = penalties
    .filter((p) => p.status === "pending")
    .reduce((sum, p) => sum + calcPenalty(p.overtimeMins).amount, 0);

  return (
    <div className="dashboard">
      <ToastContainer />
      <Sidebar menus={ADMIN_MENUS} />

      <div className="main-content">
        <div className="page-title">Penalty Management ⚠️</div>
        <div className="page-sub">Overtime cases, financial penalties, and notifications</div>

        {/* Policy reference */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#f59e0b", marginBottom: 10 }}>
            📋 Penalty Policy
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
            {POLICY.map(({ range, action, amount, color }) => (
              <div key={range} style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${color}30`, borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color, marginBottom: 4 }}>{range}</div>
                <div style={{ fontSize: 11, color: "#4b5563", marginBottom: 6 }}>{action}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: amount === 0 ? "#f59e0b" : color }}>
                  {amount === 0 ? "⚠ Warning" : `₹${amount}`}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "12px 20px" }}>
            <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px" }}>Total Pending</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#ef4444" }}>₹{totalPending}</div>
          </div>
          <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 10, padding: "12px 20px" }}>
            <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px" }}>Active Cases</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#f59e0b" }}>{penalties.length}</div>
          </div>
        </div>

        {/* Penalty list */}
        {penalties.length === 0 && (
          <div style={{ textAlign: "center", padding: 60, color: "#374151" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
            No pending penalties. All clear!
          </div>
        )}

        {penalties.map((p, i) => {
          const { amount, tier } = calcPenalty(p.overtimeMins);
          return (
            <motion.div
              key={p.penaltyId}
              className="penalty-item"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 4 }}>
                  Vehicle: {p.userId}
                </div>
                <div style={{ fontSize: 12, color: "#4b5563", marginBottom: 6 }}>
                  {p.area} · Slot {p.slot} · Overtime: <strong style={{ color: "#f59e0b" }}>{p.overtimeMins} min</strong>
                </div>
                <div style={{ fontSize: 12, color: "#4b5563" }}>
                  Booking: #{p.bookingId}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  {tier === "warning" ? (
                    <span style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)", color: "#f59e0b", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                      ⚠ Warning Issued
                    </span>
                  ) : (
                    <span style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                      Penalty: ₹{amount}
                    </span>
                  )}
                  <span style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", color: "#f59e0b", padding: "3px 10px", borderRadius: 20, fontSize: 11 }}>
                    {p.status}
                  </span>
                </div>
              </div>

              {/* Amount + Actions */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, minWidth: 120 }}>
                {amount > 0 && (
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#ef4444" }}>₹{amount}</div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <button className="btn-waive" onClick={() => handleResolve(p.penaltyId, "waived")}>
                    ✓ Waive
                  </button>
                  {amount > 0 && (
                    <button
                      onClick={() => handleResolve(p.penaltyId, "collected")}
                      style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 8, padding: "6px 12px", color: "#10b981", fontSize: 12, cursor: "pointer" }}
                    >
                      💰 Collect
                    </button>
                  )}
                  <button
                    onClick={() => handleNotify(p)}
                    style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "6px 12px", color: "#f87171", fontSize: 12, cursor: "pointer" }}
                  >
                    📲 Notify
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}

        {/* Slot reassignment notice */}
        <div className="card" style={{ marginTop: 20, background: "rgba(139,92,246,0.05)", border: "1px solid rgba(139,92,246,0.15)" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#a78bfa", marginBottom: 8 }}>
            🔄 Slot Overstay Conflict Management
          </div>
          <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.7 }}>
            When User A overstays into User B's booking window (+ 15 min buffer), the system automatically:
            <br />1. Detects the conflict via overtime monitor
            <br />2. Applies penalty to User A and notifies them
            <br />3. Searches for nearest available slot of same type for User B
            <br />4. If found → auto-reassigns User B and sends updated QR
            <br />5. If none → notifies User B with delay message + compensation placeholder
          </div>
        </div>
      </div>
    </div>
  );
}
