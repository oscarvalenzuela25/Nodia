---
{
  "schema_version": 1,
  "document_id": "reservations.confirmed-occupancy-preparation",
  "product_id": "reservations",
  "kind": "feature",
  "revision": 1,
  "document_status": "draft",
  "implementation": {
    "status": "implemented",
    "notes": "AI-26 implementa y verifica en laboratorio privado4 puertos internos con escritores/reglas nativas, revisión exacta y recibo atómico. No publica herramientas MCP ni acredita escrituras Gemini."
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento de Reservas y NodiaAI conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/28-rental-reservations-contracts.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/41-nodia-ai-v1-contracts.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/72-nodia-ai-ai26-rental-money-occupancy-preparation.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/rental-block/dto/rental-block.dto.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/rental-block/use-case/create-rental-block.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/rental-block/use-case/update-rental-block.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/rental-turnover/dto/update-rental-turnover.dto.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/rental-turnover/use-case/update-rental-turnover.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/rental-turnover/use-case/approve-same-day-rental-turnover.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/rental-common/rental-calendar.rules.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-rental-operations/use-case/build-nodia-ai-rental-operations.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-rental-operations/nodia-ai-rental-operations.service.ts",
      "kind": "implementation"
    }
  ],
  "verification": {
    "checked_on": "2026-10-17",
    "evidence_paths": [
      "docs/mvp/72-nodia-ai-ai26-rental-money-occupancy-preparation.md",
      "docs/evidence/nodia-ai-ai26-validation.json",
      "docs/evidence/nodia-ai-ai26-postgresql.json",
      "docs/evidence/nodia-ai-ai26-regressions.json",
      "docs/evidence/nodia-ai-ai26-ui-validation.json",
      "docs/evidence/nodia-ai-ai26-client-validation.json",
      "docs/evidence/nodia-ai-ai26-tested-release-parity.json",
      "docs/evidence/nodia-ai-ai26-lab-activation.json",
      "docs/evidence/nodia-ai-ai26-deployed-equality.json",
      "docs/evidence/nodia-ai-ai26-lab-runtime.json",
      "docs/evidence/nodia-ai-ai26-knowledge-validation.json"
    ],
    "notes": "AI-26: Server2637/194, Client1526/203,310 comprobaciones SQL/HTTP/procesos (44 nuevas+266 regresiones,282 HTTP nativas) y9 QA sintéticas. Laboratorio privado con48 ejecutores,25 migraciones/18 tablas NodiaAI/241 columnas y0 pendientes; sin esquema nuevo. Ficha draft/unregistered y approval null, sin publicación MCP o aceptación de escrituras Gemini."
  },
  "approval": null
}
---

# Bloqueos y preparación confirmados — contexto funcional para NodiaAI

## Qué resuelve

Bloquear un intervalo de una casa y registrar el plan o preparación real entre huéspedes; aprobar un recambio concreto del mismo día. [AI-26/72](../../../../mvp/72-nodia-ai-ai26-rental-money-occupancy-preparation.md) integra el protocolo existente; una aprobación prevista no acredita limpieza realizada ni confirma una reserva.

## Operaciones internas

| Preparador | Efecto |
|---|---|
| `nodia_rental_blocks_prepare_create` | Crea bloqueo con intervalo, motivo y actividad |
| `nodia_rental_blocks_prepare_update` | Edita intervalo/motivo/notas o activa/desactiva bloqueo |
| `nodia_rental_turnovers_prepare_update` | Edita ropa, limpieza, hora prevista/real o notas |
| `nodia_rental_turnovers_prepare_approve_same_day` | Aprueba el plan guardado del recambio concreto del mismo día |

No hay DELETE, creación manual de preparación, confirmación comercial implícita ni herramienta MCP publicada por esta ficha.

## Mínimos y dudas

Bloquear exige casa, instante inicial/final y motivo. El final debe ser posterior; notas son opcionales/nulas y actividad sólo usa el default nativo visible. Instantes necesitan UTC u offset; al editar se usa la zona IANA de la casa, nunca la del navegador. Preguntar por casa/horas si «bloquea el fin de semana» es ambiguo. Desactivar libera el bloqueo sin eliminar su historia.

Preparación exige casa/preparación existente y al menos un campo real. linen_ready es boolean nullable: null significa sin dato, distinto de false y true. cleaning_status admite pending/in_progress/completed; planned_ready_at y ready_at son instantes opcionales/nulos, notas opcionales/nulas. No convertir ausencia en false ni hora prevista en realizada. «Ya está limpio» puede requerir preguntar por ropa y hora real para completar el mínimo de preparación efectiva.

Aprobar mismo día exige preparación concreta vigente y comando vacío; el backend resuelve reserva entrante y vecino inmediato. No reutilizar un ID ajeno ni tratarlo como aprobación general de solapamiento.

## Reglas, tiempo y acceso

Los escritores/DTOs enlazados y rental-calendar.rules definen las reglas. Bloqueos activos revalidan conflictos con estadías/bloqueos y pueden invalidar planes intersectados. Casa archivada no admite nuevos bloqueos ni activar/cambiar intervalo activo; desactivar o editar notas preserva contrato nativo. Archivar casa o reserva no borra ocupación histórica.

Preparación se refresca con vecino inmediato. Cambiar ropa, hora prevista o vecino puede invalidar la aprobación previa; hay que volver a revisar. Plan debe caber entre estadías y respetar minutos mínimos de recambio. Ready_at requiere ropa true, limpieza completed, instante no futuro ni anterior a la salida del huésped previo. Aprobar mismo día requiere reserva entrante draft/confirmed, vecino del mismo día, ropa true y plan válido. No equivale a marcar ready_at ni permite iniciar una estadía sin preparación efectiva.

Usuarios ordinarios requieren módulos NodiaAI/Reservas y acceso nativo a la casa; super_admin mantiene actor real. IDs bigint conservan strings; cada registro/reserva vecina pertenece a property_id. No se amplían permisos ni se expone SQL.

La observación administrativa usa GetExecution y recibos históricos autorizados del chat, sin confirmar/reanudar como otro usuario. La recuperación nativa GET operations/:requestKey mantiene su actor original conforme28, no es herramienta del modelo y no expone claves técnicas.

## Consultas, revisión y recuperación

Lecturas de [disponibilidad](availability-and-calendar.md) y [calendario/preparación](preparation.md) mantienen autoridad/contratos publicados. Consultar cupo no congela fechas. Esta ampliación no crea informes nuevos; datos y zona conservan procedencia.

Snapshots capturan intervalos, actividad, plan, vecinos y precondiciones materiales. Revisión humana muestra datos readonly derivados y edita sólo campos registrados; botón exacto sobre revisión/hash. Concurrencia puede exigir otra propuesta, sin aprobar silenciosamente un plan cambiado. Writer y recibo RentalEffectReceipt comparten transacción/journal; receipt identifica rental_blocks o rental_turnovers con casa/ID y operación.

Reanudar recupera recibos y conserva pasos completados. Timeout/COMMIT incierto requiere conciliación; cancelar ejecución no elimina un bloqueo comprometido ni revierte preparación. Conjuntos de entradas conocidas no incorporan bindings futuros nuevos. Contenido técnico resuelto caduca con chat según50; dominio conserva historial.

## Integración y evolución

Implementación y laboratorio privado AI-26 verificados; evidencia en [72](../../../../mvp/72-nodia-ai-ai26-rental-money-occupancy-preparation.md). Ficha draft/unregistered y approval null; publicación MCP/Gemini pendientes independientes. Las nueve fichas aprobadas de lectura no se reescriben por esta ampliación.

| Revisión | Cambio | Compatibilidad |
|---|---|---|
| 1 | AI-26 integra cuatro puertos internos de bloqueos/preparación conforme reglas nativas | Plan o vecindad cambiados requieren revalidar propuesta; recibo histórico no acredita preparación actual. Sin nueva publicación MCP |
