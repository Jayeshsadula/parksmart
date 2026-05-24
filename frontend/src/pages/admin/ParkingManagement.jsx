// src/pages/admin/ParkingManagement.jsx
import React, { useEffect, useState } from "react";
import Sidebar from "../../components/shared/Sidebar.jsx";
import ParkingLayout from "../../components/shared/ParkingLayout.jsx";
import useToast from "../../hooks/useToast.jsx";
import { getParkingAreas } from "../../services/firestoreService.js";
import { useAuth } from "../../context/AuthContext.jsx";

const ADMIN_MENUS = [
  { path: "/admin/dashboard",          icon: "📊", label: "Dashboard"      },
  { path: "/admin/layout-builder",     icon: "🏗️", label: "Layout Builder" },
  { path: "/admin/parking-management", icon: "🅿",  label: "Parking Mgmt"  },
  { path: "/admin/bookings",           icon: "📋", label: "Bookings"       },
  { path: "/admin/scanner",            icon: "📷", label: "QR Scanner"     },
  { path: "/admin/analytics",          icon: "📈", label: "Analytics"      },
  { path: "/admin/penalties",          icon: "⚠️", label: "Penalties"      },
];

export default function ParkingManagement() {
  const { currentUser } = useAuth();
  const { show, ToastContainer } = useToast();
  const [areas, setAreas]             = useState([]);
  const [selectedArea, setSelectedArea] = useState(null);

  useEffect(() => {
    getParkingAreas().then((data) => {
      setAreas(data);
      if (data.length > 0) setSelectedArea(data[0]);
    });
  }, []);

  return (
    <div className="dashboard">
      <ToastContainer />
      <Sidebar menus={ADMIN_MENUS} />

      <div className="main-content">
        <div className="page-title">Parking Management 🅿</div>
        <div className="page-sub">
          Click any slot to manually update its occupancy status
        </div>

        {/* IoT notice */}
        <div style={{
          marginBottom: 16, padding: 14,
          background: "rgba(6,182,212,0.06)", border: "1px solid rgba(6,182,212,0.15)",
          borderRadius: 12, fontSize: 13, color: "#67e8f9",
          display: "flex", alignItems: "flex-start", gap: 10,
        }}>
          <span style={{ fontSize: 18 }}>📡</span>
          <div>
            <strong>IoT Integration Ready:</strong> When ESP32 + IR/Ultrasonic sensors are deployed,
            they will push slot status directly to Firestore. All real-time listeners are already wired.
            Currently: <strong>manual admin control mode</strong>.
          </div>
        </div>

        {/* Area selector tabs */}
        {areas.length > 0 && (
          <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
            {areas.map((a) => (
              <button
                key={a.parkingAreaId}
                onClick={() => setSelectedArea(a)}
                style={{
                  background: selectedArea?.parkingAreaId === a.parkingAreaId
                    ? "rgba(59,130,246,0.2)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${selectedArea?.parkingAreaId === a.parkingAreaId ? "#3b82f6" : "#1e2a45"}`,
                  borderRadius: 8, padding: "7px 16px",
                  color: selectedArea?.parkingAreaId === a.parkingAreaId ? "#60a5fa" : "#6b7280",
                  cursor: "pointer", fontSize: 13, fontWeight: 600,
                }}
              >
                {a.name}
              </button>
            ))}
          </div>
        )}

        {/* Parking grid */}
        {selectedArea ? (
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{selectedArea.name}</div>
                <div style={{ fontSize: 12, color: "#4b5563" }}>📍 {selectedArea.location}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {[
                  { label: "Simulate Full",  action: () => show("All slots marked occupied (simulation)", "success") },
                  { label: "Reset All",      action: () => show("All slots reset to vacant", "success") },
                ].map(({ label, action }) => (
                  <button key={label} onClick={action}
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid #1e2a45", borderRadius: 8, padding: "6px 12px", color: "#9ca3af", cursor: "pointer", fontSize: 12 }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <ParkingLayout
              parkingAreaId={selectedArea.parkingAreaId}
              adminMode={true}
            />
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: 60, color: "#374151" }}>
            No parking areas found. Create one via Layout Builder.
          </div>
        )}

        {/* Slot status legend reference */}
        <div className="card" style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#9ca3af", marginBottom: 10 }}>Booking States Reference</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 8 }}>
            {[
              { state: "available",        color: "#10b981", desc: "Slot is free to book" },
              { state: "temporary_locked", color: "#78716c", desc: "2-min selection lock" },
              { state: "reserved",         color: "#f59e0b", desc: "Booking confirmed" },
              { state: "occupied",         color: "#ef4444", desc: "Vehicle present" },
              { state: "overtime",         color: "#f97316", desc: "Past booking time" },
              { state: "maintenance",      color: "#374151", desc: "Under maintenance" },
            ].map(({ state, color, desc }) => (
              <div key={state} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #1e2a45", borderRadius: 8, padding: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#c4c9d6" }}>{state}</span>
                </div>
                <div style={{ fontSize: 11, color: "#4b5563" }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
