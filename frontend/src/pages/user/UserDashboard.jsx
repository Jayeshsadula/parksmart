// src/pages/user/UserDashboard.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import Sidebar from "../../components/shared/Sidebar.jsx";
import MetricCard from "../../components/shared/MetricCard.jsx";
import OvertimeAlert from "../../components/shared/OvertimeAlert.jsx";
import { getBookingsByUser } from "../../services/firestoreService.js";
import { getParkingAreas } from "../../services/firestoreService.js";
import { AREA_TYPE_ICON } from "../../utils/index.js";
import { motion } from "framer-motion";

const USER_MENUS = [
  { path: "/user/dashboard", icon: "🏠", label: "Dashboard"   },
  { path: "/user/book",      icon: "🚗", label: "Book Slot"   },
  { path: "/user/bookings",  icon: "📋", label: "My Bookings" },
  { path: "/user/profile",   icon: "👤", label: "Profile"     },
];

export default function UserDashboard() {
  const nav = useNavigate();
  const { currentUser } = useAuth();
  const [areas, setAreas] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [overtime, setOvertime] = useState(null);

  useEffect(() => {
    getParkingAreas().then(setAreas);
    if (currentUser?.uid) {
      getBookingsByUser(currentUser.uid).then((bks) => {
        setBookings(bks);
        // Check overtime
        const now = new Date();
        const ot = bks.find((b) => {
          if (b.bookingStatus !== "active") return false;
          const [h, m] = b.endTime.split(":").map(Number);
          const end = new Date(b.bookingDate);
          end.setHours(h, m, 0, 0);
          return now > end;
        });
        setOvertime(ot || null);
      });
    }
  }, [currentUser]);

  const activeCount   = bookings.filter((b) => b.bookingStatus === "active").length;
  const firstName     = currentUser?.name?.split(" ")[0] || "there";

  return (
    <div className="dashboard">
      <Sidebar menus={USER_MENUS} />
      <div className="main-content">
        {overtime && (
          <OvertimeAlert
            booking={overtime}
            overtimeMins={15}
            onExtend={() => nav("/user/bookings")}
            onDismiss={() => setOvertime(null)}
          />
        )}

        <div className="page-title">Good morning, {firstName} 👋</div>
        <div className="page-sub">Vehicle: {currentUser?.vehicleNumber} · Your smart parking hub</div>

        {/* Metrics */}
        <div className="cards-grid">
          <MetricCard icon="🚗" label="Active Bookings" value={activeCount}       change="Live"      accent="#10b981" />
          <MetricCard icon="📋" label="Total Bookings"  value={bookings.length}   change="All time"  accent="#3b82f6" />
          <MetricCard icon="⭐" label="Saved Areas"     value={3}                 change="Favourites" accent="#f59e0b" />
          <MetricCard icon="💰" label="Penalty Balance" value="₹0"               change="All clear"  accent="#06b6d4" />
        </div>

        {/* Nearby Areas */}
        <div className="page-title" style={{ fontSize: 16, marginBottom: 12 }}>
          Nearby Parking Areas
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14 }}>
          {areas.map((area) => (
            <motion.div
              whileHover={{ y: -4 }}
              key={area.parkingAreaId}
              className="area-card"
              onClick={() => nav("/user/book", { state: { area } })}
            >
              <div style={{ fontSize: 28, marginBottom: 8 }}>
                {AREA_TYPE_ICON[area.type] || "🅿"}
              </div>
              <div className="area-name">{area.name}</div>
              <div style={{ fontSize: 12, color: "#4b5563" }}>📍 {area.location}</div>
              <div className="area-meta">
                <span className="area-tag">{area.type}</span>
                <span className="area-tag">{area.totalFloors} floors</span>
                <span className="area-tag">{area.available} available</span>
              </div>
              <div className="availability-bar">
                <div
                  className="availability-fill"
                  style={{ width: `${((area.available || 0) / (area.totalSlots || 1)) * 100}%` }}
                />
              </div>
              <div style={{ fontSize: 11, color: "#4b5563", marginTop: 4 }}>
                {area.available}/{area.totalSlots} slots available
              </div>
            </motion.div>
          ))}
        </div>

        {/* AI Insight Placeholder */}
        <div style={{ marginTop: 20, background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.15)", borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#a78bfa", marginBottom: 6 }}>🤖 AI Recommendation (LSTM Forecast)</div>
          <div style={{ fontSize: 13, color: "#6b7280" }}>
            Peak hours today: <strong style={{ color: "#e8eaf0" }}>5–8 PM</strong>.
            Best time to book: <strong style={{ color: "#10b981" }}>2–4 PM</strong> (low occupancy predicted).
            Nearest available EV slot: <strong style={{ color: "#06b6d4" }}>CityMall · Floor 1 · Zone B</strong>.
          </div>
        </div>
      </div>
    </div>
  );
}
