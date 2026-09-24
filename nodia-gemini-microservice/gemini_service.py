import asyncio
import json
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional
from dotenv import dotenv_values
from loguru import logger
from gemini_webapi import GeminiClient
from gemini_webapi.exceptions import AuthError, ModelInvalidError
from browser_manager import BrowserCookieManager
from session_store import SESSION_FILE, read_session, save_session

os.environ.setdefault("GEMINI_COOKIE_PATH", str(SESSION_FILE.parent))

def is_refusal_response(text: str) -> bool:
    """Checks if Gemini returned a standard model refusal or reported inability to see/process attachments."""
    t = text.lower()
    refusal_keywords = [
        "solo soy una ia basada en texto",
        "ia basada en texto",
        "modelo de lenguaje basado en texto",
        "no puedo ayudarte con eso",
        "no puedo ver imágenes",
        "no puedo procesar imágenes",
        "no puedo analizar imágenes",
        "no has adjuntado",
        "no se adjuntó",
        "no adjuntaste",
        "adjunta el documento",
        "text-based ai",
        "i am a text-based",
        "i cannot view images",
        "cannot process files",
    ]
    return any(k in t for k in refusal_keywords)

def parse_field_config(field: Any) -> Optional[Dict[str, str]]:
    if not field:
        return None
    if isinstance(field, str):
        val = field.strip()
        return {"value": val, "instructions": ""} if val else None
    if isinstance(field, dict):
        val = str(field.get("value") or "").strip()
        inst = str(field.get("instructions") or "").strip()
        if val or inst:
            return {"value": val, "instructions": inst}
    return None

class GeminiWebService:
    def __init__(self):
        self.browser_manager = BrowserCookieManager()
        self.secure_1psid = ""
        self.secure_1psidts = ""
        self.model_name = os.getenv("GEMINI_MODEL", "gemini-flash").strip() or "gemini-flash"
        self.client: Optional[GeminiClient] = None
        self.is_initialized = False
        self.tier = "UNKNOWN"
        self.credits_remaining = None
        self._env_credentials: Optional[tuple[str, str]] = None
        self._client_lock = asyncio.Lock()
        self._persist_task: Optional[asyncio.Task] = None

    def _read_env(self) -> tuple[str, str, str]:
        env_path = Path(__file__).resolve().parent / ".env"
        values = dotenv_values(env_path) if env_path.exists() else {}
        psid = (values.get("GEMINI_SECURE_1PSID") or os.getenv("GEMINI_SECURE_1PSID", "")).strip()
        psidts = (values.get("GEMINI_SECURE_1PSIDTS") or os.getenv("GEMINI_SECURE_1PSIDTS", "")).strip()
        model = (values.get("GEMINI_MODEL") or os.getenv("GEMINI_MODEL", "gemini-flash")).strip() or "gemini-flash"
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
                logger.warning(f"Could not persist rotated Gemini cookies: {exc}")

    async def _connect(self, psid: str, psidts: str) -> None:
        if self.client:
            await self.client.close()
        self.client = GeminiClient(psid, psidts)
        await self.client.init(timeout=60, auto_refresh=True, refresh_interval=180)
        if self.client.account_status.name == "UNAUTHENTICATED":
            raise AuthError("Gemini Web session is not authenticated")
        self.secure_1psid = psid
        self.secure_1psidts = psidts
        self.is_initialized = True
        self._persist_live_cookies()
        if self._persist_task is None or self._persist_task.done():
            self._persist_task = asyncio.create_task(self._persist_periodically())
        logger.success("Gemini Web session initialized.")

    async def init_client(self, force_refresh: bool = False):
        async with self._client_lock:
            disk_psid, disk_psidts, disk_model = self._read_env()
            disk_credentials = (disk_psid, disk_psidts)
            env_path = Path(__file__).resolve().parent / ".env"
            stored = read_session()
            if self._env_credentials is None:
                # An interactive login replaces .env. Otherwise use the latest rotated cookie.
                store_is_newer = stored and (not env_path.exists() or SESSION_FILE.stat().st_mtime >= env_path.stat().st_mtime)
                credentials = stored if store_is_newer else disk_credentials
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
                    self._env_credentials = (psid, psidts)
            if not psid or not psidts:
                self.is_initialized = False
                logger.warning("Gemini login is missing. Run auth.py or use /auth/login.")
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
                self._env_credentials = (refreshed["secure_1psid"], refreshed["secure_1psidts"])
                await self._connect(*self._env_credentials)

    async def reload_cookies(self, secure_1psid: str, secure_1psidts: str):
        """Reconnect with cookies from an explicit login or browser refresh."""
        async with self._client_lock:
            self.is_initialized = False
            self._env_credentials = (secure_1psid, secure_1psidts)
            await self._connect(secure_1psid, secure_1psidts)

    async def recover_auth(self, failed_client: Optional[GeminiClient] = None) -> None:
        async with self._client_lock:
            # Another request may already have replaced the failed client.
            if failed_client and self.client is not failed_client and self.is_initialized:
                return
            if not self.browser_manager.has_profile():
                self.is_initialized = False
                raise AuthError("Gemini session expired; run auth.py or /auth/login")
            refreshed = await self.browser_manager.refresh_cookies_headless()
            if not refreshed:
                self.is_initialized = False
                raise AuthError("Gemini browser profile could not renew the session")
            self.is_initialized = False
            self._env_credentials = (refreshed["secure_1psid"], refreshed["secure_1psidts"])
            await self._connect(*self._env_credentials)

    async def get_status(self) -> Dict[str, Any]:
        model_name = self.model_name
        if "flash" in model_name and "lite" not in model_name:
            model_display = "3.8 Flash"
        elif "pro" in model_name:
            model_display = "3.1 Pro"
        elif "lite" in model_name:
            model_display = "3.5 Flash-Lite"
        else:
            model_display = model_name
        authenticated = bool(self.is_initialized and self.client and self.client.account_status.name == "AVAILABLE")
        return {
            "initialized": authenticated,
            "has_cookies": bool(self.secure_1psid and self.secure_1psidts),
            "has_browser_profile": self.browser_manager.has_profile(),
            "last_refresh_time": self.browser_manager.last_refresh_time,
            "tier": getattr(self.client, "tier", "PRO" if authenticated else "UNKNOWN"),
            "model": self.model_name,
            "model_display": model_display,
        }

    async def generate_text(self, prompt: str, files: Optional[List[Path]] = None) -> str:
        await self.init_client()
        if not self.client or not self.is_initialized:
            raise AuthError("Gemini Web session is not initialized")
        file_args = [f for f in files if f.exists()] if files else None
        active_client = self.client
        try:
            response = await active_client.generate_content(prompt, files=file_args, model=self.model_name)
        except AuthError:
            await self.recover_auth(active_client)
            response = await self.client.generate_content(prompt, files=file_args, model=self.model_name)
        self._persist_live_cookies()
        return response.text or ""
    async def analyze_invoice(
        self,
        file_path: Path,
        provider_fields: Optional[Dict[str, Any]] = None,
        provider_tax: Optional[int] = None,
    ) -> Dict[str, Any]:
        await self.init_client()
        if not self.client or not self.is_initialized:
            raise RuntimeError("Gemini Web client is not initialized. Please check cookies in .env.")

        # Determine tax value (default 19)
        tax_val = 19
        if provider_tax is not None:
            try:
                tax_val = int(provider_tax)
            except (ValueError, TypeError):
                tax_val = 19
        elif provider_fields and "tax" in provider_fields:
            try:
                tax_val = int(provider_fields["tax"])
            except (ValueError, TypeError):
                tax_val = 19

        code_cfg = parse_field_config(provider_fields.get("code") if provider_fields else None)
        cp_cfg = parse_field_config(provider_fields.get("cost_price") if provider_fields else None)
        cpt_cfg = parse_field_config(provider_fields.get("cost_price_tax") if provider_fields else None)
        packages_cfg = parse_field_config(provider_fields.get("packages") if provider_fields else None)
        units_cfg = parse_field_config(provider_fields.get("units_per_package") if provider_fields else None)

        has_code_config = bool(code_cfg and code_cfg.get("value"))
        has_cost_price_config = bool(cp_cfg and cp_cfg.get("value"))
        has_cost_price_tax_config = bool(cpt_cfg and cpt_cfg.get("value"))
        has_packages_config = bool(packages_cfg and packages_cfg.get("value"))
        has_units_per_package_config = bool(units_cfg and units_cfg.get("value"))

        has_any_config = (
            has_code_config
            or has_cost_price_config
            or has_cost_price_tax_config
            or has_packages_config
            or has_units_per_package_config
        )

        clean_fields = {
            k: v for k, v in (provider_fields or {}).items()
            if k != "tax" and v
        }

        if has_any_config:
            code_rule = (
                f'- "code": busca el código de producto / SKU correspondiente estrictamente a la columna "{code_cfg["value"]}".'
                + (f' Instrucciones adicionales: {code_cfg["instructions"]}.' if code_cfg.get("instructions") else "")
                + ' Si no viene para ese ítem, devuelve null.'
                if has_code_config
                else '- "code": null (el proveedor NO tiene configurado campo de código; devuelve estrictamente null).'
            )
            cp_rule = (
                f'- "cost_price": costo unitario sin impuestos (neto) correspondiente estrictamente a la columna "{cp_cfg["value"]}".'
                + (f' Instrucciones adicionales: {cp_cfg["instructions"]}.' if cp_cfg.get("instructions") else "")
                + ' Si no aparece en la fila, devuelve null.'
                if has_cost_price_config
                else '- "cost_price": null (el proveedor NO tiene configurado costo sin impuestos en su plantilla; NO extraigas, NO calcules y NO inventes este valor, devuelve estrictamente null).'
            )
            cpt_rule = (
                f'- "cost_price_tax": costo unitario con impuestos (bruto / con IVA) correspondiente estrictamente a la columna "{cpt_cfg["value"]}".'
                + (f' Instrucciones adicionales: {cpt_cfg["instructions"]}.' if cpt_cfg.get("instructions") else "")
                + ' Si no aparece en la fila, devuelve null.'
                if has_cost_price_tax_config
                else '- "cost_price_tax": null (el proveedor NO tiene configurado costo con impuestos en su plantilla; NO extraigas, NO calcules y NO inventes este valor, devuelve estrictamente null).'
            )
            packages_rule = (
                f'- "packages": cantidad de cajas/bultos/embalajes comprados correspondiente estrictamente a la columna "{packages_cfg["value"]}".'
                + (f' Instrucciones adicionales: {packages_cfg["instructions"]}.' if packages_cfg.get("instructions") else "")
                + ' (número entero o float, o null si no aparece).'
                if has_packages_config
                else '- "packages": null (no configurado en la plantilla).'
            )
            units_rule = (
                f'- "units_per_package": cantidad de unidades o productos por caja/embalaje correspondiente estrictamente a la columna "{units_cfg["value"]}".'
                + (f' Instrucciones adicionales: {units_cfg["instructions"]}.' if units_cfg.get("instructions") else "")
                + ' (número entero o float, o null si no aparece).'
                if has_units_per_package_config
                else '- "units_per_package": null (no configurado en la plantilla).'
            )

            provider_context = f"""
Plantilla de columnas/campos configurada para este proveedor:
{json.dumps(clean_fields, ensure_ascii=False, indent=2)}

REGLAS ESTRICTAS DE EXTRACCIÓN SEGÚN LA PLANTILLA DEL PROVEEDOR:
El usuario ha configurado explícitamente cuáles campos desea extraer automáticamente.
SOLO se deben extraer los campos que están configurados en la plantilla.
CUALQUIER OTRO CAMPO NO CONFIGURADO DEBE DEVOLVERSE ESTRICTAMENTE COMO null, INCLUSO SI LA FACTURA CONTIENE ESE DATO.

Para cada ítem en "items":
{code_rule}
- "name": descripción o nombre del producto (string obligatorio).
{cp_rule}
{cpt_rule}
{packages_rule}
{units_rule}
- "quantity": si se detectan "packages" y "units_per_package", calcula su multiplicación como la cantidad total de unidades. Si solo existe uno, usa ese valor. Si no existe ninguno, usa la cantidad detectada o 0.
- "total_price": total o subtotal del renglón (número, si existe, o null).
"""
        else:
            provider_context = """
El proveedor no tiene plantilla de campos configurada. Aplica el criterio general de extracción contable completa:
Para cada ítem en "items":
- "code": código de barras, SKU o código de producto (string, si existe en la fila o comprobante, o null).
- "name": descripción o nombre del producto (string obligatorio).
- "packages": cantidad de bultos/cajas si existe, o null.
- "units_per_package": unidades por caja si existe, o null.
- "quantity": cantidad adquirida total (número, por defecto 1).
- "cost_price": costo unitario neto sin impuestos (número, si se indica o calcula en la factura, o null).
- "cost_price_tax": costo unitario bruto con impuestos / IVA incluido (número, si se indica o calcula en la factura, o null).
- "unit_price": precio unitario indicado (número, si existe).
- "total_price": subtotal o precio total del renglón (número, si existe).
"""

        prompt = f"""
Eres un asistente contable y de inventario de alta precisión. Analiza la factura o comprobante adjunto.
{provider_context}

Debes extraer y estructurar los siguientes campos estrictamente en formato JSON:
{{
  "code": "Número o folio del comprobante (string, e.g. '097514959')",
  "total_amount": 123456, // Monto total de la factura como número entero sin decimales
  "data": {{
    "issue_date": "YYYY-MM-DD", // Fecha de emisión si está visible, de lo contrario cadena vacía
    "items": [
      {{
        "code": "Código interno o SKU del producto (o null si no aplica)",
        "name": "Nombre o descripción del producto (string)",
        "packages": 5, // Cantidad de cajas/embalajes si aplica, o null
        "units_per_package": 24, // Cantidad de unidades por caja si aplica, o null
        "quantity": 120, // Cantidad total como número entero o float
        "cost_price": 840, // Costo unitario neto sin impuestos si aparece en el comprobante o plantilla, o null
        "cost_price_tax": 1000, // Costo unitario bruto con impuestos / IVA incluido si aparece en el comprobante o plantilla, o null
        "unit_price": 1000, // Precio unitario como número entero o float
        "total_price": 120000 // Subtotal o precio total del ítem como número
      }}
    ]
  }}
}}

Reglas estrictas:
1. Responde ÚNICAMENTE con el objeto JSON entre bloques de código ```json y ```.
2. No agregues texto introductorio, explicaciones ni saludos antes o después del bloque JSON.
3. Asegúrate de que todos los valores numéricos sean válidos (sin símbolos '$', puntos de miles o comas).
"""

        async def _do_generation(target_model: Optional[str]) -> str:
            resp = await self.client.generate_content(prompt, files=[file_path], model=target_model)
            return resp.text or ""

        raw_text = ""
        active_client = self.client
        try:
            raw_text = await _do_generation(self.model_name)
        except AuthError:
            await self.recover_auth(active_client)
            raw_text = await _do_generation(self.model_name)
        except ModelInvalidError:
            logger.warning("Configured Gemini Web model is unavailable; using the default model.")
            raw_text = await _do_generation(None)

        self._persist_live_cookies()

        logger.info(f"Gemini raw response length: {len(raw_text)}")

        # 2. Check if Gemini returned a text-only refusal (happens when media upload is rejected or dropped)
        if is_refusal_response(raw_text):
            logger.warning(f"Gemini returned refusal response ('{raw_text[:100]}...'). Attempting session recovery...")
            if self.browser_manager.has_profile():
                await self.recover_auth(active_client)
                raw_text = await _do_generation(self.model_name)
                self._persist_live_cookies()
                logger.info(f"Retried Gemini raw response length after recovery: {len(raw_text)}")

        if is_refusal_response(raw_text):
            raise RuntimeError(
                f"Gemini Web API rechazó el documento adjunto ('{raw_text.strip()}'). "
                f"Por favor ejecute 'login.bat' para renovar la sesión de Google o intente nuevamente."
            )

        return self._clean_and_parse_json(
            raw_text,
            has_any_config=has_any_config,
            has_code_config=has_code_config,
            has_cost_price_config=has_cost_price_config,
            has_cost_price_tax_config=has_cost_price_tax_config,
            tax_val=tax_val,
        )

    def _clean_and_parse_json(
        self,
        raw_text: str,
        has_any_config: bool = False,
        has_code_config: bool = False,
        has_cost_price_config: bool = False,
        has_cost_price_tax_config: bool = False,
        tax_val: int = 19,
    ) -> Dict[str, Any]:
        parsed = None

        # Strategy 1: Split by markdown blocks (``` or ```json) and inspect in reverse order
        # Stream retries or multiple candidates append the final valid block at the end.
        parts = re.split(r"```(?:json)?", raw_text)
        for p in reversed(parts):
            p_strip = p.strip()
            first_b = p_strip.find("{")
            last_b = p_strip.rfind("}")
            if first_b != -1 and last_b != -1 and last_b > first_b:
                snippet = p_strip[first_b : last_b + 1]
                try:
                    obj = json.loads(snippet)
                    if isinstance(obj, dict) and ("code" in obj or "total_amount" in obj or "data" in obj or "items" in obj):
                        parsed = obj
                        break
                except Exception:
                    clean_snippet = re.sub(r",\s*([\]}])", r"\1", snippet)
                    clean_snippet = re.sub(r"//.*$", "", clean_snippet, flags=re.MULTILINE)
                    try:
                        obj = json.loads(clean_snippet)
                        if isinstance(obj, dict):
                            parsed = obj
                            break
                    except Exception:
                        pass

        # Strategy 2: Search backwards across all '{' in raw_text matching the last '}'
        if parsed is None:
            last_brace = raw_text.rfind("}")
            if last_brace != -1:
                start_indices = [m.start() for m in re.finditer(r"\{", raw_text)]
                for start_idx in reversed(start_indices):
                    if start_idx < last_brace:
                        snippet = raw_text[start_idx : last_brace + 1].strip()
                        try:
                            obj = json.loads(snippet)
                            if isinstance(obj, dict):
                                parsed = obj
                                break
                        except Exception:
                            clean_snippet = re.sub(r",\s*([\]}])", r"\1", snippet)
                            clean_snippet = re.sub(r"//.*$", "", clean_snippet, flags=re.MULTILINE)
                            try:
                                obj = json.loads(clean_snippet)
                                if isinstance(obj, dict):
                                    parsed = obj
                                    break
                            except Exception:
                                pass

        if parsed is None or not isinstance(parsed, dict):
            logger.error(f"Failed to parse JSON from Gemini response:\nRaw: {raw_text}")
            raise RuntimeError(f"Gemini Web API no devolvió una extracción válida: {raw_text[:200]}")

        # Normalize structure
        code = str(parsed.get("code") or "").strip()
        try:
            total_amount = int(round(float(parsed.get("total_amount") or 0)))
        except (ValueError, TypeError):
            total_amount = 0

        data_obj = parsed.get("data") if isinstance(parsed.get("data"), dict) else {}
        issue_date = str(data_obj.get("issue_date") or parsed.get("issue_date") or "").strip()
        raw_items = data_obj.get("items") or parsed.get("items") or []

        tax_multiplier = 1.0 + (tax_val / 100.0)
        normalized_items = []

        if isinstance(raw_items, list):
            for it in raw_items:
                if not isinstance(it, dict):
                    continue
                # Parse packages and units_per_package
                raw_pkg = it.get("packages")
                packages_val: Optional[float] = None
                if raw_pkg is not None and str(raw_pkg).strip() != "" and str(raw_pkg).lower() != "null":
                    try:
                        packages_val = float(raw_pkg)
                        if packages_val <= 0:
                            packages_val = None
                    except (ValueError, TypeError):
                        packages_val = None

                raw_upp = it.get("units_per_package")
                units_per_pkg_val: Optional[float] = None
                if raw_upp is not None and str(raw_upp).strip() != "" and str(raw_upp).lower() != "null":
                    try:
                        units_per_pkg_val = float(raw_upp)
                        if units_per_pkg_val <= 0:
                            units_per_pkg_val = None
                    except (ValueError, TypeError):
                        units_per_pkg_val = None

                # Calculate quantity / stock
                if packages_val is not None and units_per_pkg_val is not None:
                    qty = round(packages_val * units_per_pkg_val)
                elif packages_val is not None:
                    qty = round(packages_val)
                elif units_per_pkg_val is not None:
                    qty = round(units_per_pkg_val)
                else:
                    try:
                        qty = float(it.get("quantity") or (0 if has_any_config else 1))
                        if qty <= 0 and not has_any_config:
                            qty = 1.0
                    except (ValueError, TypeError):
                        qty = 0.0 if has_any_config else 1.0

                try:
                    unit_p = float(it.get("unit_price") or it.get("price") or 0)
                except (ValueError, TypeError):
                    unit_p = 0.0

                try:
                    tot_p = float(it.get("total_price") or it.get("total") or (qty * unit_p))
                except (ValueError, TypeError):
                    tot_p = qty * unit_p

                # Parse cost_price
                raw_cp = it.get("cost_price")
                cost_price: Optional[int] = None
                if raw_cp is not None and str(raw_cp).strip() != "" and str(raw_cp).lower() != "null":
                    try:
                        cost_price = int(round(float(raw_cp)))
                    except (ValueError, TypeError):
                        cost_price = None

                # Parse cost_price_tax
                raw_cpt = it.get("cost_price_tax")
                cost_price_tax: Optional[int] = None
                if raw_cpt is not None and str(raw_cpt).strip() != "" and str(raw_cpt).lower() != "null":
                    try:
                        cost_price_tax = int(round(float(raw_cpt)))
                    except (ValueError, TypeError):
                        cost_price_tax = None

                code_val = str(it.get("code") or "").strip()
                if not code_val or code_val.lower() == "null":
                    code_val = None

                if has_any_config:
                    # 1. Regla estricta de código
                    if not has_code_config:
                        code_val = None

                    # 2. Reglas de costo según plantilla configurada
                    if has_cost_price_config and not has_cost_price_tax_config:
                        if cost_price is None and unit_p > 0:
                            cost_price = int(round(unit_p))
                        cost_price_tax = int(round(cost_price * tax_multiplier)) if cost_price is not None else None
                    elif not has_cost_price_config and has_cost_price_tax_config:
                        if cost_price_tax is None and unit_p > 0:
                            cost_price_tax = int(round(unit_p))
                        cost_price = int(round(cost_price_tax / tax_multiplier)) if cost_price_tax is not None else None
                    elif has_cost_price_config and has_cost_price_tax_config:
                        if cost_price is None and unit_p > 0:
                            cost_price = int(round(unit_p))
                        if cost_price_tax is None and unit_p > 0:
                            cost_price_tax = int(round(unit_p))
                    else:
                        cost_price = None
                        cost_price_tax = None
                else:
                    # Criterio contable general sin campos configurados
                    if cost_price is not None and cost_price_tax is None:
                        cost_price_tax = int(round(cost_price * tax_multiplier))
                    elif cost_price_tax is not None and cost_price is None:
                        cost_price = int(round(cost_price_tax / tax_multiplier))
                    elif cost_price is None and cost_price_tax is None and unit_p > 0:
                        cost_price = int(round(unit_p))
                        cost_price_tax = int(round(cost_price * tax_multiplier))

                final_unit_price = cost_price_tax or cost_price or (int(round(unit_p)) if unit_p > 0 else None)

                normalized_items.append(
                    {
                        "code": code_val,
                        "name": str(it.get("name") or it.get("description") or "Producto sin nombre").strip(),
                        "quantity": qty,
                        "packages": packages_val,
                        "units_per_package": units_per_pkg_val,
                        "cost_price": cost_price,
                        "cost_price_tax": cost_price_tax,
                        "unit_price": final_unit_price,
                        "total_price": tot_p if tot_p > 0 else ((final_unit_price or 0) * qty),
                    }
                )

        return {
            "code": code,
            "total_amount": total_amount,
            "data": {
                "issue_date": issue_date,
                "items": normalized_items,
            },
        }

    async def close(self):
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
