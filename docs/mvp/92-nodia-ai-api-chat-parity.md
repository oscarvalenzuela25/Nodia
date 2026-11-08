# NodiaAI: paridad del chat mediante API key

> Fecha: 2026-10-27.
> Estado documental: borrador en revisión; sin aprobación ni publicación automática.
> Implementación: Server OCR R02 adoptado en VM Linux. Turno proveedor→OCR OpenAI aceptado por alcance; Gemini planner bloqueado400 y generación imagen429. Consultar la matriz actual antes de extender un success previo.


## Ronda real OCR y multimedia — 2026-10-27

Prioridad indicada por el usuario el 2026-10-27: la generación de imágenes mediante API key de OpenAI y Gemini no es urgente y queda pospuesta. No realizar nuevas pruebas ni consumir claves en ese carril hasta retomarlo explícitamente. Sus gates pendientes conservan los resultados históricos; esta decisión no cambia funciones, configuración ni permisos. Chat, OCR y lectura de adjuntos mantienen su prioridad.

La [matriz durable](../evidence/api-ocr-media-verification-r01.json), los [ocho casos con hashes de recibos](../evidence/api-ocr-media-real-cases-r01.json) y la [adopción Server](../evidence/api-ocr-media-server-adoption-r01.json) acreditan diez POST totales, incluidos un rechazo400 y otro429; cero retries/fallbacks y coste facturado desconocido. Los recibos completos, operadores y originales sintéticos están en el [catálogo recuperable](../../ops/lab/artifacts/api-ocr-media-verification-r01/catalog.json).

| Camino | OpenAI | Gemini |
|---|---|---|
| Turno guiado proveedor→OCR | Pass gpt-6-luna, 2 planner +1 OCR | Bloqueado: primer planner HTTP400, 0 OCR |
| Extracción por worker/core común | Pass con el turno anterior | Pass aislado, 1 OCR; planificación sintética |
| Lectura PNG | Pass, 1 POST | Pass, 1 POST |
| Lectura PDF nativa | Se conserva el success desechable anterior; no se repitió | Pass nuevo sin tools, 1 POST |
| Audio WAV hablado | Sin transporte en el adaptador Nodia actual | Pass 2.615 s, 1 POST; no califica otros audios |
| Generación de imágenes | No probada en esta ronda | gemini-3.1-flash-lite-image: HTTP429, sin imagen/calificación |

Ambas extracciones pasan cuatro ceros y cuatro números desconocidos, comparación unmatched/unknown con Products vacío y readback byteidéntico sin otra llamada. La preparación awaiting_supplier inicial es sintética; sólo el segundo turno OpenAI tiene planificación real. Las dos lecturas posteriores invocan los casos de uso reales y no equivalen a un reload de navegador. Se rechazan actor ajeno y módulo revocado. OCR/lecturas no crean productos, facturas, propuestas ni ejecuciones; el PDF no aporta un coste fiable y no se fabricó uno para guardar. El gateway común de propuesta/challenge/confirmación/idempotencia pasó de nuevo 16 checks SQL con respuestas de proveedor sintéticas; no se atribuye un botón humano físico a esta ronda.

El ensayo previo sin consumo detectó tres resultados OCR cerrados a mode:agentic; ahora admiten agentic/api_key y rechazan Web. Se preservó el esquema anterior y se creó un canónico nuevo, actualizando sólo sus dos referencias y bindings. El transporte cierra la planificación únicamente tras un callback OCR request único con recibo válido y selección exacta; la etapa común revalida el request persistido antes del OCR. Así el turno completa dentro de tres POST sin aumentar política50 ni confundir ACK de cierre con confirmación humana.

Server adoptado f1bd47…/knowledge ad41d3… conserva los mismos 4140 paths: cambian ocho archivos de runtime, con sólo dos fuentes productivas modificadas. Pasan 151 focales, build/rebuild Linux, assets, DI compartida y SQL19+16. No hay migración: las 65 tablas/fingerprints y32 entradas de ledger quedan iguales. Client17f5d1/Nginx4b0a02 y Native b3dcf/4b990/inicio18:32UTC permanecen exactos. Los backups cifrados previos/posteriores se verificaron con HEAD/GET/IfMatch reales; su TTL siete días no acepta todavía limpieza calendar.

El HTTP400 Gemini ocurre en discovery con ocho declaraciones técnicas, antes de ofrecer OCR. Las composiciones/referencias de JSON Schema son una hipótesis de compatibilidad; no hay offending field ni causa probados y no se modificó el contrato a ciegas. La extracción Gemini con planner sintético es otro caso, no fallback productivo ni aceptación del planner. El429 de imágenes no prueba cuota restante, reset, importe cero o indisponibilidad de otros modelos; no se probó otro modelo ni se reenvió.

Las modalidades quedaron calificadas sólo en sus configuraciones desechables. Modelos API/catálogos operacionales no están asignados y Gemini no tiene una key elegible seleccionada; las claves de test no se guardaron. No se promocionan proofs de otra fingerprint/epoch. JPEG/WebP/OGG/WebM/MPEG permanecen sin inferencia real de esta ronda; audio/mp4 se rechaza por ambos adaptadores, y audio OpenAI está sin implementar en este carril Nodia. El ensayo de imágenes con SQL real y objeto RAM pasó20 checks de store/ownership/readback, pero el caso vivo429 no produjo artefacto. UI autenticada, objetos R2 operacionales y retención real siguen con gates separados.

Las seis fichas R02 aprobadas conservan sus bytes; no hay aprobaciones nuevas ni borradores publicados por ejecutar tests. Esta adenda es seguimiento posterior: el release ad41d3… se reproduce con sus fuentes congeladas y estas anotaciones de autoría no sustituyen sus inputs. Los apartados inferiores conservan el corte anterior, cuyos pendientes se leen junto a esta matriz.

La petición explícita del usuario amplía el chat NodiaAI a API key con las mismas funcionalidades de negocio, permisos y confirmaciones humanas que Agentic. El cierre anterior de [retirada Web90](90-agentic-api-only-web-retirement.md) acreditaba API OCR y dejaba API chat indisponible; sus evidencias siguen describiendo ese corte. Este documento define la ampliación, sin convertir los éxitos OCR anteriores en aceptación del nuevo chat.

La decisión técnica se desarrolla en [ADR-084](../architecture/decisions/ADR-084-nodia-ai-api-chat-common-runtime.md). Las seis revisiones funcionales R02, incluida la [ficha API chat](../nodia-ai/knowledge/nodia-ai/features/api-key-chat-parity.md), tienen [aprobación humana explícita](../evidence/api-chat-knowledge-human-approval-r01.json). Los borradores de producto y gateway fuera de esas seis no se aprobaron. El build incorpora las revisiones aprobadas; su adopción en VM tiene [evidencia propia](../evidence/api-chat-verification-final-r01.json). Este plan y ADR084 siguen en revisión.

## Alcance y garantías comunes

Los únicos modos siguen siendo `agentic` y `api_key`. API utiliza las credenciales cifradas de su conexión en Server; el navegador recibe máscaras y el microservicio Agentic no recibe claves API. Conexión, modelo descubierto y seleccionado, esfuerzo, generación de configuración e identidad del intento permanecen explícitos. No hay modelo predeterminado inventado, cambio automático de conexión/modo ni fallback ante rechazo.

Ambos modos comparten admisión, historial, contexto autorizado, selección de capacidades, ToolGateway, propuestas, revisión, challenge humano, ejecución de comandos persistidos, recibos y recuperación. Una llamada de función del proveedor sólo puede consultar o preparar dentro del catálogo autorizado. Nunca confirma una propuesta, ejecuta SQL libre, accede a una URL arbitraria o concede permisos por el texto del modelo.

Se conservan las reglas actuales de módulo, actor, propietario/colaborador y `super_admin`, revalidadas en sus fronteras nativas. Confirmar requiere el botón humano autenticado sobre la revisión y hash exactos; elegir API no traslada consentimiento ni habilita escrituras. Los catálogos existentes delimitan funciones potencialmente utilizables, no demuestran una ejecución real de cada operación con API. La publicación vigente de 151 capacidades no acredita 151 operaciones aceptadas en este nuevo modo.

## Disponibilidad, herramientas y capacidades

La observación de elegibilidad corresponde a la selección exacta: conexión, modo, modelo y esfuerzo. Una key guardada, descubrimiento de modelos, health, disponibilidad de texto y prueba de herramientas son hechos separados. API verde en el topbar mantiene el significado limitado de clave configurada.

| Campo | Semántica |
|---|---|
| `available` | Selección actualmente elegible para chat según comprobaciones del Server; no implica aceptación de todas las modalidades. |
| `supports_tools` | Soporte de solicitudes de herramientas para esa selección. Campo booleano explícito del contrato nuevo, independiente del transporte; no certifica una ejecución remota exitosa. |
| `supports_mcp` | Veracidad del protocolo MCP de Agentic; API mantiene `false`, aunque utilice herramientas mediante function calling. |
| `supports_image_generation` | Booleano opcional de calificación de generación de imágenes para la selección API exacta; no se deriva de visión, herramientas o texto disponible. |
| `invoice_ocr` | Ruta OCR separadamente autorizada para el chat actual, con MIME y límite exactos; no prueba entrada multimodal nativa al modelo de chat. |
| `native_media_types` | Formatos de entrada realmente calificados para la selección; ausencia de evidencia no se rellena por nombre del modelo. |

Client acepta temporalmente ausencia de `supports_tools` de un Server anterior y usa `supports_tools ?? supports_mcp`; exige booleanos reales, sin coerción. Un `false` explícito prevalece. Sólo muestra soporte de herramientas para la observación exacta disponible y permite corregir/reintentar sin perder borrador. La elegibilidad API basada en configuración y catálogo no es un health remoto ni un success de inferencia. El servicio rechaza observaciones de otra selección y la caché incluye la selección completa y la sesión del usuario. Si `supports_image_generation` es explícitamente false, el helper de `/imagen` informa que no está verificada sin bloquear el chat de texto. La ausencia del campo conserva el comportamiento Agentic anterior y no constituye una calificación nueva.

## Transporte API y runtime durable

Server incorpora adaptadores de OpenAI Responses y Gemini generateContent para texto y function calling. Los argumentos y resultados conservan los esquemas cerrados, límites y autoridad del ToolGateway común. No se incorporan herramientas hospedadas, ejecución automática del SDK ni una segunda ruta de permisos. Las continuaciones conservan los elementos opacos requeridos por cada proveedor dentro del intento, sin exponer reasoning, secretos o respuestas crudas en evidencia pública.

El runtime API se integra con los jobs, leases, fences, slots y presupuestos existentes. La migración aditiva candidata agrega:

- `nodia_ai_api_dispatches`: identidad y hash de solicitud, dueño local, contador de intercambios HTTP, estado y prueba terminal/ACK. No almacena prompts, keys ni cuerpos del proveedor.
- `nodia_ai_api_acceptances`: evidencia de calificación de modalidad por proveedor, conexión, generaciones, modelo, esfuerzo y versión de contrato; guarda hashes y referencias de pruebas, no credenciales.

El ledger se crea antes del envío HTTP. Cada POST generativo real, incluidas continuaciones tras herramientas, reserva durablemente su parte del presupuesto **antes** de transmitir. Los tres envíos por run de la política50 son un techo compartido, no tres POST nuevos por cada invocación del adaptador. Crash después de reservar no devuelve presupuesto. La admisión, callbacks y ejecución mantienen los límites comunes; la API no gana presupuesto por desconectar, recargar o reiniciar un worker.

No hay retries de inferencias inciertas ni rotación automática en mitad de un turno que pueda haber sido recibido. Errores de credencial, cuota, rechazo, formato o tamaño producen estados seguros, conservan identidad y exigen la acción correspondiente. El adaptador no mantiene una transacción SQL abierta durante la red.

## Prueba terminal y recuperación

El descriptor privado API usa `schema_version: 3`, `engine: api_key` e identidad cerrada de proveedor/contrato/conexión/intento/recurso/generación/operación. Se conservan los formatos históricos Agentic para su lectura y conciliación; no se reetiquetan como HTTP.

La prueba HTTP distingue `local_transport_closed: true` de `remote_outcome: completed | unknown`. No utiliza `process_closed` como si API tuviera un proceso nativo supervisado. Sólo una respuesta completa y validada puede producir resultado remoto completado. Abort, timeout, pérdida de respuesta o cierre del worker no prueban cancelación o ausencia de coste en el proveedor.

La conciliación exige identidad exacta y cierre local demostrado mediante el ledger y su propietario real. Lease o deadline vencidos no bastan para declarar un ejecutor muerto; PID reutilizado, boot distinto y dueño remoto requieren tratamiento explícito. El ACK corresponde a esa prueba persistida y no reenvía el POST. Un terminal `abandoned_unknown` mantiene el resultado remoto desconocido y la prohibición de replay, aunque permita cerrar la propiedad local conforme al contrato. No prometer exactly-once externo ni recuperación de una respuesta nunca observada.

## OCR, adjuntos e imágenes

El OCR existente continúa por el core de extracción/validación y comparación, con sus modelos, claves y límites explícitos. El nuevo chat puede recibir `invoice_ocr` cuando Server haya autorizado esa ruta. La extracción produce un borrador revisable; lectura/comparación no guardan registros comerciales y guardar conserva propuesta y confirmación humanas. API OCR ya verificada en el corte90 no acredita por sí sola el recorrido conversacional nuevo.

Los adjuntos conservan upload privado, parser/firma/tamaño, ownership, descarga, expiración y contexto. Una implementación de transporte para imagen/PDF/audio es candidata hasta calificación real de cada selección y MIME mediante contenido sintético conocido y prueba terminal durable. La calificación de un formato o proveedor no se extiende a otro; texto interpretado y original nativo conservan procedencias distintas. No presentar audio, PDF o imagen como disponibles por un nombre de modelo o por un catálogo accesible.

La generación de imágenes es un carril independiente del function calling del chat: modelo seleccionado compatible, salida inline válida, artefacto privado, ver/descargar/reload, retención y cleanup comprobados. OpenAI Images y Gemini con salida de imagen requieren sus propias pruebas y autorización; una key o un éxito de texto no habilitan el carril. La UI existente no obtiene nuevas capacidades multimedia por mostrar API disponible.

## Mapa de implementación

| Proyecto | Cambio y fronteras |
|---|---|
| Client | Tipo/schema de elegibilidad `supports_tools`, estado genérico de herramientas en ConfigurationDrawer, disponibilidad API ES/EN y regresiones atómicas. Se reutilizan compositor, adjuntos, propuestas, canal seguro y confirmación. |
| Server | Resolver/eligibilidad/catálogo API, credenciales privadas, transporte REST, ledger/qualification, proof schema3, reconciliación/ACK, selección de capacidades, presupuesto por POST y ruta OCR del modo exacto. Reutiliza los casos de uso y gateway comunes. |
| Microservicio Agentic | Conserva su runtime privado y credenciales exclusivas. Esta ampliación no desplaza las keys API a Python ni convierte HTTP API en MCP. Regresión de contratos compartidos cuando corresponda. |
| Coordinación | Plan91, contrato común, migración aislada/operacional, evidencia sanitizada, seis fichas aprobadas/publicadas, backup y adopción selectiva de VM; aceptación por alcance. |

Fuentes candidatas concretas: [adaptador API](../../nodia-server/src/nodia-ai-adapter/use-case/api-nodia-ai-adapter.use-case.ts), [transporte](../../nodia-server/src/nodia-ai-adapter/api-nodia-ai-chat-transport.ts), [ledger](../../nodia-server/src/nodia-ai-adapter/api-nodia-ai-runtime.service.ts), [calificación](../../nodia-server/src/nodia-ai-adapter/api-nodia-ai-acceptance.service.ts), [descriptor](../../nodia-server/src/nodia-ai-runtime/use-case/runtime-reconciliation-descriptor.ts) y [migración aditiva](../../nodia-server/src/migrations/1793310000000-AddNodiaAiApiChatRuntime.ts). Su existencia en source no acredita despliegue ni inferencia real.

## Implementación y verificación entregadas

1. [x] Mapa por proyecto y contratos; sólo Agentic/API key, sin fallback de proveedor/modelo/modo.
2. [x] Adaptadores API, credenciales privadas, tools sin MCP ficticio, presupuesto por POST y OCR común integrados con la autoridad existente.
3. [x] Regresiones atómicas/HTTP simulado, tipado/lint/build de producción y paquete selectivo: Server final 5.539 pass/una omitida; Client full anterior 2.016 y focales finales 230/57. No atribuir el full anterior al último cambio de feedback.
4. [x] PostgreSQL desechable: 19 checks de runtime y 16 de gateway, incluida confirmación exacta, un efecto efímero/idempotencia, permisos, concurrencia, recuperación y ACK.
5. [x] Success real en OpenAI gpt-6-luna y Gemini gemini-3.1-flash-lite: modelo descubierto exacto, salida no vacía, callback de conocimiento autorizado, proof3, ACK y cleanup. El gateway de negocio/confirmación se verifica separadamente con proveedor simulado y SQL real.
6. [x] Negativos/unidades y SQL: datos ausentes/inválidos, presupuesto, pruebas forjadas, respuesta perdida/cierre de dueño, unknown y no replay. El primer Gemini PDF+tools rechazado se conserva y no se reenvió; no se conoce su causa ni HTTP status.
7. [x] Seis revisiones documentales R02 aprobadas explícitamente y publicadas por el build; borradores de producto/gateway fuera de ellas no se publicaron. ADR084 y este plan siguen en revisión.
8. [x] Paquetes selectivos reproducibles, backup fresco/quiet y migración operacional aplicada una vez. Los 63 esquemas y 62 tablas de datos anteriores se conservaron; los 65 fingerprints resultantes seguían iguales después de arrancar servicios.
9. [x] API/worker activos y estables, Native preservado sin reinicio, 362 GET de assets/SPA/legacy correctos por bytes/hash/MIME, timers y backup posterior cifrado verificado.
10. [x] Evidencia durable, artefactos recuperables catalogados, plan91 A01..A08 y AGENTS de proyectos correspondientes mantenidos.

## Alcances y gates que no quedan aceptados

La [evidencia final](../evidence/api-chat-verification-final-r01.json) contiene los pins y recibos. Las pruebas reales usaron PostgreSQL/configuración desechables en la VM y secretos sólo en memoria. Se conservaron las conexiones operacionales, sus claves y modelos: el usuario debe elegir una conexión API con clave y modelo válidos. No se selecciona un modelo ni una key silenciosamente por el éxito de un canary.

- [ ] Aceptación real del recorrido conversacional OCR→comparación→reload/guardado por selección API exacta. El código reutiliza el core, con regresiones de cero/null y permisos, pero el success OCR del corte90 y el PDF técnico actual no sustituyen este recorrido.
- [ ] Calificación operacional de MIME y generación de imágenes por modelo/esfuerzo/configuración. Las tablas de acceptances siguen vacías: no se anuncian formatos sin prueba. OpenAI PDF quedó calificado sólo dentro de su configuración desechable; Gemini texto no calificó ningún original. OpenAI Responses no implementa entrada de audio.
- [ ] Turno real autenticado por navegador con cada selección API y comprobación de las modalidades que se anuncien. La UI responsive ES/EN tiene [pruebas sintéticas](../evidence/api-chat-ui-r01.json); los GET de VM acreditan archivos/SPA, sin atribuirles interacción humana o inferencia.
- [ ] Completar las celdas restantes P01..P16/A01..A08 para nuevas combinaciones/proveedores/entornos. No se acepta toda la matriz ni todas las 151 operaciones porque texto/tools hayan pasado. Una modalidad unsupported/blocked conserva su motivo, sin transformarla en success.

La política50 mantiene tres POST generativos por run; las cadenas dependientes más largas deben continuar en otro turno. No se incrementó el presupuesto, no se promete cancelación remota ni se conoce el importe facturado. Cinco POST instrumentados reales incluyen el primer caso Gemini rechazado; cero retries automáticos.

La publicación adoptada `184d9c…` se reconstruye desde el artefacto de fuentes congelado, cuyo wrapper materializa cinco referencias documentales sólo durante el build y las retira. No se adoptó audio Codex ajeno. Estas anotaciones posteriores de progreso pertenecen al workspace de autoría y no cambian los bytes ni el identificador del release desplegado. Los recibos originales de rechazo, revisión y publicación siguen intactos.

## Referencias normativas

- [Catálogo40](40-nodia-ai-tool-catalog-v1.md), [contratos41](41-nodia-ai-v1-contracts.md), [arquitectura43](43-nodia-ai-execution-architecture.md), [política50](50-nodia-ai-ai04-runtime-policy.md) y [publicación52](52-nodia-ai-ai06-knowledge-publication-contract.md).
- [Retirada90](90-agentic-api-only-web-retirement.md), [verificación de proveedores91](91-ai-provider-onboarding-verification.md) y [ADR-083](../architecture/decisions/ADR-083-agentic-and-api-only-ai-modes.md).
- [Estándar de contexto funcional](../nodia-ai/knowledge/README.md): documentación, implementación, integración y aprobación son hitos distintos.
