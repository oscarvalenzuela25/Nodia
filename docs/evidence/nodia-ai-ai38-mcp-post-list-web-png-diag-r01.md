# AI-38 — Timeout Web observado también con PNG

Intento `b68d874b-fd81-4c7c-a923-82b8dac78c5d`; ventana VM2026-10-22T21:07:27Z–21:09:34Z. [Diagnóstico cerrado](nodia-ai-ai38-mcp-post-list-web-png-diag-r01.json), SHA256 `cafb83caeb41596ac0fa4812ed65eac576a17683fd942f1cc8bd9e9f8632fc69`. Sólo lectura de registros existentes, sin inferencia, reintento, cambio de selección o reinicio.

| Etapa observada | Resultado |
| --- | --- |
| Subida | Una petición HTTP200,683ms; referencia no vacía con prefijo esperado |
| Generación | HTTP200 abierto a12015ms; dos chunks/224bytes |
| Progreso | Último chunk a61653ms; cero candidatos SDK; EOF no observado; cero recuperación |
| Cierre | TimeoutError en `generation` a120005ms; cliente y stream cerrados a120004ms |
| Adaptador de audio | scopedfalse/appliedfalse; no intervino en el PNG |

No se alcanza `reply_validation`; no hay evidencia de JSON de respuesta inválido ni de un rechazo MIME. La respuesta de subida no prueba procesamiento exitoso de la imagen y los chunks no son candidatos ni frames JSON. La causa upstream/SDK concreta sigue desconocida.

El patrón observado previamente con WAV y WebM aparece también con PNG, por lo que no se puede atribuir exclusivamente al audio o a su adaptador. No se afirma que todo uso Web falle: esta captura corresponde únicamente al intento PNG identificado. Root suspendió el PDF y las nuevas inferencias, y coordina el snapshot final de bindings y cierre SQL/nativo; no se reutiliza el snapshot anterior como si fuera posterior al PNG.

La época FIX073f/9b078 permanece idéntica durante esta lectura. Los registros proyectados no contienen audio/imágenes, texto, mensajes, tokens, headers ni logs crudos. Esta subtarea no modifica la atestación Agentic ni sustituye las pruebas de capacidades de una sesión por las de otra.
