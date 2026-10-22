# AI-16 — Observación durable y navegación de resultados

Estado documental: en revisión; implementación solicitada por el usuario el2026-10-16. No aprueba automáticamente este documento ni la ficha de NodiaAI. La evidencia final de esta entrega se registra en `docs/evidence/nodia-ai-ai16-validation.json`.

## Alcance y fuentes

Implementa AI-16 del [plan45](45-nodia-ai-implementation-plan.md), conforme a [contratos41](41-nodia-ai-v1-contracts.md), [ERD42](42-nodia-ai-erd.md), [arquitectura43](43-nodia-ai-execution-architecture.md), [política50](50-nodia-ai-ai04-runtime-policy.md) y [página59](59-nodia-ai-ai13-chat-page.md). La observación usa consultas GET y no admite mensajes, ejecuta herramientas ni confirma cambios. Las escrituras/propuestas siguen AI-17 y posteriores. Los gates R2/externas/routing pendientes de [AI-15](61-nodia-ai-ai15-product-reads.md) conservan su estado independiente.

## Persistencia y publicación

- Reutiliza `nodia_ai_events` y `conversations.next_event_seq` de M1. No añade tablas, estado global de entrega ni copia de los resultados.
- El helper interno `event-journal.ts` recibe el manager de la transacción de admisión/transición/recibo/sellado. Bloquea la conversación, deduplica `event_key`, asigna secuencia bigint y persiste `{kind,payload}` con su scope de rutas. Una reversión revierte también evento y secuencia.
- Eventos emitidos: `run_accepted`, `run_changed`, `message_sealed` y `tool_completed`. Revisión del run creciente en cada transición pública. Claves deterministas para recibos/mensajes; un replay MCP no vuelve a emitir ni ejecutar.
- Límite publicado por política:256 eventos por actividad, con cuatro huecos reservados para cierre/conciliación. Sin fila por token, heartbeat o mensaje RPC. Payload interno máximo4KiB, sin argumentos, resultados, credenciales o diagnóstico del proveedor. El resultado completo sigue en el recibo original y se valida con el contrato exacto.
- Los adaptadores actuales entregan respuesta final. No se simula streaming, deltas ni porcentaje de avance. SSE queda sin implementar:43 permite polling durable.
- Migración incremental `1792300000000`: índice `(run_id,seq)` para eventos; historial reutiliza los UNIQUE existentes de ambos IDs de mensaje. Conserva las once tablas, columnas, restricciones y cascada de M1. La reversión elimina sólo ese índice.

## Contratos HTTP

Los cuatro GET nuevos están en [coordinación](nodia-ai-v1-coordination-api.json) y usan `Cache-Control: no-store`. Autenticación normal y casos de uso; no secretos/modelos/argumentos SQL desde el cliente.

| Ruta bajo `/api/v1/nodia-ai` | Salida | Garantía |
|---|---|---|
| `runs/:id` | `RunSummary` | Estado actual, propietario/omnisciencia y expiración revalidados |
| `runs/:id/events` | `EventPage` | Ventana secuencial acotada; refs autorizadas |
| `tool-calls/:id/result` | Schema de salida exacto de la herramienta | Mantiene el contrato dinámico previsto en41; sin wrapper JSON genérico |
| `tool-calls/:id/observation` | `ToolObservation` | Metadata cerrada: fuente, fecha histórica, conteos disponibles y destinos permitidos |

`Message.run_id` es UUID o null, obligatorio en proyecciones visibles y restringidas. La asociación se resuelve con una consulta por ventana, no una por mensaje. El cliente sólo ofrece actividad en mensajes visibles; cargar historial no dispara consultas de todos sus runs.

### Cursor y reconexión

`EventPage` añade `has_more:boolean`. `next_cursor` es el último punto **escaneado**, incluso cuando no hay eventos visibles o se llegó al final. Sólo `reset_required` devuelve null; una ventana inicialmente vacía tiene checkpoint0 válido. `has_more` permite drenar backlog antes de detener observación terminal. El cursor no es prueba de autorización.

El envelope de cursor liga actor/sesión/conversación/run/retention_epoch. La posición conserva secuencia bigint como string y una huella de visibilidad: rutas actuales y resultados registrados restringidos. Cursor malformado, de otro actor/sesión/run o futuro:400. Cambio de visibilidad: página vacía `reset_required`; el cliente descarta refs/resultados, recupera snapshot y reinicia observación. Un recibo nuevo autorizado no invalida los anteriores. No existe marca global `delivered`.

Se reautorizan los recibos registrados completados del run, incluidos al consultar su cola vacía: máximo12 por política. Cada lectura usa el aislamiento nativo del dominio, fuera de la transacción del feed. Después hay una barrera final de sesión/chat/módulos/acciones. La autorización de cada recurso se observa en su propia transacción; no se promete un snapshot atómico entre dominios. El presupuesto acota esta revalidación, aunque puede requerir dos transacciones por recibo. No se consultan proveedores ni handlers. Los resultados técnicos de catálogo/conocimiento quedan fuera de la UI de resultados de dominio.

Los chats anteriores no tenían eventos. Se conserva su snapshot real y ventana vacía; no se inventa historia, fecha ni actividad pasada. Verlos no vuelve a ejecutar herramientas. La retención sigue contando el último mensaje del dueño; observar no renueva90 días.

### Resultado y autoridad

La recuperación humana no depende del grant, lease o sesión antigua del worker. Requiere una sesión actual, acceso al chat, capacidad publicada y hash exacto, argumentos/hash válidos, salida validada y comprobaciones actuales `verifyAuthority`/`verifyResultAuthority`. Finanzas conserva REPEATABLE READ; Reservas READ COMMITTED. No se llama `handler`, `external.prepare` ni checkpoint runtime para recuperar un recibo.

Una revocación impide recuperar el resultado y sus enlaces. `super_admin` consulta bajo su identidad real y la inspección ajena queda auditada; no adquiere la identidad del dueño ni confirmación de escrituras. Estado incompleto/unknown o contrato retirado no se convierte en resultado vacío exitoso. Datos persistidos corruptos son un error explícito.

## Página y navegación

La página observa el turno actual con polling incremental; drena páginas pendientes y se detiene al completar el turno. Los turnos anteriores se abren por intención mediante `run_id` del mensaje: GET del resumen y del feed, sin inferencia. Cache de observación separada por actor/sesión/conversación/run y por navegador/dispositivo. Sin contenido persistido en localStorage ni acknowledgments globales.

La UI deduplica IDs/secuencias, conserva borrador/foco y no emite toasts por éxitos observados. Un fallo genera un aviso por episodio, estado local y retry GET. Cambiar de conversación cancela observación, no el trabajo del worker. Una denegación limpia la proyección sensible; un fallo temporal no presenta datos antiguos como actualizados.

`observed_at` es `tool_call.completed_at`, fecha de la consulta original. No indica cuándo cambió por última vez un registro ni que los valores sigan vigentes. `total` sólo se obtiene de `meta.total_items`; `returned` de la colección devuelta. Ausencia permanece null; cero real se muestra. No se suma una página para inferir un total.

Destinos estructurados, máximo25: detalle de Negocio por UUID; contexto de alojamiento en Reservas por bigint; o módulo real cuando no existe ruta de detalle. Server resuelve desde el registro y campos nativos verificados; Client aplica una segunda allowlist. Ninguna URL o query del modelo se ejecuta. Finanzas y otros recursos sin deep link individual abren su módulo; no se finge seleccionar un registro. Navegar abre la vista/API actual, que vuelve a autorizar. Las descargas de AI-15 mantienen su contrato independiente.

## Verificación y límites

La integración usa PostgreSQL desechable y adaptadores explícitamente sintéticos para probar secuencias concurrentes, deduplicación, rollback, cuota reservada, cascada, índices, contratos HTTP y revocaciones. Las pruebas de Client cubren cursores/reset/reconnect, historial por intención, errores, navegación y conservación del borrador. La evidencia final distingue estos resultados de cualquier prueba Gemini o despliegue local.

Pendientes ajenos: SSE/token streaming real, preparación/confirmación/escrituras, reportes generales y gates productivos de retención/servicios. La cancelación humana HTTP sigue declarada pero no implementada en el baseline; AI-16 observa las transiciones de cancelación/conciliación ya existentes del worker. No se amplía su alcance silenciosamente.

Ficha actualizada: [coordinación](../nodia-ai/knowledge/nodia-ai/features/conversation-coordination.md). Decisión técnica: [ADR-043](../architecture/decisions/ADR-043-nodia-ai-durable-observation.md).

Cierre local:19 comprobaciones de productores y29 HTTP/autoridad con PostgreSQL16 desechable, además de la regresión helper anterior fallida→actual correcta. Gemini real completó desde la página1dispatch/1tool/7RPC y7eventos; se salió durante ejecución, regresó, abrió metadata y navegó al módulo sin replay. Resultado0/0 contrastado con SQL. La [activación local](../evidence/nodia-ai-ai16-lab-activation.json) conserva proveedor/perfil/dependencias y registra backup previo, único índice y21migraciones. Servicios permanecen encendidos. [Resumen verificable](../evidence/nodia-ai-ai16-validation.json); no acredita VPS público o gates pendientes de AI-15.
