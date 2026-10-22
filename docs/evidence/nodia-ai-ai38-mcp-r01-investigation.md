# AI-38 — Investigación MCP Agentic R01

Fecha: 2026-10-20. Resultado: transporte MCP verificado con la conexión real en la época actual de la VM Linux. La causa del timeout histórico sigue sin acreditarse. AI-38 y C05 conservan sus otros pendientes.

## Fallo de entrada y límites del diagnóstico

El [canario anterior](nodia-ai-ai38-mcp-canary-r01.json) terminó `mcp_result_unknown`. La [lectura estructural de sus logs preservados](nodia-ai-ai38-mcp-r01-runtime.md) localiza `TimeoutError` a los 120.047 ms: fase `running_cli`, último estado `prompt_received`, seis RPC y cero herramientas/callbacks. Los 1.175 `error=none` eran trazas normales del middleware, no errores del proveedor; 1.165 accesos correspondían al polling. No hay evidencia de cuota agotada, sesión inválida o fallo de red.

Los seis RPC históricos no identificaban métodos ni respuestas. Tampoco se capturaba el recibo del hook al abandonar por timeout: su ausencia no probaba un fallo del hook. La [revisión del puente](nodia-ai-ai38-mcp-r01-bridge-review.md) confirma que `mcp_result_unknown` procede del evento nativo de incertidumbre; no es la clasificación de un timeout HTTP de Node.

## Cambio mínimo y verificación offline

Se conservan diagnósticos del hook también ante timeout, cancelación o terminal de error. Los eventos RPC técnicos añaden método cerrado, resultado y código JSON-RPC; el resumen distingue respuesta construida por el puente de consumo por el CLI. El callback de dominio conserva su forma y límite de 64 KiB; no hay republicación de callbacks, presupuestos ampliados, cambio de herramientas, permisos, modelo o deadline.

El [candidato mínimo](nodia-ai-ai38-mcp-r01-candidate.md) deriva de la imagen operativa `061552…`: cambia exclusivamente `native_mcp_sessions.py` y `native_mcp_stdio.py`; las otras 45 fuentes públicas comparadas y la configuración permanecen idénticas. Imagen final `sha256:b8efad6217a4f04cb135db027fd899c1826b39c3a16154cca79f1b4f0deb977e`.

- Windows: 473 casos, 471 correctos y dos omisiones históricas.
- Linux: 442/442 correctos, cero omisiones, sin red, perfiles o entorno operativo.
- Las 31 pruebas excluidas del candidato corresponden a tres módulos de cambios locales ajenos a estas dos fuentes: CLI alternativo (11), timeout de metadatos R05 (5) y contrato de factura C03 (15). No se afirma paridad con todo el árbol local.

## Prueba real de transporte

La [activación](nodia-ai-ai38-mcp-r01-activation.json) pausó API/worker, comprobó quietud SQL y nativa y detuvo el único propietario previo antes de arrancar el candidato. Conservó los seis montajes, entorno, UID, puertos y recursos. Node operativo mantuvo 932 archivos y su hash `bd07328…`. Se preparó una reversión que verifica quietud y elimina exclusivamente el drop-in propio; no restaura credenciales ni borra resultados inciertos.

El [canario live01](nodia-ai-ai38-mcp-r01-live01.json), entre 19:16:14.908 y 19:17:28.095 UTC de la VM, utilizó el adaptador Node congelado del candidato01 con PostgreSQL read-only. El modelo y esfuerzo procedían de la proyección de la conexión configurada, sin sustituciones:

| Dato observado | Resultado |
|---|---|
| Conexión | Gemini ID 2, `token_plan_agentic` |
| Selección persistida | `gemini-3.8-flash-high`, esfuerzo `high` |
| Starts solicitados/admitidos | 1 / 1 |
| Callback sintético | 1, argumentos vacíos y nonce verificado en la respuesta final |
| RPC observados por el adaptador | 7 |
| Entrega de resultado / atestación / ACK | 1 / 1 / 1, correctos |
| MCP antes / después | `false` / `true` |
| Conciliación por error / replay | 0 / 0 |
| Identidad pendiente / escrituras SQL / efectos comerciales | Ninguna / 0 / 0 |

La [captura privada de Docker y su proyección](nodia-ai-ai38-mcp-r01-terminal-capture.json) conserva 192.396 bytes: 531 HTTP200, incluidos los 518 polls de esta prueba, sin errores del middleware. No contiene un registro `nodia_ai_mcp_terminal` de éxito: el código lo emite en nivel INFO; el filtrado por configuración de logging es una hipótesis, no una observación acreditada. No se rellenan métodos RPC o recibos del hook ausentes en esa captura. El nonce, la validación terminal, `/attest` y ACK comprobados por el arnés acreditan el recorrido exitoso.

El control de conversación sin MCP quedó innecesario y no se ejecutó. No hubo otra inferencia, cambio a Web/API, modelo alternativo o incremento de tiempos. Un éxito después de reiniciar no demuestra que el parche diagnóstico haya corregido la causa del timeout; tampoco acredita estabilidad continua.

## Estado de entrega y pendientes

Se conservaron las dos fuentes diagnósticas en el runtime para mantener la atestación de la instancia que pasó el canario. El [recibo de reanudación](nodia-ai-ai38-mcp-r01-resume.json) acredita los cuatro servicios originales activos sin otro reinicio Gemini: contenedor `802d6d…`, inicio `2026-10-20T19:14:35.412657745Z`, mismo Node932 y cero pendientes antes de reabrir consumidores. El descriptor `ai38-mcp-r01.conf` referencia la imagen exacta y convive con el drop-in anterior intacto; el [control de operación](scripts/nodia-ai-ai38-mcp-r01-runtime-control.py) conserva el modo `restore` para revertir tras conciliación/quietud. Un reinicio posterior invalida la atestación en memoria y exige evidencia de esa nueva época.

La [observación posterior a reanudar](nodia-ai-ai38-mcp-r01-postresume-observe01.json) realizó dos consultas no generativas: MCP sigue `true`, selección/configuración/sesión/época coinciden con el canario y no hubo nuevos inicios, conciliaciones o ACK. Los cuatro servicios están activos y `/api/v1/` respondió HTTP200; esa ruta acredita disponibilidad HTTP, no readiness completa de dependencias. El [inventario final](nodia-ai-ai38-mcp-r01-final-inventory.json) y el [cierre nativo](nodia-ai-ai38-mcp-r01-final-native-closure.json) conservan Node932/hash, entorno/montajes y cero pendientes SQL, pruebas nativas o temporales.

Esto adopta exclusivamente el diagnóstico Python mínimo. Los paquetes Node/Client completos de AI-38 no se adoptaron. No se publicaron herramientas, fichas o modalidades; no se ejecutaron operaciones de negocio, migraciones ni acceso a R2. C05 mantiene cuatro de siete aceptadas históricamente y tres pendientes. Se conserva aparte el riesgo adyacente de clasificación `not_dispatched` tras un inicio admitido, descrito en la revisión del puente; no fue observado en este canario ni corregido mediante una excepción al contrato productivo.

Pendientes: explicar una eventual recurrencia con los diagnósticos ahora preservados, completar la aceptación por capacidad/modalidad de AI-38 y los gates restantes por entorno. No se da por corregido un fallo de proveedor cuya causa todavía es desconocida.
