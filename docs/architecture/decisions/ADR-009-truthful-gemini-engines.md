# ADR-009 — Identidad verificable de motores Gemini y extracción estricta

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
