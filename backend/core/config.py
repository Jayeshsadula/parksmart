# backend/core/config.py
"""
Centralised app configuration loaded from environment variables.
Uses python-dotenv to load .env file in development.
"""

import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    APP_ENV: str                = os.getenv("APP_ENV", "development")
    CORS_ORIGIN: str            = os.getenv("CORS_ORIGIN", "http://localhost:3000")
    FIREBASE_SA_PATH: str       = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "serviceAccountKey.json")
    FIREBASE_SA_JSON: str       = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "")
    OVERTIME_SCAN_INTERVAL: int = int(os.getenv("OVERTIME_SCAN_INTERVAL", "300"))

    # Penalty policy (INR, configurable without code changes)
    BUFFER_MINS: int    = int(os.getenv("BUFFER_MINS",    "15"))
    PENALTY_LOW: int    = int(os.getenv("PENALTY_LOW",    "50"))
    PENALTY_MEDIUM: int = int(os.getenv("PENALTY_MEDIUM", "100"))
    PENALTY_HIGH: int   = int(os.getenv("PENALTY_HIGH",   "200"))

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"


settings = Settings()
