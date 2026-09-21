import json
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional
from loguru import logger
from gemini_webapi import GeminiClient
from gemini_webapi.exceptions import AuthError, GeminiError

class GeminiWebService:
    def __init__(self):
        self.secure_1psid = os.getenv("GEMINI_SECURE_1PSID", "").strip()
        self.secure_1psidts = os.getenv("GEMINI_SECURE_1PSIDTS", "").strip()
        self.client: Optional[GeminiClient] = None
        self.is_initialized = False
        self.tier = "UNKNOWN"
        self.credits_remaining = None

    async def init_client(self, force_refresh: bool = False):
        if self.client and self.is_initialized and not force_refresh:
            return

        if not self.secure_1psid or not self.secure_1psidts:
            logger.warning("Gemini cookies not configured in .env (GEMINI_SECURE_1PSID / GEMINI_SECURE_1PSIDTS)")
            self.is_initialized = False
            return

        try:
            logger.info("Initializing Gemini Web API client...")
            if self.client:
                try:
                    await self.client.close()
                except Exception:
                    pass

            self.client = GeminiClient(self.secure_1psid, self.secure_1psidts)
            # auto_refresh keeps session cookies updated in background
            await self.client.init(timeout=60, auto_refresh=True, refresh_interval=600)
            self.is_initialized = True
            logger.success("Gemini Web API client successfully connected and authenticated.")
        except AuthError as e:
            self.is_initialized = False
            logger.error(f"Authentication failed. Cookies may have expired: {e}")
            raise e
        except Exception as e:
            self.is_initialized = False
            logger.error(f"Failed to initialize Gemini Web API client: {e}")
            raise e

    async def get_status(self) -> Dict[str, Any]:
        return {
            "initialized": self.is_initialized,
            "has_cookies": bool(self.secure_1psid and self.secure_1psidts),
            "tier": getattr(self.client, "tier", "PRO" if self.is_initialized else "UNKNOWN"),
        }

    async def generate_text(self, prompt: str, files: Optional[List[Path]] = None) -> str:
        await self.init_client()
        if not self.client or not self.is_initialized:
            raise RuntimeError("Gemini Web client is not initialized. Please check cookies in .env.")

        file_args = [f for f in files if f.exists()] if files else None
        response = await self.client.generate_content(prompt, files=file_args)
        return response.text or ""

    async def analyze_invoice(
        self,
        file_path: Path,
        provider_fields: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        await self.init_client()
        if not self.client or not self.is_initialized:
            raise RuntimeError("Gemini Web client is not initialized. Please check cookies in .env.")

        provider_context = ""
        if provider_fields:
            provider_context = f"""
Información adicional del proveedor y mapeo de campos esperado:
{json.dumps(provider_fields, ensure_ascii=False, indent=2)}
"""

        prompt = f"""
Eres un asistente experto en contabilidad y OCR de facturas de proveedores comerciales.
Analiza detenidamente el documento o imagen adjunta (factura comercial, boleta o comprobante de compra).
{provider_context}

Debes extraer y estructurar la información obligatoriamente en formato JSON válido con el siguiente esquema estricto:
{{
  "code": "Número o folio del comprobante (string, e.g. '097514959')",
  "total_amount": 123456, // Monto total de la factura como número entero sin decimales
  "data": {{
    "issue_date": "YYYY-MM-DD", // Fecha de emisión si está visible, de lo contrario cadena vacía
    "items": [
      {{
        "code": "Código interno o SKU del producto (string)",
        "name": "Nombre o descripción del producto (string)",
        "quantity": 10, // Cantidad como número entero o float
        "unit_price": 1000, // Precio unitario como número entero o float
        "total_price": 10000 // Subtotal o precio total del ítem como número
      }}
    ]
  }}
}}

Reglas estrictas:
1. Responde ÚNICAMENTE con el objeto JSON entre bloques de código ```json y ```.
2. No agregues texto introductorio, explicaciones ni saludos antes o después del bloque JSON.
3. Asegúrate de que todos los valores numéricos sean válidos (sin símbolos '$', puntos de miles o comas).
4. Si algún ítem no tiene código visible, genera un código abreviado razonable basado en el nombre (ej. 'COCA-15L').
"""

        response = await self.client.generate_content(prompt, files=[file_path])
        raw_text = response.text or ""
        logger.info(f"Gemini raw response length: {len(raw_text)}")

        return self._clean_and_parse_json(raw_text)

    def _clean_and_parse_json(self, raw_text: str) -> Dict[str, Any]:
        # Extract markdown json block if present
        json_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw_text, re.DOTALL)
        if json_match:
            candidate_json = json_match.group(1).strip()
        else:
            # Try to find the outermost braces
            first_brace = raw_text.find("{")
            last_brace = raw_text.rfind("}")
            if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
                candidate_json = raw_text[first_brace : last_brace + 1].strip()
            else:
                candidate_json = raw_text.strip()

        try:
            parsed = json.loads(candidate_json)
        except Exception as e:
            logger.error(f"Failed to parse JSON from Gemini response: {e}\nRaw: {raw_text}")
            return {
                "code": "",
                "total_amount": 0,
                "data": {
                    "issue_date": "",
                    "items": [],
                    "raw_output": raw_text,
                },
            }

        # Normalize structure
        code = str(parsed.get("code") or "").strip()
        try:
            total_amount = int(round(float(parsed.get("total_amount") or 0)))
        except (ValueError, TypeError):
            total_amount = 0

        data_obj = parsed.get("data") if isinstance(parsed.get("data"), dict) else {}
        issue_date = str(data_obj.get("issue_date") or parsed.get("issue_date") or "").strip()
        raw_items = data_obj.get("items") or parsed.get("items") or []

        normalized_items = []
        if isinstance(raw_items, list):
            for it in raw_items:
                if not isinstance(it, dict):
                    continue
                try:
                    qty = float(it.get("quantity") or 1)
                except (ValueError, TypeError):
                    qty = 1.0

                try:
                    unit_p = float(it.get("unit_price") or it.get("price") or 0)
                except (ValueError, TypeError):
                    unit_p = 0.0

                try:
                    tot_p = float(it.get("total_price") or it.get("total") or (qty * unit_p))
                except (ValueError, TypeError):
                    tot_p = qty * unit_p

                normalized_items.append(
                    {
                        "code": str(it.get("code") or "").strip(),
                        "name": str(it.get("name") or it.get("description") or "").strip(),
                        "quantity": qty,
                        "unit_price": unit_p,
                        "total_price": tot_p,
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
        if self.client:
            try:
                await self.client.close()
            except Exception:
                pass
            self.client = None
            self.is_initialized = False
