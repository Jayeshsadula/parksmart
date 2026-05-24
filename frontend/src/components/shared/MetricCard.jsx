// src/components/shared/MetricCard.jsx
import React from "react";
import { motion } from "framer-motion";

export default function MetricCard({ icon, label, value, change, accent = "#3b82f6" }) {
  return (
    <motion.div
      className="metric-card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: `linear-gradient(135deg, ${accent}12, ${accent}06)`,
        border: `1px solid ${accent}25`,
      }}
    >
      <div className="metric-label">{icon} {label}</div>
      <div className="metric-value">{value}</div>
      {change && <div className="metric-change">{change}</div>}
    </motion.div>
  );
}
