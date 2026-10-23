# AI-38 — MCP después de tools/list y revalidación de adjuntos

Fecha: 2026-10-22. Entorno: VM Linux local. Continúa el [diagnóstico de reserva](nodia-ai-ai38-profile-reservation-r01.md) sin reescribir su fallo MCP ni las pruebas de épocas anteriores. No hay aprobación documental o publicación nueva.

## Investigación y alcance

La [revisión de fuentes y protocolo](nodia-ai-ai38-mcp-post-list-review-r01.md) conserva el rol `inheritMcp` y los contratos actuales. Tres procesos stdio sintéticos muestran que errores de métodos distintos y en órdenes distintos pueden producir el mismo resumen previo de seis RPC; también que el puente sigue respondiendo a tools/list y ping después de un rechazo. Esto revela pérdida de información en el resumen, sin acreditar una causa del timeout real.

El [inventario público del runtime](nodia-ai-ai38-mcp-post-list-readonly-r02.json) verifica FIX073f, contenedor9b078 y la época2026-10-22T19:48:35.342867871Z;47 fuentes públicas idénticas, CLI1.3.1 con SHA512 comprobado y sin fuente distribuida. La copia local de cinco archivos contiene backlog diferente: no se empaqueta ni adopta. La presencia de literales MCP en el binario no demuestra su ejecución. El primer scanner R01 se conserva como diagnóstico incompleto, sucedido explícitamente por R02.

## Canario real nuevo, sin cambios de adaptador

El [wrapper deliberado](scripts/nodia-ai-ai38-profile-reservation-mcp-post-list.py) reutiliza driver/harness congelados, exige conciliación/ACK del intento anterior y misma época, y permite un solo nuevo despacho en un directorio propio. Dos controles offline verifican las guardas. No se pasa el UUID anterior a la inferencia; no hay loop o retry automático, restart, login, cambio de modelo, permisos o plazo.

El [canario nuevo](nodia-ai-ai38-mcp-post-list-live-r01.json), conexión2 y su selección High persistida, completa una generación: nonce correcto, un callback, un resultado, atestación y ACK; `supports_mcp_after:true` y cero identidad nativa pendiente. UUIDf24ce22a… distinto del anterior486e16be…. La selección, configuración y sesión coinciden con las del diagnóstico previo; no se escribe SQL de negocio. Los [controles de ejecución](nodia-ai-ai38-mcp-post-list-control-r02.json) y la [captura de época](nodia-ai-ai38-mcp-post-list-epoch-r02.json) fijan los hashes reales. Las primeras capturas R01 de esos dos archivos quedaron vacías por falta de sudo al leer archivos del operador root; se conservan y R02 sólo repite la lectura, nunca la generación.

El [observador IPC](nodia-ai-ai38-mcp-post-list-ipc-r01.json) lee únicamente los eventos efímeros de un candidato en la ventana exclusiva, sin payloads, nombres libres, parámetros, logs crudos o bytes de sesión. Muestra siete ordinales: error `other/-32000` en1, initialize correcto en3, initialized en4, tools/list correcto en5 y tool_request en7. En el puente FIX, -32000 corresponde a la guarda previa a ready; ese rechazo no impidió completar esta ejecución. **No explica por sí solo el timeout histórico**, cuyo orden no se conservó.

Los primeros cinco eventos se observaron juntos: se conoce el orden por ordinal, no el instante exacto de cada emisión. La respuesta success de tools/list acredita su construcción; el callback/nonce y el terminal acreditan el recorrido MCP completado. No se atribuye un UUID a cada archivo por sus timestamps: el observador registra candidato único y misma época, mientras el recibo nativo vincula el canario exacto. Los timestamps de VM quedan dentro de su ventana; el reloj Windows atrasado no se cruza con ellos.

MCP queda acreditado en esta época sin un parche causal adicional. El fallo previo permanece como timeout de causa desconocida; el éxito actual no demuestra estabilidad temporal continua, cuota ilimitada o disponibilidad de otros modelos/conexiones.

## Modalidades y cierre

La [primera cohorte](nodia-ai-ai38-mcp-post-list-modalities-r01.json) completa los cuatro formatos Agentic y PNG/PDF Web, todos con semántica, MIME y ACK exactos. WAV Web retorna502/chat_result_unknown al agotar120s; se concilia como abandoned_unknown, con ACK y sin identidad pendiente. WebM no se inicia. El campo agregado unknown_native_state expresa que el último resultado no completó satisfactoriamente, no que su identidad siga pendiente; el recibo del intento y el [inventario quieto](nodia-ai-ai38-mcp-post-list-web-audio-quiet-r01.json) acreditan el cierre.

La [traza WAV cerrada](nodia-ai-ai38-mcp-post-list-web-audio-diag-r01.json) distingue subida HTTP200/788ms y metadata explicit-audio/1 aplicada de generación HTTP200 sin candidata: dos chunks/224bytes, sin EOF, timeout en generation a120004ms y cierre completo de cliente/stream. No falla en validación JSON, y una referencia de upload no prueba procesamiento del audio. La causa concreta de la falta de respuesta permanece desconocida.

La [observación posterior](nodia-ai-ai38-mcp-post-list-web-binding-r01.json) confirma nueva generación Web1765b12… frente a9f1e0bf…, misma selección/configuración y formatos verificados vacíos. Los dos positivos Web de la cohorte anterior son históricos de esa sesión; no se trasladan a la nueva. Agentic y MCP conservan sus bindings y no se repiten.

El [sucesor Web R02](nodia-ai-ai38-mcp-post-list-web-modalities-r02.json), con guardas sobre la nueva generación y orden WAV→WebM→PNG→PDF, permite hasta cuatro canarios nuevos. WAV completa semántica y ACK; WebM agota120s y cierra abandoned_unknown/ACK, sin pendiente. PNG/PDF no se inician en esa cohorte. El [diagnóstico WebM](nodia-ai-ai38-mcp-post-list-webm-audio-diag-r01.json) repite el patrón: upload200/968ms, metadata audio aplicada, generación200, dos chunks/224bytes, cero candidatas/EOF ausente y timeout en generation. No demuestra una falla de JSON o una causa upstream concreta.

El [snapshot previo a restaurar imágenes](nodia-ai-ai38-mcp-post-list-current-bindings-r01.json) confirma otra generación Web383837c… sin formatos; WAV del sucesor también queda histórico. Agentic mantiene MCP y sus cuatro MIME. Se intenta sólo [PNG](nodia-ai-ai38-mcp-post-list-web-png-r04.json) como control visual independiente: también retorna unknown/ACK tras120s. Su [traza](nodia-ai-ai38-mcp-post-list-web-png-diag-r01.json) confirma upload200/683ms, generación200, dos chunks/224bytes y cero candidatas. El adaptador de audio no intervino y no se llegó a reply_validation. Por tanto el problema observado **no queda limitado al audio**. Se detiene PDF; no se ejecuta un canario PDF final ni se repiten estas generaciones desconocidas. La captura PNG R03 vacía corresponde a un path WORK rechazado antes de crear el directorio o despachar; R04 es el intento real.

## Estado vigente al cierre

La [observación final](nodia-ai-ai38-mcp-post-list-current-bindings-r02.json) distingue metadata de inferencia y conserva la misma época FIX. No se prestan pruebas entre generaciones:

| Capacidad | Agentic, selección y sesión conservadas | Web, última generación6c68e303… |
| --- | --- | --- |
| MCP | Nonce/callback/atestación/ACK verificados | Deshabilitado por contrato |
| PNG | Verificado | Sin prueba vigente |
| PDF | Verificado | Sin prueba vigente |
| WAV | Verificado | Sin prueba vigente |
| WebM | Verificado | Sin prueba vigente |

Web sigue `available:true` por sesión/catálogo, con `verified_attachment_media_types:[]`. Esa observación no acredita inferencia exitosa, JSON válido o procesamiento de archivos en la sesión actual. Sus tres positivos anteriores (PNG/PDF de primera cohorte y WAV de segunda) permanecen como evidencia histórica; no se presentan como capacidades actuales. El resultado es **MCP y formatos Agentic aceptados; Web pendiente**, sin adjudicar el timeout a cuotas, credenciales, modelo, MIME o SDK/proveedor cuando no existe evidencia causal. No se amplían plazos ni permisos para ocultarlo.

Contabilidad de esta entrega: once generaciones nuevas con UUID distintos y once ACK, ocho completadas y tres desconocidas conciliadas. Incluye un canario MCP, siete de la primera cohorte, dos del sucesor Web y uno PNG final. El fallo MCP486e… de la entrega previa se conserva en la cadena anterior y no se cuenta como éxito ni se borra. Cero replay, confirmaciones humanas nuevas o efectos comerciales. Fixtures sintéticos; no es nueva aceptación del micrófono físico, storage R2, subida UI, archivos de20MiB o combinaciones archivo+MCP.

La [proyección SQL final](nodia-ai-ai38-mcp-post-list-sql-r01.json) conserva exactamente el corte anterior: seis mensajes/tres runs y un único movimiento pendiente de importe1 con su ejecución/recibo históricos. El [inventario final completo](nodia-ai-ai38-mcp-post-list-final-r02.json), posterior al snapshot de capacidades, conserva3879 miembros Server owner-r01/2851 outputs,47 fuentes Python y42 distribuciones, esquema/selección, procesos API/worker, misma época Gemini, journal abierto y ocho backups sin vencidos o intenciones pendientes. Cero artefactos nativos/SQL pendientes, sin restart/adopción o migración. El [primer inventario de esta investigación](nodia-ai-ai38-mcp-post-list-final-r01.json) es anterior a los canarios y se conserva como tal.

La [verificación local](nodia-ai-ai38-mcp-post-list-local-r01.json) mantiene Vite5174 y puente3100 loopback identificados, HTTP200 de Vite y404 en la raíz nginx privada; ningún nuevo shell SPA o panel UI. No se repiten las recargas aceptadas en la misma época ni suites de aplicación sin cambios: la QA Linux474 de FIX y su inventario exacto siguen siendo antecedentes, no pruebas nuevas. El trabajo nuevo añade tres controles stdio sintéticos, nueve del observador y dos guardas por cada wrapper nuevo, separados de las inferencias reales.

La [validación consolidada](nodia-ai-ai38-mcp-post-list-validation-r01.json) pasó sus 39 comprobaciones. El [control del conocimiento](nodia-ai-ai38-mcp-post-list-knowledge-r01.json) también pasó y conservó la publicación existente, sin emitir un nuevo build.

Ficha runtime-policy rev18 draft/unregistered/approval null,31 fichas aprobadas/74 capacidades, release418900… y77 candidatas sin publicar conservados. **AI-38 sigue parcial** por inferencia/formatos Web y los otros gates externos/publicación/retención. El siguiente diagnóstico debe observar el stream Web sin candidata y mantener selección, privacidad, cierre y ausencia de replay; no convertir estas tres respuestas HTTP200 en un resultado de modelo exitoso.
