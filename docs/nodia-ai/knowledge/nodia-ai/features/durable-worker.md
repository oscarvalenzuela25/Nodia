---
{
  "schema_version": 1,
  "document_id": "nodia-ai.durable-worker",
  "product_id": "nodia-ai",
  "kind": "feature",
  "revision": 7,
  "document_status": "draft",
  "implementation": {
    "status": "implemented",
    "notes": "AI-11: worker independiente, leases/fences, perfil compartido y conciliación sin replay implementados; worker Gemini Agentic y cancelación con SQL real verificados en VM. Despliegue y gates productivos siguen independientes. AI-20 conecta claim/fence del worker para un movimiento local, conciliación SQL sin replay, cancelación y reanudación humanas bajo contrato original; preparación MCP todavía sin publicar. C05-R01: corrección de la frontera de deadline compartida implementada y verificada por QA4174/232, producción tipada y build; aceptación real posterior pendiente."
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento NodiaAI conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/57-nodia-ai-ai11-durable-worker.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/nodia-ai-worker.module.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-runtime/use-case/run-nodia-ai-stage.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-runtime/use-case/recover-nodia-ai-jobs.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "docs/mvp/66-nodia-ai-ai20-execution-recovery.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/82-nodia-ai-ai36-integral-coverage.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/nodia-ai-runtime/use-case/checkpoint-nodia-ai-job.use-case.ts",
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
      "docs/evidence/nodia-ai-ai11-ai12-final-regression.json",
      "docs/evidence/nodia-ai-ai11-ai12-live-validation.json",
      "docs/evidence/nodia-ai-ai11-ai12-live-agentic-worker.json",
      "docs/evidence/nodia-ai-ai11-ai12-live-unknown.json",
      "docs/evidence/nodia-ai-ai20-validation.json",
      "docs/evidence/nodia-ai-ai36-regressions.json",
      "docs/evidence/nodia-ai-ai36-c05-high-runtime-validation.json",
      "docs/evidence/nodia-ai-ai36-c05-r01-compiled-delta.json"
    ],
    "notes": "Regresión Server1240/142 y PostgreSQL desechable; worker independiente Agentic real9checks y cancelación/conciliación SQL real13checks. Cuenta, selección y VM verificadas; no extrapolar a otros adaptadores ni a producción. Evidencia AI-20 distingue SQL/procesos desechables y QA sintético de Gemini/preparación MCP."
  },
  "approval": null
}
---

# Ejecución durable del chat

[Producto](../README.md). [Entrega57](../../../../mvp/57-nodia-ai-ai11-durable-worker.md).

## Qué resuelve

Continuar un turno admitido aunque se cierre la página y evitar duplicar inferencias o efectos después de un timeout. Ejemplo: «dejé el chat respondiendo y volví después». Depende de un worker operativo y de la disponibilidad real del proveedor.

## Operaciones y datos mínimos

No es una herramienta invocable por el modelo ni un nuevo formulario. Cada etapa usa job, intento, lease/fence, deadline y grant del actor original. Contexto y resultado avanzan mediante commits cortos. El presupuesto se consume antes del dispatch y no se reinicia por cambiar de etapa.

## Reglas y autoridad

Releer autoridad/sesión/grant en cada frontera. Ningún mensaje o preferencia habilita herramientas. El worker no mantiene SQL abierto durante inferencia. Chat, OCR, login y descubrimiento comparten reserva del perfil físico en el servicio privado; los slots SQL ordenan workers y conservan incertidumbre.

## Recuperación y retención

Un intento conocido sin dispatch puede reintentarse bajo presupuesto. Un dispatch incierto no se reenvía ni libera por vencer el lease; requiere conciliación. El supervisor privado acredita el cierre de la operación exacta; super_admin reautoriza la conciliación antes del commit que libera el slot SQL. Una prueba `abandoned_unknown` conserva la incertidumbre remota: no afirma ausencia de efectos. Después del commit se acusa el recibo nativo; un fallo conserva únicamente el pendiente mínimo de limpieza.

El apagado deja de admitir y drena con plazo. Los trabajos terminados se borran con el chat; sólo los pendientes mínimos sobreviven hasta resolverlos. No existen filtros o sumas de negocio aplicables a esta infraestructura.

## Estado de integración

Draft/unregistered; implementación AI-11 verificada mediante PostgreSQL desechable, procesos compilados y Gemini real. El worker independiente completó un turno con MCP técnico, liberó el slot y terminó ante SIGTERM; la verificación cerró el acuse de su prueba. La cancelación durante un callback real dejó run/job/slot en `unknown`; la conciliación comprobó el cierre nativo, acusó el recibo y liberó capacidad sin reenviar la inferencia. No se modificó la BD de negocio configurada.

La matriz previa de concurrencia comprobó exclusión de chat/OCR/login/discovery e independencia de perfiles Web/Agentic. Estas pruebas pertenecen a una cuenta, selección y VM; no publican herramientas de negocio ni cierran backups, carga, conservación remota o despliegue productivo. Cambiar locks, tiempos o reservas exige revisar concurrencia, procesos tardíos y compatibilidad con OCR/login.


## Extensión AI-20: ejecución local y recuperación

[Entrega66](../../../../mvp/66-nodia-ai-ai20-execution-recovery.md) conecta el worker al efecto financiero de un solo paso y habilita su admisión nativa exacta. Cancelar espera las barreras SQL: conserva un commit realizado y cancela sólo lo no comprometido. Recuperar nunca invoca el escritor; un rollback local probado permite reanudación explícita con la misma identidad/hash y sesión vigente. Cambios materiales exigen otra propuesta/botón. El chat puede reabrirse para observar el recibo y abrir Finanzas; el recibo es histórico. Purga de chat elimina su journal resuelto sin borrar el movimiento. No hay tablas/columnas nuevas, aprobación documental ni preparación MCP publicada. Secuencias y otras operaciones mantienen sus etapas.

## Regresión AI-36: rechazo previo al envío

El agotamiento del presupuesto de envío/delegación o una selección inválida comprobados dentro del checkpoint, antes de escribir `dispatch_armed`, son fallos conocidos: no llaman al proveedor y permiten liberar la reserva local. El worker exige la identidad exacta del rechazo local; no basta que una excepción tenga el mismo mensaje o tipo. Si la respuesta SQL cambia o se pierde, o ya hubo un armado anterior, conserva `unknown` y la conciliación sin replay. Esta corrección no aumenta presupuestos ni habilita modos o herramientas. La [entrega82](../../../../mvp/82-nodia-ai-ai36-integral-coverage.md) distingue regresiones con PostgreSQL desechable de aceptación Gemini.

## Corrección C05-R01: frontera única de envío

La preparación de una etapa y el envío al proveedor tienen plazos acotados distintos. Conforme al [ADR-064 propuesto](../../../../architecture/decisions/ADR-064-nodia-ai-dispatch-deadline-boundary.md), la preparación usa como máximo120s dentro de los deadlines job/run. El primer armado confirmado tras commit, con señal y fence vigentes, fija una única fecha absoluta de hasta120s por envío, compartida por worker y adaptador. Otro armado no la renueva. La ventana global600s, drain150s, presupuestos, pruebas de cierre y conciliación/ACK permanecen vigentes. Un armado de commit incierto conserva unknown; no habilita reenvío.

Estado de esta corrección: implementada y verificada por QA técnico; no se atribuye resolución del timeout upstream ni nueva aceptación Gemini. Las comprobaciones anteriores pertenecen a sus compilados históricos. La ficha sigue draft/unregistered, sin aprobación ni herramienta nueva.


La [verificación técnica del compilado corregido](../../../../evidence/nodia-ai-ai36-c05-high-runtime-validation.json) registra4174 pruebas/232 archivos, tipos de producción correctos y192 errores históricos de fixtures sin nuevos errores. El [delta compilado](../../../../evidence/nodia-ai-ai36-c05-r01-compiled-delta.json) preserva971 assets salvo dos JavaScript del worker/coordinador; los74 contratos y el release publicado permanecen idénticos. Esto no acredita inferencia, latencia ni aceptación productiva.


Alcance de despliegue C05-R01: la corrección del deadline pertenece al código y compilado candidatos, probados en harness/SQL desechable. No se copiaron esos cambios a los932 outputs Node del servicio operativo. QA4174/232 y971 assets de la candidatura no significan adopción operativa o aceptación productiva.
