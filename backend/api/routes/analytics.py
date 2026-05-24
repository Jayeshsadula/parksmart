# backend/api/routes/analytics.py
"""
Analytics API — revenue, occupancy, booking trends, hourly stats.
All endpoints are admin-only.
"""

from fastapi import APIRouter, Depends, Query
from core.firebase_admin import get_db
from core.auth_dependency import require_admin
from datetime import datetime, timedelta
from collections import defaultdict
import math

router = APIRouter()


# ── Summary dashboard metrics ────────────────────────────────────────────────
@router.get("/summary")
async def get_summary(admin: dict = Depends(require_admin)):
    db       = get_db()
    bookings = [d.to_dict() for d in db.collection("bookings").stream()]
    penalties= [d.to_dict() for d in db.collection("penalties").stream()]
    slots    = [d.to_dict() for d in db.collection("parking_slots").stream()]
    areas    = [d.to_dict() for d in db.collection("parking_areas").stream()]

    total_revenue   = len(bookings) * 120 + sum(b.get("penaltyAmount", 0) for b in bookings)
    occupied_slots  = sum(1 for s in slots if s.get("status") == "occupied")
    occupancy_rate  = round((occupied_slots / len(slots) * 100), 1) if slots else 0

    status_counts = defaultdict(int)
    for b in bookings:
        status_counts[b.get("bookingStatus", "unknown")] += 1

    return {
        "totalBookings":       len(bookings),
        "activeBookings":      status_counts.get("active", 0),
        "completedBookings":   status_counts.get("completed", 0),
        "overtimeBookings":    status_counts.get("overtime", 0),
        "cancelledBookings":   status_counts.get("cancelled", 0),
        "totalRevenue":        total_revenue,
        "pendingPenalties":    sum(1 for p in penalties if p.get("status") == "pending"),
        "totalPenaltyAmount":  sum(p.get("penaltyAmount", 0) for p in penalties if p.get("status") == "pending"),
        "totalSlots":          len(slots),
        "occupiedSlots":       occupied_slots,
        "occupancyRate":       occupancy_rate,
        "totalAreas":          len(areas),
        "statusBreakdown":     dict(status_counts),
    }


# ── Hourly occupancy for today ────────────────────────────────────────────────
@router.get("/hourly-occupancy")
async def get_hourly_occupancy(
    parking_area_id: str = Query(None),
    admin: dict = Depends(require_admin),
):
    """
    Returns 24-hour occupancy percentages based on today's bookings.
    Each index = hour of day (0–23).
    """
    db    = get_db()
    today = datetime.utcnow().strftime("%Y-%m-%d")

    q = db.collection("bookings").where("bookingDate", "==", today)
    if parking_area_id:
        q = q.where("parkingAreaId", "==", parking_area_id)

    bookings = [d.to_dict() for d in q.stream()]
    slots    = [d.to_dict() for d in db.collection("parking_slots").stream()]
    total_slots = max(len(slots), 1)

    hourly_counts = [0] * 24
    for b in bookings:
        if b.get("bookingStatus") in ("active", "completed", "overtime"):
            try:
                start_h = int(b["startTime"].split(":")[0])
                end_h   = int(b["endTime"].split(":")[0])
                for h in range(start_h, min(end_h + 1, 24)):
                    hourly_counts[h] += 1
            except Exception:
                pass

    hourly_pct = [round(c / total_slots * 100) for c in hourly_counts]
    return {"date": today, "hourlyOccupancy": hourly_pct, "totalSlots": total_slots}


# ── Weekly booking trend ──────────────────────────────────────────────────────
@router.get("/weekly-trend")
async def get_weekly_trend(admin: dict = Depends(require_admin)):
    """Returns booking counts for the last 7 days."""
    db     = get_db()
    today  = datetime.utcnow()
    result = []

    for i in range(6, -1, -1):
        day      = today - timedelta(days=i)
        day_str  = day.strftime("%Y-%m-%d")
        day_label= day.strftime("%a")
        bookings = list(db.collection("bookings").where("bookingDate", "==", day_str).stream())
        result.append({"date": day_str, "label": day_label, "count": len(bookings)})

    return {"weekly": result}


# ── Monthly revenue trend ─────────────────────────────────────────────────────
@router.get("/monthly-revenue")
async def get_monthly_revenue(admin: dict = Depends(require_admin)):
    """Returns estimated revenue for each of the last 12 months."""
    db    = get_db()
    today = datetime.utcnow()
    result= []

    for i in range(11, -1, -1):
        month     = today.replace(day=1) - timedelta(days=i * 30)
        month_str = month.strftime("%Y-%m")
        label     = month.strftime("%b")
        # Count bookings that start in this month
        all_bk    = [d.to_dict() for d in db.collection("bookings").stream()]
        count     = sum(1 for b in all_bk if b.get("bookingDate", "").startswith(month_str))
        revenue   = count * 120
        result.append({"month": month_str, "label": label, "bookings": count, "revenue": revenue})

    return {"monthly": result}


# ── Revenue breakdown by parking area ────────────────────────────────────────
@router.get("/revenue-by-area")
async def get_revenue_by_area(admin: dict = Depends(require_admin)):
    db       = get_db()
    bookings = [d.to_dict() for d in db.collection("bookings").stream()]
    areas    = {a.to_dict()["parkingAreaId"]: a.to_dict()["name"]
                for a in db.collection("parking_areas").stream()}

    area_revenue = defaultdict(int)
    area_count   = defaultdict(int)
    for b in bookings:
        pid = b.get("parkingAreaId", "unknown")
        area_revenue[pid] += 120 + b.get("penaltyAmount", 0)
        area_count[pid]   += 1

    total = max(sum(area_revenue.values()), 1)
    result = [
        {
            "parkingAreaId": pid,
            "name":          areas.get(pid, pid),
            "revenue":       rev,
            "bookings":      area_count[pid],
            "percentage":    round(rev / total * 100),
        }
        for pid, rev in sorted(area_revenue.items(), key=lambda x: -x[1])
    ]
    return {"areaRevenue": result, "totalRevenue": total}


# ── Slot utilisation per area ─────────────────────────────────────────────────
@router.get("/slot-utilisation")
async def get_slot_utilisation(admin: dict = Depends(require_admin)):
    db    = get_db()
    slots = [d.to_dict() for d in db.collection("parking_slots").stream()]

    by_floor = defaultdict(lambda: {"total": 0, "occupied": 0, "reserved": 0, "vacant": 0})
    for s in slots:
        fid = s.get("floorId", "unknown")
        by_floor[fid]["total"] += 1
        status = s.get("status", "vacant")
        if status in by_floor[fid]:
            by_floor[fid][status] += 1

    result = []
    for fid, data in by_floor.items():
        utilisation = round((data["occupied"] + data["reserved"]) / max(data["total"], 1) * 100)
        result.append({"floorId": fid, **data, "utilisationRate": utilisation})

    return {"floors": result}
