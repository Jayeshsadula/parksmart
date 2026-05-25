// src/components/shared/ParkingSlot.jsx
import React from "react";

const STATUS_CLASS = {
  vacant:           "slot available",
  available:        "slot available",
  occupied:         "slot occupied",
  reserved:         "slot reserved",
  temporary_locked: "slot locked",
  maintenance:      "slot disabled-slot",
  overtime:         "slot occupied",
};

const SLOT_TYPE_ICONS = {
  normal:   "🚗",
  vip:      "⭐",
  ev:       "⚡",
  disabled: "♿",
};

export default function ParkingSlot({ slot, selected, onSelect, onAdminClick, adminMode }) {
  //                                                   ^^^^^^^^  ^^^^^^^^^^^^
  //                                                   FIXED: match ParkingLayout prop names

  const statusClass  = STATUS_CLASS[slot.status] || "slot available";
  const icon         = SLOT_TYPE_ICONS[slot.slotType] || "🚗";
  const isSelectable = slot.status === "vacant" || slot.status === "available";

  const handleClick = () => {
    if (adminMode) {
      onAdminClick?.(slot);   // admin → open status modal
      return;
    }
    if (isSelectable) onSelect?.(slot);  // user → select slot
  };

  return (
    <div
      className={`${statusClass} ${selected ? "selected" : ""} ${slot.slotType === "ev" ? "ev" : ""}`}
      onClick={handleClick}
      title={`Slot ${slot.label} — ${slot.status}`}
      style={{ cursor: adminMode || isSelectable ? "pointer" : "not-allowed" }}
    >
      <div className="slot-icon">{icon}</div>
      <div className="slot-id">{slot.label}</div>
    </div>
  );
}