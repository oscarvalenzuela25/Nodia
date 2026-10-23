# Instrucciones del microservicio Gemini

## Fuente de verdad y alcance

- Leer primero `../docs/mvp/README.md`, `../docs/mvp/00-progress.md`, `README.md` y los ADR-005, ADR-007, ADR-008 y ADR-009 antes de cambiar contratos, sesión o despliegue. No marcar documentos en revisión como aprobados.
- Este proceso es un adaptador **privado** de Nodia Server. El navegador y Postman no llaman directamente a FastAPI. Mantener el token `GEMINI_SERVICE_TOKEN` fuera de respuestas, logs, frontend y Git; toda ruta salvo `/health` exige `X-Nodia-Service-Token`.
- En el host, escuchar en `127.0.0.1`. Si se usa Docker, escuchar en la interfaz del contenedor y publicar solo en loopback del host, o usar una red privada sin `ports` cuando NestJS también esté en Docker. CORS no concede acceso.
- Conservar los cambios ajenos del workspace y los secretos de `.env`, `browser_profile/` y `session_state/`. Nunca imprimir sus valores ni enviar estos archivos a ejecutores externos.

## Skills locales: cuándo leerlas y prioridad sobre Superpowers

> ⚠️ **PRIORIDAD ABSOLUTA:** Las skills locales de este microservicio (`skills/<nombre>/SKILL.md`) tienen **prioridad estricta sobre las de Superpowers o plugins externos**. Superpowers provee metodología general, pero la arquitectura de seguridad privada (ADRs, FastAPI, Python, aislamiento de perfiles/tokens) y las skills locales rigen siempre.

### Base de calidad obligatoria

Antes de desarrollar, corregir o revisar código, contratos, configuración, pruebas o despliegue de este microservicio, **leer y aplicar ambas skills**:

1. [backend-service-quality](skills/backend-service-quality/SKILL.md): garantías comunes de contratos, autorización, identidad, integridad, resiliencia, límites y evidencia de entrega.
2. [python-microservice-quality](skills/python-microservice-quality/SKILL.md): mecanismos Python de imports sin efectos operativos, lifecycle, tipos, async, cancelación, archivos, aislamiento de pruebas y runtime.

Son complementarias; una no sustituye a la otra ni a las skills específicas de la tabla. Leer las referencias que correspondan al cambio, sin ejecutar toda su matriz por rutina. Para documentación o metadatos, validar contenido, enlaces y consistencia sin iniciar sesiones, navegador o aplicación innecesariamente. No basta con mencionarlas en el informe: aplicar sus garantías en el código y mantener pruebas de regresión de valor cuando cambien comportamientos.

Las copias de `skills/` son las instrucciones ejecutables de este proyecto y deben funcionar sin acceso al repositorio personal. Su fuente reutilizable está en `C:\Users\Oscar\Desktop\skills\backend\backend-service-quality` y `C:\Users\Oscar\Desktop\skills\backend\python-microservice-quality`; mantener los cambios generales sincronizados con estas copias. Las restricciones de Nodia se mantienen aquí y en sus documentos/ADR, no dentro de las skills genéricas. No fabricar entradas en `skills-lock.json` para estas skills locales ni atribuirles un origen externo.

Leer el `SKILL.md` indicado **antes** de la tarea correspondiente y aplicar solo los patrones compatibles con este servicio:

| Trabajo | Skill | Aplicación aquí |
|---|---|---|
| Cualquier desarrollo o revisión técnica backend | `skills/backend-service-quality/SKILL.md` | Base obligatoria, independiente del lenguaje; contratos, identidad, integridad y recuperación. |
| Cualquier desarrollo o revisión técnica Python | `skills/python-microservice-quality/SKILL.md` | Especialización obligatoria; lifecycle, async, cancelación, validación y pruebas aisladas. |
| Rutas FastAPI, async, errores o lifespan | `skills/fastapi-python/SKILL.md` | Funciones pequeñas, anotaciones, guardas, errores HTTP concretos y liberación de recursos. |
| Cambios de estructura o nuevos módulos API | `skills/fastapi-templates/SKILL.md` | Separar rutas, contratos y lógica solo cuando reduzca acoplamiento; usar lifespan y dependencias donde aporten valor. |
| Contratos de entrada/salida o configuración | `skills/pydantic/SKILL.md` | Modelos Pydantic v2, `Field` para restricciones y serialización que excluya secretos. |
| Tests unitarios o de integración | `skills/python-testing-patterns/SKILL.md` | Casos de éxito y fallo, aislamiento de red/Chrome, mocks y limpieza de recursos. Mantener `unittest` mientras sea el runner del proyecto; no instalar pytest solo por el ejemplo de la skill. |
| Scripts Bash de login, arranque o despliegue | `skills/bash-defensive-patterns/SKILL.md` | `set -Eeuo pipefail`, rutas y variables entre comillas, comprobación de dependencias y salida no cero ante fallos. |
| Ejecución aislada de Python sin datos de Nodia | `skills/python-executor/SKILL.md` | Solo si una tarea independiente necesita ese servicio externo. No ejecutar allí código que lea `.env`, cookies, perfiles, facturas o secretos. Para este repositorio usar la `.venv` local. |

Los ejemplos genéricos de las skills no son configuración obligatoria. En particular, no añadir CORS `*`, JWT/SQLAlchemy ni servicios externos solo porque aparezcan en una plantilla. La política de acceso interno y los ADR prevalecen.

## Restricciones locales de IA y estado operativo

- Este microservicio opera exclusivamente con sesiones Gemini Web y Antigravity; no introducir API keys, rutas de inferencia por key ni consumo pay-as-you-go. Un ejemplo genérico de una skill/SDK no autoriza cambiar esta política.
- Mantener identidad, autenticación, catálogo, configuración y cuotas separados por motor/sesión. La existencia de un perfil/directorio, variable o cliente Web no demuestra sesión Antigravity.
- Agentic utiliza el CLI oficial autorizado en ADR-016/plan 32. Sin configuración/sesión comprobadas permanece indisponible. Seguir `../docs/mvp/agentic-cli-runbook.md`; evidencia Windows no autentica ni certifica Linux-VPS. Nunca delegar Agentic a Web ni atribuir cuotas/capacidades no observadas.
- El login Agentic de Ajustes utiliza el flujo remoto oficial con enlace/código, separado de Web. Consultar `../docs/features/ai-providers/gemini-agentic-authentication.md` y ADR-017; conservar sesión compartida explícita, ownership del actor, verificación no generativa y limpieza al cancelar. No exponer terminal ni tokens, purgar credenciales globales o sustituir el adaptador por OAuth no comprobado.
- El análisis requiere modelo explícito con resolución exacta contra descubrimiento activo, sin nombres/versiones de respaldo ni catálogos artificiales. Recuperar autenticación conserva el mismo ID; no inferir capacidades de razonamiento por el nombre ni sustituir motor/modelo tras un error.
- Conservar cero, faltante e inválido diferenciados en el contrato de extracción y sus consumidores Server/Client. No fabricar precios, cantidades, totales o estado de éxito; la extracción es un borrador y no confirma factura/stock.
- Mantener un solo worker mientras perfil, sesión, caché, locks y admisión sean locales al proceso. La verificación Linux local no sustituye login/renovación/restauración y aislamiento comprobados en VPS.

## Reglas de implementación

- Los endpoints delegan el trabajo de navegador y Gemini a módulos separados. Tipar las firmas y definir modelos de respuesta para contratos estables; no devolver cookies, tokens ni respuestas crudas del proveedor.
- Todo navegador, cliente Gemini, archivo temporal, tarea y semáforo debe liberarse también ante error, timeout o cancelación. Una tarea de login no debe dejar el perfil bloqueado.
- `.env` es semilla de login y configuración; `session_state/` conserva cookies rotadas. Actualizar credenciales de forma atómica, preservando otras claves y permisos, sin reescribir el archivo con contenido parcial.
- Validar archivos por tamaño y firma antes de enviarlos a Gemini. Acotar simultaneidad y tiempo de espera; comunicar fallos esperados con códigos HTTP precisos y sin detalles sensibles.
- Auditar una variable por todos sus consumidores (`run.py`, `auth.py`, `browser_manager.py`, `gemini_service.py`, `service_auth.py`, Compose y documentación) antes de borrarla de `.env` o `.env.example`.

## Verificación

- Política acordada con el usuario el 2026-10-23: priorizar pruebas de lógica en funciones pequeñas, parsers, validadores, políticas, transformaciones y unidades de estado/admisión con responsabilidad acotada. Probar entradas, salidas, errores, límites y transiciones observables; mantener la unidad real bajo prueba y simular solo sus fronteras externas.
- No montar toda la aplicación ni duplicar un recorrido por endpoint por rutina. Reservar integración puntual y aislada para garantías entre unidades que no demuestra una prueba unitaria, como autenticación HTTP real, lifecycle, cancelación/cierre, aislamiento de perfiles o protocolo CLI; justificar el riesgo y utilizar el montaje mínimo.
- Evitar pruebas de mera delegación, tests espejo de la implementación y snapshots masivos. La cantidad de pruebas o cobertura no acredita calidad: cada regresión debe detectar un defecto o una garantía contractual concreta. No crear abstracciones artificiales para hacer testeable una delegación sin lógica.
- Esta política guía pruebas nuevas y las revisadas por un cambio; no autoriza borrar suites existentes, quitar assertions o desactivar checks sin evaluar y conservar sus garantías. Mantener separados unit tests sintéticos, integración aislada y verificación con cuenta real.
- Ejecutar `./.venv/Scripts/python.exe run_tests.py` en Windows o `./.venv/bin/python run_tests.py` en Linux. El runner instala el aislamiento antes del descubrimiento; no ejecutar integración real dentro de la suite unitaria.
- Seguir ADR-009 y ADR-016/plan 32: CLI con hash/version/perfil verificados, hooks de documento exacto/finalización y cierre de procesos. Integración real separada (`test/agentic-cli.integration.mjs --live-cli`); nunca sustituir Agentic por Web ni habilitarlo con marcadores/keys.
- Para cambios de autenticación, probar acceso sin token, token incorrecto y token correcto. Para navegador/sesión, probar cancelación, timeout, persistencia y recuperación sin abrir Chrome real ni usar cookies reales.
- No dejar procesos de prueba en segundo plano ni ocupar el puerto `8000` al terminar.


## Puerta compartida NodiaAI (AI-11/AI-12)

- Toda nueva entrada que use un perfil (chat, OCR, login, refresh, discovery o
  logout) debe pasar por `ProfileAdmission`; identificar el perfil físico, nunca
  multiplicar capacidad por `connection_id`. Conservar una instancia/un worker.
- El login transfiere la reserva a su tarea y la libera al finalizar realmente;
  cancelar el HTTP o marcar `cancelled` no demuestra cierre del navegador/CLI.
- Antes de inferencia, armar el marcador mínimo persistente; resultado incierto
  queda en cuarentena sin reenvío y bloquea también consumidores previos. No limpiar
  `.unknown` por TTL, borrado de chat, nuevo login o reinicio. Conciliar primero.
- Web sólo conversa y solicita delegación tipada. Agentic sin herramientas mantiene
  MCP vacío/hook sólo `finish`; con MCP, aceptar exclusivamente descriptores
  registrados por Server y callbacks por el loop privado supervisado. No aceptar
  URLs de callback, shell, archivos, HTTP ni herramientas obtenidas de Markdown.
  AI-12 sólo incorpora conocimiento técnico; el gateway de negocio requiere AI-14.
- `supports_mcp` exige prueba explícita real del loop y hook, ligada al perfil,
  sesión, modelo, esfuerzo, configuración y protocolo; ni auth ni health la crean.
- Contar cada `tools/call` antes de validar, incluidos rechazos y replays. Conservar
  `tool_requests` acumulado en eventos RPC y `unforwarded_tool_requests` monotónico
  en el polling privado; Server reserva su delta oculto y cada callback visible en
  el mismo presupuesto durable del run, sin doble conteo ni rollback del consumo
  ante validación fallida. La idempotencia evita duplicar efectos, no el consumo de
  solicitudes. El intento13 termina el puente sin reenviar herramientas.
- Emitir prueba terminal mínima sólo después del cierre real del SDK/CLI. Conciliar
  por identidad exacta; nunca liberar desde un marcador armado sin prueba o uno
  histórico sin identidad. El acuse posterior al commit SQL elimina el recibo y
  estado efímero; no convertirlos en auditoría indefinida ni guardar prompts allí.
- Mantener separadas elegibilidad de transporte e inferencia comprobada. La
  entrega aislada no actualiza como verificados los adapter_states de una cuenta.
