# backend/api/routes/bookings.py
"""
Booking Engine — core of ParkSmart AI.
- Atomic Firestore transaction prevents double booking.
- 15-minute buffer between consecutive bookings.
- Temporary slot locking on selection.
- Overtime detection and penalty trigger.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from datetime import datetime, date
from typing import Optional
from core.firebase_admin import get_db
from core.auth_dependency import get_current_user
from google.cloud import firestore as fs
import uuid

router = APIRouter()


# ── Pydantic models ──────────────────────────────────────────────────────────

class BookingRequest(BaseModel):
    slotId:         str
    parkingAreaId:  str
    parkingAreaName: str
    floorName:      str
    zone:           str
    slotLabel:      str
    bookingDate:    str   # YYYY-MM-DD
    startTime:      str   # HH:MM
    endTime:        str   # HH:MM

class ExtendBookingRequest(BaseModel):
    bookingId: str
    newEndTime: str       # HH:MM


# ── Helpers ──────────────────────────────────────────────────────────────────

def time_to_mins(t: str) -> int:
    h, m = map(int, t.split(":"))
    return h * 60 + m

BUFFER_MINS = 15


def has_overlap(new_start: str, new_end: str, existing_start: str, existing_end: str) -> bool:
    ns = time_to_mins(new_start)
    ne = time_to_mins(new_end)
    es = time_to_mins(existing_start)
    ee = time_to_mins(existing_end) + BUFFER_MINS
    return ns < ee and ne > es


def calc_penalty(overtime_mins: int) -> int:
    if overtime_mins <= 0:   return 0
    if overtime_mins <= 15:  return 0       # grace period
    if overtime_mins <= 30:  return 50
    if overtime_mins <= 60:  return 100
    return 200


# ── Routes ───────────────────────────────────────────────────────────────────

@router.post("/create", status_code=status.HTTP_201_CREATED)
async def create_booking(
    body: BookingRequest,
    user: dict = Depends(get_current_user),
):
    """
    Atomically creates a booking.
    Steps inside transaction:
      1. Re-read slot — must be 'vacant'.
      2. Check all active bookings for this slot+date for time overlap (+ 15-min buffer).
      3. Mark slot as 'reserved'.
      4. Write booking document.
    Returns booking_id on success, raises 409 on conflict.
    """
    db = get_db()
    booking_id = str(uuid.uuid4())[:8].upper()
    slot_ref    = db.collection("parking_slots").document(body.slotId)
    booking_ref = db.collection("bookings").document(booking_id)

    @fs.transactional
    def _txn(transaction):
        slot_snap = slot_ref.get(transaction=transaction)
        if not slot_snap.exists:
            raise ValueError("Slot not found")
        slot = slot_snap.to_dict()
        if slot["status"] != "vacant":
            raise ValueError(f"Slot is not available (status: {slot['status']})")

        # Overlap check
        existing = (
            db.collection("bookings")
            .where("slotId", "==", body.slotId)
            .where("bookingDate", "==", body.bookingDate)
            .where("bookingStatus", "in", ["active", "reserved"])
            .stream()
        )
        for b in existing:
            bd = b.to_dict()
            if has_overlap(body.startTime, body.endTime, bd["startTime"], bd["endTime"]):
                raise ValueError(
                    f"Time conflict with booking {bd['bookingId']} "
                    f"({bd['startTime']}–{bd['endTime']}). "
                    f"Include {BUFFER_MINS}-min buffer."
                )

        # Atomic writes
        transaction.update(slot_ref, {"status": "reserved"})
        transaction.set(booking_ref, {
            "bookingId":      booking_id,
            "userId":         user["uid"],
            "slotId":         body.slotId,
            "parkingAreaId":  body.parkingAreaId,
            "parkingAreaName": body.parkingAreaName,
            "floorName":      body.floorName,
            "zone":           body.zone,
            "slotLabel":      body.slotLabel,
            "bookingDate":    body.bookingDate,
            "startTime":      body.startTime,
            "endTime":        body.endTime,
            "bookingStatus":  "active",
            "qrStatus":       "active",
            "penaltyAmount":  0,
            "overtimeMinutes": 0,
            "createdAt":      fs.SERVER_TIMESTAMP,
        })

    transaction = db.transaction()
    try:
        _txn(transaction)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))

    return {"bookingId": booking_id, "message": "Booking confirmed"}


@router.post("/extend")
async def extend_booking(
    body: ExtendBookingRequest,
    user: dict = Depends(get_current_user),
):
    """Extends an active booking's end time (validates no new conflicts)."""
    db = get_db()
    ref  = db.collection("bookings").document(body.bookingId)
    snap = ref.get()

    if not snap.exists:
        raise HTTPException(404, "Booking not found")
    b = snap.to_dict()
    if b["userId"] != user["uid"]:
        raise HTTPException(403, "Not your booking")
    if b["bookingStatus"] != "active":
        raise HTTPException(409, "Can only extend active bookings")

    # Check no conflict with new end time
    existing = (
        db.collection("bookings")
        .where("slotId", "==", b["slotId"])
        .where("bookingDate", "==", b["bookingDate"])
        .where("bookingStatus", "in", ["active", "reserved"])
        .stream()
    )
    for ex in existing:
        ed = ex.to_dict()
        if ed["bookingId"] == body.bookingId:
            continue
        if has_overlap(b["startTime"], body.newEndTime, ed["startTime"], ed["endTime"]):
            raise HTTPException(409, f"Extension conflicts with booking {ed['bookingId']}")

    ref.update({"endTime": body.newEndTime})
    return {"message": "Booking extended", "newEndTime": body.newEndTime}


@router.get("/my")
async def get_my_bookings(user: dict = Depends(get_current_user)):
    """Returns all bookings for the authenticated user."""
    db = get_db()
    docs = (
        db.collection("bookings")
        .where("userId", "==", user["uid"])
        .order_by("createdAt", direction=fs.Query.DESCENDING)
        .stream()
    )
    return [d.to_dict() for d in docs]

@router.post("/verify-qr/{booking_id}")
async def verify_qr(booking_id: str, user: dict = Depends(get_current_user)):
    """
    QR verification with automatic slot status toggling:
    - First scan: Mark slot as OCCUPIED (vehicle entered)
    - Second scan: Mark slot as VACANT (vehicle exited)
    
    Searches by bookingId field (not Firestore document ID)
    """
    from datetime import datetime
    
    db  = get_db()

    @fs.transactional
    def _verify(transaction):
        # Search for booking by bookingId field (not document ID)
        bookings = db.collection("bookings").where(
            "bookingId", "==", booking_id
        ).stream()
        
        booking_doc = None
        for doc in bookings:
            booking_doc = doc
            break
        
        if not booking_doc:
            raise ValueError(f"Booking {booking_id} not found")
        
        b = booking_doc.to_dict()
        ref = booking_doc.reference
        
        # Check QR status
        if b["qrStatus"] not in ["active", "used"]:
            raise ValueError(f"QR already {b['qrStatus']}")
        
        if b["bookingStatus"] not in ["active", "reserved"]:
            raise ValueError(f"Booking status is {b['bookingStatus']}")
        
        # Time-based expiry check
        now = datetime.utcnow()
        booking_date = b.get("bookingDate", "")
        end_time = b.get("endTime", "")
        
        if booking_date and end_time:
            try:
                year, month, day = map(int, booking_date.split("-"))
                hour, minute = map(int, end_time.split(":"))
                end_datetime = datetime(year, month, day, hour, minute)
                
                if now > end_datetime:
                    raise ValueError("QR code has expired (booking time ended)")
            except ValueError as ve:
                if "expired" in str(ve):
                    raise
                pass
        
        # LOGIC: Toggle slot status on each scan
        slot_ref = db.collection("parking_slots").document(b["slotId"])
        slot_snap = slot_ref.get(transaction=transaction)
        
        # If first scan (QR is active) → Mark as OCCUPIED
        if b["qrStatus"] == "active":
            new_slot_status = "occupied"
            new_qr_status = "used"
            entry_action = True
        # If second scan (QR already used) → Mark as VACANT
        else:
            new_slot_status = "vacant"
            new_qr_status = "completed"
            entry_action = False
        
        # Update slot status
        transaction.update(slot_ref, {"status": new_slot_status})
        
        # Update booking
        update_data = {
            "qrStatus": new_qr_status,
            "bookingStatus": "occupied" if entry_action else "completed",
        }
        
        if entry_action:
            update_data["entryTime"] = fs.SERVER_TIMESTAMP
        else:
            update_data["exitTime"] = fs.SERVER_TIMESTAMP
        
        transaction.update(ref, update_data)
        
        return {
            "booking": b,
            "action": "ENTRY - Vehicle Entered Parking" if entry_action else "EXIT - Vehicle Left Parking",
            "new_slot_status": new_slot_status
        }

    txn = db.transaction()
    try:
        result = _verify(txn)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "verified": True,
        "action": result["action"],
        "slotId": result["booking"]["slotId"],
        "newStatus": result["new_slot_status"],
        "booking": result["booking"],
        "navigation": {
            "floor": result["booking"].get("floorName"),
            "zone": result["booking"].get("zone"),
            "slot": result["booking"].get("slotLabel"),
        }
    }