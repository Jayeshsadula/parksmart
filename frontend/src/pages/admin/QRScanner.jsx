// src/pages/admin/QRScanner.jsx
import React, { useState, useEffect, useRef } from "react";
import Sidebar from "../../components/shared/Sidebar.jsx";
import useToast from "../../hooks/useToast.jsx";
import { motion, AnimatePresence } from "framer-motion";

const ADMIN_MENUS = [
  { path: "/admin/dashboard",          icon: "📊", label: "Dashboard"      },
  { path: "/admin/layout-builder",     icon: "🏗️", label: "Layout Builder" },
  { path: "/admin/parking-management", icon: "🅿",  label: "Parking Mgmt"  },
  { path: "/admin/bookings",           icon: "📋", label: "Bookings"       },
  { path: "/admin/scanner",            icon: "📷", label: "QR Scanner"     },
  { path: "/admin/analytics",          icon: "📈", label: "Analytics"      },
  { path: "/admin/penalties",          icon: "⚠️", label: "Penalties"      },
];

export default function QRScanner() {
  const { show, ToastContainer } = useToast();
  const [manualInput, setManualInput] = useState("");
  const [scanResult,  setScanResult]  = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [scannerActive, setScannerActive] = useState(false);
  const scannerRef = useRef(null);
  const html5QrRef = useRef(null);

  // ── Webcam scanner via html5-qrcode ──────────────────────────────────
  const startScanner = async () => {
    setScannerActive(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      html5QrRef.current = new Html5Qrcode("qr-reader");
      await html5QrRef.current.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          await stopScanner();
          await processQR(decodedText);
        },
        () => {}
      );
    } catch (err) {
      show("Camera access denied or html5-qrcode not loaded. Use manual entry below.", "error");
      setScannerActive(false);
    }
  };

  const stopScanner = async () => {
    if (html5QrRef.current) {
      try { await html5QrRef.current.stop(); } catch {}
      html5QrRef.current = null;
    }
    setScannerActive(false);
  };

  useEffect(() => () => { stopScanner(); }, []);

  // ── QR Processing — Call Backend API ─────────────────────────────────
 const processQR = async (raw) => {
  setLoading(true);
  setScanResult(null);
  try {
    let bookingId = raw.trim();
    // Extract bid from JSON if QR contains JSON payload
    try {
      const parsed = JSON.parse(raw);
      bookingId = parsed.bid || bookingId;
    } catch {}

    // Use Firestore directly (no backend needed)
    const { verifyQR } = await import("../../services/firestoreService.js");
    const result = await verifyQR(bookingId);

    setScanResult({
      success: true,
      action: result.action,
      slotStatus: result.newSlotStatus,
      booking: result,
    });

    show(`✓ ${result.action}`, "success");
  } catch (err) {
    setScanResult({
      success: false,
      reason: err.message || "Invalid QR",
    });
    show(`✗ ${err.message || "Access Denied"}`, "error");
  } finally {
    setLoading(false);
  }
};
  const handleManualVerify = () => {
    if (!manualInput.trim()) return;
    processQR(manualInput.trim());
  };

  const getActionIcon = (action) => {
    if (action.includes("ENTRY")) return "🚗";
    if (action.includes("EXIT")) return "🚪";
    return "🅿";
  };

  const getStatusColor = (status) => {
    if (status === "occupied") return { bg: "rgba(239,68,68,0.15)", color: "#ef4444", text: "OCCUPIED 🔴" };
    if (status === "vacant") return { bg: "rgba(16,185,129,0.15)", color: "#10b981", text: "VACANT 🟢" };
    return { bg: "rgba(245,158,11,0.15)", color: "#f59e0b", text: status.toUpperCase() };
  };

  return (
    <div className="dashboard">
      <ToastContainer />
      <Sidebar menus={ADMIN_MENUS} />

      <div className="main-content">
        <div className="page-title">QR Scanner 📷</div>
        <div className="page-sub">Scan parking tickets to toggle slot status (ENTRY/EXIT)</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>

          {/* Left — Scanner panel */}
          <div>
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#9ca3af", marginBottom: 14 }}>📷 Webcam QR Scanner</div>

              {/* html5-qrcode mount point */}
              <div id="qr-reader" ref={scannerRef} style={{ width: "100%", borderRadius: 12, overflow: "hidden", marginBottom: 12 }} />

              {!scannerActive ? (
                <div className="scanner-box" style={{ minHeight: 160 }}>
                  <div style={{ fontSize: 48 }}>📷</div>
                  <div style={{ fontSize: 14, color: "#4b5563" }}>Webcam QR scanning</div>
                  <div style={{ fontSize: 12, color: "#374151", textAlign: "center" }}>
                    Scan at ENTRY gate → Slot becomes OCCUPIED<br/>
                    Scan at EXIT gate → Slot becomes VACANT
                  </div>
                  <button
                    onClick={startScanner}
                    style={{ background: "linear-gradient(135deg,#3b82f6,#1d4ed8)", border: "none", borderRadius: 10, padding: "10px 24px", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 14, marginTop: 8 }}
                  >
                    Start Camera
                  </button>
                </div>
              ) : (
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 13, color: "#60a5fa", marginBottom: 10, animation: "pulse 1.5s infinite" }}>
                    📡 Scanning... point camera at QR code
                  </div>
                  <button onClick={stopScanner}
                    style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "6px 16px", color: "#f87171", cursor: "pointer", fontSize: 12 }}>
                    Stop Scanner
                  </button>
                </div>
              )}
            </div>

            {/* Manual entry */}
            <div className="card">
              <div style={{ fontSize: 14, fontWeight: 600, color: "#9ca3af", marginBottom: 12 }}>⌨️ Manual Booking ID</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  className="form-input"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleManualVerify()}
                  placeholder="Enter Booking ID"
                />
                <button
                  onClick={handleManualVerify}
                  disabled={loading}
                  style={{ background: "linear-gradient(135deg,#10b981,#059669)", border: "none", borderRadius: 10, padding: "10px 20px", color: "#fff", cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap", opacity: loading ? 0.6 : 1 }}
                >
                  {loading ? "..." : "Verify"}
                </button>
              </div>
            </div>
          </div>

          {/* Right — Result panel */}
          <div>
            <AnimatePresence mode="wait">
              {!scanResult && !loading && (
                <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card"
                  style={{ textAlign: "center", padding: 60, minHeight: 300 }}>
                  <div style={{ fontSize: 56, marginBottom: 12 }}>🔍</div>
                  <div style={{ fontSize: 14, color: "#374151" }}>
                    Scan a QR code or enter a Booking ID
                  </div>
                </motion.div>
              )}

              {loading && (
                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card"
                  style={{ textAlign: "center", padding: 60 }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
                  <div style={{ fontSize: 14, color: "#4b5563" }}>Verifying QR code...</div>
                </motion.div>
              )}

              {scanResult && !loading && (
                <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                  {scanResult.success ? (
                    <div className="scanner-result">
                      {/* Action message */}
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#10b981", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 28 }}>{getActionIcon(scanResult.action)}</span>
                        {scanResult.action}
                      </div>

                      {/* Slot Status Badge */}
                      {(() => {
                        const statusStyle = getStatusColor(scanResult.slotStatus);
                        return (
                          <div style={{ background: statusStyle.bg, border: `1px solid ${statusStyle.color}`, borderRadius: 10, padding: 14, marginBottom: 14, textAlign: "center" }}>
                            <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 4 }}>NEW SLOT STATUS</div>
                            <div style={{ fontSize: 20, fontWeight: 800, color: statusStyle.color }}>{statusStyle.text}</div>
                          </div>
                        );
                      })()}

                      {/* Booking summary */}
                      <div className="card" style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.15)", marginBottom: 14 }}>
                        {[
                          ["Parking Area", scanResult.booking.parkingAreaName],
                          ["Floor",        scanResult.booking.floorName],
                          ["Zone",         scanResult.booking.zone],
                          ["Slot",         scanResult.booking.slotLabel],
                          ["Date",         scanResult.booking.bookingDate],
                          ["Time",         `${scanResult.booking.startTime} – ${scanResult.booking.endTime}`],
                        ].map(([k, v]) => (
                          <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #1e2a45", fontSize: 13 }}>
                            <span style={{ color: "#4b5563" }}>{k}</span>
                            <span style={{ color: "#e8eaf0", fontWeight: 600 }}>{v}</span>
                          </div>
                        ))}
                      </div>

                      {/* Status message */}
                      <div style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 12, color: "#60a5fa" }}>
                        {scanResult.action.includes("ENTRY") 
                          ? "✓ Vehicle has ENTERED. Slot marked as OCCUPIED."
                          : "✓ Vehicle has EXITED. Slot marked as VACANT."}
                      </div>
                    </div>
                  ) : (
                    <div className="scanner-fail">
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#ef4444", marginBottom: 8 }}>
                        ✗ Access Denied
                      </div>
                      <div style={{ fontSize: 13, color: "#fca5a5", marginBottom: 12 }}>
                        {scanResult.reason}
                      </div>
                      <div style={{ fontSize: 12, color: "#4b5563" }}>
                        Possible reasons: QR expired · Booking not found · Invalid booking ID
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => { setScanResult(null); setManualInput(""); }}
                    style={{ width: "100%", marginTop: 12, background: "rgba(255,255,255,0.04)", border: "1px solid #1e2a45", borderRadius: 10, padding: 10, color: "#6b7280", cursor: "pointer", fontSize: 13 }}
                  >
                    Scan Next QR
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}