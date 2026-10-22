---
{
  "schema_version": 1,
  "document_id": "nodia-ai.runtime-policy",
  "product_id": "nodia-ai",
  "kind": "feature",
  "revision": 6,
  "document_status": "draft",
  "implementation": {
    "status": "partial",
    "notes": "AI-37 implementa observación agregada interna, alertas acotadas, mantenimiento independiente ante fallos y preparación de restore en cuarentena con trabajo marcado sin replay. Incluye auditoría global por conjuntos y medición sintética de consultas/contexto. Código y pruebas locales, integración SQL y adopción operativa se acreditan por separado; ver entrega83. AI-36/C05 y candidatos R05 conservan sus pendientes, sin ampliación120/600 ni publicación o aprobación automática. AI-38 prepara entrega verificable para la VM Linux local y acredita 80 comprobaciones aisladas sobre candidato01; no adopta el paquete ni cierra la cuenta real. Un canario MCP termina mcp_result_unknown, con ACK y sin pendiente o replay; C05 conserva sus pendientes. Ver entrega84."
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento NodiaAI conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/50-nodia-ai-ai04-runtime-policy.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/41-nodia-ai-v1-contracts.md",
      "kind": "specification"
    },
    {
      "path": "docs/architecture/decisions/ADR-037-nodia-ai-admission-and-minimal-retention.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/55-nodia-ai-ai09-conversation-persistence.md",
      "kind": "specification"
    },
    {
      "path": "docs/architecture/decisions/ADR-068-nodia-ai-pre-dispatch-observation-timeout.md",
      "kind": "specification"
    },
    {
      "path": "docs/evidence/nodia-ai-ai36-c05-r05-observation-timeout-source.diff",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-context/use-case/process-nodia-ai-stage.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "docs/mvp/83-nodia-ai-ai37-performance-recovery.md",
      "kind": "specification"
    },
    {
      "path": "docs/architecture/decisions/ADR-069-nodia-ai-quarantined-restore-and-operational-observation.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/nodia-ai-operations/use-case/observe-nodia-ai-operations.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-operations/use-case/report-nodia-ai-operations.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-recovery/use-case/prepare-nodia-ai-restore.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-recovery/use-case/validate-nodia-ai-restore.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-runtime/use-case/assert-nodia-ai-operation-mode.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-runtime/use-case/run-nodia-ai-worker.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-conversation/nodia-ai-conversation.service.ts",
      "kind": "implementation"
    },
    {
      "path": "docs/mvp/84-nodia-ai-ai38-environment-acceptance.md",
      "kind": "specification"
    }
  ],
  "verification": {
    "checked_on": "2026-10-20",
    "evidence_paths": [
      "docs/evidence/nodia-ai-ai04-runtime-policy-validation.json",
      "docs/evidence/nodia-ai-ai09-persistence-validation.json",
      "docs/evidence/nodia-ai-ai36-c05-r05-validation.json",
      "docs/evidence/nodia-ai-ai36-c05-r05-node-observation-validation.json",
      "docs/evidence/nodia-ai-ai36-c05-r05-observation-timeout-validation.json",
      "docs/evidence/nodia-ai-ai37-operations.json",
      "docs/evidence/nodia-ai-ai37-performance.json",
      "docs/evidence/nodia-ai-ai37-performance-claim-diagnostic.json",
      "docs/evidence/nodia-ai-ai37-performance-claim-equivalence.json",
      "docs/evidence/nodia-ai-ai37-recovery-runbook.md",
      "docs/evidence/nodia-ai-ai37-operations-sql.json",
      "docs/evidence/nodia-ai-ai37-recovery.json",
      "docs/evidence/nodia-ai-ai37-recovery-sql-r01.json",
      "docs/evidence/nodia-ai-ai37-knowledge.json",
      "docs/evidence/nodia-ai-ai37-operational-state.json",
      "docs/evidence/nodia-ai-ai38-acceptance-r06.json",
      "docs/evidence/nodia-ai-ai38-acceptance-context-r02.json",
      "docs/evidence/nodia-ai-ai38-acceptance-regression-r01.json",
      "docs/evidence/nodia-ai-ai38-acceptance-cleanup-r02.json",
      "docs/evidence/nodia-ai-ai38-gates-isolated-r03.json",
      "docs/evidence/nodia-ai-ai38-gates-linux-lab-r03.json",
      "docs/evidence/nodia-ai-ai38-delivery-preflight-r01.json",
      "docs/evidence/nodia-ai-ai38-delivery-control-r01.json",
      "docs/evidence/nodia-ai-ai38-modalities-r01.json",
      "docs/evidence/nodia-ai-ai38-mcp-canary-r01.json",
      "docs/evidence/nodia-ai-ai38-delivery-inventory-r03.json",
      "docs/evidence/nodia-ai-ai38-delivery-native-closure-r01.json",
      "docs/evidence/nodia-ai-ai38-delivery-clock-r02.json",
      "docs/evidence/nodia-ai-ai38-windows-clock-r01.json"
    ],
    "notes": "AI-37: suite final full05 con4.274/4.274 pruebas en237 archivos,25 focales ops,17 PostgreSQL/DI,61 rendimiento,11 equivalencia claim,33 SQL/procesos/restore y4 controles Linux de arranque. Build04/lint04 correctos con3 warnings históricos;192 diagnósticos de fixtures idénticos al baseline,0 nuevos. El intento full04 tuvo un fallo STACK_TRACE_ERROR de causa no probada, conservado; focal11 y full05 pasaron sin cambiar fuentes o relajar checks. Pruebas sintéticas/aisladas, sin inferencias o adopción operativa. C05 conserva4/7 y29 starts MCP observados del corteR05. AI-38: 20 UI/API/SQL + 24 AI36 + 36 AI34; autenticación/Redis y dispatches de contexto son sintéticos, dominio/HTTP/PostgreSQL reales. Claim/Execute se activan por bridge cerrado, sin proceso worker standalone. UI usa componentes reales fuera del shell completo; no acredita cuenta/MCP/modalidades/R2/hotreload. Suites nuevas: Server4274/237 y Client1773/228 correctas. Candidato01 c703 preparado sin adopción; 1 solicitud MCP real fallida/ACK/no pending, sin negocio. La diferencia de relojes apunta a Windows atrasado, sin causa probada del MCP."
  },
  "approval": null
}
---

# Admisión y conservación — contexto funcional de NodiaAI

Las secciones AI-09/AI-12 y los ensayos R01 siguientes conservan su corte histórico. Los anexos C05 y AI-37 delimitan los cambios candidatos y sus evidencias; no transfieren pruebas entre entornos.

[Producto](../README.md). Metadatos canónicos migrados en [AI-06](../../../../mvp/52-nodia-ai-ai06-knowledge-publication-contract.md); esta revisión no cambia el estado de aprobación ni publica capacidades.

## Qué resuelve y qué significa

Acota el trabajo sin confundir límites propios con cuotas de Gemini. La página puede cerrarse sin que se pierda trabajo admitido; no crea tiempo/presupuesto infinito. Chat caduca90 días desde el último mensaje nuevo del dueño; mensajes/archivos y registros técnicos resueltos se borran sin archivo adicional. Preferencias aceptadas y registros de los módulos son independientes. Un pendiente incierto no es un resultado fallido ni una autorización para repetirlo.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención | Datos faltantes/ambigüedad | Aclaración esperada |
|---|---|---|---|
| «Busca el chat donde hablamos del proveedor» | Buscar chats vigentes autorizados | Texto/ámbito si no se identifica | Pedir acotar; no buscar datos de negocio mediante Web |
| «Registra lo de esta nota de voz» | Interpretar y preparar | Obligatorios del módulo y modalidad verificada | Transcribir/interpretar revisablemente y preguntar datos faltantes |
| «Crea estos cien gastos» | Escritura masiva | Fuera de v1 | Explicar exclusión, sin convertirla en cien operaciones individuales automáticas |
| «Inténtalo otra vez, no sé si se guardó» | Recuperar estado incierto | Identidad/outcome de operación anterior | Consultar/conciliar primero; no recrear gasto |

## Operaciones y contratos

| Operación semántica | Clase/efecto | Herramienta y estado real | Endpoint/DTO/caso de uso | Resultado público |
|---|---|---|---|---|
| Admisión/búsqueda/caducidad | Coordinación interna | No nueva herramienta MCP | [Contratos41](../../../../mvp/41-nodia-ai-v1-contracts.md), AI-10/35 pendientes | Estado/cursor/error tipados |
| Delegación Web→Agentic | Inferencia y consultas/preparación | Sin publicación; política48/50 | Wire/snapshot/ERD AI-09/12 pendientes | Procedencia y destino exactos visibles |
| Purga/conciliación | Trabajo operativo interno | Nunca comando libre del modelo | [Arquitectura43](../../../../mvp/43-nodia-ai-execution-architecture.md), AI-11/20/32/36 | Pendiente/resuelto sin exponer contenido/secretos |

## Datos mínimos y resolución de dudas

| Dato/concepto | Obligatorio, condicional u opcional | Significado y fuente contractual | Resolución/aclaración |
|---|---|---|---|
| Archivo/voz | Condicional | 20 MiB/300s, suma/formatos en[configuración](../../../../mvp/nodia-ai-v1-runtime-policy.json) | Rechazar exceso/no soportado sin inventar extracción |
| Destino Agentic | Condicional a switch | Misma conexión, modelo/esfuerzo y viabilidad verificados | Sin destino válido, cambio manual; no API/fallback |
| Campo de dominio | Según DTO vigente | Obligatorios/condicionales del producto correspondiente | Preguntar lo mínimo antes de proponer |

## Reglas, acceso y restricciones

Ordinarios requieren NodiaAI+módulo destino+autoridad del recurso; super_admin no evita límites de recursos ni botón. Web sólo conversa; Agentic consulta/prepara mediante catálogo permitido. La configuración/ficha no habilita modalidades, permisos ni herramientas. Cuotas reales desconocidas se muestran desconocidas; ningún modelo comercial está fijado en esta política.

## Filtros e informes

Búsqueda v1 por título/texto de mensajes, por defecto25/máximo100, excluye vencidos y respeta dueño/ámbito autorizado. Adjuntos/transcripciones no se indexan automáticamente. Informes de negocio conservan filtros/granos/moneda/procedencia de41, máximo100 grupos/20 filtros iniciales; pedir acotar si excede. No sumar fuentes incompatibles ni presentar una página como total.

## Vista previa, confirmación y recuperación

Switch sólo permite delegar una vez; no confirma cambios. Preview exacta y botón siguen41. Presupuestos compartidos por run sobreviven a cambios de fase/proceso. Al expirar, grants revocados y payload purgado; receipts resueltos se eliminan, sin borrar negocio. Sólo descriptores mínimos de cleanup/unknown siguen hasta resolver, sin reejecutar comandos vencidos. Backups/retención remota son gates pendientes, no borrado físico certificado.

## Integración y evidencia

- [x] Configuración y schema cerrados, relaciones y fixtures negativas comprobadas offline en AI-04.
- [x] Decisiones de producto, propuestas técnicas y pendientes separados en50.
- [ ] PostgreSQL/races/fences/presupuestos y puerta compartida OCR/login/chat implementados.
- [ ] Wire de consentimiento/etapas/procedencia y UI publicados.
- [ ] Modalidades/compactación, storage/PUT tardío y backup/restore verificados realmente.
- [ ] Familias de herramientas, autoridad/confirmación y publicación aceptadas.

## Evolución y compatibilidad

| Revisión | Cambio y fuentes | Herramientas/contexto afectados | Compatibilidad/propuestas pendientes |
|---|---|---|---|
| 1 | Política AI-04, límites propios y cero archivo adicional | Contexto NodiaAI, runtime/routing aún pendientes | Sin nuevas herramientas/tablas/BD; nuevas versiones completas se validan y registran por run |


[Persistencia AI-09](conversation-persistence.md): once tablas M1, contratos cerrados y creación interna. Mensajes/admisión/retención automática/worker/routing operativo siguen AI-10..12.

## Anexo C05-R05: retry previo al envío, candidato no adoptado

El [ADR-068 propuesto](../../../../architecture/decisions/ADR-068-nodia-ai-pre-dispatch-observation-timeout.md) delimita un cambio candidato: el vencimiento externo de la observación no generativa conserva `agentic_timeout`, invalida su snapshot y cierra/libera procesos. Indisponibilidad genérica y cancelación conservan sus categorías; ese timeout no demuestra pérdida de autenticación o cuota.

Sólo un job Agentic directo con contrato Gemini, señal vigente y coincidencia de `resourceKey`, `sessionGeneration` y `configurationGeneration` frente al run puede clasificar ese reason exacto como recuperable antes de `armDispatch`. Reutiliza los dos retries durables existentes de1s/3s, con el mismo run/job y deadline600. La nueva reclamación obtiene intento/fence propios y revalida autoridad/configuración; no se resetean presupuestos ni se envía al proveedor antes del armado. El límite de inferencia120 y la política50 permanecen iguales.

No aplica a admisión/preflight anterior al job, delegación sin resource pin del destino, Web/API, identidad ausente/cambiada, cancelación, errores genéricos ni resultados posteriores al armado. Un `unknown` exige conciliación y nunca replay; el arreglo no trata los stalls postdispatch de preferencias. No autoriza confirmar cambios por texto ni por una llamada MCP.

La [QA Python](../../../../evidence/nodia-ai-ai36-c05-r05-observation-timeout-validation.json), la [QA Node](../../../../evidence/nodia-ai-ai36-c05-r05-node-observation-validation.json) y el [delta compilado](../../../../evidence/nodia-ai-ai36-c05-r05-node-compiled-delta.json) separan código candidato del runtime operativo. El [cierre R05](../../../../evidence/nodia-ai-ai36-c05-r05-validation.json) registra un canario no completado, conciliación/ACK y restauración061; Finanzas no se ejecutó. Python/Node candidatos no se adoptaron. Se conserva4/7 de aceptación acumulada y29 starts MCP aceptados observados, sin medir solicitudes/retries internos del CLI, tokens o facturación.

La precisión de reason mantiene la regla de observación no disponible de Ajustes Generales. Su ficha aprobada/publicada `general-settings.ai-models-and-health` revisión8 queda intacta: no cambia su autorización ni se deduce autenticación del error. La [evaluación de impacto](../../../../evidence/nodia-ai-ai36-c05-r05-knowledge-impact.json) registra la compatibilidad y el release preservado. La revisión4 quedó draft/unregistered/approvalnull; su corte se conserva en la evidencia histórica.

Fuente Python del candidato: [agentic_service.py](../../../../../nodia-gemini-microservice/agentic_service.py); su diff/hash y QA se referencian desde docs para respetar el contrato cerrado de metadatos.


## Anexo AI-37: observación y recuperación operativa

La [entrega83](../../../../mvp/83-nodia-ai-ai37-performance-recovery.md) y el [ADR-069 propuesto](../../../../architecture/decisions/ADR-069-nodia-ai-quarantined-restore-and-operational-observation.md) incorporan una ruta interna de operación. No añaden una herramienta MCP, una ruta pública, una tabla de métricas o permisos del modelo. La ficha continúa draft/unregistered/approvalnull; compilarla no publica instrucciones ni aprueba el ADR.

La observación devuelve contadores agregados de cola, leases, jobs/slots unknown, trabajos con marca de cuarentena de restore y limpieza; usa un solo agregado SQL con reloj de la BD y timeout de consulta. Conserva ceros reales, edades desconocidas como null y disponibilidad del proveedor/coste externo como null. `no_alerts_observed` significa ausencia de las alertas evaluadas en ese instante; no certifica autenticación, inferencia, MCP, almacenamiento disponible o aceptación productiva. No registra títulos, mensajes, adjuntos, claves, descriptores o identidades de chats/usuarios.

Las alertas siguen plazos y estados ya implementados: espera de cola conforme al tipo de trabajo, deadline o lease vencido, unknown pendiente, cuarentena de restore pendiente por presencia de su marca —también en trabajos fallidos—, limpieza con reintentos agotados y deadline de borrado físico incumplido. Este último compara el plazo persistido de la limpieza con el reloj actual; no afirma un SLA de borrado cumplido. La edad del job actualmente en cola desde su creación no equivale a la espera de su etapa actual; la edad de unknown usa su última actualización persistida, y la de limpieza usa creación del job, sin confundirlas con el instante exacto del efecto remoto. Los intentos del acuse de recibo se leen de su contador específico; el último intento de borrado todavía con lease no se anuncia agotado antes de terminar.

El worker pide observación desde mantenimiento. El reporter coalesce peticiones simultáneas y observa como máximo una vez por proceso y barrido de retención —900s en la política actual—; emite snapshots acotados y avisos de cambio/resolución de categorías. No crea un bucle nuevo ni una fila por observación. Los fallos de recovery, retención o alertas se aíslan por acción para que una excepción no impida intentar las siguientes; se mantiene su orden sin agregar escritores concurrentes. Los avisos de claim/mantenimiento indisponibles también se deduplican por transición y registran recuperación comprobada; interrumpir comprobaciones durante drain no se anuncia como recuperación. El timeout SQL no acota por sí solo la espera del pool, y no libera capacidad o repite una inferencia incierta.

API y worker rechazan arranque en modo `quarantine` antes de crear el contexto Nest. Cuatro controles Linux reales de arranque en cuarentena/modo inválido verifican cero conexiones de socket y cero solicitudes al proveedor antes del contexto; no son una prueba de aislamiento de red del host. El comando de preparación de restore exige ese modo y un manifiesto cerrado ligado al backup y al head de un journal externo de borrados confiable, con cobertura hasta la cuarentena. El hash no demuestra que un journal incompleto haya registrado todos los borrados. Se retiran confirmaciones/grants restaurados y se marcan trabajos e identidades de runtime como desconocidos, con fences nuevos y marca durable preservada al purgar. Recovery, resume, callbacks y conciliación/ACK habituales no pueden despachar o resolver por sí solos esos trabajos marcados. La preparación aplica retención con reloj actual y el mismo caso de uso de purga, pero devuelve `release_authorized:false`.

La [verificación aislada de recuperación](../../../../evidence/nodia-ai-ai37-recovery.json) acredita33 comprobaciones con SQL y procesos reales: SIGKILL antes/después del armado, nuevo intento/fence y rechazo del worker antiguo; pg_dump/pg_restore y CLI de preparación en otro proceso; purga por reloj actual y journal sintético; confirmaciones restauradas invalidadas y ausencia de replay. Los jobs de ejecución que antes parecían fallidos pasan a unknown cuando la copia no demuestra que no se reanudaron después; sus headers históricos terminales se conservan para respetar unicidad por chat, y sus pasos inciertos no anuncian `can_resume`. La purga conserva dos testigos mínimos marcados sin contenido, incluido el del fallo histórico, hasta conciliación externa.

Los33 casos también comprueban cinco fallos de limpieza con testigo SQL durable y posterior acuse manual mediante un puerto de storage sintético; no certifican borrado R2 real. Un descriptor histórico al límite de8.192 bytes rechaza añadir la marca con rollback íntegro, sin truncar identidad o invalidar parcialmente confirmaciones/grants. Fallar cerrado conserva cuarentena; no se presenta como preparación completada ni como un arreglo de datos silencioso.

La marca es por trabajo y el flag de arranque no es aislamiento de red ni un bloqueo permanente de toda la BD tras cambiar la configuración. Antes de abrir una copia se exige conciliación separada con dominio y procesos actuales, inventario externo de objetos/versiones, journal completo y controles de backup. Las pruebas sintéticas no acreditan rotación continua máxima de siete días, cifrado externo, borrado en el proveedor ni ausencia de efectos posteriores al backup. Un `ready` o recibo ausente en la copia no demuestra que la operación nunca se envió. No hay replay automático por lease, TTL o reinicio.

El análisis de rendimiento separa consultas por conjuntos de la autoridad que todavía requiere comprobar cada resultado/paso. Listados globales conservan auditoría por chat ajeno y correlación al insertar sus eventos por conjunto, dentro de la misma transacción. La lectura de mensajes carga partes y referencias de runs por conjuntos. Reautorizar resultados y pasos puede generar trabajo repetido, pero no se elimina para aparentar una mejora. Sólo se adopta un índice o cambio de consulta después de medirlo con volumen y preservar contratos.

La [medición PostgreSQL sintética](../../../../evidence/nodia-ai-ai37-performance.json) completa61 comprobaciones sobre20.000 chats,205.000 mensajes,20.000 runs/jobs y100.000 movimientos, con consultas compiladas y muestras calientes; no son percentiles productivos. La [equivalencia del claim](../../../../evidence/nodia-ai-ai37-performance-claim-equivalence.json) conserva selección/cupos/unknown/perfil/locks en11 casos. Su [diagnóstico](../../../../evidence/nodia-ai-ai37-performance-claim-diagnostic.json) identifica un conteo correlacionado que superó10s y justifica preagregar por dueño, medido después alrededor de6ms. Se conserva la autoridad y no se agrega un índice para encubrir el trabajo repetido.

La auditoría por conjunto conserva25/100 eventos con una sola inserción y reduce las medianas locales de8,64/34,59ms a1,82/6,27ms; para una fila el cambio medido es+0,053ms. Los perfiles de contexto con índice real de conocimiento y sin fragmentos adicionales en el perfil predeterminado serializan15.651/72.711/199.511 bytes para10/100/300 mensajes;500 filas se rechazan por el límite existente de262.144 bytes. Estas cifras describen los datos sintéticos elegidos, no fijan un máximo universal de mensajes o tokens. El cálculo de cuota se ejercita también cerca de los topes de100MiB por chat y500MiB por dueño; tamaños físicos comprimidos no sustituyen la cuota lógica. No se modifican tablas o índices ni se ejecutan llamadas al proveedor para estas mediciones.

La revisión del código de polling observa intervalos de2s para detalle, historial y eventos activos. Con P páginas de historial, el límite nominal es30×(2+P) peticiones por minuto y chat visible activo; con una página resulta90, antes de retrasos de red/temporizadores. Recuperar un backlog de eventos usa100ms sólo mientras hay más páginas. Son cálculos del código, no tráfico ni throughput medidos; las pruebas SQL/JSONB/contexto no miden tokens, retries internos del CLI o facturación. Reducir polls o agrupar autorizaciones exige conservar revocación, cursores y recuperación, no retirar barreras de acceso.

La [evidencia de operaciones](../../../../evidence/nodia-ai-ai37-operations.json) distingue pruebas unitarias, SQL aislado y composición DI sin arrancar loops. El [harness PostgreSQL/DI](../../../../evidence/nodia-ai-ai37-operations-sql.json) acredita17 comprobaciones en el candidato04: una sentencia agregada y cuatro sentencias contando transacción/timeout, con1.006 jobs y9,84ms en una muestra local; no son percentiles ni SLA. Incluye cuarentena de un trabajo fallido sin jobs/slots unknown, contador de reintentos correcto, ausencia de cambios en los datos observados y resolución real de dependencias del worker sin abrir listeners ni arrancar sus consumidores. Los dos intentos anteriores fallaron en preparación/tipado SQL de fixture y en la composición explícita de publicación vacía; se conservaron y no se presentan como aceptación exitosa. La [evidencia de conocimiento](../../../../evidence/nodia-ai-ai37-knowledge.json) registra4.274/4.274 pruebas finales en237 archivos, build/lint y tipado de producción correctos, y192 diagnósticos históricos de fixtures sin nuevos errores. Conserva el intento global anterior con un fallo STACK_TRACE_ERROR en un caso de composición, de causa no demostrada: el focal de11 casos y la suite final pasaron sin cambiar fuentes ni relajar timeouts/assertions. La [comprobación operativa final](../../../../evidence/nodia-ai-ai37-operational-state.json) conserva los cuatro servicios activos y los932 assets Node operativos intactos, con0 pendientes SQL/nativos y sin consultar metadatos del proveedor; no acredita disponibilidad actual de inferencia/MCP ni adopta el candidato AI-37. Los reportes finales de83 acreditan cada comprobación efectivamente ejecutada. Esta revisión no adopta código en la VM operativa, no cambia los límites de50, no publica más capacidades y no cierra las tres aceptaciones reales pendientes de C05.

## Aceptación por entorno (AI-38)

La [entrega84](../../../../mvp/84-nodia-ai-ai38-environment-acceptance.md) fija la VM Linux local como primer entorno y conserva la separación entre artefacto, integración aislada y cuenta real. Las matrices de [aislado](../../../../evidence/nodia-ai-ai38-gates-isolated-r03.json) y [VM](../../../../evidence/nodia-ai-ai38-gates-linux-lab-r03.json) no trasladan aceptación entre paquetes ni publican nuevas herramientas. La ficha sigue draft/unregistered y sin aprobación.

Los 80 checks nuevos prueban confirmación de la revisión exacta, efecto financiero y recibo visibles, cancelación, revocación, contratos y contexto en PostgreSQL desechable. Los controles Claim/Execute del arnes no acreditan un worker standalone, y las pruebas de contexto no acreditan publicar un producto nuevo. Un canario MCP real sin acceso al dominio falla con mcp_result_unknown; su ACK cierra la identidad sin repetirlo. No se adopta código ni se habilitan modalidades por una observación disponible.

El paquete fija el sucesor c703 de conocimiento por la procedencia del plan45, conservando 74 capacidades y 31 fragmentos aprobados del corte anterior. Los gates de C05, inferencia/modalidades actuales, evolución completa de contexto, entrega/reversión por entorno y retención/backup externo permanecen separados. El reloj Windows atrasado frente a NTP/HTTPS se documenta sin cambiar relojes ni ampliar tolerancias; no se le atribuye el fallo MCP.
