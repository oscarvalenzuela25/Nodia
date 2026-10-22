# NodiaAI — contratos necesarios para la v1

> Continuidad AI-28: [configuración IA74](74-nodia-ai-ai28-provider-configuration.md) incorpora cuatro preparadores internos no secretos y `AiProviderEffectReceipt` cerrado (versión1, recurso `ai_providers` o `ai_provider_catalog`, operación create/update e ID bigint string; scope global vacío). Paths explícitos por canal, modelos persistidos exactos y preferencias de razonamiento no equivalen a disponibilidad. El recibo excluye comandos, fields y credenciales. Traducciones conservan upsert nativo; las propuestas Core anteriores afectadas requieren revisión nueva mediante un marcador material, sin invalidar sus recibos históricos. MCP de escritura y sincronización remota conservan gates.

> Continuidad AI-27: [administración Core73](73-nodia-ai-ai27-core-administration.md) añade17 preparadores internos y el recibo cerrado `CoreEffectReceipt` (versión1, recurso/operación/ID bigint string, scope global vacío). Usuarios sólo create/update; roles, acciones, acciones de negocio, módulos y grupos también delete. El recibo congela el ID efectivo de upsert; `core_id_list` y `core_translations` permiten revisión estructurada. Identidades, impacto y autoridad se revalidan; escrituras MCP siguen sin publicar y Gemini pendiente.

> Continuidad AI-26: [dinero, bloqueos y preparación72](72-nodia-ai-ai26-rental-money-occupancy-preparation.md) incorpora diez preparadores internos. `RentalEffectReceipt` admite pagos create/void, gastos create/update/pay/void, bloqueos create/update y preparación update/approve_same_day; mantiene versión1, identidades bigint como strings y propiedad coherente con scope/template. No añade datos monetarios, comandos ni secretos al recibo. La matriz completa de Reservas tiene22 escritores individuales; publicación MCP y aceptación Gemini siguen separadas.

> Continuidad AI-23: [conjuntos dependientes69](69-nodia-ai-ai23-dependent-workflows.md) implementa preparación interna de uno a ocho pasos, primer binding proveedor→contacto, first-bind durable y corrección de lo pendiente con nueva propuesta/botón. Las notas por entrega inferiores conservan su baseline histórico; la documentación sigue en revisión y no publica preparadores MCP.

> Continuidad AI-09: [persistencia55](55-nodia-ai-ai09-conversation-persistence.md) materializa contratos cerrados de esfuerzo/routing/etapas/presupuesto y migración M1, sin publicar rutas, worker o inferencias. Modelo completo revisión3:23 tablas/298 columnas/62 FKs; M1:11/151. La auditoría vinculada al chat pasa a CASCADE conforme50; pendientes mínimos siguen separados. Las menciones anteriores de wire/ERD pendiente describen el baseline anterior; runtime permanece AI-10..12.

> AI-08 implementado localmente: [autoridad transversal, invariantes y evidencia](54-nodia-ai-ai08-transversal-authority.md). Destinatario explícito, actor real, barreras de transacción y NI-13 verificados; consumidores/herramientas del chat pendientes. Esta nota sustituye menciones históricas de acceso transversal pendiente, sin aprobar documentos ni invalidar sus reglas nativas.

> Estado: contratos comunes compilables; coordinación AI-10..14 y 59 lecturas locales AI-15 implementadas; cinco lecturas externas/tres artefactos pendientes, revisión documental conservada
> Fecha: 2026-10-14
> Dependencias: [plan38](38-nodia-ai-research-and-v1-plan.md), [inventario39](39-nodia-ai-current-capabilities-inventory.md), [catálogo40](40-nodia-ai-tool-catalog-v1.md), [ADR-032](../architecture/decisions/ADR-032-nodia-ai-domain-tools-and-conversation.md)
> Decisión de coordinación propuesta: [ADR-033](../architecture/decisions/ADR-033-nodia-ai-confirmation-and-sequential-recovery.md)
> Persistencia y ejecución derivadas: [ERD42](42-nodia-ai-erd.md), [arquitectura43](43-nodia-ai-execution-architecture.md), [ADR-034](../architecture/decisions/ADR-034-nodia-ai-postgres-jobs-and-retention.md).

## Decisiones confirmadas y límites de esta entrega

Continuidad [AI-15/61](61-nodia-ai-ai15-product-reads.md): cinco bibliotecas de dominio compiladas —158 definiciones y 118 contratos cerrados— respaldan 59 candidatas locales. Entrada/salida y autoridad usan el registro/gateway; los puertos comparten el manager iniciado por el checkpoint, sin transacciones o red independientes. Finanzas exige REPEATABLE READ; Reservas conserva READ COMMITTED para releer pertenencia después del lock del alojamiento y las demás familias conservan su aislamiento nativo. La recuperación puede revalidar además la autoridad de los recursos contenidos en el resultado. Cinco consultas externas y tres artefactos siguen con gates propios, por lo que AI-15 continúa parcial 59/67. Cero bindings/fragmentos publicados y 44 fichas draft/unregistered; ningún test sintético equivale a aprobación o inferencia Gemini real. El [transporte privado](../evidence/nodia-ai-ai15-mcp-transport-validation.json) admite 64 descriptores y 128 KiB; se probó el catálogo completo de 59 lecturas y 5 herramientas técnicas en proceso stdio real con callback sintético, sin inferencia Gemini. Las cifras AI-14 siguientes describen su baseline histórico; detalles vigentes en61.

Continuidad [AI-14/60](60-nodia-ai-ai14-capability-registry.md): biblioteca de esa entrega: 125 schemas / 243 fixtures, 13/28 rutas de coordinación implementadas. Tres rutas GET de capacidades/schemas y tres ayudantes comunes comparten registro, proyecciones y autoridad con ToolGateway Agentic. Buscar admite query/term de hasta 256 caracteres y 1024 bytes UTF-8; keys/version: 128 y cursor: 2048. Un candidato sólo es único con búsqueda completa y cursor nulo. Descubrimiento no revela capacidades ajenas: NodiaAI ausente conserva 403 y un nombre inexistente/no autorizado retorna 404 `capability_not_found`; catálogo incompatible: 409. Replay exige contrato/argumentos/ámbito exactos, autoridad actual y salida validada. Transporte: 32 herramientas / 64 KiB: cinco técnicas dejan hasta 27 de dominio simultáneas, gate de selección acotada AI-15/36. Cero familias reales publicadas y 44 fichas draft/unregistered; no se infieren capacidades de negocio o nueva viabilidad Gemini de estas pruebas. Las cifras AI-01 siguientes describen su baseline histórico.

Cambio posterior confirmado del 2026-10-14: **Web sólo conversación y Agentic con MCP**. Switch explícito de alternancia desde Web hacia Agentic verificado en v1, API después. [Política48](48-nodia-ai-mode-routing-policy.md)/[ADR-036](../architecture/decisions/ADR-036-nodia-ai-opt-in-agentic-routing.md) precisan esta excepción autorizada; no fallback por error ni aprobación de escrituras. Los111 contratos AI-01 aún no incorporan consentimiento/destino/procedencia de delegación. [AI-04/50](50-nodia-ai-ai04-runtime-policy.md) fija semántica y presupuestos; wire/schema/rutas/ERD se derivan juntos AI-09/12 antes de usarlos, sin cambiar Selection congelada ni añadir JSON libre. El loop de herramientas Web comprobado en AI-02 no se publicará como función productiva.

El usuario confirmó ejecución secuencial de operaciones individuales dependientes, resultado visible por paso, conservación de lo creado ante fallo y recuperación sin duplicación; botón de confirmar sobre la vista previa exacta; e informes que combinan medidas compatibles de diferentes módulos con procedencia separada. No son escrituras masivas: los siete handlers bulk/import siguen excluidos.

Ronda posterior confirmada: primeras pruebas de chat/herramientas en **Gemini Web y Agentic**, verificadas por separado, y **borrado automático de chats tras 90 días de inactividad humana**. API permanece prevista por etapas. El borrado de chat no elimina datos de negocio creados/actualizados.

La v1 cubre operaciones actuales de todos los módulos, incluida eliminación donde exista. Reservas usa cancelar/anular/archivar según contrato y no tiene DELETE; no inventar eliminación física. Las reglas de dominio se conservan. La autoridad transversal de super_admin en Finanzas/Reservas es una ampliación confirmada pero aún no implementada.

Esta entrega fija el diseño de coordinación y una [biblioteca JSON Schema 2020-12](nodia-ai-v1-common-contracts.schema.json) con **111 definiciones comunes**, tras [AI-01](46-nodia-ai-ai01-contract-baseline.md). El [manifiesto](nodia-ai-v1-tool-catalog.json) vincula 141 herramientas de dominio con fuentes existentes, más 11 ayudantes y 4 flujos seguros. Las referencias de DTO no equivalen a los esquemas ejecutables de esas 141 herramientas: derivación, proyecciones, reglas compartidas y pruebas siguen pendientes antes de publicación.

JSON Schema valida formas/tipos; no prueba permisos, pertenencia, disponibilidad, aritmética exacta ni atomicidad. [Especificación oficial de validación](https://json-schema.org/draft/2020-12/json-schema-validation). Todas las restricciones semánticas siguientes deben ejecutarse en Server, además de esa validación.

## Identidad, versiones y separación de canales

| Concepto | Contrato propuesto |
|---|---|
| Identidades nuevas de protocolo | UUID opaco para conversación, mensaje, turno, borrador, propuesta, paso, ejecución, informe y adjunto; no cambia PKs de dominios existentes |
| IDs de dominio | bigint positivo como cadena decimal o UUID según recurso; jamás convertir bigint a Number |
| Dinero | Cadena decimal exacta, unidad/moneda y escala del contrato; conservar tipos originales donde proceda y validar conversión explícita |
| Versión de catálogo | Identifica definiciones/semántica publicadas; no acredita acceso actual ni disponibilidad del proveedor |
| Revisión de conversación | Control optimista de cambios de configuración/mensajes; rechazo ante versión obsoleta |
| Propuesta | ID, revisión, hash de contenido y catálogo; contenido confirmado inmutable |
| Ejecución | ID y revisión, resultados por paso y estado recuperable; distinta de mensaje y de inferencia |
| Canal del modelo | Descubrir/consultar/preparar; ninguna ruta de confirmación, ejecución arbitraria ni token de aprobación |
| Canal humano | UI autenticada para editar, confirmar, cancelar, recuperar/reanudar y completar secretos/login |

La expresión regular de BigintId controla forma; Server debe comprobar además el máximo admitido por cada recurso (incluido bigint PostgreSQL). Business conserva UUID. ProtocolId es una referencia pública nueva; la elección de PKs internas queda para el ERD.

El proveedor y modo quedan fijos al admitir el turno; model_id proviene de configuración o descubrimiento dinámico. Si falta, se pide seleccionar uno. No hay modelo, cuota o capacidad de respaldo. Cambiar el drawer entre turnos conserva historial, operaciones y decisiones, pero no modifica por sí solo la conexión global ni migra el estado interno de otro proveedor.

## API de coordinación propuesta

Todas las rutas de esta sección son **nuevas y propuestas**, bajo `/api/v1/nodia-ai`. No figuran como endpoints existentes en39. Aplican sesión y autorización en Server. Ninguna ruta admite actor/JWT/SQL/URL de ejecución en el cuerpo.

| Método y ruta relativa | Entrada normalizada | Salida tipada / canal |
|---|---|---|
| POST /conversations | ConversationCreateRequest | ConversationSummary |
| GET /conversations | ConversationListQuery | ConversationPage |
| GET /conversations/:id | Sin cuerpo; path validado | ConversationDetail |
| PATCH /conversations/:id | ConversationUpdateRequest | ConversationSummary |
| GET /conversations/:id/messages | MessageListQuery | MessagePage |
| POST /conversations/:id/messages | MessageCreateRequest | MessageAccepted; 202 = admisión |
| PATCH /conversations/:id/selection | SelectionUpdateRequest | ConversationSummary |
| GET /runs/:id | Sin cuerpo; path validado | RunSummary |
| GET /runs/:id/events | EventListQuery | EventPage; SSE: PublicEvent |
| POST /runs/:id/cancel | CancelRunRequest | RunCancellationResult |
| GET /capabilities | CatalogSearchInput | CatalogSearchResult |
| GET /capabilities/:name | CatalogDescribeInput | CapabilityDescriptor |
| GET /capabilities/:name/schema | CatalogDescribeInput | CapabilitySchemas |
| GET /connections | MessageListQuery | ChatConnectionPage |
| GET /proposals/:id | Sin cuerpo; path validado y ProposalVersionQuery con revision opcional | PublicProposal |
| PATCH /proposals/:id | ProposalUpdateRequest | PublicProposal; canal humano |
| POST /proposals/:id/confirmation-challenge | ConfirmationChallengeRequest | ConfirmationChallengeResponse; canal humano |
| POST /proposals/:id/confirm | ConfirmationRequest | ExecutionAccepted; canal humano; 202 = admisión |
| POST /proposals/:id/cancel | ProposalCancelRequest | PublicProposal; canal humano |
| GET /operations/:id | Sin cuerpo; path validado | ExecutionStatus |
| POST /operations/:id/resume | ResumeExecutionRequest | ExecutionAccepted; canal humano; 202 = admisión |
| POST /operations/:id/cancel | ExecutionCancelRequest | ExecutionCancellationResult; canal humano |
| POST /attachments | AttachmentUploadMetadata | AttachmentUploadResult; canal humano |
| GET /attachments/:id | Sin cuerpo; path validado | AttachmentMetadata |
| GET /preferences | PreferencePageQuery | PreferencePage |
| GET /tool-calls/:id/result | Sin cuerpo; path validado | Schema exacto del tool registrado |

Los cambios de preferencias se preparan y confirman mediante la misma propuesta; no recordar por inferencia silenciosa. El borrado automático de chats tras 90 días de inactividad humana está confirmado; sus jobs/rutas de control, la eliminación de adjuntos y el acceso administrativo a estos últimos requieren definición detallada. La creación de informe se invoca por el contrato de herramienta `nodia_reports_run`; la implementación comparte su caso de uso con cualquier futura ruta HTTP de informes.

[AI-01](46-nodia-ai-ai01-contract-baseline.md) completa cuerpos/salidas de coordinación, metadata/selección, eventos, edición tipada, desafío y metadata multipart. [El índice de26 rutas](nodia-ai-v1-coordination-api.json) distingue canales y resolución por schema registrado. Multipart binario, admisión, autoridad, estado/transacciones y141 contratos de dominio requieren implementación en sus etapas. No publicar rutas con `Record<string, unknown>` para eludirlos.

## Autoridad y sesión

Implementación parcial común en [AI-07/53](53-nodia-ai-ai07-module-authorization.md): política interna de sesión/módulos/acciones/propiedad verificada sin caché y módulo/ruta registrados en código. Sus consumidores HTTP/MCP/worker, barreras de efecto y transversalidad de familias siguen pendientes; no considerar ejecutadas las rutas propuestas de este documento.

El backend deriva actor y sessionId de la sesión autenticada. Para ordinarios exige NodiaAI asignado y el módulo de destino, también para cada fuente de un informe, descubrimiento, resolución de entidades, preparación, ejecución y recuperación. Rutas del catálogo son documentación: el registro resuelve el ID/key estable del módulo padre. Una preferencia no concede acceso.

Conservar autoridad del recurso y acciones existentes como `ai:manage`; no introducir una lista nueva de permisos granulares por operación donde el producto no la necesita. Llamar un caso de uso directamente no ejecuta automáticamente guards/ValidationPipe: trasladar o compartir esas reglas en la capa de aplicación, con controllers delgados.

Super_admin conserva autoridad transversal confirmada, con actor separado del usuario propietario/destinatario. Para Finanzas se necesita ampliar el alcance que hoy usa el usuario de la petición; Reservas debe incorporar bypass autorizado de ámbito, conservando invariantes comerciales. Si un administrador pide operar datos ajenos sin identificar destinatario, preguntar. Ver un chat ajeno no convierte su propuesta en aprobada ni permite confirmar como si fuera su autor: preparar una nueva propuesta atribuida al administrador.

Para trabajos en background se propone persistir una concesión interna acotada al actor/sesión, ejecución, módulos y comandos confirmados; jamás guardar JWT/cookies en el job. Revalidar existencia/actividad de sesión, usuario, asignaciones y autoridad antes de cada efecto. La desconexión del navegador no revoca esa concesión; logout/revocación sí impide futuros efectos. Efectos comprometidos se conservan; recuperar desde una nueva sesión válida requiere acceso actual. Renovación, expiración y auditoría exactas de la concesión deben cerrarse en el ERD.

Las consultas privadas por ID devuelven ausencia para recursos ajenos cuando el contrato protege su existencia. Revocación no elimina evidencias internas, pero impide que el modelo las recupere a través de herramientas sin permiso. No usar cuenta compartida Gemini como identidad del usuario Nodia.

## Borrador, aclaración y propuesta exacta

1. Resolver recurso/destinatario mediante búsquedas permitidas; si hay varias coincidencias pedir precisión.
2. Interpretar el mínimo requerido por DTO y reglas del caso de uso. Ante ambigüedad de pagado/pendiente, categoría, fecha o concepto, preguntar antes de proponer el comando final.
3. Guardar borrador parcial separado del comando ejecutable. Resultado `needs_clarification` señala campos faltantes/dudas; no crea registros de dominio.
4. Validar el comando completo y sus relaciones, aplicar defaults reales del contrato y preferencias aceptadas, normalizar tipos y preparar diff/impacto.
5. Mostrar valores, ámbito, referencias, efectos, dependencias y precondiciones para la revisión.
6. Una corrección crea revisión y hash nuevos; la confirmación anterior no sirve.

`PreparationResult` distingue ready / needs_clarification / blocked y permite referencias nulas cuando no hay propuesta válida. Validar semánticamente: ready requiere propuesta ready completa, ninguna pregunta pendiente ni error; blocked no es éxito. No confundir propiedades omitidas con null, false, cero o cadena vacía. Un default sólo se aplica si el contrato lo define; mostrar su origen.

`PublicStep.changes` presenta campos con before/after, before_present/after_present y origen user, accepted_preference, database, contract_default o future_step. Los flags distinguen propiedad ausente de null real; no inferir esa distinción sólo del valor. Para arrays/objetos registrar también su estructura y cada hoja bajo claves de presentación declaradas; explicar inserciones, eliminación de elementos y sustitución de colección completa. No interpretar esas claves como paths ejecutables del modelo. Debe ser posible reconstruir lo que se aprueba sin ocultar valores relevantes. AI-01 amplía before/after con ReviewValue para arrays/objetos etiquetados y define ProposalUpdateRequest con field_key registrado, sin JSON pointers. Las proyecciones específicas de cada dominio quedan para NI-07; si el diff escalar común no describe fielmente una operación, ampliar su schema antes de publicarla.

Separar tres contenidos: comando normalizado interno completo; proyección exacta pública de efectos/valores revisables; descripción breve generada para el chat. La descripción del modelo no es el comando aprobado. El hash incorpora comando canónico, proyección, actor/destinatario, pasos y bindings, catálogo y precondiciones; el algoritmo de serialización determinista debe definirse/testearse. No incluir claves/códigos introducidos en un formulario seguro dentro del comando que conoce el modelo.

## Confirmación desde la app

La UI solicita desafío únicamente para una propuesta ready/revisión/hash que el usuario está viendo. Server vincula confirmation_token a actor, sesión, conversación, propuesta/revisión/hash y caducidad de política. No aparece en `PublicProposal`, herramienta, prompt, logs ni mensaje guardado.

El botón envía `ConfirmationRequest`: client_request_id, proposal_revision, expected_hash y confirmation_token. Server verifica autorización actual y estado, reclama el desafío/propuesta y crea o recupera la misma ejecución dentro de una transacción. Doble clic, peticiones concurrentes o respuesta HTTP perdida no producen dos ejecuciones. Repetición del mismo request y contenido devuelve la identidad original; cambiar contenido con la misma identidad es conflicto.

Un token de canal separado no demuestra por sí solo una interacción física humana; la garantía es que el runtime del modelo no dispone del endpoint/cookie/desafío ni puede generarlo como herramienta. No dar acceso al navegador autenticado de Nodia o a credenciales de sesión al agente para que pulse su propio botón. Debe verificarse también en el modo agéntico elegido.

Tras confirmar se ejecuta el comando persistido, no una nueva propuesta del modelo. Cambio material de estado, permisos, catálogo, versión de registro o datos utilizados exige invalidar y revisar; no recalcular valores en silencio. Una operación ya ejecutada conserva su recibo aunque la disponibilidad del modelo cambie después.

## Conjuntos secuenciales y dependencias

`nodia_workflows_prepare` recibe draft_ids únicos de borradores individuales ya preparados. El coordinador valida su pertenencia a la conversación/actor, reglas y dependencias, los reclama una vez y reemplaza propuestas individuales anteriores por una propuesta conjunta. Evitar confirmar el conjunto y también su antigua propuesta individual.

Las dependencias forman un DAG validado por Server; la v1 ejecuta un paso por vez, en orden estable. La revisión44 no añade un scheduler de grafos ni una tabla de aristas: conserva depends_on y bindings en los pasos, exigiendo referencias únicas a posiciones anteriores de la misma revisión y coherencia entre ambos. Los únicos bindings futuros permitidos son referencias tipadas a IDs/valores de salida registrados como aptos por la herramienta. `PublicStep.output_bindings` declara target_field_key, from_step_id y output_key del registro; comprobar existencia, tipo, pertenencia y precedencia en Server. No aceptar expresiones, SQL, JSON pointers arbitrarios o interpolación de cualquier resultado. Mostrar “proveedor que se creará en el paso1” como referencia futura. Todos los demás obligatorios conocidos deben estar completos antes de habilitar el botón.

Ejemplo funcional: crear proveedor, después su contacto. La vista previa muestra ambos, el negocio, datos del proveedor/contacto y la referencia futura al ID. Tras confirmar:

- Paso1 se compromete y registra el ID del proveedor.
- Paso2 usa ese ID comprobado, valida el contrato de contactos y se ejecuta.
- Si falla paso2, el proveedor continúa creado; mostrarlo con enlace de la app y dejar el contacto pendiente/fallido.
- Recuperar estado devuelve el mismo proveedor. Reanudar no vuelve a crear paso1.
- Si el usuario cambia el teléfono/destinatario, preparar una revisión nueva sólo para lo pendiente; preservar el recibo del proveedor.

Una salida no compatible invalida el paso dependiente; no adivinar el ID con otra búsqueda. En v1, ante fallo de un paso se detiene el conjunto, incluso si otro paso no depende de él; la reanudación explícita revisa el trabajo restante. No prometer atomicidad entre módulos ni deshacer universal.

Un paso secure_flow puede quedar waiting_for_user hasta terminar el formulario/login. Su efecto real requiere autoridad y confirmación del flujo seguro, sin inyectar secretos en la propuesta. Para una key de reemplazo se confirma el objetivo/impacto; la app valida y envía el secreto directamente al contrato seguro. La recuperación considera estado real del flujo, no un mensaje del modelo.

## Garantía por efecto, fallos y reanudación

Cada paso tiene identidad idempotente estable derivada de la ejecución/step_id y semántica del comando, independiente del call_id del proveedor, stream o intento de worker. Registrar hash del comando, intento/lease, resultado y referencia de dominio. La concesión de trabajo y la confirmación también necesitan deduplicación.

Para escrituras locales, efecto y recibo de éxito deben comprometerse en la **misma transacción**. Los casos de uso comparten el manager/regla de dominio necesaria. No sirve “llamar el caso de uso, después guardar éxito”: una caída entre ambos permite duplicar. Otra vía válida es idempotencia nativa cuya recuperación demuestre el mismo efecto; comprobarla por operación.

| Fuente actual | Reutilización / trabajo necesario |
|---|---|
| Reservas | Mantener Idempotency-Key, reglas transaccionales y recuperación existentes; enlazar claves/recibos del coordinador sin bypass |
| Contactos | Aprovechar creation_key/request_key y versionado; capturar versión en preparación y comprobarla al ejecutar |
| Finanzas | Incorporar deduplicación por intención y recibo con efecto; hoy no ofrece esa garantía general |
| Escrituras legacy de Core/Negocios/IA | Derivar atomicidad/recovery por operación; NI-13 puede exigir refactor previo |
| Facturas y archivos | Recovery de upload evita inconsistencia archivo/factura; no sustituye deduplicación de la intención conversacional |
| Operaciones externas | Admitir resultado incierto; consultar estado verificable antes de reintentar y no asumir rollback externo |

Lease/locks y unicidad deben impedir workers simultáneos. Si se pierde el resultado de COMMIT, marcar reconciliación/unknown hasta consultar la identidad nativa/recibo; no reenviar por timeout. Fallo conocido antes del efecto puede reintentarse con la misma identidad y precondiciones bajo control. Un resumen o evento puede repetirse sin repetir la mutación.

Reanudar exige actor autorizado, revisión de ejecución esperada, ningún paso concurrente y comando pendiente sin cambios. El consentimiento original sólo cubre esos mismos comandos: si cambian valores, ámbito, efectos o precondiciones materiales, pedir nueva vista previa/botón. La reanudación de un resultado unknown recupera primero; `can_resume` no habilita replay ciego. Pasos completados son inmutables y se vinculan a cualquier propuesta posterior.

## Estados durables y vida del chat

| Objeto | Estados propuestos | Regla |
|---|---|---|
| Propuesta | draft, ready, confirmed, superseded, cancelled, expired, invalidated | Sólo ready puede confirmarse; confirmed enlaza una ejecución |
| Ejecución | queued, running, waiting_for_user, completed, partially_completed, failed, cancel_requested, cancelled, unknown | No convertir incertidumbre en éxito; recuperar efectos por paso |
| Paso | blocked, ready, running, waiting_for_user, completed, failed, unknown, skipped, cancelled | Dependiente no se inicia hasta compromiso del antecedente |
| Adjunto | uploading, ready, rejected, expired | Sólo ready y autorizado puede usarse; nulabilidad real de metadata |

Salir de la página corta la observación, no cancela el trabajo admitido. Server mantiene ejecución y eventos suficientes para volver a consultar, incluso después de reinicio. Los mensajes de aceptación son distintos del resultado final. Selección, generación de texto y ejecución de cambios tienen identidades separadas; una inferencia incierta tampoco se reenvía automáticamente.

Cancelar explícitamente bloquea admisión de pasos futuros y solicita detener inferencia si el adaptador lo permite. Un paso iniciado puede terminar y debe reconciliarse. Si hubo efectos comprometidos, mostrarlos aunque el resto se cancele. La cancelación MCP es una señal de petición, no un contrato de rollback del job o del dominio. [Especificación oficial de cancelación MCP](https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/cancellation).

El historial no tiene un número arbitrario de mensajes. Contexto activo usa presupuesto real del modelo/adaptador y selección de información relevante. Compactar guarda resumen versionado/referencias: requerimientos, entidades/ámbito, decisiones, preferencias aceptadas, propuestas pendientes y recibos; conservar mensajes originales conforme a retención. El resumen no cambia autoridad ni reabre efectos. Si falla la compactación, conservar contexto previo e informar; nunca fingir recuerdo o truncar acciones pendientes silenciosamente.

Retención precisada por el usuario durante42/43: borrar contenido conversacional después de90 días desde el **último mensaje del dueño**, con last_owner_message_at/expires_at en Server. No reinician el plazo lectura, renombrado, configuración, confirmación sin mensaje, respuestas del modelo, tools, polling o administración ajena. Adjuntos/transcripciones se borran con el chat; preferencias aceptadas permanecen independientes hasta borrado explícito. La propuesta de check en localStorage sirve sólo como caché: Server valida vigencia y scheduler limpia incluso sin visitas. Para chat vacío se propone created_at como base.42/43 reemplazan la interpretación amplia anterior de “actividad humana”.

No borrar registros de negocio por expirar el chat. [Política AI-04/50](50-nodia-ai-ai04-runtime-policy.md) precisa la decisión posterior del usuario: sin archivo adicional de audit/receipts resueltos/attempts terminales; se borran con el chat. Sólo descriptores mínimos de trabajos no resueltos hasta conciliar/limpiar, sin comandos ejecutables ni reenvío.42/43 separan execution_payloads de receipts, elevan epoch/revocan grants e invalidan propuestas al expirar. Los adjuntos tienen cleanup durable ante PUT tardío; archivo promovido a factura y preferencias aceptadas son independientes. Objetivo físico24h/backups máximo7 días y restore en cuarentena son política técnica con gates pendientes, no garantía desplegada.

Texto, imagen, PDF y audio se representan en MessagePart por referencia privada de adjunto, no base64 en mensajes/cookies ni URL libre. Para voz, separar transcripción/interpretación del comando: pregunta ante duda y confirmación antes de cualquier efecto. Un PDF o resultado de BD es dato no confiable como instrucción operativa. Formatos/tamaños/duración/retención y disponibilidad multimodal se comprobarán por modo.

## Informes combinables con procedencia

`nodia_reports_describe` entrega fuentes lógicas, campos, medidas, dimensiones, relaciones y base temporal admitidos. No expone nombres físicos de tablas/columnas ni autoriza JSON arbitrario de factura. Una fuente declara ámbito/módulo, grano (qué representa una fila), tipo/moneda/escala de cada medida, fecha disponible y operadores permitidos. ReportCatalogItem es resumen: falta implementar el registro detallado y schema por fuente.

`ReportQueryInput` recibe catalog_version, sources y combine = separate o compare_compatible. Cada fuente pide scope, filtros tipados, período si procede, measures con sum/count y group_by opcional. page_limit/cursor acotan grupos de salida; no habilitan all ilimitado. Propiedades SQL, tabla, URL o fragmentos de join se rechazan.

Los predicados comunes son eq/neq/lt/lte/gt/gte, in, contains e is_null; su uso depende del campo. `FilterSet.all` y `any` son listas planas: se interpreta AND(all) AND OR(any) si existen; ausencia de una lista no añade condición. El registro puede rechazar operadores/campos incompatibles. No implementar una expresión recursiva libre para aparentar toda la flexibilidad de SQL.

Un período usa dimensión registrada y rango [from, to_exclusive). Distinguir fecha civil de instante y validar zona IANA, orden y significado de timestamps. “Este mes” se resuelve con zona acordada, fechas y base temporal mostradas. Hoy factura tiene created_at y no fecha de compra/emisión tipada ni estado pagado; gastos de Finanzas tampoco justifican una fecha económica no registrada. Si la pregunta no es inequívoca, preguntar qué fecha/concepto debe contar.

Reglas obligatorias:

- Sumar sobre **todo el conjunto filtrado y autorizado**, antes de paginar grupos; no sumar la página de registros.
- Mantener grano de cada medida: usar semijoins/EXISTS para filtros por relaciones o preagregar antes de joins 1:N.
- No usar SUM(DISTINCT amount) para “arreglar” duplicación: dos facturas distintas con igual importe deben contar ambas.
- Permitir relaciones sólo registradas con pertenencia y cardinalidad conocidas; evitar N+1 y expansión de filas accidental.
- Agregar decimal/bigint con precisión exacta y serializar dinero como cadena; rechazar conversión silenciosa de moneda/escala.
- La compatibilidad requiere unidad, escala, significado, período y grano adecuados. Factura no tiene moneda tipada: no asumir CLP por similitud con Finanzas/Reservas.
- No inferir un total general entre fuentes potencialmente solapadas. `compare_compatible` compara/alinea medidas compatibles manteniendo su procedencia; una suma entre fuentes exige regla explícita de población disjunta/deduplicación, todavía pendiente.
- Una fuente desconocida/fallida no vale cero. Resultado partial señala procedencia disponible e incompleta; no anunciar suma completa.
- El total simple responde primero al monto; detalle se solicita aparte, conservando filtros/semántica.

`ReportResult` entrega columnas tipadas, filas, provenance por fuente, observed_at, ámbito, medida/base temporal y matched_records nullable, además de estado, group_page_complete, next_cursor y source_errors con alias/error seguro. Server valida longitud/tipos de filas según columnas, alias únicos, output_keys sin colisiones y coherencia entre status/procedencia/errores/paginación. Esas relaciones no las garantiza el schema estructural. Una consulta única usa snapshot coherente si debe comparar resultados; varias fuentes/queries deben explicar su instante o snapshot, no aparentar simultaneidad.

El resultado puede mostrar un bloque de gastos personales y otro del alojamiento en el mismo chat. No es necesario crear un reporte UI predefinido para cada filtro permitido, pero sí definir las medidas/relaciones del registro y sus pruebas de exactitud.

## Errores, disponibilidad y feedback

| Caso | Respuesta propuesta / efecto |
|---|---|
| JSON/tipo inválido o campo desconocido | 400 invalid_input, field_errors seguros |
| Sesión ausente/revocada | 401 session_required/session_revoked; no admitir nuevos efectos |
| Recurso ajeno o inexistente | 404 según protección de existencia del dominio |
| Chat propio conocido y lógicamente vencido | 410 expired_chat; tras purga sin metadata autorizable,404. No resucitar mediante consulta/localStorage ni crear tombstones para sostener410 indefinido |
| Falta módulo/acción/autoridad | 403 capability_denied; revocación detiene pasos pendientes |
| Propuesta/revisión/hash/estado obsoleto | 409 proposal_stale / execution_conflict; conservar borrador y revisar |
| Contrato imposible, relación/medida/unidad incompatible | 422 unsupported_semantics; aclaración si puede resolverla el usuario |
| Límite propio alcanzado | 429 execution_limit; dato de política real, no cuota inventada del proveedor |
| Servicio/adaptador indisponible | 503 provider_unavailable; no fallback a otro modo |
| Trabajo aceptado | 202 con identidad; no anunciar éxito final |
| Estado incierto conocido | 200 al consultar ExecutionStatus unknown; recuperar sin reenviar |

Los errores del modelo/MCP usan `ApiError`: code, message_key, detalles de campo seguros, retry_action y correlation_id; no stack, SQL, prompt, cookie ni texto bruto del SDK. Si sólo la inferencia falla después de un efecto, el recibo sigue completed y el chat puede reconstruir el resultado.

Al implementar Client, emitir sileo.success/error internacionalizado para mutaciones y errores HTTP, mostrar resultado por paso y error local/retry. No cerrar preview/modal al fallar ni perder los datos corregidos. Consultar en background no debe repetir toasts ya consumidos; la UI registra entrega de feedback por evento. Invalidar cachés de módulos sólo por efectos comprobados, con query keys e IDs afectados proporcionados por Server; no invalidar todo el cliente por cada token de respuesta.

Conexión habilitada, sesión autenticada, modelo descubierto y conversación con herramientas viable se muestran separados. Desconocido se devuelve null/unknown; preservar cero real. `health` no sustituye una inferencia. Ningún dato operativo se deduce del nombre del modelo.

## Contratos y reglas que faltan implementar

| Pendiente | Resultado necesario antes de habilitarlo |
|---|---|
| NI-01/07 contratos de dominio | Esquemas input/output estrictos por las 141 herramientas, relaciones/defaults/coerciones, proyecciones públicas y compatibilidad por adaptador |
| NI-02/03 autoridad | Registro de módulo padre, políticas compartidas y acceso transversal nuevo con actor/destinatario |
| NI-04 confirmación | Comando canónico/hash, desafío separado, revisiones, dedup de confirmaciones y editor tipado |
| NI-05/08 coordinación | ERD/leases/outbox/recibos o idempotencia nativa, secuencia/resume/cancel/recovery y concesión de background |
| NI-06 informes | Registro de fuentes/granos/medidas/relaciones/bases temporales, SQL parametrizado acotado y procedencia/error por fuente |
| NI-09 adjuntos/secretos | Contratos multipart y UI segura, ownership, transcripción, formatos, límites, retención y borrado |
| NI-10 viabilidad | Primero Web y Agentic por decisión del usuario; chat+tools+contexto por modelo/modalidad y aislamiento; API por etapas |
| NI-11 evolución/contexto | Metadatos/versionado, descubrimiento de módulos futuros y compactación recuperable |
| NI-12 aceptación | Paridad, permisos, concurrencia, dinero, fallos/reinicio y UI responsive ES/EN |
| NI-13 invariantes administrativas | Último superadmin activo, claves inmutables y asociaciones atómicas en reglas compartidas/BD |

No publicar una capacidad cuyo requisito no esté resuelto, aunque aparezca en el manifiesto. [Configuración AI-04](nodia-ai-v1-runtime-policy.json)/[política50](50-nodia-ai-ai04-runtime-policy.md) fijan máximos propios de pasos, resultados, bytes, páginas, duración, concurrencia y deadlines, con validación offline y gates de ejecución. No copiar OCR, inventar tokens/ventanas ni límites comerciales. Modelo y modalidades requieren evidencia propia.90 días desde último mensaje nuevo del dueño; adjuntos y registros técnicos resueltos con el chat, preferencias aceptadas y datos de negocio independientes. Wire/ERD de consentimiento/etapas/contadores de50 siguen pendientes AI-09/12, sin JSON libre ni endpoints productivos por este contrato.

## Matriz de aceptación derivada

| Escenario | Evidencia requerida |
|---|---|
| Preparación ambigua | No hay efecto; pide sólo obligatorios/dudas; respeta false/0/null y preferencias aceptadas |
| Confirmación | Modelo sin ruta/token; revisión editada rechaza token anterior; dos confirmaciones concurrentes devuelven una ejecución |
| Dependencias | Proveedor se conserva al fallar contacto; nuevo worker y resume no lo recrean |
| Caída al comprometer | Resultado incierto se reconcilia con recibo/nativa; no replay; prueba de ambos órdenes de lock |
| Cambios administrativos | No dejar sistema sin superadmin activo; asignaciones atómicas; claves reservadas protegidas incluso con concurrencia |
| Revocación | Retirar módulo/acción/sesión entre pasos detiene efectos pendientes y restringe recuperación |
| Disponibilidad | Reserva cambió antes de confirmar: conflicto con borrador conservado, sin reserva duplicada |
| Informe 1:N | Dos facturas de igual total cuentan ambas; contactos/logs no duplican importe; total independiente del paginado |
| Informe cruzado | Unidad incompatible o población solapada no crea un total ficticio; procedencia por módulo y null distinto de cero |
| Navegación/reinicio | Salir/reabrir conserva turno/operación; events reconnect no reenvía mensajes |
| Multimodal | Archivo ajeno/malformado/instrucción incrustada no autoriza cambios; transcripción dudosa pide precisión |
| Adaptadores | Modelo ausente/retirado, API/Web/Agentic sin herramientas y SDK schema incompatible bloquean publicación sin fallback |
| Evolución | Nuevo módulo aparece por versión/registro, no por exploración de tablas/endpoints |
| UI | Preview exacta/editor, errores conservan borrador/foco, resultados parciales/enlaces reales, i18n y móvil |

Server: unitarias de casos de uso y PostgreSQL desechable para atomicidad/uniqueness/locks; ninguna prueba de servicio/controlador nueva. Client: pruebas de comportamiento de conversación/propuestas/adjuntos y QA responsive, aplicando skills/AGENTS locales al implementar. No usar la validación de archivos JSON como evidencia de esos escenarios ejecutados.

## Continuidad y evidencia de esta entrega

AI-15 materializa las cinco observaciones externas y tres artefactos en [61](61-nodia-ai-ai15-product-reads.md). Las primeras separan captura SQL, consulta con deadline/cancelación y reautorización; un recibo interrumpido no se redispara con el mismo call ID. La respuesta de archivo contiene una referencia privada y la semántica `current_on_download`; el nuevo GET humano `/api/v1/nodia-ai/artifacts/:reference` entrega binario/CSV tras comprobar sesión, chat no expirado y módulo/recurso actuales antes y después del I/O. No envía CSV completo ni URL firmada al prompt. La referencia usa el recibo existente y desaparece con el chat; no se crea un archivo persistente adicional. CSV se regenera con datos actuales, límites de filas/bytes y rechazo de exceso. La factura original sigue siendo un archivo de negocio independiente del chat. Código candidato, publicación aprobada y aceptación Gemini siguen siendo gates separados.

Verificación offline actualizada por AI-01 en [evidencia JSON](../evidence/nodia-ai-v1-catalog-contracts-validation.json):111 definiciones compiladas con Ajv2020 estricto,190 fixtures sintéticas,26 rutas de coordinación y AST actual contrastado, cobertura de177 handlers/156 nombres y175 hashes de fuentes conservados. Incluye rechazo de actor/secretos/token en canales públicos, SQL/URL/operadores arbitrarios, modelos ausentes, fechas inválidas y drafts duplicados; preserva false/0/null y estados unknown. No demuestra todavía guards, hash/nonce, transacciones, reportes, adapters o UI implementados.

- [x] Registrar las tres decisiones del usuario y derivar catálogo40 trazable a los177 handlers.
- [x] Diseñar contrato de propuesta/confirmación, secuencia/recovery e informes compatibles con procedencia.
- [x] Crear biblioteca inicial de60 schemas y ampliarla/verificarla en AI-01 a111 definiciones y190 casos estructurales; sin ejecución de permisos/BD/proveedor.
- [x] Definir ERD42 y arquitectura43 del coordinador, propuestas sin aprobación ni implementación.
- [x] Elegir primeros modos de viabilidad Web/Agentic y precisar caducidad:90 días del último mensaje del dueño; no son pruebas ejecutadas.
- [x] Confirmar adjuntos/transcripciones con el chat y preferencias aceptadas independientes.
- [x] Derivar [plan45](45-nodia-ai-implementation-plan.md) tras revisión44:38 tareas, gasto como primer flujo completo propuesto, fichas/contexto y contratos por dominio pendientes de implementar.
- [x] Concretar política de journal/backups/limpieza física/búsqueda/límites en AI-04/50, con configuración validada y gates de ejecución; no runtime.
- [ ] Implementar esos gates, wire de routing, acceso administrativo a memorias y contratos por dominio.
- [ ] Probar viabilidad de chat y herramientas por modo/modelo.
- [ ] Implementar y verificar matriz de aceptación con app/BD aislada y cuenta real donde corresponda.
- [ ] Obtener aprobación documental explícita; este borrador no declara aprobación documental ni disponibilidad. La autorización general del proyecto permanece vigente.

La verificación de esta entrega es estática/de schemas. No se iniciaron servicios, cambiaron cuentas/credenciales/BD, hicieron inferencias o modificaron endpoints por redactar estos contratos.

## Entrega incremental AI-18

[AI-18/64](64-nodia-ai-ai18-human-confirmation.md) implementa desafío/confirmación por revisión/hash exactos, admisión atómica y recuperación sin duplicados. Metadatos humanos y edición de cinco campos escalares; registro productivo de ejecutores vacío hasta AI-19..20. No publica MCP prepare ni escribe en dominios.

## Entrega incremental AI-19

[65](65-nodia-ai-ai19-financial-effect.md) concreta transactional_witness para un único movimiento financiero confirmado. Reutiliza el caso de uso nativo y el manager existente; efecto/recibo/outbox/estado se comprometen juntos. `FinancialMovementReceipt` cerrado conserva sólo versión/recurso/ID/destinatario; columnas existentes guardan binding/identidad/tiempos. Migración1792600000000 congela el primer binding y el resultado completado sin nuevas tablas/columnas. La ejecución permanece interna, registro productivo vacío y sin publicación MCP hasta AI-20.

## Entrega incremental AI-21

[67](67-nodia-ai-ai21-financial-operations.md) amplía la admisión nativa de [AI-20/66](66-nodia-ai-ai20-execution-recovery.md) a doce escrituras financieras individuales. Los once puertos nuevos usan `FinancialEffectReceipt`, cerrado con versión, recurso, operación, ID y destinatario. Update/delete vinculan además el ID objetivo del envelope original; un recibo de borrado acredita un efecto histórico y no requiere que el registro siga existiendo. La creación v2 conserva `FinancialMovementReceipt`, su binding y catálogo históricos. No se añaden tablas, SQL libre, ejecución de varios pasos ni publicación MCP de preparadores.


[AI-20/66](66-nodia-ai-ai20-execution-recovery.md) conecta el worker al efecto local de un movimiento confirmado: claim/fence, recuperación por witness SQL y cancelación/resume humanos. Reutiliza job/attempt/grant y un marcador acotado de la última reanudación; sin tablas/columnas ni migraciones. No extiende la prueba transaccional a efectos externos ni publica la preparación MCP. Versiones e identidad originales se conservan; cambios materiales requieren nueva propuesta/botón.

## Entrega incremental AI-22

[68](68-nodia-ai-ai22-business-operations.md) amplía el ejecutor local a catorce escrituras individuales de Negocios: negocios/colaboradores, productos/logs, proveedores/contactos y metadatos de facturas. `BusinessEffectReceipt` identifica recurso, operación, ID nativo UUID/bigint y negocio efectivo. La validación de dominio contrasta ese destino con las precondiciones congeladas y conserva el origen/objetivo en el binding; la biblioteca estructural no sustituye esa comprobación. Las operaciones financieras y su recibo histórico mantienen compatibilidad. No se crean tablas ni se publican preparadores MCP.

Los escritores nativos comparten EntityManager con el efecto/witness. Producto y log, traducciones y asociaciones se comprometen según el caso de uso nativo; contactos conserva request_key/version. La validación de relaciones proveedor/producto/factura se aplica también al escritor REST y coordina sus locks con traslados, sin añadir aislamiento por negocio o permisos por acción. Los números usan controles de revisión `integer` explícitos cuando el contrato nativo requiere enteros JSON; defaults omitidos no reaparecen después de la preview. La preparación pública no acepta envelopes internos por confiar en un campo `schema_version`; reconstruir un template almacenado utiliza un canal interno separado.

La paridad de archivos conserva límites explícitos: los tres artefactos privados de AI-15 siguen disponibles bajo autorización/estado actuales; no hay upload/promoción de adjuntos nuevos desde NodiaAI hasta AI-32 ni traslado de una factura con archivo sin copia recuperable. El modelo no aporta claves de almacenamiento ni URLs y la vista previa sólo comunica si el archivo sigue asociado. El recovery nativo de upload de ADR-026 se conserva, fuera de transacciones largas, y no se equipara a deduplicación de intención. El gate de descarga binaria R2 real continúa abierto.

La [verificación offline](../evidence/nodia-ai-v1-catalog-contracts-validation.json), reconciliada hasta AI-22, compila134 definiciones comunes y184 de dominio,320 fixtures estructurales,31 rutas de coordinación y625 hashes de fuentes. El AST actual conserva43 controladores/204 handlers/323 pares método-ruta y68 módulos locales; el catálogo de diseño conserva156 nombres y siete exclusiones bulk. Estas cifras no prueban autorización, SQL, recuperación, Gemini o UI. La evidencia ejecutada y sus gates se registran por separado en68; ninguna actualización aprueba documentación o publica nuevas capacidades.

## Entrega incremental AI-23

[69](69-nodia-ai-ai23-dependent-workflows.md) implementa `WorkflowPrepareInput`: catálogo coordinador `nodia-ai-ai23-workflow/1`, lista ordenada de uno a ocho `draft_ids` únicos y bindings explícitos entre ellos. Server exige conversación/actor comunes, vigencia, autoridad actual y un puerto compatible; reclama los borradores y sustituye sus propuestas individuales anteriores de forma transaccional. Las referencias sólo apuntan a posiciones anteriores de la misma revisión. Los26 puertos nativos conservan sus hashes/contratos al combinar operaciones independientes; el primer binding operativo es proveedor creado `id` hacia contacto nuevo `provider_id`.

`PublicStep` conserva `depends_on` y `output_bindings`. El ID futuro se presenta mediante `origin:future_step`, `after:null` y `after_present:false`, con su referencia visible; no se inventa un ID ni se ofrece editarlo libremente. Los demás campos obligatorios deben estar completos. Una edición de la propuesta lista genera revisión/hash nuevos y remapea conjuntamente IDs y dependencias. La confirmación humana cubre el conjunto exacto; una propuesta individual sustituida no puede confirmar la misma intención.

El worker ejecuta un efecto por paso y utiliza sólo outputs tipados de recibos comprometidos y validados. La resolución inicial persiste una vez el envelope cerrado `command_template/scope/preconditions` y su hash antes de llamar al escritor; efecto, recibo y transición del paso se comprometen juntos en otra transacción corta. Un fallo detiene el sufijo y conserva el prefijo completado. Recuperar observa, reanudar mantiene los mismos comandos/precondiciones y corrige una incertidumbre antes de otro intento.

`RemainingWorkflowPrepareInput` permite preparar una corrección material de lo pendiente bajo la revisión esperada de ejecución. Produce otra propuesta/hash y requiere otro botón; enlaza `prior_execution_id`, conserva los recibos anteriores y cierra la vía de reanudación de la intención sustituida. No añade una ruta pública de preparación ni una herramienta publicada. Cancelar lo pendiente es independiente de poder reanudar: incluso un fallo material puede abandonarse sin deshacer el prefijo.

La migración AI-23 añade el payload enlazado y el linaje de propuesta, sin tablas nuevas. La validación cerrada, inmutabilidad SQL y purga del payload con su fuente complementan la validación estructural. [47 comprobaciones AI-23](../evidence/nodia-ai-ai23-postgresql.json) y [229 regresiones](../evidence/nodia-ai-ai23-regressions.json) verifican el protocolo compilado con PostgreSQL desechable, HTTP e interrupciones de procesos; no acreditan inferencia Gemini ni publicación MCP. El estado de la activación y las suites finales se registra en69.

## Continuidad incremental AI-24

[70](70-nodia-ai-ai24-rental-configuration.md) incorpora seis preparadores internos para crear/actualizar casas, colaboradores y políticas. Conservan el ámbito y los mínimos de los DTOs nativos, claves de intención persistidas, preview/revisión/hash exactos y botón humano. No se añaden DELETE ni nuevas herramientas publicadas. Las reservas, pagos y otros comandos mantienen AI-25/26.

`RentalEffectReceipt` es un testigo cerrado con `schema_version`, recurso, operación `create|update`, ID bigint string del registro y `property_id`. El coordinador comprueba su coherencia con el comando/ámbito congelados; para crear una casa ambos IDs deben coincidir. La recuperación histórica no reconstruye un recibo leyendo el registro actual. Se reutilizan las tablas/columnas existentes y el journal nativo.

La metadata de revisión añade `kind:rental_cancellation_rules`: el editor muestra filas de anticipación/porcentaje y envía el valor completo bajo `ReviewValue`, sin expresiones, SQL o JSON libre. Se aplican las reglas nativas de1..100 tramos, umbrales únicos0..36500 con tramo0 y porcentajes0..100 de hasta dos decimales. El backend normaliza orden/porcentajes; no se inventa monotonía. Cambiar reglas produce otra propuesta/hash y confirmación. Dueño/ámbito no se cambian por ese canal de edición.

## Continuidad incremental AI-25

[71](71-nodia-ai-ai25-rental-reservation-lifecycle.md) amplía los puertos internos a `rental_reservations`: crear/editar borrador y comandos `confirm`, `start`, `complete`, `cancel`. Cada operación mantiene un contrato propio, ámbito de casa y, salvo creación, ID de reserva congelado. `RentalEffectReceipt` admite estas seis operaciones sólo para reservas; casas, colaboradores y políticas conservan create/update. No incluye datos del huésped, reglas, importes o payload ejecutable.

La disponibilidad es una lectura informativa existente, sin hold ni promesa de confirmación. Crear produce draft y no crea pagos; confirmar revalida acuerdo, abono/plataforma, ocupación y preparación. Iniciar y completar verifican estado y reloj real del servidor, sin fabricar hechos históricos. Actualizar no elude la inmutabilidad del acuerdo tras dinero o confirmación.

Cancelar requiere aviso efectivo explícito y revisión del cálculo nativo. El monto esperado se obtiene de la preview autorizada y se congela junto con las precondiciones; un cambio material exige otra revisión/confirmación. Cancelar libera ocupación y determina la obligación de devolver, pero no registra una devolución ni altera el dinero cobrado. Los pagos/devoluciones permanecen en AI-26. La lista de aprobaciones de mismo día y las condiciones externas se muestran de forma estructurada; no se editan como JSON libre ni se aprueban implícitamente por consultar disponibilidad.

Se reutilizan el journal nativo, recibos y recuperación de AI-20/23/24, sin tablas/columnas/migraciones nuevas. Registro interno, publicación MCP, contexto aprobado y aceptación con Gemini son hitos distintos; AI-25 no publica preparadores por añadirlos a la composición.

## Implementación AI-31: resultado de informes y recibos

La [entrega77](77-nodia-ai-ai31-cross-reports.md) concreta ReportResult mediante el schema dedicado `nodia-server/src/nodia-ai-reports/config/report-composition.schema.json`: conserva columnas/filas/procedencia/partial y añade combine, snapshot_consistency y source_results con totales exactos por fuente. Los schemas comunes históricos permanecen intactos. Los dos puertos técnicos de lectura se congelan por hash y grant del turno, con reautorización final y al observar el recibo. Comparaciones agrupadas que exceden el límite completo se rechazan para evitar alinear páginas independientes; separate conserva cursores. No hay suma global, fotografía conjunta ni cálculo nuevo al expandir un recibo. Ficha draft y aprobación documental siguen independientes.

## Continuidad AI-33 — preferencias aceptadas

[Entrega79](79-nodia-ai-ai33-accepted-preferences.md) concreta la memoria aceptada prevista por estos contratos. La coordinación HTTP incorpora catálogo/opciones/listado propios y preparación humana de create/update/delete; guardado exclusivamente por propuesta, desafío, botón exacto y ejecución existentes. Las definiciones Preference* dejan de aceptar un scalar/key libre: registro de cinco referencias, scope tipado de negocio para proveedor, IDs canónicos y expected_revision para editar/olvidar. Listado incorpora disponibilidad y etiquetas autorizadas; un recuerdo no disponible puede olvidarse sin recuperar su módulo de origen. No se publican preparadores MCP ni se convierte el acceso HTTP en permiso del modelo. El scope y las autorizaciones nativas de cada recurso se conservan; referencia de proveedor global no equivale a favorito de negocio global.


## Implementación AI-34 — continuidad citada

[Entrega80](80-nodia-ai-ai34-long-context-compaction.md) concreta el contrato interno cerrado del resumen (cinco colecciones de citas/secuencias), snapshots anclados a fuentes/scope y referencias operativas actuales reautorizadas. No añade rutas públicas de coordinación. El contrato privado de medición del adaptador distingue bytes del prompt nativo inicial, medida exacta/cota superior y tokens desconocidos. Resumen e historial no sustituyen autorización ni confirmación humana. La verificación final sigue en la entrega80; no aprobación automática.
