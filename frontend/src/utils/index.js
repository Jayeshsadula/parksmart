// src/utils/index.js
import { db } from "../services/firebase.js";

/** Generate a random booking/penalty ID */
export const generateId = (prefix = "BK") =>
  `${prefix}${Date.now().toString(36).toUpperCase()}`;

/** Convert "HH:MM" to minutes from midnight */
export const timeToMins = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/** Check if two time ranges overlap (with buffer in minutes) */
export const hasTimeOverlap = (s1, e1, s2, e2, bufferMins = 15) => {
  const a = timeToMins(s1);
  const b = timeToMins(e1) + bufferMins;
  const c = timeToMins(s2);
  const d = timeToMins(e2);
  return a < d && b > c;
};

/** Calculate penalty amount based on overtime minutes */
export const calcPenalty = (overtimeMins) => {
  if (overtimeMins <= 0)  return { amount: 0, tier: "none" };
  if (overtimeMins <= 15) return { amount: 0, tier: "warning" };
  if (overtimeMins <= 30) return { amount: 50, tier: "low" };
  if (overtimeMins <= 60) return { amount: 100, tier: "medium" };
  return { amount: 200, tier: "high" };
};

/** Format booking duration as human string */
export const formatDuration = (startTime, endTime) => {
  const diff = timeToMins(endTime) - timeToMins(startTime);
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return h > 0 ? `${h}h ${m > 0 ? m + "m" : ""}`.trim() : `${m}m`;
};

/** Build QR payload object */
export const buildQRPayload = (booking) => ({
  bid: booking.bookingId,
  sid: booking.slotId,
  pid: booking.parkingAreaId,
  date: booking.bookingDate,
  start: booking.startTime,
  end: booking.endTime,
  ts: Date.now(),
});

/** Slot type metadata */
export const SLOT_TYPE_META = {
  normal:   { icon: "🚗", label: "Standard",    color: "#10b981" },
  vip:      { icon: "⭐", label: "VIP",          color: "#f59e0b" },
  ev:       { icon: "⚡", label: "EV Charging",  color: "#06b6d4" },
  disabled: { icon: "♿", label: "Accessible",   color: "#6b7280" },
};

/** Slot status colors */
export const SLOT_STATUS_COLOR = {
  vacant:           "#10b981",
  occupied:         "#ef4444",
  reserved:         "#f59e0b",
  temporary_locked: "#78716c",
  maintenance:      "#374151",
};

/** Parking area type icons */
export const AREA_TYPE_ICON = {
  mall:      "🏬",
  airport:   "✈️",
  hospital:  "🏥",
  office:    "🏢",
  apartment: "🏠",
  theater:   "🎭",
};
// Auto-expire reserved slots after booking time ends
// Auto-expire reserved slots after booking time ends
export const checkAndExpireSlots = async (db) => {
  try {
    const { collection, query, where, getDocs, updateDoc, Timestamp } = await import("firebase/firestore");
    
    const now = new Date();
    const today = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const currentMins = currentHour * 60 + currentMin;

    // Get all active/reserved bookings for today
    const bookingsSnap = await getDocs(
      query(
        collection(db, "bookings"),
        where("bookingDate", "==", today),
        where("bookingStatus", "in", ["active", "reserved"])
      )
    );

    console.log(`[AUTO-EXPIRE] Checking ${bookingsSnap.docs.length} bookings at ${currentHour}:${currentMin}`);

    for (const bookingDoc of bookingsSnap.docs) {
      const booking = bookingDoc.data();
      const [endHour, endMin] = booking.endTime.split(":").map(Number);
      const endMins = endHour * 60 + endMin;

      // If current time is past booking end time
      if (currentMins > endMins) {
        console.log(`[AUTO-EXPIRE] Expiring booking ${booking.bookingId} (ended at ${booking.endTime})`);

        // Update booking status
        await updateDoc(bookingDoc.ref, {
          bookingStatus: "completed",
          qrStatus: "expired",
          expiryTime: Timestamp.now()
        });

        // Free up the slot
        const slotRef = collection(db, "parking_slots").where("__name__", "==", booking.slotId);
        const slotSnap = await getDocs(
          query(collection(db, "parking_slots"), where("slotId", "==", booking.slotId))
        );
        
        if (slotSnap.docs.length > 0) {
          await updateDoc(slotSnap.docs[0].ref, {
            status: "vacant"
          });
          console.log(`[AUTO-EXPIRE] Freed slot ${booking.slotId}`);
        }
      }
    }
  } catch (err) {
    console.error("[AUTO-EXPIRE] Error:", err);
  }
};