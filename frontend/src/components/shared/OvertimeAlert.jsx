// src/components/shared/OvertimeAlert.jsx
import React from "react";
import { motion } from "framer-motion";
import { calcPenalty } from "../../utils/index.js";

export default function OvertimeAlert({ booking, overtimeMins, onExtend, onDismiss }) {
  const { amount, tier } = calcPenalty(overtimeMins);

  return (
    <motion.div
      className="overtime-alert"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
    >
      <span className="alert-icon">⚠️</span>
      <div style={{ flex: 1 }}>
        <div className="alert-title">Overtime Detected — {booking.parkingAreaName}</div>
        <div className="alert-text">
          Your booking at slot <strong>{booking.slotLabel}</strong> expired at <strong>{booking.endTime}</strong>.
          You are <strong>{overtimeMins} min</strong> over.
          {tier === "warning" && " Grace period — please vacate immediately."}
          {tier !== "warning" && tier !== "none" && ` Penalty applied: ₹${amount}`}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button
            onClick={onExtend}
            style={{
              background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)",
              borderRadius: 6, padding: "5px 14px", color: "#60a5fa", cursor: "pointer", fontSize: 12
            }}
          >
            ⏱ Extend Booking
          </button>
          <button
            onClick={onDismiss}
            style={{
              background: "none", border: "1px solid #1e2a45",
              borderRadius: 6, padding: "5px 14px", color: "#4b5563", cursor: "pointer", fontSize: 12
            }}
          >
            Dismiss
          </button>
        </div>
      </div>
      {amount > 0 && (
        <div style={{ textAlign: "right", minWidth: 60 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#ef4444" }}>₹{amount}</div>
          <div style={{ fontSize: 10, color: "#6b7280" }}>penalty</div>
        </div>
      )}
    </motion.div>
  );
}
