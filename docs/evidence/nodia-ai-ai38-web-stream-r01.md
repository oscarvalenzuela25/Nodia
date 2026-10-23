# AI-38 — Diagnóstico del stream Web y revalidación de modalidades

Fecha: 2026-10-22. Investigación autorizada por el usuario; sin aprobación documental automática ni publicación de herramientas.

## Punto de partida

Se conserva el [cierre anterior](nodia-ai-ai38-mcp-post-list-r01.md): MCP y PNG/PDF/WAV/WebM Agentic comprobados en la época FIX; Web agotó el plazo con WAV, WebM y PNG sin candidata, con ACK y sin replay. Las pruebas de formatos de sesiones Web anteriores no acreditaban la sesión final.

El [inventario de partida](nodia-ai-ai38-web-stream-readonly-r01.json) confirma la imagen FIX, los procesos API/worker, seis contadores nativos y tres SQL en cero. La [comparación del SDK](nodia-ai-ai38-web-stream-sdk-parity-r01.json) acredita igualdad de sus 31 fuentes públicas Linux/Windows; no se consultaron perfiles, credenciales o mensajes para construir fixtures.

## Aislamiento del problema y observación

El [control sólo de texto](nodia-ai-ai38-web-stream-text-r02.json), UUID `3d0ff243-158a-4b68-beff-eec1ea739c45`, agotó también 120 segundos, terminó `abandoned_unknown` y recibió ACK. Sus [diagnósticos previos al reinicio](nodia-ai-ai38-web-stream-text-diag-r01.json) muestran stream HTTP 200 y cero candidatas, sin upload ni adaptador de audio. El fallo actual no requiere un adjunto. El control R01 no despachó: se ejecutó inicialmente por stdin y falló al calcular el hash de `__file__`; se conserva su captura vacía y el directorio de preparación, sin atribuirles una generación.

La [revisión offline](nodia-ai-ai38-web-stream-review-r01.md) identifica que el watchdog del SDK espera 125 segundos por el siguiente chunk, frente a los 120 segundos totales del caller. Esto explica que `recovery_calls=0` sea compatible con el corte del caller, pero no demuestra por qué el proveedor no entrega una respuesta. Se mantienen los plazos, la configuración, los retries deshabilitados y el modelo configurado; no hay fallback.

Se añade un observador independiente de framing UTF-16/UTF-8, limitado a 64 KiB y 256 partes. Sólo conserva contadores, categorías cerradas y presencia booleana de identificadores; borra el buffer al cerrar. No modifica el parser, transporte o resultado del SDK, ni registra contenido de frames o respuestas. Las pruebas incluyen fragmentación, errores, límites y cancelación.

La [construcción aislada Linux](nodia-ai-ai38-web-stream-build-r01.json) pasó 486 pruebas sin omisiones, conserva las 42 distribuciones y añade una capa COPY-only: únicamente cambia `web_generation_diagnostics.py` y añade `web_stream_frame_diagnostics.py`, de 47 a 48 fuentes. Windows ejecutó 517 pruebas: 515 correctas y dos omisiones históricas. La QA de imagen usa los tests FIX congelados más el archivo nuevo; no se presenta como paridad completa del workspace.

El [preflight](nodia-ai-ai38-web-stream-adopt-preflight-r01.json), [plan exacto](nodia-ai-ai38-web-stream-adopt-plan-r01.json) y [adopción](nodia-ai-ai38-web-stream-adopt-r01.json) conservan configuración, mounts, secretos, selección, esquema, paquete Server owner-r01 y nginx. Backup cifrado fresco, drenaje, arranque y timers restaurados; cero pendientes al cerrar. Imagen `985ba983…`, época `2026-10-22T21:25:38.245485678Z`. El reinicio invalida las pruebas en memoria de ambos motores; las anteriores permanecen históricas y requieren nueva aceptación.

## Continuación

El [control de texto de la nueva época](nodia-ai-ai38-web-stream-text-r03.json), UUID `b820a3c9-4e17-41b1-b867-352281d92d8f`, completó una generación: JSON válido, hash semántico exacto y ACK, sin replay. Sus [frames observados](nodia-ai-ai38-web-stream-text-diag-r02.json) muestran 13 chunks/28.877 bytes, 12 frames/13 partes, cinco salidas con candidata y EOF real. Primera candidata a 93.447 ms; cierre completo en 95.652 ms. Presencia de CID/RID y cero categorías de error observadas, sin errores o límites del observador; ninguna recuperación de historial.

Esto acredita una respuesta correcta del control en la sesión nueva, no una causa reparada: el cambio sólo observa, y el reinicio también reemplazó el cliente. No puede atribuirse causalmente el éxito al observador ni extrapolarlo a la sesión anterior. Se continúa con un canario PNG independiente antes de decidir las demás pruebas de formato. Los resultados posteriores se registran debajo antes de establecer las modalidades vigentes.

El [PNG instrumentado](nodia-ai-ai38-web-stream-web-png-r01.json), UUID `aa874322-fef7-4799-87b1-7e00900759d2`, agotó el plazo y quedó `abandoned_unknown` con ACK. La [traza](nodia-ai-ai38-web-stream-web-png-diag-r01.json) confirma upload200/727ms y dos frames/224 bytes válidos, con CID/RID presentes, sin candidata, errores de JSON, cola explícita o categoría remota de error. Se llegó al corte de 120 segundos sin EOF ni consulta de historial. Esto permite distinguir falta de candidata de un error del parser: la información recibida sí se pudo interpretar. No demuestra por qué no llegó una candidata. No se despacharon PDF/WAV/WebM en esta sesión; el cierre del SDK y la observación posterior invalidan el positivo de texto como prueba de la nueva sesión.

La [recalificación MCP en la época de diagnóstico](nodia-ai-ai38-web-stream-mcp-r01.json), UUID `3879eb7f-3489-4f86-b097-a6fbcdc02a5b`, también agotó el plazo, sin callbacks. Cancelación, conciliación y ACK completos, sin replay. El [terminal proyectado antes de otro reinicio](nodia-ai-ai38-web-stream-mcp-terminal-r01.json) conserva seis RPC y una respuesta construida de tools/list; no acredita consumo del CLI ni la causa del silencio. El agregado no permite ordenar su único rechazo respecto de initialize, y no hay prueba nueva de contención del perfil. Los formatos Agentic no se iniciaron tras este fallo. Hasta este corte hay cuatro generaciones nuevas: un texto completado y tres resultados desconocidos cerrados, sin efectos comerciales.

## Corrección candidata de recuperación Web

La traza PNG hace útil la recuperación autorizada del mismo CID, pero el watchdog configurado no cabía en el plazo total. Se prepara un presupuesto temporal exclusivo del chat: `min(watchdog_previo, max(1, plazo_chat/2-5))`, 55 segundos para un chat de 120, con restauración en finally. El SDK conserva la generación única y su lectura del historial; no se cambia modelo, plazo total, retries o permisos. Los casos de OCR omiten el argumento nuevo y conservan sus valores. El SDK sigue usando su timeout original cuando reconoce thinking/queueing, y cabeceras o heartbeats tardíos pueden consumir todo el plazo: no se promete recuperación universal. El SDK enlaza por CID nuevo y diferencia de RCID; no añade una comprobación propia del RID del stream.

La revisión detectó dos riesgos antes de adoptar el candidato: warnings del SDK que incluían texto del proveedor al recuperar una negativa, y el flag de servicio inicializado que podía quedar vigente después de un error de historial con transporte cerrado. La protección de logs se aplica en construcción explícita del servicio, conservando handlers y diagnósticos de Nodia. La invalidación del cliente cerrado se limita al nuevo flujo de chat; el siguiente observe debe renovar la generación, después de cerrar y acusar el intento anterior. Las construcciones intermedias se conservan sin adopción. La aceptación del candidato final y sus resultados reales se registran a continuación.

## Candidato R04 adoptado

La [revisión independiente](nodia-ai-ai38-web-stream-recovery-review-r04.json) verificó diez pruebas con el SDK instalado: una sola generación, historial del mismo CID nuevo, texto estructurado intacto, restauración de parámetros, error, cancelación, privacidad e invalidación/reconexión del cliente cerrado. La [prueba de mutación](nodia-ai-ai38-web-stream-recovery-privacy-mutation-r02.json) demuestra que retirar en memoria únicamente la protección de logs hace fallar el control de privacidad; el fixture habilita el SDK antes de construir el servicio para evitar un falso positivo por orden de tests.

La [construcción final R04](nodia-ai-ai38-web-stream-recovery-build-r04.json) pasó 496 pruebas Linux sin omisiones. Windows: 527 ejecutadas, 525 correctas y dos omisiones históricas. El [parche selectivo](nodia-ai-ai38-web-stream-recovery-selective-patch-r04.json) prueba que el chat desplegado parte de la fuente FIX real, con un único argumento nuevo; no se adopta la copia completa del workspace. Sólo cambian `gemini_service.py`, `nodia_ai_chat.py` y el nuevo `web_chat_recovery.py`: 48→49 fuentes, mismas dependencias y configuración de imagen. Las construcciones de recuperación R01–R03 quedan como intermedias sin adopción.

La [adopción R04](nodia-ai-ai38-web-stream-recovery-adopt-r04.json), con [binding privado proyectado](nodia-ai-ai38-web-stream-recovery-adopt-VM-binding-r04.json), completó backup cifrado, drenaje y restauración de servicios/timers. Imagen `6b9e2f7e…`, contenedor `c4814c5a…`, época `2026-10-22T21:50:29.621768018Z`; Server owner-r01, selección, esquema, mounts, variables y nginx conservados. Cero pendientes al terminar y ninguna inferencia durante el despliegue. Las pruebas en memoria requieren aceptación de esta época nueva.

El [texto de control R04](nodia-ai-ai38-web-stream-text-r04.json), UUID `f83d4b19-47ce-4745-a341-2195a744ac7c`, completó con hash exacto y ACK en aproximadamente 42,6 segundos. Sus [diagnósticos](nodia-ai-ai38-web-recovery-text-diag-r01.json) se conservan sin contenido. Este positivo no demuestra estabilidad ni que se haya utilizado la recuperación; esa distinción se establece con `recovery_calls` de la traza.

El [PNG posterior a la corrección](nodia-ai-ai38-web-recovery-web-png-r01.json), UUID `8d776c39-8370-4f2c-b540-e631af88b908`, volvió a terminar sin candidata, con `APIError` a los 119.306 ms, conciliación y ACK. Los [diagnósticos](nodia-ai-ai38-web-recovery-web-png-diag-r01.json) acreditan cinco lecturas de historial de la misma generación; la primera empezó a los 66.461 ms. La corrección permite ejecutar la recuperación antes del límite, pero no obtuvo una respuesta recuperable: dos frames válidos, CID/RID presentes, ninguna candidata. No se reintentó la inferencia ni se iniciaron PDF/WAV/WebM Web. La renovación posterior del cliente deja el positivo R04 de texto como histórico; ningún formato Web queda acreditado en la generación vigente.

La [prueba MCP de la época R04](nodia-ai-ai38-web-recovery-mcp-r01.json), UUID `2508e3d9-038e-452b-80bf-c964f11d092e`, completó en aproximadamente 54 segundos: nonce correcto, un callback real, atestación y ACK, sin efectos comerciales. La [observación efímera IPC](nodia-ai-ai38-web-recovery-mcp-ipc-r01.ndjson) registra el error `-32000` antes de initialize, seguido de initialize y tools/list correctos y la solicitud de herramienta. Su presencia también en esta ejecución exitosa impide tratarlo como causa suficiente del timeout anterior. La asociación del observador con el intento se apoya en su ventana temporal exclusiva; sus archivos no exponen el UUID del intento. El muestreo no acredita estados intermedios no observados, ni que un tools/list construido haya sido consumido por el CLI.

## Aceptación vigente y preservación

Los cuatro canarios Agentic se ejecutaron secuencialmente después de MCP, sin reinicios, cambios de modelo o reintentos. Cada uno acredita coincidencia semántica, terminal completado, ACK y ausencia de identidad pendiente:

| Formato | Recibo real | Resultado |
|---|---|---|
| PNG | [imagen](nodia-ai-ai38-web-recovery-agentic-png-r01.json) | Correcto, aproximadamente 19 s |
| PDF | [documento](nodia-ai-ai38-web-recovery-agentic-pdf-r01.json) | Correcto, aproximadamente 30 s |
| WAV | [audio](nodia-ai-ai38-web-recovery-agentic-wav-r01.json) | Correcto, aproximadamente 24 s |
| WebM | [audio](nodia-ai-ai38-web-recovery-agentic-webm-r01.json) | Correcto, aproximadamente 29 s |

El [último control de texto Web R05](nodia-ai-ai38-web-stream-text-r05.json), UUID `1f61b2ad-5e88-4627-a410-96fe72567abb`, completó en 4,67 s con hash exacto y ACK en la sesión renovada `66cff290bc1e400b9443c8fae12b67bf`. Su [diagnóstico](nodia-ai-ai38-web-recovery-text-diag-r02.json) confirma candidata, EOF y cero consultas de recuperación. Es una inferencia de texto acreditada en la sesión final; no demuestra estabilidad o soporte de adjuntos.

Los [bindings finales](nodia-ai-ai38-web-recovery-bindings-r01.json), posteriores a todos los canarios, confirman misma época R04, selección/configuración conservadas y cero pendientes. Agentic conserva la sesión `e57c9b94bb9e45508eacebcff0e48fb2`, MCP y los cuatro MIME exactos. Web conserva la sesión del texto R05 y su lista de MIME verificados está vacía. La vigencia de cada formato se contrasta con estos bindings y su ventana VM posterior al arranque observado; los recibos individuales de formatos no incluyen un campo de época propio.

El [inventario final](nodia-ai-ai38-web-recovery-final-r01.json) comprueba 49 fuentes Python y 42 distribuciones, paquete Server owner-r01 de 3879 miembros / 2851 dist, configuración, esquema, selección, nginx y journal conservados. Los seis contadores nativos y tres SQL están en cero; API/worker y timers activos, diez backups cifrados y ninguno expirado al observar. El observer sucesor R05 corrige el pin del recibo de build: archivo VM y captura contienen LF y comparten SHA `9c6709…`; `313a…` corresponde sólo a la reserialización sin LF, no al archivo. El observer R04 se conserva sin ejecutar.

La [proyección SQL final](nodia-ai-ai38-web-recovery-sql-r01.json) conserva exactamente el snapshot histórico `94b274bc…`: chat, propuesta, ejecución, recibo y único gasto sintético pendiente de importe 1, sin volver a confirmarlo ni generar otros efectos. La [observación local](nodia-ai-ai38-web-recovery-local-r01.json) encuentra Vite 5174/PID 8840 y túnel 3100/PID 96468, HTTP 200 y raíz API 404 esperada. No se hicieron nuevas pruebas de UI autenticada, micrófono físico, R2 o frontera de 20 MiB.

La [validación consolidada](nodia-ai-ai38-web-recovery-validation-r01.json) contabiliza doce generaciones distintas: ocho completadas y cuatro desconocidas cerradas con ACK; ninguna inferencia repetida ni efecto comercial nuevo. Se preservan por separado las once generaciones del turno anterior. PDF/WAV/WebM Web no se despacharon después del PNG fallido. AI-38 sigue parcial por adjuntos Web y sus demás gates; no se conoce todavía la causa remota de la falta de candidata.

## Inicio acotado de AI-39

Por autorización del usuario, se inicia [AI-39](../mvp/85-nodia-ai-ai39-codex-runtime.md): ADR-072 propuesto, identidad de conciliación discriminada y canal privado Codex de herramientas con límites, lease y cancelación. Los contratos históricos Gemini y la política OCR conservan sus barreras. El protocolo nativo Linux acepta inicialización experimental y thread efímero con herramientas dinámicas en red/perfil aislados, sin cuenta, descubrimiento de modelos o inferencia.

La [validación parcial AI-39](nodia-ai-ai39-partial-validation-r02.json) acredita 62 checks; la suite final Server pasa 4475 pruebas / 246 archivos. La comprobación estructural histórica AI-15 conserva un fallo previo por exigir 0/67 capacidades frente a 74 vigentes; el registry es idéntico a HEAD y no se altera el validador congelado. No se despliegan estas fuentes Server ni se habilita Codex para chat: router, adaptador durable, worker/journal/gateway, recuperación entre procesos e integración SQL quedan pendientes. AI-39 está iniciado, sin aceptación operativa de AI-40.

## Verificación de entrega y siguiente punto pendiente

El validador consolidado pasa 185 comprobaciones; sus nueve tests offline y una mutación negativa contrastan la clasificación de modalidades/terminales y la falta de candidata. El validador parcial AI-39 se vuelve a ejecutar independientemente y conserva sus 62 comprobaciones. [Conocimiento y enlaces](nodia-ai-ai38-web-recovery-knowledge-r01.json): check sin build ni publicación, release `418900…` intacto; ficha runtime-policy rev19 y context-execution rev15 draft/unregistered. Ningún documento cambia de aprobación.

El siguiente diagnóstico Web debe distinguir la forma y cardinalidad de las respuestas de historial del CID nuevo (vacío, candidato antiguo o candidato aún no utilizable), con proyección acotada y sin contenido. No se concluye que una subida HTTP200 o el catálogo funcionante prueben procesamiento. Antes de repetir el resto de formatos, falta obtener un PNG correcto y mantener acreditada esa misma sesión. AI-39 continúa con composición por proveedor y adaptador durable, enlazando el canal privado a checkpoint, lease/fence, presupuesto de todas las RPC, gateway y terminal/ACK antes de habilitarlo.
