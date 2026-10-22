---
{
  "schema_version": 1,
  "document_id": "nodia-ai.gemini-web-viability",
  "product_id": "nodia-ai",
  "kind": "feature",
  "revision": 2,
  "document_status": "draft",
  "implementation": {
    "status": "partial",
    "notes": "harness opt-in y pruebas aisladas; adaptador de chat productivo pendiente"
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento del módulo NodiaAI conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/47-nodia-ai-ai02-gemini-web-viability.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/46-nodia-ai-ai01-contract-baseline.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/45-nodia-ai-implementation-plan.md",
      "kind": "specification"
    }
  ],
  "verification": {
    "checked_on": "2026-10-14",
    "evidence_paths": [
      "docs/evidence/nodia-ai-ai02-gemini-web-viability.json"
    ],
    "notes": "Informe, 2026-10-14; separar pruebas aisladas y cuenta real Aprobación documental anterior: Pendiente"
  },
  "approval": null
}
---

# Evaluación de conversación y herramientas Gemini Web

[Producto](../README.md). Metadatos canónicos migrados en [AI-06](../../../../mvp/52-nodia-ai-ai06-knowledge-publication-contract.md); esta revisión no cambia el estado de aprobación ni publica capacidades.

## Propósito

Cambio confirmado posterior a AI-02: Web se usará sólo para conversar. El loop fixture permanece como evidencia histórica, no capacidad a publicar. La delegación autorizada a Agentic pertenece al coordinador y a[política48](../../../../mvp/48-nodia-ai-mode-routing-policy.md); el destino API se incorpora después. Web no obtiene herramientas de dominio por activar ese switch.

Determinar si el modo Gemini Web puede mantener una conversación y completar un loop de solicitudes estructuradas, resultados de herramientas y respuestas. Configuración, perfil, autenticación, catálogo, OCR y chat con herramientas son hechos diferentes. No prometer disponibilidad del último a partir de los anteriores.

## Selección y contexto

Necesita conexión Web y modelo configurado que coincida exactamente con el descubrimiento autenticado. No elegir un modelo por nombre, primer elemento o fallback. La conversación conserva historia canónica; una continuación opaca del proveedor es una optimización condicionada a evidencia y no sustituye el historial de Nodia.

La evaluación actual es un protocolo JSON gestionado por el harness. No acredita function calling nativo ni MCP de Gemini Web. Sólo existen dos herramientas fixture, sin datos reales, endpoints ni acceso a BD. No deben anunciarse como funciones disponibles del producto.

## Autoridad y efectos

El modelo puede pedir lectura o preparación. Nunca recibe SQL, HTTP arbitrario, cookies Nodia, credenciales o token de aprobación. Una preview no está ejecutada. El botón humano y la transacción real se implementarán en AI-18; los fixtures no acreditan esa implementación ni las reglas financieras/de reservas.

## Fallos y recuperación

Una respuesta perdida, timeout o cancelación de generación queda incierta y no provoca resend automático. Salida inválida se rechaza sin ejecutar nada. Todo acceso a sesión debe compartir admisión entre chat, OCR, login y discovery antes de publicar chat. No ejecutar dos procesos sobre el mismo perfil/caché; un ensayo real debe cerrar su cliente y restaurar el servicio habitual.

## Evolución

Actualizar esta ficha y la evidencia al cambiar SDK, protocolo, selección o garantías. Conservar fuentes de cada comprobación y no extrapolar un modelo/sesión/VM a todos los modelos, a Agentic o al VPS. El estado productivo sólo cambia cuando sus gates se implementen y verifiquen.
