// src/pages/user/BookSlot.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import Sidebar from "../../components/shared/Sidebar.jsx";
import ParkingLayout from "../../components/shared/ParkingLayout.jsx";
import QRTicket from "../../components/shared/QRTicket.jsx";
import useToast from "../../hooks/useToast.jsx";
import { getParkingAreas, createBooking } from "../../services/firestoreService.js";
import { hasTimeOverlap, AREA_TYPE_ICON } from "../../utils/index.js";
import { motion } from "framer-motion";

const USER_MENUS = [
  { path: "/user/dashboard", icon: "🏠", label: "Dashboard"   },
  { path: "/user/book",      icon: "🚗", label: "Book Slot"   },
  { path: "/user/bookings",  icon: "📋", label: "My Bookings" },
  { path: "/user/profile",   icon: "👤", label: "Profile"     },
];

export default function BookSlot() {
  const nav = useNavigate();
  const loc = useLocation();
  const { currentUser } = useAuth();
  const { show, ToastContainer } = useToast();

  const [areas, setAreas]               = useState([]);
  const [selectedArea, setSelectedArea] = useState(loc.state?.area || null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [confirmedBooking, setConfirmedBooking] = useState(null);
  const [loading, setLoading]           = useState(false);
  const [form, setForm] = useState({
    date:  new Date().toISOString().split("T")[0],
    start: "10:00",
    end:   "12:00",
  });

  useEffect(() => {
    getParkingAreas().then(setAreas);
  }, []);

  // Temp lock: auto-release selection after 2 min
  useEffect(() => {
    if (!selectedSlot) return;
    const t = setTimeout(() => {
      setSelectedSlot(null);
      show("Slot selection expired (2 min). Please reselect.", "error");
    }, 120_000);
    return () => clearTimeout(t);
  }, [selectedSlot]);

  const handleBook = async () => {
    if (!selectedSlot || !selectedArea) return;
    if (form.end <= form.start) {
      show("End time must be after start time", "error"); return;
    }
    setLoading(true);
    try {
      const bookingId = await createBooking({
        userId:         currentUser.uid,
        slotId:         selectedSlot.slotId,
        parkingAreaId:  selectedArea.parkingAreaId,
        parkingAreaName: selectedArea.name,
        floorName:      selectedSlot.floorName || "Floor 1",
        zone:           selectedSlot.zone,
        slotLabel:      selectedSlot.label,
        bookingDate:    form.date,
        startTime:      form.start,
        endTime:        form.end,
      });
      setConfirmedBooking({
        bookingId,
        parkingAreaName: selectedArea.name,
        floorName:  selectedSlot.floorName || "Floor 1",
        zone:       selectedSlot.zone,
        slotLabel:  selectedSlot.label,
        bookingDate: form.date,
        startTime:  form.start,
        endTime:    form.end,
        slotId:     selectedSlot.slotId,
        bookingStatus: "active",
        qrStatus:      "active",
      });
      show("Booking confirmed! 🎉", "success");
      setSelectedSlot(null);
    } catch (err) {
      show(err.message || "Booking failed", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard">
      <ToastContainer />
      {confirmedBooking && (
        <QRTicket
          booking={confirmedBooking}
          onClose={() => { setConfirmedBooking(null); nav("/user/bookings"); }}
        />
      )}
      <Sidebar menus={USER_MENUS} />

      <div className="main-content">
        <div className="page-title">Book a Parking Slot 🚗</div>
        <div className="page-sub">Select area → pick slot → choose time → confirm</div>

        {/* Step 1 — Area selection */}
        {!selectedArea && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14 }}>
            {areas.map((area) => (
              <motion.div
                whileHover={{ y: -4 }} key={area.parkingAreaId}
                className="area-card" onClick={() => setSelectedArea(area)}
              >
                <div style={{ fontSize: 28, marginBottom: 8 }}>{AREA_TYPE_ICON[area.type] || "🅿"}</div>
                <div className="area-name">{area.name}</div>
                <div style={{ fontSize: 12, color: "#4b5563" }}>📍 {area.location}</div>
                <div className="area-meta">
                  <span className="area-tag">{area.type}</span>
                  <span className="area-tag">{area.available} available</span>
                </div>
                <div className="availability-bar">
                  <div className="availability-fill" style={{ width: `${((area.available||0)/(area.totalSlots||1))*100}%` }} />
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Step 2 — Layout + Booking Panel */}
        {selectedArea && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20, alignItems: "start" }}>
            {/* Left — Parking layout */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <button
                  onClick={() => { setSelectedArea(null); setSelectedSlot(null); }}
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid #1e2a45", borderRadius: 8, padding: "6px 12px", color: "#9ca3af", cursor: "pointer", fontSize: 12 }}
                >
                  ← Change Area
                </button>
                <span style={{ fontWeight: 700, color: "#fff" }}>{selectedArea.name}</span>
                <span style={{ fontSize: 12, color: "#4b5563" }}>📍 {selectedArea.location}</span>
              </div>
              <div className="card">
                <ParkingLayout
                  parkingAreaId={selectedArea.parkingAreaId}
                  selectedSlot={selectedSlot}
                  onSelectSlot={setSelectedSlot}
                />
              </div>
            </div>

            {/* Right — Booking panel */}
            <div className="booking-panel" style={{ position: "sticky", top: 20 }}>
              <div className="booking-title">📅 Booking Details</div>

              {/* Selected slot info */}
              {selectedSlot ? (
                <div className="selected-slot-info">
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#60a5fa", marginBottom: 10 }}>✓ Slot Selected</div>
                  {[["Slot", selectedSlot.label], ["Type", selectedSlot.slotType.toUpperCase()], ["Zone", selectedSlot.zone]].map(([k, v]) => (
                    <div className="slot-info-row" key={k}>
                      <span className="slot-info-label">{k}</span>
                      <span className="slot-info-value">{v}</span>
                    </div>
                  ))}
                  <div className="slot-info-row">
                    <span className="slot-info-label">Status</span>
                    <span style={{ color: "#10b981", fontWeight: 600, fontSize: 13 }}>Available</span>
                  </div>
                </div>
              ) : (
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed #1e2a45", borderRadius: 10, padding: 16, marginBottom: 16, textAlign: "center", color: "#374151", fontSize: 13 }}>
                  👆 Click a green slot to select
                </div>
              )}

              {/* Date */}
              <div className="form-group">
                <label className="form-label">Date</label>
                <input type="date" className="form-input"
                  value={form.date} min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>

              {/* Time */}
              <div className="time-inputs">
                <div className="form-group">
                  <label className="form-label">From</label>
                  <input type="time" className="form-input" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">To</label>
                  <input type="time" className="form-input" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
                </div>
              </div>

              <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 8, padding: 10, marginBottom: 14, fontSize: 12, color: "#4b5563" }}>
                ⏱ 15-min buffer enforced after your slot · Anti-double-booking via Firestore transaction
              </div>

              <button
                className="btn-confirm"
                onClick={handleBook}
                disabled={!selectedSlot || loading}
              >
                {loading ? "Confirming..." : selectedSlot ? "✓ Confirm Booking" : "Select a slot first"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
