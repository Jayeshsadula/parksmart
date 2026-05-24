# backend/api/services/notification_service.py
"""
Notification Service — ParkSmart AI
Phase 1: Console logging + in-app notification records in Firestore.
Phase 2: Email via SendGrid, SMS via Twilio, WhatsApp via 360dialog.
Phase 3: Firebase Cloud Messaging (FCM) push notifications.
"""

from datetime import datetime
from core.firebase_admin import get_db
from google.cloud import firestore as fs
import uuid


# ── Notification types ────────────────────────────────────────────────────────
NOTIF_BOOKING_CONFIRMED  = "booking_confirmed"
NOTIF_BOOKING_CANCELLED  = "booking_cancelled"
NOTIF_OVERTIME_WARNING   = "overtime_warning"
NOTIF_OVERTIME_PENALTY   = "overtime_penalty"
NOTIF_SLOT_REASSIGNED    = "slot_reassigned"
NOTIF_BOOKING_DELAYED    = "booking_delayed"
NOTIF_QR_VERIFIED        = "qr_verified"


def _save_notification(user_id: str, notif_type: str, title: str, body: str, data: dict = None):
    """Persists notification to Firestore notifications/{uid}/messages/{id}."""
    try:
        db  = get_db()
        nid = str(uuid.uuid4())[:8].upper()
        db.collection("notifications").document(user_id)\
          .collection("messages").document(nid).set({
              "notifId":   nid,
              "userId":    user_id,
              "type":      notif_type,
              "title":     title,
              "body":      body,
              "data":      data or {},
              "read":      False,
              "createdAt": fs.SERVER_TIMESTAMP,
          })
    except Exception as e:
        print(f"[Notification] Failed to save: {e}")


def notify_booking_confirmed(user_id: str, booking: dict):
    title = "✅ Booking Confirmed!"
    body  = (f"Slot {booking.get('slotLabel')} at {booking.get('parkingAreaName')} "
             f"on {booking.get('bookingDate')} from {booking.get('startTime')} "
             f"to {booking.get('endTime')}. Your QR ticket is ready.")
    print(f"[Notification→{user_id}] {title}: {body}")
    _save_notification(user_id, NOTIF_BOOKING_CONFIRMED, title, body, booking)
    # Phase 2: _send_email(user_id, title, body)
    # Phase 2: _send_sms(user_id, body)
    # Phase 3: _send_fcm(user_id, title, body)


def notify_overtime_warning(user_id: str, booking: dict, overtime_mins: int):
    title = "⚠️ Overtime Alert!"
    body  = (f"Your parking at Slot {booking.get('slotLabel')} "
             f"({booking.get('parkingAreaName')}) expired {overtime_mins} min ago. "
             f"Please vacate immediately to avoid penalty charges.")
    print(f"[Notification→{user_id}] {title}: {body}")
    _save_notification(user_id, NOTIF_OVERTIME_WARNING, title, body,
                       {"bookingId": booking.get("bookingId"), "overtimeMins": overtime_mins})


def notify_penalty_applied(user_id: str, booking: dict, penalty_amount: int, overtime_mins: int):
    title = "💸 Penalty Applied"
    body  = (f"Overtime penalty of ₹{penalty_amount} applied for {overtime_mins} min "
             f"overstay at Slot {booking.get('slotLabel')}. "
             f"Please settle via the app to avoid further charges.")
    print(f"[Notification→{user_id}] {title}: {body}")
    _save_notification(user_id, NOTIF_OVERTIME_PENALTY, title, body,
                       {"bookingId": booking.get("bookingId"), "penaltyAmount": penalty_amount})


def notify_slot_reassigned(user_id: str, old_slot: str, new_slot: str, new_zone: str):
    title = "🔄 Slot Reassigned"
    body  = (f"Your original slot {old_slot} was affected by an overstay. "
             f"You have been automatically reassigned to Slot {new_slot} ({new_zone}). "
             f"A new QR ticket has been issued.")
    print(f"[Notification→{user_id}] {title}: {body}")
    _save_notification(user_id, NOTIF_SLOT_REASSIGNED, title, body,
                       {"oldSlot": old_slot, "newSlot": new_slot, "newZone": new_zone})


def notify_booking_delayed(user_id: str, booking: dict):
    title = "⏳ Booking Delayed"
    body  = (f"Unfortunately your slot {booking.get('slotLabel')} is still occupied "
             f"by a previous vehicle. We are working to resolve this. "
             f"You will be notified as soon as your slot is available. "
             f"A refund/compensation has been initiated.")
    print(f"[Notification→{user_id}] {title}: {body}")
    _save_notification(user_id, NOTIF_BOOKING_DELAYED, title, body,
                       {"bookingId": booking.get("bookingId")})


def notify_booking_cancelled(user_id: str, booking: dict):
    title = "❌ Booking Cancelled"
    body  = (f"Your booking for Slot {booking.get('slotLabel')} at "
             f"{booking.get('parkingAreaName')} on {booking.get('bookingDate')} "
             f"has been cancelled.")
    print(f"[Notification→{user_id}] {title}: {body}")
    _save_notification(user_id, NOTIF_BOOKING_CANCELLED, title, body, booking)


def notify_qr_verified(user_id: str, booking: dict):
    title = "🅿 Welcome! Gate Opening"
    body  = (f"QR verified. Proceed to {booking.get('floorName')}, "
             f"{booking.get('zone')}, Slot {booking.get('slotLabel')}. "
             f"Have a safe parking experience!")
    print(f"[Notification→{user_id}] {title}: {body}")
    _save_notification(user_id, NOTIF_QR_VERIFIED, title, body, booking)


def get_user_notifications(user_id: str, limit: int = 20) -> list:
    """Fetches latest notifications for a user."""
    try:
        db   = get_db()
        docs = (db.collection("notifications").document(user_id)
                  .collection("messages")
                  .order_by("createdAt", direction=fs.Query.DESCENDING)
                  .limit(limit)
                  .stream())
        return [d.to_dict() for d in docs]
    except Exception:
        return []


def mark_notification_read(user_id: str, notif_id: str):
    try:
        db = get_db()
        (db.collection("notifications").document(user_id)
           .collection("messages").document(notif_id)
           .update({"read": True}))
    except Exception as e:
        print(f"[Notification] Failed to mark read: {e}")
