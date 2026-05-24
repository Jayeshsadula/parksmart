// src/components/shared/BarChart.jsx
import React from "react";

export default function BarChart({ data = [], labels = [], height = 100, color = "#3b82f6" }) {
  const max = Math.max(...data, 1);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height }}>
        {data.map((v, i) => (
          <div
            key={i}
            title={labels[i] ? `${labels[i]}: ${v}` : `${v}`}
            style={{
              flex: 1,
              height: `${(v / max) * 100}%`,
              background: `linear-gradient(180deg, ${color}, ${color}40)`,
              borderRadius: "4px 4px 0 0",
              cursor: "pointer",
              transition: "height 0.4s ease",
              minWidth: 16,
            }}
          />
        ))}
      </div>
      {labels.length > 0 && (
        <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
          {labels.map((l, i) => (
            <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 10, color: "#4b5563" }}>
              {l}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
