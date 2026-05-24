# backend/core/auth_dependency.py
"""
FastAPI dependency that verifies Firebase ID tokens on protected routes.
Usage: add `user = Depends(get_current_user)` to any route.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from firebase_admin import auth as fb_auth
from .firebase_admin import get_firebase_app

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """Verifies Firebase JWT and returns decoded token payload."""
    get_firebase_app()
    token = credentials.credentials
    try:
        decoded = fb_auth.verify_id_token(token)
        return decoded
    except fb_auth.ExpiredIdTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except fb_auth.InvalidIdTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    """Extends get_current_user to also assert admin role claim."""
    role = user.get("role") or user.get("custom_claims", {}).get("role")
    if role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user
