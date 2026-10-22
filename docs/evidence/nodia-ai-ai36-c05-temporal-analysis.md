# AI36-C05 — análisis temporal previo al experimento instrumentado

Fecha: 2026-10-19. Alcance: revisión de fuentes; sin inferencia, despliegue, cambios de producción ni acceso a perfiles. Diagnóstico suplementario, no aceptación de capacidades. La causa del timeout de Live02 sigue indeterminada.

## Plazos y preparación comprobados

- [Política50](../mvp/50-nodia-ai-ai04-runtime-policy.md) distingue un turno de600s, incluida cola/compactación/delegación, de120s por envío al proveedor. El runner actual inicia su timer de120s inmediatamente después del claim, antes de ejecutar el handler: [RunNodiaAiStageUseCase](../../nodia-server/src/nodia-ai-runtime/use-case/run-nodia-ai-stage.use-case.ts). Su test del límite arma inmediatamente; no prueba una preparación demorada.
- El handler prepara historia/contexto, observa el proveedor, mide el prompt, revalida fuentes/configuración, reserva y arma el dispatch. Después construye `deadlineAt=min(run.deadline_at, Date.now()+120s)`: [ProcessNodiaAiStageUseCase](../../nodia-server/src/nodia-ai-context/use-case/process-nodia-ai-stage.use-case.ts).
- El adaptador calcula `floor((deadlineAt-Date.now())/1000)`, acota a120 y transmite `timeout_seconds`, pero también conserva la señal del runner. Esa señal puede vencer antes del plazo anunciado a Python: [GeminiNodiaAiAdapterUseCase](../../nodia-server/src/nodia-ai-adapter/use-case/gemini-nodia-ai-adapter.use-case.ts).
- `NativeMcpSessions.start()` verifica sesión/modelo antes de crear `McpJob`; su `started_at` y el timeout de `run()` comienzan después de esa verificación. El timeout de `run()` incluye materialización y preparación del workspace; el timeout del CLI empieza posteriormente al invocarlo. El bridge tiene otro deadline relativo desde su propia construcción: [sesiones](../../nodia-gemini-microservice/native_mcp_sessions.py), [runner](../../nodia-gemini-microservice/agentic_cli.py), [bridge](../../nodia-gemini-microservice/native_mcp_stdio.py).

Estos hechos permiten que un timer externo de120s produzca un diagnóstico Python de aproximadamente108s si la preparación anterior consumió aproximadamente12s. Es compatibilidad aritmética; no demuestra los tiempos individuales de Live02.

### Gap separado: coherencia del plazo anunciado

Hoy la señal externa conserva el límite efectivo, pero Python puede recibir más tiempo del que realmente queda. Una mejora posible es fijar un único deadline de etapa y transmitir su tiempo restante al adaptador. Eso no aumenta120s, no recupera tiempo ya consumido ni explica la latencia nativa. **No se implementa durante este experimento**, para conservar código/prompt comparables y medir primero. Una regresión futura debe demorar la preparación, comprobar el plazo restante anunciado y verificar estado incierto sin retry si el límite vence después de armar.

## Coste del preflight

- `measure-context` valida y construye bytes del prompt localmente. No observa sesión ni ejecuta CLI: [native_context_budget.py](../../nodia-gemini-microservice/native_context_budget.py).
- La observación Agentic llama a `get_status()` y después ejecuta siempre la comprobación de selección `/model`, con modelo/esfuerzo exactos y límite10s: [ChatAdapter.observe](../../nodia-gemini-microservice/nodia_ai_chat.py).
- `get_status()` reutiliza un snapshot de menos de30s y comparte una actualización en curso. Una actualización ejecuta `/usage` y `models`, en secuencia bajo un límite conjunto12s: [AgenticService](../../nodia-gemini-microservice/agentic_service.py).
- `start()` llama otra vez a `get_status()`. Normalmente puede reutilizar la observación reciente; si transcurrieron30s o se invalidó el snapshot puede volver a actualizar. Sin una traza no se puede afirmar qué ocurrió en Live02. No se modifica esta caché ni se elimina la comprobación `/model`: un catálogo disponible no demuestra por sí solo que el CLI acepte la selección exacta.

## Prompt y finalización

El [wrapper MCP](../../nodia-gemini-microservice/native_context_budget.py) expone herramientas registradas y `finish`, exige la envoltura de respuesta `Answer` y limita el dispatcher a nombres exactos. La orden de responder JSON no incluye una frase inequívoca que exija llamar a `finish` con ese objeto; la relevancia de esta ambigüedad requiere observación, no una atribución causal.

El canario exige explícitamente preparar un gasto y después consultar `nodia_proposals_get`. Aunque `ready` ya contiene una propuesta pública, no requiere confirmación humana para releerla ni impide esa consulta. Python no ramifica por `ready` o `awaiting_human_confirmation`: entrega el resultado y espera la terminal del CLI. Quitar la segunda operación cambiaría la aceptación de esa capacidad.

## Hipótesis falsables y trazas que las distinguen

| Hipótesis | Observación que la apoya o descarta |
|---|---|
| La preparación reduce sustancialmente el tiempo útil del CLI | Offsets monotónicos claim, historia/contexto, observe, measure, arm y POST start; tiempo restante en arm/start; Python start/status/job/workspace/CLI spawn. Comparar duraciones dentro de cada proceso; no restar relojes monotónicos de procesos distintos. |
| Una actualización repetida de sesión/catalogo consume tiempo | Duración separada de `get_status`, edad del snapshot y si reutilizó/se unió/inició actualización; duración separada de `/model`. Sin contenido de sesión/cuotas. |
| El callback SQL o su transporte consume el plazo | Por ordinal: evento recibido, contabilidad terminada, handler terminado, resultado aceptado; en Python, solicitud emitida, resultado escrito, respuesta leída y reply enviado. Guardar sólo tiempos y bytes, no argumentos/resultados. |
| El bridge entrega el primer resultado y luego el CLI tarda sin acciones visibles | `reply_sent` temprano seguido de un intervalo largo sin evento CLI/hook/RPC. Esto localiza el intervalo; no identifica razonamiento, red, cuota ni espera humana del proveedor. |
| El CLI intenta otra herramienta o `finish` pero el gate/protocolo la rechaza | Eventos separados por herramienta/estado y categorías permitidas de gate; ordinal de solicitud RPC, método permitido y nombre de herramienta registrado, sin payload. Un rechazo debe quedar separado de la ausencia de intento. |
| El CLI termina pero la validación o cierre consume tiempo | Eventos de resultado/exit, inicio/fin de validación de modelo/terminal/hook y cierre de prueba, más recepción terminal en Node. |
| Cancela Node antes del timeout propio de Python/CLI | Origen y categoría segura de cancelación, deadline efectivo, `timeout_seconds` anunciado y elapsed por proceso. `CancelledError` por sí solo no distingue cancelación de usuario, deadline o lease perdida. |

Los contadores de `step_update` no equivalen a invocaciones: IN_PROGRESS y DONE de una sola llamada producen dos eventos y un completed. El [control offline reproducible](scripts/nodia-ai-ai36-c05-native-bridge-control.py) y [su ejecución](nodia-ai-ai36-c05-native-bridge-control.json) verifican además dos callbacks consecutivos con bridge/supervisor reales y cliente CLI sintético; no certifican el CLI real ni Gemini.

Las trazas deben ser acotadas y suplementarias: ninguna escritura diagnóstica modifica validación, presupuesto, deadline, limpieza, autoridad o resultado. No registrar prompt, argumentos, respuesta, documento, ruta operativa, cookies o credenciales. No reintentar intentos inciertos, cambiar modelo/esfuerzo ni aumentar límites para obtener una terminal.

## Observación posterior de cohorte03

El arnés de aceptación comunicó terminales completed y ACK para discovery `2441ecc9-88e7-40cf-bfc5-9adc27c29f68` y ejecución `0b9e0eee-e0b0-4875-a009-35be15796a8e`. Esta última completó preparación financiera y consulta de propuesta sin timeout; el arnés falló después en una expectativa de forma del borrador SQL. Esta observación no convierte en aceptadas las siete capacidades ni identifica por qué Live02 agotó el plazo. Las terminales/tiempos de esta cohorte pertenecen al reporte del arnés, no a una reconstrucción de logs.

La [extracción de logs03](nodia-ai-ai36-c05-live-attempt03-native-diagnostics.json) no encontró registros terminales estructurales para esos IDs en la ventana desde17:21UTC. Conserva `missing_attempt_ids` explícitos. El [hash de imagen y fuentes03](nodia-ai-ai36-c05-live-attempt03-native-source.json) coincide exactamente con02: mismo contenedor, imagen, arranque y seis archivos nativos fijos; tampoco se reinició Gemini para esta observación.

Existe un gap de observabilidad independiente: `NativeMcpSessions.run()` registra completados en stdlib INFO y fallos en WARNING. [run.py](../../nodia-gemini-microservice/run.py) usa la configuración predeterminada de Uvicorn, sin un nivel propio para ese logger. Un control offline de la configuración instalada, sin importar la aplicación, obtuvo nivel efectivo30: INFO deshabilitado y WARNING habilitado. Esto explica la compatibilidad entre terminales completed acreditadas por el arnés y ausencia de sus registros INFO; no acredita detalles CLI/hook que no se conservaron. No se modificó el logging ni el servicio para recuperarlos.

La [única observación de recursos](nodia-ai-ai36-c05-live-attempt03-resources.json) se tomó a17:23:41UTC, durante ejecución: CPU del contenedor2,47%,174,4MiB de2GiB y14PIDs; host con carga0,31/0,13/0,04 y memoria disponible6.531.644KiB. Es una muestra puntual que no determina ni excluye saturación en otros momentos, estado de red, cuota o causa del timeout.

El [reporte instrumentado03](nodia-ai-ai36-c05-live-attempt03-report.json) permite localizar intervalos sin reconstruir contenido del CLI. Offsets desde la entrada a `Adapter.execute`, medidos por el mismo reloj monotónico de Node:

| Generación | Duración execute | Primer callback | Tiempo SQL/gateway observado | POST resultado aceptado | Intervalo último resultado aceptado → respuesta terminal |
|---|---:|---:|---:|---:|---:|
| Discovery |83,967s|70,367s|select174ms|3ms|13,422s|
| Execution |108,066s|finance80,510s|finance81ms; propuesta49ms|3ms cada uno|18,820s|

`nodia_proposals_get` llegó a89,192s del comienzo de execute. Los POST start tardaron aproximadamente10ms en ambas generaciones. La observación anterior a execution tardó8,134s y la medición de contexto5ms; antes de discovery fueron4,301s y5ms. El intervalo dominante observado03 está antes del primer callback y después de la entrega de resultados; las trazas no lo atribuyen a razonamiento, red, cuota ni otro comportamiento interno del proveedor. Tampoco demuestran que Live02 tuviera la misma distribución. Los811/1044 polls HTTP del arnés no son811/1044 solicitudes RPC MCP.

## Cohorte04 y corrección del clasificador de diagnóstico

El [registro04](nodia-ai-ai36-c05-live-attempt04-native-diagnostics.json) conserva discovery `4fc1f751-23ff-40a3-a586-65dacfc9f02a` como unknown por cancelación a116,288s: seis RPC, cero callbacks, inicialización y recepción de prompt, sin pasos de herramienta, terminal ni stderr. La última observación CLI tenía112,984s de antigüedad al cerrar. El contexto controlado fue23.910B iniciales y36.694B tras mensajes MCP, por debajo del límite262.144B. [Imagen y seis fuentes fijas](nodia-ai-ai36-c05-live-attempt04-native-source.json) coinciden con03, sin reinicio.

Los reportes03/04 conservan iguales selección, configuración pública, publicación, hash del mensaje humano, catálogo y contratos congelados de discovery. Sus mediciones exactas de prompt nativo coinciden:10.944B canónicos,12.476B de catálogo y490B de envoltura. No conservan un hash de todo el prompt canónico enviado: igual tamaño no prueba igualdad byte por byte.

Se confirmó un defecto independiente de observabilidad: el clasificador leía bytes acotados, pero descartaba las líneas centrales antes de buscar indicadores. El log04 registraba28.184B leídos y una ventana de128 líneas truncada; los indicadores vacíos no excluyen señales en las líneas descartadas. El [control offline histórico](scripts/nodia-ai-ai36-c05-cli-log-window-control.py) y [su evidencia anterior al arreglo](nodia-ai-ai36-c05-cli-log-window-control.json) demuestran la omisión con un indicador sintético central de HTTP503, sin demostrar que existiera ese error en el log real.

La [corrección validada localmente](nodia-ai-ai36-c05-r01-native-diagnostic-window-validation.json) clasifica todos los bytes ya leídos, conserva el límite128KiB, categorías cerradas y metadatos históricos de la ventana de líneas, y no emite texto. Clasifica por separado las ventanas no adyacentes de cabecera/cola para evitar fabricar un indicador a través del hueco no leído. Las regresiones fallan con las variantes anteriores por omisión central y por un HTTP503 artificial entre ventanas; después pasan siete pruebas focales y439 pruebas Windows con dos omisiones históricas. Compilación de las fuentes correcta. El centro no leído de un archivo mayor al límite sigue fuera de cobertura. El clasificador continúa produciendo indicadores, no respuestas HTTP verificadas ni causas.

Impacto funcional/documental: diagnóstico privado suplementario; no cambia herramientas, reglas de producto, fichas funcionales, permisos, prompts, resultados, deadlines, modelos o retries. Ninguna ficha referencia ese archivo como fuente. Este análisis registra el cambio; no se ha desplegado ni reiniciado el servicio como parte de esta validación. La causa de los timeouts permanece abierta.

El [observador aislado](scripts/nodia-ai-ai36-c05-live-owned-log-observer.py) reutiliza el clasificador puro como herramienta externa: antes de leer un log exige marcador propio exacto, baseline vacío, único directorio nuevo, propietario/UID, política pública exacta e inodos fijados con NOFOLLOW y revalidación. Su salida sólo conserva categorías, bytes y tiempos. Las [pruebas de filesystem y protocolo](nodia-ai-ai36-c05-r01-owned-log-observer-validation.json) pasan15/15 en Linux real, incluidos intercambio de inodo, ABA y symlink; Windows pasa11 y omite cuatro controles específicos que cubre Linux. Esto no sustituye una prueba terminal ni requiere actualizar la imagen de la aplicación.
