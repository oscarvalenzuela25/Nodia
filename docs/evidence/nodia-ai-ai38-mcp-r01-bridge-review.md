# AI-38 MCP R01 — revisión del puente Node/Python

Fecha: 2026-10-20. Revisión estática y controles offline; sin inferencias, acceso a la VM o cambios al transporte productivo.

## Resultado comprobado

`GeminiNodiaAiAdapterUseCase.executeMcp()` emite `mcp_result_unknown` cuando el polling recibe un evento diferente de `tool_request` o `answer`. `NativeMcpSessions.fail()` emite el evento `unknown` para los errores terminales nativos. Por ello el resultado histórico R01 acredita que el proceso Python declaró incertidumbre; no identifica su causa. Un fallo HTTP del transporte Node se clasificaría como `adapter_transport_unavailable` y una envolvente de polling incompatible como `mcp_events_invalid`.

`probeMcp()` comparte el bucle de callbacks del worker. `diagnostic:true` permite el diagnóstico explícito sin atestación previa y solicita `/attest` al completar. No modifica el proveedor, modelo, intensidad, permisos o confirmación humana.

El arnés histórico AI-15 queda intacto. El nuevo `nodia-server/test/nodia-ai-ai38-mcp-diagnostic.mjs` conserva sus gates de conexión exacta, PostgreSQL read-only, un solo inicio y nonce, sin retry. Inyecta un wrapper del transporte real que registra exclusivamente contadores por endpoint cerrado, fases cerradas, identidad del intento, selección conocida, generaciones y las últimas cuentas válidas de RPC/solicitudes ocultas. No registra payloads, respuestas, nonce, tokens, texto del proveedor o URLs libres.

`null` significa que todavía no se observó un dato: callbacks permanece desconocido antes de configurar el probe; RPC permanece desconocido hasta un snapshot/progreso válido. Un snapshot con RPC cero registra cero aunque el adaptador todavía no invoque `onProtocolProgress`. Los contadores de requests reflejan invocaciones locales del transporte; no son prueba de inferencia aceptada por el proveedor.

## Hallazgo adyacente conservado

`NodiaAiAdapterTransport.request()` clasifica ciertos códigos, por ejemplo `runtime_generation_changed`, como `not_dispatched` sin distinguir el endpoint. Si ese error llega después de que `/mcp/start` devolvió `running`, el intento anterior sigue admitido. El arnés histórico omite conciliación por cualquier `error.outcome === 'not_dispatched'`; esa combinación podría perder el seguimiento de una identidad admitida.

El nuevo arnés conserva la conciliación por identidad si el inicio fue `running` o su admisión quedó incierta, aunque un endpoint posterior diga `not_dispatched`. Sólo omite la conciliación cuando no se solicitó el inicio o el transporte acreditó su rechazo previo a la admisión. El transporte y los contratos productivos no se modifican en esta revisión. Este hallazgo no explica el `mcp_result_unknown` histórico de R01.

## Próximo control real

Correlacionar la identidad del reporte nuevo con `nodia_ai_mcp_terminal`: fase, tipo de excepción, RPC, callbacks, estado terminal CLI y categorías estructurales. Preservar el log antes del ACK, que elimina el job en memoria. La conciliación/ACK no reproduce la generación ni acredita un nonce correcto por sí misma.

Controles offline realizados: sintaxis Node y Oxlint focal sin errores. El arnés nuevo no se ejecutó contra la conexión real durante esta revisión; la ejecución real y su aceptación corresponden a la coordinación principal de AI-38.
