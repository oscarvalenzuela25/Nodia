import json
import re
from typing import Any, Dict, Optional, Tuple
from pydantic import ValidationError
from schemas import InvoiceAnalysisResponse
from service_errors import InvalidExtraction


def is_refusal_response(text: str) -> bool:
    """Checks if model returned a standard refusal or reported inability to see/process attachments."""
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


def build_invoice_prompt(
    provider_fields: Optional[dict] = None,
    provider_tax: Optional[int] = None,
    *, structured_output: bool = False,
) -> Tuple[str, bool, bool, bool, bool, int]:
    """
    Construye el prompt de extracción y retorna:
    (prompt, has_any_config, has_code_config, has_cost_price_config, has_cost_price_tax_config, tax_val)
    """
    tax_val = int(provider_tax) if provider_tax is not None and 0 <= provider_tax <= 100 else 19

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
- "quantity": si se detectan "packages" y "units_per_package", calcula su multiplicación como la cantidad total de unidades. Si solo existe uno, usa ese valor. Si no existe ninguno, usa la cantidad detectada o null. Nunca sustituyas cero por uno.
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
- "quantity": cantidad adquirida total (número si aparece, o null; nunca asumas 1).
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
3. Si falta un valor numérico, devuelve null. Conserva explícitamente cero.
4. Asegúrate de que todos los valores numéricos sean válidos (sin símbolos '$', puntos de miles o comas).
"""
    if structured_output:
        prompt = prompt.replace(
            "Responde ÚNICAMENTE con el objeto JSON entre bloques de código ```json y ```.",
            "Responde ÚNICAMENTE con un objeto JSON válido, sin bloques Markdown.",
        )
    return prompt, has_any_config, has_code_config, has_cost_price_config, has_cost_price_tax_config, tax_val


def clean_and_parse_invoice_json(
    raw_text: str, has_any_config: bool = False, has_code_config: bool = False,
    has_cost_price_config: bool = False, has_cost_price_tax_config: bool = False,
    tax_val: int = 19,
    provider_fields: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Parse one JSON object; do not guess numbers or salvage malformed line items."""
    if not isinstance(raw_text, str) or len(raw_text) > 2_000_000:
        raise InvalidExtraction()
    text = raw_text.strip()
    if text.startswith("```"):
        match = re.fullmatch(r"```(?:json)?\s*([\s\S]*?)\s*```", text, flags=re.IGNORECASE)
        if not match:
            raise InvalidExtraction()
        text = match.group(1)

    def unique_object(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError("Duplicate key")
            result[key] = value
        return result

    try:
        obj = json.loads(text, object_pairs_hook=unique_object)
        # Validate before applying template restrictions so invalid values cannot be hidden.
        invoice = InvoiceAnalysisResponse.model_validate(obj)
        for item in invoice.data.items:
            if has_any_config:
                if not has_code_config:
                    item.code = None
                if not has_cost_price_config:
                    item.cost_price = None
                if not has_cost_price_tax_config:
                    item.cost_price_tax = None
                # Unit price has no configured net/gross meaning in a template.
                item.unit_price = None
                if provider_fields is not None:
                    for field in ("packages", "units_per_package"):
                        config = parse_field_config(provider_fields.get(field))
                        if not config or not config.get("value"):
                            setattr(item, field, None)
            if item.quantity is None and item.packages is not None and item.units_per_package is not None:
                item.quantity = item.packages * item.units_per_package
        # Derived arithmetic can overflow too; revalidate the serialized result.
        return InvoiceAnalysisResponse.model_validate(invoice.model_dump()).model_dump()
    except (ValueError, TypeError, ValidationError, RecursionError, OverflowError):
        raise InvalidExtraction() from None
