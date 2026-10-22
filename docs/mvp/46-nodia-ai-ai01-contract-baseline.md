# NodiaAI — AI-01: baseline y contratos de coordinación

> Estado: AI-01 implementado como artefactos de contrato y verificación offline; API/runtime sin implementar, aprobación documental pendiente
> Fecha: 2026-10-14
> Etapa: E0; [plan45](45-nodia-ai-implementation-plan.md)
> Fuentes: [inventario39](39-nodia-ai-current-capabilities-inventory.md), [catálogo40](40-nodia-ai-tool-catalog-v1.md), [contratos41](41-nodia-ai-v1-contracts.md), [ERD42](42-nodia-ai-erd.md), [revisión44](44-nodia-ai-data-model-review.md)

## Qué entrega AI-01

Se conserva y verifica el baseline de34 controllers registrados,177 handlers,296 rutas con aliases y175 archivos fuente. El catálogo sigue proponiendo156 nombres,141 de dominio; las siete escrituras bulk/import continúan excluidas. No se crean endpoints de NodiaAI ni se cambian permisos, sesiones, modelos o tablas por esta entrega.

La [biblioteca JSON Schema](nodia-ai-v1-common-contracts.schema.json) pasa de60 a **111 definiciones comunes**, con contratos de mensajes/estado, metadata/selección, previews editables, confirmación, cancelación/recuperación, eventos, conexiones y uploads. El [índice de26 rutas de coordinación](nodia-ai-v1-coordination-api.json) vincula entradas/salidas y distingue canal de app, humano, SSE y resolución de resultados por contrato registrado.

Los contratos son compilables y verificables mediante `npm run test:nodia-ai:contracts` desde nodia-server, sin ejecutar API, BD, storage o proveedores. Ajv/ajv-formats son dependencias de desarrollo explícitas con versiones ya instaladas, sin añadir dependencia operativa al chat. El script comprueba formas, fixtures negativas, referencias, hashes y rutas reales mediante AST TypeScript. No simula la autorización para afirmar que esté implementada.

## Entradas y salidas por familia

| Familia | Contratos definidos/extendidos | Responsabilidad restante |
|---|---|---|
| Conversación | ConversationSummary/Detail/Page, ConversationListQuery, ConversationUpdateRequest | Sesión, propietario, ámbito administrativo y cursor aplicado en AI-07/09/10 |
| Mensajes | MessageAccepted, MessagePage/ListQuery, PublicMessage visible/restricted, MessageCreateRequest | Admisión/dedup, fuente autorizada, orden y retención en AI-10/16 |
| Selección y turno | Selection, SelectionUpdateRequest, RunSummary | Resolver conexión/modelo reales, compatibilidad y congelación de turno en AI-02/03/12 |
| Preview y edición | ReviewValue/Array/Object, OrderedField, ProposalFieldEdit/UpdateRequest, PublicProposal/PublicStep | Mapeo de campos/valores y freeze/hash en AI-17; no comandos o paths arbitrarios |
| Consentimiento | ConfirmationChallengeRequest/Response, ConfirmationRequest, ExecutionAccepted | Challenge/nonce/dedup/transacción en AI-18; canal humano excluido de MCP |
| Cancelación y recuperación | ProposalCancelRequest, ExecutionCancelRequest, Run/ExecutionCancellationResult y ResumeExecutionRequest | Reconciliar efectos/COMMIT incierto y sesiones vigentes en AI-20 |
| Eventos | Ocho variantes de PublicEvent, EventPage/EventListQuery, Sequence/Cursor | Outbox, SSE, reautorización y reconstrucción en AI-11/16 |
| Conexiones | ChatConnectionPage/Summary, ChatModeSummary, ModelOption | Proyección apta para conversar, sin reutilizar JSON administrativo/secretos; AI-07/12/28 |
| Adjuntos y memoria | AttachmentUploadMetadata/Result, AttachmentMetadata, PreferencePageQuery | Multipart binario, admisión antes del parseo, ownership y transcripción en AI-04/32; consentimiento AI-33 |
| Errores y esquemas | ApiErrorResponse, CapabilitySchemas | Códigos seguros, contratos por dominio y gates de publicación en AI-14/15 |

111 definiciones no equivalen a111 endpoints ni a las141 herramientas listas para inferencia. Las definiciones por dominio siguen requiriendo derivación/validación y proyecciones strict por familia. El índice declara explícitamente resolución registrada en el resultado de tool call; no introduce un cuerpo result genérico para eludir su schema.

## Reglas concretadas

### Metadata, identidad y selección

Las revisiones públicas de coordinación son enteros positivos hasta el límite integer PostgreSQL. Se corrige MessageCreateRequest: antes aceptaba revisión0 y ahora exige1..2147483647, conforme al modelo42. IDs nativos bigint permanecen strings; su rango aritmético se comprueba en Server, además de forma. Secuencias de eventos/mensajes viajan como cadenas positivas y el cursor es opaco. Las queries describen valores ya normalizados: el límite HTTP valida booleanos/enteros canónicos y no transforma texto inválido en false/0.

PATCH de metadata requiere revisión y al menos título/fijado/archivo. No cambia dueño, selección ni campos internos. title:null devuelve estado sin título asignado; no genera otro título automáticamente. Cambiar selección usa su endpoint específico y la puerta de actividad definida en43. Modelo ausente o formado sólo por espacios se rechaza; ninguna selección inventa modelo/mode fallback.

Listar conversaciones usa view own/all explícito; all y filtro de otro dueño necesitan autoridad administrativa en Server. read_only es una proyección de la política efectiva, no permiso enviado por el cliente. Roles/asignaciones/recursos se comprobarán en las tareas correspondientes; estos contratos no amplían facultades por sí solos.

### Previews de colecciones y cambios tipados

ChangedField conserva flags before_present/after_present, false/0/null y origen. Ahora también admite proyecciones estructuradas con arrays/objetos etiquetados. Ejemplo sintético de teléfonos:

```json
{"kind":"array","items":[{"kind":"object","fields":[{"field_key":"number","value":"+56900000000"}]}]}
```

PATCH de propuesta recibe expected_proposal_revision, expected_hash y edits con step_id/field_key/value. Server resuelve field_key exclusivamente desde el descriptor de la operación, comprueba tipo y pertenencia y emite revisión/hash nuevos. No acepta command, SQL, JSON pointer, scope/actor administrados ni replacements de pasos completos como payload editable. Entradas de objeto con field_key duplicado o dos ediciones del mismo campo/paso son conflicto semántico, incluso si sus valores difieren; verificarlo en AI-17. Las colecciones muestran reemplazo/append/eliminación real según el contrato de dominio, no una frase resumida del modelo.

El schema rechaza dependencias exactamente duplicadas. Referencias futuras, pertenencia a revisión y coherencia con bindings requieren validación semántica en Server. Los formatos estructurados aquí son valores revisables, no una DSL de ejecución ni acceso a propiedades arbitrarias del recurso.

### Canal humano y operaciones

El desafío sólo se entrega por ruta autenticada de la UI; no va en PublicProposal, eventos, tool results ni historial. Confirmación contiene request ID/revisión/hash/token; permisos y transacción se implementan en AI-18. El contrato común no certifica un clic físico ni habilita al agente a obtener cookies/endpoint del canal humano.

Se completa POST /operations/:id/cancel, necesario para distinguir cancelación del turno de cancelación de un conjunto confirmado. Requiere revisión esperada y request ID. Aceptar cancelación bloquea futuros pasos bajo autoridad actual; no anuncia rollback ni borra efectos. already_terminal informa resultado existente. Resume/confirm retornan identidad/estado de la ejecución;202 significa admisión y jamás éxito de negocio.

### Eventos y relectura de resultados

PublicEvent tiene un discriminador cerrado: run_accepted, assistant_delta, message_sealed, run_changed, tool_completed, proposal_ready, execution_changed o step_changed. Lleva identidad/seq/cursor/fecha y payload específico; no admite objetos de resultado libres, approval token o error SDK crudo. Cada variante define run_id o execution_id según su procedencia.

GET /runs/:id/events soportará página JSON o SSE según negociación de transporte. SSE data serializa PublicEvent e id utiliza cursor; reconnect reanuda observación y nunca vuelve a admitir la petición. Un cursor de una vista/ámbito distinto se rechaza. reset_required obliga a reconstruir estado/mensajes y retomar desde un cursor autorizado; no implica nueva inferencia.

El resultado canónico de tool call se recuperará con GET /tool-calls/:id/result y el schema del tool_name/contract_hash registrado. No se responde como JSON libre mientras el contrato no exista. Resultados grandes permanecen en su fila, no se copian a cada evento. PublicMessage restricted conserva sólo metadata mínima sin parts/autoría/texto; comprobar toda la salida y la aplicación de ámbitos a texto libre en AI-10/16.

### Configuración frente a evidencia operativa

ChatModeSummary separa configuration, authentication, inference y tools, con observed_at nullable y causas seguras. Modelos son IDs/etiquetas descubiertos/configurados, sin enum comercial. No se deduce soporte por nombre ni se fabrica timestamp o disponibilidad al encontrar credenciales. La proyección excluye fields, claves, cookies, perfil/paths y sesiones Nodia. AI-02/03 determinan qué evidencia permite afirmar verified en cada modo; AI-04 define vigencia/presupuestos.

### Caducidad y errores

ApiErrorResponse contiene error tipado con códigos/mensajes seguros, field_errors, correlation_id y acción de recuperación; no stack/SQL/error remoto crudo. Las rutas de dominio existentes conservan sus respuestas; la adaptación a esta forma pertenece a la futura API NodiaAI.

expired_chat410 corresponde a chat propio conocido por Server y lógicamente vencido. Tras purga física, si ya no existe metadata autorizable,404; no crear tombstones de todos los chats ni aceptar una prueba de propiedad desde localStorage para garantizar410 indefinido. Releer un execution receipt autorizado conserva su identidad sin resucitar mensajes/archivos.90 días siguen desde el último mensaje nuevo del dueño, no desde confirmación/evento/consulta.

### Publicación de schemas y límites

CapabilitySchemas transporta documentos JSON Schema2020-12 resueltos del registro. Sus dos campos de schema se validan contra la meta-schema oficial, no como payload de comandos. Además de validez sintáctica, AI-14 exige clausura de inputs/proyecciones, refs locales/controladas, sin datos privados y contrato exacto; la meta-schema sola admite extensiones y no prueba esas garantías. No publicar un DTO reference o schema vacío como capacidad disponible.

Límites de bytes/partes/profundidad/tamaño de colecciones/deadline se concretan en AI-04 y se aplican antes del trabajo costoso. PageLimit define una representación integer, no autoriza consultar millones de filas. Defaults de lista/orden/cursor requieren política validada al implementar; aquí no se inventan cuotas o capacidades de proveedor.

## Pendientes NI-01..13 y siguiente paso

AI-01 deja trazabilidad y formas de coordinación listas; no cierra por sí solo NI-01..13 completos. Su correspondencia exacta con AI-02..38 permanece en la matriz de45. Los puntos que bloquean publicación siguen siendo: esquemas/reglas por dominio, autoridad, idempotencia/transacción, frontend, conservación/limpieza, límites y modo/protocolo verificable.

Para AI-02 y AI-03, los probes deben consumir estos contratos y fixtures sintéticas en harness aislado. Herramientas fixture tienen schemas concretos y no se registran como capacidades productivas. Probar multiturmo, ida/vuelta de herramienta, errores, pérdida de respuesta, configuración exacta y separación de confirmación. Agentic necesita demostrar aislamiento respecto de DB/secretos/cookies de Nodia y del canal humano, además de callback MCP válido. No entregar el entorno privilegiado del worker al agente ni asumir seguridad por el protocolo.

- [x] Reconciliar hashes, AST, aliases y baseline del catálogo.
- [x] Completar coordinación, errores, selección, eventos, edición y multipart metadata sin payloads arbitrarios.
- [x] Añadir índice de rutas y pruebas reproducibles de formas/refs, fixtures y fuentes.
- [x] Fichas del propio producto NodiaAI con estado parcial/unregistered y enlaces; las fichas de los cuatro productos actuales siguen en AI-05.
- [x] AI-02: [spike Web47](47-nodia-ai-ai02-gemini-web-viability.md) verificado con cuenta y fixtures, sin publicar herramientas ni certificar runtime.
- [ ] AI-03: viabilidad real independiente de Gemini Agentic.
- [ ] AI-04 y etapas posteriores: políticas y garantías implementadas.
- [ ] Aprobación documental explícita, separada del cierre técnico de AI-01.

Verificación en [evidencia de contratos](../evidence/nodia-ai-v1-catalog-contracts-validation.json), mediante [script reproducible](../evidence/scripts/validate-nodia-ai-catalog-contracts.cjs). La [ficha de coordinación](../nodia-ai/knowledge/nodia-ai/features/conversation-coordination.md) resume lo que NodiaAI debe entender de estos contratos, sin declarar chat disponible.
