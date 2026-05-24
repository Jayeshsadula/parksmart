# backend/iot/gate_controller.py
"""
Gate Controller — ParkSmart AI
Manages entry/exit gate signals triggered by QR verification.

Phase 1: Software simulation (logs gate commands)
Phase 2: MQTT broker → ESP32 → Servo motor gate

Flow:
  QR Scanned → verifyQR() → gate_controller.open_gate(slot_id)
                           → MQTT publish → ESP32 → Servo opens
                           → 10s delay → Servo closes
"""

import asyncio
import httpx
from datetime import datetime
from enum import Enum


class GateAction(str, Enum):
    OPEN  = "open"
    CLOSE = "close"
    LOCK  = "lock"


class GateController:
    """
    Abstraction layer for physical gate control.
    Phase 1: Simulated (print logs).
    Phase 2: MQTT publisher to ESP32.
    Phase 3: Direct REST to ESP32 local server.
    """

    def __init__(self, mode: str = "simulation"):
        self.mode        = mode
        self.gate_states = {}   # slot_id → GateAction
        print(f"[GateController] Initialized in {mode} mode")

    async def open_gate(self, slot_id: str, booking_id: str) -> dict:
        """
        Opens the parking gate for a verified booking.
        Auto-closes after AUTO_CLOSE_DELAY seconds.
        """
        print(f"[Gate] OPEN  → Slot {slot_id} | Booking {booking_id} | "
              f"{datetime.now().strftime('%H:%M:%S')}")

        self.gate_states[slot_id] = GateAction.OPEN
        result = await self._send_command(slot_id, GateAction.OPEN, booking_id)

        # Auto-close after delay
        asyncio.create_task(self._auto_close(slot_id, delay=10))

        return result

    async def close_gate(self, slot_id: str) -> dict:
        print(f"[Gate] CLOSE → Slot {slot_id} | {datetime.now().strftime('%H:%M:%S')}")
        self.gate_states[slot_id] = GateAction.CLOSE
        return await self._send_command(slot_id, GateAction.CLOSE)

    async def lock_gate(self, slot_id: str, reason: str = "invalid_qr") -> dict:
        """Locks gate and triggers alarm for invalid QR attempts."""
        print(f"[Gate] LOCK  → Slot {slot_id} | Reason: {reason}")
        self.gate_states[slot_id] = GateAction.LOCK
        return await self._send_command(slot_id, GateAction.LOCK, reason=reason)

    async def _auto_close(self, slot_id: str, delay: int = 10):
        await asyncio.sleep(delay)
        if self.gate_states.get(slot_id) == GateAction.OPEN:
            await self.close_gate(slot_id)

    async def _send_command(
        self,
        slot_id: str,
        action: GateAction,
        booking_id: str = "",
        reason: str = "",
    ) -> dict:
        """
        Dispatches gate command based on current mode.
        """
        payload = {
            "slotId":    slot_id,
            "action":    action.value,
            "bookingId": booking_id,
            "reason":    reason,
            "timestamp": datetime.utcnow().isoformat(),
        }

        if self.mode == "simulation":
            return await self._simulate(payload)
        elif self.mode == "mqtt":
            return await self._send_mqtt(payload)
        elif self.mode == "rest":
            return await self._send_rest(payload)
        else:
            return {"ok": False, "error": f"Unknown mode: {self.mode}"}

    async def _simulate(self, payload: dict) -> dict:
        """Phase 1: Print simulation log."""
        action_icons = {
            "open":  "🟢 OPENED",
            "close": "🔴 CLOSED",
            "lock":  "🔒 LOCKED",
        }
        icon = action_icons.get(payload["action"], "❓")
        print(f"  [GateSim] {icon} | Slot: {payload['slotId']} | "
              f"Time: {payload['timestamp']}")
        return {"ok": True, "mode": "simulation", **payload}

    async def _send_mqtt(self, payload: dict) -> dict:
        """
        Phase 2: Publish gate command to MQTT broker.
        ESP32 subscribes to topic: parksmart/gates/{slot_id}/command

        Requires:
          pip install aiomqtt
          MQTT broker: HiveMQ, Mosquitto, or AWS IoT Core
        """
        # import aiomqtt
        # async with aiomqtt.Client("mqtt.parksmart.ai") as client:
        #     topic = f"parksmart/gates/{payload['slotId']}/command"
        #     await client.publish(topic, payload=str(payload), qos=1)
        print(f"  [MQTT] Would publish to parksmart/gates/{payload['slotId']}/command")
        return {"ok": True, "mode": "mqtt", "topic": f"parksmart/gates/{payload['slotId']}/command"}

    async def _send_rest(self, payload: dict) -> dict:
        """
        Phase 3: Direct HTTP to ESP32's local web server.
        ESP32 runs a minimal HTTP server on the parking LAN.
        """
        esp32_ip  = "192.168.1.100"   # ESP32 local IP (configurable)
        esp32_url = f"http://{esp32_ip}/gate/command"
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(esp32_url, json=payload, timeout=3.0)
                return {"ok": resp.status_code == 200, "mode": "rest", "response": resp.text}
        except Exception as e:
            return {"ok": False, "mode": "rest", "error": str(e)}

    def get_gate_status(self, slot_id: str) -> str:
        return self.gate_states.get(slot_id, GateAction.CLOSE).value


# Singleton instance used across the app
gate_controller = GateController(mode="simulation")
