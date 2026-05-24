# backend/api/routes/parking_areas.py
"""
Parking Areas API — CRUD for parking areas, floors, and layout management.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional, List
from core.firebase_admin import get_db
from core.auth_dependency import get_current_user, require_admin
from google.cloud import firestore as fs
import uuid

router = APIRouter()


# ── Pydantic Models ───────────────────────────────────────────────────────────

class ParkingAreaCreate(BaseModel):
    name:        str
    location:    str
    type:        str   # mall | airport | hospital | office | apartment | theater
    totalFloors: int
    totalSlots:  int

class FloorCreate(BaseModel):
    parkingAreaId: str
    floorName:     str

class SlotCreate(BaseModel):
    floorId:   str
    zone:      str
    slotType:  str   # normal | vip | ev | disabled
    label:     str
    row:       int
    col:       int

class BulkSlotCreate(BaseModel):
    floorId:  str
    zone:     str
    slotType: str
    rows:     int
    cols:     int


# ── Parking Areas ─────────────────────────────────────────────────────────────

@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_parking_area(
    body: ParkingAreaCreate,
    admin: dict = Depends(require_admin),
):
    db  = get_db()
    pid = str(uuid.uuid4())[:8].upper()
    db.collection("parking_areas").document(pid).set({
        "parkingAreaId": pid,
        "adminId":       admin["uid"],
        "name":          body.name,
        "location":      body.location,
        "type":          body.type,
        "totalFloors":   body.totalFloors,
        "totalSlots":    body.totalSlots,
        "available":     body.totalSlots,
        "createdAt":     fs.SERVER_TIMESTAMP,
    })
    return {"parkingAreaId": pid, "message": "Parking area created"}


@router.get("/")
async def get_all_parking_areas(user: dict = Depends(get_current_user)):
    db   = get_db()
    docs = db.collection("parking_areas").stream()
    return [d.to_dict() for d in docs]


@router.get("/admin/mine")
async def get_my_parking_areas(admin: dict = Depends(require_admin)):
    db   = get_db()
    docs = db.collection("parking_areas").where("adminId", "==", admin["uid"]).stream()
    return [d.to_dict() for d in docs]


@router.get("/{area_id}")
async def get_parking_area(area_id: str, user: dict = Depends(get_current_user)):
    db   = get_db()
    snap = db.collection("parking_areas").document(area_id).get()
    if not snap.exists:
        raise HTTPException(404, "Parking area not found")
    return snap.to_dict()


@router.patch("/{area_id}")
async def update_parking_area(
    area_id: str,
    updates: dict,
    admin: dict = Depends(require_admin),
):
    allowed = {"name", "location", "type", "totalFloors", "totalSlots"}
    filtered = {k: v for k, v in updates.items() if k in allowed}
    db = get_db()
    db.collection("parking_areas").document(area_id).update(filtered)
    return {"updated": filtered}


@router.delete("/{area_id}")
async def delete_parking_area(area_id: str, admin: dict = Depends(require_admin)):
    db = get_db()
    db.collection("parking_areas").document(area_id).delete()
    return {"message": f"Parking area {area_id} deleted"}


# ── Floors ────────────────────────────────────────────────────────────────────

@router.post("/floors/create", status_code=status.HTTP_201_CREATED)
async def create_floor(body: FloorCreate, admin: dict = Depends(require_admin)):
    db  = get_db()
    fid = str(uuid.uuid4())[:8].upper()
    db.collection("parking_floors").document(fid).set({
        "floorId":       fid,
        "parkingAreaId": body.parkingAreaId,
        "floorName":     body.floorName,
        "createdAt":     fs.SERVER_TIMESTAMP,
    })
    return {"floorId": fid, "message": "Floor created"}


@router.get("/{area_id}/floors")
async def get_floors(area_id: str, user: dict = Depends(get_current_user)):
    db   = get_db()
    docs = db.collection("parking_floors").where("parkingAreaId", "==", area_id).stream()
    return [d.to_dict() for d in docs]


# ── Slots ─────────────────────────────────────────────────────────────────────

@router.post("/slots/create", status_code=status.HTTP_201_CREATED)
async def create_slot(body: SlotCreate, admin: dict = Depends(require_admin)):
    db  = get_db()
    sid = str(uuid.uuid4())[:8].upper()
    db.collection("parking_slots").document(sid).set({
        "slotId":    sid,
        "floorId":   body.floorId,
        "zone":      body.zone,
        "slotType":  body.slotType,
        "label":     body.label,
        "row":       body.row,
        "col":       body.col,
        "status":    "vacant",
        "createdAt": fs.SERVER_TIMESTAMP,
    })
    return {"slotId": sid, "message": "Slot created"}


@router.post("/slots/bulk-create", status_code=status.HTTP_201_CREATED)
async def bulk_create_slots(body: BulkSlotCreate, admin: dict = Depends(require_admin)):
    """
    Creates rows × cols slots in one call.
    Row labels: A, B, C...  Col labels: 1, 2, 3...
    Example: rows=3, cols=6 → A1-A6, B1-B6, C1-C6 (18 slots)
    """
    db         = get_db()
    batch      = db.batch()
    created    = []

    for r in range(body.rows):
        row_letter = chr(65 + r)
        for c in range(1, body.cols + 1):
            sid   = str(uuid.uuid4())[:8].upper()
            label = f"{row_letter}{c}"
            ref   = db.collection("parking_slots").document(sid)
            batch.set(ref, {
                "slotId":    sid,
                "floorId":   body.floorId,
                "zone":      body.zone,
                "slotType":  body.slotType,
                "label":     label,
                "row":       r,
                "col":       c,
                "status":    "vacant",
                "createdAt": fs.SERVER_TIMESTAMP,
            })
            created.append({"slotId": sid, "label": label})

    batch.commit()
    return {"created": len(created), "slots": created}
