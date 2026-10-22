# AI-18 — Confirmación humana de la propuesta exacta

Estado documental: en revisión. Implementación solicitada expresamente el2026-10-17; no implica aprobación de documentos, fichas ni publicación de herramientas. Esta entrega continúa [borradores/revisiones63](63-nodia-ai-ai17-drafts-revisions.md), conforme al [plan45](45-nodia-ai-implementation-plan.md), [contratos41](41-nodia-ai-v1-contracts.md), [arquitectura43](43-nodia-ai-execution-architecture.md), [política50](50-nodia-ai-ai04-runtime-policy.md) y [ADR-045](../architecture/decisions/ADR-045-nodia-ai-human-confirmation-admission.md). La [evidencia AI-18](../evidence/nodia-ai-ai18-validation.json) registra las verificaciones y sus límites; los conteos y el estado del laboratorio pertenecen a esa evidencia.

## Canal humano y disponibilidad

`nodia-ai-confirmation/` implementa un canal autenticado de la app separado de MCP y del runtime del modelo. El modelo no recibe un tool de confirmar, el desafío, cookies de Nodia ni credenciales para pulsar el botón. El nonce acredita una autorización dentro de ese canal; por sí solo no demuestra una interacción física humana.

`NODIA_AI_EXECUTION_ADMISSION` contiene exclusivamente contratos de ejecutores registrados por código del servidor. Cada entrada vincula herramienta, hash del contrato y versión del catálogo. **El registro productivo permanece vacío**: no existe aún un ejecutor nativo habilitado. Los metadatos indican `confirmation.available:false` con `nodia_ai:execution_unavailable`; challenge y primer confirm responden503. Una conexión Gemini autenticada, un modelo accesible o un preparador existente no abren este gate.

Los tests pueden inyectar un registro sintético en una composición aislada para comprobar el protocolo transaccional. Ese override no se registra en producción ni habilita efectos. AI-19 incorporará el primer efecto nativo y AI-20 su recuperación durable; la publicación MCP de preparadores conserva los gates correspondientes. El conjunto publicado de lecturas/contexto no se amplía por AI-18.

## Contratos HTTP

Las rutas usan los [schemas comunes](nodia-ai-v1-common-contracts.schema.json), [coordinación versionada](nodia-ai-v1-coordination-api.json) y `Cache-Control:no-store`.

| Ruta bajo `/api/v1/nodia-ai` | Contrato | Comportamiento |
|---|---|---|
| `GET proposals/:id/review-metadata?revision=N` | `ProposalReviewMetadata` | Affordances humanas para ID/revisión/hash exactos; no emite nonce |
| `POST proposals/:id/confirmation-challenge` | `ConfirmationChallengeRequest` → `ConfirmationChallengeResponse` | Desafío para propuesta vigente ready, propia y disponible |
| `POST proposals/:id/confirm` | `ConfirmationRequest` → `ExecutionAccepted`,202 | Admite o recupera la ejecución original con autoridad actual |
| `GET operations/:id` | `ExecutionStatus` | Recupera estado persistido y verifica su snapshot fuente |

El desafío usa32 bytes aleatorios, codificados como43 caracteres base64url canónicos sin padding. Se guarda sólo SHA-256 del nonce. Actor, sesión pública, propuesta, revisión y hash quedan vinculados al desafío. Su vencimiento es el mínimo de120 segundos de política, expiración de sesión, propuesta y chat. La emisión en la misma sesión/revisión reemplaza su digest anterior mediante UPSERT; las sesiones de otros dispositivos conservan sus desafíos independientes. El token no aparece en `PublicProposal`, mensajes, eventos, herramientas, logs ni almacenamiento persistente del cliente.

La confirmación exige `client_request_id`, `proposal_revision`, `expected_hash` y `confirmation_token`. El primer uso valida nonce vigente y no consumido, sesión, propiedad, módulos/acciones y ámbito nativo. También recompila el envelope congelado y verifica el hash; no usa una nueva interpretación del modelo.

## Identidad, atomicidad y concurrencia

El orden es barrera de autoridad → puerta de cola → lock del chat. Dentro de una única transacción se consumen el desafío y la revisión ready, se crea la ejecución y sus pasos, se guarda un grant acotado, se inserta un job tipado `execution` y se persiste `execution_changed`. El chat apunta al mismo job. Cualquier fallo revierte el conjunto, incluido un fallo al persistir el evento; no queda una confirmación aceptada sin trabajo e identidad durables.

Las restricciones únicas cubren actor/`client_request_id` y `origin_proposal_id`. Repetir el **ID original** con el mismo actor, propuesta de origen, revisión y hash devuelve202 con la misma ejecución, después de reautorizar. No vuelve a consumir el nonce ni exige que siga vigente: se recupera una admisión ya comprometida. El token debe seguir siendo sintácticamente válido, pero no forma parte de la identidad del efecto. Usar el mismo request con otra propuesta/revisión/hash produce409 `request_conflict`.

Otro `client_request_id` para una propuesta ya admitida produce409 `proposal_already_confirmed`; no se crean aliases implícitos ni una segunda ejecución. Ambos dispositivos pueden recuperar la misma identidad mediante `PublicProposal.execution_id` y `GET operations/:id`. Dos clics, concurrencia y respuesta HTTP perdida no reinterpretan ni duplican el comando.

El grant guarda actor/sesión pública, módulos, operaciones y scope registrados, versión de política, hash confirmado y plazo. No guarda JWT/cookies. La ventana de admisión se acota por600 segundos de política, sesión y chat; no renueva los90 días de conservación. El worker actual reclama únicamente turnos, no ejecuta estos jobs. El gate vacío evita generar una cola productiva sin ejecutor.

## Revisión, permisos y precondiciones

Los metadatos humanos están separados de `PublicProposal` y ligados a su ID/revisión/hash. Un super_admin puede inspeccionar chats ajenos con su identidad real y auditoría; esa inspección es de sólo lectura y no permite confirmar como el dueño. Revisiones históricas, propuestas vencidas o estados distintos de ready no exponen controles editables ni confirmación.

El registro de presentación declara tipos, restricciones y claves de traducción. El editor inicial de Finanzas ofrece cinco campos escalares: `name`, `amount`, `type`, `status` e `is_active`. Sólo expone campos registrados como editables, presentes en el after y sin bindings futuros. No añade un editor de JSON/paths ni campos libres para introducir IDs de categoría/obligación o cambiar destinatario. Los selectores de entidades quedan para su integración específica. Importes e IDs conservan strings; cero, false, null y ausencia no se confunden.

Guardar una edición usa PATCH con revisión/hash esperados y produce una revisión nueva con nuevo hash e IDs de pasos. Remapea dependencias/bindings y conserva el vencimiento original. La UI vuelve a mostrar esa propuesta exacta antes de solicitar un nuevo desafío. Error de validación, conflicto o indisponibilidad conserva edición y foco, presenta feedback traducido y permite recuperación explícita. El nonce y el request original para una respuesta perdida viven únicamente en memoria, dentro de su contexto actor/sesión/chat/propuesta; no hay reenvío automático.

`verifyPreconditions` comprueba condiciones materiales del comando congelado sin sustituir valores. El preparador financiero compara categoría vigente y, cuando corresponde, obligación, movimiento inicial y total confirmado contra su snapshot. Un cambio produce409 `preconditions_changed`. Esa excepción revierte la transacción: **no persiste artificialmente el estado invalidated**, no consume el desafío y no genera efectos. Hace falta una revisión/preparación explícita válida antes de admitir el contenido actualizado. Los checks se repetirán al ejecutar; una comprobación al confirmar no garantiza que el dominio permanezca inmutable hasta AI-19.

## Persistencia y conservación

Migración `1792500000000-CreateNodiaAiConfirmationPersistence`: tres tablas existentes en el diseño M2, con44 columnas: `nodia_ai_confirmation_challenges`, `nodia_ai_executions` y `nodia_ai_execution_steps`. Añade cuatro columnas a M1: `jobs.execution_id`, `events.execution_id`, `execution_grants.execution_id` y `execution_grants.command_set_hash`. `run_id` del grant pasa a nullable con exclusión run/ejecución y hash obligatorio para ejecución. No se crea aún `execution_payloads`, una tabla de aliases ni un hash redundante de requests.

El header conserva origen, actor/dueño, hash y catálogo; los pasos conservan identidad de efecto, hash de plantilla, scope y estado mínimo. Los comandos/proyecciones siguen en la revisión fuente de AI-17. Se verifican conteo, orden, IDs, herramienta, scope y hash de plantilla antes de proyectar la operación; un conjunto corrupto no se devuelve como una aprobación vacía. Triggers congelan identidades y bloquean inserciones de origen ajeno o borrados individuales de pasos, conservando la cascada del header.

Una ejecución aceptada se proyecta como queued, con pasos ready/blocked y `can_resume:false`;202 no acredita un efecto de negocio. `PublicProposal.execution_id` y `ConversationDetail.active_execution` permiten recuperar su identidad sin reenviar la confirmación. El evento contiene estado/revisión/referencia, no el comando ni el nonce.

Al expirar el chat se revocan grants y se descarta el trabajo no despachado. Ejecuciones queued y recibos resueltos se eliminan con su contenido: no hay archivo técnico adicional. Sólo una identidad mínima de efecto/proceso verdaderamente incierto puede sobrevivir hasta conciliación, sin mensajes, adjuntos ni comando recuperable para ejecutarlo. Detachment de jobs limpia sus FKs al chat/ejecución y conserva únicamente el descriptor operacional necesario. Los registros creados en productos tienen su ciclo de vida independiente.

## Verificación y continuidad

La [evidencia AI-18](../evidence/nodia-ai-ai18-validation.json) separa casos de uso, composición Nest compilada, PostgreSQL/HTTP aislado, regresiones, build/tipado/lint y UI sintética. Cubre gate productivo cerrado, nonce viejo/otra sesión, dos dispositivos, doble clic, respuesta perdida, conflictos de identidad, autoridad revocada, precondiciones, rollback y retención. Las pruebas con override no acreditan un ejecutor productivo ni una escritura Gemini real. La activación del laboratorio, cuando esté verificada, se registra allí sin equipararla a aceptación pública o aprobación documental.

AI-19/20 deben integrar ejecutor, límites/fences, efecto/recibo atómicos y conciliación antes de habilitar admisiones operativas y publicar preparadores. Los pendientes independientes de AI-15, incluidos R2 y aceptación externa/routing, mantienen su estado.

Verificación final:1.810 pruebas de casos de uso Server,37 checks PostgreSQL/HTTP AI-18 y100 de regresión de propuestas/eventos/observación. El laboratorio fue actualizado con respaldo y salud200:23 migraciones,18 tablas/239 columnas y cero trabajo pendiente; registro compilado de ejecutores vacío comprobado directamente. El cliente acepta `active_execution`, bloquea nuevas acciones mientras existe ejecución activa y recupera mediante GET. Un reenvío usa un botón separado y el request original; nonce inválido conserva la vista previa y obliga a una acción explícita. La evidencia separa UI sintética de operación real.
