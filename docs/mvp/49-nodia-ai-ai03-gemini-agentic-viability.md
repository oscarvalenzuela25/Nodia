# NodiaAI — AI-03: Gemini Agentic y MCP

> Estado: spike técnico verificado en VM Linux; herramientas/runtime de negocio sin publicar
> Fecha local: 2026-10-14, America/Santiago
> Evidencia: [informe sanitizado](../evidence/nodia-ai-ai03-gemini-agentic-viability.json)
> Dependencias: [plan45](45-nodia-ai-implementation-plan.md), [AI-01](46-nodia-ai-ai01-contract-baseline.md), [política48](48-nodia-ai-mode-routing-policy.md), [runbook CLI](agentic-cli-runbook.md)
> Aprobación documental: pendiente; el cierre técnico no aprueba automáticamente documentos o producción

## Resultado

Agentic completó lectura y preparación mediante MCP con el modelo descubierto/configurado de la conexión2 (`gemini-3.8-flash-high`, intensidad configurada high), CLI1.3.1 y hash verificados. El recorrido registrado pasó **25 checks en cuatro procesos generativos y dos callbacks MCP**: disponibilidad sintética, preview de gasto sin ejecución, continuación por ID en otro proceso y reconstrucción del historial en una conversación nueva. Los recuerdos no incluyen los valores esperados en la pregunta; no repiten callbacks.

La prueba independiente de seguridad pasó **18 checks**: una llamada real `run_command` fue denegada por el hook y no creó el archivo canario; otro turno se canceló después de descubrir MCP y recibir el mensaje, antes de callbacks. No quedaron procesos CLI/MCP propios. Su resultado remoto sigue unknown y no se reenvía. Otro perfil completamente nuevo pasó **14 checks** con importe, fechas y recibo aleatorios tomados de un historial canónico sintético, sin copiar conversaciones anteriores ni ejecutar herramientas. Este último caso comprueba portabilidad del contexto; todavía no implementa persistencia en Nodia Server.

**175 pruebas aisladas correctas**:151 existentes de la imagen y24 nuevas/ampliadas de esta entrega, con overlay del transporte y fixtures. Incluyen intercambio stdio real local, JSON cerrado, permisos, presupuestos, cancelación/timeout de subprocess y separación de stdout/stderr. No equivalen a pruebas de Client/Server completos ni a inferencias externas en la suite.

AI-03 se cierra como prueba de viabilidad. No registrar herramientas de negocio, habilitar el drawer/switch o declarar todos los modelos/proveedores disponibles por este resultado. Web continúa sólo conversacional según48. Siguiente paso: AI-04.

## Causa del timeout y corrección

Se encontraron tres problemas distintos, con recibos en la evidencia:

1. En este contexto instalado, el CLI no cargó la configuración MCP de workspace; sí cargó `~/.gemini/config/mcp_config.json` dentro del home desechable. El hook global y su import absoluto también evitaron depender del descubrimiento de proyecto/cwd.
2. El CLI utiliza `call_mcp_tool`, con `ServerName`, `ToolName` y `Arguments` JSON serializado. El gate inicial esperaba herramientas directas. Ahora valida el servidor exacto, las dos herramientas registradas y su esquema interior; no concede servidores, comandos o permisos arbitrarios. Se entrega el catálogo exacto al modelo para evitar campos inventados como `house` en lugar de `property_id`.
3. Una llamada real llegó al servidor con **`tools/call.arguments` de tipo string**. MCP define argumentos objeto; el servidor estándar la rechazaba. La compatibilidad opt-in `--cli-json-string-arguments`, elegida por el supervisor tras verificar CLI1.3.1, decodifica una sola vez con parsing acotado y aplica el mismo DTO cerrado. El servidor estándar sigue rechazando strings por defecto; ni dominios ni schemas de herramientas se flexibilizan.

El CLI también llegó a emitir SUCCESS tras agotar su plazo, con respuesta vacía y sin structured_output. Ese estado no es éxito funcional: exigir salida tipada, identidad y recibos coherentes. No se incrementó el deadline ni se cambió de modelo/proveedor para hacer pasar el ensayo.

La compatibilidad pertenece al adaptador de esa versión observada. Antes de actualizar el CLI o incorporar otro cliente MCP, repetir el ensayo y retirar la conversión si el wire vuelve a ser estándar. No convertir este diagnóstico en una relajación global del MCP de Nodia. Las [herramientas MCP](https://modelcontextprotocol.io/specification/2025-11-25/server/tools) y el [transporte stdio](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports) son la referencia normativa; el defecto observado se sustenta en recibos propios, no en una promesa del proveedor.

## Recorrido y contexto

| Caso | Evidencia real | Límite |
|---|---|---|
| Selección | Seis modelos descubiertos; ID/esfuerzo exactos y binario comprobados | No generalizar a otros modelos/cuentas |
| Lectura MCP | Marcador aleatorio del resultado aparece en respuesta tipada | Fixture de disponibilidad, sin BD |
| Preparación MCP | Preview20000, estado awaiting_human_confirmation, executed:false | Sin executor, token o botón de negocio |
| Continuación | Mismo conversation_id entre procesos; recuerda importe/fechas | Requiere el mismo perfil nativo |
| Historial canónico | Nueva conversación recupera contexto, sin callbacks nuevos | El primer caso reutiliza el perfil del ensayo |
| Perfil nuevo | Recuerda valores/recibo aleatorios de historia sintética entregada | Ninguna conversación nativa copiada; no Server persistente aún |
| Denegación | run_command intentado, hook deny, canario ausente | No auditoría completa de escape OS |
| Cancelación | Mensaje recibido/MCP descubierto; CLI y hijos MCP terminados | Antes de callback; no prueba cancelación de efectos confirmados |

El protocolo observado fue2025-11-25. En el recorrido final hubo7 initialize/7 tools/list y2 tools/call completados/normalizados. Los errores de métodos auxiliares no publicados y las categorías por coincidencia de texto en logs no prueban que una herramienta exitosa fallara: la autoridad de este cierre son los recibos y la respuesta validada.

**Decisión técnica para el plan: adapter_states continúa sin activarse.** La recuperación canónica tiene un recorrido positivo independiente del perfil anterior; persistir IDs/perfiles sólo para acelerar continuidad nativa necesita justificación y bindings propios en AI-12. El historial, autoridad y efectos de Nodia no dependen del almacenamiento del CLI. El switch48 tampoco confirma escrituras.

## Harness, seguridad y recuperación

[Harness opt-in](../../nodia-gemini-microservice/experiments/probe_nodia_ai_agentic.py), [MCP sintético](../../nodia-gemini-microservice/experiments/nodia_ai_mcp_fixture.py), [gate](../../nodia-gemini-microservice/experiments/nodia_ai_agentic_gate.py), [diagnóstico acotado](../../nodia-gemini-microservice/experiments/nodia_ai_agentic_diagnostics.py), [tests MCP](../../nodia-gemini-microservice/tests/test_nodia_ai_mcp_fixture.py) y [tests de diagnóstico](../../nodia-gemini-microservice/tests/test_nodia_ai_agentic_diagnostics.py). No son imports de FastAPI ni endpoints productivos. El transporte existente añade únicamente un observer opcional de stderr; la semántica de OCR/permiso habitual no cambia.

Contenedor de la misma imagen con root readonly, cap-drop ALL, no-new-privileges, sin puertos, .env Nodia, BD, API keys o sesiones Web. Perfil/historia/logs propios en tmpfs. Se prestaron readonly dos archivos nativos Google administrados por el CLI, sin copiar valores, imprimirlos, hashearlos ni entregarlos como herramientas; más su bus privado de usuario. Es un arreglo de laboratorio, no una política productiva de renovación/backup.

Dos herramientas sólo: fixture_availability_read y fixture_expense_prepare. El run viene del supervisor; el modelo no lo elige. Se rechazan SQL, HTTP arbitrario, confirmación, herramientas/servidores desconocidos e I/O externo. No se usaron auto_approve, permissionOverrides ni dangerously-skip-permissions. Los casos inválidos de identidad, importes, estado, argumentos duplicados/doble serialización y esquemas extra no despachan.

Límites propios del harness:12 callbacks/128 mensajes por proceso MCP,64KiB por JSON,16 niveles/128 elementos por colección, auditoría128KiB y CLI stdout/stderr2MB; deadline120s y transporte125s. **El contador MCP se reinicia por proceso**: presupuestos globales de run/cola corresponden a AI-04/12, no a cuotas del proveedor.

Cada ensayo detuvo temporalmente al propietario Gemini y lo restauró en finally; perfil/contenedor propios eliminados. Postcheck: Web autenticado; Agentic disponible/con sesión; nodia-api, Gemini y Nginx activos. Frontend5174 y API/v1 a través de su proxy responden200; la respuesta API se verificó contra el endpoint público de Nodia. No se modificó selección/BD/policy OCR ni se desplegó el adaptador NodiaAI.

## Ensayos anteriores y alcance pendiente

El informe conserva las fases fallidas y el unknown original. El supervisor no reenvió inferencias inciertas: cada corrección se investigó con un contexto/run nuevo. Algunos agentes reintentaron herramientas dentro de un proceso fallido; eso refuerza la necesidad de presupuestos e idempotencia de negocio antes de publicación.

Se descartaron dos variantes de inyección PreInvocation: una produjo ERROR y otra no ejecutó las acciones. No cuentan como prueba de denegación; la evidencia positiva usa petición directa. También se registra un TypeError de overlay que ocurrió antes de lanzar generación, para no contar el intento de llamada Python como inferencia. Las categorías de log sólo clasifican texto y no exponen transcript, errores brutos o secretos.

Los hashes actuales identifican el checkout entregado. Loop y seguridad se ejecutaron antes de añadir el modo independiente canonical-only; ese agregado se comprobó aparte y no se atribuye retroactivamente a los otros ensayos. Los modos diagnósticos devuelven viable:false y exit1 por diseño; sus checks específicos y safety_passed/canonical_fresh_profile_passed distinguen diagnóstico correcto de viabilidad MCP.

Quedan para etapas posteriores: autoridad/grants y ToolGateway de todos los dominios, confirmación durable, cancelación después de efectos, concurrencia OCR/login y fences, presupuestos globales/colas, renovación y restauración prolongadas, purga/retención remota, SDK/runtime productivo y elegibilidad del switch. API, Windows/VPS y otros modelos requieren pruebas propias. No hay migraciones ni herramientas de negocio publicadas.

Fuentes de comportamiento declarado: [MCP del CLI](https://www.antigravity.google/docs/mcp/), [headless](https://www.antigravity.google/docs/cli/headless/), [hooks](https://www.antigravity.google/docs/hooks/) y [permisos](https://www.antigravity.google/docs/permissions/). La configuración global, el dispatcher y la compatibilidad se aceptan aquí sólo por los recorridos observados.

Verificación offline del informe: `node docs/evidence/scripts/validate-nodia-ai-ai03.cjs`. Valida artefactos/contratos/hashes; no autentica ni repite Python/inferencia.

