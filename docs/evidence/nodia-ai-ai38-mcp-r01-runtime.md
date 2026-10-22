# AI-38 MCP R01: diagnóstico del runtime preservado

Observación de solo lectura: 2026-10-20 19:01 UTC. No se repitió la inferencia,
no se consultó `/observe`, no se reiniciaron servicios ni se modificaron modelos,
sesiones, relojes o archivos remotos.

## Hechos

- El log privado de AI-38 conserva SHA256
  `cbb3c909401afbf3de33c3fdc879eb93178d32b5554448ec6fd7e0d2227db50f`:
  423.190 bytes y 2.354 líneas. No se emitió su texto bruto.
- Las 1.175 apariciones del campo de middleware `error` corresponden a
  `error=none`; no son errores. Hay 1.175 respuestas HTTP200, incluidas
  1.165 consultas de eventos, una admisión, una cancelación, una conciliación
  y un ACK. Las coincidencias numéricas 403/429/503 son subcadenas, no estados
  HTTP observados.
- El diagnóstico terminal registra `TimeoutError`, fase `running_cli`,
  `elapsed_ms=120047`, seis mensajes RPC, cero callbacks y `gate_verified=false`.
  El CLI emitió dos eventos y 1.814 bytes stdout: el último estado fue
  `prompt_received`, sin herramientas, resultado terminal ni stderr. La edad
  del último evento fue 116.211 ms, consistente con unos 3.836 ms de progreso
  inicial y ausencia de eventos posterior. Esta diferencia describe eventos;
  no mide el tiempo de inferencia interno del proveedor.
- Los seis RPC y los 540 bytes adicionales del contexto controlado demuestran
  actividad del puente. No conservan el método ni la clase de respuesta de cada
  RPC: no prueban por sí solos handshake correcto o entrega del catálogo.
- El diagnóstico conservado del log CLI admite 31.376 bytes y clasifica cero
  indicadores de transporte/proveedor/estado HTTP. Informa truncamiento a
  128 líneas. Ausencia de indicadores no prueba ausencia de un fallo upstream.
- La imagen sigue siendo `0615520c…`, el contenedor conserva arranque del
  2026-10-19, usuario `nodia` y puerto privado `127.0.0.1:8000`.
  Entorno y mounts coinciden con el baseline privado.
- El binario `agy` tiene 211.026.152 bytes; su SHA512 completo se conserva en
  el JSON y coincide con el pin configurado. No se ejecutó el binario.
  La variable de versión está ausente: esta lectura no entrega una versión
  nueva del ejecutable. El CLI tenía 240 s configurados; el límite de este
  flujo de chat conservado es 120 s. No se aumentó ninguno.
- Los cuatro servicios originales continúan activos. Los 932 outputs Node
  conservan el manifiesto `bd07328b490756cb63a3054e44161d7e9c36d14e38b5acfe841cdb963024e792`.

## Inferencia y próximo discriminante

El fallo ocurre después de la recepción inicial del prompt por CLI y antes
de cualquier herramienta o respuesta terminal observadas. La evidencia no
permite atribuirlo a cuota, credencial, red, modelo, rol o handshake MCP.

Antes del próximo canario, conservar un diagnóstico cerrado de cada RPC
(método permitido, clase de respuesta y código de rechazo), sin argumentos,
documentos, resultados o identidades personales. Esto distingue handshake o
catálogo rechazados de un estancamiento posterior del CLI/proveedor. La lectura
de logs debe clasificar todos los bytes admitidos sin que el muestreo de líneas
oculte errores; mantener límites y no conservar texto bruto en reportes públicos.
Una prueba sintética del protocolo puede comprobar esos diagnósticos sin cuenta.

El próximo canario real sigue necesitando su propia conciliación y ACK. Ni
el funcionamiento HTTP ni la identidad del binario acreditan `supports_mcp`.

## Evidencia

- [Proyección sanitizada](nodia-ai-ai38-mcp-r01-runtime.json).
- [Script de lectura](scripts/nodia-ai-ai38-mcp-r01-runtime.py).
- [Canario histórico](nodia-ai-ai38-mcp-canary-r01.json).
- [Recibo de archivos](nodia-ai-ai38-mcp-r01-runtime-receipt.json).

El diagnóstico terminal JSON procede del mensaje estructurado propio
`nodia_ai_mcp_terminal`; no se incluyen prompts, resultados comerciales,
credenciales, argumentos CLI ni valores arbitrarios del log.
