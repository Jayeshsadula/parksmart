// src/services/firestoreService.js
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, addDoc,
  query, where, runTransaction, serverTimestamp, onSnapshot, limit,
} from "firebase/firestore";
import { db } from "./firebase.js";

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
export const createBooking = async ({
  userId, slotId, parkingAreaId,
  bookingDate, startTime, endTime, ...meta
}) => {
  const bookingRef = doc(collection(db, "bookings"));
  const slotRef    = doc(db, "parking_slots", slotId);

  await runTransaction(db, async (tx) => {
    // 1. Re-read slot inside transaction
    const slotSnap = await tx.get(slotRef);
    if (!slotSnap.exists()) throw new Error("Slot not found");
    const slot = slotSnap.data();
    if (slot.status !== "vacant") throw new Error("Slot is no longer available");

    // 2. Check time overlap
    const existingQ = query(
      collection(db, "bookings"),
      where("slotId",        "==", slotId),
      where("bookingDate",   "==", bookingDate),
      where("bookingStatus", "in", ["active", "reserved"])
    );
    const existingSnap = await getDocs(existingQ);
    const newStart    = timeToMins(startTime);
    const newEnd      = timeToMins(endTime);
    const BUFFER_MINS = 15;

    for (const b of existingSnap.docs) {
      const bd     = b.data();
      const bStart = timeToMins(bd.startTime);
      const bEnd   = timeToMins(bd.endTime) + BUFFER_MINS;
      if (newStart < bEnd && newEnd > bStart) {
        throw new Error("Time slot overlaps with an existing booking (including 15-min buffer)");
      }
    }

    // 3. Atomic write
    tx.update(slotRef, { status: "reserved" });
    tx.set(bookingRef, {
      bookingId: bookingRef.id,
      userId, slotId, parkingAreaId, bookingDate, startTime, endTime,
      ...meta,
      bookingStatus:   "active",
      qrStatus:        "active",
      penaltyAmount:   0,
      overtimeMinutes: 0,
      createdAt:       serverTimestamp(),
    });
  });

  return bookingRef.id;
};

export const getBookingsByUser = async (userId) => {
  try {
    const q    = query(collection(db, "bookings"), where("userId", "==", userId));
    const snap = await getDocs(q);
    const bookings = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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
  try {
    const snap     = await getDocs(query(collection(db, "bookings"), limit(200)));
    const bookings = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return bookings.sort((a, b) => {
      if (!a.createdAt || !b.createdAt) return 0;
      const timeA = a.createdAt?.toDate?.() || new Date(a.createdAt);
      const timeB = b.createdAt?.toDate?.() || new Date(b.createdAt);
      return timeB - timeA;
    });
  } catch (err) {
    console.error("getAllBookings error:", err);
    return [];
  }
};

export const updateBookingStatus = async (bookingId, updates) => {
  await updateDoc(doc(db, "bookings", bookingId), updates);
};

// ── QR Verification — ENTRY/EXIT toggle ───────────────────────────────────
export const verifyQR = async (bookingId) => {
  const cleanId = bookingId.replace("#", "").trim();

  // Try direct document lookup first
  let bookingRef  = doc(db, "bookings", cleanId);
  let bookingSnap = await getDoc(bookingRef);

  // If not found by doc ID, search by bookingId field
  if (!bookingSnap.exists()) {
    const q    = query(collection(db, "bookings"), where("bookingId", "==", cleanId));
    const snap = await getDocs(q);
    if (snap.empty) throw new Error("Booking not found");
    bookingSnap = snap.docs[0];
    bookingRef  = snap.docs[0].ref;
  }

  const booking = bookingSnap.data();
  if (!booking) throw new Error("Booking not found");
  if (booking.bookingStatus === "cancelled") throw new Error("Booking is cancelled");
  if (booking.qrStatus === "completed")      throw new Error("QR already used for exit");

  // Time expiry check with 15-minute grace period
  const now = new Date();
  const [year, month, day] = booking.bookingDate.split("-").map(Number);
  const [endHour, endMin]  = booking.endTime.split(":").map(Number);
  const endDateTime        = new Date(year, month - 1, day, endHour, endMin);
  const expiryDateTime     = new Date(endDateTime.getTime() + 15 * 60 * 1000);

  if (now > expiryDateTime && booking.qrStatus !== "used") {
    throw new Error(`QR expired. Booking ended at ${booking.endTime} (15-min grace period also passed)`);
  }

  // Find the slot
  const slotSnap = await getDocs(
    query(collection(db, "parking_slots"), where("slotId", "==", booking.slotId))
  );

  // ── ENTRY scan (first scan) ──────────────────────────────────────────────
  if (booking.qrStatus === "active") {
    if (!slotSnap.empty) {
      await updateDoc(slotSnap.docs[0].ref, { status: "occupied" });
    }
    await updateDoc(bookingRef, {
      qrStatus:      "used",
      bookingStatus: "occupied",
    });
    return {
      ...booking,
      action:       "ENTRY - Vehicle Entered Parking",
      newSlotStatus: "occupied",
      overtimeMins:  0,
      penaltyAmount: 0,
      tier:          "none",
    };
  }

  // ── EXIT scan (second scan) ──────────────────────────────────────────────
  if (booking.qrStatus === "used") {
    // Calculate overtime on exit
    const overtimeMins = Math.max(0, Math.floor((now - endDateTime) / 60000));

    let penaltyAmount = 0;
    let tier          = "none";

    if (overtimeMins > 60)      { penaltyAmount = 200; tier = "high";    }
    else if (overtimeMins > 30) { penaltyAmount = 100; tier = "medium";  }
    else if (overtimeMins > 15) { penaltyAmount = 50;  tier = "low";     }
    else if (overtimeMins > 0)  { penaltyAmount = 0;   tier = "warning"; }

    // Free slot
    if (!slotSnap.empty) {
      await updateDoc(slotSnap.docs[0].ref, { status: "vacant" });
    }

    // Update booking
    await updateDoc(bookingRef, {
      qrStatus:        "completed",
      bookingStatus:   overtimeMins > 0 ? "overtime" : "completed",
      overtimeMinutes: overtimeMins,
      penaltyAmount:   penaltyAmount,
    });

    // Create penalty record if overtime
    if (overtimeMins > 0) {
      await addDoc(collection(db, "penalties"), {
        penaltyId:     `PEN-${Date.now()}`,
        bookingId:     booking.bookingId || cleanId,
        userId:        booking.userId,
        slot:          booking.slotLabel,
        area:          booking.parkingAreaName,
        overtimeMins:  overtimeMins,
        penaltyAmount: penaltyAmount,
        tier:          tier,
        status:        "pending",
        createdAt:     new Date().toISOString(),
      });
    }

    return {
      ...booking,
      action:        "EXIT - Vehicle Left Parking",
      newSlotStatus: "vacant",
      overtimeMins,
      penaltyAmount,
      tier,
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
  try {
    const snap = await getDocs(
      query(collection(db, "penalties"), where("status", "==", "pending"))
    );
    console.log("[PENALTIES] Found:", snap.docs.length);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error("[PENALTIES] Error:", err);
    return [];
  }
};

export const resolvePenalty = async (penaltyId, action) => {
  await updateDoc(doc(db, "penalties", penaltyId), { status: action });
};

// ── Overtime Scanner ───────────────────────────────────────────────────────
export const scanOvertimeBookings = async () => {
  const now         = new Date();
  const today       = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  const currentMins = now.getHours() * 60 + now.getMinutes();

  console.log(`[OVERTIME] Scanning at ${now.toLocaleTimeString()} | Today: ${today}`);

  try {
    const snap = await getDocs(
      query(
        collection(db, "bookings"),
        where("bookingDate", "==", today)
      )
    );

    console.log(`[OVERTIME] Total bookings today: ${snap.docs.length}`);

    for (const bookingDoc of snap.docs) {
      const booking = bookingDoc.data();

      if (["completed", "cancelled", "overtime"].includes(booking.bookingStatus)) continue;

      const [endHour, endMin] = booking.endTime.split(":").map(Number);
      const endMins           = endHour * 60 + endMin;
      const overtimeMins      = currentMins - endMins;

      if (overtimeMins > 0) {
        let penaltyAmount = 0;
        let tier          = "warning";

        if (overtimeMins > 60)      { penaltyAmount = 200; tier = "high";    }
        else if (overtimeMins > 30) { penaltyAmount = 100; tier = "medium";  }
        else if (overtimeMins > 15) { penaltyAmount = 50;  tier = "low";     }

        console.log(`[OVERTIME] ⚠ ${booking.bookingId} overtime ${overtimeMins}min → ₹${penaltyAmount}`);

        await updateDoc(bookingDoc.ref, {
          bookingStatus:   "overtime",
          overtimeMinutes: overtimeMins,
          penaltyAmount:   penaltyAmount,
        });

        // Check for duplicate penalty
        const existing = await getDocs(
          query(collection(db, "penalties"), where("bookingId", "==", booking.bookingId || bookingDoc.id))
        );

        if (existing.empty) {
          await addDoc(collection(db, "penalties"), {
            penaltyId:     `PEN-${Date.now()}`,
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
        } else {
          await updateDoc(existing.docs[0].ref, { overtimeMins, penaltyAmount, tier });
        }
      }
    }
  } catch (err) {
    console.error("[OVERTIME] Error:", err);
  }
};

// ── Auto Expire Slots ──────────────────────────────────────────────────────
export const checkAndExpireSlots = async () => {
  try {
    const now         = new Date();
    const today       = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
    const currentMins = now.getHours() * 60 + now.getMinutes();

    console.log(`[AUTO-EXPIRE] Checking at ${now.getHours()}:${String(now.getMinutes()).padStart(2,"0")}`);

    const snap = await getDocs(
      query(
        collection(db, "bookings"),
        where("bookingDate",   "==", today),
        where("bookingStatus", "in", ["active", "reserved"])
      )
    );

    console.log(`[AUTO-EXPIRE] Found ${snap.docs.length} active bookings`);

    for (const bookingDoc of snap.docs) {
      const booking       = bookingDoc.data();
      const [endHour, endMin] = booking.endTime.split(":").map(Number);
      const endMins       = endHour * 60 + endMin;

      if (currentMins > endMins) {
        console.log(`[AUTO-EXPIRE] Expiring booking ${booking.bookingId}`);

        await updateDoc(bookingDoc.ref, {
          bookingStatus: "completed",
          qrStatus:      "expired",
        });

        const slotSnap = await getDocs(
          query(collection(db, "parking_slots"), where("slotId", "==", booking.slotId))
        );

        if (!slotSnap.empty) {
          await updateDoc(slotSnap.docs[0].ref, { status: "vacant" });
          console.log(`[AUTO-EXPIRE] Freed slot ${booking.slotId}`);
        }
      }
    }
  } catch (err) {
    console.error("[AUTO-EXPIRE] Error:", err);
  }
};

// ── Helpers ────────────────────────────────────────────────────────────────
const timeToMins = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

export const isBookingExpired = (booking) => {
  const now            = new Date();
  const [year, month, day] = booking.bookingDate.split("-").map(Number);
  const [hour, min]    = booking.endTime.split(":").map(Number);
  return now > new Date(year, month - 1, day, hour, min);
};