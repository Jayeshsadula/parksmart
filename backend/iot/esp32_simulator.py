# backend/iot/esp32_simulator.py
"""
ESP32 IoT Simulator — ParkSmart AI
Phase 1: Software simulation of IR/ultrasonic sensor readings.
Phase 2: Replace with actual ESP32 firmware + MQTT/HTTP bridge.

Usage:
  python -m iot.esp32_simulator --area_id PA001 --interval 10

This script:
  1. Fetches all slots for a parking area
  2. Randomly toggles slot statuses (simulating vehicles entering/leaving)
  3. POSTs status updates to /api/slots/iot/update
  4. Runs on configurable interval
"""

import asyncio
import random
import httpx
import argparse
from datetime import datetime


API_BASE    = "http://localhost:8000"
SLOT_STATES = ["vacant", "occupied"]


async def simulate_sensor_reading(
    slot_id: str,
    sensor_id: str,
    client: httpx.AsyncClient,
) -> dict:
    """Simulate a single IR sensor reading for one slot."""
    # 30% chance of state change per cycle
    new_status = random.choices(
        SLOT_STATES,
        weights=[0.55, 0.45],   # slight bias toward occupied (realistic parking)
        k=1
    )[0]

    payload = {
        "slotId":    slot_id,
        "status":    new_status,
        "sensorId":  sensor_id,
        "timestamp": datetime.utcnow().isoformat(),
    }

    try:
        resp = await client.post(
            f"{API_BASE}/api/slots/iot/update",
            json=payload,
            timeout=5.0,
        )
        if resp.status_code == 200:
            print(f"[IoT] Slot {slot_id} → {new_status}")
            return {"ok": True, "slot": slot_id, "status": new_status}
        else:
            print(f"[IoT] Error for slot {slot_id}: {resp.text}")
            return {"ok": False, "slot": slot_id, "error": resp.text}
    except Exception as e:
        print(f"[IoT] Connection error: {e}")
        return {"ok": False, "error": str(e)}


async def run_simulation(area_id: str, interval: int, num_slots: int):
    """
    Main simulation loop.
    In Phase 2, replace slot_ids with real slot IDs fetched from Firestore.
    """
    print(f"[IoT Simulator] Starting for area {area_id}")
    print(f"[IoT Simulator] Simulating {num_slots} slots every {interval}s")
    print(f"[IoT Simulator] API endpoint: {API_BASE}")
    print("-" * 50)

    # Simulate slot IDs (Phase 2: fetch real IDs from /api/parking-areas/{id}/floors)
    slot_ids = [f"SLOT_{area_id}_{i:03d}" for i in range(1, num_slots + 1)]

    async with httpx.AsyncClient() as client:
        cycle = 0
        while True:
            cycle += 1
            print(f"\n[IoT Simulator] Cycle {cycle} — {datetime.now().strftime('%H:%M:%S')}")

            # Randomly pick 20-40% of slots to update per cycle (realistic sensor activity)
            slots_to_update = random.sample(
                slot_ids,
                k=max(1, int(len(slot_ids) * random.uniform(0.2, 0.4)))
            )

            tasks = [
                simulate_sensor_reading(sid, f"IR_{sid}", client)
                for sid in slots_to_update
            ]
            results = await asyncio.gather(*tasks)
            success = sum(1 for r in results if r.get("ok"))
            print(f"[IoT Simulator] Updated {success}/{len(results)} slots")

            await asyncio.sleep(interval)


# ── ESP32 Arduino Firmware Reference (for documentation) ─────────────────────
ESP32_FIRMWARE_REFERENCE = """
/*
  ParkSmart AI — ESP32 Slot Sensor Firmware (Phase 2)
  
  Hardware:
    - ESP32 DevKit
    - HC-SR04 Ultrasonic sensor per slot (or IR sensor)
    - WiFi connection to parking LAN
  
  Flow:
    1. Measure distance via HC-SR04
    2. If distance < THRESHOLD_CM → slot OCCUPIED
    3. If distance > THRESHOLD_CM → slot VACANT
    4. POST to ParkSmart API every INTERVAL_MS
    5. Deep sleep between readings to save power

  Code sketch:
  
  #include <WiFi.h>
  #include <HTTPClient.h>
  #include <ArduinoJson.h>
  
  const char* ssid      = "PARKING_WIFI";
  const char* password  = "wifi_password";
  const char* apiUrl    = "https://api.parksmart.ai/api/slots/iot/update";
  const char* slotId    = "SLOT_PA001_001";
  const char* sensorId  = "IR_PA001_001";
  const int   TRIG_PIN  = 5;
  const int   ECHO_PIN  = 18;
  const int   THRESHOLD = 30; // cm
  
  void setup() {
    Serial.begin(115200);
    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED) delay(500);
    pinMode(TRIG_PIN, OUTPUT);
    pinMode(ECHO_PIN, INPUT);
  }
  
  float measureDistance() {
    digitalWrite(TRIG_PIN, LOW); delayMicroseconds(2);
    digitalWrite(TRIG_PIN, HIGH); delayMicroseconds(10);
    digitalWrite(TRIG_PIN, LOW);
    long duration = pulseIn(ECHO_PIN, HIGH);
    return duration * 0.034 / 2;
  }
  
  void loop() {
    float dist   = measureDistance();
    String status = (dist < THRESHOLD) ? "occupied" : "vacant";
    
    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http;
      http.begin(apiUrl);
      http.addHeader("Content-Type", "application/json");
      
      StaticJsonDocument<200> doc;
      doc["slotId"]    = slotId;
      doc["status"]    = status;
      doc["sensorId"]  = sensorId;
      doc["timestamp"] = String(millis());
      
      String payload;
      serializeJson(doc, payload);
      int code = http.POST(payload);
      http.end();
    }
    delay(5000); // 5 second interval
  }
*/
"""


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ParkSmart AI IoT Simulator")
    parser.add_argument("--area_id",  default="PA001", help="Parking area ID")
    parser.add_argument("--interval", type=int, default=10, help="Scan interval (seconds)")
    parser.add_argument("--slots",    type=int, default=20, help="Number of slots to simulate")
    args = parser.parse_args()

    asyncio.run(run_simulation(args.area_id, args.interval, args.slots))
