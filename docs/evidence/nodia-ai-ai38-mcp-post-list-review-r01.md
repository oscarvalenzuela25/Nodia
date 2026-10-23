# AI-38 — Revisión offline del timeout después de tools/list

Fecha: 2026-10-22. Alcance: fuentes públicas congeladas, recibos cerrados y tres procesos stdio sintéticos. No se ejecutó CLI de proveedor, VM, SQL, navegador, inferencia o suite completa; no se modificó producción. Aplicadas las skills locales `backend-service-quality`, `python-microservice-quality` y `python-testing-patterns`.

La causa del timeout real continúa **desconocida**. Se identifica un hueco concreto de observabilidad: la agregación no permite determinar el método ni la posición del único error RPC. Un rechazo RPC aislado tampoco demuestra que el puente dejara de atender: los controles sintéticos observan respuestas posteriores por stdout.

## Fuentes y correspondencia con FIX073f

Comparadas con `target_public_python_hashes` del [build FIX](nodia-ai-ai38-profile-reservation-fix-build-r01.json):

| Fuente pública | SHA256 | Correspondencia |
| --- | --- | --- |
| `native_mcp_stdio.py` | `37b77325fff33b8b53ce30bc33c55ae3dd54e2f1e480fb7d515595e44c6cdd20` | Actual = FIX |
| `native_mcp_sessions.py` | `4e05adbd35fd2391e05f54952d839bbb3d7c14d3145609474ee6b2a1f6cbbb20` | Actual = FIX |
| `native_execution_agents.py` | `06871d65d2681257edcb2c8db9673ea8429688ac7ea894b91b8000b99f8004f6` | Actual = FIX |
| `native_cli_diagnostics.py` | `fc19ab0655d9c06f2985c9fcebfc2f2d236f863fbb7fd3eecc7fb83991bd2ffe` | Actual = FIX |
| `agentic_cli.py` congelado en `.tmp/ai38-mcp-r01-base-public/` | `3605f0f300c15cf8bc66b94b38ee8b09da40f3427a88844c0d3cd47785903d08` | Copia pública = FIX |

El `agentic_cli.py` del árbol actual tiene SHA `0397bfc364326036d77bf8c65e4c8162312d27ac23fd025c2b10e6d6199625ff`: **no es el runner desplegado**. No atribuir al runtime sus cambios locales ni empaquetarlo incidentalmente.

## Lo que los seis RPC permiten concluir

El [terminal real R02](nodia-ai-ai38-profile-reservation-mcp-terminal-r02.json), SHA `08ff1610072052ac787605e2cf1e627364cdeb1e47579e8c22584dfa3fe54b7c`, pertenece al intento `486e16be-f1e1-4b53-b19b-b34fe2a62ae2` en FIX073f/época19:48:35Z. Registra `running_cli`, `TimeoutError`, seis RPC, cero callbacks/tool steps, terminal CLI ausente y exit code desconocido. No acredita cuota/red/autenticación como causa.

La descomposición es exacta: initialize y tools/list suman dos respuestas `success`; initialized suma una notificación; los tres `other` contienen un error y dos notificaciones. Sin embargo, `other` agrupa métodos reconocidos por la lógica —por ejemplo notifications/cancelled— y métodos no reconocidos. No se conoce cuáles fueron los reales.

En [StdioBridge.handle](../../nodia-gemini-microservice/native_mcp_stdio.py), los métodos desconocidos con ID pasan por el mismo `-32602` que parámetros inválidos de tools/call; envelope inválido y petición previa a ready tienen otras ramas. El error code individual queda en el evento IPC, pero `capture_rpc_diagnostic` retiene solamente totales y `last_response`, sin historial de códigos/ramas. El [extractor terminal R02](scripts/nodia-ai-ai38-profile-reservation-mcp-terminal-r02.py) proyecta los totales y omite también ese último resultado. Los eventos efímeros ya purgados no pueden reconstruirse con otra generación.

El contador tools_list_successes se incrementa al **construir** la respuesta y reservar su presupuesto, antes de `stdout.buffer.write`/`flush` en `main`. No acredita escritura, flush ni consumo por el CLI. La serialización y flush están implementados; lo desconocido es su cumplimiento observado en ese intento.

## Controles offline ejecutados

El [script propio](scripts/nodia-ai-ai38-mcp-post-list-offline-r01.py) ejecutó el puente productivo exacto en tres procesos Python aislados, con archivos sintéticos temporales y sin importación de aplicación/SDK. [Recibo](nodia-ai-ai38-mcp-post-list-offline-r01.json), SHA `9405192ee4860bf8da16c73aadbd818b182fecb5a540d16959bee644bc07f5a6`:

1. resources/list sintético rechazado antes de tools/list: seis RPC y los mismos totales observados.
2. prompts/list sintético rechazado después de tools/list: mismos totales y mismo last_response, pero método y orden diferentes.
3. Rechazo seguido de tools/list y ping: ambas respuestas se leen en stdout; exit0 y cero herramientas de dominio.

Esto demuestra que el resumen es ambiguo y que un error no termina necesariamente el puente. **No identifica las peticiones reales ni demuestra que el CLI real tolere un rechazo específico.** El EOF de estos fixtures cierra el proceso; no reproducen una generación o su timeout.

## Rol inheritMcp

[execution_agent_definition](../../nodia-gemini-microservice/native_execution_agents.py) conserva `mainAgent:true`, `subagent:false`, `inheritMcp:true`, herramienta nativa finish y view_file sólo con adjuntos. `call_mcp_tool` se hereda, no se declara como herramienta nativa. El workspace temporal configura exclusivamente nodia_runtime; los hooks y el catálogo/grant siguen autorizando cada llamada.

El [metadato binario histórico](nodia-ai-ai36-c05-static-mcp-agent-metadata.json) acredita que CLI1.3.1 anuncia ese campo; la [aceptación C05-R02](nodia-ai-ai36-c05-r02-acceptance.md) y el [canario AI-38 anterior](nodia-ai-ai38-mcp-r01-investigation.md) acreditan ejecuciones completadas de esa política. No se transporta su atestación a FIX073f. No hay evidencia nueva para volver a declarar call_mcp_tool en tools, ampliar permisos o sustituir el rol.

El código valida `init.agent`/modelo después de terminar el CLI. En un timeout no se alcanza esa comprobación; `CliProgress.initialized` sólo prueba que llegó un evento init. Hace falta observar coincidencia de identidad en tiempo de recepción, sin exportar valores.

## Instrumentación cerrada propuesta y regresiones de valor

Sin cambiar comportamiento, permisos, presupuestos o reintentos:

- Clasificar métodos con enum finito adicional: resources/list, prompts/list, logging/setLevel y notificaciones progress/cancelled; los desconocidos siguen other. Conservar ordinal y tiempo monotónico relativo, código de error y razón cerrada de rama (envelope, pre-ready, unsupported_method, invalid_tool_params). No registrar método libre, IDs, params, prompts o schemas.
- Preservar historial acotado o contadores por código/razón; `last_response` solo no localiza el error anterior. Contar eventos truncados/ilegibles explícitamente.
- Distinguir respuesta constructed/write_completed/flush_completed con tamaño; flush_completed sigue sin significar consumo CLI. El diagnóstico no puede cambiar contadores de herramientas, sobrescribir/republicar callbacks o ampliar los64KiB.
- En el observador de init: init_count y agent_matches/model_matches boolean/null contra lo esperado, más tiempo relativo. Mantener intacta la validación terminal y la atestación MCP.

Pruebas útiles antes de activar: dos transcripciones de igual resumen distinguibles por nuevo diagnóstico; código/razón de cada rechazo sin contenido sensible; BrokenPipe/flush fallido conserva constructed sin fingir delivered; UTF8/64KiB y fallo de diagnóstico no cambian la respuesta original; init ausente/malformado/duplicado/coincidente/distinto permanece desconocido o no coincidente, incluso al cancelar. Reutilizar los casos existentes de callback exacto, presupuestos, política, cleanup y no replay. No repetir una generación incierta ni aumentar el deadline para compensar información ausente.

No hay una corrección causal de protocolo acreditada por esta revisión. El próximo control real debe capturar esa información en la misma época y conservar selección/grant, conciliación y ACK exactos; root coordina su alcance.
