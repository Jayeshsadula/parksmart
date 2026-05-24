// src/pages/admin/IoTDevices.jsx
import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import Sidebar from "../../components/shared/Sidebar.jsx";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";

const ADMIN_MENUS = [
  { path: "/admin/dashboard",          icon: "📊", label: "Dashboard"      },
  { path: "/admin/layout-builder",     icon: "🏗️", label: "Layout Builder" },
  { path: "/admin/parking-management", icon: "🅿",  label: "Parking Mgmt"  },
  { path: "/admin/bookings",           icon: "📋", label: "Bookings"       },
  { path: "/admin/scanner",            icon: "📷", label: "QR Scanner"     },
  { path: "/admin/analytics",          icon: "📈", label: "Analytics"      },
  { path: "/admin/penalties",          icon: "⚠️", label: "Penalties"      },
  { path: "/admin/iot-devices",        icon: "📡", label: "IoT Devices"    },  // ← ADD THIS
];

const db = getFirestore();

function isOnline(lastPing) {
  if (!lastPing) return false;
  const ts = lastPing?.toDate ? lastPing.toDate() : new Date(lastPing);
  return (Date.now() - ts.getTime()) < 30000; // online if pinged within 30s
}

function timeAgo(lastPing) {
  if (!lastPing) return "Never";
  const ts = lastPing?.toDate ? lastPing.toDate() : new Date(lastPing);
  const diff = Math.floor((Date.now() - ts.getTime()) / 1000);
  if (diff < 10)  return "Just now";
  if (diff < 60)  return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export default function IoTDevices() {
  const { currentUser } = useAuth();
  const [devices, setDevices]       = useState([]);
  const [areas, setAreas]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [deleting, setDeleting]     = useState(null);
  const [form, setForm]             = useState({
    deviceId: "", sensorId: "", slotId: "", areaId: "", label: "",
  });
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState("");
  const [success, setSuccess]       = useState("");

  // Fetch parking areas for dropdown
  useEffect(() => {
    if (!currentUser?.uid) return;
    getDocs(
      query(collection(db, "parkingAreas"), where("adminId", "==", currentUser.uid))
    ).then((snap) => setAreas(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, [currentUser]);

  // Real-time listener for IoT devices
  useEffect(() => {
    if (!currentUser?.uid) return;
    const q = query(
      collection(db, "iotDevices"),
      where("adminId", "==", currentUser.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      setDevices(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [currentUser]);

  const handleLink = async () => {
    setError(""); setSuccess("");
    if (!form.deviceId || !form.slotId || !form.areaId) {
      setError("Device ID, Parking Area, and Slot ID are required.");
      return;
    }
    setSaving(true);
    try {
      await setDoc(doc(db, "iotDevices", form.deviceId), {
        deviceId:  form.deviceId,
        sensorId:  form.sensorId || `IR_${form.deviceId}`,
        slotId:    form.slotId,
        areaId:    form.areaId,
        label:     form.label || form.deviceId,
        adminId:   currentUser.uid,
        linkedAt:  serverTimestamp(),
        lastPing:  null,
        status:    "offline",
      });
      setSuccess(`Device "${form.deviceId}" linked successfully!`);
      setForm({ deviceId: "", sensorId: "", slotId: "", areaId: "", label: "" });
      setShowForm(false);
    } catch (e) {
      setError("Failed to link device: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (deviceId) => {
    setDeleting(deviceId);
    try {
      await deleteDoc(doc(db, "iotDevices", deviceId));
    } catch (e) {
      setError("Failed to remove device.");
    } finally {
      setDeleting(null);
    }
  };

  const online  = devices.filter((d) => isOnline(d.lastPing)).length;
  const offline = devices.length - online;

  return (
    <div className="dashboard">
      <Sidebar menus={ADMIN_MENUS} />
      <div className="main-content">
        {/* Header */}
        <div className="page-title">IoT Devices 📡</div>
        <div className="page-sub">Manage your ESP32 sensors and slot monitors</div>

        {/* Summary cards */}
        <div className="cards-grid" style={{ marginBottom: 20 }}>
          <div className="card" style={{ borderLeft: "3px solid #06b6d4" }}>
            <div style={{ fontSize: 28, marginBottom: 4 }}>📡</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#fff" }}>{devices.length}</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>Total Devices</div>
          </div>
          <div className="card" style={{ borderLeft: "3px solid #10b981" }}>
            <div style={{ fontSize: 28, marginBottom: 4 }}>🟢</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#10b981" }}>{online}</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>Online</div>
          </div>
          <div className="card" style={{ borderLeft: "3px solid #ef4444" }}>
            <div style={{ fontSize: 28, marginBottom: 4 }}>🔴</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#ef4444" }}>{offline}</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>Offline</div>
          </div>
          <div className="card" style={{ borderLeft: "3px solid #f59e0b", cursor: "pointer" }}
               onClick={() => setShowForm(true)}>
            <div style={{ fontSize: 28, marginBottom: 4 }}>➕</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#f59e0b" }}>Link Device</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>Add new ESP32</div>
          </div>
        </div>

        {/* Feedback */}
        {error   && <div style={styles.error}>{error}</div>}
        {success && <div style={styles.success}>{success}</div>}

        {/* Link Device Form */}
        {showForm && (
          <div className="card" style={{ marginBottom: 20, border: "1px solid rgba(6,182,212,0.3)" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#06b6d4", marginBottom: 16 }}>
              ➕ Link New ESP32 Device
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={styles.label}>Device ID *</label>
                <input style={styles.input} placeholder="e.g. ESP32_001"
                  value={form.deviceId}
                  onChange={(e) => setForm({ ...form, deviceId: e.target.value })} />
              </div>
              <div>
                <label style={styles.label}>Sensor ID</label>
                <input style={styles.input} placeholder="e.g. IR_PA001_001"
                  value={form.sensorId}
                  onChange={(e) => setForm({ ...form, sensorId: e.target.value })} />
              </div>
              <div>
                <label style={styles.label}>Parking Area *</label>
                <select style={styles.input}
                  value={form.areaId}
                  onChange={(e) => setForm({ ...form, areaId: e.target.value })}>
                  <option value="">Select area...</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={styles.label}>Slot ID *</label>
                <input style={styles.input} placeholder="e.g. SLOT_PA001_001"
                  value={form.slotId}
                  onChange={(e) => setForm({ ...form, slotId: e.target.value })} />
              </div>
              <div>
                <label style={styles.label}>Label (optional)</label>
                <input style={styles.input} placeholder="e.g. Zone A - Slot 1"
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })} />
              </div>
            </div>

            {/* ESP32 config hint */}
            <div style={{ marginTop: 14, background: "rgba(6,182,212,0.06)", borderRadius: 8, padding: 12, fontSize: 12, color: "#67e8f9" }}>
              📋 <strong>ESP32 Config:</strong> Set <code>apiUrl = "http://YOUR_PC_IP:8000/api/slots/iot/update"</code> and <code>slotId = "{form.slotId || "SLOT_ID_HERE"}"</code> in your Arduino sketch.
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button style={styles.btnPrimary} onClick={handleLink} disabled={saving}>
                {saving ? "Linking..." : "🔗 Link Device"}
              </button>
              <button style={styles.btnGhost} onClick={() => { setShowForm(false); setError(""); }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Devices Table */}
        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 600, color: "#9ca3af", marginBottom: 14 }}>
            📡 Linked Devices
          </div>

          {loading && (
            <div style={{ color: "#6b7280", fontSize: 13 }}>Loading devices...</div>
          )}

          {!loading && devices.length === 0 && (
            <div style={{ textAlign: "center", padding: "30px 0", color: "#4b5563" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📡</div>
              <div style={{ fontSize: 14 }}>No IoT devices linked yet.</div>
              <button style={{ ...styles.btnPrimary, marginTop: 12 }} onClick={() => setShowForm(true)}>
                ➕ Link Your First Device
              </button>
            </div>
          )}

          {devices.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  {["Status", "Label", "Device ID", "Slot ID", "Area", "Last Ping", "Action"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 10px", color: "#6b7280", fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {devices.map((device) => {
                  const online = isOnline(device.lastPing);
                  const area   = areas.find((a) => a.id === device.areaId);
                  return (
                    <tr key={device.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={{ padding: "10px 10px" }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          background: online ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
                          color: online ? "#10b981" : "#ef4444",
                          padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                        }}>
                          <span style={{
                            width: 6, height: 6, borderRadius: "50%",
                            background: online ? "#10b981" : "#ef4444",
                            animation: online ? "pulse 1.5s infinite" : "none",
                          }} />
                          {online ? "ONLINE" : "OFFLINE"}
                        </span>
                      </td>
                      <td style={{ padding: "10px 10px", color: "#e5e7eb", fontWeight: 600 }}>{device.label || device.deviceId}</td>
                      <td style={{ padding: "10px 10px", color: "#9ca3af", fontFamily: "monospace" }}>{device.deviceId}</td>
                      <td style={{ padding: "10px 10px", color: "#9ca3af", fontFamily: "monospace" }}>{device.slotId}</td>
                      <td style={{ padding: "10px 10px", color: "#9ca3af" }}>{area?.name || device.areaId}</td>
                      <td style={{ padding: "10px 10px", color: "#6b7280" }}>{timeAgo(device.lastPing)}</td>
                      <td style={{ padding: "10px 10px" }}>
                        <button
                          style={{ ...styles.btnDanger, padding: "4px 10px", fontSize: 11 }}
                          onClick={() => handleDelete(device.deviceId)}
                          disabled={deleting === device.deviceId}>
                          {deleting === device.deviceId ? "..." : "🗑 Unlink"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Setup Guide */}
        <div className="card" style={{ marginTop: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#a78bfa", marginBottom: 14 }}>
            🛠 ESP32 Setup Guide
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
            {[
              { step: "01", title: "Get Your IP",     desc: "Run ipconfig in terminal. Copy your IPv4 address (e.g. 192.168.1.5)",        icon: "🖥" },
              { step: "02", title: "Flash Firmware",  desc: "Open Arduino IDE, paste the sketch from backend/iot/esp32_simulator.py",      icon: "⚡" },
              { step: "03", title: "Link Device",     desc: 'Click "Link Device" above, enter Device ID matching your Arduino sketch',     icon: "🔗" },
            ].map((item) => (
              <div key={item.step} style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.15)", borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 11, color: "#7c3aed", fontWeight: 800, marginBottom: 4 }}>STEP {item.step}</div>
                <div style={{ fontSize: 20, marginBottom: 6 }}>{item.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#e5e7eb", marginBottom: 4 }}>{item.title}</div>
                <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.5 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }
        `}</style>
      </div>
    </div>
  );
}

const styles = {
  label: {
    display: "block", fontSize: 11, color: "#9ca3af",
    fontWeight: 600, marginBottom: 5, textTransform: "uppercase",
  },
  input: {
    width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8, padding: "9px 12px", color: "#e5e7eb", fontSize: 13, outline: "none",
    boxSizing: "border-box",
  },
  btnPrimary: {
    background: "#06b6d4", color: "#000", border: "none", borderRadius: 8,
    padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer",
  },
  btnGhost: {
    background: "transparent", color: "#9ca3af", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8, padding: "9px 18px", fontWeight: 600, fontSize: 13, cursor: "pointer",
  },
  btnDanger: {
    background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)",
    borderRadius: 6, cursor: "pointer", fontWeight: 600,
  },
  error:   { background: "rgba(239,68,68,0.1)",   border: "1px solid rgba(239,68,68,0.2)",   color: "#ef4444", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 12 },
  success: { background: "rgba(16,185,129,0.1)",  border: "1px solid rgba(16,185,129,0.2)",  color: "#10b981", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 12 },
};
