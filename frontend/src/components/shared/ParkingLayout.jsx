// src/components/shared/ParkingLayout.jsx
import React, { useEffect, useState } from "react";
import { subscribeToSlots } from "../../services/firestoreService.js";
import { getFloorsByArea } from "../../services/firestoreService.js";
import ParkingSlot from "./ParkingSlot";
import { updateSlotStatus } from "../../services/firestoreService.js";
import useToast from "../../hooks/useToast.jsx";

const LEGEND = [
  { icon: "🟢", label: "Available" },
  { icon: "🔴", label: "Occupied" },
  { icon: "🟡", label: "Reserved" },
  { icon: "⚡", label: "EV Charging" },
  { icon: "⭐", label: "VIP" },
  { icon: "♿", label: "Accessible" },
];

export default function ParkingLayout({ parkingAreaId, selectedSlot, onSelectSlot, adminMode = false }) {
  const [floors, setFloors] = useState([]);
  const [slotsByFloor, setSlotsByFloor] = useState({});
  const [activeFloor, setActiveFloor] = useState(null);
  const [adminModal, setAdminModal] = useState(null);
  const { show, ToastContainer } = useToast();

  // Load floors for this area
  useEffect(() => {
    if (!parkingAreaId) return;
    getFloorsByArea(parkingAreaId).then((f) => {
      setFloors(f);
      if (f.length > 0) setActiveFloor(f[0].floorId);
    });
  }, [parkingAreaId]);

  // Real-time slot subscription per floor
  useEffect(() => {
    if (!activeFloor) return;
    const unsub = subscribeToSlots(activeFloor, (slots) => {
      setSlotsByFloor((prev) => ({ ...prev, [activeFloor]: slots }));
    });
    return unsub;
  }, [activeFloor]);

  // Group slots by zone
  const groupByZone = (slots = []) => {
    const zones = {};
    slots.forEach((s) => {
      if (!zones[s.zone]) zones[s.zone] = [];
      zones[s.zone].push(s);
    });
    return zones;
  };

  const handleAdminStatusChange = async (status) => {
    if (!adminModal) return;
    try {
      await updateSlotStatus(adminModal.slotId, status);
      show(`Slot ${adminModal.label} → ${status}`, "success");
    } catch {
      show("Failed to update slot", "error");
    }
    setAdminModal(null);
  };

  const currentSlots = slotsByFloor[activeFloor] || [];
  const zones = groupByZone(currentSlots);

  return (
    <div className="parking-layout">
      <ToastContainer />

      {/* Admin status modal */}
      {adminModal && (
        <div className="modal-overlay" onClick={() => setAdminModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Change Status: Slot {adminModal.label}</div>
            {["vacant", "occupied", "reserved", "maintenance"].map((s) => (
              <button
                key={s}
                className="btn-builder"
                onClick={() => handleAdminStatusChange(s)}
                style={{ padding: "12px", textAlign: "center", fontSize: 14, fontWeight: 600, marginBottom: 8 }}
              >
                {s === "vacant" ? "🟢" : s === "occupied" ? "🔴" : s === "reserved" ? "🟡" : "⚫"}
                {" "}Mark as {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
            <button onClick={() => setAdminModal(null)} style={{ width: "100%", marginTop: 4, background: "rgba(255,255,255,0.03)", border: "1px solid #1e2a45", borderRadius: 8, padding: 10, color: "#6b7280", cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="legend">
        {LEGEND.map(({ icon, label }) => (
          <div className="legend-item" key={label}><span>{icon}</span>{label}</div>
        ))}
      </div>

      {/* Floor tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {floors.map((f) => (
          <button
            key={f.floorId}
            onClick={() => setActiveFloor(f.floorId)}
            style={{
              background: activeFloor === f.floorId ? "rgba(59,130,246,0.2)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${activeFloor === f.floorId ? "#3b82f6" : "#1e2a45"}`,
              borderRadius: 8, padding: "6px 14px",
              color: activeFloor === f.floorId ? "#60a5fa" : "#6b7280",
              cursor: "pointer", fontSize: 13, fontWeight: 600,
            }}
          >
            🏢 {f.floorName}
          </button>
        ))}
      </div>

      {/* Zones & Slots */}
      {Object.entries(zones).map(([zoneName, slots]) => (
        <div key={zoneName} className="zone-section">
          <div className="zone-label">{zoneName}</div>
          <div className="slots-grid">
            {slots
              .sort((a, b) => a.label.localeCompare(b.label))
              .map((slot) => (
                <ParkingSlot
                  key={slot.slotId}
                  slot={slot}
                  selected={selectedSlot?.slotId === slot.slotId}
                  onSelect={onSelectSlot}
                  adminMode={adminMode}
                  onAdminClick={setAdminModal}
                />
              ))}
          </div>
        </div>
      ))}

      {currentSlots.length === 0 && (
        <div style={{ textAlign: "center", padding: 40, color: "#374151", fontSize: 14 }}>
          No slots found for this floor. Admin can add slots via Layout Builder.
        </div>
      )}
    </div>
  );
}
