# backend/core/firebase_admin.py
"""
Initialises Firebase Admin SDK.
Reads service account key from environment variable or local file.
"""

import os
import firebase_admin
from firebase_admin import credentials, firestore, auth

_app = None

def get_firebase_app():
    global _app
    if _app is not None:
        return _app

    sa_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "serviceAccountKey.json")

    if os.path.exists(sa_path):
        cred = credentials.Certificate(sa_path)
    else:
        # Support inline JSON via env variable (for cloud deployments)
        import json
        sa_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
        if not sa_json:
            raise RuntimeError("No Firebase service account credentials found.")
        cred = credentials.Certificate(json.loads(sa_json))

    _app = firebase_admin.initialize_app(cred)
    return _app


def get_db():
    get_firebase_app()
    return firestore.client()


def get_auth():
    get_firebase_app()
    return auth
