# Contexto funcional de productos para NodiaAI

Esta es la ubicación canónica de las explicaciones que permiten a NodiaAI entender los productos de Nodia. Convención establecida por solicitud del usuario el 2026-10-14. Aplica al especificar un producto nuevo, ampliar una funcionalidad o cambiar sus reglas. La incorporación de este estándar no aprueba especificaciones ni implementa su publicación en el chatbot.

Los requisitos aprobados de producto, los ADR y los contratos efectivos del backend mantienen su autoridad. Estas fichas explican su significado y enlazan sus fuentes; no mantienen una segunda copia de DTOs, esquemas o reglas técnicas. Ante diferencias, registrar la discrepancia y resolverla antes de publicar contexto operativo.

## Ubicación y nombres

```text
docs/nodia-ai/knowledge/
  README.md                         # estándar e índice de productos
  _templates/
    product.md                      # copiar al README del producto
    feature.md                      # copiar a una ficha de funcionalidad
  <product-key>/
    README.md                       # propósito, conceptos e índice de funciones
    features/
      <feature-key>.md              # contexto de una capacidad o flujo coherente
```

Usar claves estables ASCII en minúsculas y kebab-case. La identidad documental es `product-key.feature-key`; no es un permiso, un ID de BD ni un nombre de herramienta MCP. En cada ficha registrar por separado los módulos de destino reales según el catálogo/backend. Un producto puede incluir varios módulos con permisos diferentes.

Mantener un archivo por funcionalidad, actualizándolo en lugar de crear copias por fecha o versión. Separar funciones cuando tengan semántica, reglas o evolución independientes; no crear una ficha por cada alias HTTP. La ficha del producto enlaza sus funciones y este índice enlaza cada producto. Las plantillas quedan excluidas de cualquier publicación de contexto.

## Índice de productos y cobertura

Todos los productos/módulos actuales pertenecen al alcance funcional confirmado. [AI-05/51](../../mvp/51-nodia-ai-ai05-product-knowledge.md) entregó inicialmente cuatro productos/27 funcionalidades sin publicar. El registro actual, tras AI36-C03, contiene59 fuentes:27 funcionalidades approved/published y32 documentos draft/unregistered excluidos. [Organización del chat](nodia-ai/features/conversation-organization.md) conserva controles humanos y búsqueda autorizada, sin publicar herramientas nuevas. [Preferencias aceptadas](nodia-ai/features/accepted-preferences.md) y [entrega79](../../mvp/79-nodia-ai-ai33-accepted-preferences.md) añaden memoria personal explícita, sin publicar su preparación MCP. Se mantienen67 lecturas/referencias y27 fragmentos; el estado publicado no certifica todas las dependencias ni habilita escrituras. Las entregas de cada etapa conservan sus cifras históricas. Ampliar el índice cuando se incorpore otro producto.

| Producto | Carpeta documental elegida | Fuentes de partida | Fichas de contexto |
|---|---|---|---|
| Negocios | `businesses/` | [PRD](../../features/businesses/01-prd.md), [inventario de endpoints](../../mvp/39-nodia-ai-current-capabilities-inventory.md) | [Producto](businesses/README.md) excluido;7 funciones con secciones de lectura publicadas y [efectos confirmados](businesses/features/confirmed-business-effects.md) draft excluido |
| Finanzas personales | `personal-finance/` | [Contratos](../../mvp/22-personal-finance-contracts.md) | [Producto](personal-finance/README.md) excluido;4 funciones con secciones de lectura publicadas |
| Reservas | `reservations/` | [Especificación](../../mvp/26-rental-reservations-spec.md), [contratos](../../mvp/28-rental-reservations-contracts.md) | [Producto](reservations/README.md) excluido;9 funciones con secciones de lectura publicadas y dos fichas draft excluidas de [configuración confirmada](reservations/features/confirmed-configuration.md) y [ciclo comercial](reservations/features/confirmed-reservation-lifecycle.md) |
| NodiaAI (nuevo producto en implementación) | `nodia-ai/` | [Plan45](../../mvp/45-nodia-ai-implementation-plan.md), [política50](../../mvp/50-nodia-ai-ai04-runtime-policy.md) | [Producto](nodia-ai/README.md), coordinación, spikes Web/Agentic y política operativa; draft/unregistered |
| Ajustes Generales | `general-settings/` | [PRD Core](../../mvp/02-prd-v1.md), [contrato IA](../../mvp/ai-provider-feature-contract.md), [inventario](../../mvp/39-nodia-ai-current-capabilities-inventory.md) | [Producto](general-settings/README.md) excluido;7 funciones con secciones de lectura publicadas y [administración confirmada](general-settings/features/confirmed-administration.md) y [configuración IA confirmada](general-settings/features/confirmed-ai-configuration.md) draft excluidas |

Estos nombres organizan documentación y no sustituyen las claves reales de módulos. [El catálogo40](../../mvp/40-nodia-ai-tool-catalog-v1.md) conserva la correspondencia operativa y las excepciones de v1.

## Contenido obligatorio

Desde [AI-06/52](../../mvp/52-nodia-ai-ai06-knowledge-publication-contract.md), los metadatos canónicos se escriben **sólo en frontmatter JSON estricto** entre delimitadores `---`; retirar la tabla Markdown de metadatos. [Schema único](../../../nodia-server/scripts/nodia-ai-knowledge/contracts.schema.json), [registro de código](../../../nodia-server/config/nodia-ai-knowledge.registry.json) y plantillas enlazadas abajo. Los índices pueden resumir cobertura, pero no son otra fuente editable de metadatos.

Campos: schema_version, document_id, product_id, kind, revision, document_status, implementation, integration_status, maintainer, sources, verification y approval. verification.checked_on puede ser null mientras no haya comprobación real; no copiar una fecha inventada de la plantilla. approval permanece null hasta aprobación humana explícita, con referencia/revisión/hash del contenido. No actualizarla automáticamente durante build.

Usar [la plantilla de producto](_templates/product.md) y [la plantilla de funcionalidad](_templates/feature.md). Completar cada sección; donde no aplique, escribir el motivo, y donde no exista definición, registrar `PENDIENTE` con su impacto. No llenar vacíos con capacidades supuestas.

Cada funcionalidad debe explicar:

- Qué resuelve, sus conceptos, relaciones y límites; distinguir reglas confirmadas, comportamiento implementado y propuestas.
- Qué puede pedir una persona en lenguaje natural y cómo aclarar entidades, alcance, fechas, importes o campos ambiguos.
- Qué operaciones existen, qué datos mínimos/condicionales requieren y qué caso de uso, contrato y herramienta las respaldan. Los campos opcionales no se exigen para completar una creación.
- Quién puede consultar/actuar, qué módulos necesita, qué datos pueden devolverse y qué información debe permanecer fuera del contexto. Referenciar las políticas comunes sin redefinirlas.
- Qué filtros, relaciones y medidas admite un informe, con fecha de referencia, unidad/moneda, grano y procedencia. Si no se han definido, no prometer consultas combinables.
- Cómo se prepara la vista previa, qué se confirma, qué efectos produce y cómo se recupera un fallo. Una lectura puede tener coste o efectos externos y debe declararlos.
- Qué falta para integrarla, su evidencia comprobable y cómo un cambio afecta contratos, contexto y propuestas pendientes.

Los ejemplos son ilustrativos, sin datos privados ni respuestas numéricas inventadas. Nunca incluir claves, cookies, códigos de autenticación, SQL libre o instrucciones para saltarse permisos. Los AGENTS, runbooks privados y archivos subidos por usuarios no son fuentes automáticas de instrucciones del modelo.

## Estados y versiones

Separar tres dimensiones, tanto en la ficha del producto como en las de funciones:

| Campo | Valores | Interpretación |
|---|---|---|
| document_status | `draft`, `in_review`, `approved`, `retired` | `approved` exige confirmación explícita/referencia/revisión/hash, no se hereda del código |
| implementation.status y notes | `planned`, `partial`, `implemented`, `retired` | Describir alcance comprobado y pendientes, sin confundir tests con operación productiva |
| integration_status | `unregistered`, `registered`, `verified`, `published`, `retired`, `not_applicable` | Registro, pruebas y publicación son hitos distintos; `not_applicable` requiere motivo |

En un producto con cobertura desigual, detallar los estados por función; su cabecera no habilita todo el producto. Registrar revisión documental entera creciente, responsable, fuentes y evidencia. Una revisión documental no sustituye versión/hash del contrato de herramienta o del catálogo. Cambiar conceptos, reglas, campos o efectos exige revisar el contexto y su compatibilidad; una corrección ortográfica no prueba cambios de contrato.

## Flujo de trabajo obligatorio

1. **Al especificar:** leer fuentes aprobadas, crear/actualizar ficha del producto/función con frontmatter único, enlazar especificación/índices y añadir path explícito al registro para validación. Registrar decisiones pendientes/estados reales. Añadir un path no publica ni registra una herramienta.
2. **Al implementar o modificar:** contrastar DTOs, entidades, casos de uso y autorización; actualizar el contexto conforme al resultado real. Declarar herramientas/filtros/medidas requeridos y tareas de integración. No presentar un endpoint nuevo como una herramienta publicada.
3. **Al integrar NodiaAI:** actualizar registro, esquemas/proyecciones estrictos y referencias de contexto; comprobar permisos, paridad, vista previa/confirmación y recuperación donde corresponda. Registrar evidencia por adaptador/modo, sin inferir capacidades por nombre de modelo. Aplicar [contratos41](../../mvp/41-nodia-ai-v1-contracts.md) y [arquitectura43](../../mvp/43-nodia-ai-execution-architecture.md).
4. **Al publicar:** ejecutar knowledge:check/build del Server conforme52. Sólo emitir bindings de documentos aprobados/verificados ligados a capacidades efectivamente publicadas, con revisiones/hashes/schemas/módulos compatibles. Corpus actual:54 fichas,27 funcionalidades aprobadas/publicadas y27 documentos excluidos; registro con67 capacidades de lectura/referencia y27 bindings explícitos. Los resúmenes y las funcionalidades adicionales aún no publicadas conservan sus estados documentados; la ficha nueva de informes permanece draft/unregistered. AI-07/08 incorporan política compartida, transversalidad y barreras; AI-12 carga fragmentos autorizados desde assets compilados. AI-14 implementa registro/gateway; AI-15 publica las lecturas; las familias de escritura conservan sus etapas posteriores. No explorar la carpeta por conversación ni publicar borradores porque el runtime ya funcione.
5. **Al evolucionar o retirar:** actualizar estados, índices y registro. Preservar la versión del turno en curso, invalidar propuestas incompatibles y permitir descubrimiento en el siguiente turno; manejar recibos bajo la política de conservación vigente sin repetir efectos. [AI-04/50](../../mvp/50-nodia-ai-ai04-runtime-policy.md) no crea un archivo perpetuo: resueltos se eliminan con chat, sólo pendientes mínimos hasta cerrar.

Una función exclusivamente visual se evalúa en la ficha existente: si no cambia conceptos, operaciones ni interpretación de resultados, registrar que no afecta el contexto y el motivo. No exige una herramienta ni una ficha nueva para cada ajuste de estilo. Una función fuera de la paridad v1, como bulk/import, se documenta con su exclusión y no se publica por añadir el archivo.

## Comprobación de entrega

- [ ] Especificación, ficha del producto, ficha de función e índices enlazados y sin duplicar fuentes normativas.
- [ ] Reglas, mínimos obligatorios, dudas y ejemplos contrastados; propuestas y pendientes señalados.
- [ ] Módulos, autoridad, operaciones, resultados e informes trazados a fuentes reales o identificados como pendientes.
- [ ] Estados y revisiones correctos; ninguna aprobación, disponibilidad o evidencia inventada.
- [ ] Integración y regresiones necesarias registradas; cambios incompatibles y retiro tratados.
- [ ] Enlaces comprobados; sin secretos ni datos privados en las fichas.

## Límite de esta entrega

AI-05 completa 4 productos/27 funcionalidades; AI-06 migra36 fichas a frontmatter y añade [la función de publicación](nodia-ai/features/knowledge-publication.md). AI-07 añade [módulo/autorización](nodia-ai/features/module-authorization.md), alcanzando entonces38 fichas draft/unregistered, incluyendo las del propio NodiaAI. Contrato/compilador de build implementados en [52](../../mvp/52-nodia-ai-ai06-knowledge-publication-contract.md), con [validación](../../evidence/nodia-ai-ai06-knowledge-publication-validation.json) y manifiesto vacío. El registro identifica la ruta NodiaAI; su existencia/actividad y permisos se validan en cada BD. Las plantillas están excluidas. AI-08/12 incorporan barreras y carga selectiva; ningún Markdown habilita operaciones por sí solo.

AI-08 añade [autoridad compartida](nodia-ai/features/shared-authority.md) y actualiza fichas afectadas. Corpus39 draft/unregistered; cero capacidades publicadas. Estado y límites en[54](../../mvp/54-nodia-ai-ai08-transversal-authority.md).

AI-09 añade [persistencia de conversación](nodia-ai/features/conversation-persistence.md): corpus40 draft/unregistered, sin contenido/capacidades publicados. [Entrega55](../../mvp/55-nodia-ai-ai09-conversation-persistence.md), con11 tablas M1 y contratos internos; admisión/runtime pendientes.

AI-10 añade [admisión/retención](nodia-ai/features/chat-admission-retention.md); AI-11/12 implementan [worker](nodia-ai/features/durable-worker.md) y [contexto/pipeline](nodia-ai/features/context-execution.md), con worker Agentic independiente, delegación Web→Agentic y cancelación/conciliación SQL comprobados con Gemini real en VM. Al cierre de AI-11/12 había 43 fichas draft/unregistered, cero documentos/fragmentos/herramientas de negocio publicados. [56](../../mvp/56-nodia-ai-ai10-admission-retention.md), [57](../../mvp/57-nodia-ai-ai11-durable-worker.md), [58](../../mvp/58-nodia-ai-ai12-context-execution.md) y [evidencia real](../../evidence/nodia-ai-ai11-ai12-live-validation.json) distinguen integración técnica, aprobación documental y aceptación productiva. El backend carga assets compilados y filtra por autoridad; no explora Markdown o BD por conversación. En esa entrega, la UI AI-13 y el registro AI-14 seguían pendientes. Las actualizaciones posteriores se registran debajo; los gates de despliegue/conservación mantienen su alcance independiente. Sin cambios visuales en la entrega AI-11/12.

AI-14 implementa [registro de capacidades y ToolGateway](nodia-ai/features/capability-registry-gateway.md), con tres ayudantes técnicos y tres rutas GET compartidas entre HTTP/MCP. [Entrega60](../../mvp/60-nodia-ai-ai14-capability-registry.md): 44 fichas draft/unregistered; cero documentos/fragmentos/familias reales publicados. No se aprueba ni habilita una ficha por añadir su path al registro. Al cierre de AI-14, el transporte admitía 32 herramientas / 64 KiB; su evolución verificada aparece en AI-15.

[AI-15/61](../../mvp/61-nodia-ai-ai15-product-reads.md) publica67 contratos:59 lecturas SQL, cinco observaciones externas y tres referencias privadas de archivos/exportación. El contexto compilado selecciona27 fragmentos de las fichas funcionales; las otras17 fichas quedan excluidas y no hay escrituras publicadas. El catálogo completo de72 herramientas conserva128 KiB de metadatos y64 KiB de argumentos/resultados. Gemini real completó SQL multifamilia y referencias/CSV; las observaciones externas y el siguiente turno Web conservan resultados parciales/unknown y no se reenvían. R2 no configurado devuelve503 y mantiene abierto invoice_binary_download_r2_real. Las fichas explican disponibilidad, autenticación y cuotas desconocidas sin inventarlas; aprobación de contexto no garantiza que toda inferencia produzca una llamada válida. Nuevas ampliaciones requieren revisar límites o selección explícita; no hay invocador genérico ni SQL libre.

AI-16 añade [observación/navegación62](../../mvp/62-nodia-ai-ai16-observation-navigation.md) a la [ficha de coordinación](nodia-ai/features/conversation-coordination.md), todavía draft/unregistered. Reutiliza eventos M1, resultados exactos y autoridad actual; no publica una ficha ni amplía herramientas por documentarla. QA de escritorio/móvil sintética y evidencia SQL/proveedor real se separan en la entrega.

Entrega de confirmación AI-18: [64](../../mvp/64-nodia-ai-ai18-human-confirmation.md) y [coordinación](nodia-ai/features/conversation-coordination.md) documentan canal humano, edición registrada y admisión condicionada; NodiaAI sigue draft/unregistered y no se amplía el release de67 lecturas/27 fragmentos.

Entrega financiera AI-19: [65](../../mvp/65-nodia-ai-ai19-financial-effect.md) y [ficha de efecto confirmado](personal-finance/features/confirmed-movement-effect.md), draft/unregistered. El registro incorpora45 fuentes y excluye18 documentos; conserva las67 lecturas y27 fragmentos autorizados.


Entrega de recuperación AI-20: [66](../../mvp/66-nodia-ai-ai20-execution-recovery.md), con worker de efecto financiero local, cancelación y resume humanos, receipt histórico y purga de pendientes resueltos. Actualiza cinco fichas draft existentes sin añadir fuentes ni aprobar/publicar fragmentos; se conservan45 fuentes,18 excluidas y67 capacidades/27 fragmentos publicados.


AI-22 añade [efectos confirmados de Negocios](businesses/features/confirmed-business-effects.md), draft/unregistered, con catorce puertos internos sin publicación MCP. El registro pasa a46 fuentes y19 documentos excluidos; las67 lecturas/referencias y27 fragmentos conservan su publicación. Las siete fichas aprobadas de lectura de Negocios mantienen sus cuerpos. [Entrega68](../../mvp/68-nodia-ai-ai22-business-operations.md) distingue metadatos de factura, referencias/CSV existentes, nuevo upload/promoción pendiente de AI-32 y gate R2 binario real. Verificación final de la etapa pendiente de consolidar; no aprobación documental automática.

AI-23 actualiza el [producto NodiaAI](nodia-ai/README.md) y la [coordinación](nodia-ai/features/conversation-coordination.md), todavía draft/unregistered: conjuntos secuenciales de hasta ocho borradores, primer binding proveedor→contacto, efectos parciales conservados y corrección pendiente con nuevo botón. [Entrega69](../../mvp/69-nodia-ai-ai23-dependent-workflows.md) y [ADR-050 propuesto](../../architecture/decisions/ADR-050-nodia-ai-dependent-workflows.md) separan contrato, implementación y evidencia en curso. No hay nueva sourcepath ni aprobación/publicación de escrituras; se conservan46 fuentes,19 excluidas,67 capacidades y27 fragmentos publicados.

AI-24 añadió [configuración confirmada de Reservas](reservations/features/confirmed-configuration.md) y actualizó su [resumen draft](reservations/README.md): seis puertos internos de casas, colaboradores y políticas, revisión exacta y recibos nativos. [Entrega70](../../mvp/70-nodia-ai-ai24-rental-configuration.md) separa implementación/verificación de laboratorio y publicación. La ficha permanece draft/unregistered y registrada por path explícito para validación; las nueve fichas aprobadas de lectura de Reservas mantienen sus cuerpos. Ese build comprobó47 fuentes/20 excluidas y conservó67 lecturas/referencias/27 fragmentos publicados; el pin sólo incorporó la revisión del registro y release. No aprobación automática ni escrituras Gemini acreditadas.

AI-25 añade [ciclo comercial de Reservas](reservations/features/confirmed-reservation-lifecycle.md), con borradores, edición y transiciones bajo reglas nativas. [Entrega71](../../mvp/71-nodia-ai-ai25-rental-reservation-lifecycle.md) registra seis puertos internos verificados en laboratorio privado; disponibilidad sigue siendo lectura sin hold y cancelación no paga la devolución. Ese build verificó48 fuentes/21 excluidas; las nueve fichas aprobadas de Reservas y las67 capacidades/27 fragmentos publicados conservan su alcance. Las escrituras siguen sin publicación MCP; la nueva ficha permanece draft/unregistered y approval null.


AI-26 añade [dinero confirmado](reservations/features/confirmed-money.md) y [bloqueos/preparación](reservations/features/confirmed-occupancy-preparation.md), conforme [72](../../mvp/72-nodia-ai-ai26-rental-money-occupancy-preparation.md). Diez puertos internos en implementación; corpus objetivo50 fuentes/23 excluidas y67 capacidades/27 fragmentos conservados. Fichas draft/unregistered y approval null, sin publicación MCP ni escritura Gemini acreditada.


AI-29 añade [interacción segura IA](general-settings/features/secure-ai-interaction.md), draft/unregistered, con [contrato75](../../mvp/75-nodia-ai-ai29-secure-human-flows.md) y [ADR-053 propuesto](../../architecture/decisions/ADR-053-nodia-ai-secure-human-interaction.md). Ocho preparadores internos, canal humano y pausa sin lease; validación y aceptación externas separadas. El registro incorpora una fuente draft; no publica herramientas ni modifica aprobaciones.


AI-30 añade [fuentes e informes restringidos](nodia-ai/features/restricted-reports.md), draft/unregistered: once fuentes y motor SQL interno, sin tabla analítica ni informes MCP publicados. [Entrega76](../../mvp/76-nodia-ai-ai30-restricted-reports.md) separa implementación, verificación y alcance pendiente de AI-31.

AI-32 añade la ficha [adjuntos y notas de voz](nodia-ai/features/attachments-and-voice.md):55 fuentes,28 excluidas y27 funcionalidades/fragmentos aprobados intactos. [Entrega78](../../mvp/78-nodia-ai-ai32-attachments-voice.md) distingue implementación, copia a factura y evidencia por modo. Sólo cambian el path del borrador y la procedencia del adaptador en el release; no se publica este borrador ni nuevas herramientas de negocio.

AI-32-R01 actualiza las fichas draft de [producto](nodia-ai/README.md) y [adjuntos/voz](nodia-ai/features/attachments-and-voice.md) con la [revalidación vigente](../../evidence/nodia-ai-ai32-r01-validation.json): imagen/PDF en Web y Agentic; audio español y archivo+MCP sintético de lectura en Agentic. Audio Web, R2 real, micrófono físico y traslado legacy siguen pendientes. Sin fuentes/bindings nuevos ni aprobación:55 fuentes/28 excluidas,67 lecturas/27 fragmentos publicados conservados.

AI-32-R02 actualiza las fichas draft de [adjuntos/voz](nodia-ai/features/attachments-and-voice.md), [producto NodiaAI](nodia-ai/README.md) y [efectos de Negocios](businesses/features/confirmed-business-effects.md): evidencia por MIME, audio WAV Web verificado y traslado legacy con SQL real/storage sintético. [Delta R02](../../evidence/nodia-ai-ai32-r02-knowledge-delta.json):55 fuentes/28 excluidas,67 lecturas/27 fragmentos y registry intactos; sólo cambia procedencia técnica de dos documentos aprobados, no su contenido ni aprobación. R2/micrófono físico y audio Web comprimido siguen pendientes.

AI-32-R03 conserva55 fichas/28 excluidas y67 lecturas/27 fragmentos publicados. Actualiza sólo borradores propios: preservación de entidades Web y diagnóstico por fase, verificados en [entrega78](../../mvp/78-nodia-ai-ai32-attachments-voice.md#revalidación-ai-32-r03--entidades-html-y-diagnóstico-por-fase). Web PNG/PDF/WAV y Agentic PNG/PDF/WebM comprobados; WebM/Ogg Web, R2 real y micrófono físico pendientes. No aprueba documentos ni publica herramientas.

AI-32-R04 verifica WebM/Ogg Web con dos frases, metadata explícita de audio y originales intactos; conserva PNG/PDF/WAV, Agentic PNG/PDF/WebM y archivo+MCP. [Entrega78](../../mvp/78-nodia-ai-ai32-attachments-voice.md#revalidación-ai-32-r04--clasificación-explícita-del-audio-web) cierra esos gates de formato, con R2 real/micrófono físico/aceptación productiva pendientes.55 fichas/28 excluidas y67 lecturas/27 fragmentos publicados conservados; cambios sólo en borradores propios, sin aprobación ni publicación de herramientas.

## Revalidación AI-32-R05

[Entrega78](../../mvp/78-nodia-ai-ai32-attachments-voice.md#revalidación-ai-32-r05--r2-micrófono-y-contención-del-compositor) verifica R2, grabación física y lectura Web desde la app, descarga privada y recarga; corrige contención del formulario y captura durante consultas del historial. Se actualizan sólo borradores de producto y adjuntos/voz, sin aprobación o nuevos bindings. El ajuste visual no cambia permisos, herramientas ni semántica. Corpus55/28 y67 lecturas/27 fragmentos conservados; purga/promoción cloud y aceptación productiva separados.

## Revalidación AI-32-R06

[Entrega78](../../mvp/78-nodia-ai-ai32-attachments-voice.md#revalidación-ai-32-r06--purga-y-copias-de-factura-con-r2-real) verifica purga y copia/traslado de facturas con R2 real, SQL desechable e inspector real. Se actualizan sólo borradores NodiaAI de producto/adjuntos y efectos confirmados de Negocios, manteniendo approval null y unregistered. No cambian contratos, permisos o bindings:55 fuentes/28 excluidas y67 lecturas/27 fragmentos conservados. Aceptación productiva, preparación MCP y descarga nativa de factura se distinguen de esta prueba.

## Revalidación técnica AI-32-R07

R07 cierra técnicamente AI-32 en laboratorio: cuatro casos nuevos de lifecycle del inspector correctos Windows/Linux; diez checks SQL/R2 sobre PUT posterior al commit de expiración y janitor en PID distinto, sin modificar ventana70s. Un PUT/un DELETE y GET404 en cota superior real70.01s; nueve guardas offline. Falla inicial de montaje DI del arnés antes de PUT preservada, corregida sólo en pruebas. Sin código/configuración/migraciones/inferencias de aplicación nuevos; base y objeto sintéticos retirados, chat R05 intacto. No prueba SLA/producción ni publica MCP. [Entrega78](../../mvp/78-nodia-ai-ai32-attachments-voice.md#revalidación-ai-32-r07--aceptación-técnica-y-recuperación-tras-put-tardío) y [consolidado R07](../../evidence/nodia-ai-ai32-r07-validation.json). Fichas y ADR conservan sus aprobaciones previas; el build de conocimiento no publica borradores.


AI-34 añade la ficha draft de [contexto largo y compactación](nodia-ai/features/long-context-compaction.md), con [entrega80](../../mvp/80-nodia-ai-ai34-long-context-compaction.md). Añadir contexto documental no publica herramientas ni aprueba fichas.


## Ampliación de alcance: Codex Agentic en NodiaAI

Solicitud del 2026-10-18: [AI-39/40](../../mvp/45-nodia-ai-implementation-plan.md#e11--codex-agentic-en-nodiaai) extienden el plan a 40 tareas. Se actualizan la ficha de [ejecución conversacional](nodia-ai/features/context-execution.md#extensión-planificada-codex-ai-3940) y su producto, manteniendo draft/unregistered. Se reutilizan las fichas existentes: no se agregan paths, bindings o herramientas al registro de 58 fuentes. La base Codex de sesión/OCR no acredita chat/MCP; los nuevos adaptadores, interfaz y aceptación permanecen planificados.


AI36-C01 actualiza las fichas draft de [producto NodiaAI](nodia-ai/README.md), [registro/gateway](nodia-ai/features/capability-registry-gateway.md) y [coordinación](nodia-ai/features/conversation-coordination.md): 73 contratos MCP cerrados y adaptadores candidatos con validación nativa y botón humano independiente. [Entrega82](../../mvp/82-nodia-ai-ai36-integral-coverage.md) y [evidencia C01](../../evidence/nodia-ai-ai36-c01-validation.json) separan compilación, pruebas PostgreSQL desechables y publicación pendiente. No se añaden paths ni aprobaciones:58 fuentes,31 excluidas,67 lecturas/27 fragmentos conservados. AI-36 sigue abierto por C02..C04 y los gates de publicación/aceptación.


AI36-C02 actualiza fichas draft existentes de [NodiaAI](nodia-ai/README.md), su [registro/gateway](nodia-ai/features/capability-registry-gateway.md) y [coordinación](nodia-ai/features/conversation-coordination.md), más [Ajustes Generales](general-settings/README.md) e [interacción segura](general-settings/features/secure-ai-interaction.md). Cuatro contratos MCP candidatos completan la preparación de claves/login/logout propio, conservando canal humano y publicación pendiente. [Entrega82](../../mvp/82-nodia-ai-ai36-integral-coverage.md) y [evidencia C02](../../evidence/nodia-ai-ai36-c02-validation.json) distinguen contratos, SQL aislado y cuenta real. No se añaden paths/aprobaciones:58 fuentes,31 excluidas,67 lecturas/27 fragmentos.


AI36-C03 añade la ficha draft de [análisis de factura en generación activa](businesses/features/active-invoice-analysis.md) al registro explícito:59 fuentes/32 excluidas,67 lecturas y27 fragmentos publicados conservados. El nuevo path cambia la procedencia/release compilada; no publica el analizador. [Entrega82](../../mvp/82-nodia-ai-ai36-integral-coverage.md) y [evidencia C03](../../evidence/nodia-ai-ai36-c03-validation.json) separan parser puro, gateway, SQL aislado y aceptación real pendiente.


AI36-C04 actualiza las fichas draft de [registro/gateway](nodia-ai/features/capability-registry-gateway.md), [coordinación](nodia-ai/features/conversation-coordination.md), [adjuntos](nodia-ai/features/attachments-and-voice.md), [preferencias](nodia-ai/features/accepted-preferences.md) y su producto. Seis ayudantes candidatos cerrados, sin nuevos paths/bindings o aprobación.59 fuentes/32 excluidas,67 lecturas/27 fragmentos conservados; cambia la huella del schema de publicación por admitir las dos clases de preparación previstas, sin publicar herramientas. [Entrega82](../../mvp/82-nodia-ai-ai36-integral-coverage.md#continuación-ai36-c04--seis-ayudantes-comunes) y [evidencia C04](../../evidence/nodia-ai-ai36-c04-validation.json) distinguen runtime/SQL sintético y aceptación real pendiente.
