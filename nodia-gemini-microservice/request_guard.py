"""Authenticate and admit bounded uploads before Starlette parses multipart."""

import asyncio
import tempfile
import time
from uuid import uuid4

from loguru import logger
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from schemas import RuntimeLimits
from service_auth import authenticate_service_request
from service_errors import ServiceError

ANALYSIS_PATHS = {"/analyze-invoice", "/agentic/analyze-invoice", "/web/analyze-invoice"}


class PrivateRequestGuard:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        started = time.monotonic()
        request_id = uuid4().hex
        scope.setdefault("state", {})["request_id"] = request_id
        response_status = 500
        response_started = False

        async def traced_send(message: dict) -> None:
            nonlocal response_status, response_started
            if message["type"] == "http.response.start":
                response_started = True
                response_status = message["status"]
                message.setdefault("headers", []).append((b"x-request-id", request_id.encode()))
                if scope["path"].startswith("/agentic/auth/login"):
                    message["headers"].append((b"cache-control", b"no-store"))
            await send(message)

        async def reject(code: str, message: str, status: int, retry_after: str | None = None) -> None:
            scope["state"]["error_code"] = code
            headers = {"Retry-After": retry_after} if retry_after else None
            await JSONResponse({"code": code, "detail": message, "request_id": request_id},
                               status_code=status, headers=headers)(scope, receive, traced_send)

        acquired = False
        observation_id = None
        observations = None
        slots = None
        try:
            request = Request(scope)
            rejection = authenticate_service_request(request)
            if rejection is not None:
                await rejection(scope, receive, traced_send)
                return
            if scope["path"].startswith("/agentic/auth/login/") and scope["method"] == "POST":
                # OAuth codes are tiny private commands, never unbounded JSON.
                payload = bytearray()
                try:
                    async with asyncio.timeout(5):
                        while True:
                            message = await receive()
                            if message["type"] == "http.disconnect":
                                response_status = 499
                                return
                            chunk = message.get("body", b"")
                            if len(payload) + len(chunk) > 8192:
                                await reject("body_too_large", "La solicitud de login supera el tamaño permitido.", 413)
                                return
                            payload.extend(chunk)
                            if not message.get("more_body", False):
                                break
                except TimeoutError:
                    await reject("upload_timeout", "Tiempo de carga del login agotado.", 408)
                    return

                async def login_receive() -> dict:
                    return {"type": "http.request", "body": bytes(payload), "more_body": False}

                await self.app(scope, login_receive, traced_send)
                return
            if scope["path"] not in ANALYSIS_PATHS or scope["method"] != "POST":
                await self.app(scope, receive, traced_send)
                return
            state = scope["app"].state
            identifier = request.headers.get("x-nodia-analysis-id")
            if identifier:
                observations = state.observations
                observations.claim(identifier)
                observation_id = identifier
                scope["state"]["analysis_id"] = identifier
            limits: RuntimeLimits = state.limits
            slots = state.analysis_slots
            length = request.headers.get("content-length")
            if length and (not length.isdecimal() or int(length) > limits.body_bytes):
                await reject("body_too_large", "La solicitud supera el tamaño permitido.", 413)
                return
            try:
                await asyncio.wait_for(slots.acquire(), limits.admission_timeout)
                acquired = True
            except TimeoutError:
                await reject("service_busy", "El servicio está ocupado. Reintente más tarde.", 429, "5")
                return

            # A bounded spool is closed even on disconnect, timeout or cancellation.
            # Multipart cannot allocate files until the complete body passes this limit.
            with tempfile.SpooledTemporaryFile(max_size=1024 * 1024) as body:
                size = 0
                try:
                    async with asyncio.timeout(limits.upload_timeout):
                        while True:
                            message = await receive()
                            if message["type"] == "http.disconnect":
                                response_status = 499
                                scope["state"]["error_code"] = "client_disconnected"
                                return
                            chunk = message.get("body", b"")
                            size += len(chunk)
                            if size > limits.body_bytes:
                                await reject("body_too_large", "La solicitud supera el tamaño permitido.", 413)
                                return
                            body.write(chunk)
                            if not message.get("more_body", False):
                                break
                except TimeoutError:
                    await reject("upload_timeout", "Tiempo de carga agotado.", 408)
                    return
                body.seek(0)
                delivered = 0

                async def bounded_receive() -> dict:
                    nonlocal delivered
                    if delivered >= size:
                        return {"type": "http.request", "body": b"", "more_body": False}
                    chunk = body.read(64 * 1024)
                    delivered += len(chunk)
                    return {"type": "http.request", "body": chunk, "more_body": delivered < size}

                async def watch_disconnect() -> None:
                    while True:
                        message = await receive()
                        if message["type"] == "http.disconnect":
                            return

                processing = asyncio.create_task(self.app(scope, bounded_receive, traced_send))
                disconnect = asyncio.create_task(watch_disconnect())
                try:
                    done, _ = await asyncio.wait((processing, disconnect), return_when=asyncio.FIRST_COMPLETED)
                    if processing in done:
                        await processing
                    else:
                        processing.cancel()
                        try:
                            await processing
                        except asyncio.CancelledError:
                            pass
                        response_status = 499
                        scope["state"]["error_code"] = "client_disconnected"
                finally:
                    for task in (processing, disconnect):
                        if not task.done():
                            task.cancel()
                    await asyncio.gather(processing, disconnect, return_exceptions=True)
        except ServiceError as error:
            await reject(error.code, error.message, error.status)
        except Exception as error:
            if response_started:
                raise
            logger.error("request={} error_type={}", request_id, type(error).__name__)
            await reject("internal_error", "No se pudo completar la solicitud.", 500)
        finally:
            if observations and observation_id:
                observations.finish(observation_id, "cancelled" if response_status == 499 else "succeeded" if response_status < 400 else "failed")
            if acquired and slots is not None:
                slots.release()
            logger.info("request={} route={} engine={} status={} error={} duration_ms={:.0f}",
                        request_id, scope["path"] if scope["path"] in ANALYSIS_PATHS else "internal",
                        scope["state"].get("engine", "none"), response_status,
                        scope["state"].get("error_code", "none"), (time.monotonic() - started) * 1000)
