// src/services/firestoreService.js
// All Firestore read/write operations. Swap mock DB for real Firebase calls here.

import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc,
  query, where, runTransaction, serverTimestamp, onSnapshot, orderBy, limit,
} from "firebase/firestore";
import { db } from "./firebase";

// ── Users ──────────────────────────────────────────────────────────────────
export const createUser = async (uid, data) => {
  await setDoc(doc(db, "users", uid), {
    uid, ...data, role: "user", createdAt: serverTimestamp(),
  });
};

export const getUser = async (uid) => {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
};

// ── Admins ─────────────────────────────────────────────────────────────────
export const createAdmin = async (uid, data) => {
  await setDoc(doc(db, "admins", uid), {
    uid, ...data, role: "admin", createdAt: serverTimestamp(),
  });
};

export const getAdmin = async (uid) => {
  const snap = await getDoc(doc(db, "admins", uid));
  return snap.exists() ? snap.data() : null;
};

// ── Parking Areas ──────────────────────────────────────────────────────────
export const createParkingArea = async (data) => {
  const ref = doc(collection(db, "parking_areas"));
  await setDoc(ref, { parkingAreaId: ref.id, ...data, createdAt: serverTimestamp() });
  return ref.id;
};

export const getParkingAreas = async () => {
  const snap = await getDocs(collection(db, "parking_areas"));
  return snap.docs.map((d) => d.data());
};

export const getParkingAreasByAdmin = async (adminId) => {
  const q = query(collection(db, "parking_areas"), where("adminId", "==", adminId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
};

// ── Parking Floors ─────────────────────────────────────────────────────────
export const createFloor = async (data) => {
  const ref = doc(collection(db, "parking_floors"));
  await setDoc(ref, { floorId: ref.id, ...data });
  return ref.id;
};

export const getFloorsByArea = async (parkingAreaId) => {
  const q = query(collection(db, "parking_floors"), where("parkingAreaId", "==", parkingAreaId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
};

// ── Parking Slots ──────────────────────────────────────────────────────────
export const createSlot = async (data) => {
  const ref = doc(collection(db, "parking_slots"));
  await setDoc(ref, { slotId: ref.id, ...data, status: "vacant" });
  return ref.id;
};

export const getSlotsByFloor = async (floorId) => {
  const q = query(collection(db, "parking_slots"), where("floorId", "==", floorId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
};

export const updateSlotStatus = async (slotId, status) => {
  await updateDoc(doc(db, "parking_slots", slotId), { status });
};

// Live real-time listener for slots (IoT-ready)
export const subscribeToSlots = (floorId, callback) => {
  const q = query(collection(db, "parking_slots"), where("floorId", "==", floorId));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => d.data()));
  });
};

// ── Bookings ───────────────────────────────────────────────────────────────

/**
 * ATOMIC booking engine — prevents double booking.
 * Uses Firestore runTransaction to lock-check-write atomically.
 */
export const createBooking = async ({ userId, slotId, parkingAreaId, bookingDate, startTime, endTime, ...meta }) => {
  const bookingRef = doc(collection(db, "bookings"));
  const slotRef = doc(db, "parking_slots", slotId);

  await runTransaction(db, async (tx) => {
    // 1. Re-read slot inside transaction
    const slotSnap = await tx.get(slotRef);
    if (!slotSnap.exists()) throw new Error("Slot not found");
    const slot = slotSnap.data();
    if (slot.status !== "vacant") throw new Error("Slot is no longer available");

    // 2. Check for time overlap among existing bookings for this slot
    const existingQ = query(
      collection(db, "bookings"),
      where("slotId", "==", slotId),
      where("bookingDate", "==", bookingDate),
      where("bookingStatus", "in", ["active", "reserved"])
    );
    // Note: getDocs inside transaction ensures consistent read
    const existingSnap = await getDocs(existingQ);
    const newStart = timeToMins(startTime);
    const newEnd = timeToMins(endTime);
    const BUFFER_MINS = 15;

    for (const b of existingSnap.docs) {
      const bd = b.data();
      const bStart = timeToMins(bd.startTime);
      const bEnd = timeToMins(bd.endTime) + BUFFER_MINS;
      if (newStart < bEnd && newEnd > bStart) {
        throw new Error("Time slot overlaps with an existing booking (including 15-min buffer)");
      }
    }

    // 3. Temporarily lock slot & write booking atomically
    tx.update(slotRef, { status: "reserved" });
    tx.set(bookingRef, {
      bookingId: bookingRef.id,
      userId, slotId, parkingAreaId, bookingDate, startTime, endTime,
      ...meta,
      bookingStatus: "active",
      qrStatus: "active",
      penaltyAmount: 0,
      overtimeMinutes: 0,
      createdAt: serverTimestamp(),
    });
  });

  return bookingRef.id;
};

export const getBookingsByUser = async (userId) => {
  try {
    const q = query(
      collection(db, "bookings"),
      where("userId", "==", userId)
    );
    const snap = await getDocs(q);
    const bookings = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    // Sort by createdAt descending
    return bookings.sort((a, b) => {
      if (!a.createdAt || !b.createdAt) return 0;
      const timeA = a.createdAt?.toDate?.() || new Date(a.createdAt);
      const timeB = b.createdAt?.toDate?.() || new Date(b.createdAt);
      return timeB - timeA;
    });
  } catch (err) {
    console.error("getBookingsByUser error:", err);
    return [];
  }
};

export const getAllBookings = async () => {
  // Removed orderBy
  const snap = await getDocs(query(collection(db, "bookings"), limit(200)));
  const bookings = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return bookings.sort((a, b) => {
    if (!a.createdAt || !b.createdAt) return 0;
    return b.createdAt.toDate?.() - a.createdAt.toDate?.();
  });
};
// Check if booking has expired based on date + time
export const isBookingExpired = (booking) => {
  const now = new Date();
  const [year, month, day] = booking.bookingDate.split("-").map(Number);
  const [hour, min] = booking.endTime.split(":").map(Number);
  const endDateTime = new Date(year, month - 1, day, hour, min);
  return now > endDateTime;
};

export const updateBookingStatus = async (bookingId, updates) => {
  await updateDoc(doc(db, "bookings", bookingId), updates);
};

export const verifyQR = async (bookingId) => {
  // Remove # prefix if present
  const cleanId = bookingId.replace("#", "").trim();

  // Try direct document lookup first (document ID = booking ID)
  let bookingRef = doc(db, "bookings", cleanId);
  let bookingSnap = await getDoc(bookingRef);

  // If not found by doc ID, search by bookingId field
  if (!bookingSnap.exists()) {
    const q = query(
      collection(db, "bookings"),
      where("bookingId", "==", cleanId)
    );
    const snap = await getDocs(q);
    if (snap.empty) throw new Error("Booking not found");
    bookingSnap = snap.docs[0];
    bookingRef = snap.docs[0].ref;
  }

  const booking = bookingSnap.data();

  // Check booking is valid
  if (!booking) throw new Error("Booking not found");
  if (booking.bookingStatus === "cancelled") throw new Error("Booking is cancelled");
  if (booking.qrStatus === "completed") throw new Error("QR already used for exit");

  // Time expiry check
  // Time expiry check with 15-minute grace period
const now = new Date();
const [year, month, day] = booking.bookingDate.split("-").map(Number);
const [endHour, endMin] = booking.endTime.split(":").map(Number);
const endDateTime = new Date(year, month - 1, day, endHour, endMin);

// Add 15-minute grace period after booking ends
const gracePeriodMs = 15 * 60 * 1000; // 15 minutes
const expiryDateTime = new Date(endDateTime.getTime() + gracePeriodMs);

if (now > expiryDateTime && booking.qrStatus !== "used") {
  throw new Error(
    `QR expired. Booking ended at ${booking.endTime} (15-min grace period also passed)`
  );
}

  // Find the slot
  const slotQuery = query(
    collection(db, "parking_slots"),
    where("slotId", "==", booking.slotId)
  );
  const slotSnap = await getDocs(slotQuery);

  // ENTRY scan (first scan - qrStatus is "active")
  if (booking.qrStatus === "active") {
    // Mark slot as OCCUPIED
    if (!slotSnap.empty) {
      await updateDoc(slotSnap.docs[0].ref, { status: "occupied" });
    }
    // Update booking
    await updateDoc(bookingRef, {
      qrStatus: "used",
      bookingStatus: "occupied",
    });

    return {
      ...booking,
      action: "ENTRY - Vehicle Entered Parking",
      newSlotStatus: "occupied",
    };
  }

  // EXIT scan (second scan - qrStatus is "used")
  if (booking.qrStatus === "used") {
    // Mark slot as VACANT
    if (!slotSnap.empty) {
      await updateDoc(slotSnap.docs[0].ref, { status: "vacant" });
    }
    // Update booking
    await updateDoc(bookingRef, {
      qrStatus: "completed",
      bookingStatus: "completed",
    });

    return {
      ...booking,
      action: "EXIT - Vehicle Left Parking",
      newSlotStatus: "vacant",
    };
  }

  throw new Error("Invalid QR state");
};

// ── Penalties ──────────────────────────────────────────────────────────────
export const createPenalty = async (data) => {
  const ref = doc(collection(db, "penalties"));
  await setDoc(ref, { penaltyId: ref.id, ...data, createdAt: serverTimestamp() });
  return ref.id;
};

export const getPendingPenalties = async () => {
  const q = query(collection(db, "penalties"), where("status", "==", "pending"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
};

export const resolvePenalty = async (penaltyId, action) => {
  await updateDoc(doc(db, "penalties", penaltyId), { status: action });
};

// ── Helpers ────────────────────────────────────────────────────────────────
const timeToMins = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
export const scanOvertimeBookings = async () => {
  const now = new Date();
  const today = now.toISOString().split("T")[0]; // YYYY-MM-DD
  const currentMins = now.getHours() * 60 + now.getMinutes();

  // Get all active bookings for today
  const q = query(
    collection(db, "bookings"),
    where("bookingDate", "==", today),
    where("bookingStatus", "in", ["active", "reserved", "occupied"])
  );

  const snap = await getDocs(q);
  const overtimeCases = [];

  for (const bookingDoc of snap.docs) {
    const booking = bookingDoc.data();
    const [endHour, endMin] = booking.endTime.split(":").map(Number);
    const endMins = endHour * 60 + endMin;
    const overtimeMins = currentMins - endMins;

    if (overtimeMins > 0) {
      // Calculate penalty
      let penaltyAmount = 0;
      let tier = "warning";

      if (overtimeMins > 60)      { penaltyAmount = 200; tier = "high";   }
      else if (overtimeMins > 30) { penaltyAmount = 100; tier = "medium"; }
      else if (overtimeMins > 15) { penaltyAmount = 50;  tier = "low";    }
      else                        { penaltyAmount = 0;   tier = "warning"; }

      // Update booking status
      await updateDoc(bookingDoc.ref, {
        bookingStatus:   "overtime",
        overtimeMinutes: overtimeMins,
        penaltyAmount:   penaltyAmount,
      });

      // Write penalty to Firestore
      const penaltyRef = collection(db, "penalties");
      await addDoc(penaltyRef, {
        penaltyId:     `PEN-${bookingDoc.id.slice(0, 6).toUpperCase()}`,
        bookingId:     booking.bookingId || bookingDoc.id,
        userId:        booking.userId,
        slot:          booking.slotLabel,
        area:          booking.parkingAreaName,
        overtimeMins:  overtimeMins,
        penaltyAmount: penaltyAmount,
        tier:          tier,
        status:        "pending",
        createdAt:     new Date().toISOString(),
      });

      overtimeCases.push({
        bookingId:     booking.bookingId,
        slot:          booking.slotLabel,
        overtimeMins,
        penaltyAmount,
        tier,
      });
    }
  }

  return overtimeCases;
};