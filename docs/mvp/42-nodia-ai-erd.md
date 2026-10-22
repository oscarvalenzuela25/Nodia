# NodiaAI modelo de datos ERD de la v1

> Continuidad AI-28: [configuración IA74](74-nodia-ai-ai28-provider-configuration.md) agrega únicamente metadatos descriptivos `execution.localAiProviderConfiguration`; cuatro puertos usan las tablas nativas y la intención/revisión/recibo existentes. Cero tablas, columnas o migraciones: instalado18/241, modelo completo propuesto23/298/62 FKs. La prueba de locks de autoridad heredados consulta el manager actual; no crea almacenamiento.

> Continuidad AI-27: [administración Core73](73-nodia-ai-ai27-core-administration.md) añade únicamente metadatos descriptivos `execution.localCoreAdministration`;17 puertos usan tablas Core y la intención/revisión/recibo existentes. Cero tablas, columnas o migraciones: instalado18/241, modelo completo propuesto23/298/62 FKs. La prueba transaccional de autoridad vive sólo en memoria durante el callback y no agrega almacenamiento.

> Continuidad AI-26: [dinero, bloqueos y preparación72](72-nodia-ai-ai26-rental-money-occupancy-preparation.md) agrega únicamente metadatos descriptivos `execution.localRentalMoneyOccupancyPreparation` al manifiesto. Diez puertos reutilizan tablas nativas de Reservas y almacenamiento existente de intención/revisión/recibo; cero tablas, columnas o migraciones nuevas. El subconjunto instalado continúa18 tablas NodiaAI/241 columnas; el modelo completo propuesto conserva23/298/62 FKs.

> Estado: revisión5; M1 y subconjuntos M2 AI-17/18 implementados; resto de v1 propuesto
> Fecha: 2026-10-14
> Dependencias: [plan38](38-nodia-ai-research-and-v1-plan.md), [inventario39](39-nodia-ai-current-capabilities-inventory.md), [catálogo40](40-nodia-ai-tool-catalog-v1.md), [contratos41](41-nodia-ai-v1-contracts.md)
> Arquitectura propuesta: [ejecución43](43-nodia-ai-execution-architecture.md), [ADR-033](../architecture/decisions/ADR-033-nodia-ai-confirmation-and-sequential-recovery.md) y [ADR-034](../architecture/decisions/ADR-034-nodia-ai-postgres-jobs-and-retention.md)

## Alcance del modelo

Revisión posterior: [política48](48-nodia-ai-mode-routing-policy.md) introduce Web conversacional y alternancia opt-in a Agentic; [AI-04/50](50-nodia-ai-ai04-runtime-policy.md) fija un run lógico/una delegación, presupuesto acumulado e identidad por etapa. AI-09 materializa conjuntamente el delta en schema/rutas/ERD y M1; AI-12 implementará admisión/dispatch y elegibilidad reales. Baseline anterior23/284 ampliado a23/298 sin nuevas tablas de fases. La auditoría pasa a CASCADE al chat para garantizar la política50 sin archivo adicional; pendientes mínimos de conciliación siguen independientes. [Detalle55](55-nodia-ai-ai09-conversation-persistence.md) y [ADR-040](../architecture/decisions/ADR-040-nodia-ai-m1-persistence.md).

Nodia conserva el chat canónico y las identidades de sus operaciones aunque cambie el proveedor o se cierre el navegador. La propuesta separa contenido conversacional, trabajo durable y recibos de efectos. La caducidad del chat elimina mensajes y archivos sin borrar gastos, reservas o proveedores creados ni perder la protección contra duplicados.

Tras la [segunda revisión54](44-nodia-ai-data-model-review.md), se proponen **23 tablas previstas**, **298 columnas** y **62 FKs**, con prefijo nodia_ai_, y referencias a **3 tablas existentes**: users, auth_sessions y ai_providers. **22 tablas corresponden a la v1 completa; adapter_states es condicional** a demostrar que el adaptador necesita continuación opaca durable. El [manifiesto estructurado](nodia-ai-v1-data-model.json), revisión5, especifica columnas, claves, índices y reglas; el [DBML](nodia-ai-v1-data-model.dbml) permite explorar las relaciones. El DBML no ejecuta checks, índices parciales o deferrability. El [plan45](45-nodia-ai-implementation-plan.md) incorpora tablas/columnas/FKs por necesidad; no se migran todas al inicio.

No replicar recursos de Negocios/Finanzas/Reservas. Las herramientas reutilizan casos de uso y guardan referencias/resultados permitidos. Informes consultan fuentes registradas: su resultado pertenece al tool call/evento, con report_id y procedencia, sin añadir un almacén analítico o ledger monetario paralelo.

## Retención confirmada

| Tema | Regla |
|---|---|
| Caducidad | 90 días desde el último mensaje enviado por el dueño |
| No reinician el plazo | Lectura, renombrado, fijado/archivo, cambio de configuración, confirmación sin nuevo mensaje y respuestas automáticas |
| Adjuntos y transcripciones | Borrarlos con el chat; archivos incorporados a registros de negocio son independientes |
| Preferencias aceptadas | Conservarlas independientemente hasta borrado explícito |
| Navegador | El usuario propone un check en localStorage para evitar consultas repetidas; sólo es caché, no autoridad de retención |

“Último mensaje del dueño” sustituye la interpretación amplia de actividad humana propuesta en41. Un administrador que inspecciona otro chat no cambia su dueño. Para un chat vacío se propone created_at como base inicial, hasta admitir el primer mensaje del dueño.

Server ejecuta la caducidad y comprueba vigencia al leer/admitir trabajo. localStorage no asegura borrado si nadie vuelve a abrir la app o usa otro dispositivo. El plazo se calcula con tiempo de Server, en UTC, como 90 períodos de 24 horas; la zona del usuario cambia sólo la presentación. Fijar o archivar no concede excepción.

## Convenciones

- UUIDv4 como PK/referencia opaca de las nuevas entidades públicas. Partes, revisiones y dependencias usan claves compuestas internas.
- users.id y ai_providers.id conservan bigint/string. AuthPrincipal.sessionId refiere al public_id UUID único de auth_sessions, no a su PK bigint.
- Nuevas fechas: timestamptz. Fechas civiles y dinero de dominios no se transforman en timestamps o Number.
- Revisiones públicas integer positivo, compatibles con los schemas comunes; secuencias/fences bigint se transportan como cadenas/cursors.
- Modelo exacto y dinámico, sin lista/default comercial. La selección se guarda completa. Al eliminar conexión, FK null y selección histórica indisponible; nunca otro proveedor por defecto.
- JSONB sólo para contratos versionados: comandos, proyecciones, ámbitos y resultados. No claves/cookies/SQL/URLs de ejecución ni identidades que necesitan constraints.
- Entidades futuras con Relation<T>, imports .js y módulos verticales conforme a AGENTS de Server.

Fuentes: [User](../../nodia-server/src/user/entities/user.entity.ts), [AuthSession](../../nodia-server/src/auth/entities/auth-session.entity.ts), [AuthPrincipal](../../nodia-server/src/auth/types/auth.types.ts), [AiProvider](../../nodia-server/src/ai-provider/entities/ai-provider.entity.ts). La sesión Nodia posee expiración/revocación propias; una cuenta Gemini compartida no la sustituye.

## Contenido y preparación

| Tabla | Responsabilidad | Claves y campos principales |
|---|---|---|
| nodia_ai_conversations | Dueño, organización, selección y caducidad | owner_id; client_request_id/creation_request_hash; revision; last_owner_message_at/expires_at; retention_epoch; active_job_id |
| nodia_ai_messages | Mensajes ordenados y procedencia | chat/seq; role/author_id; client_message_id/input_hash; status; source_scope_manifest; sealed_at |
| nodia_ai_message_parts | Partes tipadas del mensaje | PK(message_id,part_index); texto o attachment_id; chat para FK compuesta |
| nodia_ai_attachments | Objeto privado, transcripción/extracción | chat; dueño derivado del chat; kind/state; storage_key/generation; hash; metadata nullable |
| nodia_ai_context_snapshots | Compactación inmutable anclada | chat/revision; through_message_seq/source_hash; summary/scope_manifest |
| nodia_ai_adapter_states | Continuación condicional del proveedor aislada/cifrada | Crear sólo con protocolo verificado; chat/conexión/modo/modelo/generation; ciphertext/key_version/status |
| nodia_ai_runs | Turno con configuración fija | actor; mensaje/respuesta; selection_snapshot; catálogo/política/contexto; context_manifest con IDs/revisiones/hashes de fuentes seleccionadas; estado/deadline |
| nodia_ai_tool_calls | Llamada validada y resultado permitido | run/adapter_call_id único; herramienta/contrato/argumentos; resultado/ámbito/estado |
| nodia_ai_drafts | Datos parciales y dudas | actor/chat; herramienta/revision; partial_command/clarifications; claimed_proposal_id |
| nodia_ai_proposals | Identidad lógica de propuesta | actor/chat; current_revision |
| nodia_ai_proposal_revisions | Versión inmutable de lo aprobado | PK(proposal_id,revision); state/hash; catálogo/canonicalization; expires_at; envelope/preview reconstruidos desde pasos congelados |
| nodia_ai_proposal_steps | Comando tipado por paso | proposal/revision/position; scope/template/bindings/preconditions; public_step |
| nodia_ai_confirmation_challenges | Desafío separado del modelo | proposal/revision/hash/actor/session; token_hash; expires_at/consumed_at |
| nodia_ai_execution_payloads | Comando vinculado y resultado completo | PK(step_id); chat; bound_command/public_result/safe_error; expira con el chat |
| nodia_ai_events | Outbox transaccional y eventos públicos | chat/seq y event_key únicos; run/execution; payload/ámbito |

## Ejecución y conservación separada

| Tabla | Responsabilidad | Política |
|---|---|---|
| nodia_ai_executions | Identidad, actor/dueño, hash y estado global | Recibo mínimo; chat/propuesta nullable y orígenes opacos inmutables |
| nodia_ai_execution_steps | Identidad por efecto y recuperación | Recibo mínimo; no cascade desde chat/propuesta |
| nodia_ai_jobs | Trabajo tipado con stage_key/stage_seq y lease/fence/deadline | Una etapa acotada por claim; intents de limpieza sobreviven al chat |
| nodia_ai_job_attempts | Etapa/fase de dispatch/recovery por entrega | Snapshot de etapa, IDs/códigos seguros; no copia prompts/comandos |
| nodia_ai_execution_grants | Autoridad del worker ligada a sesión | Revalidar/revocar; nunca JWT/refresh/cookies |
| nodia_ai_runtime_slots | Uso de perfil/proceso y cuarentena | No liberar automáticamente un resultado remoto incierto |
| nodia_ai_preferences | Memoria explícitamente aceptada | Independiente del chat; origen SET NULL |
| nodia_ai_audit_events | Auditoría mínima | Sin mensajes, títulos, documentos, transcripción, reportes o secretos |

Los payloads completos expiran con el contenido. Recibos retienen IDs opacos, actor/destinatario/ámbito mínimo, hashes, resultado verificado, referencias de recurso/recuperación y tiempos necesarios. El journal no copia mensajes o datos extraídos. [Política50](50-nodia-ai-ai04-runtime-policy.md) elimina audit/receipts resueltos/attempts terminales con el chat, sin archivo adicional. Sólo pendientes operativos mínimos sobreviven hasta conciliar/limpiar, luego se eliminan. La independencia FK evita perder protección de un efecto aún activo; no significa conservar un ledger perpetuo.

Grants de turno se eliminan con éste; grants de ejecución conservan sólo referencias mínimas revocadas según política operativa. Después de expirar el chat no permiten reanudar comandos: un recibo no conserva consentimiento ejecutable.

## Conversación y contexto

~~~mermaid
erDiagram
    users ||--o{ nodia_ai_conversations : owns
    nodia_ai_conversations ||--o{ nodia_ai_messages : orders
    nodia_ai_messages ||--o{ nodia_ai_message_parts : contains
    nodia_ai_attachments o|--o{ nodia_ai_message_parts : referenced_by
    nodia_ai_conversations ||--o{ nodia_ai_attachments : retains
    nodia_ai_conversations ||--o{ nodia_ai_context_snapshots : compacts
    nodia_ai_conversations ||--o{ nodia_ai_adapter_states : isolates
    ai_providers o|--o{ nodia_ai_adapter_states : selected_connection
    nodia_ai_conversations ||--o{ nodia_ai_runs : admits
    nodia_ai_messages ||--o| nodia_ai_runs : user_input
    nodia_ai_context_snapshots o|--o{ nodia_ai_runs : selected_context
    nodia_ai_adapter_states o|--o{ nodia_ai_runs : provider_continuation
    nodia_ai_runs ||--o{ nodia_ai_tool_calls : validates
    nodia_ai_conversations o|--o{ nodia_ai_preferences : optional_origin
    users ||--o{ nodia_ai_preferences : accepts
~~~

## Propuesta y efectos

~~~mermaid
erDiagram
    nodia_ai_conversations ||--o{ nodia_ai_drafts : prepares
    nodia_ai_tool_calls o|--o{ nodia_ai_drafts : origin
    nodia_ai_proposals o|--o{ nodia_ai_drafts : claims_once
    nodia_ai_conversations ||--o{ nodia_ai_proposals : reviews
    nodia_ai_proposals ||--|{ nodia_ai_proposal_revisions : versions
    nodia_ai_proposal_revisions ||--o{ nodia_ai_proposal_steps : orders


    nodia_ai_proposal_revisions ||--o{ nodia_ai_confirmation_challenges : challenges
    auth_sessions o|--o{ nodia_ai_confirmation_challenges : binds
    nodia_ai_proposals o|--o| nodia_ai_executions : confirms_once
    nodia_ai_conversations o|--o{ nodia_ai_executions : nullable_chat
    nodia_ai_executions ||--o{ nodia_ai_execution_steps : sequential_effects
    nodia_ai_proposal_steps o|--o| nodia_ai_execution_steps : source
    nodia_ai_execution_steps ||--o| nodia_ai_execution_payloads : full_content
    nodia_ai_conversations ||--o{ nodia_ai_execution_payloads : purges
~~~

## Trabajo y observación

~~~mermaid
erDiagram
    nodia_ai_runs o|--o{ nodia_ai_jobs : turn_work
    nodia_ai_executions o|--o{ nodia_ai_jobs : effect_work
    nodia_ai_jobs ||--o{ nodia_ai_job_attempts : attempts
    nodia_ai_conversations o|--o{ nodia_ai_jobs : nullable_chat
    nodia_ai_jobs o|--o{ nodia_ai_runtime_slots : holds
    nodia_ai_conversations o|--o{ nodia_ai_runtime_slots : nullable_chat
    auth_sessions o|--o{ nodia_ai_execution_grants : current_session
    nodia_ai_runs o|--o| nodia_ai_execution_grants : turn_grant
    nodia_ai_executions o|--o| nodia_ai_execution_grants : confirmed_grant
    nodia_ai_conversations ||--o{ nodia_ai_events : stream
    nodia_ai_runs o|--o{ nodia_ai_events : turn_events
    nodia_ai_executions o|--o{ nodia_ai_events : effect_events
    nodia_ai_executions o|--o{ nodia_ai_audit_events : audit
    nodia_ai_conversations o|--o{ nodia_ai_audit_events : nullable_chat
~~~

Son vistas parciales del mismo modelo; el manifiesto enumera las 62 FKs, incluidas referencias no repetidas a users/ai_providers. Las relaciones de adapter_states sólo se incorporan al activarse su migración condicional.

## Restricciones de integridad

| Invariante | Constraint o protocolo |
|---|---|
| Crear chat/mensaje una vez | UNIQUE de IDs de petición por dueño/chat/autor; hash original rechaza reuse con contenido distinto |
| Orden canónico | UNIQUE(chat,seq), secuencia asignada bajo lock, no desde cliente |
| Archivo del mismo chat | FK compuesta mensaje/adjunto con conversation_id; validar kind/dueño/estado |
| Revisión vigente | FK propuesta→revisión diferida para insert/delete conjunto |
| Pasos del mismo conjunto | FK paso→revisión y UNIQUE de posición; Server valida depends_on/bindings de la misma revisión y posiciones previas, sin tabla de aristas |
| Un borrador, un conjunto | Claim con lock/revisión; no confirmar también la propuesta individual superseded |
| Una ejecución aprobada | UNIQUE(origin_proposal_id) y UNIQUE(actor,client_request_id); hash/revisión/challenge en una transacción |
| Efecto estable | UUID del paso confirmado = execution_step.id; native_request_key generado una vez, no por intento |
| No repetir efectos | Mismo manager para efecto/recibo/outbox o recovery nativo equivalente; UNIQUE solo no prueba atomicidad |
| Una actividad por chat | active_job_id bajo lock; índices parciales por run/execution no bastan para exclusión cruzada |
| Worker vigente | Compare-and-set de lease_owner/fence/estado y fencing antes del efecto |
| Comando exacto | Ready congela metadata/contenido de pasos; reconstruir envelope/preview sin consultar nuevos datos; edición crea revisión; first-bind guarda args/hash sin recalcular al reintentar |
| Retención | expires_at con último mensaje del dueño, controles al leer/escribir y epoch de purga |
| Memoria aceptada | UNIQUE(owner,scope_hash,key), revisión y consentimiento; no credenciales/permisos en value |

Las FK mantienen pertenencia estructural, no autoridad. Indexar columnas referenciadoras según joins/purga: PostgreSQL no crea esos índices automáticamente por declarar FK. [Constraints de PostgreSQL 16](https://www.postgresql.org/docs/16/ddl-constraints.html).

## Índices y crecimiento

Listados por dueño/archivo/fijado/fecha con cursor; mensajes/eventos por chat+seq; ready jobs por available_at; leases vencidas y purga por expires_at. Indexar joins de FKs no cubiertos por PK/unique y medir con cardinalidades representativas.

No crear GIN general sobre todos los JSONB ni eventos por token. La búsqueda necesita campos/semántica e índice de texto acotados por dueño y vigencia; definirla como tarea, sin cargar todos los mensajes al cliente. Cuotas/capacidades sólo desde datos reales.

Una tabla no exige un servicio o CRUD público propio. Agrupar recursos verticales y soporte interno; sin CRUD público de grants/journal/challenges/attempts/slots. Particionar sólo con volumen/planes medidos. No se requieren vectores o catálogo duplicado en BD: capacidades versionadas en código y fichas compiladas como assets del backend, con versión/hash y manifiesto de fuentes por turno. Nuevos productos no requieren tablas conversacionales adicionales.

La revisión54 elimina una tabla de dependencias, dos JSONB duplicados de aprobación, dueño redundante del adjunto, cuatro índices explícitos y un UNIQUE sin FK consumidora. Las dependencias tipadas permanecen en public_step/output_bindings y se validan antes de congelar el conjunto. Conservar ejecución/recibos/payloads/attempts/grants/slots por sus identidades y ciclos de vida distintos; no reemplazarlos por un único JSON de chat. Eventos referencian resultados canónicos y no los copian completos cada vez. [ADR-035](../architecture/decisions/ADR-035-nodia-ai-bounded-persistence-and-knowledge.md) registra esta concreción.

## Purga sin borrar registros de negocio

1. Reclamar chat con lock y revalidar expires_at; puede haber llegado un mensaje del dueño antes de vencer.
2. Cambiar lifecycle/retention_epoch, cerrar admisión, invalidar propuestas/challenges y revocar grants. Worker viejo no inicia efecto con epoch anterior.
3. Detener/reconciliar pasos iniciados, conservando recibos mínimos. Resultado remoto unknown no justifica conservar prompts/comandos completos.
4. Guardar intents delete_blob con key/generation antes de quitar metadata; su retry no depende del chat.
5. Eliminar contenido/índices/estados de adaptador. Recibos, origen de preferencias y audit quedan SET NULL. Slots unknown siguen en cuarentena.
6. Borrar objetos con recovery y protección ante PUT tardío. Nunca borrar la key independiente de una factura.
7. Eliminar explícitamente receipts/audit/jobs/attempts ya resueltos en orden FK, sin archivo adicional conforme50. Mantener únicamente pendientes mínimos de conciliación/limpieza; al resolverlos, eliminar también sus metadatos. No borrar slots de procesos desconocidos por TTL.

Expiración lógica al vencer; limpieza física recuperable según50: objetivo24h, barrido900s/lotes100, backups máximo7 días/restore en cuarentena propuestos. Son gates no desplegados. No anunciar borrado físico completo hasta observarlo. GET filtra/deniega contenido vencido; el scheduler realiza limpieza.

Para incorporar adjunto a factura, copiar/promover a key de dominio independiente y aplicar su protocolo archivo/factura. No compartir una key entre dos políticas de borrado. Fuentes: [InvoiceUpload](../../nodia-server/src/invoice/entities/invoice-upload.entity.ts), [recovery](../../nodia-server/src/invoice/use-case/recover-invoice-uploads.use-case.ts).

## Continuidad

Verificación estática de la revisión5 en [evidencia JSON](../evidence/nodia-ai-erd-execution-validation.json), mediante [validador reproducible](../evidence/scripts/validate-nodia-ai-design.mjs): nombres/PK/unique/índices,62 FKs con tipos/targets/nullabilidad coherentes, grafo CASCADE sin ciclos y separación de contenido/recibos; fixtures inválidas rechazadas,8 hashes de fuentes y correspondencia con DBML/diagramas.34 escenarios de diseño en44 se convierten en aceptación en45. No ejecuta migraciones, PostgreSQL, locks, provider, storage o UI; no acredita esas garantías en runtime.

- [x] Diseñar identidades, tablas, relaciones, constraints, índices y conservación.
- [x] Registrar último mensaje del dueño, adjuntos/transcripciones con el chat y preferencias independientes.
- [x] Entidades/migración M1 y70 checks PostgreSQL verificados en AI-09/55; grupos M2..M-provider pendientes.
- [ ] Probar claims simultáneos, dependencias/bindings inválidos, revisión obsoleta, purga concurrente con mensaje/commit, PUT tardío y recovery sin replay.
- [x] Definir retención mínima de recibos/audit/jobs, búsqueda y límites en50; estado opaco de adaptador sigue condicional según49.
- [x] Persistencia/contratos AI-09 verificados; política operativa, dispatch y contadores compartidos con fencing siguen AI-10..12.
- [ ] Aprobar explícitamente el ERD; Reservas27 conserva su aprobación anterior.
- [x] Revisar redundancia y escenarios en44; derivar plan45 desde42/43 y NI-01..13, sin ejecutar sus tareas.

El modelo global03 referencia esta ampliación sin reemplazar su esquema aceptado ni el JSON externo de Obsidian. Verificación estática en00; no acredita constraints o recuperación ejecutadas en BD.

AI-16 añade únicamente el índice `nodia_ai_events(run_id,seq)` mediante1792300000000 para el feed y el presupuesto por run; ver [62](62-nodia-ai-ai16-observation-navigation.md). La consulta agrupada mensaje→run reutiliza los UNIQUE existentes de `user_message_id` y `assistant_message_id`: no se añade un índice duplicado. Once tablas/151 columnas M1 y retención en cascada conservadas. La ampliación no aprueba el ERD completo ni ejecuta grupos futuros.

## Entrega incremental AI-18

[AI-18/64](64-nodia-ai-ai18-human-confirmation.md) implementa desafío/confirmación por revisión/hash exactos, admisión atómica y recuperación sin duplicados. Metadatos humanos y edición de cinco campos escalares; registro productivo de ejecutores vacío hasta AI-19..20. No publica MCP prepare ni escribe en dominios.

`M2_AI18` instala las tres tablas previstas de desafíos, ejecuciones y pasos:44 columnas más4 referencias/campos en M1. Se conserva el diseño completo de23 tablas/298 columnas;18 tablas instaladas en el laboratorio tras la migración1792500000000. No añade tabla de alias, duplicado de comando/envelope ni payload anticipado. Desafíos se rotan por actor/sesión/propuesta/revisión; purga de ejecución no iniciada con el chat, sin archivo adicional. Los registros mínimos inciertos sólo sobreviven hasta conciliación. [Manifest](nodia-ai-v1-data-model.json).

## Entrega incremental AI-19

[65](65-nodia-ai-ai19-financial-effect.md) concreta transactional_witness para un único movimiento financiero confirmado. Reutiliza el caso de uso nativo y el manager existente; efecto/recibo/outbox/estado se comprometen juntos. `FinancialMovementReceipt` cerrado conserva sólo versión/recurso/ID/destinatario; columnas existentes guardan binding/identidad/tiempos. Migración1792600000000 congela el primer binding y el resultado completado sin nuevas tablas/columnas. La ejecución permanece interna, registro productivo vacío y sin publicación MCP hasta AI-20.


[AI-20/66](66-nodia-ai-ai20-execution-recovery.md) conecta el worker al efecto local de un movimiento confirmado: claim/fence, recuperación por witness SQL y cancelación/resume humanos. Reutiliza job/attempt/grant y un marcador acotado de la última reanudación; sin tablas/columnas ni migraciones. No extiende la prueba transaccional a efectos externos ni publica la preparación MCP. Versiones e identidad originales se conservan; cambios materiales requieren nueva propuesta/botón.

## Entrega incremental AI-23

[69](69-nodia-ai-ai23-dependent-workflows.md) concreta secuencias de hasta ocho operaciones individuales, con un commit y recibo por paso. La primera dependencia registrada es crear proveedor → crear contacto, usando únicamente el ID del recibo anterior. El orden y las referencias viven en los pasos existentes; no se añade una tabla de workflows, aristas o copias de recibos.

La migración `1792700000000-AddNodiaAiWorkflowBindings` añade dos columnas a tablas existentes: `nodia_ai_execution_steps.bound_command` (JSONB nullable, envelope cerrado de comando/ámbito/precondiciones enlazados) y `nodia_ai_proposals.prior_execution_id` (UUID nullable, FK a ejecuciones con `ON DELETE SET NULL`). La ejecución ya tenía su propia referencia a ejecución previa. Una corrección material del sufijo pendiente crea otra propuesta y otra confirmación, conservando los commits anteriores.

El primer binding se guarda una vez, antes del efecto, con su hash. Los triggers rechazan cambiar el payload, completar retroactivamente un binding antiguo o alterar la procedencia de una continuación. Cuando la purga elimina el paso fuente, el payload se limpia en la misma transición; no puede sobrevivir como contenido separado del chat. El rollback de la migración exige ausencia de payloads y propuestas de continuación para evitar pérdida silenciosa de información.

Este incremento deja **18 tablas NodiaAI y 241 columnas instaladas**, frente a las 239 anteriores, sin tabla nueva. El diseño completo propuesto de 23 tablas/298 columnas sigue siendo una referencia de fases futuras, no el esquema desplegado. En particular, `nodia_ai_execution_payloads` continúa sin implementar: para los efectos SQL locales se usa la columna acotada anterior y no se crearán ambos almacenes de comandos. Una futura necesidad externa con otro ciclo de vida deberá justificar y revisar expresamente esa separación antes de migrarla. El [manifiesto](nodia-ai-v1-data-model.json) distingue el objetivo propuesto de `M2_AI23` instalado.

Las [47 comprobaciones SQL de AI-23](../evidence/nodia-ai-ai23-postgresql.json) y [229 regresiones](../evidence/nodia-ai-ai23-regressions.json) verifican referencias, carreras de admisión, inmutabilidad, up/down, fallo parcial, recuperación tras caída/COMMIT perdido y purga de comandos sin borrar los registros de negocio. No equivalen a aprobación del ERD completo ni a publicación de escrituras MCP.

## Entrega incremental AI-24

[70](70-nodia-ai-ai24-rental-configuration.md) integra la configuración de Reservas sobre las tablas ya existentes: seis puertos de casa, colaborador y política, sin migración ni nuevas tablas/columnas. El journal y la auditoría nativos de Reservas conservan sus identidades; comparten manager y commit con el recibo mínimo NodiaAI, sin duplicar entidades de dominio o reglas en otra tabla del chat. Archivado conserva historia, ocupación y dinero. La ampliación del catálogo de código y el editor de reglas no requieren crecer el esquema conversacional.

## Entrega incremental AI-25

[71](71-nodia-ai-ai25-rental-reservation-lifecycle.md) incorpora seis operaciones del ciclo comercial reutilizando el esquema existente. No añade una tabla de disponibilidad, holds, estados del huésped o cálculos monetarios paralelos. La intención/revisión y el recibo mínimo permanecen en NodiaAI; reserva, snapshots de acuerdo/cancelación, journal y auditoría pertenecen al dominio nativo. Confirmar/cancelar comparten la transacción de su recibo, y la recuperación observa ese testigo sin repetir el efecto. Sin migraciones, tablas ni columnas nuevas.

## Implementación M4 — preferencias AI-33

[AI-33/79](79-nodia-ai-ai33-accepted-preferences.md) materializa sólo nodia_ai_preferences del grupo M4: doce columnas, unicidad dueño/scope_hash/key y FKs de origen SET NULL a chat/paso de ejecución. Los índices parciales de ambos orígenes evitan scans globales al purgar su fuente. Las referencias a productos son valores validados, no FKs que impidan olvidar un recurso desaparecido. No añade snapshots, historial de preferencias ni tablas de candidatos; AI-34 conserva su migración separada. Rollback bloqueado si hay recuerdos aceptados, evitando borrarlos silenciosamente. El modelo objetivo completo no se declara instalado por incorporar esta tabla.


## Implementación incremental M4 — contexto AI-34

[Entrega80](80-nodia-ai-ai34-long-context-compaction.md) implementa nodia_ai_context_snapshots con nueve columnas y un FK nullable en runs. Snapshots por revisión/secuencia/hash/scope, sin copiar originales ni añadir adapter_states. FK compuesta run/snapshot/chat evita referencias cruzadas y CASCADE del chat elimina su memoria. Cuotas incluyen JSONB real y reservas de resultados inciertos. El prefijo se vuelve a recorrer para calcular su hash: memoria/transferencia a Node acotadas no implican costo PostgreSQL constante. SQL36 y activación exacta28 verificados:21 tablas NodiaAI/289 columnas. El modelo completo propuesto continúa distinto del esquema instalado.
