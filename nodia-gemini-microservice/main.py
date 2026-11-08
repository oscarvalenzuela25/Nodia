"""Private HTTP adapter. Importing this module does not load login or start clients."""

import asyncio
import json
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated, Any
from collections.abc import Callable
from uuid import uuid4

from dotenv import load_dotenv
from fastapi import FastAPI, Header, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from loguru import logger
from pydantic import ValidationError
from starlette.datastructures import UploadFile
from starlette.exceptions import HTTPException as StarletteHTTPException

from agentic_service import AntigravityAgentService
from agentic_login import AgenticLoginManager
from request_guard import PrivateRequestGuard
from profile_admission import ProfileAdmission
from manual_invoice_dispatch import ManualInvoiceDispatches
from cli_execution_receipt import CliExecutionReceipt
from durable_login import DurableLoginRequests
from durable_login_routes import register_durable_login_routes
from nodia_ai_chat import ChatAdapter, ChatRequest, ObserveRequest, Answer, ChatTurnResponse, AttachmentProbeRequest
from native_context_budget import ContextMeasureRequest, ContextMeasurement, measure_context
from invoice_mcp_contract import register_invoice_mcp_contract_routes
from native_invoice_analysis import NativeInvoiceAnalysis, register_native_invoice_routes
from native_image_generation import NativeImageGeneration, register_native_image_routes
from native_teacher_text import TeacherNativeText, register_teacher_text_routes
from teacher_sdk_runtime import create_teacher_sdk_runtime
from native_attempts import ReconcileAttempt, AcknowledgeAttempt
from native_mcp_sessions import NativeMcpSessions, McpChatRequest, McpPoll, McpResult
from analysis_observations import AnalysisObservations
from attachment_inspector import AttachmentInspector, register_attachment_inspector_routes
from schemas import (AgenticLoginJobResponse, AgenticLoginCode, AgenticStatusResponse,
                     AgenticModelsResponse, AnalysisOptions, EngineStatusResponse,
                     HealthResponse, InvoiceAnalysisResponse, NodiaActorId, RuntimeLimits)
from service_auth import assert_service_auth_configured
from service_errors import InvalidExtraction, ServiceError

BASE_DIR = Path(__file__).resolve().parent
STATE_DIR = BASE_DIR / "session_state"


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
                           temp_dir: Path, limits: RuntimeLimits, progress: Callable[[str], None] | None = None,
                           closure_receipt: CliExecutionReceipt | None = None) -> InvoiceAnalysisResponse:
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
        if progress:
            progress("file_validated")
        result = await asyncio.wait_for(service.analyze_invoice(
            file_path=temp_path, provider_fields=options.provider_fields,
            provider_tax=options.provider_tax, model=options.model,
            extended_thinking=options.extended_thinking, thinking_level=options.thinking_level,
            **({"progress_callback": progress} if progress else {}),
            **({"closure_receipt": closure_receipt} if closure_receipt is not None else {}),
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


def create_app(*, agentic_service: Any = None,
               temp_dir: Path | None = None, limits: RuntimeLimits | None = None,
               load_environment: bool = True) -> FastAPI:
    @asynccontextmanager
    async def lifespan(application: FastAPI):
        if load_environment:
            load_dotenv(BASE_DIR / ".env")
        assert_service_auth_configured()
        state = application.state
        state.limits = limits if limits is not None else configured_limits()
        state.agentic = agentic_service if agentic_service is not None else AntigravityAgentService()
        state.agentic_login = AgenticLoginManager(state.agentic)
        state.temp_dir = temp_dir if temp_dir is not None else BASE_DIR / "temp_uploads"
        state.attachment_inspector = AttachmentInspector(state.temp_dir)
        state.analysis_slots = asyncio.Semaphore(state.limits.analysis_slots)
        state.observations = AnalysisObservations()
        configured_home = os.getenv("ANTIGRAVITY_CLI_HOME", "").strip()
        legacy_config = getattr(getattr(state.agentic, "runner", None), "config", None)
        physical_home = Path(configured_home) if configured_home else getattr(legacy_config, "home", None)
        state.profiles = ProfileAdmission(physical_home, STATE_DIR / "runtime_admission")
        state.manual_invoice_dispatches = ManualInvoiceDispatches(state.profiles, STATE_DIR / "manual_invoice_proofs")
        state.manual_invoice_generation = uuid4().hex
        state.manual_invoice_dispatches.initialize_safety()
        state.teacher_backend, teacher_transport = create_teacher_sdk_runtime(physical_home,
            state.profiles._state_dir, STATE_DIR / "teacher_sdk_work", os.environ, profiles=state.profiles)
        # Recover/quarantine old SDK ownership before chat, OCR or CLI startup
        # can acquire the same physical provider profile.
        await state.teacher_backend.initialize_safety()
        state.chat = ChatAdapter(state.agentic, state.profiles, state.attachment_inspector)
        state.invoice_analysis = NativeInvoiceAnalysis(state.chat)
        state.image_generation = NativeImageGeneration(state.chat)
        state.teacher_text = TeacherNativeText(state.agentic, state.profiles,
            backend=state.teacher_backend, transport=teacher_transport)
        state.durable_login = DurableLoginRequests(STATE_DIR / "login_requests", state.profiles)
        state.mcp = NativeMcpSessions(state.chat)
        state.chat.mcp_sessions = state.mcp
        state.agentic_start_deferred = False
        try:
            if isinstance(state.agentic, AntigravityAgentService):
                try:
                    if state.profiles.identity("agentic") is None:
                        await state.agentic.initialize()
                    else:
                        async with state.profiles.operation("agentic", purpose="startup"):
                            await state.agentic.initialize()
                except ServiceError as error:
                    if error.code != "runtime_busy":
                        raise
                    state.agentic_start_deferred = True
            yield
        finally:
            try:
                await state.teacher_text.close()
                await state.mcp.close()
                await state.durable_login.close()
                await state.agentic_login.close()
            finally:
                try:
                    await state.teacher_backend.close()
                finally:
                    if hasattr(state.agentic, "close"):
                        await state.agentic.close()

    application = FastAPI(title="Nodia Gemini Microservice", version="1.0.0", lifespan=lifespan)
    application.add_middleware(PrivateRequestGuard)
    register_durable_login_routes(application)
    register_attachment_inspector_routes(application)
    register_invoice_mcp_contract_routes(application)
    register_native_invoice_routes(application)
    register_native_image_routes(application)
    register_teacher_text_routes(application)

    async def durable_job(engine: str, job_id: str, actor: str, action: str, payload: dict | None = None):
        job = await application.state.durable_login.legacy(engine, job_id, actor, action, payload)
        if job is not None and job.get("state") == "unknown":
            raise ServiceError("login_unknown", "El proceso de login requiere conciliación.", 409)
        return job

    def error_response(request: Request, code: str, detail: str, status: int, headers=None):
        request.state.error_code = code
        # Stable operational categories only; Server never needs the provider body.
        headers = dict(headers or {})
        if (code, status) in {("analysis_timeout", 504), ("provider_timeout", 504), ("agentic_timeout", 504), ("provider_response_error", 502), ("login_invalid_code", 422),
                             ("runtime_busy", 409), ("native_proof_missing", 409), ("native_proof_mismatch", 409)}:
            headers["X-Nodia-Error-Code"] = code
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
        # Only body.code validation is a user OAuth-code error. Missing/invalid
        # service-supplied identity remains an internal request-contract error.
        if (request.method == "POST" and request.url.path.startswith("/agentic/auth/login/")
                and request.url.path.endswith("/code")
                and all(item["loc"] == ("body", "code") for item in error.errors())):
            return error_response(request, "login_invalid_code", "Código de autorización inválido.", 422)
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
        return await agentic_ready()




    @application.get("/agentic/status", response_model=AgenticStatusResponse)
    async def agentic_status():
        if application.state.profiles.identity("agentic") is None:
            return AgenticStatusResponse.model_validate(await application.state.agentic.get_status())
        async with application.state.profiles.observation("agentic", purpose="health_status", timeout_seconds=12):
            if application.state.agentic_start_deferred:
                await application.state.agentic.initialize()
                application.state.agentic_start_deferred = False
            return AgenticStatusResponse.model_validate(await application.state.agentic.get_status())

    @application.get("/agentic/ready", response_model=HealthResponse)
    async def agentic_ready():
        status = await agentic_status()
        if not status.available or not status.has_active_session:
            raise ServiceError("agentic_session_required", "La sesión agéntica no está disponible.")
        return HealthResponse(status="ok")

    @application.post("/agentic/auth/login/start", response_model=AgenticLoginJobResponse)
    async def start_agentic_login(actor: Annotated[NodiaActorId, Header(alias="X-Nodia-Actor-Id")]):
        profiles = application.state.profiles
        if profiles.identity("agentic") is None:
            return await application.state.agentic_login.start(actor)
        existing = application.state.agentic_login.status(None, actor)
        if existing and existing["state"] in ("running", "waiting_code", "verifying"):
            return existing
        reservation = profiles.reserve("agentic", purpose="login")
        try:
            return await application.state.agentic_login.start(actor, reservation.release)
        except BaseException:
            reservation.release()
            raise

    @application.get("/agentic/auth/login/current", response_model=AgenticLoginJobResponse | None)
    async def current_agentic_login(actor: Annotated[NodiaActorId, Header(alias="X-Nodia-Actor-Id")]):
        job = application.state.agentic_login.status(None, actor)
        return job if job and job["state"] in ("running", "waiting_code", "verifying") else None

    @application.get("/agentic/auth/login/{job_id}", response_model=AgenticLoginJobResponse)
    async def agentic_login_status(job_id: str, actor: Annotated[NodiaActorId, Header(alias="X-Nodia-Actor-Id")]):
        durable = await durable_job("agentic", job_id, actor, "status")
        if durable is not None:
            return durable
        job = application.state.agentic_login.status(job_id, actor)
        if job is None:
            raise ServiceError("login_not_found", "Intento de login no encontrado.", 404)
        return job

    @application.post("/agentic/auth/login/{job_id}/code", response_model=AgenticLoginJobResponse)
    async def submit_agentic_code(job_id: str, payload: AgenticLoginCode,
                                 actor: Annotated[NodiaActorId, Header(alias="X-Nodia-Actor-Id")]):
        durable = await durable_job("agentic", job_id, actor, "code", payload.model_dump())
        if durable is not None:
            return durable
        return application.state.agentic_login.submit(job_id, actor, payload.code)

    @application.post("/agentic/auth/login/{job_id}/cancel", response_model=AgenticLoginJobResponse)
    async def cancel_agentic_login(job_id: str, actor: Annotated[NodiaActorId, Header(alias="X-Nodia-Actor-Id")]):
        durable = await durable_job("agentic", job_id, actor, "cancel")
        if durable is not None:
            return durable
        return await application.state.agentic_login.cancel(job_id, actor)

    @application.get("/engines/status", response_model=EngineStatusResponse)
    async def engines_status():
        try:
            agentic = await asyncio.wait_for(agentic_status(), 12)
        except ServiceError as error:
            agentic = AgenticStatusResponse(available=False, reason=error.code)
        except TimeoutError:
            agentic = AgenticStatusResponse(available=False, reason="agentic_timeout")
        return EngineStatusResponse(agentic=agentic)

    @application.get("/agentic/models", response_model=AgenticModelsResponse)
    async def agentic_models():
        info = (await agentic_status()).model_dump()
        return {"engine": "agentic", "available": info["available"],
                "authenticated": bool(info["available"] and info["has_active_session"]),
                "models": info["models"], "reason": info.get("reason")}











    @application.post("/analyze-invoice", response_model=InvoiceAnalysisResponse, openapi_extra=analysis_request_body())
    @application.post("/agentic/analyze-invoice", response_model=InvoiceAnalysisResponse, openapi_extra=analysis_request_body())
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
            forced = "agentic"
            if forced:
                if fields.get("engine", forced) != forced:
                    raise ServiceError("engine_mismatch", "Motor incompatible con la ruta.", 422)
                fields["engine"] = forced
            try:
                options = AnalysisOptions.model_validate(fields)
            except ValidationError:
                raise ServiceError("invalid_options", "Configure un modelo y parámetros válidos antes de analizar.", 422) from None
            service = application.state.agentic
            request.state.engine = options.engine
            if options.engine == "agentic" and not service.is_available():
                raise ServiceError("agentic_unavailable", "Antigravity no dispone de un adaptador de sesión verificado.")
            identifier = getattr(request.state, "analysis_id", None)
            generation = getattr(service, "session_generation", None)
            if not isinstance(generation, str):
                generation = application.state.manual_invoice_generation
            async with application.state.manual_invoice_dispatches.operation(generation) as dispatch:
                def progress(stage: str) -> None:
                    if stage == "provider_request_started":
                        dispatch.arm()
                    if identifier:
                        application.state.observations.emit(identifier, stage)
                return await execute_analysis(file, options, service, application.state.temp_dir,
                    application.state.limits, progress, dispatch.receipt)

    @application.post("/nodia-ai/{engine}/observe")
    async def observe_chat(engine: str, payload: ObserveRequest):
        if engine != "agentic":
            raise ServiceError("invalid_engine", "Modo de chat inválido.", 422)
        return await application.state.chat.observe(engine, payload)

    @application.post("/nodia-ai/{engine}/measure-context", response_model=ContextMeasurement)
    async def measure_chat_context(engine: str, payload: ContextMeasureRequest):
        # Pure metadata: no account inspection, profile reservation, SDK or generation.
        return measure_context(engine, payload, Answer.model_json_schema())

    @application.post("/nodia-ai/{engine}/turn", response_model=ChatTurnResponse)
    async def execute_chat(engine: str, payload: ChatRequest):
        if engine != "agentic":
            raise ServiceError("invalid_engine", "Modo de chat inválido.", 422)
        reply = await application.state.chat.execute(engine, payload)
        proof = application.state.chat.ledger.read(payload.attempt_id)
        if proof is None:
            raise ServiceError("native_proof_missing", "No hay prueba terminal del intento.", 502)
        return ChatTurnResponse(reply=reply, terminal_proof=application.state.chat.ledger.project(proof))

    @application.post("/nodia-ai/agentic/mcp/start")
    async def start_mcp(payload: McpChatRequest):
        return await application.state.mcp.start(payload)

    @application.post("/nodia-ai/{engine}/attachments/probe", response_model=ChatTurnResponse)
    async def probe_attachment(engine: str, payload: AttachmentProbeRequest):
        if engine != "agentic":
            raise ServiceError("invalid_engine", "Modo de chat inválido.", 422)
        reply = await application.state.chat.probe_attachments(payload, engine)
        proof = application.state.chat.ledger.read(payload.attempt_id)
        if proof is None:
            raise ServiceError("native_proof_missing", "No hay prueba terminal del intento.", 502)
        return ChatTurnResponse(reply=reply, terminal_proof=application.state.chat.ledger.project(proof))

    @application.post("/nodia-ai/agentic/attempts/{attempt_id}/mcp/events")
    async def poll_mcp(attempt_id: str, payload: McpPoll):
        return application.state.mcp.poll(attempt_id, payload)

    @application.post("/nodia-ai/agentic/attempts/{attempt_id}/mcp/results")
    async def result_mcp(attempt_id: str, payload: McpResult):
        return application.state.mcp.submit(attempt_id, payload)

    @application.post("/nodia-ai/agentic/attempts/{attempt_id}/mcp/cancel")
    async def cancel_mcp(attempt_id: str, payload: ReconcileAttempt):
        return await application.state.mcp.cancel(attempt_id, payload)

    @application.post("/nodia-ai/agentic/attempts/{attempt_id}/mcp/attest")
    async def attest_mcp(attempt_id: str, payload: ReconcileAttempt):
        return application.state.mcp.attest(attempt_id, payload)

    @application.post("/nodia-ai/{engine}/attempts/{attempt_id}/reconcile")
    async def reconcile_chat(engine: str, attempt_id: str, payload: ReconcileAttempt):
        if engine != "agentic":
            raise ServiceError("invalid_engine", "Modo de chat inválido.", 422)
        return application.state.chat.reconcile(engine, attempt_id, payload)

    @application.post("/nodia-ai/{engine}/attempts/{attempt_id}/acknowledge")
    async def acknowledge_chat(engine: str, attempt_id: str, payload: AcknowledgeAttempt):
        if engine != "agentic":
            raise ServiceError("invalid_engine", "Modo de chat inválido.", 422)
        return application.state.chat.acknowledge(engine, attempt_id, payload)

    @application.get("/analysis-observations/{identifier}")
    async def read_observation(identifier: str, after: int = 0):
        return JSONResponse(application.state.observations.read(identifier, after), headers={"Cache-Control": "no-store"})

    return application


app = create_app()
