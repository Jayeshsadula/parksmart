# backend/api/routes/ai_forecast.py
"""
AI Module — ParkSmart AI
Phase 1: Placeholder endpoints returning mock predictions.
Phase 2: LSTM model trained on historical Firestore booking data.
Phase 3: LLM-based natural language parking assistant.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List
from core.auth_dependency import get_current_user

router = APIRouter()


class ForecastResponse(BaseModel):
    parkingAreaId: str
    date:          str
    hourlyOccupancy: List[int]   # 24 values, one per hour
    peakHours:     List[int]
    recommendation: str


# ── Occupancy Forecast (LSTM placeholder) ─────────────────────────────────────
@router.get("/forecast/{parking_area_id}")
async def get_forecast(
    parking_area_id: str,
    date: str = None,
    user: dict = Depends(get_current_user),
):
    """
    Returns hourly occupancy forecast for a parking area.

    PHASE 1 (current): Returns mock sinusoidal occupancy pattern.

    PHASE 2 (planned):
      1. Query Firestore for last 90 days of booking data for this area.
      2. Engineer features: hour_of_day, day_of_week, is_holiday, weather_code.
      3. Run inference via trained LSTM model (TensorFlow/Keras).
      4. Return 24-hour occupancy % predictions.

    LSTM Architecture (planned):
      Input shape: (sequence_len=7, features=4)  — 7 days of hourly data
      Layers:
        LSTM(64, return_sequences=True)
        Dropout(0.2)
        LSTM(32)
        Dropout(0.2)
        Dense(24, activation='sigmoid')  — 24 hourly outputs
      Loss: MSE | Optimizer: Adam | Trained on 90-day rolling window
    """
    from datetime import date as dt
    import math

    target_date = date or dt.today().isoformat()

    # Mock sinusoidal occupancy — realistic day pattern
    hourly = [
        int(15 + 70 * max(0, math.sin((h - 6) * math.pi / 14)))
        for h in range(24)
    ]
    peak_hours = [h for h, v in enumerate(hourly) if v > 75]

    return ForecastResponse(
        parkingAreaId=parking_area_id,
        date=target_date,
        hourlyOccupancy=hourly,
        peakHours=peak_hours,
        recommendation=(
            f"Expected peak occupancy {max(hourly)}% at hour {hourly.index(max(hourly))}:00. "
            "Book before 4 PM for best availability."
        ),
    )


# ── LLM Parking Assistant (placeholder) ───────────────────────────────────────
@router.post("/chat")
async def parking_chat(
    message: dict,
    user: dict = Depends(get_current_user),
):
    """
    Natural language parking assistant.

    PHASE 1 (current): Rule-based keyword responses.

    PHASE 3 (planned):
      - Integrate OpenAI GPT-4o or Anthropic Claude API.
      - System prompt: parking domain expert with access to live slot data.
      - Tools: search_slots(), get_availability(), create_booking().
      - Supports: "Find me an EV slot near Terminal 2 after 3 PM"
    """
    text = message.get("text", "").lower()

    # Simple rule-based responses for Phase 1
    if "ev" in text or "electric" in text:
        reply = "EV charging slots are available on Floor 1, Zone B. Slots B1–B6 support fast charging."
    elif "vip" in text:
        reply = "VIP slots are on Floor 2, Zone A. They include covered parking and priority access."
    elif "available" in text or "free" in text:
        reply = "Currently 38 slots are available across all floors. Floor 1 has the most availability."
    elif "price" in text or "cost" in text or "rate" in text:
        reply = "Standard rate: ₹30/hour. VIP: ₹60/hour. EV charging included. Overtime: ₹50–₹200 penalty."
    else:
        reply = "I can help you find available slots, check EV charging, or answer questions about rates and booking. What do you need?"

    return {"reply": reply, "source": "rule_based_phase1"}
