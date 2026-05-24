# backend/api/services/booking_service.py
"""
Booking Service — core business logic for ParkSmart AI.
Handles: atomic booking, overlap detection, buffer time, QR verification,
         overtime calculation, penalty engine, slot reassignment.
"""

from google.cloud import firestore as fs
from core.firebase_admin import get_db
from core.config import settings
import uuid


# ── Time Helpers ───────────────────────────────────────────────────────────────

def time_to_mins(t: str) -> int:
    h, m = map(int, t.split(":"))
    return h * 60 + m

def mins_to_time(m: int) -> str:
    return f"{m // 60:02d}:{m % 60:02d}"

def has_overlap(s1: str, e1: str, s2: str, e2: str,
                buffer: int = None) -> bool:
    buf = buffer if buffer is not None else settings.BUFFER_MINS
    a = time_to_mins(s1)
    b = time_to_mins(e1)
    c = time_to_mins(s2)
    d = time_to_mins(e2) + buf
    return a < d and b > c


# ── Penalty Calculator ─────────────────────────────────────────────────────────

def calc_penalty(overtime_mins: int) -> dict:
    if overtime_mins <= 0:   return {"amount": 0,                    "tier": "none"}
    if overtime_mins <= 15:  return {"amount": 0,                    "tier": "warning"}
    if overtime_mins <= 30:  return {"amount": settings.PENALTY_LOW, "tier": "low"}
    if overtime_mins <= 60:  return {"amount": settings.PENALTY_MEDIUM,"tier": "medium"}
    return                          {"amount": settings.PENALTY_HIGH,"tier": "high"}


# ── Atomic Booking Engine ──────────────────────────────────────────────────────

def create_booking_atomic(user_id: str, booking_data: dict) -> str:
    """
    Creates a booking inside a Firestore transaction.
    Prevents double-booking with atomic slot-lock + overlap check.

    Steps:
      1. Re-read slot inside transaction (must be 'vacant')
      2. Check all active bookings for this slot+date for overlap
      3. Mark slot 'reserved' + write booking atomically

    Returns: booking_id on success
    Raises: ValueError on conflict
    """
    db          = get_db()
    booking_id  = str(uuid.uuid4())[:8].upper()
    slot_ref    = db.collection("parking_slots").document(booking_data["slotId"])
    booking_ref = db.collection("bookings").document(booking_id)

    @fs.transactional
    def _run(transaction):
        # 1. Read slot
        slot_snap = slot_ref.get(transaction=transaction)
        if not slot_snap.exists:
            raise ValueError("Slot not found")
        slot = slot_snap.to_dict()
        if slot["status"] != "vacant":
            raise ValueError(f"Slot is not available (current status: {slot['status']})")

        # 2. Overlap check against existing bookings
        existing = (
            db.collection("bookings")
            .where("slotId",        "==", booking_data["slotId"])
            .where("bookingDate",   "==", booking_data["bookingDate"])
            .where("bookingStatus", "in", ["active", "reserved"])
            .stream()
        )
        for doc in existing:
            bd = doc.to_dict()
            if has_overlap(booking_data["startTime"], booking_data["endTime"],
                           bd["startTime"],           bd["endTime"]):
                raise ValueError(
                    f"Time conflict with booking {bd['bookingId']} "
                    f"({bd['startTime']}–{bd['endTime']}). "
                    f"A {settings.BUFFER_MINS}-min buffer is required between bookings."
                )

        # 3. Atomic write
        transaction.update(slot_ref, {"status": "reserved"})
        transaction.set(booking_ref, {
            "bookingId":       booking_id,
            "userId":          user_id,
            **booking_data,
            "bookingStatus":   "active",
            "qrStatus":        "active",
            "penaltyAmount":   0,
            "overtimeMinutes": 0,
            "createdAt":       fs.SERVER_TIMESTAMP,
        })

    txn = db.transaction()
    _run(txn)
    return booking_id


# ── QR Verification ────────────────────────────────────────────────────────────

def verify_qr_atomic(booking_id: str) -> dict:
    """
    Atomically verifies a QR code and marks it as used.
    Returns the booking dict on success, raises ValueError on failure.
    """
    db  = get_db()
    ref = db.collection("bookings").document(booking_id)

    @fs.transactional
    def _run(transaction):
        snap = ref.get(transaction=transaction)
        if not snap.exists:
            raise ValueError("Booking not found")
        b = snap.to_dict()
        if b["qrStatus"] != "active":
            raise ValueError(f"QR code is already '{b['qrStatus']}'")
        if b["bookingStatus"] != "active":
            raise ValueError(f"Booking is '{b['bookingStatus']}', not active")
        transaction.update(ref, {
            "qrStatus":  "used",
            "entryTime": fs.SERVER_TIMESTAMP,
        })
        return b

    txn = db.transaction()
    return _run(txn)


# ── Extend Booking ────────────────────────────────────────────────────────────

def extend_booking(booking_id: str, user_id: str, new_end_time: str) -> dict:
    """Extends a booking's end time with conflict check."""
    db   = get_db()
    ref  = db.collection("bookings").document(booking_id)
    snap = ref.get()

    if not snap.exists:
        raise ValueError("Booking not found")
    b = snap.to_dict()
    if b["userId"] != user_id:
        raise ValueError("Not your booking")
    if b["bookingStatus"] != "active":
        raise ValueError("Can only extend active bookings")
    if time_to_mins(new_end_time) <= time_to_mins(b["endTime"]):
        raise ValueError("New end time must be later than current end time")

    # Check no conflict with next booking
    existing = (
        db.collection("bookings")
        .where("slotId",        "==", b["slotId"])
        .where("bookingDate",   "==", b["bookingDate"])
        .where("bookingStatus", "in", ["active", "reserved"])
        .stream()
    )
    for doc in existing:
        ed = doc.to_dict()
        if ed["bookingId"] == booking_id:
            continue
        if has_overlap(b["startTime"], new_end_time, ed["startTime"], ed["endTime"]):
            raise ValueError(
                f"Extension conflicts with booking {ed['bookingId']} "
                f"({ed['startTime']}–{ed['endTime']})"
            )

    ref.update({"endTime": new_end_time})
    return {"bookingId": booking_id, "newEndTime": new_end_time}


# ── Cancel Booking ────────────────────────────────────────────────────────────

def cancel_booking(booking_id: str, user_id: str) -> dict:
    """Cancels a booking and frees the slot."""
    db   = get_db()
    ref  = db.collection("bookings").document(booking_id)
    snap = ref.get()

    if not snap.exists:
        raise ValueError("Booking not found")
    b = snap.to_dict()
    if b["userId"] != user_id:
        raise ValueError("Not your booking")
    if b["bookingStatus"] not in ("active", "reserved"):
        raise ValueError(f"Cannot cancel booking with status '{b['bookingStatus']}'")

    ref.update({"bookingStatus": "cancelled", "qrStatus": "cancelled"})
    db.collection("parking_slots").document(b["slotId"]).update({"status": "vacant"})
    return {"bookingId": booking_id, "status": "cancelled"}


# ── Overtime Scan ─────────────────────────────────────────────────────────────

def scan_and_process_overtime(now_mins: int, today: str) -> list:
    """Delegates to overtime_scheduler for backward compatibility."""
    from api.services.overtime_scheduler import scan_and_process_overtime as _scan
    return _scan(now_mins, today)
