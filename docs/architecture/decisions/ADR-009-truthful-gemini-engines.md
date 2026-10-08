# ADR-009 — Identidad verificable de motores Gemini y extracción estricta


## Aclaración vigente del usuario — 2026-10-06

Las API keys están permitidas, excepto las gratuitas de Gemini. La recuperación actual ofrece **Gemini: API/Web/Agentic** y **OpenAI: API**. Los tres `can_use_*` del catálogo definen modos configurables; los `use_*` de cada instancia habilitan sus canales y `default_mode` expresa la elección. Modelos y claves se mantienen por instancia/modo, sin fallback automático. Las referencias anteriores a «Cero API Keys», primera entrega Gemini/Mistral o un único modo habilitable quedan como antecedente histórico y son sustituidas por esta aclaración en el alcance recuperado.

Se conserva el requisito de datos operativos comprobables: una clave guardada o un catálogo consultado no prueban inferencia, capacidades ni cuotas. Antigravity continúa sin disponibilidad certificada. La recuperación no incluye restaurar la auditoría visual retirada ni cerrar todos los pendientes de la especificación histórica. Implementación, alternativas y límites en [ADR-015](ADR-015-ai-api-provider-recovery.md). Los documentos mantienen su estado de revisión.

> Estado: propuesto; mitigaciones locales implementadas por autorización del usuario
> Fecha: 2026-10-03

## Contexto

Nodia permite exclusivamente sesiones Antigravity y Gemini Web, sin API keys ni modelos estáticos. El adaptador agéntico anterior declaraba sesión por marcadores de entorno/directorios/Web y ejecutaba Web si no podía usar su SDK con key; además atribuía cuotas Web a Antigravity. El paquete instalado `google-antigravity` 0.1.20 tiene una validación de `GeminiAPIEndpoint` que exige API key en su camino local por defecto. Esto confirma la incompatibilidad de ese camino, no la imposibilidad de cualquier otra integración Antigravity.

## Opciones consideradas

### Opción A: conservar la delegación a Web y los defaults

- Ventaja: los análisis parecen continuar disponibles.
- Desventajas: consume otra cuota, falsea identidad/disponibilidad y contradice la política confirmada. No es admisible.

### Opción B: separar motores y fallar explícitamente hasta verificar un adaptador de sesión

- Ventajas: identidad y consumo comprobables; Web sigue siendo utilizable cuando está configurado; errores y borradores conservan su significado.
- Desventajas: el modo agéntico queda no disponible hasta implementar y probar una integración permitida; algunas configuraciones antiguas requieren sincronizar modelos.

### Vía pendiente de evaluación: CLI oficial con sesión Google

La [documentación oficial de Antigravity CLI](https://antigravity.google/docs/cli/overview) y su [repositorio](https://github.com/google-antigravity/antigravity-cli) describen el motor compartido con Antigravity y autenticación Google mediante keyring/navegador, también para SSH. Es un candidato de sesión diferente del camino por API key del SDK retirado. No demuestra por sí solo un contrato de OCR, descubrimiento/cuotas programático ni aislamiento apto para este microservicio. `agy` no se encontró en el PATH de este PC durante la revisión.

El usuario confirmó el 2026-10-03 que utiliza **la aplicación de escritorio**; se observó su instalación local sin inspeccionar credenciales ni ejecutar inferencia. La [documentación de autenticación de CLI](https://antigravity.google/docs/cli/install/) describe su propio login Google; importar conversaciones de escritorio no prueba reutilización de credenciales ni disponibilidad de OCR. Pendiente verificar un puente compatible con esa sesión, el protocolo/headless y el aislamiento de herramientas/archivos, además del entorno VPS. No ejecutar un agente con acceso al workspace/secretos de Nodia para analizar documentos.

## Decisión

Evolución planificada el 2026-10-07: [ADR-016](ADR-016-antigravity-cli-adapter.md) y [plan 32](../../mvp/32-agentic-cli-implementation-plan.md) proponen reemplazar la mitigación mediante CLI oficial, conservando contratos del frontend. Su puerta de viabilidad y aceptación con cuenta/documentos reales está pendiente; el motor sigue indisponible hasta verificarla. La propuesta no atribuye autenticación Web al CLI ni declara cuotas agénticas observadas.

Aplicar B como mitigación autorizada: Antigravity devuelve indisponibilidad explícita, catálogo vacío y cuota desconocida. Retirar SDK/ramas de key/catálogo estático sin borrar credenciales o perfiles operativos. La futura integración exige prueba independiente de sesión, inferencia y descubrimiento local/VPS sin key. Si no puede observarse cuota, indicar desconocida; no inventarla ni copiar Web. No declarar completado el soporte dual.

Los análisis requieren modelo explícito y coincidencia exacta con el descubrimiento de la sesión. Se admite el ID o nombre exacto reportado para compatibilidad; el catálogo expone ID real. Una recuperación de autenticación mantiene el mismo ID. Sin evidencia de capacidades, no habilitar razonamiento por nombre ni inventar ventana de contexto. No cambiar modelo/motor al reintentar.

Un parser compartido valida con Pydantic la extracción: números finitos, no negativos, cero conservado, faltantes nulos y productos estructuralmente válidos. Server preserva esos datos para revisión en Client y propaga los fallos HTTP sin texto bruto. No confundir extracción con confirmación transaccional de factura/stock, pendiente en Server.

Mantener un worker mientras perfil/locks/admisión sean locales al proceso. Aislar pruebas antes de importar clientes; limitar cuerpo/admisión antes de multipart. El acceso sigue privado conforme a ADR-007/008.

## Consecuencias

- Estado observable fiable y ausencia de consumo Web oculto desde el modo agéntico.
- El soporte Antigravity real y el login remoto privado continúan pendientes; requiere evidencia con sesión de prueba, no marcadores o mocks.
- Sincronizar modelos descubiertos y revisar configuraciones de razonamiento anteriores antes de usar la entrega con cuenta real. Server aún tiene trabajo pendiente S-07/S-08 en selección de instancia/modo/migración.
- Ensayar permisos de UID 10001, recuperación de volúmenes, límites de recursos y acceso desde fuera del VPS. La validación de Compose local no prueba esos controles.

## Comprobación de contratos Server/Client — 2026-10-05

Se reprodujo un `500` en la consulta de modelos: `TranslationService` convierte entidades en objetos planos y perdía los getters `key`/`mode`; el filtro de proveedor llamaba `toLowerCase()` sobre `undefined`. La proyección pública ahora materializa ambos campos, incluso con `includes=false`, sin modificar el objeto persistido al enmascarar la respuesta.

`GET /ai-providers?all=true` enumera configuración almacenada. Sus flags de canales y modelos persistidos no prueban disponibilidad de sesión ni validez actual del catálogo. El estado operativo se consulta mediante `gemini-engines`/`health`; se normaliza el `default_engine` y el contrato Web sin campo `available`, y Antigravity requiere adaptador disponible junto con autenticación/sesión activa. Client usa esa misma condición para el indicador de sesión y la sincronización.

Los resultados de modelos Web/Agentic y salud preservan configuración por modo; sin datos reportados no asignan el primer modelo, no deducen recomendaciones/capacidades por nombre y presentan contexto/cuotas desconocidos como nulos. No se declara vigente un modelo solo porque siga almacenado. Persisten ramas históricas de API keys fuera de esta corrección; S-07/S-08 no se cierran en su totalidad.

La comprobación local con BD y microservicio reales encontró Web sin autenticar y Agentic indisponible con `session_adapter_unverified`. Un smoke HTTP sobre código compilado, listener temporal en loopback y guard sintético devolvió `200` para listado, listado sin relaciones, modelos Gemini, motores y salud; sincronización con `persist=false` devolvió `400` explícito por indisponibilidad. No hubo login, inferencia, consumo de cuotas, cambios de configuración ni llamadas a proveedores por API key. Esto no verifica la sesión autenticada del usuario ni staging. El proceso local existente ejecuta `dist/main` sin watch y necesita reiniciarse para cargar la corrección.

## Auditoría de procedencia de datos IA — 2026-10-06

El usuario pidió retirar del frontend cualquier cuota o capacidad inventada. Se rastrearon las respuestas públicas, configuración histórica, microservicio y `gemini-webapi` 2.1.1 instalado. `_fetch_quota` obtiene consumo, total, restante y reinicio mediante `CHECK_GEMINI_QUOTA`; `_fetch_usage_info` consulta `GET_USAGE_INFO`. Sus números no tienen un respaldo fijo en Nodia. El SDK sí asigna etiquetas estáticas a IDs de acciones: esas etiquetas no prueban qué modelo consume cada bloque y no se publican como correspondencias Flash/Pro.

La autenticación y el catálogo de la cuenta tampoco demuestran que una inferencia funcione. `list_models()` lee el registro de la sesión descubierto por RPC al inicializar el SDK; la consulta pública identifica esa procedencia, sin equipararla a una ejecución ni a una nueva lectura remota de catálogo en cada petición. El SDK actual no reporta ventana de contexto ni capacidad de razonamiento para estos modelos.

| Contrato público | Evidencia admitida y cambio |
|---|---|
| `GET /ai-providers?all=true` | Configuración persistida. La proyección elimina cuotas y metadatos operativos antiguos de `available_models`, conservando IDs/nombres/selecciones y sin reescribir la BD. |
| `GET /ai-providers/supported` | Integración de sesiones Gemini implementada; sin catálogo fijo de modelos ni conexiones por API key ofrecidas como ejecutables. La configuración de Agentic no implica disponibilidad del adaptador. |
| `GET /ai-providers/models` | Descubrimiento del motor solicitado por instancia (`provider_id`) y modo. Nunca usa capacidades de la configuración histórica, inventa límites, mezcla ventanas o asigna el primer modelo. |
| `POST /ai-providers/:id/sync-models` | Descubrimiento de sesión autenticada, con ID válido y metadatos explícitos. Modo API key rechazado antes de leer credenciales o llamar a proveedores externos. |
| `GET /ai-providers/gemini-engines` | Solo métricas Web con autenticación, fuente `web`, fecha reciente (hasta 60 segundos) y valores finitos/rangos válidos. Caché privada de 30 segundos; ceros conservados. Antigravity devuelve cuota desconocida, sin reutilizar Web. |
| `GET /ai-providers/health` | Fechas de comprobación reales y duración medida de la consulta de estado, sin presentarla como latencia de inferencia. Claves guardadas no prueban disponibilidad; desaparecen latencia fija, tiempos relativos inventados y afirmaciones de failover. |
| `GET /invoices/verify-ia-providers` | Modelo explícitamente configurado y descubierto. Se admite un ID o nombre exacto único reportado por la sesión y se devuelve el ID; no se deduce razonamiento por nombre ni se ofrece ejecución por API key. Fallos de comprobación no se convierten en una lista vacía exitosa. |

Client oculta el respaldo de «128K», las modalidades/recomendaciones deducidas, las descripciones históricas y los porcentajes sin procedencia. Muestra bloques reportados con sus claves reales y **unidades reportadas**, sin afirmar que sean tokens, solicitudes o créditos de facturación. No agrega el consumo de las ventanas. Controles de razonamiento requieren capacidad explícita del modelo/motor consultado. La sincronización requiere elegir un predeterminado cuando no exista una selección válida; no lo asigna automáticamente. Se retira el interruptor de auto-reconexión: guardaba una preferencia que ningún servicio consumía. Los textos de autenticación ya no prometen renovación de cookies corporativas, modalidades, TLS/FIDO2 ni propiedades de aislamiento no comprobadas por estos endpoints.

**Observación local:** Web autenticado, tres modelos descubiertos y bloques `None-11`/`None-4` con 2399/2400 unidades y 0% reportado; ventanas Web de cinco horas y semanal con valores recibidos del SDK. Son observaciones de esa sesión/instante, no límites constantes del producto ni cuotas de Antigravity. Agentic continúa `session_adapter_unverified`, no autenticado y con cuota nula. El registro histórico OpenAI/API key queda sin disponibilidad comprobada, fecha ni latencia ficticias. La verificación de factura resuelve el nombre exacto configurado de Gemini al ID descubierto y no declara razonamiento.

Smoke HTTP compilado sobre listener temporal/guard sintético, BD configurada y microservicio privados reales: `200` en listado, sin relaciones, modelos, motores, salud y supported; `201` en descubrimiento Web con `persist=false` y `400` explícito en Agentic. No hubo inferencia, login, escritura en BD ni llamadas por API key. Pruebas unitarias cubren catálogos históricos, descubrimiento malformado, nombres exactos ambiguos, ventanas separadas, cuotas ausentes/vencidas/negativas y ceros reales. La evidencia de UI usa fixtures identificadas como sintéticas y transporte deshabilitado; no certifica la cuenta Google por navegador ni staging. S-07/S-08 continúan con pendientes fuera de estos contratos; este ADR conserva su estado propuesto.

## Referencias

- [Revisión y seguimiento](../../mvp/19-prelaunch-review.md)
- [ADR-005](ADR-005-gemini-web-session.md), [ADR-007](ADR-007-gemini-internal-access.md), [ADR-008](ADR-008-internal-microservices-only.md)
- [Configuración oficial del SDK](https://github.com/google-antigravity/antigravity-sdk-python/blob/main/skills/google-antigravity-sdk/references/agent_configuration.md): sus caminos de nube documentados usan API key o proyecto/ADC; no confundirlos con una sesión de suscripción Antigravity.
- `nodia-gemini-microservice/agentic_service.py`, `invoice_parser.py`, `schemas.py`, `request_guard.py`, `run_tests.py`

## Opciones de razonamiento y presentación — 2026-10-06

El usuario solicitó restaurar Low/Medium/High como preferencias agénticas y thinking Web. La firma y transporte del SDK instalado demuestran soporte de `extended_thinking`; se publica como `supported_options` del motor, sin atribuir capacidad de razonamiento al modelo. La configuración agéntica no declara operativo su adaptador. Se autoriza el diccionario de etiquetas de cuota solicitado por el usuario, preservando IDs y valores, con fallback de presentación para IDs desconocidos. Esta actualización sustituye el bloqueo anterior de controles por ausencia de metadatos de modelo, sin alterar las garantías de identidad/procedencia. Ver [contrato y regresiones](../../mvp/ai-provider-feature-contract.md).

## Investigación de sesión agéntica y alternativas — 2026-10-07

Investigación solicitada por el usuario; no cambia disponibilidad, política ni estado de aprobación. Se revisaron documentación oficial, repositorios de sus autores y reportes de usuarios en esos repositorios. No se instalaron herramientas, accedió a tokens/cookies ni ejecutaron inferencias.

### Hechos locales

`nodia-gemini-microservice/agentic_service.py` devuelve indisponibilidad deliberadamente con `session_adapter_unverified` y rechaza análisis. No contiene un cliente que intente autenticar la cuenta. `agy` no está en PATH ni en la ruta Windows documentada `LOCALAPPDATA/agy/bin/agy.exe`. Esto no descarta instalaciones en otras rutas. El bloqueo del SDK anterior descrito arriba no demuestra que la suscripción sea inaccesible mediante otro transporte.

### Alternativas y fuentes comprobadas

| Alternativa | Evidencia y encaje en Nodia |
|---|---|
| [Antigravity CLI oficial](https://www.antigravity.google/docs/cli/headless/) | `-p`, salida JSON/NDJSON, esquema JSON, ejemplo Python con subprocess y sesión persistente por stdin. Descubrimiento mediante `agy models`; `--model` explícito y `--effort low/medium/high`. Modelo inválido en headless produce error. El protocolo de entrada documentado solo admite bloques de texto: PDF/imágenes requieren una prueba independiente. Candidato prioritario, sin disponibilidad certificada. |
| [SDK Python oficial](https://github.com/google-antigravity/antigravity-sdk-python) | El quickstart usa `GEMINI_API_KEY`; las rutas Enterprise documentan key o proyecto/ADC. No se encontró en esas instrucciones un camino verificado para consumir la suscripción personal. Instalar nuevamente el mismo SDK no resuelve por sí solo el objetivo. |
| [dvcrn/antigravity-oauth-proxy](https://github.com/dvcrn/antigravity-oauth-proxy) | Proxy Go comunitario con OAuth y renovación, HTTP Gemini/OpenAI, MCP y modelos de la cuenta. Traduce a Cloud Code interno. Su clave administrativa protege el proxy; es distinta de una key de facturación Gemini. El README admite sustitución de variante/modelo tras ciertos 404: incompatible con la identidad estricta de Nodia sin adaptar y verificar ese comportamiento. |
| [router-for-me/CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI) | Proxy comunitario para varias familias de proveedores y canales, incluido Antigravity. Candidato HTTP; requiere asegurar en la configuración y en pruebas que cada solicitud conserve cuenta/canal/modelo y no cambie a Gemini CLI, Web u otro proveedor. |
| [usamashehab/antigravity-proxy](https://github.com/usamashehab/antigravity-proxy) | Implementación Python comunitaria que declara reutilizar el token del CLI, renovarlo y exponer HTTP Gemini/OpenAI; documenta imágenes por passthrough y esquema JSON. Mantiene `MODEL_MAP` fijo y no incluye autenticación del proxy. No es un reemplazo directo apto para Nodia: requiere descubrimiento dinámico, acceso privado autenticado y pruebas independientes. |
| [rhkdguskim/antigravity-gemini-mcp](https://github.com/rhkdguskim/antigravity-gemini-mcp) | Servidor MCP con OAuth y herramientas de generación, chat, modelos y consulta de cuota. Demuestra un diseño comunitario comparable; no se comprobó ejecución ni OCR. MCP añade un protocolo que no necesitamos actualmente para el contrato HTTP privado de FastAPI. |

El [login oficial](https://www.antigravity.google/docs/cli/install/) utiliza keyring y navegador o autorización manual en SSH. Headless reutiliza credenciales ya autenticadas; no elimina el paso de login inicial. No asumir que la sesión de escritorio se importa automáticamente ni copiar tokens de perfil como contrato oficial.

Los [planes oficiales](https://www.antigravity.google/docs/plans/) incluyen CLI y describen para Pro una ventana de cinco horas limitada también por cuota semanal. Los límites dependen del trabajo y pueden cambiar; no trasladar cifras Web a Agentic. El ajuste de excedentes permite `Never` para evitar consumo automático de créditos adicionales. La cuenta concreta y su cuota deben comprobarse antes de habilitar disponibilidad.

### Casos similares y límites

- [CLI #223, 2026-05-29](https://github.com/google-antigravity/antigravity-cli/issues/223): reporte de dificultades para el login inicial en contenedores/CI. Es un caso histórico, no prueba de que toda autenticación actual falle.
- [CLI #234, 2026-05-29](https://github.com/google-antigravity/antigravity-cli/issues/234): un usuario de suscripción de pago reporta agotamiento semanal tras pruebas cortas y llamadas adicionales del agente. No tratar una petición headless como equivalente a una sola inferencia ni consultar cuota pidiéndosela al modelo.
- [CLIProxyAPI #1015, 2026-01-14](https://github.com/router-for-me/CLIProxyAPI/issues/1015): reporte histórico, cerrado, de generación 429 aun con autenticación/catálogo/cuota consultables. Confirma la necesidad de verificar inferencia por separado; no afirma que sea el fallo actual del usuario.
- [Aviso del mantenedor de opencode-antigravity](https://github.com/luckdevx/opencode-antigravity#terms-of-service-warning--read-before-installing): atribuye a estas integraciones restricciones de términos y reportes de suspensiones. Es una advertencia del proyecto, no un dictamen jurídico propio ni prueba independiente de cada suspensión. La existencia de un repositorio público no demuestra respaldo de Google.

### Recomendación propuesta y siguiente comprobación

Priorizar una prueba aislada del CLI oficial como transporte de `AntigravityAgentService`, dentro del microservicio existente. Conservar endpoints privados y token de servicio, identidad por instancia y ausencia de fallback Web/API. Mantener el estado indisponible hasta obtener evidencia real.

La prueba debe cubrir login/persistencia/renovación en el host objetivo, modelo descubierto elegido explícitamente, una respuesta de texto válida, esfuerzo de razonamiento y extracción de un documento sintético. Ejecutar desde un directorio aislado, con permisos y herramientas limitados y sin acceso al repositorio, `.env` o documentos ajenos; el agente puede leer/escribir archivos de su workspace por defecto. Acotar tiempo/salida/concurrencia y terminar procesos propios ante cancelación. Ver [permisos oficiales](https://www.antigravity.google/docs/permissions?tab=cli).

La [consulta oficial de cuota](https://www.antigravity.google/docs/cli/commands/usage) es un panel TUI; no se ha verificado un contrato JSON estable para las ventanas en Nodia. Mantener `quota:null` si no existe una observación interpretable y comprobada. Los tokens de una respuesta JSON no equivalen a cuota restante. Esta investigación valida candidatos y contratos documentados; no certifica integración, soporte multimodal, renovación ni consumo con la cuenta del usuario.

## Sustitución posterior del stub Agentic — 2026-10-07

CLI oficial de sesión implementado por autorización del usuario conforme a [ADR-016](ADR-016-antigravity-cli-adapter.md). `session_adapter_unverified` sigue describiendo entornos no configurados; Windows local tiene sesión/cuota/modelos observados y PDF/PNG comprobados. No reasignar datos Web ni reintroducir SDK con API keys. Evidencia/límites en [plan 32](../../mvp/32-agentic-cli-implementation-plan.md) y [runbook](../../mvp/agentic-cli-runbook.md). No se aprueba automáticamente el ADR ni se acredita operación VPS.
