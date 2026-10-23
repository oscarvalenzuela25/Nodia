# Nodia Gemini Microservice

Adaptador privado FastAPI de Nodia Server para extraer borradores de facturas mediante sesiones independientes Gemini Web y Antigravity CLI. No utiliza API keys ni facturación por token. Las cuotas, modelos y capacidades se muestran únicamente cuando el proveedor los reporta.

## Estado de los motores

- **Web:** usa cookies de una cuenta con acceso a Gemini, gestionadas con Playwright y `gemini-webapi`. El análisis exige un modelo explícito descubierto para esa sesión.
- **Agentic:** CLI oficial 1.3.1 con sesión Google, modelos dinámicos, `/usage` no generativo y PDF/imagen comprobados en Windows local. Sin configuración explícita de binario/hash/perfil permanece `session_adapter_unverified`. Cuenta/Linux-VPS pendientes; ver [ADR-016](../docs/architecture/decisions/ADR-016-antigravity-cli-adapter.md) y [runbook Agentic](../docs/mvp/agentic-cli-runbook.md).
- La autenticación Web no autentica Antigravity. No se mezclan sus cuotas ni se cambia de motor/modelo al fallar.

## Instalación y ejecución

Python 3.11 o superior. Instalar las dependencias en una `.venv` y Chromium para la operación real:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m playwright install chromium
```

Crear `.env` desde `.env.example` y configurar `GEMINI_SERVICE_TOKEN` con 64 caracteres hexadecimales aleatorios, compartidos exclusivamente con Nodia Server. No subir `.env`, cookies, perfiles o documentos a Git.

```powershell
.\.venv\Scripts\python.exe run.py
```

En el host escucha en loopback. `run.py` fuerza **un worker sin recarga**, incluso si está definido `WEB_CONCURRENCY`; la sesión, locks, caché y admisión son locales al proceso. No usar otro lanzador con varios workers compartiendo los volúmenes.

Importar `main` no carga `.env`, abre clientes ni crea carpetas. `create_app` permite inyectar servicios, gestor de login, directorio temporal y límites; los clientes operativos se crean dentro del lifespan.

## Configuración

| Variable | Función |
|---|---|
| `HOST` / `PORT` | Loopback en host; Compose escucha dentro del contenedor y publica en loopback |
| `GEMINI_SERVICE_TOKEN` | Identidad obligatoria de Nodia Server |
| `GEMINI_SECURE_1PSID` / `GEMINI_SECURE_1PSIDTS` | Semilla de sesión; pueden estar vacías antes del login |
| `GEMINI_MODEL` | Metadato opcional de configuración; no sustituye el modelo explícito de una solicitud |
| `MAX_INVOICE_FILE_BYTES` | Límite de archivo, por defecto 10 MiB; el cuerpo admite 32 KiB adicionales |
| `ANALYSIS_SLOTS` | Cargas/análisis simultáneos, por defecto 2, sin cola ilimitada |
| `UPLOAD_TIMEOUT_SECONDS` | Tiempo máximo de recepción del cuerpo, por defecto 30 s |
| `ANALYSIS_TIMEOUT_SECONDS` | Tiempo máximo de análisis, por defecto 300 s (máximo 300) |

Los marcadores antiguos `ANTIGRAVITY_AGENT`, `ANTIGRAVITY_LS_ADDRESS`, listas adicionales y API keys no habilitan un motor. No es necesario borrar secretos del host para que queden ignorados.

## Sesión y login

`auth.py` / `login.bat` / `login.sh` conservan el login manual en el host Python. El flujo habitual es Ajustes IA → Gemini Web → «Abrir visor de Gemini»: Nodia muestra la pantalla y permite enviar entradas por su API autenticada. Disponible en desarrollo/producción; Server y Python vinculan cada intento al actor autenticado con `ai:manage`. El navegador cliente no recibe el token privado ni llama a FastAPI. Ver [uso y despliegue del visor](../docs/features/ai-providers/gemini-web-login-viewer.md) y [ADR-030](../docs/architecture/decisions/ADR-030-gemini-web-login-viewer.md).

`.env` es la semilla; `session_state/` conserva cookies rotadas mediante reemplazo atómico y debe persistir junto con `browser_profile/`. Docker monta `.env` de solo lectura y arranca su propio Xvfb sin TCP como usuario10001. No publicar FastAPI ni un puerto gráfico; el visor utiliza exclusivamente las rutas protegidas de Nodia Server. Login Google y OCR del motor Web con cuenta real comprobados en VM el2026-10-13; niveles Web integrados y OCR privado por los tres niveles comprobados posteriormente. Flujo público y alcance VPS se registran en la funcionalidad del visor.

**Agentic tiene una autenticación independiente desde Ajustes IA → Gemini → Token Plan (Agentic) → Autenticar sesión Agentic.** El servidor ejecuta el login remoto oficial del CLI; el operador abre el enlace Google desde su equipo y pega el código en Nodia. Solo Nodia Server consume `/agentic/auth/login/*`, con token interno e identidad del administrador. Estas rutas no dependen de `NODE_ENV=development` y no modifican la sesión Web; su operación con cuenta del VPS aún debe verificarse. Instalar los requisitos actualizados/reiniciar el servicio; Windows usa `pywinpty`, Linux PTY estándar. Ver [contrato de funcionalidad](../docs/features/ai-providers/gemini-agentic-authentication.md) y [persistencia/operación pendiente del VPS](../docs/mvp/agentic-cli-runbook.md). El almacén de credenciales queda bajo gestión del CLI.

La recuperación de autenticación Web reintenta un análisis **como máximo una vez**, con el mismo modelo descubierto y únicamente ante `AuthError`. Si el ID cambia tras renovar la sesión, se rechaza. Cuotas agotadas, modelo inválido, timeout y rechazo del documento no provocan otro análisis. Se desactivan los reenvíos internos de generación del SDK fijado `gemini-webapi==2.1.1` mediante `current_retry=0`, transmitido por `generate_content` a su decorador. El SDK todavía puede consultar el historial para recuperar una respuesta de la misma generación dentro del límite total. La regresión usa el método público y el decorador del SDK instalado sin red; repetirla al actualizar la dependencia. Un análisis cancelado puede haber sido aceptado por Google; no reenviarlo automáticamente.

## Contratos internos

Todas las rutas salvo `/health`, incluidas `/`, `/ready`, `/docs`, `/redoc` y `/openapi.json`, exigen `X-Nodia-Service-Token`.

### Adjuntos de NodiaAI (AI-32)

`POST /attachments/inspect` recibe un cuerpo binario `application/octet-stream` y `X-Nodia-Attachment-Kind: image|pdf|audio`, exclusivamente desde Server. Cuenta los bytes reales (20 MiB), admite dos cargas/parsers simultáneos y limpia temporales también ante fallo/cancelación. La recepción tiene60s; cada decoder corre en un proceso Linux x86-64 con15s,256 MiB de espacio de direcciones, sin ejecución de procesos ni sockets mediante seccomp. En plataformas sin ese aislamiento falla explícitamente; no ejecuta un parser ilimitado como alternativa. Este mecanismo limita recursos y syscalls; no equivale a una VM independiente por documento.

Pillow13.0.0 decodifica imágenes estáticas PNG/JPEG/WebP (12 millones de píxeles); pypdf6.19.0 verifica estructura/contenidos de PDF no cifrados (100 páginas) sin ejecutar acciones/JavaScript/archivos incrustados. PyAV19.0.1 decodifica las muestras de un único stream de audio WAV/Ogg/WebM/MP3/M4A y calcula su duración real (300s), sin confiar en duración enviada por el cliente. Los formatos anunciados se verifican por contenido; no se aceptan playlists/URLs. Las versiones y APIs se contrastaron con [Pillow](https://pypi.org/project/pillow/13.0.0/), [pypdf](https://pypi.org/project/pypdf/6.19.0/) y [PyAV](https://pypi.org/project/av/19.0.1/).

La respuesta cerrada contiene `media_type`, `page_count`, `duration_seconds` y `extracted_text`. Los valores no aplicables/desconocidos son `null`. La extracción determinista de PDF es un texto revisable de hasta32768 bytes UTF-8; si está vacío o supera ese límite se devuelve `null`, sin recortar ni inventar el documento. Imagen/audio no generan OCR ni transcripciones en el inspector.

El transporte privado `ChatRequest.attachments` admite hasta cuatro archivos/40 MiB decodificados por turno: `{kind,media_type,sha256,content_base64}`. Server proporciona únicamente archivos propios previamente autorizados; el adaptador vuelve a validar contenido/hash, genera paths privados y conserva los archivos hasta el cierre del SDK/CLI. El base64 no forma parte del historial ni del recibo nativo. El recibo mínimo conserva sólo un hash de los hashes/formatos/orden de entrada. Los cuerpos grandes se admiten únicamente en los turnos/probes y `mcp/start`; los callbacks conservan sus presupuestos anteriores. Los documentos son datos no confiables y no autorizan efectos.

La modalidad nativa está bloqueada hasta una prueba semántica de la combinación exacta de motor, perfil, generación de sesión, modelo descubierto, esfuerzo, configuración y versión de adaptador. `POST /nodia-ai/{engine}/attachments/probe` es una herramienta interna de verificación: exige exactamente un archivo sintético y `expected_answer_sha256`; usa una instrucción fija que no contiene el texto/hash esperado, ejecuta una sola generación con recibo normal y habilita la modalidad sólo si el contenido leído/transcrito coincide exactamente. Un200 con respuesta distinta conserva el recibo completado pero no habilita la capacidad; se debe consultar `verified_attachment_media_types` de `/observe` para el MIME exacto (`verified_modalities` es sólo un resumen por categoría) y hacer ACK incluso cuando la prueba semántica no coincida. El cache es local al proceso y desaparece al reiniciar, igual que la prueba MCP; autenticación y catálogo no lo reconstruyen.

En Agentic, los archivos se copian a un workspace desechable con permiso de lectura exacto; los hooks permiten sólo `view_file` sobre esos archivos, `finish` y, cuando corresponde, las herramientas MCP registradas. El resultado exige un recibo de lectura para cada adjunto. Shell, HTTP, otros archivos y confirmaciones siguen bloqueados. El canal implementado y sus pruebas sintéticas no acreditan que el CLI acepte audio ni que una cuenta/modelo haya completado una inferencia; sólo el probe real puede acreditarlo.

El staging nativo comparte una reserva global de40 MiB entre Web y Agentic, adquirida antes de materializar archivos y liberada en `finally`, incluso al cancelar. Los dos inspectores pueden ocupar otros40 MiB:80 MiB combinados frente al tmpfs de96 MiB. Saturación produce429 sin cola ni archivos adicionales. Las copias de Agentic viven en su workspace desechable del perfil, no en ese tmpfs, y se borran al cerrar el CLI.

El canary de audio permite la normalización explícita `speech_words_v1`: UnicodeNFC, minúsculas y lista completa de palabras/dígitos ASCII separados por espacios. Se ignoran puntuación/mayúsculas, pero no se eliminan palabras ni números de la comparación. El hash esperado nunca se añade al prompt; la versión de normalización forma parte del hash del intento y del protocolo de prueba. Esta comprobación de una frase sintética no garantiza exactitud universal de transcripción; cualquier interpretación sigue siendo revisable. Imagen/PDF usan comparación literal.

| Ruta | Función |
|---|---|
| `GET /health` | Vida del proceso; no informa autenticación |
| `GET /ready` | Disponibilidad Web observada; 503 sin sesión |
| `GET /engines/status` | Estado separado de Web y Antigravity |
| `GET /auth/status`, `/web/status`, `/agentic/status` | Estado del motor indicado |
| `GET /models`, `/web/models`, `/agentic/models` | Catálogo descubierto, con identificador real |
| `POST /auth/login/start` | Inicia un único trabajo local |
| `POST /auth/logout` | Desconecta Web y limpia su perfil/caché, exige actor y token; 409 ocupado, 503 limpieza incompleta |
| `GET /auth/login/{id}` | Consulta `running`, `succeeded`, `failed` o `cancelled` |
| `POST /auth/login/{id}/cancel` | Solicita cancelación; un nuevo trabajo espera la liberación del anterior |
| `POST /auth/refresh` | Recuperación de sesión privada |
| `POST /analyze-invoice`, `/web/analyze-invoice`, `/agentic/analyze-invoice` | Extracción con motor explícito o Web por defecto; las rutas de motor fuerzan su identidad |

Análisis: `multipart/form-data` con **un archivo** `file`, **modelo obligatorio** `model`, y hasta seis campos: `engine`, `provider_fields` (JSON objeto), `provider_tax` (0–100), `extended_thinking`, `thinking_level`, además del modelo. Las rutas específicas rechazan un motor contradictorio. Se rechazan campos duplicados, desconocidos y partes de configuración mayores de 16 KiB. Se admiten PDF/PNG/JPG/JPEG/WEBP con firma correcta y archivo dentro del límite.

El SDK Web descubre identidad/disponibilidad de modelos, pero no reporta contexto ni profundidad interna de razonamiento. No se deducen del nombre. El adaptador `web_reasoning_adapter.py` permite `thinking_level=low|medium|high` únicamente con observaciones nativas verificadas del mismo ID/número de modelo y SDK2.1.1. `supported_options.thinking_levels_by_model` informa perfiles observados que coinciden con modelos descubiertos; ausencia/valores inválidos son desconocidos. El booleano histórico sigue soportado según la firma del SDK, sin conversión automática. Nivel y booleano juntos producen422, incluido booleanofalse; un ID sin perfil o un layout incompatible se rechazan sin cambiar modelo/motor ni repetir inferencias.

### Activar perfiles Web comprobados

Sin `GEMINI_WEB_REASONING_PROFILES_PATH`, el runtime conserva el SDK habitual y rechaza niveles explícitos. Para habilitarlos, proporcionar fuera del repositorio/build un JSON público sanitizado con `{ "sdk_version": "2.1.1", "observations": [ [captura_bajo, captura_medio, captura_alto] ] }`. Cada captura requiere `level`, `model_id`, `http_status:200` y formas nativas `body_shape`/`header_shape`; ver el validador y el diagnóstico en `experiments/`. No incluir cookies ni copiar un perfil de otro modelo. Un archivo inválido no acredita soporte.

En Compose, definir `GEMINI_WEB_REASONING_PROFILES_HOST_PATH` con una ruta absoluta existente y añadir `-f docker-compose.web-reasoning.yml` a los archivos base del despliegue. El overlay monta el archivo de solo lectura en `/app/config/web_reasoning_profiles.json`; no crea rutas inexistentes. Fuera de Docker, definir directamente `GEMINI_WEB_REASONING_PROFILES_PATH`. Reiniciar para cargar el registro; actualizar perfiles solo con observaciones comprobadas. No cambiar la propiedad/permisos de `.env` al editar las variables; conservar el usuario10001 y los volúmenes privados.

La intervención se limita a body80/header15 dentro de `_generate`, después de subir archivos. Upload/auth siguen usando el `AsyncSession` real, evitando incompatibilidad con su validación Pydantic. Contexto por cliente, generación única, cierre del iterador y limpieza ante cancelación; no se modifica el SDK instalado. Analizar para devolver un borrador en memoria no necesita R2; persistir adjuntos mantiene los requisitos de almacenamiento de Nodia Server. [Decisión y alcance](../docs/architecture/decisions/ADR-031-gemini-web-reasoning-levels.md).

La respuesta contiene `code`, `total_amount` y `data: {issue_date, items}`. Los números faltantes permanecen `null`; cero permanece cero. Importes/cantidades deben ser números finitos no negativos; no se convierten strings, booleanos, valores inválidos o datos faltantes en cifras válidas. `items` requiere al menos un producto con nombre y admite hasta 2000. Solo se deriva cantidad si falta y están presentes ambos factores de embalaje; no se redondea una cantidad fraccionaria. La revisión del borrador en Client calcula precios según el impuesto configurado; esta extracción no confirma stock ni factura.

Los errores incluyen `{code, detail, request_id}` con mensaje seguro; `X-Request-ID` permite correlacionar. Saturación/cuota: 429; sesión/motor no disponible: 503; timeout: 504; extracción inválida: 502; opciones/modelo incompatible: 422. Saturación incluye `Retry-After`; cuota solo incluye un plazo si se conoce. Server conserva la clasificación y el plazo sin reenviar texto bruto del proveedor.

Para diagnosticar el análisis, `X-Nodia-Error-Code` transmite categorías con HTTP esperado: `analysis_timeout`/504 (límite total de Nodia), `provider_timeout`/504 (espera del SDK/proveedor), `agentic_timeout`/504 (comprobación o ejecución CLI) y `provider_response_error`/502 (respuesta no recuperada o no interpretable por el SDK). Server valida código/estado y los expone como `upstreamErrorCode`, conservando `upstreamRequestId`; headers desconocidos o incompatibles se descartan. Límites: upload 30 s, análisis Python 300 s, transporte Server 340 s y Client 360 s. SDK Web recibe el plazo del análisis y watchdog 120 s; inicio del SDK acotado separadamente a 60 s. CLI permite hasta 240 s; análisis comprueba sesión/catálogo y modelo hasta 25 s cada uno; estado sigue en 12 s. Variables locales antiguas siguen prevaleciendo: actualizar `.env` y reiniciar para cargar los nuevos plazos.

Web admite un análisis simultáneo por cliente; un segundo devuelve `web_busy`/503 antes de generar. El SDK puede cerrar su sesión compartida al recuperar errores, por lo que no se permiten dos inferencias sobre ella. Tampoco se refrescan cuotas durante inferencia: se devuelve la observación aún vigente o datos desconocidos; una lectura de cuota ya iniciada termina antes de generar. En cancelación se cierra el transporte antes de cancelar/esperar la tarea de generación: `curl_cffi.Response.aclose()` espera su transferencia y podía prolongar el deadline. La tarea se recoge y la siguiente solicitud debe reconectar. Aumentar el plazo no garantiza una respuesta de Google; autenticación y catálogo accesibles no certifican inferencia. Ver [incidencia y evidencia](../docs/mvp/19-prelaunch-review.md).

Las cuotas Web conservan su origen y `observed_at`, con caché de 30 s y una lectura compartida para consultas concurrentes. Las consultas fallidas y las sesiones sustituidas no presentan datos anteriores como recién observados. No asignar cuotas Web al motor Antigravity.

## Pruebas sin Google

```powershell
.\.venv\Scripts\python.exe run_tests.py
.\.venv\Scripts\python.exe -m pip check
```

En Linux usar `./.venv/bin/python`. `run_tests.py` instala el aislamiento **antes del descubrimiento**: bloquea red externa, sustituye clientes/navegador por defecto y redirige `.env`, perfil, cookies y caché SDK a directorios temporales. Cada test que necesita un cliente define su simulación. Mantener `unittest`. La integración con cuenta real debe ejecutarse por separado y con una sesión de prueba explícita.

`pip check` comprueba consistencia, no vulnerabilidades. Auditar el manifiesto con `pip-audit --no-deps --disable-pip -r requirements.txt` desde herramientas separadas. Registrar avisos, paquetes no auditables y fecha; no instalar automáticamente una versión incompatible para silenciar un aviso.

## Contenedor y VPS

Compose utiliza usuario UID/GID **10001**, token privado, `init`, cierre ordenado, límites de CPU/memoria/procesos y temporales en tmpfs acotados. Los valores iniciales requieren medición en el VPS; ajustar memoria, CPU, shm y disco según capacidad. Preparar permisos de los directorios persistentes para ese UID/GID antes de arrancar; no cambiar ni borrar el perfil para resolver un fallo de permisos. Comprobar acceso de lectura a `.env` sin copiarlo dentro de la imagen.

El puerto se publica únicamente en `127.0.0.1:8000`. Si NestJS también corre en Docker, usar red compartida y retirar `ports`; mantener salida a Google. El proxy público de Server también debe limitar tamaño y tiempo de carga. El límite ASGI de Python funciona aunque no exista `Content-Length`, y la admisión ocurre antes de crear temporales/parser multipart.

Se verificaron construcción y arranque Linux sin red, sin cookies ni volúmenes operativos, con UID 10001 y limpieza de temporales. Las 57 pruebas aisladas pasaron en Windows y Linux. Consultar el [runbook](../docs/mvp/18-security-deployment-runbook.md). Pendientes de evidencia: construcción/arranque Linux con volúmenes reales, cuota de disco para perfil/sesión, prueba externa de aislamiento, login remoto privado, renovación tras inactividad, restauración y viabilidad Antigravity Linux/VPS. `/health` del contenedor no demuestra sesión válida ni soporte dual.

## Operación Agentic

Instalación versionada, variables `ANTIGRAVITY_CLI_*`, login, créditos adicionales desactivados, límites, hooks de lectura/finalización y rollback: [runbook](../docs/mvp/agentic-cli-runbook.md). Server utiliza las rutas agénticas explícitas manteniendo Client intacto. El CLI puede realizar varios turnos o correcciones de esquema dentro de una ejecución; Nodia no reenvía automáticamente la factura tras un fallo agéntico. Evidencia actual: 76 pruebas Python en Windows y Linux, integración HTTP con fixtures y sesión CLI real/PNG/PDF; regenerar imagen tras cambios antes de desplegar. La evidencia histórica de 57 pruebas anterior no cierra operación con cuenta Linux/VPS.


## NodiaAI AI-11/AI-12: conversación y perfil compartido

El adaptador privado incorpora `POST /nodia-ai/{web|agentic}/observe` y
`POST /nodia-ai/{web|agentic}/turn`. Requieren la misma credencial interna;
no se exponen al navegador. Server valida conexión, catálogo, modo y generación
configurada antes del transporte. El cuerpo privado está acotado antes del parser
(300.000 bytes; contexto UTF-8 máximo262.144 bytes), y la respuesta de chat acepta
como máximo32.768 bytes de texto. Estos son presupuestos Nodia, no cuotas Google.

- Web devuelve `answer` o una solicitud tipada `delegation_request`; no recibe
  herramientas MCP, SQL ni autorización para ejecutar cambios.
- Agentic recibe historia canónica en un home/cwd descartables y política cerrada.
  Sin herramientas, MCP queda vacío y el hook global permite sólo `finish`. Con
  herramientas registradas por Server, el supervisor admite exclusivamente ese
  catálogo y `finish`; shell, archivos, HTTP y subagentes permanecen denegados.
  El resultado exige recibo del hook, modelo exacto y cierre del proceso.
- El loop MCP privado usa `POST /nodia-ai/agentic/mcp/start` y
  `/nodia-ai/agentic/attempts/{attempt_id}/mcp/{events|results|cancel|attest}`.
  Server consulta eventos y entrega resultados; no existen callbacks por URL ni
  acceso directo del CLI a Server, credenciales internas o la BD. El puente stdio
  usa IPC temporal supervisado. El presupuesto por intento es de128 mensajes RPC,
  12 solicitudes de herramienta y64KiB por mensaje. Cada `tools/call` consume una
  solicitud antes de validar el envelope, argumentos, permisos o replay; el intento13
  termina el puente sin reenviar un callback. El inicio admite hasta400.000 bytes
  por su catálogo.
- Cada evento RPC incluye `tool_requests` acumulado. El polling privado publica
  `unforwarded_tool_requests`: solicitudes totales menos callbacks emitidos hacia
  Server, incluidos rechazos y replays resueltos dentro del puente. Server valida
  monotonía por intento y reserva sólo el delta oculto en el presupuesto SQL común
  del run; cada callback visible reserva su solicitud en una transacción separada
  antes de validar o recuperar un resultado previo. Un rechazo posterior no revierte
  ese consumo. La idempotencia evita repetir efectos, sin conceder solicitudes gratis
  ni reiniciar presupuesto al cambiar de etapa.
- AI-12 registra únicamente consulta técnica de conocimiento autorizado. Las
  herramientas de negocio siguen AI-14. `supports_mcp` permanece falso hasta una
  prueba explícita completa del loop con CLI real, hook validado y callback; la
  certificación en memoria vincula perfil, sesión, modelo, esfuerzo, generación
  de configuración y protocolo. Reiniciar o cambiar esa identidad la invalida;
  observar sesión/catálogo no ejecuta la prueba ni habilita herramientas.
- Cada intento tiene identidad UUID y se admite una sola vez. El índice de proceso
  está acotado a10.000 intentos y exige drenar/reiniciar al agotarse. Un recibo mínimo
  persistente impide admitir otra vez un intento aún no conciliado tras reinicio;
  PostgreSQL conserva la identidad durable y los fences. No reintentar inferencias.
- `observe` comprueba sesión, catálogo exacto, versión de protocolo y opciones
  disponibles. Es elegibilidad del transporte, **no una nueva inferencia real
  verificada**, certificación MCP o aceptación de despliegue. Configuración,
  sesión e inferencia continúan siendo evidencias diferentes.

`profile_admission.py` identifica el perfil físico mediante un hash de su ruta
resuelta normalizada por el sistema operativo. Dos conexiones que apunten al mismo
perfil no obtienen capacidad adicional. Chat, OCR, login, descubrimiento, refresh
y logout comparten esa puerta; Web y Agentic conservan capacidad independiente
cuando sus perfiles son distintos. El login mantiene su reserva hasta el cierre
real de la tarea, incluso al cancelar antes de su primera instrucción. Discovery
Agentic ejecuta los comandos no generativos en serie contra ese perfil.

AI-38, 2026-10-22: salud y elegibilidad Agentic usan el contexto explícito
`observation`, con FIFO por perfil físico, un dueño y hasta cuatro esperas.
Sus presupuestos totales de12/18s incluyen espera y comprobación; la limpieza
del CLI debe terminar antes de liberar y puede exceder ese plazo de trabajo.
Cada solicitud revalida su selección, sin compartir resultados entre modelos.
`operation`/`reserve`, login, ejecución y cuarentena siguen siendo exclusivos y
rechazan ocupación real. Las etiquetas de propósito sólo instrumentan al dueño;
no conceden capacidad. Los eventos cerrados acquire/wait/reject/release incluyen
nonce de reserva y duración, sin ruta/hash de perfil, cuenta, modelo o mensajes.
Ver [ADR-071](../docs/architecture/decisions/ADR-071-bounded-agentic-profile-observations.md)
y la [aceptación y límites de esta época](../docs/evidence/nodia-ai-ai38-profile-reservation-r01.md):
recargas verificadas; el canario MCP falló conciliado y no reatestó modalidades.

Continuación AI-38 del mismo día: el [nuevo canario y la revalidación por modo](../docs/evidence/nodia-ai-ai38-mcp-post-list-r01.md)
acreditan MCP y PNG/PDF/WAV/WebM Agentic en FIX073f, sin restart o cambios de
adaptador/permisos/modelo. El rechazo RPC previo a initialize no impide el nuevo
éxito y no demuestra la causa del timeout histórico. Web registra tres timeouts
de generación sin candidata, también en PNG; cada cierre renueva el cliente e
invalida sus pruebas anteriores. La última generación Web no acredita formatos,
aunque sesión/catálogo sean observables. Sus positivos anteriores son históricos;
mantener desconocido y cierre/ACK, sin reparar JSON o repetir inferencias.

Antes de una generación se escribe un marcador mínimo `.unknown` en
`session_state/runtime_admission/`. Una respuesta validada lo elimina. Error,
cancelación o caída después de despacho conservan la cuarentena también tras un
reinicio del servicio y bloquean a los consumidores antiguos del mismo perfil.
El marcador no contiene mensajes, credenciales ni IDs de negocio. El recibo nativo
añade únicamente identidad de intento/recurso/sesión, resultado técnico y prueba
de cierre. El envelope privado de respuesta incluye esa prueba fuera del texto
del modelo. Server la valida y agenda su acuse sólo tras confirmar el resultado en
SQL; `POST /nodia-ai/{web|agentic}/attempts/{attempt_id}/acknowledge` borra el recibo
y el estado efímero asociado. No guardar auditoría indefinida.

`POST /nodia-ai/{web|agentic}/attempts/{attempt_id}/reconcile` devuelve únicamente
una prueba existente de operación completada o abandonada con procesos cerrados.
Debe coincidir exactamente con el intento, recurso, sesión y referencia originales;
no libera un perfil ocupado por otra operación. Un proceso caído antes de producir
esa prueba, o un marcador histórico sin identidad, sigue sin resolución automática.
No inferir cierre por PID ausente, TTL, borrado de chat o reinicio; la recuperación
manual y su interfaz siguen AI-20/37. Los ensayos aislados comprueban reinicio de
proceso, no pérdida de energía.

Se conserva un worker Python por instancia y un único dueño operativo por perfil.
El CLI manual/`auth.py` no puede ejecutarse concurrentemente por fuera de esta puerta.
No escalar réplicas compartiendo volúmenes hasta incorporar coordinación entre
procesos. Server utiliza leases durables para los workers NodiaAI; el mutex Python
no sustituye esos fences ni la autorización del actor.

Validación aislada2026-10-15:235 casos Python,233 correctos y dos omisiones
históricas de symlinks en Windows; Linux235/235 en imagen final aislada con red
deshabilitada y sin montar cuentas;55 casos del bridge Server correctos. Incluye
stdio real con proceso fixture, presupuestos, cierre/cancelación, conciliación y
acuse. No equivale a inferencia con cuenta ni aceptación del loop Gemini real;
registrar ese resultado y su selección exacta en la evidencia de integración.

El supervisor emite `nodia_ai_mcp_terminal` con fase, clase de excepción acotada,
duración y contadores de RPC/callback/proceso/hook. El observador conserva sólo
metadatos estructurales; no registra prompts, texto del modelo, argumentos,
credenciales, stderr ni mensajes de error nativos. Un timeout sin estos datos no
permite atribuir el fallo al proveedor, al descubrimiento o al retorno MCP.

El catálogo confiable de herramientas también se adjunta explícitamente al prompt
con nombres y schemas exactos; no crea aliases ni amplía permisos. Cualquier
denegación del hook invalida el resultado final aunque el CLI reporte SUCCESS.
`gate-diagnostic.jsonl` sólo conserva categorías fijas de rechazo en el directorio
temporal, junto al recibo cerrado de dos campos; ambos se eliminan al cerrar.

## Login durable de NodiaAI (AI-29/R01)

El login de NodiaAI utiliza un UUIDv4 de solicitud guardado por Server **antes** de
despachar. Los endpoints administrativos anteriores conservan su contrato; las
nuevas rutas privadas son `POST/GET /auth/login/requests/{uuid}` y
`POST /auth/login/requests/{uuid}/{cancel|ack}`. Agentic usa el mismo contrato bajo
`/agentic/auth/login`. Todas exigen token de servicio, `X-Nodia-Actor-Id` y
`X-Nodia-Provider-Id` canónicos (BIGINT exacto); iniciar exige además
`X-Nodia-Login-Expires-At`, fecha UTC del descriptor SQL. El plazo debe seguir
vigente y quedar a no más de310 segundos; no se renueva mediante un replay.

La identidad nativa es el UUID sin guiones. Consultar nunca inicia otro login.
Cancelar una solicitud desconocida crea un fence durable bajo el mismo lock de
admisión; un inicio retrasado no puede franquearlo. Un404 nunca significa cerrado.
`unknown` expresa ausencia de prueba y conserva el perfil en cuarentena. Agentic
mantiene `authorization_url` y `reason` explícitamente nulos cuando no proceden;
el enlace de autorización sólo vive en memoria y sale por el canal humano.
Visor, input y código de los jobs durables usan las rutas anteriores por job ID y
actor exactos, a través de un socket Unix privado del supervisor.

`session_state/login_requests/` contiene únicamente el journal operativo:
actor/proveedor/motor, UUID, plazo, identidad de perfil, certificado de proceso,
identidad de cgroup y candidato/prueba terminal. No contiene mensajes, URL de
autorización, códigos, cookies, claves, capturas ni payloads humanos. Directorio700,
archivos600, escritura atómica y fsync; schema cerrado, lectura acotada y lock
entre procesos no bloqueante con espera async máxima de un segundo. Se permiten
hasta128 registros: incertidumbre o falta de acuse saturan la admisión de forma
explícita, sin borrar pruebas pendientes. ACK sólo se envía después del commit SQL;
es idempotente, retira el cgroup vacío y conserva el fence mínimo hasta vencer el
plazo original. Entonces puede podarse al admitir otra solicitud. Una cancelación
sin despacho conserva sólo su fence durante310 segundos. Los estados inciertos
nunca se borran por TTL.

Cada login tiene un supervisor local separado. La API guarda la identidad de su
cgroup y mueve el proceso **antes** de liberar el gate de ejecución. Chromium,
crashpad y el CLI/PTY heredan esa contención aunque creen sesiones o grupos nuevos.
El supervisor guarda un candidato al terminar; sigue sin ser prueba terminal.
El observador sólo publica el resultado tras comprobar `cgroup.events populated0`;
cancelación o crash cierran primero el árbol con `cgroup.kill`. Cancelado prueba el
cierre del intento, sin afirmar logout ni deshacer una autorización que ya haya
alcanzado el almacén de credenciales. No se modifica el sandbox de Chromium ni se
inyectan preloads/flags de crashpad/seccomp para sostener esta garantía.

El runtime Linux necesita cgroupv2 delegado por el helper privilegiado del host:
el **cgroup actual del contenedor**, con sus límites Docker intactos, se adjunta en
`/run/nodia-login-cgroups`. El contenedor no recibe Docker socket, capacidades de
administración, cgroup del host completo ni un servicio de red adicional. La prueba
`/run/nodia-login-containment.json` pertenece a root y es0444. Vincula root device,
inode y boot actuales; opcionalmente certifica raíces anteriores cerradas mediante
`closed_roots` acotado. El adaptador verifica esas identidades y el filesystem
real antes de admitir. Una ruta ordinaria, montaje faltante, identidad cambiada o
prueba insuficiente falla cerrado. Cambiar de namespace o faltar un PID **no**
prueba por sí solo el cierre de un contenedor anterior: hace falta la atestación
del host sobre su generación Docker y cgroup. La API no acepta claims de cierre.

La API puede reiniciarse sin perder el supervisor. Durante un login Web suspende
su SDK escritor de cookies; al volver a consumir relee el almacén canónico. El
startup también respeta la reserva del perfil antes de conectar Web/Agentic.

Verificación aislada: `python run_tests.py` usa dobles y prohíbe red/navegador real.
`NODIA_ISOLATED_NATIVE_TEST=1 python scripts/verify_durable_login.py` se ejecuta
separadamente en un contenedor efímero sin red ni cuentas, con el helper adjunto y
Xvfb. Usa PTY/CLI fixture y Chromium real, pérdida de respuesta, SIGKILL del dueño
HTTP y del supervisor, observación desde otra instancia y cierre del árbol. Esas
pruebas no acreditan autenticación ni inferencia de una cuenta Gemini; esa evidencia
se obtiene por separado en Server y nunca exporta cookies o códigos.

Revalidación AI-32-R02: las pruebas se separan por MIME realmente decodificado; WAV no autoriza WebM/Ogg ni PNG autoriza JPEG/WebP. Chat y MCP exigen MIME exacto además de selección/sesión/perfil. Ausencia de prueba permanece desconocido, sin transcodificación ni fallback. Los resultados actuales y límites de audio se registran en[entrega78](../docs/mvp/78-nodia-ai-ai32-attachments-voice.md#revalidación-ai-32-r02--formatos-de-audio-y-traslado-legacy); esta documentación no habilita capacidades.

Revalidación AI-32-R03: sólo NodiaAI Web solicita preservación literal de entidades HTML antes de Candidate, con verificación de huellas por cliente/tarea y resultado final; OCR conserva la semántica del SDK. No repara JSON. Upload/cadencia se observan sin contenido, IDs ni peticiones extra. La prueba privada de adjuntos usa /3; exige revalidar MIME/selección/sesión tras reiniciar. [R03 de entrega78](../docs/mvp/78-nodia-ai-ai32-attachments-voice.md#revalidación-ai-32-r03--entidades-html-y-diagnóstico-por-fase) conserva resultados y límites vigentes, sin atribuir los timeouts históricos a una causa no observada.

AI-32-R04: NodiaAI añade tipo de audio/MIME explícitos al descriptor de generación de los archivos ya subidos, sin repetir upload ni cambiar bytes/nombres/modelo. Scope por cliente/tarea, cardinalidad/alineación exactas y fallo cerrado ante shape inesperado; OCR/imagen/PDF/texto conservados. Prueba privada /4 obliga revalidar por MIME/selección/sesión. Captura previa al parser sólo de huellas/sintaxis acotadas por candidata elegida, sin contenido. WebM/Ogg pasaron dos frases con Gemini real; WAV/PNG/PDF y Agentic/MCP conservados. [R04 de entrega78](../docs/mvp/78-nodia-ai-ai32-attachments-voice.md#revalidación-ai-32-r04--clasificación-explícita-del-audio-web) distingue estos canarios de R2/micrófono físico y aceptación productiva aún pendientes.


## AI-34 — presupuesto y compactación de NodiaAI

[Entrega80](../docs/mvp/80-nodia-ai-ai34-long-context-compaction.md) y [ADR-059](../docs/architecture/decisions/ADR-059-nodia-ai-cited-context-compaction.md). `POST /nodia-ai/{engine}/measure-context` es un contrato interno autenticado, puramente determinista: no observa cuentas, abre SDK, genera inferencias ni materializa archivos. Acepta prompt canónico, catálogo autorizado y metadatos opcionales de adjuntos; no buffers ni credenciales. Los cuerpos de esta ruta tienen su límite propio de 2 MiB y plazo de recepción, sin ampliar los callbacks existentes.

Su respuesta cerrada `nodia-ai-context-budget/1` distingue el prompt inicial exacto (o cota superior explícita de las rutas Agentic aún no materializadas), bytes de catálogo/instrucciones, reserva superior separada para el primer listado MCP y tokens de modelo desconocidos (`null`). El constructor es compartido con ejecución; la frontera nativa comprueba siempre el prompt final exacto y no suma el techo independiente del catálogo para eludir los 256 KiB de Nodia.

El puente MCP contabiliza además cada respuesta JSON-RPC completa entregada al CLI, incluidos listados, errores y replays. Una reclamación persistente por intento impide reiniciar el contador al relanzar el puente; un marcador de fallo se comprueba antes de aceptar la respuesta final del CLI. El exceso rechaza contenido entero, sin truncado, replay automático ni reversión de callbacks ya confirmados. Los resultados inciertos conservan el supervisor y conciliación existentes. Los identificadores RPC tienen un límite propio validado para que la reserva del primer listado sea comprobable.

Este presupuesto abarca el contenido observable bajo control de Nodia. No demuestra la ventana de tokens ni el razonamiento/contexto privado del SDK/CLI, ni transforma tamaños de archivos multimodales en tokens. Binarios conservan sus límites de admisión e inspección separados. La compactación se ejecuta desde el worker con la selección exacta vigente y sin exponer herramientas; la memoria validada pertenece al backend, no a una sesión opaca del proveedor. Pruebas offline, SQL, cuenta real y activación se registran separadamente en la entrega80.

## AI-38 — Recuperación Web R04 y aceptación por época

La [investigación del stream Web](../docs/evidence/nodia-ai-ai38-web-stream-r01.md) y la [entrega técnica R04](../docs/evidence/nodia-ai-ai38-web-stream-recovery-r04.md) corrigen la coordinación entre watchdog y deadline exclusivamente en el chat/probes de NodiaAI. Para un presupuesto de 120 s, el watchdog se acota a 55 s mientras el caller conserva 120 s; el SDK puede leer el historial del mismo CID sin reenviar la generación. Timeout/watchdog originales se restauran siempre; OCR omite el argumento y mantiene su comportamiento. Las ramas de cola/análisis del SDK usan su timeout original y una respuesta tardía todavía puede agotar el plazo.

La construcción explícita del servicio deshabilita sólo el namespace de logs del SDK para evitar texto del proveedor o referencias privadas; conserva handlers y diagnósticos Nodia. Si una recuperación fallida cerró el transporte del cliente actual, sólo el nuevo flujo de chat invalida su flag inicializado; la próxima observación explícita reconstruye la generación. No se repite automáticamente el intento incierto. La prueba de privacidad falla al retirar únicamente la guarda del constructor, y vuelve a pasar con ella.

R04 está adoptada en la imagen `6b9e…`, época `2026-10-22T21:50:29.621768018Z`, con 49 fuentes Python, 496 pruebas Linux y 527 Windows, incluidas dos omisiones históricas. Se conserva la selección, el paquete Server, dependencias, configuración, mounts y perfil; las pruebas en memoria de épocas anteriores deben renovarse. Texto Web nuevo completo en 42,6 s/ACK sin recuperación; PNG nuevo falla con APIError a los 119 s, sin candidata pese a cinco lecturas de historial del mismo CID, y queda conciliado con ACK. La sesión Web actual no acredita formatos. MCP High completa un callback/nonce y ACK en 54 s; PNG/PDF/WAV/WebM Agentic pasan semántica, cierre y ACK en la misma sesión/época R04, sin pendientes. Un nuevo control Web completa texto en 4,67 s tras renovar su sesión, sin adjuntos ni recuperación; el texto correcto no acredita formatos. La continuación suma 12 generaciones, ocho completadas y cuatro desconocidas conciliadas con ACK, sin replay ni efectos comerciales. No se repitió aceptación UI, R2 o micrófono físico. AI-38 permanece parcial por Web y los demás gates; no se atribuye la causa del silencio upstream al parser, cuota o proveedor sin evidencia.

El inventario final conserva 49 fuentes Python, 42 distribuciones y el paquete Server owner-r01 de 3.879 miembros y 2.851 outputs dist. SQL permanece idéntico; API, worker y timers activos y cero pendientes nativos o SQL.

El [inicio de AI-39](../docs/mvp/85-nodia-ai-ai39-codex-runtime.md) y [ADR-072 propuesto](../docs/architecture/decisions/ADR-072-nodia-ai-provider-runtime-adapters.md) corresponden a contratos y canal privado de Codex en Server: base de 4.475 pruebas, 62 comprobaciones parciales e inicialización/thread nativos sin cuenta ni inferencia. No activan un runtime/adaptador Codex, nuevas herramientas ni UI en este microservicio, ni sustituyen la aceptación propia del proveedor.
