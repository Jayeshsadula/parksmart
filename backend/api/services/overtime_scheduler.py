# backend/api/services/overtime_scheduler.py
"""
Overtime Scheduler — Background task that periodically scans
active bookings and processes overtime/penalty cases.

Two modes:
  1. FastAPI lifespan BackgroundTask — runs inside the server process (dev)
  2. Cloud Scheduler (GCP) → POST /api/penalties/scan-overtime (production)
"""

import asyncio
from datetime import datetime, timezone
from core.config import settings
from core.firebase_admin import get_db
from google.cloud import firestore as fs
import uuid


def time_to_mins(t: str) -> int:
    h, m = map(int, t.split(":"))
    return h * 60 + m


def calc_penalty(overtime_mins: int) -> dict:
    if overtime_mins <= 0:   return {"amount": 0,   "tier": "none"}
    if overtime_mins <= 15:  return {"amount": 0,   "tier": "warning"}
    if overtime_mins <= 30:  return {"amount": settings.PENALTY_LOW,    "tier": "low"}
    if overtime_mins <= 60:  return {"amount": settings.PENALTY_MEDIUM, "tier": "medium"}
    return                          {"amount": settings.PENALTY_HIGH,   "tier": "high"}


def scan_and_process_overtime(now_mins: int, today: str) -> list:
    """
    Core scan logic — called by both the async scheduler loop
    and the /api/penalties/scan-overtime HTTP endpoint.
    Returns list of processed booking dicts.
    """
    db = get_db()
    processed = []

    active_docs = (
        db.collection("bookings")
        .where("bookingStatus", "==", "active")
        .where("bookingDate",   "==", today)
        .stream()
    )

    for doc in active_docs:
        b = doc.to_dict()
        try:
            end_mins = time_to_mins(b["endTime"])
        except Exception:
            continue

        if now_mins <= end_mins:
            continue  # Not yet overtime

        overtime_mins = now_mins - end_mins
        penalty       = calc_penalty(overtime_mins)

        # Update booking status
        db.collection("bookings").document(b["bookingId"]).update({
            "bookingStatus":   "overtime",
            "overtimeMinutes": overtime_mins,
            "penaltyAmount":   penalty["amount"],
        })

        # Create penalty record (avoid duplicates)
        existing_pen = list(
            db.collection("penalties")
            .where("bookingId", "==", b["bookingId"])
            .where("status",    "==", "pending")
            .limit(1)
            .stream()
        )
        if not existing_pen:
            pen_id = str(uuid.uuid4())[:8].upper()
            db.collection("penalties").document(pen_id).set({
                "penaltyId":     pen_id,
                "bookingId":     b["bookingId"],
                "userId":        b["userId"],
                "slotId":        b.get("slotId", ""),
                "extraMinutes":  overtime_mins,
                "penaltyAmount": penalty["amount"],
                "tier":          penalty["tier"],
                "status":        "pending",
                "createdAt":     fs.SERVER_TIMESTAMP,
            })

        # Check for conflict with next booking on same slot
        _handle_overstay_conflict(db, b, now_mins)

        processed.append({
            "bookingId":     b["bookingId"],
            "overtimeMins":  overtime_mins,
            "penaltyAmount": penalty["amount"],
            "tier":          penalty["tier"],
        })

    return processed


def _handle_overstay_conflict(db, overstaying: dict, now_mins: int):
    """
    If overstaying vehicle's slot has a NEXT booking that starts within
    BUFFER_MINS, attempt auto-reassignment for the affected user.
    """
    next_docs = (
        db.collection("bookings")
        .where("slotId",        "==", overstaying.get("slotId", ""))
        .where("bookingDate",   "==", overstaying.get("bookingDate", ""))
        .where("bookingStatus", "==", "active")
        .stream()
    )

    for doc in next_docs:
        nb = doc.to_dict()
        if nb["bookingId"] == overstaying["bookingId"]:
            continue
        try:
            nb_start = time_to_mins(nb["startTime"])
        except Exception:
            continue

        if now_mins >= nb_start - settings.BUFFER_MINS:
            _try_reassign(db, nb)


def _try_reassign(db, affected: dict):
    """
    Finds an available slot of same type on same floor.
    Reassigns booking or marks as 'delayed'.
    """
    orig_ref = db.collection("parking_slots").document(affected.get("slotId", ""))
    orig_snap = orig_ref.get()
    if not orig_snap.exists:
        db.collection("bookings").document(affected["bookingId"]).update({"bookingStatus": "delayed"})
        return

    orig = orig_snap.to_dict()
    slot_type = orig.get("slotType", "normal")
    floor_id  = orig.get("floorId", "")

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
        db.collection("bookings").document(affected["bookingId"]).update({
            "slotId":        alt_data["slotId"],
            "slotLabel":     alt_data.get("label", ""),
            "zone":          alt_data.get("zone", ""),
            "bookingStatus": "reassigned",
        })
        db.collection("parking_slots").document(alt_data["slotId"]).update({"status": "reserved"})
    else:
        db.collection("bookings").document(affected["bookingId"]).update({"bookingStatus": "delayed"})


async def run_overtime_scanner():
    """
    Async loop — runs every OVERTIME_SCAN_INTERVAL seconds.
    Started on app startup in development mode.
    In production use Google Cloud Scheduler → POST /api/penalties/scan-overtime.
    """
    print(f"[OvertimeScanner] Started — interval: {settings.OVERTIME_SCAN_INTERVAL}s")
    while True:
        try:
            now      = datetime.now(timezone.utc)
            today    = now.strftime("%Y-%m-%d")
            now_mins = now.hour * 60 + now.minute
            results  = scan_and_process_overtime(now_mins, today)
            if results:
                print(f"[OvertimeScanner] {now.strftime('%H:%M')} — "
                      f"Processed {len(results)} overtime case(s)")
            else:
                print(f"[OvertimeScanner] {now.strftime('%H:%M')} — No overtime cases")
        except Exception as e:
            print(f"[OvertimeScanner] Error: {e}")
        await asyncio.sleep(settings.OVERTIME_SCAN_INTERVAL)
