# ADR-041 — Supervisor MCP privado y pruebas terminales del runtime

> Estado: propuesto; implementación y matriz real verificadas en laboratorio Linux, sin aprobación documental ni aceptación productiva automática.
> Fecha: 2026-10-15

## Contexto

NodiaAI ejecuta etapas durables en un proceso Nest independiente, sin listener HTTP. Gemini Agentic necesita intercambiar llamadas MCP con Server mientras su proceso CLI sigue vivo. Server conserva la autoridad: sesión, grant, módulos, fence, lease y presupuestos se revalidan antes de entregar cada resultado. El servicio privado protege además el perfil físico compartido con chat, OCR, login y descubrimiento. Ni el modelo ni el proceso nativo pueden concederse acceso a la BD.

Una respuesta perdida después de `dispatch_armed` deja una inferencia incierta. Vencer el lease SQL, no encontrar un PID o recibir un HTTP terminado no prueba que hayan cerrado el supervisor y sus procesos. Liberar el perfil por tiempo permitiría superponer otra operación. En sentido contrario, retener para siempre cada recibo exitoso incumpliría la conservación mínima decidida en50. Se necesita separar cierre comprobado, commit local y eliminación del recibo.

## Opciones consideradas

### Opción A — Callback HTTP desde el servicio nativo al worker

- Ventajas: entrega directa y menor demora entre solicitud y resultado.
- Desventajas: obliga a publicar un listener por worker y resolver direccionamiento, autenticación inversa, red y ciclo de vida de sus callbacks. Una URL controlable por el proveedor/modelo agregaría una superficie de SSRF. Acopla la recuperación a un proceso concreto y contradice el entrypoint sin HTTP.

### Opción B — Canal privado iniciado por Server con supervisor nativo y polling acotado

- Ventajas: conserva la dirección de confianza Server→servicio privado, no requiere puertos entrantes del worker y permite validar cada evento antes del callback local. El intento y sus referencias permanecen explícitos aunque se pierda una respuesta de transporte.
- Desventajas: añade solicitudes de polling, cursores y una máquina de estados en el servicio. Hay que limitar eventos, bytes, espera y memoria, y distinguir timeout de cierre terminal.

### Opción C — Broker externo o resultado final sin callbacks

- Ventajas: un broker permite entrega desacoplada; un resultado final único simplifica el transporte.
- Desventajas: el broker añade infraestructura y garantías de entrega que PostgreSQL ya resuelve para las etapas. Un resultado final sin callbacks impediría que Server autorice y registre las herramientas durante el turno, o trasladaría esa autoridad al servicio nativo. Ninguna variante aporta una ventaja suficiente en esta etapa.

## Decisión

Se implementa la opción B, manteniendo su aceptación real como gate independiente. El protocolo privado inicia un intento mediante `/nodia-ai/agentic/mcp/start`; Server consulta eventos ordenados del intento y devuelve sus resultados por la ruta privada correspondiente. No se acepta una URL de callback, no se abre HTTP en el worker y no se envían credenciales al navegador/modelo. Se aplican la red y credencial exclusivas de servicio de ADR-008.

El supervisor Agentic expone únicamente descriptores MCP entregados por Server. Los eventos tienen esquema cerrado, secuencia monótona e identidad exacta de intento/perfil/generación de sesión/operación. Server rechaza nombres no registrados, argumentos adicionales, respuestas inválidas y exceso de bytes. Los callbacks se ejecutan mediante checkpoints transaccionales breves; no se mantiene SQL abierto durante HTTP, CLI, generación o espera de resultados. Los RPC reales se contabilizan por incrementos durables; los presupuestos comunes del run no se reinician entre Web y Agentic.

La disponibilidad de MCP requiere una prueba del transporte y callback para el perfil, sesión, configuración, modelo y esfuerzo exactos. Un login, un catálogo o una marca configurable no la acreditan. Web permanece conversacional y no recibe herramientas. La delegación opt-in de48 conserva un único run y una selección base Web; no constituye fallback por error ni permiso de escritura. Inicialmente sólo están registrados los lectores técnicos de conocimiento de58; las operaciones de negocio pertenecen a AI-14 y sus familias posteriores.

Toda conclusión positiva de un intento armado debe traer una prueba terminal privada emitida por el supervisor. Contiene identidad de intento, motor, recurso físico, generación de sesión, referencia de operación, UUID de prueba, resultado terminal y fecha observada; la comprobación de cierre de procesos forma parte de su emisión. Server valida esa identidad contra el descriptor durable y el fence vigente. La prueba no se acepta del usuario/modelo ni se publica en mensajes o proyecciones públicas.

El cierre nativo no equivale al commit SQL. La misma transacción que sella la respuesta o avanza a otra fase libera sólo el slot coincidente y crea un job independiente `reconcile_ack`. Después del commit, mantenimiento acusa recibo por el canal privado y elimina la prueba nativa. El acuse es idempotente: un fallo mantiene únicamente ese pendiente mínimo, con reintentos acotados y recuperación explícita al agotarlos. No se conserva un archivo nuevo de auditoría por cada éxito ni se requiere que siga existiendo el chat para completar su limpieza.

Un resultado armado incierto permanece `unknown` y su perfil en cuarentena hasta conciliación comprobada; ningún TTL, reinicio o ausencia de PID lo vuelve libre. La conciliación puede acreditar cierre `completed` sin recuperar el texto: entonces cierra localmente como `response_unavailable`, sin inventar respuesta ni repetir generación. `abandoned_unknown` conserva la incertidumbre; no prueba ausencia de efectos remotos. Un intento todavía `claimed` puede liberar su reserva SQL al fallar o vencer, porque nunca superó la barrera durable de envío. Estos recibos de runtime no sustituyen los recibos de operaciones de negocio y su recuperación futura de AI-20.

## Consecuencias

- Consecuencias positivas: el worker mantiene un único canal saliente; la autoridad sigue en Server; la exclusión cubre también consumidores ajenos al chat; la respuesta y la liberación conservan su atomicidad local; la limpieza posterior no retiene contenido conversacional.
- Costos o riesgos aceptados: existen estados y referencias mínimas en SQL y en el servicio nativo, con fallo posible entre ambos commits. Se requieren conciliación y ack idempotentes, supervisión real de hijos, límites estrictos de polling y visibilidad de pendientes. La cuarentena puede bloquear un perfil hasta intervención; es preferible a reutilizarlo sin prueba de cierre.
- Trabajo posterior: concluir la matriz real de herramientas, timeout, cancelación, crash y concurrencia de consumidores. Los tests aislados no validan todas las combinaciones de CLI/cuenta/modelo/SO. En las primeras comprobaciones reales de esta entrega hubo un `mcp_result_unknown` sin causa confirmada y un CLI con salida `SUCCESS`/código0 que no superó la validación del hook por un rechazo previo. No se ha demostrado un timeout como causa de esos resultados: el gate de cierre sigue bloqueando correctamente una ejecución con evidencia de herramientas no permitidas. Corregir la presentación explícita del catálogo no permite relajar ese gate. Estos resultados no cierran AI-11/12 ni declaran disponibilidad general. No publicar fichas, herramientas de negocio o UI por la mera existencia de este ADR.

Checkpoint de pausa del2026-10-15: una comprobación posterior con runtime/cuenta reales pasó13 checks, incluyendo Agentic MCP directo con dos callbacks y datos aleatorios, attestation exacta, seis rechazos de perfil ocupado entre consumidores y respuesta Web en su perfil independiente. Es evidencia parcial del transporte y la exclusión, no de toda la ejecución durable: siguen pendientes worker Agentic real, routing opt-in real y cancelación/unknown con conciliación SQL real. El usuario solicitó detener pruebas/desarrollo y apagar servicios/VM; no se cierra AI-11/12 por este checkpoint.

## Referencias

Actualización2026-10-16: la [matriz final](../../evidence/nodia-ai-ai11-ai12-live-validation.json) completó32 comprobaciones reales (worker9, routing10, cancelación/conciliación13); supera el pendiente técnico registrado en la historia anterior sin borrar sus fallos. El proceso worker independiente completó un turno y cerró recibos; el siguiente turno conservó Web después de delegar; cancelación dejó SQLunknown y sólo la prueba nativa permitió conciliar/acuse/liberar, sin replay. Se corrigió el conteo de solicitudes duplicadas/denegadas: callbacks visibles reservan antes de validar y Native comunica solicitudes no reenviadas mediante un acumulado monótono; ambos consumen el presupuesto SQL común. La limpieza del harness preserva identidades aun si no se publicó unknown por fallo de checkpoint. AI-11/12 cierran su alcance técnico; UI/negocio, carga/despliegue/backup y otras configuraciones siguen sus gates. Este ADR conserva estado propuesto.

- [ADR-008 — seguridad de servicios internos](ADR-008-internal-microservices-only.md), [ADR-034 — jobs y conservación](ADR-034-nodia-ai-postgres-jobs-and-retention.md), [ADR-036 — routing opt-in](ADR-036-nodia-ai-opt-in-agentic-routing.md) y [ADR-037 — admisión y conservación mínima](ADR-037-nodia-ai-admission-and-minimal-retention.md).
- [AI-11/57 — worker y conciliación](../../mvp/57-nodia-ai-ai11-durable-worker.md), [AI-12/58 — contexto y adaptadores](../../mvp/58-nodia-ai-ai12-context-execution.md), [política50](../../mvp/50-nodia-ai-ai04-runtime-policy.md) y [publicación52](../../mvp/52-nodia-ai-ai06-knowledge-publication-contract.md).
- [Adaptador Node](../../../nodia-server/src/nodia-ai-adapter/use-case/gemini-nodia-ai-adapter.use-case.ts), [supervisor MCP](../../../nodia-gemini-microservice/native_mcp_sessions.py), [checkpoint/ack SQL](../../../nodia-server/src/nodia-ai-runtime/use-case/checkpoint-nodia-ai-job.use-case.ts) y [conciliación](../../../nodia-server/src/nodia-ai-runtime/use-case/reconcile-nodia-ai-runtime.use-case.ts).
