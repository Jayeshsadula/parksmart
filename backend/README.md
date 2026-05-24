# ParkSmart AI — FastAPI Backend

## Quick Start

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate    # Mac/Linux

pip install -r requirements.txt
cp .env.example .env           # fill in Firebase credentials
uvicorn main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

## Firebase Setup

1. Download `serviceAccountKey.json` from Firebase Console
   → Project Settings → Service Accounts → Generate New Private Key
2. Place it in the `backend/` folder
3. Set `FIREBASE_SERVICE_ACCOUNT_PATH=serviceAccountKey.json` in `.env`

## Project Structure

```
backend/
├── main.py                         ← FastAPI app + router registration
├── requirements.txt
├── .env.example
├── firestore.rules                 ← Deploy to Firebase
├── core/
│   ├── config.py                   ← Settings from .env
│   ├── firebase_admin.py           ← Firebase SDK init
│   ├── auth_dependency.py          ← JWT verification dependency
│   └── middleware.py               ← Logging + error handling
├── api/
│   ├── models/schemas.py           ← All Pydantic request/response models
│   ├── routes/
│   │   ├── auth.py                 ← User/admin profile management
│   │   ├── parking_areas.py        ← Areas, floors, slots CRUD
│   │   ├── bookings.py             ← Atomic booking engine + QR verify
│   │   ├── slots.py                ← Slot status + IoT webhook
│   │   ├── penalties.py            ← Overtime scan + penalty management
│   │   ├── analytics.py            ← Revenue, occupancy, trends
│   │   └── ai_forecast.py          ← LSTM forecast + LLM chat
│   └── services/
│       ├── booking_service.py      ← Core booking business logic
│       ├── overtime_scheduler.py   ← Background overtime scanner
│       ├── notification_service.py ← In-app + email/SMS notifications
│       └── ai_service.py           ← Forecast + AI assistant logic
├── ai/
│   └── lstm_model.py               ← LSTM architecture + training (Phase 2)
└── iot/
    ├── esp32_simulator.py          ← Software IoT sensor simulation
    └── gate_controller.py          ← Gate open/close control (sim + MQTT)
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | /                              | Health check |
| POST | /api/auth/user/profile         | Create user profile |
| POST | /api/auth/admin/profile        | Create admin profile |
| GET  | /api/auth/me                   | Get current user profile |
| GET  | /api/parking-areas/            | List all parking areas |
| POST | /api/parking-areas/            | Create parking area (admin) |
| POST | /api/parking-areas/floors/create | Create floor |
| POST | /api/parking-areas/slots/bulk-create | Bulk create slots |
| POST | /api/bookings/create           | Create booking (atomic) |
| GET  | /api/bookings/my               | Get my bookings |
| POST | /api/bookings/verify-qr/{id}   | Verify QR code |
| POST | /api/bookings/extend           | Extend booking |
| GET  | /api/slots/floor/{id}          | Get slots by floor |
| PATCH| /api/slots/{id}/status         | Update slot status (admin) |
| POST | /api/slots/iot/update          | IoT sensor webhook (ESP32) |
| POST | /api/penalties/scan-overtime   | Run overtime scan (admin/cron) |
| GET  | /api/penalties/pending         | Get pending penalties |
| GET  | /api/analytics/summary         | Dashboard metrics |
| GET  | /api/analytics/hourly-occupancy | 24h occupancy chart |
| GET  | /api/analytics/weekly-trend    | 7-day booking trend |
| GET  | /api/ai/forecast/{area_id}     | LSTM occupancy forecast |
| POST | /api/ai/chat                   | AI parking assistant |
