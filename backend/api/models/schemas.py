# backend/api/models/schemas.py
"""
Pydantic v2 schemas for all request/response models.
Used across all route handlers for validation and serialisation.
"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Literal
from datetime import datetime


# ── Auth / Users ──────────────────────────────────────────────────────────────

class UserProfile(BaseModel):
    uid:           str
    name:          str
    email:         EmailStr
    phone:         str
    vehicleNumber: str
    role:          str = "user"

class UserProfileCreate(BaseModel):
    name:          str = Field(..., min_length=2)
    email:         EmailStr
    phone:         str = Field(..., min_length=10)
    vehicleNumber: str = Field(..., min_length=4)

class AdminProfile(BaseModel):
    uid:          str
    ownerName:    str
    businessName: str
    email:        EmailStr
    location:     str
    capacity:     int
    role:         str = "admin"

class AdminProfileCreate(BaseModel):
    ownerName:    str = Field(..., min_length=2)
    businessName: str = Field(..., min_length=2)
    email:        EmailStr
    location:     str
    capacity:     int = Field(..., gt=0)


# ── Parking Areas ─────────────────────────────────────────────────────────────

class ParkingAreaCreate(BaseModel):
    name:        str
    location:    str
    type:        Literal["mall", "airport", "hospital", "office", "apartment", "theater"]
    totalFloors: int = Field(..., gt=0)
    totalSlots:  int = Field(..., gt=0)

class ParkingAreaResponse(BaseModel):
    parkingAreaId: str
    name:          str
    location:      str
    type:          str
    totalFloors:   int
    totalSlots:    int
    available:     int
    adminId:       str


# ── Floors ────────────────────────────────────────────────────────────────────

class FloorCreate(BaseModel):
    parkingAreaId: str
    floorName:     str

class FloorResponse(BaseModel):
    floorId:       str
    parkingAreaId: str
    floorName:     str


# ── Slots ─────────────────────────────────────────────────────────────────────

SLOT_TYPES   = Literal["normal", "vip", "ev", "disabled"]
SLOT_STATUSES= Literal["vacant", "occupied", "reserved", "temporary_locked", "maintenance"]

class SlotCreate(BaseModel):
    floorId:  str
    zone:     str
    slotType: SLOT_TYPES = "normal"
    label:    str
    row:      int
    col:      int

class BulkSlotCreate(BaseModel):
    floorId:  str
    zone:     str
    slotType: SLOT_TYPES = "normal"
    rows:     int = Field(..., gt=0, le=10)
    cols:     int = Field(..., gt=0, le=12)

class SlotStatusUpdate(BaseModel):
    status: SLOT_STATUSES

class SlotResponse(BaseModel):
    slotId:   str
    floorId:  str
    zone:     str
    slotType: str
    label:    str
    row:      int
    col:      int
    status:   str

class IoTStatusUpdate(BaseModel):
    """Payload pushed by ESP32 sensor hub."""
    slotId:    str
    status:    Literal["vacant", "occupied"]
    sensorId:  str
    timestamp: str


# ── Bookings ──────────────────────────────────────────────────────────────────

BOOKING_STATUSES = Literal[
    "active", "completed", "overtime", "cancelled", "delayed", "reassigned"
]
QR_STATUSES = Literal["active", "used", "expired", "cancelled"]

class BookingCreate(BaseModel):
    slotId:          str
    parkingAreaId:   str
    parkingAreaName: str
    floorName:       str
    zone:            str
    slotLabel:       str
    bookingDate:     str   # YYYY-MM-DD
    startTime:       str   # HH:MM
    endTime:         str   # HH:MM

class BookingResponse(BaseModel):
    bookingId:       str
    userId:          str
    slotId:          str
    parkingAreaId:   str
    parkingAreaName: str
    floorName:       str
    zone:            str
    slotLabel:       str
    bookingDate:     str
    startTime:       str
    endTime:         str
    bookingStatus:   str
    qrStatus:        str
    penaltyAmount:   int
    overtimeMinutes: int

class ExtendBookingRequest(BaseModel):
    bookingId:  str
    newEndTime: str   # HH:MM

class BookingStatusUpdate(BaseModel):
    bookingStatus: BOOKING_STATUSES


# ── Penalties ─────────────────────────────────────────────────────────────────

class PenaltyResponse(BaseModel):
    penaltyId:     str
    bookingId:     str
    userId:        str
    slotId:        str
    extraMinutes:  int
    penaltyAmount: int
    tier:          str
    status:        str

class PenaltyAction(BaseModel):
    penaltyId: str
    action:    Literal["waived", "collected"]


# ── Analytics ─────────────────────────────────────────────────────────────────

class SummaryResponse(BaseModel):
    totalBookings:      int
    activeBookings:     int
    completedBookings:  int
    overtimeBookings:   int
    totalRevenue:       int
    pendingPenalties:   int
    totalSlots:         int
    occupiedSlots:      int
    occupancyRate:      float


# ── AI Forecast ───────────────────────────────────────────────────────────────

class ForecastResponse(BaseModel):
    parkingAreaId:   str
    date:            str
    hourlyOccupancy: List[int]
    peakHours:       List[int]
    recommendation:  str

class ChatMessage(BaseModel):
    text:    str
    context: Optional[dict] = None
