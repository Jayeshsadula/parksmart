# backend/api/routes/penalties.py
"""
Penalty Engine — overtime detection, penalty calculation, reassignment logic.
Can be triggered by a scheduled job (Cloud Scheduler) every 5 minutes.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from datetime import datetime
from typing import Literal
from core.firebase_admin import get_db
from core.auth_dependency import require_admin
from google.cloud import firestore as fs
import uuid

router = APIRouter()

BUFFER_MINS = 15

def time_to_mins(t: str) -> int:
    h, m = map(int, t.split(":"))
    return h * 60 + m

def calc_penalty(overtime_mins: int) -> dict:
    if overtime_mins <= 0:   return {"amount": 0,   "tier": "none"}
    if overtime_mins <= 15:  return {"amount": 0,   "tier": "warning"}
    if overtime_mins <= 30:  return {"amount": 50,  "tier": "low"}
    if overtime_mins <= 60:  return {"amount": 100, "tier": "medium"}
    return                          {"amount": 200, "tier": "high"}


class PenaltyAction(BaseModel):
    penaltyId: str
    action: Literal["waived", "collected"]


# ── Cron: scan active bookings for overtime ────────────────────────────────────
@router.post("/scan-overtime")
async def scan_overtime(admin: dict = Depends(require_admin)):
    """
    Scans all active bookings. For each booking whose endTime has passed:
      1. Calculates overtime minutes.
      2. Creates / updates a penalty record.
      3. Updates booking status to 'overtime'.
      4. Checks if the next booking for that slot is affected → triggers reassignment.

    Intended to be called by Cloud Scheduler every 5 minutes.
    """
    db       = get_db()
    now      = datetime.utcnow()
    today    = now.strftime("%Y-%m-%d")
    now_mins = now.hour * 60 + now.minute

    active_bookings = (
        db.collection("bookings")
        .where("bookingStatus", "==", "active")
        .where("bookingDate", "==", today)
        .stream()
    )

    processed = []
    for doc in active_bookings:
        b = doc.to_dict()
        end_mins = time_to_mins(b["endTime"])

        if now_mins <= end_mins:
            continue  # not overtime yet

        overtime_mins = now_mins - end_mins
        penalty       = calc_penalty(overtime_mins)

        # Update booking AND free up slot
        db.collection("bookings").document(b["bookingId"]).update({
            "bookingStatus":   "overtime",
            "qrStatus":        "expired",
            "overtimeMinutes": overtime_mins,
            "penaltyAmount":   penalty["amount"],
        })

        # Mark slot as available again
        db.collection("parking_slots").document(b["slotId"]).update({
            "status": "vacant"
        })

        # Create penalty record
        pen_id = str(uuid.uuid4())[:8].upper()
        db.collection("penalties").document(pen_id).set({
            "penaltyId":     pen_id,
            "bookingId":     b["bookingId"],
            "userId":        b["userId"],
            "slotId":        b["slotId"],
            "extraMinutes":  overtime_mins,
            "penaltyAmount": penalty["amount"],
            "tier":          penalty["tier"],
            "status":        "pending",
            "createdAt":     fs.SERVER_TIMESTAMP,
        })

        # Check for conflict with next booking on same slot
        _handle_overstay_conflict(db, b, now_mins)

        processed.append({"bookingId": b["bookingId"], "overtime_mins": overtime_mins, "penalty": penalty})

    return {"scanned": len(processed), "overtime_cases": processed}


def _handle_overstay_conflict(db, overstaying_booking: dict, now_mins: int):
    """
    If the overstaying vehicle's slot has a NEXT booking that starts within
    BUFFER_MINS, attempt auto-reassignment for the next user.
    """
    today   = overstaying_booking["bookingDate"]
    slot_id = overstaying_booking["slotId"]

    next_bookings = (
        db.collection("bookings")
        .where("slotId",        "==", slot_id)
        .where("bookingDate",   "==", today)
        .where("bookingStatus", "==", "active")
        .stream()
    )

    for doc in next_bookings:
        nb = doc.to_dict()
        if nb["bookingId"] == overstaying_booking["bookingId"]:
            continue

        nb_start = time_to_mins(nb["startTime"])
        if now_mins >= nb_start - BUFFER_MINS:
            # Conflict! Try to reassign
            _try_reassign(db, nb)


def _try_reassign(db, affected_booking: dict):
    """
    Attempts to find an available slot of same type in same floor/zone
    and reassign the affected booking. Falls back to 'delayed' status.
    """
    # Find original slot's type
    original_slot = db.collection("parking_slots").document(affected_booking["slotId"]).get()
    if not original_slot.exists:
        return
    slot_type = original_slot.to_dict().get("slotType", "normal")
    floor_id  = original_slot.to_dict().get("floorId")

    # Search for a vacant slot of same type on same floor
    alternatives = (
        db.collection("parking_slots")
        .where("floorId",  "==", floor_id)
        .where("slotType", "==", slot_type)
        .where("status",   "==", "vacant")
        .limit(1)
        .stream()
    )

    alt = next(alternatives, None)
    if alt:
        alt_data = alt.to_dict()
        # Reassign: update booking + reserve new slot + free old
        db.collection("bookings").document(affected_booking["bookingId"]).update({
            "slotId":        alt_data["slotId"],
            "slotLabel":     alt_data["label"],
            "zone":          alt_data["zone"],
            "bookingStatus": "reassigned",
        })
        db.collection("parking_slots").document(alt_data["slotId"]).update({"status": "reserved"})
    else:
        # No slot available — mark as delayed
        db.collection("bookings").document(affected_booking["bookingId"]).update({
            "bookingStatus": "delayed",
        })


@router.get("/pending")
async def get_pending_penalties(admin: dict = Depends(require_admin)):
    db   = get_db()
    docs = db.collection("penalties").where("status", "==", "pending").stream()
    return [d.to_dict() for d in docs]


@router.post("/resolve")
async def resolve_penalty(body: PenaltyAction, admin: dict = Depends(require_admin)):
    db  = get_db()
    ref = db.collection("penalties").document(body.penaltyId)
    if not ref.get().exists:
        raise HTTPException(404, "Penalty not found")
    ref.update({"status": body.action, "resolvedBy": admin["uid"]})
    return {"penaltyId": body.penaltyId, "action": body.action}