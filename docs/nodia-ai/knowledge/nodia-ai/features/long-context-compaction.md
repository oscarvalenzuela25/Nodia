---
{
  "schema_version": 1,
  "document_id": "nodia-ai.long-context-compaction",
  "product_id": "nodia-ai",
  "kind": "feature",
  "revision": 4,
  "document_status": "draft",
  "implementation": {
    "status": "implemented",
    "notes": "AI-34 implementado y activado en laboratorio: snapshots extractivos con citas, reautorización y presupuesto inicial/MCP. Compactación y continuidad reales verificadas en Web y Agentic; MCP completa un callback sintético. SQL/worker y cuenta se comprueban por capas, sin atribuir aceptación productiva. C05-R01: corrección de la frontera de deadline compartida implementada y verificada por QA4174/232, producción tipada y build; aceptación real posterior pendiente."
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento NodiaAI conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/80-nodia-ai-ai34-long-context-compaction.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/41-nodia-ai-v1-contracts.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/nodia-ai-context/use-case/process-nodia-ai-stage.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "docs/architecture/decisions/ADR-064-nodia-ai-dispatch-deadline-boundary.md",
      "kind": "specification"
    }
  ],
  "verification": {
    "checked_on": "2026-10-19",
    "evidence_paths": [
      "docs/evidence/nodia-ai-ai34-unit-validation.json",
      "docs/evidence/nodia-ai-ai34-sql-validation.json",
      "docs/evidence/nodia-ai-ai34-adapter-budgets.json",
      "docs/evidence/nodia-ai-ai34-ui-validation.json",
      "docs/evidence/nodia-ai-ai34-native-role-activation.json",
      "docs/evidence/nodia-ai-ai34-live-validation.json",
      "docs/evidence/nodia-ai-ai34-validation.json",
      "docs/evidence/nodia-ai-ai34-final-health.json",
      "docs/evidence/nodia-ai-ai36-c05-high-runtime-validation.json",
      "docs/evidence/nodia-ai-ai36-c05-r01-compiled-delta.json"
    ],
    "notes": "SQL36, Server3540, Client1716, Python Linux420, UI50 y nueve solicitudes Gemini con cinco respuestas aceptadas/cuatro fallos previos conciliados. Sin aprobación documental ni publicación MCP por esta ficha; formatos de adjuntos no revalidados tras reinicio."
  },
  "approval": null
}
---

# Contexto largo y compactación

[Producto](../README.md) · [Entrega AI-34](../../../../mvp/80-nodia-ai-ai34-long-context-compaction.md).

## Continuidad

El chat conserva sus mensajes originales. Cuando el historial ocupa el presupuesto, el worker puede pedir al mismo proveedor, modo y modelo un resumen extractivo de hechos, decisiones, dudas, entidades y requisitos. Cada entrada es una cita literal vinculada a secuencias del historial; cada mensaje nuevo visible con texto debe estar representado. Esa cobertura no garantiza recordar exhaustivamente todos sus detalles. Se conserva el resumen previo validado; no se borra memoria anterior para aparentar continuidad. Cambiar conexión, modo o modelo entre turnos reutiliza el contexto canónico autorizado, sin reproducir efectos.

## Autoridad y operaciones

El resumen no concede permisos ni confirma escrituras. Propuestas y ejecuciones se recuperan mediante referencias actuales reautorizadas; el modelo debe consultar el estado real antes de afirmar resultados o proponer reanudar. Preferencias aceptadas se cargan por separado. Una revocación invalida el snapshot y reconstruye sólo historial visible.

## Límites y recuperación

Una compactación máxima por turno, compartiendo presupuesto de dispatches. Los originales permanecen consultables en Nodia, pero la selección del modelo no garantiza recordar cada detalle. Si resumen, mensaje actual, fichas, referencias y herramientas no caben, se informa un límite explícito y se pide acotar la solicitud o iniciar otro chat. No hay reintento automático, cambio silencioso de proveedor ni ventana de tokens inventada. El backend mide el prompt nativo inicial; el proveedor no informa su ventana interna de tokens.

## Conservación

Snapshots ligados al chat y eliminados con él, incluidos al expirar por 90 días desde el último mensaje del dueño. No memoria global adicional, embeddings ni sesiones opacas. Las preferencias aceptadas conservan su ciclo independiente.

## Corrección C05-R01: plazo de la compactación

La compactación debe recibir la misma fecha absoluta del primer armado durable que aplica el worker, conforme al [ADR-064 propuesto](../../../../architecture/decisions/ADR-064-nodia-ai-dispatch-deadline-boundary.md). Su preparación queda acotada antes del armado; el envío conserva como máximo120s y el tiempo restante del job/run. No construye otra ventana al llamar al adaptador, ni renueva la fecha mediante un segundo armado. Sigue consumiendo los presupuestos acumulados de la conversación y requiere cierre/ACK antes de cualquier continuación; unknown y cancelación impiden un nuevo envío.

Estado: corrección implementada y verificada por QA técnico, sin nueva aceptación real de compactación o causa demostrada de timeout upstream. Las pruebas AI-34 anteriores mantienen su alcance histórico. No se alteran conservación, formato extractivo, permisos, contratos o publicación; ficha draft/unregistered y approval null.


La [verificación técnica del compilado corregido](../../../../evidence/nodia-ai-ai36-c05-high-runtime-validation.json) registra4174 pruebas/232 archivos, tipos de producción correctos y192 errores históricos de fixtures sin nuevos errores. El [delta compilado](../../../../evidence/nodia-ai-ai36-c05-r01-compiled-delta.json) preserva971 assets salvo dos JavaScript del worker/coordinador; los74 contratos y el release publicado permanecen idénticos. Esto no acredita inferencia, latencia ni aceptación productiva.


Alcance de despliegue C05-R01: la corrección del deadline pertenece al código y compilado candidatos, probados en harness/SQL desechable. No se copiaron esos cambios a los932 outputs Node del servicio operativo. QA4174/232 y971 assets de la candidatura no significan adopción operativa o aceptación productiva.
