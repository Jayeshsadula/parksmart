// src/pages/user/UserProfile.jsx
import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import Sidebar from "../../components/shared/Sidebar.jsx";
import useToast from "../../hooks/useToast.jsx";
import { updateDoc, doc } from "firebase/firestore";
import { db } from "../../services/firebase.js";

const USER_MENUS = [
  { path: "/user/dashboard", icon: "🏠", label: "Dashboard"   },
  { path: "/user/book",      icon: "🚗", label: "Book Slot"   },
  { path: "/user/bookings",  icon: "📋", label: "My Bookings" },
  { path: "/user/profile",   icon: "👤", label: "Profile"     },
];

export default function UserProfile() {
  const { currentUser, setCurrentUser } = useAuth();
  const { show, ToastContainer } = useToast();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name:          currentUser?.name || "",
    phone:         currentUser?.phone || "",
    vehicleNumber: currentUser?.vehicleNumber || "",
  });

  const handleSave = async () => {
    try {
      await updateDoc(doc(db, "users", currentUser.uid), form);
      setCurrentUser({ ...currentUser, ...form });
      setEditing(false);
      show("Profile updated", "success");
    } catch {
      show("Failed to update profile", "error");
    }
  };

  const rows = [
    ["Full Name",       currentUser?.name,          "name"],
    ["Email",           currentUser?.email,          null],
    ["Phone",           currentUser?.phone,          "phone"],
    ["Vehicle Number",  currentUser?.vehicleNumber,  "vehicleNumber"],
    ["Role",            "Driver",                    null],
    ["Member Since",    new Date(currentUser?.metadata?.creationTime || Date.now()).toLocaleDateString(), null],
  ];

  return (
    <div className="dashboard">
      <ToastContainer />
      <Sidebar menus={USER_MENUS} />
      <div className="main-content">
        <div className="page-title">My Profile 👤</div>
        <div className="page-sub">Manage your account details</div>

        <div className="card" style={{ maxWidth: 500 }}>
          {/* Avatar */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
            <div style={{
              width: 60, height: 60, borderRadius: "50%",
              background: "linear-gradient(135deg,#3b82f6,#06b6d4)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 24, fontWeight: 700, color: "#fff"
            }}>
              {currentUser?.name?.[0]?.toUpperCase() || "U"}
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>{currentUser?.name}</div>
              <div style={{ fontSize: 13, color: "#4b5563" }}>{currentUser?.email}</div>
            </div>
            <button
              onClick={() => setEditing(!editing)}
              style={{ marginLeft: "auto", background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 8, padding: "6px 14px", color: "#60a5fa", cursor: "pointer", fontSize: 12 }}
            >
              {editing ? "Cancel" : "✏ Edit"}
            </button>
          </div>

          {/* Fields */}
          {rows.map(([label, value, key]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #1e2a45" }}>
              <span style={{ color: "#4b5563", fontSize: 14 }}>{label}</span>
              {editing && key ? (
                <input
                  className="form-input"
                  style={{ width: 200 }}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              ) : (
                <span style={{ color: "#e8eaf0", fontWeight: 500, fontSize: 14 }}>{value || "—"}</span>
              )}
            </div>
          ))}

          {editing && (
            <button className="btn-primary" style={{ marginTop: 16 }} onClick={handleSave}>
              Save Changes
            </button>
          )}

          {/* AI Tip */}
          <div style={{ marginTop: 20, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 10, padding: 14, fontSize: 13, color: "#6ee7b7" }}>
            🤖 AI Tip: Peak hours 9–11 AM & 5–7 PM. Book in advance for best slot availability and lower congestion.
          </div>
        </div>
      </div>
    </div>
  );
}
