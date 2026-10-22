# AI-14 — Registro de capacidades y ToolGateway

> Estado: implementación verificada localmente; no aprobación documental o publicación de familias por esta entrega.
> Fuentes: [plan45](45-nodia-ai-implementation-plan.md), [catálogo40](40-nodia-ai-tool-catalog-v1.md), [contratos41](41-nodia-ai-v1-contracts.md), [arquitectura43](43-nodia-ai-execution-architecture.md), [política50](50-nodia-ai-ai04-runtime-policy.md), [publicación52](52-nodia-ai-ai06-knowledge-publication-contract.md).

> Evolución AI-15: [entrega61](61-nodia-ai-ai15-product-reads.md) amplía los exports candidatos, verifica 64 herramientas / 128 KiB de catálogo y conserva el límite RPC de 64 KiB. Los límites 32/64 KiB y la composición vacía descritos abajo corresponden al cierre histórico de AI-14; la publicación vigente continúa vacía hasta aprobar sus bindings.

## Registro y composición

`NodiaAiToolRegistryModule` es el punto de composición. Importa exports tipados de las familias mediante `NODIA_AI_TOOL_FAMILIES`; cada familia declara sus módulos, recursos, herramientas y puertos de autoridad/ejecución. La composición real permanece vacía hasta verificar y publicar familias en AI-15 y etapas siguientes. No descubre controladores, tablas o clases desde nombres, no lee el inventario HTTP para ejecutar operaciones y no añade tablas, migraciones, microservicios o dependencias.

Un registro identifica capacidad, herramienta, revisión, clase, módulo/recurso/operación, efecto, acciones y rutas requeridas. Las referencias de schema contienen bytes JSON exactos, definición y SHA-256; el registro compila con Ajv sin coerción, defaults ni eliminación de campos. Rechaza duplicados, módulos/recursos incoherentes y schemas abiertos o con referencias externas no admitidas. Las proyecciones para MCP/HTTP incluyen sólo la definición y su cierre de referencias locales alcanzables, sin copiar todas las definiciones del proyecto. Metadatos y validadores se preparan al arrancar; no se recompilan por callback ni se cachea autoridad entre solicitudes.

El handler recibe entrada validada y contexto interno con manager transaccional, actor autorizado, rutas vigentes y señal de cancelación. `verifyAuthority` es obligatorio para la autoridad del recurso, incluso al recuperar un resultado previo. El código de dominio comparte su caso de uso con los consumidores HTTP; no se invocan controladores ni se crea otra implementación de sus reglas. Los handlers de esta etapa sólo pueden ejecutar lecturas locales dentro del checkpoint; preparación/escritura requiere sus etapas y confirmación humana.

## Publicación y conocimiento

El loader contrasta el manifiesto con los exports ejecutables en ambas direcciones: mismo ID, revisión, hashes de entrada/salida, clase y conjunto exacto de módulos. Una capacidad ejecutable sin publicación/binding, una capacidad documental sin puerto o un módulo reducido respecto de la publicación detienen el arranque. El compilador AI-06 mantiene las comprobaciones de aprobación, fuentes, revisiones y bindings. No genera aprobaciones ni publica borradores durante build.

La documentación explica funciones y el código registra puertos; ninguna de las dos fuentes concede permisos. El registro declarativo de publicación actúa como comprobante del contrato verificado, no como localizador de clases. Fichas y nuevas familias deben evolucionar juntas conforme al estándar de conocimiento. Los cambios de cada familia deberán actualizar sus schemas, fuentes/evidencia, exports tipados y bindings antes de cambiar el release.

El build copia la biblioteca canónica de contratos comunes a un asset propio de `src/dist/nodia-ai-tools/config/`, conforme al modo prepare/build. No se mantiene un JSON editable adicional ni se necesita la carpeta docs en ejecución desplegada.

## Descubrimiento y resolución

La app y Agentic reutilizan `DiscoverNodiaAiToolsUseCase`:

| Canal | Operación | Resultado |
|---|---|---|
| GET `/nodia-ai/capabilities` | Consulta/filtro por módulo y cursor | `CatalogSearchResult` paginado y autorizado |
| GET `/nodia-ai/capabilities/:name` | Detalle con `catalog_version` obligatorio | `CapabilityDescriptor` exacto |
| GET `/nodia-ai/capabilities/:name/schema` | Contratos con la misma versión | `CapabilitySchemas`, sin refs arbitrarias |
| MCP `nodia_capabilities_search` | Descubrimiento técnico | Sólo registros publicados y permitidos |
| MCP `nodia_capabilities_describe` | Detalle técnico | Misma proyección del caso de uso |
| MCP `nodia_entities_search` | Resolver un recurso registrado | Candidatos públicos; ninguna introspección ORM |

Se conservan además `nodia_knowledge_index/get`. Estas cinco herramientas de infraestructura pueden descubrir un catálogo vacío; no son cinco herramientas de negocio publicadas. No se añade una herramienta de SQL, HTTP arbitrario, confirmación o ejecución genérica. El acceso a schemas tiene su ruta HTTP prevista; no se inventa otro nombre MCP.

La ausencia de acceso a NodiaAI produce 403; una capacidad inexistente o no permitida se oculta con 404 en su detalle/schema. Las respuestas HTTP llevan `Cache-Control: no-store`. El descubrimiento obtiene una instantánea actual de autoridad y filtra múltiples requisitos con una sola carga de permisos, sin consultas por herramienta ni exposición de roles/acciones en los resultados.

Query/término admiten 256 caracteres Unicode y 1024 bytes UTF-8; keys y versión 128 caracteres, cursor 2048. Los resultados conservan límites/paginado de la política50. El cursor se vincula a actor, sesión, release, filtros y capacidades autorizadas; no se reutiliza entre contextos. IDs bigint permanecen strings. `scope` ayuda a expresar la consulta, pero la autoridad se deriva de la sesión y del puerto del recurso.

Cada recurso declara un resolver explícito cuya entrada/salida implementa `EntitySearchInput/EntityCandidates`. Un candidato exige identidad/tipo correctos, sin duplicados. Sólo una coincidencia con consulta completa y sin siguiente cursor es `unique`; varias coincidencias o una página incompleta son `ambiguous`. La llamada directa al resolver y `nodia_entities_search` comparten validación de recurso, versión, identificadores, cardinalidad y procedencia, también al recuperar un resultado guardado. No se escoge el primer resultado por conveniencia. Sin puerto verificado no se consulta ninguna tabla.

## Admisión y ejecución durable

La admisión congela `tool_catalog_version` y `tool_contracts` en `context_manifest`, junto con los nombres permitidos en `allowed_operations`. Incluye únicamente puertos de lectura que la autoridad actual y la publicación permiten, además de infraestructura. No se amplía un turno por nuevas asignaciones o publicaciones; los cambios se descubren en un turno posterior.

ToolGateway sirve el catálogo al adaptador y recibe sus callbacks. Comprueba modo Agentic, etapa, identidad/sesión, grant, lease/fence mediante checkpoints, catálogo/release, módulos actuales intersectados con los congelados y contrato exacto. Cada solicitud consume presupuesto durable antes de validación, rechazo o recuperación; los costes no se borran por rollback de una lectura. Los rechazos/replays nativos que no llegan al callback conservan el contador de progreso AI-11/12. Las lecturas técnicas no duplican ese consumo.

Entrada, autoridad de recurso y salida pública se validan antes de guardar el resultado en `nodia_ai_tool_calls`. Sólo se recupera la misma combinación run/call_id/nombre/contrato/argumentos, con autoridad actual, alcance compatible y salida válida; cambiarla produce conflicto. Revocar permisos no permite obtener datos almacenados anteriormente. La recuperación técnica también revisa fragmentos/texto contra el release compilado y las rutas actuales. No se repiten efectos para actualizar resultados.

Cada lectura usa el manager del checkpoint y plazo SQL local. Los schemas no sustituyen la verificación de permiso o pertenencia del recurso. Los puertos de preparación se describen como bloqueados y no se ejecutan hasta implementar propuestas/confirmación/garantías de efecto.

## Límites del transporte y evolución

El adaptador MCP vigente admite 32 descriptores y 64 KiB de catálogo por despacho, con límites propios de nombre/descripción. ToolGateway los comprueba antes de reservar/despachar, sin truncar, elegir las primeras herramientas o cambiar de proveedor. El registro de metadatos y su búsqueda no están limitados a 32 capacidades; es una restricción del transporte actual.

Con cinco herramientas de infraestructura, más de 27 lecturas de dominio simultáneas necesitarán una estrategia de selección/descubrimiento acotada y verificada antes de publicar todas las familias de AI-15. Aumentar el límite o introducir una herramienta genérica sin comprobar el protocolo no resuelve esa integración. Esta dependencia queda explícita para AI-15/36; no cambia la paridad funcional prevista para v1 ni impone un límite permanente a productos/chats.

Un trabajo anterior que carezca de contratos congelados no recibe capacidades nuevas por compatibilidad implícita. Antes de actualizar el runtime deberá drenarse o conciliarse el trabajo admitido bajo la versión anterior; el gateway rechaza contratos/releases incompatibles.

## Verificación

[Evidencia de entrega](../evidence/nodia-ai-ai14-validation.json) y [recorrido HTTP/PostgreSQL/worker](../evidence/nodia-ai-ai14-postgres-integration.json):

- Suite Server: **1342 pruebas / 147 archivos**; build de producción y assets compilados correctos. Oxlint sin errores, con tres advertencias preexistentes. El chequeo independiente de todos los archivos de test conserva 30 errores previos en otros fixtures; los archivos NodiaAI afectados no presentan errores de tipado.
- Integración Nest compilado con PostgreSQL desechable: **40 comprobaciones**, cuatro despachos del worker contra un adaptador sintético. Incluye permisos ordinarios/super_admin, contratos, revocación, replay, resolver directo/común y presupuesto SQL.
- Regresiones compiladas: contexto AI-12 **20**, delegación y presupuesto AI-12 **33**, catálogo/página AI-13 **21** comprobaciones correctas.
- Contratos e inventario: **125 schemas, 243 assertions, 286 hashes**; AST de **47 módulos / 37 controladores / 190 handlers / 309 rutas** y **13 de 28** rutas de coordinación implementadas. Tres ayudantes comunes implementados; ninguna herramienta de negocio publicada.
- Conocimiento: **44 fichas draft/unregistered**, cero documentos y fragmentos publicados. `knowledge:check`, build y `context:prepare` correctos; aprobación preservada. Nueva ficha de registro/gateway e índice del producto actualizados.

Las pruebas usan registros, aprobación/manifiestos, adaptador y datos sintéticos en PostgreSQL desechable; limpian contenedores y carpetas temporales. No habilitan productos de negocio reales, actualizan la BD de uso ni demuestran nuevas llamadas Gemini por esta entrega. No se despliega el release a la API configurada. AI-15 es el siguiente paso para las lecturas reales por familia y conserva el gate de selección del transporte indicado arriba.

[Ficha funcional](../nodia-ai/knowledge/nodia-ai/features/capability-registry-gateway.md) · [Producto](../nodia-ai/knowledge/nodia-ai/README.md).
