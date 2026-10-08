# Contrato funcional de conexiones IA y regresiones

Fecha: 2026-10-06. Estado documental: en revisión; requisitos pedidos explícitamente por el usuario e implementados, sin aprobación automática del documento. Complementa los documentos 15/16 y ADR-015. Una modificación que retire un requisito exige una nueva decisión explícita y actualizar sus pruebas; no eliminar funcionalidades por interpretar una política histórica.

## Esquema y separación de responsabilidades

| Recurso | Contrato vigente |
|---|---|
| `ai_provider_catalog` | `key`, nombre, activo y booleanos `can_use_api_key`, `can_use_token_plan_web`, `can_use_token_plan_agentic`. Gemini permite los tres; OpenAI API/Agentic tras la migración Codex pendiente, Web deshabilitado. Son permisos de configuración, no pruebas de disponibilidad. |
| `ai_providers` | `catalog_id`, nombre, `use_api_key`, `use_token_plan_web`, `use_token_plan_agentic`, `default_mode`, `is_default`, `is_active`, `auto_rotate_api_keys`, `fields`, timestamps. Los tres `use_*` son booleanos independientes. |
| Columnas retiradas | `key`, `mode` y `fields_version` no son columnas de `ai_providers`. Los getters/proyecciones de compatibilidad pueden conservar `key`/`mode`; nunca recrear las columnas por copiar DTOs antiguos. |
| `ai_api_keys` | Claves cifradas por ID de conexión; solo máscara pública. Exclusividad de selección bajo bloqueo transaccional de la instancia. |
| Modelos y opciones | `fields[modo]`; descubrimiento dinámico y selección explícita. Sin fallback de modelos ni herencia entre modos separados. |

Entidades TypeORM y migraciones son el contrato del almacenamiento. Los DBML del repositorio y `nodia.json` de Obsidian deben representar los mismos campos. El script `nodia-server/scripts/update-ai-catalog-diagram.mjs` respalda el JSON, modifica solo catálogo/instancias IA y comprueba tablas/relaciones e IDs; repetirlo no vuelve a agregar campos. No repetir la migración histórica que eliminaba configuración para reparar un diagrama.

## Formularios y paneles

- Añadir/editar conexión incluye el switch **Predeterminado antes de Activo** y envía `is_default`. Para la primera conexión conocida se propone activado; el usuario puede cambiarlo. Elegir otra conexión predeterminada desmarca la anterior en Server.
- El selector permite Gemini/OpenAI según el catálogo activo y su adaptador. OpenAI ofrece API y, tras la migración Codex pendiente, Agentic; Web queda deshabilitado. Gemini ofrece API/Web/Agentic. La autorización de API keys está vigente; excluir Gemini gratuito no significa desactivar todas las API keys.
- **Modelos precede a API keys**. Las tablas siguen el tema MUI y el contenedor/paginación del resto de Ajustes; mínimo 650 px y scroll horizontal transparente en móvil.
- Seleccionar clave usa un switch con nombre accesible. Encender una desmarca las restantes de esa conexión, incluso entre páginas y peticiones simultáneas. Con varias claves se permite apagar la seleccionada; esto deja el canal sin selección hasta elegir otra y no habilita un fallback.
- Una única clave activa queda seleccionada y su switch deshabilitado. Crear la primera, editarla o eliminar hasta dejar una normaliza esa selección en Server. Una clave inactiva no se presenta como utilizable. La migración `1791330000000` repara pools históricos con una sola clave activa sin tocar secretos ni pools múltiples.
- Eliminar es un **icono de papelera con tooltip “Eliminar clave”**, nombre accesible y `ConfirmDialog`. Fallos conservan el diálogo/formulario y sus datos; éxitos/errores tienen toast traducido ES/EN. Revalidar conserva contenido y bloquea controles durante la petición.

## Etiquetas de cuota Web

| ID recibido, conservado | Etiqueta de presentación |
|---|---|
| `None-11` | Gemini Flash |
| `None-4` | Gemini Pro |
| `current_5h` | Quota 5h |
| `weekly` | Quota semanal |

El diccionario fue definido por el usuario para presentación; no demuestra un vínculo oficial con IDs ejecutables de modelos. El ID original se conserva en el dato y tooltip. IDs nuevos muestran su nombre recibido. No agregar porcentajes/consumos entre ventanas, inventar límites ni sustituir valores ausentes por cero. Se mantiene la validación de origen Web, autenticación y antigüedad de la observación; `0%` real debe seguir visible.

El resumen de proveedores y el panel de detalle reutilizan el mismo diccionario internacionalizado ES/EN. En las tarjetas, el alias traducido reemplaza al ID dentro de los paréntesis de «Uso Web reportado»; los IDs desconocidos siguen visibles y el tooltip conserva el ID original. Regresión de tarjetas cubre los cuatro aliases, ambos idiomas y ceros reales.

## Razonamiento: configuración frente a ejecución

**API key:** cada modelo permite elegir Low/Medium/High, también sin capacidades observadas; es una preferencia, no una certificación de soporte. Guardar en `fields.api_key.thinking_levels[id]` y en `thinking_level` para el modelo seleccionado; sin modelos se puede guardar una preferencia general. No seleccionar Medium automáticamente ni heredar niveles de Web/Agentic. El análisis envía el nivel explícito del DTO o resuelve mapa del modelo → preferencia general del canal → ausencia (decisión del proveedor). Validar la configuración final antes de obtener secretos o llamar a la API. OpenAI Responses recibe `reasoning.effort`; Gemini generateContent recibe `generationConfig.thinkingConfig.thinkingLevel` en mayúsculas. No inventar presupuestos de tokens ni detectar soporte por nombre. Ante rechazo del nivel, propagar error seguro sin retirar la opción, cambiar modelo ni reintentar con otra clave por HTTP 400. Fuentes: [OpenAI Docs: reasoning](https://developers.openai.com/api/docs/guides/reasoning), [Gemini ThinkingConfig](https://ai.google.dev/api/generate-content#ThinkingConfig). Este parámetro expresa profundidad de razonamiento; no cambia el nivel comercial o de facturación del servicio.

**Agentic:** mostrar Low/Medium/High en modelos guardados, aun sin capacidades observadas, como preferencia de configuración por modelo en `thinking_levels[id]`. Para el modelo seleccionado también guardar `thinking_level`; sin modelos se permite guardar la preferencia general, sin asignar un modelo fantasma. No seleccionar Medium automáticamente. Estas opciones no prueban soporte, autenticación ni inferencia. El adaptador CLI autorizado publica disponibilidad/sesión según evidencia real; sin binario/hash/perfil configurados mantiene `session_adapter_unverified`. Enviar la preferencia a `--effort` comprobando el mismo ID en `/model`; rechazar cambios de variante. Ningún toggle crea sesión ni consume Web. Ver [plan 32](32-agentic-cli-implementation-plan.md) y [runbook](agentic-cli-runbook.md).

**Web:** el SDK `gemini-webapi` instalado acepta `generate_content(..., extended_thinking=bool)` y utiliza el valor en el transporte. El microservicio publica `supported_options.extended_thinking` según la firma del SDK, independientemente de las capacidades del modelo. Server normaliza ausencia/valores inválidos como desconocidos; Client solo habilita el switch con soporte confirmado. Guardar `fields.token_plan_web.enable_extended_thinking` y enviarlo al análisis, respetando un override explícito del DTO. El SDK/proveedor puede rechazar el modelo/opción: propagar el error, sin cambiar motor ni modelo. Web no implementa Low/Medium/High; se rechazan explícitamente.

No deducir razonamiento de “Pro”, “Flash”, “Thinking” o “Gemini”. No afirmar que el proveedor razonó solo porque aceptó configurar un booleano. La integración CLI Windows con cuenta real y documentos sintéticos se comprobó por separado; suites unitarias aisladas sin cuota. Cuenta Linux-VPS y pantalla real pendientes.

## Regresiones obligatorias al modificar IA

| Caso | Garantía que debe conservarse |
|---|---|
| Crear OpenAI y marcar predeterminado | API y Agentic según catálogo migrado (Web deshabilitado); sin migrar conserva flags previos; `is_default:true` enviado y switch antes de Activo. |
| Editar conexión histórica | ID estable; no apagar API/rotación ni reemplazar modelos de otro modo. |
| Dos claves, selección concurrente | Una sola seleccionada; duplicado revierte sin perder selección anterior. |
| Primera clave / borrar hasta quedar una | Única activa seleccionada; UI activada y disabled. |
| Tabla paginada | Selección global en Server; acciones por icono y estados de carga/error/vacío recuperables. |
| Cuotas conocidas, ID nuevo y cero | Etiquetas del diccionario, fallback de ID y cero recibido; no cifras sin procedencia. |
| SDK Web compatible/incompatible | Publicar opción; enviar booleano exacto o rechazar antes de generar. Nunca inferir por nombre. |
| SDK Web con respuesta incierta | Desactivar reenvíos internos de generación (`current_retry=0` en SDK fijado); permitir solo recuperación de historial de la misma solicitud dentro del deadline. Regresión con forwarding/decorador reales del SDK, sin red. |
| Timeout/recuperación fallida en análisis | Conservar `upstreamRequestId` y `upstreamErrorCode` permitido: `analysis_timeout`/504, `provider_timeout`/504, `agentic_timeout`/504 o `provider_response_error`/502. Descartar headers desconocidos/estado incompatible y cuerpos privados; no reintentar ni cambiar motor/modelo. Plazos coordinados: upload 30 s, Python 300 s, CLI hasta 240 s, Server 340 s y Client 360 s. |
| Progreso parcial de inferencia Agentic | Conservar resumen de eventos stdout ante timeout/cancelación sin registrar texto, rutas, stderr o credenciales; datos diagnósticos inválidos/excesivos no cambian la validación de extracción. Terminar procesos propios y temporales, sin segunda generación. Un resultado observado o herramienta terminada no demuestra éxito. |
| Cliente Web compartido/cancelación | Un análisis por cliente; un segundo recibe 503 antes de inferir. Al cancelar, cerrar transporte antes de esperar el stream, recoger la tarea y liberar admisión; la próxima solicitud reconecta. No atribuir a Google disponibilidad por aumentar plazos. |
| Razonamiento API por modelo | Low/Medium/High guardados por instancia/canal/modelo, transmitidos al proveedor; precedencia explícita y rechazo seguro sin fallback. |
| Estado ausente/malformado/caído | Thinking Web deshabilitado; cuotas desconocidas; configuración conservada. |
| Agentic sin adaptador/modelos | Preferencia configurable; estado indisponible intacto y sin ejecución Web. |
| Login Agentic desde otro equipo | Botón independiente en detalle Gemini/Agentic; enlace/código oficial remoto, sesión compartida explícita y verificación no generativa antes de éxito. Sin cambios de modelos, claves, catálogo o sesión Web. |
| Alerta de salud Agentic | Adaptador disponible sin sesión → aviso de sesión pendiente y modal de autenticación; adaptador caído/estado desconocido → reconsulta real, sin abrir edición del proveedor. Sesión disponible → sin alerta. Etiquetas/categorías ES/EN, controles bloqueados durante petición y sin éxito ficticio tras error. |
| Comprobación unificada de salud | `GET /ai-providers/health` incluye `engines` de la misma observación usada para badges/alertas, una consulta privada por petición compartida entre conexiones. Client consume una sola caché, polling 30 s y reconsulta manual única; no consulta `gemini-engines` en paralelo. Falta de observación → estado sin verificar. Con API predeterminada conserva la observación de sesiones habilitadas sin afirmar inferencia API. |
| Login concurrente, actor ajeno y cancelación | Un trabajo por microservicio, ownership por actor autenticado, análisis Agentic bloqueado; cancelación/plazo/shutdown limpian procesos y admisión incluso antes de iniciar la tarea. |
| Identidad real en las cinco rutas de login | `X-Nodia-Actor-Id` conserva `users.id` como cadena decimal canónica positiva dentro del rango BIGINT PostgreSQL; aceptar IDs superiores a `Number.MAX_SAFE_INTEGER` sin confundir IDs adyacentes. Rechazar UUID, ausencia, signos, ceros iniciales, espacios y desbordamientos. |
| Error de validación interna en login | GET/current y errores de actor no se presentan como código OAuth inválido. 422 público por código únicamente en POST/code con categoría privada explícita `login_invalid_code`; otros 422 privados son fallo de integración/502. Sin reflejar inputs ni cuerpos privados. |
| OAuth malformado/cuerpos excesivos | Enlace Google/callback/PKCE validado, código acotado sin controles, respuestas sin tokens ni trazas; límites HTTP y `no-store`, sin terminal genérica ni reintentos ocultos. |
| Tarjeta resumen API (OpenAI / Gemini) | Distingue canal API habilitado de tarjeta vacía; panel con modelo, OCR, razonamiento, conteo y máscara de clave seleccionada (`display_hint`); sin secretos completos; requisitos pendientes dirigen a configurar en detalle; falta de evidencia mantiene "Sin verificar" sin inventar latencia, fechas o cuota. |
| Mutación rechazada | Modal e inputs intactos, feedback específico seguro y posibilidad de reintentar. |

Pruebas de componentes en Client, casos de uso en Server, integración PostgreSQL desechable (`test:ai-api:integration`) y runner aislado `nodia-gemini-microservice/run_tests.py`. Ver la evidencia ejecutada y limitaciones en `19-prelaunch-review.md`.

## Transporte Agentic recuperado — 2026-10-07

Login remoto añadido por autorización expresa: [funcionalidad en features](../features/ai-providers/gemini-agentic-authentication.md) y [ADR-017](../architecture/decisions/ADR-017-gemini-agentic-remote-login.md). El navegador cliente autentica el CLI del servidor mediante enlace/código oficial. Mantener `{job:null}` en el endpoint público de intento actual; no convertir ausencia en cuerpo HTTP vacío. El código de autorización no se persiste en BD/campos/logs y se elimina de la mutación tras enviar; si el POST falla, conservar el input para revisión/reintento. No restaurar el requisito anterior de login exclusivamente en terminal ni unirlo al botón Web. Cuenta/persistencia VPS aún requieren comprobación en ese entorno.

Rutas/opciones del frontend conservadas; Server utiliza CLI para health/modelos/sync/verify/analyze. Modelo dinámico exacto, esfuerzo elegido, sin fallback ni API/overage. Sync modifica solo `fields[modo]`, conserva otros scopes y no asigna el primer modelo. Regresión HTTP: `test/agentic-cli.integration.mjs`; integración real explícita `--live-cli` con documentos sintéticos. Retirar estas garantías exige nueva decisión y evidencia; no restaurar el stub por copiar ADR-009 histórico.

## Evaluación de plan ChatGPT — 2026-10-07

**Solicitud retomada — plan de Codex Agentic:** el usuario solicita `openai` + `token_plan_agentic`, conservando API key y sin habilitar OpenAI Web. El [plan 33](33-chatgpt-integration-pending.md) contiene CG-01..12; sustituye la prioridad exploratoria anterior de comenzar por inferencia directa. Propone descubrimiento dinámico de modelos/esfuerzos, sesión independiente por conexión, enrutamiento health/sync/verify/analyze en NestJS y migración incremental. Al implementarse y verificarse, reconciliar las garantías API-only de este contrato/AGENTS y documentar en `docs/features/ai-providers/` antes de retirar el plan. Actualización 2026-10-08: adaptador y UI Codex implementados; migración preparada, no aplicada. El usuario aplaza BD/cuenta/QA. No hay sesión/inferencia Codex real comprobada; ver el [runbook](../features/ai-providers/openai-codex-agentic.md) y ADR-018.

Continuidad: el usuario pidió conservar la integración para retomarla posteriormente en [33-chatgpt-integration-pending.md](33-chatgpt-integration-pending.md). La implementación de código comenzó el 2026-10-08; CG-01/cuenta y aceptación operativa quedan aplazados por el usuario. Los hallazgos siguientes no habilitan capacidades operativas.

Antecedente documental del 2026-10-07, anterior a la implementación actual; **sin aprobación automática de documentos**. OpenAI sigue habilitado únicamente por API key en el contrato vigente. La documentación oficial actual permite estudiar estas alternativas:

- **Agéntico:** Codex admite autenticación por cuenta ChatGPT y ofrece SDK/app-server para integraciones. Para una app con autorización propia de uso del plan, la guía de Sign in with ChatGPT describe app-server con un proveedor Responses y el access token OAuth de esa app; no requiere un segundo login de Codex. No copiar las credenciales de este chat ni reutilizar la identidad de registro de otra aplicación.
- **Inferencia directa con el plan:** la capacidad opcional ChatGPT plan usage permite solicitudes elegibles a `https://api.openai.com/v1/responses` usando OAuth, no la sesión/cookies de ChatGPT web ni sus endpoints privados. `store:false`, `stream:true`, catálogo activo de la cuenta y esperar `response.completed` son requisitos. El SDK debe configurarse sin reintentos automáticos de inferencia incierta. No confundir este transporte con API key de pago.
- **Disponibilidad y límites:** la ruta está en preview y la guía consultada se dirige a apps de código abierto y alojadas localmente; para apps de pago o alojamiento remoto remite a un proceso de interés/acceso específico, con una guía adicional de VMs autohospedadas. Verificar el encaje del despliegue concreto de Nodia y el permiso efectivo `chatgpt.tokens.use.direct` antes de inferir. Un login de identidad por sí solo no habilita consumo del plan. No asumir dos bolsas independientes “Web/Agentic”, cuotas, modelos o funciones iguales a ChatGPT web; exponer solo datos observados.
- **Documentos:** el flujo directo admite texto, imágenes y archivos cuando el modelo elegido los acepta; su Files upload API y herramientas hospedadas como Code Interpreter no están soportadas por esta ruta. Comprobar factura PNG/PDF, salida validada, cancelación, renovación OAuth y error de cuota en una prueba aislada antes de habilitar capacidades. Esa prueba no se ejecutó en esta consulta.

**Cuota identificada en documentación oficial:** la guía de usuario [Sign in with ChatGPT](https://learn.chatgpt.com/docs/sign-in-with-chatgpt) establece que las solicitudes elegibles de apps conectadas consumen el uso incluido de **Codex / ChatGPT Work**. Conectar una app no añade una asignación; su límite semanal es un tope sobre el uso del plan, no una bolsa reservada. Por tanto, en la integración propuesta tanto Responses directo como app-server usarían esa familia de cuota; llamar al directo “Web” no lo convierte en acceso al cupo de conversaciones de chatgpt.com. No confundir esta cuota con el cupo de la función Agent de ChatGPT. Codex con login ChatGPT también usa acceso por suscripción; con API key se factura en Platform. El [app-server oficial](https://learn.chatgpt.com/docs/app-server) permite consultar `account/rateLimits/read` para autenticación compatible y obtener las ventanas/buckets que entregue el servicio, sin fijar duración, porcentaje ni disponibilidad de la cuenta del usuario. Esta aclaración documental no verifica acceso efectivo ni inferencia en Nodia.

**Ubicación propuesta, sin aprobación ni implementación:** iniciar la integración como módulo/adaptadores de Nodia Server. La inferencia directa es HTTP/SSE asíncrono; el transporte agéntico necesita el runtime Codex como proceso aparte, supervisado desde Node/NestJS y conectado por stdio. El ejemplo oficial de [app-server](https://learn.chatgpt.com/docs/app-server) usa `node:child_process`; por tanto no exige un nuevo microservicio HTTP. Preservar los contratos de negocio y separar OAuth, ejecución directa y supervisor agéntico. Aislar perfiles/temporales por conexión, no heredar el entorno completo con secretos de NestJS, limitar concurrencia/tiempo/salida y limpiar procesos al cancelar o apagar. Un proceso hijo por sí solo no constituye aislamiento de seguridad: para herramientas con ejecución de comandos o acceso amplio a archivos, evaluar un worker/contenedor con privilegios mínimos antes de habilitarlas. También separar ejecución si requiere escalado o despliegue independiente, siguiendo ADR-008 cuando exista microservicio. Para una factura→JSON sin herramientas, preferir el adaptador directo; la cuota documentada no obliga a ejecutar un agente. Acceso OAuth, binario, aislamiento y funcionamiento en el despliegue real siguen pendientes de prueba.

Propuesta técnica por evaluar: dos adaptadores detrás de los contratos de Nodia (directo y agéntico), con registro/consentimiento OAuth propio, tokens protegidos y selección explícita del canal. La implementación necesitará reconciliar el catálogo, las reglas del proyecto y un ADR; no habilitar flags solo por la existencia de documentación. Fuentes oficiales consultadas: [autenticación](https://learn.chatgpt.com/docs/auth), [Codex SDK](https://learn.chatgpt.com/docs/codex-sdk), [ChatGPT plan usage](https://developers.openai.com/siwc/token-sharing-open-source), [modelos e inferencia](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference), [Codex app-server](https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server) y [limitaciones preview](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations).

## Codex Agentic preparado — 2026-10-08

La petición del usuario fija local primero y QA temporal con TryCloudflare después; posteriormente pide implementación sin levantar BD y verificación real futura. Código de Server/Client y migración preparados; no se aplicó la migración ni usó una cuenta de esta conversación.

| Regresión añadida | Garantía del código |
|---|---|
| Sesión Codex por conexión | `ai:manage`, actor derivado de autenticación, jobs privados por BIGINT/string y no-store; API no valida el canal Agentic. |
| Login remoto | Código de dispositivo oficial, polling y cancelación; código borrado en estado terminal. Modal permanece ante fallo; recuperar job evita reenviar login incierto. |
| Modelo/esfuerzo | ID exacto, esfuerzos/modos/modalidades observados; sin primer modelo automático ni herencia API. Preferencia incompatible visible/corregible; null por modelo elimina el esfuerzo. |
| Cuota | Buckets y ventanas separados, null/0 distintos; denegación solo por `ordinaryUsageAllowed:false` o error real del proveedor. |
| Analyze | Adapter Codex independiente, mismo multipart/JSON de factura; nuevo contexto, terminal validado, presupuesto global, cancelación y sin replay/fallback. |
| Aislamiento | Perfil privado/keyring fuera del repo; entorno restringido, features/sandbox verificados, solicitudes de herramientas rechazadas, procesos/salida/documentos acotados. No equivale a VM. |
| Catálogo/reversión | Migración objetivo API true/Agentic true/Web false; flags de instancias, claves/modelos y predeterminados intactos; backup de flags para down. No aplicada ni comprobada en PostgreSQL aún. |
| Alertas | OpenAI conserva ID de conexión para gestionar Codex; no abre el login Gemini ni elige la primera instancia del mismo catálogo. |

[ADR-018](../architecture/decisions/ADR-018-openai-codex-agentic.md) y [funcionalidad/runbook](../features/ai-providers/openai-codex-agentic.md). CG-01..12 conservan las aceptaciones reales pendientes en el plan 33; no borrarlo ni marcar disponible por pruebas sintéticas.
