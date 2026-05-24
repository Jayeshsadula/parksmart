// src/components/shared/ParkingSlot.jsx
import React from "react";
import { motion } from "framer-motion";
import { SLOT_TYPE_META } from "../../utils/index.js";

const STATUS_CLASS = {
  vacant:           "slot available",
  occupied:         "slot occupied",
  reserved:         "slot reserved",
  temporary_locked: "slot locked",
  maintenance:      "slot disabled-slot",
};

export default function ParkingSlot({ slot, selected, onSelect, adminMode, onAdminClick }) {
  const meta = SLOT_TYPE_META[slot.slotType] || SLOT_TYPE_META.normal;
  const isClickable = adminMode || slot.status === "vacant";

  const baseClass = STATUS_CLASS[slot.status] || "slot available";
  const evClass   = slot.slotType === "ev"       ? " ev"       : "";
  const selClass  = selected && slot.status === "vacant" ? " selected" : "";

  const handleClick = () => {
    if (!isClickable && !adminMode) return;
    if (adminMode) { onAdminClick && onAdminClick(slot); return; }
    if (slot.status !== "vacant") return;
    onSelect && onSelect(slot);
  };

  return (
    <motion.div
      className={`${baseClass}${evClass}${selClass}`}
      whileHover={isClickable ? { scale: 1.1 } : {}}
      whileTap={isClickable ? { scale: 0.95 } : {}}
      onClick={handleClick}
      title={`${slot.label} · ${slot.slotType.toUpperCase()} · ${slot.status}`}
    >
      <div className="slot-icon">{meta.icon}</div>
      <div className="slot-id">{slot.label}</div>
    </motion.div>
  );
}
