import asyncio
import os
import time
from copy import deepcopy
from contextlib import AsyncExitStack
from pathlib import Path
from typing import Any, Dict, List, Optional
from collections.abc import Callable
from dotenv import dotenv_values
from loguru import logger
from web_generation_diagnostics import DiagnosticWebClient as GeminiClient, WebGenerationDiagnostics, observe_generation, preserve_structured_output
from web_audio_transport import native_audio_transport
from web_chat_recovery import chat_recovery_budget
from gemini_webapi.exceptions import (APIError, AuthError, ModelInvalidError, UsageLimitExceededError,
    TemporarilyBlockedError, TimeoutError as ProviderTimeout)
from invoice_parser import build_invoice_prompt, clean_and_parse_invoice_json, is_refusal_response
from service_errors import ServiceError
from browser_manager import BrowserCookieManager
from session_store import SESSION_FILE, read_session, save_session, disconnected_state, mark_disconnected
from web_session_cleanup import clear_web_files, validate_web_roots
from web_reasoning_adapter import ReasoningWebClient, load_profiles, LEVELS, VERIFIED_SDK_VERSION
from importlib.metadata import version
from uuid import uuid4



ENV_FILE = Path(__file__).resolve().parent / ".env"

class GeminiWebService:
    def __init__(self, generation_timeout: float = 300):
        # The SDK logs provider text/continuation IDs even with verbose=False.
        # This process owns its SDK: silence that namespace at explicit service
        # construction, preserving Nodia diagnostics and existing log handlers.
        logger.disable("gemini_webapi")
        self.browser_manager = BrowserCookieManager()
        self.session_generation = uuid4().hex
        self.secure_1psid = ""
        self.secure_1psidts = ""
        self.model_name = os.getenv("GEMINI_MODEL", "").strip()
        self.client: Optional[GeminiClient] = None
        self.is_initialized = False
        self.tier = "UNKNOWN"
        self.credits_remaining = None
        self._env_credentials: Optional[tuple[str, str]] = None
        self._client_lock = asyncio.Lock()
        self._persist_task: Optional[asyncio.Task] = None
        self._quota_cache: Optional[Dict[str, Any]] = None
        self._quota_cache_time: float = 0.0
        self._quota_lock = asyncio.Lock()
        self._analysis_lock = asyncio.Lock()
        self._generation_timeout = generation_timeout
        self._session_resetting = False
        self._reasoning_profiles = {}
        self._reasoning_profile_invalid = False

    def assert_login_allowed(self) -> None:
        if (self._session_resetting or disconnected_state() == "pending"
                or any(lock.locked() for lock in (self._analysis_lock, self._quota_lock, self._client_lock, self.browser_manager.lock))):
            raise ServiceError("web_session_busy", "Completa o reintenta la limpieza de la sesión Web antes de iniciar sesión.", 409)

    async def disconnect(self) -> None:
        locks = (self._analysis_lock, self._quota_lock, self._client_lock, self.browser_manager.lock)
        if self._session_resetting or any(lock.locked() for lock in locks):
            raise ServiceError("web_session_busy", "La sesión Web está ocupada. Espera a que termine la operación y reintenta.", 409)
        self._session_resetting = True
        self.session_generation = uuid4().hex
        try:
            async with AsyncExitStack() as stack:
                # No await yields between the admission check and unlocked lock acquisition.
                for lock in locks:
                    await stack.enter_async_context(lock)
                try:
                    validate_web_roots(self.browser_manager.profile_dir, SESSION_FILE.parent)
                except OSError:
                    raise ServiceError("web_session_cleanup_failed", "No se pudo validar el directorio de sesión Web. Revisa la configuración del servicio antes de reintentar.", 503) from None
                mark_disconnected(pending=True)
                self.is_initialized = False
                self.secure_1psid = self.secure_1psidts = ""
                self._env_credentials = None
                self._quota_cache = None
                self._quota_cache_time = 0.0
                self.tier = "UNKNOWN"
                self.credits_remaining = None
                self.browser_manager.last_refresh_time = None
                for key in ("GEMINI_SECURE_1PSID", "GEMINI_SECURE_1PSIDTS", "SECURE_1PSID", "SECURE_1PSIDTS"):
                    os.environ.pop(key, None)
                if self._persist_task:
                    self._persist_task.cancel()
                    await asyncio.gather(self._persist_task, return_exceptions=True)
                    self._persist_task = None
                try:
                    if self.client:
                        client = self.client
                        tasks = [task for name in ("refresh_task", "activity_task", "close_task")
                                 if (task := getattr(client, name, None)) is not None]
                        for task in tasks:
                            task.cancel()
                        async with asyncio.timeout(5):
                            await asyncio.gather(*tasks, return_exceptions=True)
                            await client.close()
                        self.client = None
                    cleanup = asyncio.create_task(asyncio.to_thread(
                        clear_web_files, self.browser_manager.profile_dir, SESSION_FILE.parent))
                    try:
                        await asyncio.shield(cleanup)
                    except asyncio.CancelledError:
                        # A filesystem thread cannot be cancelled; retain ownership/locks until done.
                        try:
                            await cleanup
                        except Exception as error:
                            logger.warning("Cancelled Web cleanup failed: {}", type(error).__name__)
                        raise
                    mark_disconnected(pending=False)
                except Exception as error:
                    logger.warning("Web session cleanup failed: {}", type(error).__name__)
                    raise ServiceError("web_session_cleanup_failed", "No se pudo completar la limpieza Web. Reintenta antes de conectar otra cuenta.", 503) from None
        finally:
            self._session_resetting = False

    def _read_env(self) -> tuple[str, str, str]:
        env_path = ENV_FILE
        values = dotenv_values(env_path) if env_path.exists() else {}
        psid = (values.get("GEMINI_SECURE_1PSID") or os.getenv("GEMINI_SECURE_1PSID", "")).strip()
        psidts = (values.get("GEMINI_SECURE_1PSIDTS") or os.getenv("GEMINI_SECURE_1PSIDTS", "")).strip()
        model = (values.get("GEMINI_MODEL") or os.getenv("GEMINI_MODEL", "")).strip()
        return psid, psidts, model

    def _persist_live_cookies(self) -> None:
        if not self.client:
            return
        cookies = self.client.cookies
        psid = cookies.get("__Secure-1PSID") or self.secure_1psid
        psidts = cookies.get("__Secure-1PSIDTS") or self.secure_1psidts
        if psid and psidts:
            save_session(psid, psidts)
            self.secure_1psid = psid
            self.secure_1psidts = psidts

    async def _persist_periodically(self) -> None:
        while True:
            try:
                await asyncio.sleep(15)
                self._persist_live_cookies()
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logger.warning("Could not persist rotated Gemini cookies: {}", type(exc).__name__)

    async def _connect(self, psid: str, psidts: str) -> None:
        self._quota_cache = None
        self._quota_cache_time = 0.0
        if self.client:
            previous_client = self.client
            self._persist_live_cookies()
            self.client = None
            await previous_client.close()
        # All Web clients use this adapter's private volume, including browser verification.
        os.environ["GEMINI_COOKIE_PATH"] = str(SESSION_FILE.parent)
        self._reasoning_profiles = {}
        self._reasoning_profile_invalid = False
        profile_path = os.getenv("GEMINI_WEB_REASONING_PROFILES_PATH", "").strip()
        if profile_path:
            try:
                if version("gemini-webapi") != VERIFIED_SDK_VERSION:
                    raise ValueError("SDK version changed")
                self._reasoning_profiles = load_profiles(Path(profile_path))
            except (OSError, ValueError, TypeError):
                self._reasoning_profile_invalid = True
                logger.warning("Gemini reasoning profile configuration is invalid or incompatible.")
        candidate = (ReasoningWebClient(psid, psidts, profiles=self._reasoning_profiles)
                     if self._reasoning_profiles else GeminiClient(psid, psidts))
        try:
            # SDK timeout also applies to inference streams, not only startup.
            # Bound startup separately without shortening every generation.
            async with asyncio.timeout(60):
                await candidate.init(timeout=self._generation_timeout, watchdog_timeout=120,
                                     auto_refresh=True, refresh_interval=180)
            if candidate.account_status.name == "UNAUTHENTICATED":
                raise AuthError("Gemini Web session is not authenticated")
        except BaseException:
            try:
                await candidate.close()
            except Exception as error:
                logger.warning("Could not close failed Gemini client: {}", type(error).__name__)
            self.is_initialized = False
            raise
        self.client = candidate
        self.session_generation = uuid4().hex
        self.secure_1psid = psid
        self.secure_1psidts = psidts
        self.is_initialized = True
        self._quota_cache = None
        self._quota_cache_time = 0.0
        self._persist_live_cookies()
        if self._persist_task is None or self._persist_task.done():
            self._persist_task = asyncio.create_task(self._persist_periodically())
        logger.success("Gemini Web session initialized.")

    async def init_client(self, force_refresh: bool = False):
        async with self._client_lock:
            if disconnected_state():
                self.is_initialized = False
                return
            disk_psid, disk_psidts, disk_model = self._read_env()
            disk_credentials = (disk_psid, disk_psidts)
            stored = read_session()
            if self._env_credentials is None:
                # .env is a bootstrap seed. Editing unrelated config must not restore
                # a previous account after an explicit login in the runtime volume.
                credentials = stored or disk_credentials
            elif disk_psid and disk_psidts and disk_credentials != self._env_credentials:
                credentials = disk_credentials
                force_refresh = True
                logger.info("New Gemini login found in .env; reconnecting.")
            else:
                credentials = (self.secure_1psid, self.secure_1psidts)
            self._env_credentials = disk_credentials
            self.model_name = disk_model

            if self.client and self.is_initialized and not force_refresh:
                self._persist_live_cookies()
                return

            psid, psidts = credentials
            if (not psid or not psidts) and self.browser_manager.has_profile():
                refreshed = await self.browser_manager.refresh_cookies_headless()
                if refreshed:
                    psid, psidts = refreshed["secure_1psid"], refreshed["secure_1psidts"]
                    self._env_credentials = self._read_env()[:2]
            if not psid or not psidts:
                self.is_initialized = False
                logger.warning("Gemini login is missing. Run auth.py or use Settings in local development.")
                return

            self.is_initialized = False
            try:
                await self._connect(psid, psidts)
            except AuthError:
                if not self.browser_manager.has_profile():
                    logger.error("Gemini session expired; interactive login required.")
                    raise
                logger.warning("Gemini authentication expired; refreshing browser profile once.")
                refreshed = await self.browser_manager.refresh_cookies_headless()
                if not refreshed:
                    raise
                self._env_credentials = self._read_env()[:2]
                await self._connect(refreshed["secure_1psid"], refreshed["secure_1psidts"])

    async def reload_cookies(self, secure_1psid: str, secure_1psidts: str):
        """Reconnect with cookies from an explicit login or browser refresh."""
        async with self._client_lock:
            self.is_initialized = False
            # Track the actual seed, which can remain old in a read-only mount.
            # A later health check must not mistake it for a newer explicit login.
            self._env_credentials = self._read_env()[:2]
            await self._connect(secure_1psid, secure_1psidts)

    async def recover_auth(self, failed_client: Optional[GeminiClient] = None) -> None:
        async with self._client_lock:
            if disconnected_state():
                raise AuthError("Explicit Web login required")
            # Another request may already have replaced the failed client.
            if failed_client and self.client is not failed_client and self.is_initialized:
                return
            if not self.browser_manager.has_profile():
                self.is_initialized = False
                raise AuthError("Gemini session expired; run auth.py or use Settings in local development")
            refreshed = await self.browser_manager.refresh_cookies_headless()
            if not refreshed:
                self.is_initialized = False
                raise AuthError("Gemini browser profile could not renew the session")
            self.is_initialized = False
            self._env_credentials = self._read_env()[:2]
            await self._connect(refreshed["secure_1psid"], refreshed["secure_1psidts"])

    async def get_status(self) -> Dict[str, Any]:
        disconnected = bool(disconnected_state())
        authenticated = bool(not disconnected and self.is_initialized and self.client and self.client.account_status.name == "AVAILABLE")
        return {
            "initialized": authenticated,
            "has_cookies": bool(not disconnected and self.secure_1psid and self.secure_1psidts),
            "has_browser_profile": self.browser_manager.has_profile(),
            "last_refresh_time": self.browser_manager.last_refresh_time,
            "tier": "UNKNOWN" if disconnected else str(getattr(self.client, "tier", "UNKNOWN")),
            "model": self.model_name or None,
            "model_display": self.model_name or None,
            "supported_options": self.supported_options(),
        }

    def supported_options(self) -> Dict[str, Any]:
        # Transport support comes from the installed SDK, never a model's name.
        import inspect
        observed = {item.model_id: list(LEVELS) for item in self.discovered_models()
                    if item.model_id in self._reasoning_profiles}
        return {"extended_thinking": "extended_thinking" in inspect.signature(GeminiClient.generate_content).parameters,
                "thinking_level": bool(observed), "thinking_levels_by_model": observed}

    async def get_quota_summary(self, max_cache_age_seconds: float = 30.0) -> Dict[str, Any]:
        if self._analysis_lock.locked():
            # Quota RPC recovery also uses the shared SDK transport. During
            # inference expose only a still-valid observation or unknown data.
            if self._quota_cache is not None and time.monotonic() - self._quota_cache_time < max_cache_age_seconds:
                return deepcopy(self._quota_cache)
            return {"source": "web", "observed_at": None, "usage_info": None, "quotas": None}
        async with self._quota_lock:
            if self._analysis_lock.locked():
                return {"source": "web", "observed_at": None, "usage_info": None, "quotas": None}
            now = time.monotonic()
            if self.is_initialized and self._quota_cache is not None and now - self._quota_cache_time < max_cache_age_seconds:
                return deepcopy(self._quota_cache)
            active_client = self.client
            summary = {"source": "web", "observed_at": None, "usage_info": None, "quotas": None}
            if active_client is None or not self.is_initialized:
                return summary
            # The pinned SDK may swallow an RPC error. Clear its previous snapshot
            # first, so that a failed read cannot relabel old data as fresh.
            for attribute in ("_quotas", "_usage_info"):
                if hasattr(active_client, attribute):
                    setattr(active_client, attribute, {})
            # Only expose data read in this attempt, never stale SDK properties after an error.
            async def read(method: str, attribute: str):
                try:
                    async with asyncio.timeout(5):
                        await getattr(active_client, method)()
                    value = getattr(active_client, attribute, None)
                    return deepcopy(value) if isinstance(value, dict) and value else None
                except Exception as error:
                    logger.warning("Quota read failed: {}", type(error).__name__)
                    return None
            usage, quotas = await asyncio.gather(read("_fetch_usage_info", "usage_info"), read("_fetch_quota", "quotas"))
            summary.update(usage_info=usage, quotas=quotas)
            if usage is not None or quotas is not None:
                summary["observed_at"] = time.time()
            # A login may have replaced the client while the RPC was in flight.
            if self.client is not active_client or not self.is_initialized:
                return {"source": "web", "observed_at": None, "usage_info": None, "quotas": None}
            self._quota_cache = summary
            self._quota_cache_time = time.monotonic()
            return deepcopy(summary)

    def discovered_models(self) -> List[Any]:
        if not self.client or not self.is_initialized:
            return []
        return [model for model in (self.client.list_models() or []) if getattr(model, "is_available", False)]

    async def get_models_and_quota(self) -> Dict[str, Any]:
        try:
            await self.init_client()
        except Exception as error:
            logger.warning("Session check failed: {}", type(error).__name__)
        status = await self.get_status()
        result = {
            "authenticated": status["initialized"], "tier": status["tier"],
            "plan_label": "Plan no identificado", "active_model": status["model"],
            "models": [], "usage_info": None, "quotas": None,
            "supported_options": self.supported_options(),
        }
        if not status["initialized"]:
            return result
        for model in self.discovered_models():
            identity = getattr(model, "model_id", None)
            if not identity:
                continue
            entry = {"id": identity, "name": getattr(model, "model_name", identity),
                     "display_name": getattr(model, "display_name", identity),
                     "description": getattr(model, "description", "")}
            # This SDK does not currently report context size or reasoning capability.
            # Preserve only explicit provider metadata; model names are not evidence.
            for key in ("capabilities", "context_window", "supports_thinking"):
                value = getattr(model, key, None)
                if value is not None:
                    entry[key] = value
            result["models"].append(entry)
        quota = await self.get_quota_summary()
        result.update(usage_info=quota["usage_info"], quotas=quota["quotas"],
                      quota_source=quota["source"], quota_observed_at=quota["observed_at"])
        return result

    def resolve_model(self, requested: str) -> Any:
        matches = [item for item in self.discovered_models()
                   if requested == getattr(item, "model_id", None) or requested == getattr(item, "model_name", None)]
        if len(matches) != 1:
            raise ServiceError("model_unavailable", "El modelo configurado no está disponible en esta sesión.", 422)
        return matches[0]

    async def _generate_content(self, prompt: str, *, diagnostics: WebGenerationDiagnostics | None = None,
                                preserve_structured_text: bool = False,
                                native_attachment_media_types: list[str] | None = None,
                                chat_budget_seconds: float | None = None, **options: Any) -> Any:
        active_client = self.client
        with observe_generation(active_client, diagnostics):
            async def generate():
                with (native_audio_transport(active_client, options.get("files"), native_attachment_media_types),
                      preserve_structured_output(active_client, preserve_structured_text) as structured,
                      chat_recovery_budget(active_client, chat_budget_seconds)):
                    result = await active_client.generate_content(prompt, current_retry=0, **options)
                    if structured is not None:
                        structured.verify(result, record=False)
                    return result
            operation = asyncio.create_task(generate())
            if diagnostics is not None:
                diagnostics.generation_task = operation
            try:
                return await asyncio.shield(operation)
            except asyncio.CancelledError:
                if diagnostics is not None:
                    diagnostics.cancelling()
                # curl_cffi's stream context waits for its transfer in aclose().
                # Close the transport BEFORE cancelling the generation; otherwise
                # wait_for can exceed its deadline while waiting for that transfer.
                async with self._client_lock:
                    self.is_initialized = False
                    try:
                        await active_client.close()
                    finally:
                        operation.cancel()
                        await asyncio.gather(operation, return_exceptions=True)
                raise
            except Exception:
                # A failed SDK history recovery can close its HTTP client while
                # the Nodia wrapper still says initialized. The next explicit
                # observation must rebuild it and rotate the session generation.
                if (chat_budget_seconds is not None and self.client is active_client
                        and active_client is not None and active_client.client is None):
                    self.is_initialized = False
                raise

    async def analyze_invoice(self, file_path: Path, provider_fields: Optional[Dict[str, Any]] = None,
                              provider_tax: Optional[int] = None, model: Optional[str] = None,
                              extended_thinking: Optional[bool] = None,
                              thinking_level: Optional[str] = None, progress_callback: Callable[[str], None] | None = None) -> Dict[str, Any]:
        # SDK recovery can close its shared HTTP session. Never overlap analyses.
        if self._analysis_lock.locked():
            raise ServiceError("web_busy", "El motor Web está ocupado.", 503)
        async with self._analysis_lock:
            # Let an already-running bounded quota read finish before generation.
            async with self._quota_lock:
                return await self._analyze_invoice(file_path, provider_fields, provider_tax, model,
                                                   extended_thinking, thinking_level, progress_callback)

    async def _analyze_invoice(self, file_path: Path, provider_fields: Optional[Dict[str, Any]],
                               provider_tax: Optional[int], model: Optional[str],
                               extended_thinking: Optional[bool], thinking_level: Optional[str], progress_callback: Callable[[str], None] | None = None) -> Dict[str, Any]:
        if not model or not model.strip():
            raise ServiceError("model_required", "Configure un modelo antes de analizar.", 422)
        requested = model.strip()
        try:
            await self.init_client()
            if not self.client or not self.is_initialized:
                raise AuthError("Session unavailable")
            if progress_callback:
                progress_callback("session_checked")
            prompt, configured, code, net, gross, tax = build_invoice_prompt(provider_fields, provider_tax)
            selected_id = None

            async def generate() -> str:
                nonlocal selected_id
                selected = self.resolve_model(requested)
                identity = getattr(selected, "model_id", None)
                if selected_id is not None and selected_id != identity:
                    raise ServiceError("model_changed", "El modelo cambió durante la recuperación de sesión.", 422)
                selected_id = identity
                if extended_thinking and not self.supported_options()["extended_thinking"]:
                    raise ServiceError("thinking_unsupported", "El SDK Web instalado no admite extended_thinking.", 422)
                if thinking_level is not None:
                    if extended_thinking is not None:
                        raise ServiceError("thinking_options_conflict", "No combine niveles con pensamiento extendido histórico.", 422)
                    if self._reasoning_profile_invalid:
                        raise ServiceError("thinking_profile_invalid", "El perfil de razonamiento Web es incompatible. Revise la configuración del servicio.", 422)
                    profile = self._reasoning_profiles.get(identity)
                    if profile is None or thinking_level not in LEVELS:
                        raise ServiceError("thinking_level_unsupported", "El adaptador Web no tiene un protocolo comprobado para el nivel y modelo elegidos.", 422)
                    options = {"thinking_level": thinking_level}
                else:
                    options = {"extended_thinking": bool(extended_thinking)} if self.supported_options()["extended_thinking"] else {}
                # gemini-webapi 2.1.1 forwards this option to its @running(retry=5)
                # generator. A lost response must not resend an uncertain inference.
                if progress_callback:
                    progress_callback("model_checked")
                    progress_callback("provider_request_started")
                response = await self._generate_content(
                    prompt, files=[file_path], model=selected, **options)
                if progress_callback:
                    progress_callback("response_received")
                return response.text or ""

            active_client = self.client
            try:
                raw_text = await generate()
            except AuthError:
                # Recover only an explicit authentication failure, at most once.
                await self.recover_auth(active_client)
                raw_text = await generate()
            self._persist_live_cookies()
            if is_refusal_response(raw_text):
                raise ServiceError("document_rejected", "El proveedor no pudo procesar el documento.", 502)
            return clean_and_parse_invoice_json(raw_text, configured, code, net, gross, tax,
                                                provider_fields=provider_fields)
        except AuthError:
            raise ServiceError("session_expired", "La sesión de Gemini Web necesita renovarse.") from None
        except (UsageLimitExceededError, TemporarilyBlockedError):
            raise ServiceError("quota_exhausted", "El proveedor alcanzó su límite de uso.", 429) from None
        except (ProviderTimeout, TimeoutError):
            raise ServiceError("provider_timeout", "Tiempo de respuesta del proveedor agotado.", 504) from None
        except ModelInvalidError:
            raise ServiceError("model_unavailable", "El proveedor rechazó el modelo configurado.", 422) from None
        except APIError:
            raise ServiceError("provider_response_error", "No se pudo obtener una respuesta válida de Gemini.", 502) from None
        except ServiceError:
            raise
        except Exception as error:
            logger.warning("Analysis failed: {}", type(error).__name__)
            raise ServiceError("provider_unavailable", "El proveedor no pudo completar el análisis.") from None

    async def suspend_for_login(self) -> None:
        """Yield the SDK cookie writer before a dedicated login owns the profile.

        The next consumer reloads the canonical runtime cookie store, rather
        than persisting this interpreter's previous account over the new login.
        """
        async with self._client_lock:
            await self.close()
            self._env_credentials = None
            self.secure_1psid = ""
            self.secure_1psidts = ""

    async def close(self):
        self._quota_cache = None
        self._quota_cache_time = 0.0
        if self._persist_task:
            self._persist_task.cancel()
            try:
                await self._persist_task
            except asyncio.CancelledError:
                pass
            self._persist_task = None
        if self.client:
            try:
                self._persist_live_cookies()
                await self.client.close()
            except Exception:
                pass
            self.client = None
            self.is_initialized = False
