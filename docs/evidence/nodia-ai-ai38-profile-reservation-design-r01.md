# AI-38 — propiedad del perfil y observaciones Agentic

Fecha local: 2026-10-22. Registro cronológico: las secciones iniciales conservan el diseño previo a la atribución; la continuación final incorpora al dueño real observado y el FIX local autorizado. La adopción y aceptación posteriores se registran por separado en los recibos del agente principal. No se extiende una causa medida a todos los `runtime_busy` históricos.

## Hechos y recorrido

La [proyección HTTP R03](nodia-ai-ai38-probe-http-metadata-r03.json) observó `/nodia-ai/agentic/observe`409 y después200. No conserva cuerpos, razón de respuesta ni dueño concurrente. Los [dos turnos posteriores a la entrega](nodia-ai-ai38-owner-availability-validation-r01.json) terminaron con un ACK cada uno; esto no acredita disponibilidad continua. La hipótesis de adjuntos fue [descartada](nodia-ai-ai38-turn-availability-mount-review-r01.md): el loader ya requiere intención y el hook padre ya evita consultar con borrador vacío. Client R01 permanece sin una corrección adicional de adjuntos.

| Entrada | Operación que realmente puede consumir el perfil | Propiedad actual |
|---|---|---|
| `/engines/status`, `/agentic/status`, `/agentic/models`, `/agentic/ready` | `agentic_status` llama `get_status`; con snapshot vencido ejecuta `/usage` y `models` | Reserva exterior de `ProfileAdmission.operation`; el acierto de caché también entra primero por esa reserva |
| `/nodia-ai/agentic/observe` | `ChatAdapter.observe` llama `get_status` y valida modelo/esfuerzo mediante `/model` | Otra reserva exclusiva del mismo perfil físico; ante ocupación rechaza409 inmediatamente |
| Chat, MCP y OCR | Verificación previa, ejecución, cierre del CLI y conciliación correspondiente | Conservan admisión exclusiva, fencing/recibo nativo y cuarentena ante resultado incierto |
| Login Agentic | Verificación no generativa y login remoto; cancela una lectura compartida previa | La reserva se transfiere al trabajo y su callback de terminación la libera; cancelar HTTP no basta |
| Reinicio con `.unknown` | No prueba que haya proceso vivo ni un dueño en memoria | Cuarentena persistente; debe conciliarse, nunca retirarse por TTL o para satisfacer una observación |

Fuentes revisadas: [gate](../../nodia-gemini-microservice/profile_admission.py), [rutas](../../nodia-gemini-microservice/main.py), [chat](../../nodia-gemini-microservice/nodia_ai_chat.py), [servicio Agentic](../../nodia-gemini-microservice/agentic_service.py), [login](../../nodia-gemini-microservice/agentic_login.py) y [cierre de procesos](../../nodia-gemini-microservice/agentic_cli.py). Se conserva un único proceso/worker; dos instancias de conexión no crean dos perfiles físicos.

La colisión entre salud y elegibilidad es posible por construcción. Esto por sí solo no demuestra que sea la causa de la captura real. Los comandos no generativos pueden refrescar credenciales o escribir el home del CLI; un lock de lectores que los ejecute simultáneamente no sería una solución válida.

## Fase DIAG acordada e implementada

`reserve` y `operation` aceptan `purpose` como keyword opcional, predeterminado `legacy`. Categorías cerradas: `legacy`, `health_status`, `eligibility`, `login`, `execution`, `mcp_execution`, `discovery`, `startup`, `logout` y `refresh`. No cambian la admisión, el error público409/503, la cuarentena o los deadlines.

El prefijo de log `nodia_ai_profile_reservation` emite un objeto con `event` (`acquire`, `release`, `reject`), `engine`, `purpose`, `reservation_nonce`, `owner_engine`, `owner_purpose`, `elapsed_ms`, `quarantined` y `reason`. El nonce es aleatorio interno; no se deriva de usuario, sesión, modelo, conexión o perfil. Duraciones monotónicas; dueño y edad desconocidos después de reinicio quedan `null`. Los logs no contienen paths, identidad/hash del perfil, prompts, archivos, modelos, usuarios, variables o credenciales.

La memoria añade solamente el dueño actual por perfil configurado, sin historial. Al liberar normalmente o conciliar se retira; en cuarentena puede retenerse ese único dueño para explicar el bloqueo. Una falla del sink no cambia el resultado de admisión. Las etiquetas de callers se integran en los archivos asignados al agente principal; este corte no afirma su despliegue.

Pins de esta entrega:

- `profile_admission.py`: `7287e9a2b4ad4a804876dfb58187ba781aa723a38f143c2f722ce4d0a5c6fc73`.
- `tests/test_profile_admission_diagnostics.py`: `2ca3a486d511284e64aa92a4089936d251ee58de4beda8f65531e5b9f96ee0ff`.

Pruebas focales: diez correctas; además33 regresiones de `test_nodia_ai_chat.py` correctas. Runner `unittest`, aislamiento instalado antes del import; sin Google, navegador, perfil operativo o tráfico externo. Se comprueban correlación de dueño entre motores con el mismo perfil, campos permitidos, compatibilidad legacy, rechazo de categoría libre, cancelación, cuarentena/reinicio con dueño desconocido, ausencia de historial, falla del log y reloj monotónico. No sustituyen una prueba ASGI concurrente ni identifican un dueño real de producción.

## Corrección propuesta después de identificar al dueño

El agente principal propone serializar únicamente observaciones nativas mediante una espera de capacidad y duración finitas en el dueño del perfil. No se comparte el resultado de `/model` entre selecciones distintas ni se permite CLI paralelo. Ejecución, login, consumidores legacy no clasificados y cuarentena conservan rechazo inmediato. Cancelar un solicitante en espera no debe liberar la reserva del trabajo activo.

Conviene separar la API de coordinación observacional del atributo diagnóstico `purpose`; una etiqueta de log no debería conceder por accidente una política de acceso distinta. El gate conservaría el perfil físico como clave, una reserva identificada y liberación que compruebe el dueño actual antes de retirar capacidad. Se registró una carrera preexistente de liberación: una reserva antigua podría intentar liberar el perfil después de conciliación y nueva adquisición. No se corrigió en DIAG; requiere regresión si la nueva coordinación utiliza tokens de reserva.

Presupuestos comprobados en fuente: health Server15s; `get_status`/`_observe` usa12s; `/model` de elegibilidad10s; transporte Server de `observe`30s; Axios compartido Client20s. Por eso añadir espera sin plazo total puede producir timeout incluso sin inferencia. La propuesta18s total para elegibilidad es una política nueva de Nodia bajo discusión, no una cuota del proveedor ni un límite ya probado. Debe incluir espera, status, modelo y cleanup; nunca sumar nuevamente un timeout completo al adquirir la reserva. El valor y capacidad de espera deben fijarse y documentarse antes de implementar FIX.

No se recomienda mover ahora toda la propiedad a `get_status`: también se invoca dentro de chat/OCR/login ya reservados y exigiría una concesión reentrante explícita. Además, su cancelación actual puede cancelar `_refresh` compartido al abandonar un solo lector. Introducir seguidores compartidos sin corregir ese ownership causaría fallos entre solicitantes. Una serialización acotada en el gate permite un cambio menor, sujeto a las pruebas siguientes.

## Aceptación de FIX pendiente

- Salud y elegibilidad en ambos órdenes: máximo un CLI activo, cada elegibilidad valida su propia selección, sin `runtime_busy` provocado exclusivamente por otra observación admisible.
- Dos elegibilidades iguales y distintas: ninguna mezcla modelo/esfuerzo/generación ni reutiliza un resultado incompatible.
- Ejecución/login/cuarentena ocupados: siguen bloqueando; una observación nunca desbloquea, consume pruebas MCP o borra `.unknown`.
- Cancelación esperando o ejecutando: no libera un dueño ajeno; timeout/shutdown esperan el cierre real del CLI y dejan capacidad coherente.
- Reserva antigua después de conciliación y adquisición nueva: no libera la nueva; la cuarentena continúa intacta.
- Capacidad y plazo total agotados: error estable explícito, sin crecimiento de cola, otra inferencia, fallback o polling UI.
- Reinicio/adopción: la instrumentación requiere una nueva época Gemini y pierde las pruebas efímeras; diagnosticar con metadatos y reatestarlas una sola vez al terminar FIX. No atribuir causalidad al mero éxito después de reiniciar.

La fase DIAG y FIX se separan para obtener atribución real antes de cambiar coordinación. Dos reinicios controlados pueden ser necesarios; se evita repetir la aceptación MCP intermedia. La decisión de despliegue y la eventual actualización de ADR/runbook pertenecen al agente principal. Este reporte no aprueba documentos ni declara cerrado AI-38.

## Continuación: dueño identificado y FIX local autorizado

El [ensayo DIAG A](nodia-ai-ai38-profile-reservation-diag-probe-a-r01.json) y sus [eventos cerrados](nodia-ai-ai38-profile-reservation-diag-probe-a-events-r01.json) atribuyen esta colisión concreta: `health_status` adquiere Agentic a las19:36:55.801665Z; `eligibility` es rechazado113ms después con el mismo nonce, sin cuarentena; el dueño libera a las19:37:00.537100Z tras4.736ms. Hay cero generaciones y SQL de escritura en el ensayo. La cadena de nonce, no sólo la proximidad de timestamps HTTP, identifica al dueño. No se extiende esa atribución a todos los busy históricos.

Tras esa evidencia el agente principal autorizó implementar FIX en el gate y sus pruebas. `observation(engine, *, purpose, timeout_seconds)` es una API distinta de `operation`/`reserve`. Un flag interno en la reserva identifica la observación; una etiqueta `purpose=health_status` en una reserva normal continúa siendo exclusiva. Un `asyncio.Lock` por identidad física serializa sólo observaciones. El contador de admitidos incluye al dueño y hasta cuatro pendientes, se incrementa antes de cualquier `await` y se reduce en `finally`; no utiliza `_waiters` ni otra estructura privada del lock. Rechaza ocupación exclusiva/cuarentena antes de esperar y vuelve a comprobarla tras adquirir; un escritor real que gane el intervalo de relevo conserva prioridad y produce busy explícito.

El plazo abarca cola y cuerpo; únicamente el vencimiento del contexto propio se convierte en `ServiceError(agentic_timeout,504)`. `CancelledError` y un `TimeoutError` ajeno del cuerpo conservan su significado. Cancelar un pendiente no libera ni cancela al dueño; cancelar al dueño conserva la reserva hasta que termina el cleanup de su cuerpo. La liberación compara el objeto dueño actual antes de modificar `_held`, de modo que una reserva antigua después de conciliación no puede liberar una adquisición nueva. El evento `wait` mantiene las mismas nueve claves DIAG; no agrega identidad de perfil ni payloads.

Los callers del agente principal fijan18s para elegibilidad y12s para salud conforme a la decisión nueva de Nodia/ADR-071; el gate recibe esos presupuestos, no los deduce del modelo. El cierre real de procesos puede prolongar la respuesta después del plazo de trabajo y no se adelanta la liberación para simular un corte duro. La adaptación de elegibilidad debe devolver su observación tipada no disponible ante el timeout propio, preservando categoría sin convertirlo en una inferencia incierta; corresponde a `ChatAdapter`, fuera de la edición de este gate.

Pins del FIX local:

- `profile_admission.py`: `341e0faf3b2c5c473a760b92119e89bc4821452fa98d49c497dc94f545b0406b`.
- `tests/test_profile_observation_admission.py`: `b42e8b32fb916b47c24afb73295fabde7083e9d8e6adba7192658d134086ae37`.
- La suite DIAG conserva su pin anterior y sus diez casos sin editar.

Catorce pruebas nuevas correctas y24 focales acumuladas de `test_profile*.py`: FIFO, cuatro pendientes/capacidad de cinco admitidos, cancelación del pendiente y del dueño con cleanup, timeout esperando/en cuerpo, timeout ajeno, política independiente de etiquetas, consumidores exclusivos, cuarentena, escritor que gana el relevo, reserva antigua tras conciliación, perfiles físicos separados y presupuestos inválidos. Eventos y barreras reales de `asyncio`, temporales sintéticos y red externa bloqueada. No se realizó inferencia, prueba ASGI nueva, adopción o verificación de cuenta por este subagente. La aceptación real y las pruebas ASGI del adaptador siguen a cargo del agente principal y del subagente correspondiente.
