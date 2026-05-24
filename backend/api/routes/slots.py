# backend/api/routes/slots.py
"""
Parking Slots API — CRUD, live status updates, IoT webhook endpoint.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Literal
from core.firebase_admin import get_db
from core.auth_dependency import get_current_user, require_admin
import uuid

router = APIRouter()

VALID_STATUSES = ["vacant", "occupied", "reserved", "temporary_locked", "maintenance"]


class SlotStatusUpdate(BaseModel):
    status: Literal["vacant", "occupied", "reserved", "temporary_locked", "maintenance"]

class IoTStatusUpdate(BaseModel):
    """Payload from ESP32 sensor hub (future IoT integration)."""
    slotId:    str
    status:    Literal["vacant", "occupied"]
    sensorId:  str
    timestamp: str


# ── Get all slots for a floor ─────────────────────────────────────────────────
@router.get("/floor/{floor_id}")
async def get_slots_by_floor(floor_id: str, user: dict = Depends(get_current_user)):
    db   = get_db()
    docs = db.collection("parking_slots").where("floorId", "==", floor_id).stream()
    return [d.to_dict() for d in docs]


# ── Admin: update single slot status ─────────────────────────────────────────
@router.patch("/{slot_id}/status")
async def update_slot_status(
    slot_id: str,
    body: SlotStatusUpdate,
    admin: dict = Depends(require_admin),
):
    db  = get_db()
    ref = db.collection("parking_slots").document(slot_id)
    if not ref.get().exists:
        raise HTTPException(404, "Slot not found")
    ref.update({"status": body.status})
    return {"slotId": slot_id, "status": body.status, "updatedBy": admin["uid"]}


# ── IoT Webhook: ESP32 pushes sensor readings ─────────────────────────────────
@router.post("/iot/update")
async def iot_status_update(body: IoTStatusUpdate):
    """
    Future IoT integration endpoint.
    ESP32 microcontroller sends POST here when IR/ultrasonic sensor detects
    vehicle entry or exit. Updates Firestore slot status in real-time.
    Authentication: signed HMAC header (to be implemented in Phase 2).
    """
    db  = get_db()
    ref = db.collection("parking_slots").document(body.slotId)
    if not ref.get().exists:
        raise HTTPException(404, f"Slot {body.slotId} not found")

    ref.update({
        "status":         body.status,
        "lastSensorRead": body.timestamp,
        "sensorId":       body.sensorId,
    })

    # Also write to live_status collection for dashboard widgets
    db.collection("live_status").document(body.slotId).set({
        "slotId":    body.slotId,
        "status":    body.status,
        "sensorId":  body.sensorId,
        "updatedAt": body.timestamp,
    })

    return {"ok": True, "slotId": body.slotId, "newStatus": body.status}
