# backend/core/middleware.py
"""
Custom FastAPI middleware:
  - Request/response logging (method, path, status, duration)
  - Global exception handler
"""

import time
import traceback
from fastapi import Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware


class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start    = time.time()
        response = await call_next(request)
        duration = round((time.time() - start) * 1000, 1)
        print(f"  [{request.method:6s}] {request.url.path:<40s} "
              f"→ {response.status_code}  ({duration}ms)")
        return response


async def global_exception_handler(request: Request, exc: Exception):
    traceback.print_exc()
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error", "error": str(exc)},
    )
