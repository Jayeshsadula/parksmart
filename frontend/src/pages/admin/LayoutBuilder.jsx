// src/pages/admin/LayoutBuilder.jsx
import React, { useState } from "react";
import Sidebar from "../../components/shared/Sidebar.jsx";
import useToast from "../../hooks/useToast.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  createParkingArea,
  createFloor,
  createSlot,
} from "../../services/firestoreService.js";

const ADMIN_MENUS = [
  { path: "/admin/dashboard",          icon: "📊", label: "Dashboard"      },
  { path: "/admin/layout-builder",     icon: "🏗️", label: "Layout Builder" },
  { path: "/admin/parking-management", icon: "🅿",  label: "Parking Mgmt"  },
  { path: "/admin/bookings",           icon: "📋", label: "Bookings"       },
  { path: "/admin/scanner",            icon: "📷", label: "QR Scanner"     },
  { path: "/admin/analytics",          icon: "📈", label: "Analytics"      },
  { path: "/admin/penalties",          icon: "⚠️", label: "Penalties"      },
];

const SLOT_TYPE_ICONS = { normal: "🚗", vip: "⭐", ev: "⚡", disabled: "♿" };

const defaultZone = (type = "normal") => ({
  name: "Zone A", rows: 3, cols: 6, type,
});

const defaultFloor = (n = 1) => ({
  id: `F${n}`, name: `Floor ${n}`, zones: [defaultZone()],
});

export default function LayoutBuilder() {
  const { currentUser } = useAuth();
  const { show, ToastContainer } = useToast();

  const [areaName,     setAreaName]     = useState("My Parking Area");
  const [location,     setLocation]     = useState("");
  const [areaType,     setAreaType]     = useState("mall");
  const [selectedType, setSelectedType] = useState("normal");
  const [floors,       setFloors]       = useState([defaultFloor(1)]);
  const [saving,       setSaving]       = useState(false);

  // ── Floor helpers ──────────────────────────────────────────────────────
  const addFloor = () =>
    setFloors((f) => [...f, defaultFloor(f.length + 1)]);

  const removeFloor = (fi) =>
    setFloors((f) => f.filter((_, i) => i !== fi));

  const updateFloorName = (fi, name) =>
    setFloors((f) => f.map((fl, i) => (i === fi ? { ...fl, name } : fl)));

  // ── Zone helpers ───────────────────────────────────────────────────────
  const addZone = (fi) =>
    setFloors((f) =>
      f.map((fl, i) =>
        i === fi
          ? {
              ...fl,
              zones: [
                ...fl.zones,
                {
                  ...defaultZone(selectedType),
                  name: `Zone ${String.fromCharCode(65 + fl.zones.length)}`,
                },
              ],
            }
          : fl
      )
    );

  const removeZone = (fi, zi) =>
    setFloors((f) =>
      f.map((fl, i) =>
        i === fi ? { ...fl, zones: fl.zones.filter((_, j) => j !== zi) } : fl
      )
    );

  const updateZone = (fi, zi, key, val) =>
    setFloors((f) =>
      f.map((fl, i) =>
        i === fi
          ? {
              ...fl,
              zones: fl.zones.map((z, j) =>
                j === zi ? { ...z, [key]: val } : z
              ),
            }
          : fl
      )
    );

  // ── Save to Firestore ──────────────────────────────────────────────────
  const handleSave = async () => {
    if (!areaName.trim()) { show("Enter a parking area name", "error"); return; }
    setSaving(true);
    try {
      const totalSlots = floors.reduce(
        (sum, fl) => sum + fl.zones.reduce((s, z) => s + z.rows * z.cols, 0), 0
      );

      const parkingAreaId = await createParkingArea({
        name: areaName, location, type: areaType,
        adminId: currentUser.uid, totalFloors: floors.length,
        totalSlots, available: totalSlots,
      });

      for (const floor of floors) {
        const floorId = await createFloor({ parkingAreaId, floorName: floor.name });

        for (const zone of floor.zones) {
          for (let r = 0; r < zone.rows; r++) {
            for (let c = 1; c <= zone.cols; c++) {
              const rowLetter = String.fromCharCode(65 + r);
              await createSlot({
                floorId, zone: zone.name,
                slotType: zone.type,
                label: `${rowLetter}${c}`,
                row: r, col: c,
              });
            }
          }
        }
      }

      show(`✓ Layout saved! ${totalSlots} slots created across ${floors.length} floor(s).`, "success");
    } catch (err) {
      show(err.message || "Save failed", "error");
    } finally {
      setSaving(false);
    }
  };

  // ── Slot count summary ─────────────────────────────────────────────────
  const totalSlots = floors.reduce(
    (sum, fl) => sum + fl.zones.reduce((s, z) => s + z.rows * z.cols, 0), 0
  );

  return (
    <div className="dashboard">
      <ToastContainer />
      <Sidebar menus={ADMIN_MENUS} />

      <div className="main-content">
        <div className="page-title">Layout Builder 🏗️</div>
        <div className="page-sub">
          Dynamically create parking architectures — floors, zones, slot types. Stored in Firestore.
        </div>

        <div className="builder-grid">
          {/* ── LEFT PANEL ─────────────────────────────────────── */}
          <div>
            {/* Area Details */}
            <div className="builder-panel" style={{ marginBottom: 16 }}>
              <div className="builder-section-title">📍 Parking Area Details</div>
              <div className="form-group">
                <label className="form-label">Area Name</label>
                <input className="form-input" value={areaName} onChange={(e) => setAreaName(e.target.value)} placeholder="e.g. CityMall Parking" />
              </div>
              <div className="form-group">
                <label className="form-label">Location</label>
                <input className="form-input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Banjara Hills, Hyderabad" />
              </div>
              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="form-input" value={areaType} onChange={(e) => setAreaType(e.target.value)}>
                  {["mall","airport","hospital","office","apartment","theater"].map((t) => (
                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Slot Type Selector */}
            <div className="builder-panel" style={{ marginBottom: 16 }}>
              <div className="builder-section-title">🚗 Default Slot Type for New Zones</div>
              <div className="type-grid">
                {Object.entries(SLOT_TYPE_ICONS).map(([t, icon]) => (
                  <button
                    key={t}
                    className={`type-btn ${t} ${selectedType === t ? "active" : ""}`}
                    onClick={() => setSelectedType(t)}
                  >
                    {icon} {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Floor Controls */}
            <div className="builder-panel" style={{ marginBottom: 16 }}>
              <div className="builder-section-title">🏢 Floor & Zone Actions</div>
              <div className="builder-actions">
                <button className="btn-builder" onClick={addFloor}>+ Add Floor</button>
                {floors.map((fl, fi) => (
                  <button key={fi} className="btn-builder" onClick={() => addZone(fi)}>
                    + Add Zone to {fl.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary + Save */}
            <div className="builder-panel">
              <div className="builder-section-title">📊 Layout Summary</div>
              <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 12 }}>
                <div>Floors: <strong style={{ color: "#fff" }}>{floors.length}</strong></div>
                <div>Total Zones: <strong style={{ color: "#fff" }}>{floors.reduce((s, f) => s + f.zones.length, 0)}</strong></div>
                <div>Total Slots: <strong style={{ color: "#10b981" }}>{totalSlots}</strong></div>
              </div>
              <button className="btn-confirm" onClick={handleSave} disabled={saving}>
                {saving ? "Saving to Firestore..." : "💾 Save Layout to Firestore"}
              </button>
            </div>
          </div>

          {/* ── RIGHT PANEL — Live Preview ──────────────────────── */}
          <div className="builder-panel">
            <div style={{ fontSize: 14, fontWeight: 600, color: "#9ca3af", marginBottom: 16 }}>
              👁 Live Preview — {areaName}
            </div>

            {floors.map((floor, fi) => (
              <div key={fi} className="floor-section">
                <div className="floor-header">
                  <div className="floor-badge">🏢 {floor.name}</div>
                  <input
                    value={floor.name}
                    onChange={(e) => updateFloorName(fi, e.target.value)}
                    style={{ background: "transparent", border: "none", color: "#9ca3af", fontSize: 12, marginLeft: 8, width: 120, outline: "none" }}
                  />
                  {floors.length > 1 && (
                    <button onClick={() => removeFloor(fi)} style={{ marginLeft: "auto", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, padding: "2px 8px", color: "#f87171", cursor: "pointer", fontSize: 11 }}>✕ Remove</button>
                  )}
                </div>

                {floor.zones.map((zone, zi) => (
                  <div key={zi} className="zone-section">
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <div className="zone-label" style={{ margin: 0 }}>{zone.name}</div>
                      <span style={{ fontSize: 10, color: "#4b5563" }}>
                        {SLOT_TYPE_ICONS[zone.type]} {zone.type} · {zone.rows}×{zone.cols} = {zone.rows * zone.cols} slots
                      </span>
                      {/* Mini controls */}
                      <input type="number" min="1" max="10" value={zone.rows}
                        onChange={(e) => updateZone(fi, zi, "rows", +e.target.value)}
                        style={{ width: 40, background: "#0a0e1a", border: "1px solid #1e2a45", borderRadius: 4, padding: "2px 4px", color: "#9ca3af", fontSize: 11 }}
                        title="Rows"
                      />
                      <span style={{ fontSize: 10, color: "#374151" }}>rows</span>
                      <input type="number" min="1" max="12" value={zone.cols}
                        onChange={(e) => updateZone(fi, zi, "cols", +e.target.value)}
                        style={{ width: 40, background: "#0a0e1a", border: "1px solid #1e2a45", borderRadius: 4, padding: "2px 4px", color: "#9ca3af", fontSize: 11 }}
                        title="Cols"
                      />
                      <span style={{ fontSize: 10, color: "#374151" }}>cols</span>
                      <select value={zone.type} onChange={(e) => updateZone(fi, zi, "type", e.target.value)}
                        style={{ background: "#0a0e1a", border: "1px solid #1e2a45", borderRadius: 4, padding: "2px 4px", color: "#9ca3af", fontSize: 11 }}>
                        {Object.keys(SLOT_TYPE_ICONS).map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      {floor.zones.length > 1 && (
                        <button onClick={() => removeZone(fi, zi)} style={{ background: "none", border: "none", color: "#374151", cursor: "pointer", fontSize: 12 }}>✕</button>
                      )}
                    </div>
                    {/* Slot grid preview */}
                    <div className="slots-grid">
                      {Array.from({ length: zone.rows * zone.cols }, (_, idx) => {
                        const row   = String.fromCharCode(65 + Math.floor(idx / zone.cols));
                        const col   = (idx % zone.cols) + 1;
                        const cls   = zone.type === "ev" ? "slot ev available" : zone.type === "disabled" ? "slot disabled-slot" : "slot available";
                        return (
                          <div key={idx} className={cls}>
                            <div className="slot-icon">{SLOT_TYPE_ICONS[zone.type]}</div>
                            <div className="slot-id">{row}{col}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                <div style={{ height: 1, background: "#1e2a45", margin: "12px 0" }} />
              </div>
            ))}

            <div style={{ fontSize: 12, color: "#374151", fontStyle: "italic", marginTop: 8 }}>
              This layout will be stored in Firestore and rendered dynamically for users — exactly like BookMyShow seat selection.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
