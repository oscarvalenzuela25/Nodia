# ADR-066 — Profundidad del catálogo MCP y de su envoltorio privado

> Estado: propuesto
> Fecha: 2026-10-19

## Contexto

El [control previo al arreglo](../../evidence/nodia-ai-ai36-c05-preferences-stdio-control-pre-fix.json) reproduce un defecto con los nueve descriptores exactos de la ejecución de preferencias C05: el esquema de preparación tiene profundidad14, el catálogo16 y el manifest17, contando la raíz como cero. `McpTool` y `validate_catalog` admiten los descriptores, pero `read_manifest` vuelve a aplicar16 al objeto que contiene el catálogo. El hijo stdio real termina con exit2 antes de responder a `initialize`. El rechazo también afecta al lector del manifest que utiliza el hook.

La [continuación R02](../../evidence/nodia-ai-ai36-c05-r02-acceptance.md) ya había acreditado el rol `inheritMcp` con un canario pequeño. Su ejecución de preferencias agota el plazo sin RPC o callbacks; el defecto local reproducido es compatible con ese resultado, sin explicar por sí solo los timeouts de descubrimiento donde sí se observan RPC.

## Opciones consideradas

### Aumentar la profundidad global del JSON

- Ventajas: admite el manifest de este caso.
- Desventajas: amplía también argumentos y mensajes que no necesitan ese nivel. Se descarta porque confunde el límite del dato con el de su envoltorio.

### Reducir o truncar los esquemas publicados

- Ventajas: puede reducir bytes en algunos catálogos.
- Desventajas: cambia contratos para acomodar un lector inconsistente; otro catálogo permitido en el borde volvería a fallar. No resuelve la garantía del transporte.

### Presupuestar por separado el envoltorio cerrado

- Ventajas: conserva el límite del catálogo y permite exactamente el nivel estructural adicional del manifest generado por Nodia.
- Desventajas: requiere validar la forma del envoltorio y volver a validar el catálogo como raíz independiente para que ese nivel adicional no amplíe los datos admitidos.

## Decisión

Implementar la tercera opción dentro del alcance autorizado. Mantener16 como profundidad predeterminada de `bounded_json`, de los catálogos y de los argumentos/RPC entrantes. El lector del manifest utiliza17 exclusivamente para su envoltorio, rechaza campos no registrados y revalida `tools` con el límite16 y los presupuestos de bytes/cardinalidad actuales. Los demás campos deben respetar la forma plana y los techos de la política vigente.

La respuesta `tools/list` se construye a partir del catálogo ya validado; su profundidad18 no autoriza un parser entrante más permisivo. Se mantienen admisión por perfil, permisos, contador RPC/herramientas, contexto acumulado, deadline, confirmación humana y recibos. No se modifica el modelo, esfuerzo, wire HTTP o catálogo publicado para reparar este límite interno.

## Consecuencias

- Se puede transportar un catálogo admitido en el borde sin rechazarlo por el nivel añadido por el supervisor.
- Deben seguir fallando catálogos de profundidad17, manifests con extras, duplicados, valores no finitos y cargas que superen los límites existentes.
- La comprobación aislada debe usar los nueve descriptores exactos, materialización real, stdio real, hook y limpieza; un consumidor de CLI sintético no acredita inferencia.
- El nuevo build necesita QA Linux aplicable y un canario real de su propia sesión antes de repetir los casos pendientes. Se conservan los resultados previos sin convertirlos en aceptación del arreglo.
- El ADR sigue propuesto. La causa de otras demoras del CLI/proveedor permanece pendiente de evidencia independiente.

## Referencias

- [ADR-065](ADR-065-nodia-ai-owned-mcp-execution-role.md).
- [Puente stdio](../../../nodia-gemini-microservice/native_mcp_stdio.py), [admisión del catálogo](../../../nodia-gemini-microservice/native_context_budget.py), [sesiones MCP](../../../nodia-gemini-microservice/native_mcp_sessions.py).
