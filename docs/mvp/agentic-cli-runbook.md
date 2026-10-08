# Operación del motor Agentic mediante el CLI oficial

Fecha: 2026-10-07. Estado: implementación local comprobada; operación con cuenta Linux/VPS, renovación prolongada y revocación real pendientes. No constituye aprobación de producción.

## Identidad y configuración

El microservicio comparte **una sesión Google** entre las conexiones agénticas. Los IDs de conexión conservan sus modelos y preferencias; no crean otras cuotas ni cuentas. El login Web de Ajustes continúa siendo Web. La sesión CLI se administra bajo el usuario del servicio, fuera del repositorio; no se guardan credenciales CLI en BD, `fields` o respuestas HTTP.

Se fija el CLI oficial **1.3.1** mediante `nodia-gemini-microservice/antigravity-cli.lock.json`: URLs, SHA512 del artefacto y del binario Linux. El ejecutor verifica hash/version al arrancar y rechaza cambios posteriores del binario. El instalador no ejecuta scripts remotos ni sustituye otro binario diferente.

Instalación Windows desde la carpeta del microservicio:

```powershell
.\.venv\Scripts\python.exe scripts/install_agentic_cli.py --platform windows_amd64 --destination "$env:LOCALAPPDATA/Nodia/antigravity-cli/1.3.1"
```

Configurar en el `.env` privado únicamente:

```dotenv
ANTIGRAVITY_CLI_PATH=C:/ruta/dedicada/1.3.1/agy.exe
ANTIGRAVITY_CLI_SHA512=<sha512 de verified.json>
ANTIGRAVITY_CLI_HOME=C:/ruta/dedicada/profile
ANTIGRAVITY_CLI_TIMEOUT_SECONDS=240
```

Las rutas son absolutas. El perfil debe estar fuera de Nodia y ser distinto del HOME habitual. La configuración exige los tres primeros valores; sin CLI configurado permanece `session_adapter_unverified`. Un binario inválido no inicia inferencia ni habilita sesión.

## Login y recuperación

Con el CLI configurado y el servicio iniciado, abrir **Ajustes IA → detalle Gemini → Token Plan (Agentic) → Autenticar sesión Agentic**. Pulsar Conectar, abrir el enlace Google desde el navegador del operador y pegar en Nodia el código mostrado por Google. El CLI del servidor realiza el intercambio bajo el usuario del microservicio; no requiere navegador gráfico en el VPS ni instalación en el Mac. Si ya hay una sesión verificada, termina sin cambiar cuenta. Ver [funcionalidad, contratos y recuperación](../features/ai-providers/gemini-agentic-authentication.md) y [ADR-017](../architecture/decisions/ADR-017-gemini-agentic-remote-login.md).

Después de actualizar, instalar `requirements.txt` y reiniciar el microservicio sin recarga. Windows requiere `pywinpty==3.0.5`; Linux usa PTY estándar. Verificar almacenamiento protegido y persistente de credenciales bajo el UID del servicio antes del primer login en el VPS. El enlace real del CLI se comprobó en Linux, pero intercambio OAuth, persistencia tras recrear contenedor e inferencia con cuenta Linux siguen pendientes. No habilitar el modo API. Mantener **Use G1 Credits desactivado**: Nodia escribe `useG1Credits:false` en su perfil y en cada contexto temporal para impedir fallback a créditos adicionales. [Autenticación oficial](https://www.antigravity.google/docs/cli/install/), [configuración oficial de créditos](https://www.antigravity.google/docs/cli/credits/).

Alternativa operativa: detener admisión/trabajos y abrir el CLI interactivamente con `HOME` y `USERPROFILE` apuntando al perfil dedicado, bajo el mismo usuario y desde esa carpeta. No ejecutar `/logout` para una prueba: puede purgar credenciales globales. El nuevo botón no implementa revocación ni cambio de cuenta.

Windows local reutilizó la sesión disponible mediante el CLI y el almacén de credenciales del sistema; Nodia no leyó ni copió tokens. No asumir que esos tokens autentican Docker/Linux u otro usuario. El contexto temporal vuelve a resolver la autenticación mediante el CLI; no copia el perfil compartido.

Para renovar o cambiar cuenta: detener admisión/trabajos, administrar la sesión mediante el CLI oficial y reiniciar el servicio para invalidar observaciones anteriores. No borrar credenciales globales para realizar una prueba. Si `/agentic/ready` devuelve 503, consultar el `reason` seguro de `/agentic/status`; no sustituir el motor por Web. Una sesión autenticada y un modelo descubierto permiten intentar inferencia, pero no certifican acceso a todos los modelos ni disponibilidad de capacidad.

## Rutas, límites y seguridad

Todas las rutas salvo `/health` requieren `X-Nodia-Service-Token`, compartido exclusivamente con Nodia Server. En host, loopback; en contenedor, red privada/loopback. El frontend conserva sus rutas y opciones. Server envía la extracción a **`/agentic/analyze-invoice`** y verifica el mismo adaptador utilizado por health/modelos/sync.

- `/usage` headless JSON y `agy models` son las fuentes de sesión/cuota y catálogo observadas en 1.3.1. Los reportes de `/usage` y `/model` se aceptan solo con **cero turnos y cero tokens**. No enviar un prompt generativo para salud.
- Estado/modelos: dos consultas acotadas a 12 s, caché de 30 s y una lectura compartida entre callers concurrentes. Server espera hasta 15 s; la salud de varias conexiones comparte un estado dual. Análisis reutiliza esa observación reciente de la misma sesión; si expiró, comparte/refresca la lectura con hasta 25 s. No invalida una comprobación recién hecha por verify para abrir otros dos procesos. El CLI autentica cada ejecución y `/model` sigue comprobando el ID/esfuerzo. El arranque realiza un calentamiento no generativo. Fallos eliminan el catálogo anterior; el login UI invalida observaciones al comenzar/terminar. Cambio de cuenta externo requiere invalidación/reinicio.
- Login Agentic: `/agentic/auth/login/*` requiere también `X-Nodia-Actor-Id` derivado de la sesión Nodia y protege ownership; Nodia Server exige `ai:manage`. Un intento activo hasta 300 s, resultados hasta 600 s desde creación y sin cola de logins. Cancelar espera el cierre propio antes de liberar admisión. El análisis Agentic permanece bloqueado durante autenticación; Web no cambia. En producción usar HTTPS para Nodia y mantener FastAPI privado. No publicar PTY, VNC ni un puerto de OAuth.
- Modelo exacto de descubrimiento. Low/Medium/High se transportan a `--effort` solo cuando fueron elegidos/configurados. `/model` comprueba que ese esfuerzo conserve el mismo ID antes de inferencia. Si exige otra variante, seleccionar esa variante explícitamente; no reemplazar IDs automáticamente. `extended_thinking` pertenece a Web.
- Un análisis por motor a la vez, sin cola de generación. CLI máximo 240 s (+2 s de transporte/cierre), comprobaciones de sesión/catálogo y modelo de análisis de hasta 25 s cada una, pipeline común de 300 s, upload 30 s, Server 340 s y Client 360 s; stdout/stderr acotados a 2 MB cada uno. Estado mantiene sus 12 s. La configuración CLI acepta de 1 a 240 s; superar ese rango falla al arrancar. Timeout puede dejar consumo remoto incierto: no reintentar automáticamente. Los plazos son límites de Nodia, no latencias prometidas del proveedor.
- Documento de solo lectura, contexto/perfil temporal propio y prompt por stdin. Permisos bloquean shell, escritura, URLs y MCP. El hook `PreToolUse` permite **solo `view_file` del documento exacto y `finish` para finalizar el resultado estructurado**; bloquea las demás herramientas, incluidas navegador, mensajes y subagentes. Exigir recibo de lectura permitida y ausencia de denegaciones antes de aceptar un borrador. [Hooks oficiales](https://www.antigravity.google/docs/hooks/).
- En Windows, un lanzador de confianza espera una señal hasta quedar asociado al Job Object; usar directamente el intérprete base evita la carrera del redirector de `.venv`. Cerrar el Job mata descendientes. En Linux se termina el grupo de procesos. Esto controla ownership/limpieza; no afirma aislamiento OS de todo el host Windows.
- Temporales/historial del análisis se eliminan al terminar, fallar o cancelar. No registrar stdout, stderr, razonamiento, contenido de factura o credenciales. Ante cierre abrupto del host revisar temporales huérfanos bajo el perfil dedicado, nunca eliminar perfiles/archivos ajenos.

Las cuotas vienen de buckets reales, conservando ID/grupo/ventana/fecha. `usage_percentage=100*(1-remaining_fraction)`; unidades/cupos no entregados permanecen nulos. No sumar ventanas de cinco horas/semanales ni identificar modelos por su nombre. Server valida `quota_source:agentic_cli`, autenticación y antigüedad. La UI existente mantiene sus paneles actuales; este cambio no añade un visor de cuotas agénticas.

## Verificación reproducible

Para probar análisis largos en desarrollo, usar `npm run start` dentro de `nodia-server`, después de detener su `npm run dev` desde la terminal del operador. `start` compila/ejecuta sin watch; `dev` usa `nest start --watch` y puede reemplazar el proceso cortando peticiones activas. Mantener Vite/Gemini activos y no compilar ni modificar Server mientras se ejecuta el análisis. Un 502 vacío en Vite con `ECONNRESET`, más `499 client_disconnected`/`outcome=interrupted` en Gemini, indica interrupción del transporte; comprobar vida/reinicio del backend y no atribuirlo automáticamente al timeout del CLI. Ver [seguimiento del reset](19-prelaunch-review.md#nueva-solicitud-interrumpida-por-transporte--2026-10-08).

Diagnóstico de timeout de inferencia: después de cargar la versión del 2026-10-08, buscar `Agentic inference progress` junto a `Agentic inference finished` y la línea `request=...`. El resumen conserva eventos parciales aun si el proceso agota 242 s. `stage`, `document_read_completed`, `result_seen`, `events`, `invalid_lines`, `stdout_bytes` y `last_event_age_ms` describen solo eventos observados, no disponibilidad/cuota ni éxito de extracción. `result_seen:true` con timeout orienta a cierre/transporte; una lectura terminada sin resultado orienta al turno posterior. Las líneas inválidas o mayores de 64 KiB no se interpretan para diagnóstico. No compartir logs brutos del CLI ni contenido de la factura. Reiniciar el microservicio tras cambiar código porque `run.py` no recarga; la incidencia y límites de evidencia están en [revisión técnica](19-prelaunch-review.md#timeout-durante-inferencia-agentic--2026-10-08).

```powershell
# Sin cuentas ni red externa
.\.venv\Scripts\python.exe run_tests.py
# Desde nodia-server: HTTP real con persistencia/auth sintéticas
npm run build
node test/agentic-cli.integration.mjs
```

La integración **con cuenta real** se ejecuta por separado:

```powershell
# Configurar explícitamente ANTIGRAVITY_CLI_PATH/SHA512/HOME en el proceso.
# PROBE_MODEL debe ser un ID descubierto elegido; no existe un fallback.
# PROBE_PNG / PROBE_PDF son documentos sintéticos POC-0710 con un producto,
# cantidad 3, precio 2500 y total 7500; no usar facturas privadas por accidente.
node test/agentic-cli.integration.mjs --live-cli
```

Este script arranca FastAPI y NestJS en puertos temporales, usa credencial interna aleatoria, Web deliberadamente caído y repositorio en memoria. Comprueba aliases, autenticación, salud, modelos, sync con/sin persistencia y conservación de los otros modos, verify y análisis de ambos archivos. No lee `.env` ni conecta a la BD de Nodia. Tiene cierre privado/graceful de la instancia de prueba. En Linux definir `PROBE_PYTHON` con el intérprete del entorno.

Evidencia Windows: extracción PNG/PDF correcta por adaptador y por NestJS/FastAPI; 14 IDs descubiertos en la cuenta observada (cantidad variable), `/usage` no generativo, `/model` Low/Medium/High conservando IDs correspondientes; canarios sintéticos de lectura externa/shell/escritura rechazados. Las suites unitarias no consumen cuota. No se revocó la cuenta real ni se confirmó una factura/stock.

QA autenticada en Ajustes IA: listado y detalle cargan sin error de importación dinámica; Mi gemini informa sesión Agentic conectada y muestra Low/Medium/High. Su modelo agéntico permanece sin asignar y el catálogo de ese modo aún no está sincronizado; no se eligió un modelo por el usuario ni se modificó la BD en esta comprobación.

## Linux/VPS y rollback

La imagen contiene el CLI Linux verificado y corre con UID 10001. **El Compose base no activa Agentic**. El override `docker-compose.agentic.yml` define binario/hash/perfil persistente; preparar almacenamiento protegido bajo ese usuario, iniciar el servicio y completar login desde Ajustes. Un montaje del perfil no acredita persistencia de todo el almacén que utilice el CLI. No montar el repositorio, perfiles Windows ni archivos Web dentro del workspace del agente. Verificar credenciales, permisos, disco, reinicio/restauración y canarios con cuenta Linux antes de producción. La validación de rutas trata `/app` como workspace del contenedor y sigue protegiendo el monorepo completo en host.

Se comprobaron construcción Linux, binario/version y pruebas aisladas sin red. Esto no acredita autenticación ni inferencia Linux. Las pruebas reales de renovación tras inactividad, revocación, restauración y extracción desde la pantalla con la cuenta del entorno destino continúan abiertas en el plan 32.

Rollback local: retirar únicamente las cuatro variables `ANTIGRAVITY_CLI_*` nuevas, o restaurar sus valores anteriores, y reiniciar el microservicio. En Docker, volver al Compose base. Agentic informa indisponibilidad; Web conserva su sesión y las conexiones/modelos/claves permanecen en BD. No realizar migraciones destructivas ni delegar solicitudes Agentic a otro modo. La activación local guardó los valores CLI anteriores en `AppData/Local/Nodia/antigravity-cli/previous-cli-config.json`, fuera de Git y sin copiar otros secretos.
