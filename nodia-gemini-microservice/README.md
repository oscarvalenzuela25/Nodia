# Nodia Gemini Microservice

Adaptador privado FastAPI de Nodia Server para extraer borradores de facturas mediante una sesión Gemini Web. No utiliza API keys ni facturación por token. Las cuotas, modelos y capacidades se muestran únicamente cuando el proveedor los reporta.

## Estado de los motores

- **Web:** usa cookies de una cuenta con acceso a Gemini, gestionadas con Playwright y `gemini-webapi`. El análisis exige un modelo explícito descubierto para esa sesión.
- **Antigravity:** devuelve `available: false`, `has_active_session: false`, modelos vacíos y cuota desconocida, con motivo `session_adapter_unverified`. Se retiró el camino del SDK que exigía API key y la delegación a Web. Falta verificar un adaptador real de sesión permitido; ver [ADR-009](../docs/architecture/decisions/ADR-009-truthful-gemini-engines.md). No se declara completado el soporte dual.
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
| `ANALYSIS_TIMEOUT_SECONDS` | Tiempo máximo de análisis, por defecto 130 s |

Los marcadores antiguos `ANTIGRAVITY_AGENT`, `ANTIGRAVITY_LS_ADDRESS`, listas adicionales y API keys no habilitan un motor. No es necesario borrar secretos del host para que queden ignorados.

## Sesión y login

`auth.py` / `login.bat` / `login.sh` abren Chrome en el host Python. También existe un trabajo HTTP interno de login para Settings en desarrollo: Server exige sesión Nodia, acción administrativa y entorno local. El navegador no recibe el token ni llama a FastAPI.

`.env` es la semilla; `session_state/` conserva cookies rotadas mediante reemplazo atómico y debe persistir junto con `browser_profile/`. Docker monta `.env` de solo lectura. No publicar un puerto ni un visor gráfico para suplir el login remoto: su procedimiento privado en VPS sigue pendiente.

La recuperación de autenticación reintenta un análisis **como máximo una vez**, con el mismo modelo descubierto. Si el ID cambia tras renovar la sesión, se rechaza. Cuotas agotadas, modelo inválido, timeout y rechazo del documento no provocan otro análisis. La librería mantiene sus propios mecanismos internos de transporte; verificar su comportamiento con la cuenta de prueba antes de producción.

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

El SDK Web actual descubre identidad/disponibilidad de modelos, pero no reporta contexto ni capacidades de razonamiento fiables. No se deducen del nombre. `extended_thinking` requiere capacidad explícita y `thinking_level` se rechaza en Web; no se ignoran opciones que el usuario creyó ejecutar.

La respuesta contiene `code`, `total_amount` y `data: {issue_date, items}`. Los números faltantes permanecen `null`; cero permanece cero. Importes/cantidades deben ser números finitos no negativos; no se convierten strings, booleanos, valores inválidos o datos faltantes en cifras válidas. `items` requiere al menos un producto con nombre y admite hasta 2000. Solo se deriva cantidad si falta y están presentes ambos factores de embalaje; no se redondea una cantidad fraccionaria. La revisión del borrador en Client calcula precios según el impuesto configurado; esta extracción no confirma stock ni factura.

Los errores incluyen `{code, detail, request_id}` con mensaje seguro; `X-Request-ID` permite correlacionar. Saturación/cuota: 429; sesión/motor no disponible: 503; timeout: 504; extracción inválida: 502; opciones/modelo incompatible: 422. Saturación incluye `Retry-After`; cuota solo incluye un plazo si se conoce. Server conserva la clasificación y el plazo sin reenviar texto bruto del proveedor.

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

Se verificaron construcción y arranque Linux sin red, sin cookies ni volúmenes operativos, con UID 10001 y limpieza de temporales. Las 57 pruebas aisladas pasaron en Windows y Linux. Consultar el [runbook](../docs/mvp/18-security-deployment-runbook.md). Pendientes de evidencia: construcción/arranque Linux con volúmenes reales, cuota de disco para perfil/sesión, prueba externa de aislamiento, login remoto privado, renovación tras inactividad, restauración y viabilidad Antigravity. `/health` del contenedor no demuestra sesión válida ni soporte dual.
