# AI-38 — Lectura previa del timeout después de tools/list

Corte VM: 2026-10-22, 20:42–20:43Z. Investigación de sólo lectura, sin generación, HTTP nativo, ejecución del CLI, reinicios ni cambios de configuración.

## Hechos comprobados

- [Inventario R02](nodia-ai-ai38-mcp-post-list-readonly-r02.json): imagen FIX `073f319f…`, contenedor `9b07866b…` y época `2026-10-22T19:48:35.342867871Z` conservados. Las 47 fuentes Python coinciden con el plan FIX aprobado para adopción.
- [Comparación local](nodia-ai-ai38-mcp-post-list-source-drift-r01.json): 48 fuentes locales; 42 iguales, cinco diferentes (`main.py`, `nodia_ai_chat.py`, `agentic_service.py`, `agentic_cli.py`, `request_guard.py`) y `invoice_mcp_contract.py` adicional. La suite del workspace no acredita por sí sola la imagen desplegada.
- CLI instalado: ELF público de 211.026.152 bytes en la instalación 1.3.1; SHA512 `f57ad0a0…` idéntico al lock oficial. La instalación contiene `agy` y `verified.json`; no distribuye código fuente.
- El intento terminado `486e16be-f1e1-4b53-b19b-b34fe2a62ae2` conserva seis RPC agregados: initialize1, initialized1, tools/list1, other3; tools/call0. Dos respuestas correctas, un error y tres notificaciones. La última respuesta retenida es `other/notification`, con error_code nulo.
- [Fragmentos públicos acotados del binario](nodia-ai-ai38-mcp-post-list-static-excerpts-r01.json) contienen literales MCP de listado, notificaciones y logging. Son constantes compiladas; no prueban qué métodos emitió este intento ni su orden.
- [Cierre](nodia-ai-ai38-mcp-post-list-final-r01.json): API/worker originales de owner-r01 activos, misma época FIX, cero pendientes SQL/nativos/temporales, journal abierto sin entradas no confirmadas y ocho backups cifrados vigentes; timers activos.

## Límites de evidencia

El bridge actual transforma métodos no enumerados en `other`. El capturador terminal agrega eventos y sólo guarda `last_response`; los archivos IPC originales pertenecen al directorio temporal eliminado al cerrar la ejecución. No es posible recuperar retrospectivamente el método exacto ni el código del error anterior. No se reconstruyen a partir de constantes del binario.

La revisión estática de `native_mcp_stdio.py` identifica que métodos con ID desconocidos caen en `-32602`; las notificaciones sin ID se consumen sin respuesta. Es una compatibilidad que investigar, no la causa demostrada del timeout.

El inventario R01 queda sucedido por R02: el primer escáner usaba pertenencia directa sobre `mmap`, que no comprobaba correctamente subcadenas. R02 usa `find`; no se atribuye significado a los resultados negativos de R01.

## Observador preparado y verificación coordinada

[Observador IPC](scripts/nodia-ai-ai38-mcp-post-list-live-ipc-r01.py), SHA256 `b0a90844ea0829a8e33265aae370450d3e22901d550b10c16e563bd53a2cfc70`: un único directorio temporal MCP, sólo `bridge/requests/*.json`; 100 ms por muestreo, máximo180 s, 128 archivos de64 KiB y256 transiciones. Proyecta ordinal, contadores, clase y diagnóstico RPC cerrado; omite nombres, argumentos y cuerpos. Aborta ante varios candidatos o límites inválidos. Las actualizaciones observadas no demuestran estados intermedios que ocurran entre muestreos.

[Pruebas sintéticas](scripts/nodia-ai-ai38-mcp-post-list-live-ipc-tests-r01.py): nueve correctas; sin servicios, perfiles o red.

Tras revisión y autorización de root, se ejecutó únicamente el observador en UID10001. Root ejecutó por separado una intención generativa nueva. [Captura IPC](nodia-ai-ai38-mcp-post-list-ipc-r01.json), SHA256 `621e85f130e55826f967c7c1b3ac5a7961c7e57d2a6a0d2eeea10753514df25e`: final `candidate_removed`, exit0, stderr0, siete ordinales, misma época FIX antes/después y ninguna generación ejecutada por el observador.

| Ordinal | Método cerrado | Respuesta |
| --- | --- | --- |
| 1 | other | error -32000 |
| 2 | other | notification |
| 3 | initialize | success |
| 4 | notifications_initialized | notification |
| 5 | tools_list | success |
| 6 | other | notification |
| 7 | tool_request | Sin diagnóstico RPC; solicitud de herramienta |

Los cinco primeros eventos aparecen en el primer muestreo que los vio, VM20:47:11.226Z. Se conoce su orden ordinal; no se atribuyen esos timestamps al instante de emisión. El séptimo se observó en VM20:47:28.440Z. Los nombres `other` permanecen desconocidos. La atribución corresponde a un único candidato en la ventana exclusiva coordinada por root; los archivos no contienen un enlace UUID exportado por este observador. `host_capture_began_at_utc` procede de Windows y no debe compararse con el reloj VM.

El [canario independiente de root](nodia-ai-ai38-mcp-post-list-live-r01.json) completó callback con nonce, resultado, atestación y ACK, sin pendiente ni efecto comercial. El error -32000 ocurrió antes de initialize y tools/list en esta ejecución exitosa; su presencia aislada no explica el timeout anterior. Esta observación no corrige ni identifica retrospectivamente la causa del intento fallido. No hubo reinicio o parche de protocolo entre ambos intentos.
