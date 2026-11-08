# ADR-076 — Detención humana y durable de un turno de NodiaAI

> Estado: propuesto; Server R08 y Client R03 adoptados en VM Linux local; aceptación Stop UI/cuenta real separada.
> Fecha: 2026-10-24.

## Contexto

AI-40 ya verificó cancelación nativa y conciliación de Codex en un fixture, pero la página no ofrecía detener un turno. El contrato41 describía `POST /nodia-ai/runs/:id/cancel`; no existía su controlador productivo. Cancelar una ejecución de efectos confirmados y cancelar una propuesta son operaciones diferentes.

El usuario solicita completar los pendientes de AI-40, incluida la detención desde UI. El control debe conservar la autoridad, los locks, el presupuesto y la conciliación existentes, sin presentar una solicitud HTTP como prueba de cierre del proveedor.

## Opciones consideradas

### Llamar al adaptador o matar un proceso desde HTTP

Acopla la API al host y al proceso del worker; no cubre caídas, ownership, fences o solicitudes concurrentes. Un PID enviado por el cliente no constituye autoridad. Se descarta.

### Persistir una solicitud sobre el run y reutilizar el worker

Mantiene una sola identidad de turno y el protocolo de heartbeat, checkpoint, recuperación y ACK ya implementado. Requiere un canal humano autenticado y evitar que un candidato cancelado vuelva a reclamarse.

## Decisión

Implementar el segundo camino mediante el contrato existente: body cerrado `{client_request_id}` y respuesta `{status, run}`, con `status: accepted | already_terminal`. Derivar identidad del contexto autenticado y exigir escritura sobre el chat propio. `super_admin` no obtiene por este canal control de turnos ajenos.

La transición de `queued` o `running` a `cancel_requested` se serializa con autoridad, cola, chat, job y run, y comprueba estado/revisión bajo lock. Repetir la solicitud sobre el mismo run es idempotente: no añade eventos ni admite otra generación. El recurso run identifica la intención monotónica; el UUID del body no representa una nueva ejecución ni una tabla de deduplicación global.

El CAS usa un CTE `UPDATE ... RETURNING` terminado en `SELECT`: el driver PostgreSQL de TypeORM devuelve `[rows, rowCount]` para un comando UPDATE directo, y filas para SELECT. La comprobación de una única fila debe respetar esa frontera; una forma equivocada no puede convertirse en conflicto de revisión permanente ni corregirse ocultando la forma real en mocks.

El HTTP no cambia grants, slots, fences ni procesos. El worker conserva la responsabilidad del cierre y la conciliación. Un resultado incierto permanece incierto. Los estados `completed`, `failed`, `cancelled`, `unknown` y `waiting_for_user` devuelven su estado actual; el último tiene la generación detenida y no se convierte por este canal en cancelación de una propuesta o efecto.

La selección de candidatos reclama sólo runs `queued`; la recuperación existente procesa los `cancel_requested`. La UI muestra «detención solicitada» mientras espera el estado final. Ante una respuesta incierta conserva la identidad del comando, consulta el estado antes de habilitar un reintento explícito de esa misma solicitud y nunca reenvía una inferencia.

## Consecuencias

No se añaden tablas, columnas, migraciones, herramientas MCP o permisos. El control no deshace efectos confirmados ni borra mensajes. Salir de la página conserva el comportamiento de continuar el trabajo; detener exige una acción explícita.

Pruebas atómicas verifican autoridad, transiciones y recuperación. R08 pasó13 comprobaciones con PostgreSQL desechable: concurrencia de solicitudes, locks/CAS y carrera con claim, bloqueo de persistencia tardía, incertidumbre tras armado y rollback de estado/revisión si falla el evento. Server R08 y Client R03 quedaron adoptados en la VM Linux local sin inferencias nuevas. El botón Stop con la cuenta real requiere su propia aceptación; un test SQL o una adopción no acreditan cierre de procesos nativos ni un botón humano observado. La [validación de pendientes](../../evidence/nodia-ai-ai40-remaining-validation-r01.json) conserva sus alcances.

## Referencias

- [Contratos41](../../mvp/41-nodia-ai-v1-contracts.md).
- [Worker AI-11](../../mvp/57-nodia-ai-ai11-durable-worker.md).
- [Aceptación AI-40](../../mvp/86-nodia-ai-ai40-codex-acceptance.md).
- [Cancelación nativa y límites históricos](../../evidence/nodia-ai-ai40-recovery-acceptance-r01.json).
- [Regresión aislada del canal de detención](../../../nodia-server/test/nodia-ai-run-cancellation.integration.mjs).
