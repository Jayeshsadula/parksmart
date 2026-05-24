// src/components/shared/Toast.jsx
import React, { useEffect } from "react";

export default function Toast({ message, type = "success", onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  const icon = type === "success" ? "✓" : type === "error" ? "✗" : "ℹ";
  const color = type === "success" ? "#10b981" : type === "error" ? "#ef4444" : "#3b82f6";

  return (
    <div
      className="toast"
      style={{ borderColor: color + "60" }}
    >
      <span style={{ color, fontWeight: 700, fontSize: 16 }}>{icon}</span>
      <span>{message}</span>
      <button
        onClick={onClose}
        style={{ background: "none", border: "none", color: "#4b5563", cursor: "pointer", marginLeft: 8 }}
      >
        ✕
      </button>
    </div>
  );
}
