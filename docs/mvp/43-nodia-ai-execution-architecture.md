# NodiaAI arquitectura de ejecución de la v1

> Continuidad AI-28: [configuración IA74](74-nodia-ai-ai28-provider-configuration.md) y [ADR-052](../architecture/decisions/ADR-052-nodia-ai-provider-configuration.md) comparten escritores nativos y manager con cuatro efectos locales. Revalidan actor/ai:manage y módulos, bloquean catálogo→conexiones para conservar el predeterminado y preservan preferencias por canal. Una sincronización nativa relee y combina observaciones después de la red, sin mantener SQL abierto ni pisar preferencias. Transacción activa no demuestra locks: el escritor heredado comprueba la frontera actual y no reinicia plazos. Sincronizar/cerrar sesión mediante NodiaAI sigue su gate externo; no se disfraza de efecto SQL.

> Continuidad AI-27: [administración Core73](73-nodia-ai-ai27-core-administration.md) y [ADR-051](../architecture/decisions/ADR-051-nodia-ai-core-exclusive-execution.md) incorporan17 escritores con la misma transacción nativa y recibo. Un hint acotado selecciona frontera exclusiva antes de cualquier lectura de ejecución; no concede autoridad y el dispatch vuelve a exigir prueba scoped del manager. No hay upgrade SHARE→exclusive. Los escritores nativos heredan manager, locks y plazos; la invalidación Redis ocurre fuera de SQL. Recibos históricos evitan consultar o repetir recursos ya eliminados. No añade ledger, cola, esquema o permisos, ni publica MCP.

> Continuidad AI-26: [entrega72](72-nodia-ai-ai26-rental-money-occupancy-preparation.md) compone los módulos verticales internos `NodiaAiRentalMoneyModule` y `NodiaAiRentalOperationsModule` sobre la misma admisión, worker, manager y recibo atómico. Las reglas puras de preparación son compartidas con los escritores nativos; no agrega cola, ledger, hold ni esquema. Registros monetarios no realizan transferencias externas. Recuperación nativa conserva actor original; super_admin observa ejecuciones ajenas autorizadas sin confirmar ni reanudar como su dueño. MCP/Gemini de escritura conserva su gate.

> Continuidad AI-23: [entrega69](69-nodia-ai-ai23-dependent-workflows.md) materializa conjuntos secuenciales y bindings tipados sobre el worker ya implementado, sin scheduler DAG ni tablas de aristas. Los apartados históricos conservan su estado de diseño inicial; esta ampliación y su [ADR-050](../architecture/decisions/ADR-050-nodia-ai-dependent-workflows.md) permanecen en revisión, sin aprobación automática ni publicación de escrituras MCP.

> Continuidad AI-09: [persistencia55](55-nodia-ai-ai09-conversation-persistence.md) materializa contratos cerrados de esfuerzo/routing/etapas/presupuesto y migración M1, sin publicar rutas, worker o inferencias. Modelo completo revisión3:23 tablas/298 columnas/62 FKs; M1:11/151. La auditoría vinculada al chat pasa a CASCADE conforme50; pendientes mínimos siguen separados. Las menciones anteriores de wire/ERD pendiente describen el baseline anterior; runtime permanece AI-10..12.

> AI-08 implementado localmente: [autoridad transversal, invariantes y evidencia](54-nodia-ai-ai08-transversal-authority.md). Destinatario explícito, actor real, barreras de transacción y NI-13 verificados; consumidores/herramientas del chat pendientes. Esta nota sustituye menciones históricas de acceso transversal pendiente, sin aprobar documentos ni invalidar sus reglas nativas.

> Estado: propuesto en revisión; ejecución no implementada
> Fecha: 2026-10-14
> Dependencias: [plan38](38-nodia-ai-research-and-v1-plan.md), [inventario39](39-nodia-ai-current-capabilities-inventory.md), [catálogo40](40-nodia-ai-tool-catalog-v1.md), [contratos41](41-nodia-ai-v1-contracts.md), [ERD42](42-nodia-ai-erd.md)
> Decisiones: [ADR-032](../architecture/decisions/ADR-032-nodia-ai-domain-tools-and-conversation.md), [ADR-033](../architecture/decisions/ADR-033-nodia-ai-confirmation-and-sequential-recovery.md), [ADR-034](../architecture/decisions/ADR-034-nodia-ai-postgres-jobs-and-retention.md)

## Decisión técnica propuesta

Revisión de alcance confirmada: [política48](48-nodia-ai-mode-routing-policy.md)/[ADR-036](../architecture/decisions/ADR-036-nodia-ai-opt-in-agentic-routing.md). Web queda conversacional; sólo puede delegar hacia Agentic verificado mediante un switch explícitamente habilitado, API después. No cambiar una selección congelada ni hacer fallback por fallo. Contratos/persistencia de consentimiento y fases aún requieren reconciliación antes de AI-12; este documento no los acredita con los campos existentes.

Nodia Server coordina conversación, propuestas y efectos. PostgreSQL conserva jobs, estado, recibos y outbox; workers del mismo proyecto ejecutan trabajo independientemente del navegador. Se propone una entrada Nest de worker sin puerto HTTP y composición compartida de casos de uso, separada de la API. No se crea un microservicio o una BD nueva.

PostgreSQL es la fuente durable; Redis puede acelerar avisos/caché, pero su pérdida no autoriza replay ni determina aprobación. Los rate limits Redis actuales conservan su política y siguen pudiendo rechazar admisión si su dependencia falla. Elegir PostgreSQL para jobs no vuelve opcional el rate limiter del producto.

La cola entrega trabajo al menos una vez. La garantía de no duplicación se implementa por identidad estable y transacción/idempotencia del efecto; no prometer ejecución externa exactly-once. Las leases coordinan consumidores, no demuestran que un proceso remoto terminó.

## Componentes y límites

[AI-07/53](53-nodia-ai-ai07-module-authorization.md) implementa el módulo/política compartida de identidad/módulos/propiedad con lectura actual de PostgreSQL, sin caché. Es una decisión puntual, no concesión ni barrera transaccional. La conexión de consumidores y las garantías de efectos siguen sus etapas.

~~~mermaid
flowchart LR
    Client[Nodia Client] --> API[API autenticada]
    API --> UC[Casos de uso NodiaAI]
    UC --> PG[(PostgreSQL)]
    Worker[Worker Nodia Server] --> PG
    Worker --> Adapters[Adaptadores por modo]
    Adapters --> Provider[Proveedor o runtime privado]
    Provider --> Calls[Solicitudes de herramienta]
    Calls --> Gate[Validación y autoridad]
    Gate --> Prepare[Lectura o preparación]
    Prepare --> PG
    Client --> Button[Botón de confirmación]
    Button --> API
    Worker --> Exact[Comandos confirmados persistidos]
    Exact --> Domain[Casos de uso del dominio]
    Domain --> PG
    API --> Events[Eventos persistidos o consulta]
    Events --> Client
~~~

El diagrama resume canales, no conecta el runtime del modelo al botón. La API, workers y puertos de dominio pertenecen al límite Nodia Server. Sólo Server consume servicios privados mediante red/credencial de servicio de [ADR-008](../architecture/decisions/ADR-008-internal-microservices-only.md); Client y proveedor no reciben acceso a la BD ni credenciales internas.

| Componente | Responsabilidad | Dependencias permitidas |
|---|---|---|
| API NodiaAI | Sesión, DTOs y delegación a casos de uso; SSE/consulta | Casos de uso; sin reglas de dominio en controller |
| Conversaciones/contexto | Historial, selección, caducidad, compactación y entradas | Repositorios/adjuntos y registro público |
| Registro de capacidades | Contratos, proyecciones, reglas de ámbito y estrategias de recovery | Exportaciones tipadas de módulos existentes |
| Coordinador de turno | Construir contexto autorizado y ciclo de funciones | AdapterPort, ToolGateway, jobs/outbox |
| Propuestas/confirmación | Borradores, versiones, edición tipada y challenge humano | Persistencia y autoridad actual |
| Ejecutor de operaciones | Comandos persistidos, secuencia/bindings, receipts y resume | Puertos de dominio con garantías declaradas |
| Scheduler/worker | Claim, lease/fence, dispatch, conciliación y limpieza | Jobs/attempts; no estado exclusivo en memoria |
| Adaptadores | Inferencia/continuación/multimodal/protocolo por modo | Gateway privado; sin confirmar ni SQL/shell general |
| Observación | Reconstruir eventos/resultados con autorización | Outbox; no reinicia trabajo al reconectar |

Propuesta de recursos verticales: nodia-ai-conversation, nodia-ai-turn, nodia-ai-proposal, nodia-ai-operation, nodia-ai-attachment, nodia-ai-preference; soporte compartido en nodia-ai-common/runtime. Varias tablas pueden pertenecer al mismo recurso; no crear un módulo o servicio público por cada tabla del ERD. La revisión44 y ADR-035 incorporan estructuras por necesidad y mantienen adapter_states condicional.

Los dominios exportan casos de uso/puertos explícitos; el composition root agrega capacidades y adaptadores mediante DI. No resolver clases/rutas arbitrarias por nombres enviados por el modelo, llamar controllers internos o duplicar providers Nest. El dominio no importa módulos NodiaAI: el coordinador consume su contrato. Si requiere observador transaccional, definirlo como puerto neutral, no dependencia inversa.

Nest permite contextos standalone sin listeners; guards/pipes/interceptors HTTP no se ejecutan automáticamente allí. Las reglas del caso de uso deben compartir validación/autoridad efectiva. [Documentación oficial Nest](https://docs.nestjs.com/standalone-applications). El WorkerModule futuro importa sólo dependencias necesarias, sin levantar controllers/listeners ni duplicar workers legacy de AppModule.

## Admisión de un mensaje

1. Autenticar sesión/usuario y NodiaAI; resolver conversación y comprobar vigencia. Una selección completa/real y adaptador verificado son requisitos para inferencia.
2. Buscar client_message_id existente **antes** de rechazar por revisión consumida. Si input_hash coincide, devolver mensaje/run originales y su selección fija; si difiere,409. No volver a evaluar la intención.
3. En transacción corta, bloquear chat y puerta active_job_id; revalidar revisión/vigencia. V1 admite una actividad activa por chat, sin paralelizar inferencia y operación confirmada dentro de ese chat.
4. Persistir mensaje/partes, secuencia, configuración exacta del run, catálogo/política/retention_epoch, grant acotado, job y evento de aceptación.
5. Si author_id es el dueño, actualizar last_owner_message_at/expires_at con reloj de Server. Repetir la admisión idempotente no reinicia el plazo.
6. Commit y202 con IDs estables; la conexión HTTP no es el worker.

Un chat nuevo puede existir sin selección, pero no ejecutar con modelo vacío. GET, ping, token del modelo, tools, confirmación, renombrado o localStorage no prolongan retención. Un mensaje recibido después de expires_at no resucita el chat; requiere conversación nueva. La purga revalida la misma fila para no borrar uno renovado válidamente antes del vencimiento.

Una ejecución confirmada esperando completar un flujo seguro mantiene su exclusión de cambios de selección hasta resolver/cancelar. Un turno que terminó con pregunta/propuesta libera el worker: la respuesta humana admite un turno nuevo y reutiliza sólo borradores válidos, sin dejar una transacción abierta esperando al usuario.

## Construcción y compactación de contexto

ContextBuilder combina historial canónico relevante, snapshot válido, preferencias aceptadas autorizadas, catálogo pertinente y recibos/propuestas que necesita la petición. Guarda un manifiesto de fuentes/ámbitos y ancla through_message_seq. No cargar todas las 141 herramientas o toda la BD en cada prompt.

La autoría sigue el[estándar](../nodia-ai/knowledge/README.md): AI-05 crea fichas y[AI-06/52](52-nodia-ai-ai06-knowledge-publication-contract.md) implementa frontmatter único y compilador de build. Vincula revisión/hash con capacidades/schemas/módulos y emite assets elegibles; corpus actual37 borradores, bundle válido vacío y cero herramientas publicadas. KnowledgeRegistry/startup/ContextBuilder siguen pendientes AI-12: validar pin de release/ToolRegistry y resolver sólo fragmentos autorizados, sin docs/repo en VPS, registrando IDs/revisiones/hashes en context_manifest. Borradores/plantillas no habilitan contexto; caché de conocimiento por release sin compartir datos/memorias. [Plan45](45-nodia-ai-implementation-plan.md#cómo-server-cargará-ese-contexto) conserva gates de autoridad/registro/runtime, sin atribuirlos a checks de build.

La compactación es un artefacto inmutable del chat, con source_hash y contrato del constructor. Conserva hechos, dudas, entidades/ámbito, decisiones, preferencias aceptadas y referencias de efectos; nunca sustituye los recibos de idempotencia. Si falla, mantener contexto anterior y bloquear/explicar el siguiente paso que requiere presupuesto, sin truncar información silenciosamente.

AdapterState contiene sólo estado opaco permitido por su contrato, cifrado con versión de clave y propósito distinto de las API keys. Cookies, códigos OAuth y claves pertenecen al runtime seguro, no a esa columna. Antes de reutilizar estado comprobar dueño, conexión/modo/modelo, versión, generación, context_hash y ámbitos actuales. Cambiar de modo rehidrata desde Nodia; no traslada sesiones o opaque state a otro proveedor.

Si cambian permisos, invalidar contexto derivado que incluya herramientas/fuentes ya no recuperables y reconstruir sin ellas. Un texto recuperado de PDF/BD/estado de proveedor es dato, no instrucciones de sistema. La disponibilidad de tokens/modalidades y la estrategia de compactación se verifican por adaptador/modelo; ningún nombre comercial demuestra capacidad.

## Ciclo de herramientas

Persistir adapter_call_id, nombre, contrato, argumentos tipados/hash y alcance en tool_calls. Repetición del mismo call_id dentro del run recupera resultado; contenido distinto es conflicto. No tratar call_id como identidad de una mutación de negocio.

ToolGateway valida definición/versionado, sesión/grant actual, módulo padre y autoridad de recurso, entrada y salida. Herramientas read consultan proyecciones; prepare sólo produce borrador/propuesta. Secretos/login se completan en el canal seguro de la app. No existe herramienta confirm/SQL/HTTP arbitrario.

Las consultas pueden repetirse bajo política si su semántica es de lectura, pero no prometer que regresan un snapshot idéntico. Análisis/inferencia externa puede consumir recursos y tener resultado incierto aunque no cree registros: no reenviarlo automáticamente por ser “lectura”. Recibir JSON no acredita una herramienta válida; no autorizar mediante regex de texto libre.

## Preparar y confirmar

Normalizar contratos del dominio y preguntar obligatorios/dudas. Preparación lista crea revisión/pasos/preview inmutables. El comando final tiene todos los valores conocidos y bindings futuros declarados/tipados. El Server controla sus claves de presentación y semántica, no paths arbitrarios.

Se propone JCS de RFC 8785 para serialización determinista del envelope, después de normalización por dominio, y SHA-256 para hash. Rechazar valores JSON ambiguos/duplicados y números no representables; bigint/dinero mantienen cadenas. Arrays sólo se ordenan si el contrato declara semántica de conjunto. No usar localeCompare como orden canónico universal ni cambiar Unicode después del hash. [RFC 8785](https://www.rfc-editor.org/info/rfc8785/).

El envelope incluye versión de canonicalización, actor/destinatario, catálogo, scopes, templates, bindings, precondiciones y proyección pública exacta. Se reconstruye desde metadata congelada de propuesta/revisión y sus pasos ordenados, sin JSONB duplicados de envelope/preview ni nuevas lecturas de negocio para alterar lo aprobado. IDs/hashes no reemplazan la validación del comando. La librería o implementación canónica debe verificarse con vectores oficiales antes de publicar.

La UI pide challenge para proposal/revision/hash. Guardar token_hash, sesión/actor y vencimiento; raw token sólo al canal humano. Al confirmar:

- Revalidar autoridad/vigencia y comprobar hash/revisión/state ready.
- Si client_request_id ya produjo la misma ejecución, devolverla bajo autoridad actual; no exigir consumir otra vez el nonce usado ni generar efecto nuevo.
- En una transacción, reclamar proposal/challenge, crear execution/steps/grant/job/outbox y marcar confirmed.
- UNIQUE(origin_proposal_id) impide dos ejecuciones aun con client_request_id distintos; conflicto de hash/actor no es replay válido.
- Edición de confirmed no cambia comandos aprobados. Corregir trabajo pendiente requiere nueva propuesta relacionada con la ejecución anterior.

El runtime del modelo no obtiene desafío, credenciales Nodia o navegador autenticado para pulsar su propio botón. Verificar aislamiento también en Agentic. No mantener locks durante revisión humana.

## Ejecutar pasos confirmados

El worker toma un comando persistido y valida versión/autoridad, lease, epoch, deadline y precondiciones. Pasos en orden estable, un fallo detiene el conjunto. No hay tabla de aristas ni scheduler DAG: depends_on/output_bindings conservados en los pasos se validan contra posiciones anteriores de la misma revisión. Binding usa ID/valor permitido de un antecedente completed verificado, o referencia comprobada de un efecto previo. First-bind persiste argumentos resueltos/hash una vez.

| Estrategia | Garantía y aplicación |
|---|---|
| transactional_witness | Caso de uso recibe manager/UoW compartido; efecto, receipt y outbox se confirman en la misma transacción |
| native_idempotent | Intención durable antes de llamar; dominio garantiza clave+hash+efecto+respuesta atómicos; recuperación verifica esa misma operación |
| external_reconciled | Intención y dispatch registrados, con identidad/consulta remota verificable; si no puede comprobarse, unknown y no replay |
| unsupported | No publicar la escritura hasta implementar su garantía |

Reservas ya tiene journal atómico propio. No anidar una transacción del coordinador alrededor de un caso que abre/compromete otra y llamarlo atomicidad conjunta. Puede usar native_idempotent y reparar el intervalo antes de registrar el resultado coordinador, porque su receipt nativo ya está unido al efecto. Otra alternativa es un puerto neutral de observación dentro de su transacción. Validar la estrategia con el caso real. Fuentes: [RentalTransactionService](../../nodia-server/src/rental-common/rental-transaction.service.ts), [RentalOperation](../../nodia-server/src/rental-operation/entities/rental-operation.entity.ts), [ADR-013](../architecture/decisions/ADR-013-rental-integrity-and-idempotency.md).

Hash de aprobación, bound_command_hash y request_hash nativo tienen propósitos/canonicalizaciones diferentes. El adaptador de recovery usa la normalización real del dominio y registra en recovery_descriptor la identidad/hash/versión necesarios; no compara directamente JCS con un hash legacy ni cambia el protocolo nativo para que coincidan. La clave nativa se reutiliza sólo con el mismo comando normalizado.

Finanzas/Core/Negocios requieren deduplicación/UoW por operación antes de habilitar sus escrituras. Contactos conserva request_key/version; el wrapper no añade garantías ausentes. Facturas incorpora su protocolo de uploads: no sustituirlo por receipt después de commit ni interpretar recovery de archivo como idempotencia conversacional.

Después de un paso comprobado, guardar resultado mínimo/full payload autorizado y evento; pasar al siguiente. Ante fallo, mostrar lo comprometido y lo pendiente. Reanudar el mismo comando conserva identidad y no repite completed. Si cambia algún dato/materialidad, nueva preview/botón; el modelo no corrige y ejecuta silenciosamente.

## Claims, leases y fencing

Scheduler consulta índices ready y claims con FOR UPDATE SKIP LOCKED, en transacciones cortas. Asigna worker_id, incrementa fence/attempt, fija lease_until y confirma antes de hacer I/O externo. PostgreSQL documenta SKIP LOCKED como apropiado para consumidores de colas, no para resultados consistentes de consultas generales. [SELECT de PostgreSQL 16](https://www.postgresql.org/docs/16/sql-select.html).

Cada claim procesa **una etapa acotada**, identificada por stage_key/stage_seq: construir contexto, una inferencia, una llamada de herramienta, finalizar turno o un paso confirmado. Guardar resultado y siguiente etapa con job ready en una transacción, manteniendo la puerta del chat; el siguiente claim obtiene fence/attempt nuevos. job_attempts conserva el stage snapshot, fase y referencia externa de esa entrega. No reutilizar una fila de intento para varias inferencias consecutivas y perder cuál quedó incierta. Subefectos de un comando compuesto necesitan su protocolo nativo de recuperación o desglose explícito.

Un adaptador agéntico con callbacks MCP puede producir varias lecturas/preparaciones dentro de una única operación remota identificada. ToolGateway liga cada callback al run, contrato, call_id, grant y fence de esa operación; no necesita tomar otra puerta del mismo chat ni esperar confirmación humana dentro del callback. Cuando el adaptador permite un loop gestionado por Server, preferir checkpoints entre solicitudes y resultados. Verificar ambos protocolos en viabilidad, no asumir equivalencia.

Cada actualización comprueba job/fence/holder/estado vigentes. Heartbeats renuevan sólo su lease; al fallar dejan de iniciar trabajo nuevo. La transacción de efecto revalida fence y toma su lock de identidad. Un fencing token protege commits controlados por Nodia; no detiene por sí solo navegador, CLI o proveedor ya iniciado.

Persistir fase de intento antes de dispatch. Expiración de lease tras dispatch_armed/sent pasa a conciliación conservadora: podría haberse enviado aunque no haya respuesta. No basta con dar la lease a otro worker y repetir generate/cancel/create.

Runtime slots identifican el **perfil/proceso real compartido**, no sólo connection_id. Dos conexiones pueden apuntar al mismo perfil. Web/Agentic/OCR/login/model-discovery que consuman ese perfil deben coordinarse por el mismo gateway; verificar el conjunto de entradas, no sólo el chat nuevo. Slot held vencido se pone unknown hasta comprobar fin/terminación de la operación anterior. En API, capacidad/concurrencia configurable proviene de política verificada, no del nombre del modelo.

Evitar inferencia/OCR anidado desde un callback que ya retiene el mismo perfil: esperaría su propio slot. Requiere yield/suspensión comprobada, loop por etapas o runtime independiente elegido explícitamente; si no existe, declarar bloqueo de esa capacidad en ese modo. No evadir el lock ni cambiar conexión/modo en silencio. Esto afecta especialmente herramientas de análisis de adjuntos y login interactivo.

En waiting_for_user se suelta lease de worker; la reserva de un flujo interactivo queda a cargo de su protocolo explícito. Ninguna conexión de DB permanece abierta mientras el usuario responde. Reanudación es un caso de uso autenticado que admite trabajo, no un heartbeat infinito.

## Autoridad concurrente y orden de locks

Grant guarda actor/session_public_id, operaciones/módulos/ámbitos permitidos, hash confirmado y vencimiento acotado por sesión y deadline. Nunca persiste JWT/cookies. Logout/revocación impide futuros efectos; salir de la página no. Si desaparece la sesión FK null hace grant inválido.

Se propone una barrera transaccional compartida por lectores de autoridad y escritores de roles/asignaciones/actividad: lock compartido para comprobar, exclusivo para modificar, con namespace estable y actores ordenados. Adquirir desde el inicio el modo necesario para operaciones administrativas; evitar upgrades de lock concurrentes.

Orden candidato: barrera global de política → barreras de actores ordenadas → puerta del chat → identidad del efecto → locks propios del dominio. Reservas conserva casa → reserva → dependientes. Claim de job es transacción aparte; no mantener su fila bloqueada durante red. Los escritores REST de autoridad deben seguir la barrera; añadirla sólo al worker no prueba revocación concurrente. Confirmar el orden definitivo contra caminos de cada dominio/NI-13 y pruebas de deadlock antes de publicar.

Lecturas e inferencias externas revalidan autoridad al construir/enviar contexto y aceptar resultados; no sostienen locks durante red. Revocar no retira datos ya enviados ni deshace commits precedentes. Define el punto de autorización observable y detiene pasos posteriores. Super_admin separa actor de destinatario; ver chat ajeno no confirma como su autor.

## Recuperación y cancelación

| Situación | Tratamiento |
|---|---|
| Job aún no dispatchado y lease vencida | Reclamar bajo fence nuevo, revalidar grant/epoch/deadline |
| Escritura local con respuesta COMMIT perdida | Esperar/adquirir lock de la identidad y consultar receipt o journal nativo; no concluir fallo por timeout |
| Inferencia/CLI/browser incierto | Recuperar identidad remota/estado comprobable; mantener unknown si no hay evidencia |
| Worker viejo vuelve | Rechazar su fence/epoch; resultado no cambia completed actual |
| Paso2 falla tras crear proveedor | Proveedor permanece, contacto pendiente; resume sólo paso2 con identidad válida |
| Logout/revocación | Cerrar grants y admisión de pasos; conservar resultados previos; sesión nueva revalida recuperación |
| Cancelación solicitada | Bloquear pasos futuros; pedir parada si existe contrato; reconciliar paso iniciado, sin rollback ficticio |
| Deadline | Mismo cuidado que cancelación; no abandonar write mediante Promise.race y devolver falso fracaso |
| Restauración de backup | Arrancar en modo recuperación sin dispatch automático; conciliar jobs/efectos/runtimes y sesiones antes de admitirlos |

Shutdown deja de reclamar, solicita detener trabajo según contrato, espera el drenaje acotado por política y conserva estados inciertos. No “terminar” todos los jobs porque cae el proceso. Los workers deben volver de un reinicio sin depender de promises, SSE o localStorage anteriores.

## Observación y frontend

Evento público se persiste con transición/receipt en la misma transacción cuando sea local; con estrategia nativa, la reparación genera el evento después de verificar su receipt. Su payload acotado contiene transición/deltas/referencias; reportes y resultados completos permanecen en tool_calls/execution_payloads, reautorizados al consultarlos. Outbox es PostgreSQL: una notificación Redis/NOTIFY perdida no pierde el resultado. Polling/SSE consulta secuencias guardadas.

Cada observador tiene cursor propio; no marcar un evento entregado globalmente al verlo desde otro dispositivo. Client deduplica por ID/seq y consume toasts sin repetir efectos. Reconnect no reenvía mensaje/confirmación. Revalidar sesión/acceso durante un stream, cerrar al expirar token/autorización y reanudar tras refresh válido.

Persistir deltas de texto agrupados bajo presupuesto, no una fila por token; finalizar mensaje y evento con revisión. Si cursor fue eliminado por retención, recuperar snapshot vigente o informar expiración. Un chunk recibido antes del commit no acredita resultado durable.

Cache invalidation usa sólo efectos comprobados y targets/query keys registrados por el dominio; no aceptar query keys/URLs arbitrarias del modelo. UI conserva preview/borrador/foco ante error, feedback sileo ES/EN y contenido durante revalidación, conforme a Client/AGENTS al implementar.

## Adjuntos, memoria y limpieza

Storage privado por chat; upload intent antes de PUT y cleanup durable independiente. Preservar key/generation hasta comprobar un PUT tardío y su eliminación. Copiar a key independiente para factura y aplicar recovery de uploads existente; no borrar su archivo por expirar el chat.

Scheduler caduca por último mensaje del dueño, incluso sin visitas. GET comprueba expires_at y deniega contenido vencido; no realiza DELETE solicitado por una marca del navegador. Usuario autorizado puede recibir410 expired_chat; recursos ajenos conservan404. Este código nuevo amplía41, sin cambiar rutas legacy.

localStorage es opcional para metadatos de comprobación del usuario/dispositivo. Invalidar al cambiar cuenta/logout/revisión o vencer fecha conocida; nunca persistir ahí claves, mensajes, permisos, grants o decisiones de borrado. Cache no omite validación de backend.

Purga revoca/eleva epoch, cierra propuestas/trabajo pendiente, separa receipts y borra contenido/adjuntos/transcripciones. Preferencias permanecen aceptadas, con origen nullable. Copias del proveedor, si existen, requieren contrato de limpieza de sesiones creadas exclusivamente por Nodia; no prometer borrado remoto que el adaptador no demuestre. Precisar limpieza física/backups y no restaurar contenido expirado como visible.

## Observabilidad y políticas de operación

Registrar IDs/correlación, código de capacidad, fase, fence, duración realmente medida, número de intentos y códigos seguros. No prompts/PDFs/cookies/códigos/secretos o errores SDK crudos. Métricas útiles: edad de cola, jobs activos/unknown, conciliaciones, conflictos/dedup, limpieza pendiente y latencia observada. Desconocido = null/unknown, cero real se conserva.

[AI-04/50](50-nodia-ai-ai04-runtime-policy.md) concreta admisión, pasos, resultados, tamaños/modalidades, deadlines, leases, heartbeat, drain y concurrencia mediante [configuración versionada](nodia-ai-v1-runtime-policy.json)/schema cerrado. Un run lógico, una delegación Web→Agentic y presupuesto compartido entre procesos/etapas; wire/ERD tipados se materializan juntos AI-09/12, sin modificar Selection congelada. Son límites propios, no cuotas comerciales. Configuración inválida/incompleta bloquea publicación; no adoptar OCR por semejanza. Ocho gates productivos incluyen el guard de login, perfiles/unknown y presupuestos durables; validación offline no acredita esos mecanismos.

Conservación mínima posterior confirmada en50: borrar audit/receipts resueltos/attempts terminales con chat, sin archivo adicional. Sólo tareas mínimas no resueltas hasta conciliar/limpiar; luego también se borran. Objetivo físico24h, backups máximo7 días y restore en cuarentena sin replay requieren pruebas reales. Eliminar contenido no libera perfil unknown ni borra datos de dominio/preferencias aceptadas. La separación de payload/receipt permite acabar trabajo, no mantener historial indefinido.

## Criterios para derivar el plan por etapas

| Dependencia | Cierre requerido |
|---|---|
| Viabilidad Web/Agentic | Chat/contexto/herramientas/modalidades/isolación por modo; no basta OCR/login |
| Persistencia42 | Migraciones y constraints en PostgreSQL desechable; permisos/retención con races |
| Núcleo durable | Admisión/dedup, jobs/fences, outbox, recuperación/cancelación sin replay |
| Herramientas40/41 | Schemas/proyecciones/autoridad y estrategia de efecto verificadas por familia |
| NI-13 y transversalidad | Core conserva invariantes; Finanzas/Reservas comparten alcance actor/destinatario |
| Informes | Fuentes/granos/relaciones/unidades y sumas exactas con procedencia |
| Multimodal/memoria | Ownership/cleanup/interpretación revisable y aceptación explícita |
| UI y operación | Página/drawer/preview, ES/EN/móvil, navegación fuera de chat/reinicio y aceptación real |

Todos los módulos siguen en v1, excepto bulk/import ya aplazados. Un primer flujo completo permite validar el núcleo; no reduce el catálogo final. Las etapas deben declarar dependencias, casos de prueba y capacidades que se publican sólo al cerrar sus garantías.

## Continuidad

Modelo y relaciones revisados estáticamente en [evidencia](../evidence/nodia-ai-erd-execution-validation.json). Las pruebas del plan deberán ejecutar los escenarios de transacción, fencing, incertidumbre externa, revocación y purga; este diseño no los declara implementados.

- [x] Definir componentes, trabajo PostgreSQL, canales, transacciones, recuperación, observación y retención.
- [x] Diferenciar witness transaccional, recovery nativo e incertidumbre externa.
- [x] Segunda revisión44 y plan45 con38 tareas: gasto personal como primer flujo completo propuesto, fichas de productos y carga selectiva de contexto.
- [x] Spikes independientes Web47/Agentic49 y política/configuración AI-04/50; sin publicación productiva.
- [ ] Probar contratos por dominio y ejecutar los ocho gates operativos de50.
- [ ] Implementar y ejecutar garantías en app/BD aislada; aprobar documentación explícitamente.

La arquitectura es propuesta versionada. No se modifica runtime, introduce dependencia, arranca worker, conecta BD o ejecuta inferencia por este diseño.

## Entrega incremental AI-18

[AI-18/64](64-nodia-ai-ai18-human-confirmation.md) implementa desafío/confirmación por revisión/hash exactos, admisión atómica y recuperación sin duplicados. Metadatos humanos y edición de cinco campos escalares; registro productivo de ejecutores vacío hasta AI-19..20. No publica MCP prepare ni escribe en dominios.

## Entrega incremental AI-19

[65](65-nodia-ai-ai19-financial-effect.md) concreta transactional_witness para un único movimiento financiero confirmado. Reutiliza el caso de uso nativo y el manager existente; efecto/recibo/outbox/estado se comprometen juntos. `FinancialMovementReceipt` cerrado conserva sólo versión/recurso/ID/destinatario; columnas existentes guardan binding/identidad/tiempos. Migración1792600000000 congela el primer binding y el resultado completado sin nuevas tablas/columnas. La ejecución permanece interna, registro productivo vacío y sin publicación MCP hasta AI-20.


[AI-20/66](66-nodia-ai-ai20-execution-recovery.md) conecta el worker al efecto local de un movimiento confirmado: claim/fence, recuperación por witness SQL y cancelación/resume humanos. Reutiliza job/attempt/grant y un marcador acotado de la última reanudación; sin tablas/columnas ni migraciones. No extiende la prueba transaccional a efectos externos ni publica la preparación MCP. Versiones e identidad originales se conservan; cambios materiales requieren nueva propuesta/botón.

## Entrega incremental AI-23 — ejecución secuencial

[69](69-nodia-ai-ai23-dependent-workflows.md) reutiliza propuestas/pasos, ejecuciones/pasos, grants, jobs y attempts para uno a ocho comandos ordenados. Cada entrega del worker reclama un paso; el commit intermedio deja su recibo inmutable, desbloquea el siguiente y vuelve a poner su job en cola con la posición siguiente. La conversación sigue ocupada hasta que el conjunto termine, falle o se cancele. No hay un scheduler DAG ni transacción abierta durante toda la secuencia.

La preparación conjunta reclama borradores de la misma conversación/actor y sustituye las propuestas individuales que representaban esas intenciones. El catálogo del coordinador no reemplaza los contratos nativos por familia. Se rechazan referencias cruzadas, propias, futuras o no registradas antes de persistir el conjunto. El primer enlace implementado es `provider.create.id → contact.create.provider_id`; los otros puertos pueden combinarse como operaciones independientes sin implicar que todos sus campos sean enlazables.

El first-bind usa únicamente el recibo comprometido de un antecedente y la salida tipada registrada. Persiste `nodia_ai_execution_steps.bound_command` con las tres claves `command_template/scope/preconditions` y su hash en una transacción corta previa. Una segunda transacción reautoriza, comprueba locks/lease/fence/precondiciones y compromete escritor nativo, recibo, paso, intento y transición de cola juntos. El payload/hash enlazados no se refrescan al reanudar; un cambio del proveedor creado antes del binding rechaza el contacto pendiente.

La migración `1792700000000` añade ese JSONB nullable y `nodia_ai_proposals.prior_execution_id` nullable, sin tablas nuevas. La ejecución ya tenía una columna de linaje y ahora conserva el origen de su propuesta de continuación. Triggers protegen payload/hash y linaje mientras exista la fuente; retirar el paso fuente por caducidad limpia el payload ejecutable. El rollback se niega a borrar columnas con payloads o continuaciones vivos.

Un fallo detiene todo el sufijo y conserva los commits previos. Recuperación primero concilia incertidumbre; un rollback probado puede permitir resume explícito con la identidad nativa original. Corregir materialmente el sufijo crea otra propuesta/hash y exige otro botón, enlazada a la ejecución previa; la operación anterior no conserva un camino paralelo para ejecutar lo sustituido. Cancelar impide nuevos efectos y conserva el prefijo, incluso cuando las precondiciones impiden reanudar. No existe compensación automática.

La [evidencia SQL/HTTP/procesos](../evidence/nodia-ai-ai23-postgresql.json) verifica47 casos de AI-23, incluyendo SIGKILL después del primer commit o del first-bind, respuesta de COMMIT perdida, carrera de confirmación individual/conjunta, corrección y purga. [229 regresiones](../evidence/nodia-ai-ai23-regressions.json) conservan contratos previos. Son pruebas sobre PostgreSQL desechable y staging compilado; no invocan Gemini ni publican preparadores de escritura. La activación de la VM configurada, suites finales y QA se consolidan por separado en69.

## Integración incremental AI-24: configuración de Reservas

[70](70-nodia-ai-ai24-rental-configuration.md) registra seis puertos y el recibo `RentalEffectReceipt`. Preparación y verificación congelan los campos materiales de casa, asociaciones, usuario seleccionado y política/reglas pertinentes; no basta comparar `updated_at`. El lock de la propiedad se retiene hasta el efecto nativo. La autoridad vuelve a comprobar sesión, módulos NodiaAI/Reservas y capacidad propietario/super_admin, sin suplantar al dueño ni trasladar propiedad implícitamente.

El escritor recibe `ActorReference.transaction` y reutiliza el manager del ejecutor: efecto, journal idempotente, auditoría nativa, recibo NodiaAI y outbox se comprometen juntos. El branch heredado no hace COMMIT/ROLLBACK/release; conserva un plazo nativo de10s, techo SQL limitado por tiempo restante y mapeo de errores. Restaura el wrapper previo del runner incluso al anidarse o fallar. El ejecutor exterior mantiene sus propios fences/plazos y decide commit, rollback o conciliación. No se abre una transacción anidada ni se reintenta un efecto incierto.

Archivar cambia visibilidad/operabilidad conforme a28, conservando acuerdos, ocupación, caja y snapshots históricos. Reemplazar reglas pertenece a una sola operación de política y comparte su rollback; no se convierte en un lote de comandos. Las secuencias conocidas de AI-23 pueden incluir estos puertos, pero no se añaden bindings futuros casa→política/colaborador sin implementación expresa. Sin tablas, columnas ni migraciones nuevas; publicación MCP y aceptación con Gemini siguen gates separados.

## Integración incremental AI-25: ciclo comercial de Reservas

[71](71-nodia-ai-ai25-rental-reservation-lifecycle.md) incorpora seis puertos internos de reserva con el mismo manager de preparación/ejecución. La propiedad se bloquea antes de leer la reserva, pagos, acuerdo y vecinos materiales, coordinándose con todos los escritores nativos. Cada paso reautoriza al actor real y contrasta las precondiciones congeladas antes de ejecutar el caso de uso; sus repositorios, journal, auditoría y recibo pertenecen a la misma transacción exterior. No se conserva un EntityManager entre turnos ni se abre una transacción durante la inferencia.

El reloj nativo es una dependencia compartida, no una fecha propuesta por el modelo para iniciar o completar. Los instantes de observación volátiles no se confunden con precondiciones materiales. La cancelación usa el cálculo nativo autorizado y congela su intención y resultado esperado; pagos o acuerdos distintos requieren revisión nueva y no se compensan modificando silenciosamente el comando confirmado.

La disponibilidad existente no toma un hold. Un cambio entre lectura y confirmación se resuelve bajo los locks nativos y puede rechazar la operación. Iniciar exige la preparación real vigente y completar conserva la ocupación histórica. Cancelar no ejecuta un refund externo ni una fila de pago. Los workflows de AI-23 pueden combinar intenciones conocidas; esta entrega no registra bindings futuros reserva→pago ni presupone atomicidad de todos los pasos. Sin cambios de esquema; MCP/Gemini y las operaciones monetarias AI-26 conservan sus gates.

## Continuidad AI-33 — memoria y frontera de envío

[Entrega79](79-nodia-ai-ai33-accepted-preferences.md) y [ADR-058](../architecture/decisions/ADR-058-nodia-ai-accepted-preferences.md): un módulo interno de lectura/operaciones sin import de contexto/propuestas evita el ciclo de dependencias. HTTP humano compone ese puerto con propuestas; pipeline lo consume para leer recuerdos aceptados. Lectura por conjuntos y lock por dueño compartido con mutaciones; sin N+1 ni red dentro de SQL. ContextBuilder recibe datos separados y conserva sólo IDs/revisiones/hash en el manifiesto. Revalidación tras observación y, mediante un callback local confiable, dentro de armDispatch antes de consumir presupuesto/marcar dispatch_armed. Memoria cambiada produce fallo conocido preferences_changed; el worker conserva el mensaje ya admitido y libera el slot no enviado. No reenvía inferencias automáticamente, restaura preferencias borradas desde el historial ni concede autoridad mediante memoria.


## Implementación AI-34 — fase context y compactación

[Entrega80](80-nodia-ai-ai34-long-context-compaction.md) permite que context use un dispatch generativo para compactar, con selección vigente, sin herramientas/archivos y máximo uno por run dentro del presupuesto compartido. Una respuesta terminal inválida se cierra como fallo conocido mediante prueba nativa; incertidumbre continúa sin replay. inference vuelve a cargar snapshot y cola reciente, preferencias y referencias actuales. Cambios de permisos/fuentes se comprueban antes de armar y guardar; opt-in de delegación también se revalida bajo el lock final. El límite inicial nativo incluye catálogo, wrappers y definición de agente propio cuando se utiliza, medido por el mismo constructor del microservicio; no conoce tokens o contexto privado del SDK/proveedor. SQL/worker aislado y compactación/continuidad Web/Agentic con cuenta se verifican por capas; MCP real usa un callback sintético de lectura. No aceptación productiva ni efectos de negocio atribuidos a ese canario.
