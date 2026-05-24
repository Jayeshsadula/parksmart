# backend/api/routes/auth.py
"""
Auth routes — admin/user profile creation after Firebase signup.
Firebase Authentication handles the actual signup/login on the frontend.
Backend only handles Firestore profile writes and role management.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from typing import Optional
from core.firebase_admin import get_db, get_auth
from core.auth_dependency import get_current_user, require_admin
from google.cloud import firestore as fs

router = APIRouter()


# ── Pydantic Models ───────────────────────────────────────────────────────────

class UserProfileCreate(BaseModel):
    name:          str
    email:         EmailStr
    phone:         str
    vehicleNumber: str

class AdminProfileCreate(BaseModel):
    ownerName:    str
    businessName: str
    email:        EmailStr
    location:     str
    capacity:     int

class RoleAssign(BaseModel):
    uid:  str
    role: str  # "user" | "admin"


# ── Create User Profile ───────────────────────────────────────────────────────

@router.post("/user/profile", status_code=status.HTTP_201_CREATED)
async def create_user_profile(
    body: UserProfileCreate,
    user: dict = Depends(get_current_user),
):
    """
    Called after Firebase signup on the frontend.
    Writes user profile to Firestore users/{uid}.
    """
    db = get_db()
    ref = db.collection("users").document(user["uid"])

    if ref.get().exists:
        raise HTTPException(status_code=409, detail="User profile already exists")

    ref.set({
        "uid":           user["uid"],
        "name":          body.name,
        "email":         body.email,
        "phone":         body.phone,
        "vehicleNumber": body.vehicleNumber,
        "role":          "user",
        "createdAt":     fs.SERVER_TIMESTAMP,
    })

    # Set custom claim for role-based access
    get_auth().set_custom_user_claims(user["uid"], {"role": "user"})

    return {"uid": user["uid"], "role": "user", "message": "User profile created"}


# ── Create Admin Profile ──────────────────────────────────────────────────────

@router.post("/admin/profile", status_code=status.HTTP_201_CREATED)
async def create_admin_profile(
    body: AdminProfileCreate,
    user: dict = Depends(get_current_user),
):
    """
    Called after Firebase admin signup on the frontend.
    Writes admin profile to Firestore admins/{uid}.
    """
    db = get_db()
    ref = db.collection("admins").document(user["uid"])

    if ref.get().exists:
        raise HTTPException(status_code=409, detail="Admin profile already exists")

    ref.set({
        "uid":          user["uid"],
        "ownerName":    body.ownerName,
        "businessName": body.businessName,
        "email":        body.email,
        "location":     body.location,
        "capacity":     body.capacity,
        "role":         "admin",
        "createdAt":    fs.SERVER_TIMESTAMP,
    })

    # Set custom claim for role-based access
    get_auth().set_custom_user_claims(user["uid"], {"role": "admin"})

    return {"uid": user["uid"], "role": "admin", "message": "Admin profile created"}


# ── Get Current User Profile ──────────────────────────────────────────────────

@router.get("/me")
async def get_my_profile(user: dict = Depends(get_current_user)):
    """Returns Firestore profile for the authenticated user."""
    db  = get_db()
    uid = user["uid"]

    # Try admin first
    admin_snap = db.collection("admins").document(uid).get()
    if admin_snap.exists:
        return {"role": "admin", **admin_snap.to_dict()}

    # Then user
    user_snap = db.collection("users").document(uid).get()
    if user_snap.exists:
        return {"role": "user", **user_snap.to_dict()}

    raise HTTPException(status_code=404, detail="Profile not found")


# ── Update User Profile ───────────────────────────────────────────────────────

@router.patch("/user/profile")
async def update_user_profile(
    updates: dict,
    user: dict = Depends(get_current_user),
):
    """Partial update of user profile fields."""
    allowed = {"name", "phone", "vehicleNumber"}
    filtered = {k: v for k, v in updates.items() if k in allowed}
    if not filtered:
        raise HTTPException(400, "No valid fields to update")

    db = get_db()
    db.collection("users").document(user["uid"]).update(filtered)
    return {"updated": filtered}


# ── Admin: List All Users ─────────────────────────────────────────────────────

@router.get("/admin/users")
async def list_all_users(admin: dict = Depends(require_admin)):
    """Returns all registered users. Admin only."""
    db   = get_db()
    docs = db.collection("users").stream()
    return [d.to_dict() for d in docs]


# ── Admin: Assign Role ────────────────────────────────────────────────────────

@router.post("/admin/assign-role")
async def assign_role(body: RoleAssign, admin: dict = Depends(require_admin)):
    """Assigns a Firebase custom claim role to a user. Admin only."""
    try:
        get_auth().set_custom_user_claims(body.uid, {"role": body.role})
        return {"uid": body.uid, "role": body.role, "message": "Role assigned"}
    except Exception as e:
        raise HTTPException(500, str(e))
