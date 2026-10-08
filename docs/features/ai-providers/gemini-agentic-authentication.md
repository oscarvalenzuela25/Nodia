# Autenticación Gemini Agentic desde Ajustes IA

Fecha: 2026-10-07. Implementación autorizada y comprobada con pruebas Windows/Linux y enlace OAuth real Linux. Autorización con cuenta y persistencia del VPS pendientes; sin aprobación automática de producción.

Nodia permite iniciar la sesión del CLI Agentic del servidor desde el navegador de otro equipo. Un Mac puede completar la autorización Google sin instalar Antigravity localmente. La sesión Web sigue siendo independiente. Esta funcionalidad no implementa OpenAI/Codex, que continúa en el [plan pendiente 33](../../mvp/33-chatgpt-integration-pending.md).

## Uso desde la aplicación

1. Abrir **Ajustes Generales → Proveedores de IA** y entrar al detalle de una conexión Gemini con Agentic habilitado.
2. Seleccionar **Token Plan (Agentic) → Autenticar sesión Agentic**.
3. Pulsar **Conectar cuenta Google**. Si la sesión del servidor ya se verifica, el intento termina sin cambiar la cuenta.
4. Si hace falta autenticarse, pulsar **Abrir inicio de sesión Google**, completar la autorización en Google y copiar el código que muestra el proveedor.
5. Pegar ese código en Nodia y pulsar **Validar código**. El CLI del servidor lo intercambia; Nodia verifica la sesión antes de mostrar éxito.
6. Sincronizar/configurar los modelos Agentic deseados. Autenticación no asigna modelos ni prueba una extracción.

La sesión Agentic es **compartida por todas las conexiones Gemini del microservicio**. Elegir otra conexión cambia modelos/preferencias, no la cuenta ni la cuota. El modal informa esta condición. Actualmente cambiar de cuenta es una operación administrativa del CLI; el botón verifica una sesión ya válida y no cierra otras cuentas automáticamente.

## Estados y recuperación

| Estado | Comportamiento |
|---|---|
| `running` | Comprueba credenciales actuales y prepara el flujo remoto si son necesarias. |
| `waiting_code` | Muestra el enlace oficial y permite pegar un solo código. |
| `verifying` | Espera la comprobación real no generativa del CLI; recibir el código no implica éxito. |
| `succeeded` | La sesión fue verificada; cierra el modal y revalida los paneles afectados. |
| `failed` | Conserva el modal e informa fallo/plazo; un nuevo intento genera un nuevo enlace. |
| `cancelled` | Los procesos propios se cerraron; cancelar un intento no revoca la cuenta. |

Un intento dura hasta cinco minutos. El mismo administrador puede recuperar su trabajo activo al reabrir el modal. Solo hay uno activo por microservicio; otro actor recibe conflicto. Los análisis Agentic reciben `agentic_busy` durante autenticación, sin cambiar a Web o API. Al terminar se invalida la observación anterior de sesión/modelos.

Un error HTTP al enviar código o cancelar conserva modal e input y permite reintentar. Un error de consulta muestra recuperación y detiene el polling fallido. La UI distingue petición aceptada, código enviado y sesión verificada, con feedback ES/EN. El código solo vive temporalmente en el formulario y el intercambio privado; no se persiste en configuración de proveedores.

### Alertas de salud y acciones de recuperación

El resumen y el detalle conservan alertas basadas en la comprobación del servicio, pero distinguen sus causas:

- Adaptador disponible sin sesión: aviso de sesión pendiente y **Autenticar sesión Agentic**, que abre el modal de autenticación sin editar el proveedor ni iniciar OAuth automáticamente.
- Adaptador no disponible en el servidor: alerta de indisponibilidad y **Volver a comprobar**, que consulta salud/estado; la configuración del CLI corresponde al servidor, no al formulario de la conexión.
- Estado no consultable o datos de estado ausentes: aviso de estado sin verificar y reconsulta, sin atribuir el fallo a la cuenta Google.
- Sesión comprobada y disponible: no generar alerta Agentic. Esto no prueba una extracción.

Contrato de alertas extendido con `authenticate_agentic`/`check_status`, `providerName` y categorías seguras de causa. Client traduce títulos, mensajes y acciones nuevos en ES/EN; acciones bloqueadas durante peticiones. No presentar botones sin un handler implementado. La acción anterior **Verificar Entorno → editar proveedor** se retiró. Los errores de reconsulta no muestran un toast de verificación exitosa.

Evidencia de esta corrección UI: 41 pruebas Client focalizadas (página, detalle y banner) y 14 del caso de uso de salud Server correctas; build/tipado/lint Client/Server e integración HTTP compilada correctos (Server mantiene dos warnings previos). QA autenticada en la página real encontró Web y Agentic disponibles y ninguna alerta Agentic; los escenarios de sesión faltante/servicio caído se verificaron con fixtures, sin provocar una caída ni modificar credenciales del usuario.

### Comprobación única de salud — 2026-10-07

Antes, Client consultaba `GET /ai-providers/health` para badges/alertas y `GET /ai-providers/gemini-engines` para paneles de sesiones. Solo la segunda consulta tenía polling; sus observaciones podían corresponder a momentos distintos y mostrar una sesión activa junto con una alerta anterior.

Ahora `GET /api/v1/ai-providers/health` incluye `engines: GeminiDualEngineStatus | null`, además de `timestamp`, `providers`, `alerts`, `summary` y `overallStatus`. Server utiliza una única observación privada `/engines/status` por petición para construir todos esos estados, compartida entre conexiones y modos. Incluye la observación de sesiones habilitadas aunque API sea el modo predeterminado; esto no verifica inferencia API. Si falla la consulta, devuelve `engines:null` y el estado desconocido correspondiente, sin inventar una sesión expirada.

Resumen, detalle, quotas y paneles de sesión usan la misma entrada de TanStack Query `ai-providers-health`, con revalidación cada 30 segundos. **Verificar estado** y **Volver a comprobar** reconsultan esa entrada una sola vez, con error/toast si falla. Login y cambios de configuración invalidan esa misma consulta. El detalle Agentic sin observación muestra **Estado agéntico sin verificar** y deshabilita sincronización. `gemini-engines` permanece compatible para otros consumidores; la pantalla Ajustes IA ya no lo consulta por separado.

Evidencia: 62 pruebas Client focalizadas (página, detalle, tarjeta, alertas y modales de login), 15 de salud y 22 de engines Server correctas; build/tipado/lint e integración HTTP compilada aislada correctos. El lint Server conserva dos warnings anteriores. Regresiones comprueban recuperación de badges/alerta/panel desde una sola respuesta, datos ausentes, diez conexiones con una consulta y API predeterminada con sesiones habilitadas. QA visual actual bloqueada por validación de sesión Nodia; no se reiniciaron servicios ni se cambiaron datos o credenciales. Salud/sesión autenticada no prueban extracción ni cuota disponible.

## Rutas y permisos

Prefijo público `/api/v1/ai-providers` (también alias `/api/v1/ai-provider`), con sesión Nodia y permiso `ai:manage`:

| Ruta | Entrada o respuesta |
|---|---|
| `POST /gemini-agentic-login/start` | Iniciar/recuperar el intento activo propio; devuelve el trabajo. |
| `GET /gemini-agentic-login/current` | `{job: <trabajo>}` o `{job:null}`. Nunca una respuesta HTTP vacía. |
| `GET /gemini-agentic-login/:jobId` | Estado solo para el dueño. |
| `POST /gemini-agentic-login/:jobId/code` | `{code: string}`; código sin controles, 8..2048 caracteres. |
| `POST /gemini-agentic-login/:jobId/cancel` | Cancela y espera limpieza de procesos antes de responder. |

Trabajo: `id` hexadecimal de 32 caracteres, `state`, `authorization_url` únicamente en `waiting_code` y `reason` nulo o un código seguro de fallo. Los resultados terminados se conservan como máximo hasta diez minutos desde la creación; no sobreviven al reinicio del microservicio.

Server adapta estas rutas a `/agentic/auth/login/*`. Solo Server accede a FastAPI mediante `X-Nodia-Service-Token`; `X-Nodia-Actor-Id` deriva del usuario autenticado, nunca del formulario. Su formato es el de `users.id`: cadena decimal positiva canónica, rango `BIGINT` PostgreSQL 1..9223372036854775807, conservada sin pérdida de precisión. No es un UUID. URLs, códigos y tokens no aparecen en logs/auditoría. Los estados de login usan `Cache-Control:no-store`; las respuestas externas se validan antes de llegar al cliente.

Un 422 privado por parámetros internos incompatibles se presenta como fallo de integración (502), no como código OAuth inválido. Solo `POST /:jobId/code` con la categoría explícita `X-Nodia-Error-Code:login_invalid_code` permite ese mensaje/422 público. FastAPI distingue errores exclusivamente en `body.code` de errores en el actor u otros parámetros sin publicar los inputs de validación.

## Operación del servidor y VPS

Diagnóstico de análisis ampliado el 2026-10-08: el log `Agentic inference progress` conserva categorías seguras del stream CLI aun ante timeout, sin contenido de documentos, rutas o credenciales. Distingue eventos de inicialización, lectura terminada y resultado observado; ninguno reemplaza la validación de extracción. Ver [incidencia correlacionada y pruebas](../../mvp/19-prelaunch-review.md#timeout-durante-inferencia-agentic--2026-10-08) y [runbook](../../mvp/agentic-cli-runbook.md#verificación-reproducible). Requiere cargar el microservicio actualizado; no resuelve ni reconstruye automáticamente el bloqueo de una petición anterior.

Instalar/configurar el CLI 1.3.1 verificado y un perfil dedicado bajo el usuario del microservicio. En Windows instalar los requisitos actualizados, que incluyen `pywinpty==3.0.5`; Linux utiliza PTY estándar. Reiniciar el microservicio después de actualizar código/dependencias porque `run.py` no usa recarga. NestJS y Client deben cargar esta versión de sus contratos.

En el VPS, publicar Nodia por HTTPS y conservar FastAPI en la red privada. No se necesita abrir un callback de Google en el VPS: el flujo remoto oficial muestra el código en su callback. El CLI del servidor debe poder acceder a Google y a su almacén de credenciales bajo el mismo usuario con el que ejecutará los análisis. Preparar almacenamiento persistente protegido y comprobarlo antes de producción; montar solo el perfil no acredita que todo el almacén del CLI sobreviva a recrear un contenedor. No copiar credenciales Windows para autenticar Linux.

Un worker es obligatorio para mantener ownership, exclusión y jobs coherentes. El Compose base conserva Agentic desactivado; el override prepara su configuración y perfil. La validación del perfil admite rutas fuera de `/app` en contenedor y sigue rechazando el workspace de Nodia en host. Ver [runbook de instalación, persistencia y rollback](../../mvp/agentic-cli-runbook.md).

## Garantías de regresión y evidencia

- No modificar modelos elegidos, `fields`, claves API, modo predeterminado ni catálogo por iniciar sesión.
- No reutilizar Web ni inferir disponibilidad a partir de una configuración guardada.
- Rechazar otro actor, enlaces ajenos, estados incompletos, códigos con controles, cuerpos/respuestas excesivos y doble envío.
- Cancelar/plazo/shutdown limpian procesos y temporales y permiten otra operación, también ante cancelación inmediata antes de ejecutar la tarea.
- Mantener modal/código ante errores HTTP y deshabilitar controles durante peticiones; comprobar apertura desde el panel Agentic.

Pruebas aisladas: runner Python Windows/Linux, caso de uso NestJS y `node test/agentic-cli.integration.mjs` con guards y HTTP compilado reales, y tests de componentes Client. CLI real Linux: enlace Google OAuth válido y cancelación con cero procesos/temporales propios restantes. No se autorizó una cuenta en ese contenedor ni se consumió cuota.

Evidencia de entrega: **108 pruebas Python Windows y 108 en la imagen Linux final**, imagen construida bajo UID 10001 con CLI verificado, `pip check` correcto en ambos entornos, **29 pruebas del caso de uso de login Server** y HTTP compilado aislado correctos. **905 pruebas Client/154 archivos** y 37 focalizadas de modal/detalle correctas; tipado/lint/build Client/Server correctos (Server conserva dos warnings anteriores). La suite general Server ejecutada antes de añadir la última prueba de límite de respuesta arrojó 696 correctas/1 fallo preexistente de modelos API en `api-model-discovery.use-case.spec.ts`: se oculta un modelo guardado cuando el catálogo deshabilita API; este trabajo no modificó ese caso de uso. El primer intento global Client tuvo un timeout de carga lazy en contactos; pasó focalizado y en la repetición completa con tres workers. OSV no reportó advisories para la nueva dependencia pywinpty 3.0.5; esa consulta no audita todo el runtime.

QA autenticada en `/settings/ai-providers`: botón Agentic y modal visibles, información de sesión compartida y recuperación ante error comprobadas. El proceso Gemini del usuario aún servía la versión anterior (`GET /agentic/auth/login/current` → 404); requiere reinicio para completar el flujo UI con esa cuenta. No se reiniciaron servicios del usuario ni se modificó la BD.

Pendiente en entorno destino: intercambio con cuenta Google, verificación e inferencia tras login, reinicio/recreación con credenciales protegidas y renovación/revocación prolongadas. Estos controles no se cierran con mocks ni con la sesión Windows existente. Decisión en [ADR-017](../../architecture/decisions/ADR-017-gemini-agentic-remote-login.md); contrato permanente en [funcionalidades IA](../../mvp/ai-provider-feature-contract.md).

### Corrección del 422 en intento actual — 2026-10-07

El usuario reportó 422 en `GET /gemini-agentic-login/current`. Causa confirmada en código y reproducida por regresiones: las cinco rutas privadas esperaban UUID aunque `User.id` es `BIGINT`/string; los fixtures UUID anteriores ocultaban la incompatibilidad. Se corrige el contrato del actor y la clasificación errónea de todos los 422 como código inválido. Las pruebas cubren IDs pequeños, máximo PostgreSQL, IDs adyacentes superiores a `Number.MAX_SAFE_INTEGER`, entradas no canónicas y actor ausente, conservación exacta en las cinco rutas y aislamiento del gestor por dueño.

Evidencia de esta corrección: **111 pruebas Python en Windows y 111 en Linux** correctas; Linux ejecutado sin red, con los tres archivos modificados montados de solo lectura sobre la imagen de verificación existente, sin reconstruirla. **36 pruebas del caso de uso de login Server**, build, lint (dos warnings previos) e integración HTTP compilada con guards correctos. La consulta privada al proceso del usuario todavía respondió 422 antes de reiniciarlo: `run.py` no recarga código. Reiniciar Gemini y cargar Server actualizado; si se despliega con Docker, reconstruir la imagen. No se cambiaron BD, credenciales ni servicios del usuario. Estas pruebas no completan el intercambio Google de su cuenta ni la operación del VPS.
