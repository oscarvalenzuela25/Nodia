# ADR-045 — Canal humano y admisión verificable de propuestas NodiaAI

> Estado: propuesto; implementación AI-18 solicitada, sin aprobación documental automática
> Fecha: 2026-10-17

## Contexto

AI-17 conserva propuestas con revisiones, comandos y proyecciones congeladas verificables mediante JCS/hash. Falta vincular la vista previa exacta con una autorización humana que el modelo no pueda producir como herramienta. Una confirmación puede concurrir entre dispositivos o comprometerse aunque su respuesta HTTP se pierda. Además, todavía no existe el ejecutor nativo de AI-19/20: almacenar trabajos admitidos sin un consumidor operativo dejaría chats bloqueados y aparentaría disponibilidad inexistente.

El usuario confirmó botón sobre la propuesta exacta, revisión previa de los cambios y continuidad al salir de la página. Super_admin conserva acceso transversal con identidad real; leer un chat ajeno no autoriza confirmar como su dueño. La política50 exige eliminar contenido y recibos resueltos con el chat, conservando sólo pendientes mínimos de conciliación.

## Opciones consideradas

### Opción A — Confirmación conversacional o nonce dentro del modelo

- Ventajas: menos coordinación entre UI y backend.
- Desventajas: el modelo puede fabricar o repetir el consentimiento; texto y resumen no identifican el comando exacto. Amplía innecesariamente el canal de autoridad y no resuelve deduplicación.

### Opción B — Canal humano separado y transacción de admisión condicionada a ejecutores registrados

- Ventajas: vincula actor/sesión/revisión/hash, permite recuperar la misma admisión y deja el comando persistido como única fuente de ejecución. El gate del servidor separa contrato implementado de disponibilidad real.
- Desventajas: requiere persistencia de desafíos/ejecuciones/pasos, constraints, coordinación con cola y pruebas de carreras. Un nonce aislado no constituye prueba física de interacción humana.

### Opción C — Admitir ejecuciones queued desde AI-18 aunque no exista ejecutor

- Ventajas: permite mostrar una confirmación aceptada desde esta etapa.
- Desventajas: crea trabajos sin consumidor, ocupa el chat y exige mantenimiento/cancelación sólo para sostener una indisponibilidad conocida.202 podría interpretarse como un efecto que todavía no puede realizarse.

## Decisión

Se implementa B. Las rutas humanas de challenge/confirm no se publican como MCP y no entregan nonce ni sesión autenticada al runtime del modelo. La UI obtiene metadatos para la propuesta exacta y solicita el desafío sólo desde su revisión activa.

El desafío contiene32 bytes aleatorios en base64url canónico de43 caracteres; se persiste únicamente su digest SHA-256 junto a actor, sesión pública, propuesta/revisión/hash y vencimiento. El plazo es el mínimo de120 segundos, sesión, propuesta y chat. UPSERT por propuesta/revisión/actor/sesión rota el desafío de esa sesión sin reemplazar los de otros dispositivos.

`NODIA_AI_EXECUTION_ADMISSION` registra contratos concretos de ejecutores en código del servidor. Su registro productivo queda vacío: los metadatos indican indisponibilidad y el primer challenge/confirm responde503 `execution_unavailable`. Los tests aislados pueden inyectar registros sintéticos para verificar el protocolo completo. Configuración, una sesión del proveedor o un preparador registrado no sustituyen un ejecutor verificado. AI-19/20 incorporarán el efecto y su recuperación antes de abrir ese gate y los de publicación MCP.

La admisión usa el orden autoridad → cola → chat. Una sola transacción valida el contenido congelado, autoridad y precondiciones; consume desafío/revisión y crea ejecución, pasos, grant, job y evento. No invoca un escritor nativo. Grant y deadline se acotan por política, sesión y chat, sin renovar la retención. No se recalculan valores para modificar lo aprobado. Si cambian condiciones materiales,409 `preconditions_changed` revierte la operación; no se simula una invalidación durable que también revertiría.

La identidad de intención es actor, propuesta de origen, revisión y hash, asociada a un `client_request_id` original. Su repetición reautorizada devuelve202 con la misma ejecución aunque el nonce anterior esté consumido o vencido. Un token diferente bien formado no cambia el efecto ya admitido. El mismo request con otra intención devuelve409. Un request distinto para el mismo origen ya admitido devuelve409 `proposal_already_confirmed`, recuperable mediante GET; no se guardan aliases ni un segundo hash redundante de request. Las restricciones únicas de actor/request y origen de propuesta impiden ejecuciones duplicadas.

La migración añade tres tablas M2 con44 columnas y cuatro columnas en jobs/events/grants existentes. Las identidades de headers/pasos son inmutables, el origen de los pasos pertenece a la revisión confirmada y las proyecciones comprueban integridad contra ella. Comandos y previews permanecen en la revisión fuente; `execution_payloads` queda para su necesidad real en AI-19.

Los metadatos humanos autorizados declaran campos escalares registrados; el editor inicial ofrece nombre, importe, tipo, estado y actividad de Finanzas. No añade JSON paths ni entradas libres de IDs/destinatarios. Cambiar valores crea otra revisión/hash y conserva el TTL original. Inspecciones ajenas de super_admin e históricos son de sólo lectura.

## Consecuencias

- Consecuencias positivas: la confirmación se refiere a contenido verificable, los reintentos recuperan identidades durables y no dependen del texto del modelo. La UI puede mantener edición/foco y recuperar operaciones sin reenvío automático. El gate productivo evita admitir trabajo que todavía no tiene ejecutor.
- Costos o riesgos aceptados: nuevas constraints/FKs y coordinación transaccional; el nonce debe permanecer fuera de prompt, logs, cachés y almacenamiento del navegador. La prueba del protocolo con un registro sintético no acredita una escritura real ni el aislamiento de un nuevo adaptador. Cada ejecutor debe volver a validar autoridad/precondiciones al realizar su efecto.
- Conservación: queued y recibos resueltos se purgan con el chat. Sólo estados operacionales inciertos retienen identidad mínima hasta conciliación; no se conserva un archivo adicional de chats ni un comando para ejecutarlo tras caducar.
- Trabajo posterior: AI-19/20 incorporarán el ejecutor nativo, efecto/recibo, fences, recuperación y cancelación antes de habilitar el registro y publicar preparadores. Selectores de entidades y otras capacidades conservan sus etapas. Los checks y la activación de laboratorio se documentan en evidencia sin aprobar automáticamente este ADR.

## Referencias

- [Entrega AI-18/64](../../mvp/64-nodia-ai-ai18-human-confirmation.md) y [evidencia AI-18](../../evidence/nodia-ai-ai18-validation.json).
- [Plan45](../../mvp/45-nodia-ai-implementation-plan.md), [contratos41](../../mvp/41-nodia-ai-v1-contracts.md), [schemas comunes](../../mvp/nodia-ai-v1-common-contracts.schema.json) y [coordinación](../../mvp/nodia-ai-v1-coordination-api.json).
- [Arquitectura43](../../mvp/43-nodia-ai-execution-architecture.md), [política50](../../mvp/50-nodia-ai-ai04-runtime-policy.md) y [borradores/revisiones63](../../mvp/63-nodia-ai-ai17-drafts-revisions.md).
- [ADR-033](ADR-033-nodia-ai-confirmation-and-sequential-recovery.md), [ADR-034](ADR-034-nodia-ai-postgres-jobs-and-retention.md) y [ADR-044](ADR-044-nodia-ai-frozen-proposal-revisions.md).
