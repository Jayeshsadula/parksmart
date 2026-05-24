# backend/api/services/ai_service.py
"""
AI Service — ParkSmart AI
Phase 1 : Rule-based mock predictions + sinusoidal occupancy model.
Phase 2 : LSTM model trained on Firestore booking history.
Phase 3 : LLM-based natural language parking assistant.
"""

import math
from datetime import date, datetime, timedelta
from collections import defaultdict
from core.firebase_admin import get_db


# ── Phase 1: Mock Forecast ────────────────────────────────────────────────────

def generate_mock_forecast(parking_area_id: str, target_date: str) -> dict:
    """
    Generates a realistic sinusoidal occupancy pattern.
    Simulates typical weekday parking demand:
      - Low overnight (0-6 AM)
      - Morning rush (7-10 AM)
      - Lunch peak (12-2 PM)
      - Evening rush (5-8 PM)
      - Night decline (9 PM onwards)
    """
    hourly = []
    for h in range(24):
        if 0 <= h < 6:
            pct = int(10 + 5 * math.sin(h * math.pi / 6))
        elif 6 <= h < 10:
            pct = int(30 + 60 * ((h - 6) / 4))
        elif 10 <= h < 12:
            pct = int(80 + 10 * math.sin((h - 10) * math.pi / 2))
        elif 12 <= h < 14:
            pct = int(75 + 15 * math.sin((h - 12) * math.pi / 2))
        elif 14 <= h < 17:
            pct = int(70 - 10 * ((h - 14) / 3))
        elif 17 <= h < 20:
            pct = int(60 + 30 * math.sin((h - 17) * math.pi / 3))
        elif 20 <= h < 22:
            pct = int(60 - 20 * ((h - 20) / 2))
        else:
            pct = int(20 - 5 * ((h - 22) / 2))
        hourly.append(max(5, min(98, pct)))

    peak_hours  = [h for h, v in enumerate(hourly) if v > 80]
    peak_hour   = hourly.index(max(hourly))
    max_occ     = max(hourly)

    return {
        "parkingAreaId":   parking_area_id,
        "date":            target_date,
        "hourlyOccupancy": hourly,
        "peakHours":       peak_hours,
        "maxOccupancy":    max_occ,
        "recommendation":  (
            f"Expected peak occupancy {max_occ}% at {peak_hour}:00. "
            f"Best booking windows: before {peak_hours[0]:02d}:00 "
            f"or after {peak_hours[-1]+1:02d}:00 for guaranteed availability."
        ),
    }


# ── Historical occupancy from Firestore bookings ──────────────────────────────

def get_historical_occupancy(parking_area_id: str, days: int = 30) -> dict:
    """
    Builds hourly occupancy averages from real booking data.
    Used to calibrate forecasts and feed into LSTM in Phase 2.
    """
    db        = get_db()
    end_date  = datetime.utcnow()
    start_date= end_date - timedelta(days=days)

    hourly_totals = defaultdict(int)
    hourly_counts = defaultdict(int)
    daily_data    = defaultdict(list)

    for d in range(days):
        day_str = (start_date + timedelta(days=d)).strftime("%Y-%m-%d")
        bookings = list(
            db.collection("bookings")
            .where("parkingAreaId", "==", parking_area_id)
            .where("bookingDate",   "==", day_str)
            .stream()
        )

        for b in bookings:
            bd = b.to_dict()
            if bd.get("bookingStatus") not in ("active", "completed", "overtime"):
                continue
            try:
                sh = int(bd["startTime"].split(":")[0])
                eh = int(bd["endTime"].split(":")[0])
                for h in range(sh, min(eh + 1, 24)):
                    hourly_totals[h] += 1
                    hourly_counts[h] += 1
            except Exception:
                pass

    # Average occupancy per hour across all days
    total_slots = _get_total_slots(parking_area_id)
    hourly_avg  = {
        h: round(hourly_totals[h] / max(days, 1) / max(total_slots, 1) * 100)
        for h in range(24)
    }

    return {
        "parkingAreaId": parking_area_id,
        "days":          days,
        "hourlyAverage": [hourly_avg.get(h, 0) for h in range(24)],
        "totalSlots":    total_slots,
    }


def _get_total_slots(parking_area_id: str) -> int:
    try:
        db   = get_db()
        snap = db.collection("parking_areas").document(parking_area_id).get()
        return snap.to_dict().get("totalSlots", 50) if snap.exists else 50
    except Exception:
        return 50


# ── LLM Parking Assistant (Phase 3 placeholder) ───────────────────────────────

PARKING_CONTEXT = """
You are ParkSmart AI, an intelligent parking assistant.
You help users find parking slots, understand pricing, navigate to their slot,
and manage their bookings. You have access to real-time slot availability.

Pricing:
- Standard slot: ₹30/hour
- VIP slot: ₹60/hour
- EV charging slot: ₹40/hour + ₹5/unit electricity
- Overtime penalty: ₹50 (15-30 min), ₹100 (30-60 min), ₹200 (60+ min)

Always be helpful, concise, and direct. Respond in the user's language.
"""

RULE_BASED_RESPONSES = {
    "ev":        "EV charging slots are available on Floor 1, Zone B. Slots B1–B6 support fast charging (30A). Rate: ₹40/hour + electricity.",
    "electric":  "EV charging slots are available on Floor 1, Zone B. Slots B1–B6 support fast charging (30A). Rate: ₹40/hour + electricity.",
    "vip":       "VIP slots are on Floor 2, Zone A. They include covered parking, CCTV, and priority access. Rate: ₹60/hour.",
    "available": "Current availability varies by area. Check the live map for green slots. Most areas have 40-60% availability during off-peak hours.",
    "price":     "Standard: ₹30/hr | VIP: ₹60/hr | EV: ₹40/hr. Overtime: ₹50–₹200 penalty. No hidden charges.",
    "cost":      "Standard: ₹30/hr | VIP: ₹60/hr | EV: ₹40/hr. Overtime: ₹50–₹200 penalty. No hidden charges.",
    "rate":      "Standard: ₹30/hr | VIP: ₹60/hr | EV: ₹40/hr. Overtime: ₹50–₹200 penalty.",
    "penalty":   "Overtime penalties: 0-15 min → free grace period | 15-30 min → ₹50 | 30-60 min → ₹100 | 60+ min → ₹200.",
    "cancel":    "You can cancel an active booking from 'My Bookings' tab. Full refund if cancelled 30+ minutes before start time.",
    "extend":    "You can extend your booking from 'My Bookings' tab. Extension is subject to availability of next time slot.",
    "navigate":  "After QR scan, follow the in-app navigation: Floor → Zone → Slot. Arrows and floor indicators guide you.",
    "qr":        "Your QR ticket is in 'My Bookings'. Show it at the entry gate scanner. It's valid only during your booked time window.",
    "disabled":  "Accessible (disabled) parking slots are near entry points on every floor. They are wider slots with ramp access.",
}


def get_ai_response(user_message: str, context: dict = None) -> str:
    """
    Phase 1: Keyword-matching rule-based responses.
    Phase 3: Replace with LLM API call (OpenAI/Anthropic).
    """
    text_lower = user_message.lower()

    for keyword, response in RULE_BASED_RESPONSES.items():
        if keyword in text_lower:
            return response

    # Default response
    return (
        "I can help you with: finding available slots, EV charging locations, "
        "parking rates, overtime penalties, booking cancellation, or navigation. "
        "What do you need help with?"
    )


# ── Demand prediction helpers (Phase 2 inputs) ───────────────────────────────

def predict_demand_score(parking_area_id: str, target_hour: int, day_of_week: int) -> float:
    """
    Phase 1: Heuristic demand score (0.0–1.0).
    Phase 2: Replace return with LSTM model inference.
    """
    # Weekend boost
    weekend_factor = 1.2 if day_of_week >= 5 else 1.0
    # Hour-of-day pattern (0-23)
    hour_factors = {
        8: 0.85, 9: 0.90, 10: 0.80, 11: 0.75,
        12: 0.82, 13: 0.78, 14: 0.65, 15: 0.60,
        16: 0.70, 17: 0.88, 18: 0.92, 19: 0.85,
        20: 0.70, 21: 0.55,
    }
    base = hour_factors.get(target_hour, 0.30)
    return min(1.0, base * weekend_factor)
