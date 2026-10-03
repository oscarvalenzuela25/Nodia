"""Private HTTP adapter. Importing this module does not load login or start clients."""

import asyncio
import json
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any
from uuid import uuid4

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from loguru import logger
from pydantic import ValidationError
from starlette.datastructures import UploadFile
from starlette.exceptions import HTTPException as StarletteHTTPException
from gemini_webapi.exceptions import AuthError

from agentic_service import AntigravityAgentService
from gemini_service import GeminiWebService
from interactive_login import InteractiveLoginManager
from request_guard import PrivateRequestGuard
from schemas import (AgenticStatusResponse, AnalysisOptions, DualEngineStatusResponse,
                     HealthResponse, InvoiceAnalysisResponse, LoginJobResponse,
                     RuntimeLimits, WebStatusResponse)
from service_auth import assert_service_auth_configured
from service_errors import InvalidExtraction, ServiceError

BASE_DIR = Path(__file__).resolve().parent


def analysis_request_body() -> dict[str, Any]:
    schema = AnalysisOptions.model_json_schema()
    schema["properties"]["file"] = {"type": "string", "format": "binary"}
    schema["properties"]["provider_fields"] = {
        "type": "string", "contentMediaType": "application/json",
        "description": "Configuración del proveedor serializada como objeto JSON.",
    }
    schema["required"].append("file")
    return {"requestBody": {"required": True, "content": {
        "multipart/form-data": {"schema": schema},
    }}}


def configured_limits() -> RuntimeLimits:
    return RuntimeLimits.model_validate({
        key: os.environ[name] for key, name in {
            "file_bytes": "MAX_INVOICE_FILE_BYTES", "analysis_slots": "ANALYSIS_SLOTS",
            "upload_timeout": "UPLOAD_TIMEOUT_SECONDS", "analysis_timeout": "ANALYSIS_TIMEOUT_SECONDS",
        }.items() if name in os.environ
    })


async def execute_analysis(file: UploadFile, options: AnalysisOptions, service: Any,
                           temp_dir: Path, limits: RuntimeLimits) -> InvoiceAnalysisResponse:
    ext = Path(file.filename or "").suffix.lower()
    if ext not in {".pdf", ".png", ".jpg", ".jpeg", ".webp"}:
        raise ServiceError("invalid_file_type", "Formato de archivo no soportado.", 415)
    temp_path = temp_dir / f"{uuid4().hex}{ext}"
    try:
        chunk = await file.read(64 * 1024)
        signatures = {
            ".pdf": chunk.startswith(b"%PDF-"), ".png": chunk.startswith(b"\x89PNG\r\n\x1a\n"),
            ".jpg": chunk.startswith(b"\xff\xd8\xff"), ".jpeg": chunk.startswith(b"\xff\xd8\xff"),
            ".webp": chunk.startswith(b"RIFF") and chunk[8:12] == b"WEBP",
        }
        if not signatures[ext]:
            raise ServiceError("invalid_file_signature", "El contenido no coincide con el formato declarado.", 415)
        temp_dir.mkdir(parents=True, exist_ok=True)
        size = 0
        with temp_path.open("xb") as output:
            while chunk:
                size += len(chunk)
                if size > limits.file_bytes:
                    raise ServiceError("file_too_large", "La factura supera el tamaño permitido.", 413)
                output.write(chunk)
                chunk = await file.read(64 * 1024)
        result = await asyncio.wait_for(service.analyze_invoice(
            file_path=temp_path, provider_fields=options.provider_fields,
            provider_tax=options.provider_tax, model=options.model,
            extended_thinking=options.extended_thinking, thinking_level=options.thinking_level,
        ), timeout=limits.analysis_timeout)
        try:
            return InvoiceAnalysisResponse.model_validate(result)
        except ValidationError:
            raise InvalidExtraction() from None
    except TimeoutError:
        raise ServiceError("analysis_timeout", "Tiempo de análisis agotado.", 504) from None
    finally:
        await file.close()
        temp_path.unlink(missing_ok=True)


def create_app(*, web_service: Any = None, agentic_service: Any = None,
               login_manager: InteractiveLoginManager | None = None,
               temp_dir: Path | None = None, limits: RuntimeLimits | None = None,
               load_environment: bool = True) -> FastAPI:
    @asynccontextmanager
    async def lifespan(application: FastAPI):
        if load_environment:
            load_dotenv(BASE_DIR / ".env")
        assert_service_auth_configured()
        state = application.state
        state.web = web_service if web_service is not None else GeminiWebService()
        state.agentic = agentic_service if agentic_service is not None else AntigravityAgentService()
        state.login = login_manager if login_manager is not None else InteractiveLoginManager()
        state.temp_dir = temp_dir if temp_dir is not None else BASE_DIR / "temp_uploads"
        state.limits = limits if limits is not None else configured_limits()
        state.analysis_slots = asyncio.Semaphore(state.limits.analysis_slots)
        try:
            try:
                await state.web.init_client()
            except Exception as error:
                logger.warning("Initial Gemini connection failed: {}", type(error).__name__)
            yield
        finally:
            try:
                await state.login.close()
            finally:
                await state.web.close()

    application = FastAPI(title="Nodia Gemini Microservice", version="1.0.0", lifespan=lifespan)
    application.add_middleware(PrivateRequestGuard)

    def error_response(request: Request, code: str, detail: str, status: int, headers=None):
        request.state.error_code = code
        return JSONResponse({"code": code, "detail": detail,
                             "request_id": getattr(request.state, "request_id", None)},
                            status_code=status, headers=headers)

    @application.exception_handler(ServiceError)
    async def service_error(request: Request, error: ServiceError):
        headers = {"Retry-After": str(error.retry_after)} if error.retry_after is not None else None
        return error_response(request, error.code, error.message, error.status, headers)

    @application.exception_handler(StarletteHTTPException)
    async def http_error(request: Request, error: StarletteHTTPException):
        # Parser messages can contain user-controlled multipart field names.
        detail = "Solicitud inválida." if error.status_code == 400 else "No se pudo completar la solicitud."
        return error_response(request, f"http_{error.status_code}", detail, error.status_code, error.headers)

    @application.exception_handler(RequestValidationError)
    async def validation_error(request: Request, error: RequestValidationError):
        return error_response(request, "invalid_request", "Parámetros inválidos.", 422)

    @application.exception_handler(Exception)
    async def unexpected_error(request: Request, error: Exception):
        logger.error("request={} error_type={}", getattr(request.state, "request_id", None), type(error).__name__)
        return error_response(request, "internal_error", "No se pudo completar la solicitud.", 500)

    @application.get("/", response_model=HealthResponse)
    @application.get("/health", response_model=HealthResponse)
    async def health_check():
        return HealthResponse(status="ok")

    @application.get("/ready", response_model=HealthResponse)
    async def ready():
        info = await application.state.web.get_status()
        if not info["initialized"]:
            raise ServiceError("session_unavailable", "La sesión Web no está disponible.")
        return HealthResponse(status="ok")

    async def web_status() -> WebStatusResponse:
        web = application.state.web
        try:
            await web.init_client()
        except Exception as error:
            logger.warning("Session check failed: {}", type(error).__name__)
        info = await web.get_status()
        quota = await web.get_quota_summary() if info["initialized"] else None
        metrics = dict(quota.get("quotas") or {}) if quota else {}
        if quota and isinstance(quota.get("usage_info"), dict):
            for window in ("current_5h", "weekly"):
                value = quota["usage_info"].get(window)
                if value is not None:
                    metrics[window] = value
        return WebStatusResponse(
            authenticated=info["initialized"], has_cookies=info["has_cookies"],
            has_browser_profile=info["has_browser_profile"], last_refresh_time=info.get("last_refresh_time"),
            tier=info.get("tier", "UNKNOWN"), model=info.get("model"), model_display=info.get("model_display"),
            quota=metrics or None,
            quota_observed_at=quota.get("observed_at") if quota else None,
        )

    @application.get("/auth/status", response_model=WebStatusResponse)
    @application.get("/web/status", response_model=WebStatusResponse)
    async def auth_status():
        return await web_status()

    @application.get("/agentic/status", response_model=AgenticStatusResponse)
    async def agentic_status():
        return AgenticStatusResponse.model_validate(await application.state.agentic.get_status())

    @application.get("/engines/status", response_model=DualEngineStatusResponse)
    async def engines_status():
        return DualEngineStatusResponse(default_engine="web", agentic=await agentic_status(), web=await web_status())

    @application.get("/agentic/models")
    async def agentic_models():
        info = await application.state.agentic.get_status()
        return {"engine": "agentic", "available": info["available"],
                "authenticated": bool(info["available"] and info["has_active_session"]),
                "models": info["models"], "reason": info.get("reason")}

    @application.get("/models")
    @application.get("/web/models")
    async def get_models():
        return await application.state.web.get_models_and_quota()

    async def run_login() -> bool:
        web = application.state.web
        result = await web.browser_manager.login_interactive(timeout_seconds=300)
        cookies = result.get("cookies", {})
        if not result.get("success") or not cookies.get("secure_1psid") or not cookies.get("secure_1psidts"):
            return False
        await web.reload_cookies(cookies["secure_1psid"], cookies["secure_1psidts"])
        return web.is_initialized

    @application.post("/auth/login/start", response_model=LoginJobResponse)
    async def start_login():
        job = application.state.login.start(run_login)
        if job is None:
            raise ServiceError("login_busy", "Ya hay un inicio de sesión en curso.", 409)
        return job

    @application.get("/auth/login/{job_id}", response_model=LoginJobResponse)
    async def login_status(job_id: str):
        job = application.state.login.status(job_id)
        if job is None:
            raise ServiceError("login_not_found", "Sesión de login no encontrada.", 404)
        return job

    @application.post("/auth/login/{job_id}/cancel", response_model=LoginJobResponse)
    async def cancel_login(job_id: str):
        job = application.state.login.cancel(job_id)
        if job is None:
            raise ServiceError("login_not_found", "Sesión de login no encontrada.", 404)
        return job

    @application.post("/auth/refresh")
    async def refresh_auth():
        web = application.state.web
        try:
            await web.recover_auth(web.client)
        except AuthError:
            raise ServiceError("session_expired", "La sesión de Gemini Web necesita renovarse.") from None
        return {"status": "success", "initialized": web.is_initialized}

    @application.post("/analyze-invoice", response_model=InvoiceAnalysisResponse, openapi_extra=analysis_request_body())
    @application.post("/agentic/analyze-invoice", response_model=InvoiceAnalysisResponse, openapi_extra=analysis_request_body())
    @application.post("/web/analyze-invoice", response_model=InvoiceAnalysisResponse, openapi_extra=analysis_request_body())
    async def analyze_invoice(request: Request):
        async with request.form(max_files=1, max_fields=6, max_part_size=16_384) as form:
            if any(len(form.getlist(key)) != 1 for key in form):
                raise ServiceError("duplicate_field", "La solicitud contiene campos duplicados.", 422)
            file = form.get("file")
            if not isinstance(file, UploadFile) or not file.filename:
                raise ServiceError("missing_file", "Debe enviar un archivo de factura.", 422)
            fields = {key: value for key, value in form.items() if key != "file"}
            if any(not isinstance(value, str) for value in fields.values()):
                raise ServiceError("invalid_request", "Parámetros inválidos.", 422)
            if "provider_fields" in fields:
                try:
                    fields["provider_fields"] = json.loads(fields["provider_fields"])
                except (TypeError, ValueError):
                    raise ServiceError("invalid_provider_fields", "Configuración del proveedor inválida.", 422) from None
            forced = "agentic" if request.url.path.startswith("/agentic/") else "web" if request.url.path.startswith("/web/") else None
            if forced:
                if fields.get("engine", forced) != forced:
                    raise ServiceError("engine_mismatch", "Motor incompatible con la ruta.", 422)
                fields["engine"] = forced
            try:
                options = AnalysisOptions.model_validate(fields)
            except ValidationError:
                raise ServiceError("invalid_options", "Configure un modelo y parámetros válidos antes de analizar.", 422) from None
            service = application.state.agentic if options.engine == "agentic" else application.state.web
            request.state.engine = options.engine
            if options.engine == "agentic" and not service.is_available():
                raise ServiceError("agentic_unavailable", "Antigravity no dispone de un adaptador de sesión verificado.")
            return await execute_analysis(file, options, service, application.state.temp_dir, application.state.limits)

    return application


app = create_app()
