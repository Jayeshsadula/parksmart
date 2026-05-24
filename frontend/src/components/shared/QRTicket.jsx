// src/components/shared/QRTicket.jsx
import React, { useEffect, useRef } from "react";
import QRCode from "qrcode.react";
import { buildQRPayload } from "../../utils/index.js";
import { motion, AnimatePresence } from "framer-motion";

export default function QRTicket({ booking, onClose }) {
  const payload = JSON.stringify(buildQRPayload(booking));

  return (
    <AnimatePresence>
      <div className="modal-overlay" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          onClick={(e) => e.stopPropagation()}
          style={{ maxWidth: 380, width: "100%" }}
        >
          <div className="ticket">
            {/* Header */}
            <div className="ticket-header">
              <div className="ticket-title">🅿 ParkSmart AI</div>
              <div className="ticket-id">#{booking.bookingId}</div>
            </div>

            {/* QR Code */}
            <div className="qr-container">
              <QRCode
                value={payload}
                size={140}
                bgColor="#ffffff"
                fgColor="#000000"
                level="H"
                includeMargin={false}
              />
            </div>

            {/* Booking Details */}
            <div className="ticket-details">
              <div className="ticket-detail">
                <div className="ticket-detail-label">Parking Area</div>
                <div className="ticket-detail-value">{booking.parkingAreaName}</div>
              </div>
              <div className="ticket-detail">
                <div className="ticket-detail-label">Slot</div>
                <div className="ticket-detail-value">{booking.zone} · {booking.slotLabel}</div>
              </div>
              <div className="ticket-detail">
                <div className="ticket-detail-label">Floor</div>
                <div className="ticket-detail-value">{booking.floorName}</div>
              </div>
              <div className="ticket-detail">
                <div className="ticket-detail-label">Date</div>
                <div className="ticket-detail-value">{booking.bookingDate}</div>
              </div>
              <div className="ticket-detail">
                <div className="ticket-detail-label">Entry</div>
                <div className="ticket-detail-value">{booking.startTime}</div>
              </div>
              <div className="ticket-detail">
                <div className="ticket-detail-label">Exit</div>
                <div className="ticket-detail-value">{booking.endTime}</div>
              </div>
            </div>

            {/* Status */}
            <div style={{ textAlign: "center", marginTop: 14 }}>
              <span className="ticket-status">● Active Ticket</span>
            </div>

            <div style={{
              marginTop: 14, padding: "10px 0",
              borderTop: "1px dashed #1e3a5f",
              textAlign: "center", fontSize: 11, color: "#374151"
            }}>
              Show this QR at entrance · Valid for selected time only
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              width: "100%", marginTop: 12,
              background: "#0f1525", border: "1px solid #1e2a45",
              borderRadius: 10, padding: 10, color: "#6b7280", cursor: "pointer", fontSize: 13
            }}
          >
            Close Ticket
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
