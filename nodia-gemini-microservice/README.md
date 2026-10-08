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

`auth.py` / `login.bat` / `login.sh` abren Chrome en el host Python. También existe un trabajo HTTP interno de login para Settings en desarrollo: Server exige sesión Nodia, acción administrativa y entorno local. El navegador no recibe el token ni llama a FastAPI.

`.env` es la semilla; `session_state/` conserva cookies rotadas mediante reemplazo atómico y debe persistir junto con `browser_profile/`. Docker monta `.env` de solo lectura. No publicar un puerto ni un visor gráfico para suplir el login remoto: su procedimiento privado en VPS sigue pendiente.

**Agentic tiene una autenticación independiente desde Ajustes IA → Gemini → Token Plan (Agentic) → Autenticar sesión Agentic.** El servidor ejecuta el login remoto oficial del CLI; el operador abre el enlace Google desde su equipo y pega el código en Nodia. Solo Nodia Server consume `/agentic/auth/login/*`, con token interno e identidad del administrador. Estas rutas no dependen de `NODE_ENV=development` y no modifican la sesión Web; su operación con cuenta del VPS aún debe verificarse. Instalar los requisitos actualizados/reiniciar el servicio; Windows usa `pywinpty`, Linux PTY estándar. Ver [contrato de funcionalidad](../docs/features/ai-providers/gemini-agentic-authentication.md) y [persistencia/operación pendiente del VPS](../docs/mvp/agentic-cli-runbook.md). El almacén de credenciales queda bajo gestión del CLI.

La recuperación de autenticación Web reintenta un análisis **como máximo una vez**, con el mismo modelo descubierto y únicamente ante `AuthError`. Si el ID cambia tras renovar la sesión, se rechaza. Cuotas agotadas, modelo inválido, timeout y rechazo del documento no provocan otro análisis. Se desactivan los reenvíos internos de generación del SDK fijado `gemini-webapi==2.1.1` mediante `current_retry=0`, transmitido por `generate_content` a su decorador. El SDK todavía puede consultar el historial para recuperar una respuesta de la misma generación dentro del límite total. La regresión usa el método público y el decorador del SDK instalado sin red; repetirla al actualizar la dependencia. Un análisis cancelado puede haber sido aceptado por Google; no reenviarlo automáticamente.

## Contratos internos

Todas las rutas salvo `/health`, incluidas `/`, `/ready`, `/docs`, `/redoc` y `/openapi.json`, exigen `X-Nodia-Service-Token`.

| Ruta | Función |
|---|---|
| `GET /health` | Vida del proceso; no informa autenticación |
| `GET /ready` | Disponibilidad Web observada; 503 sin sesión |
| `GET /engines/status` | Estado separado de Web y Antigravity |
| `GET /auth/status`, `/web/status`, `/agentic/status` | Estado del motor indicado |
| `GET /models`, `/web/models`, `/agentic/models` | Catálogo descubierto, con identificador real |
| `POST /auth/login/start` | Inicia un único trabajo local |
| `GET /auth/login/{id}` | Consulta `running`, `succeeded`, `failed` o `cancelled` |
| `POST /auth/login/{id}/cancel` | Solicita cancelación; un nuevo trabajo espera la liberación del anterior |
| `POST /auth/refresh` | Recuperación de sesión privada |
| `POST /analyze-invoice`, `/web/analyze-invoice`, `/agentic/analyze-invoice` | Extracción con motor explícito o Web por defecto; las rutas de motor fuerzan su identidad |

Análisis: `multipart/form-data` con **un archivo** `file`, **modelo obligatorio** `model`, y hasta seis campos: `engine`, `provider_fields` (JSON objeto), `provider_tax` (0–100), `extended_thinking`, `thinking_level`, además del modelo. Las rutas específicas rechazan un motor contradictorio. Se rechazan campos duplicados, desconocidos y partes de configuración mayores de 16 KiB. Se admiten PDF/PNG/JPG/JPEG/WEBP con firma correcta y archivo dentro del límite.

El SDK Web actual descubre identidad/disponibilidad de modelos, pero no reporta contexto ni capacidades de razonamiento fiables. No se deducen del nombre. `supported_options.extended_thinking` comprueba la firma del SDK instalado y habilita el booleano de transporte sin inventar capacidades del modelo; `thinking_level` se rechaza en Web; no se ignoran opciones que el usuario creyó ejecutar.

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
