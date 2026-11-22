# Consulta de productos sin ID con Agentic en la VM — 2026-11-21

Se probó el candidato `b09869e3`, catálogo `nodia-ai-business-pos/6`, con
un dueño ordinario de laboratorio y una copia aislada de once productos
activos del negocio. La pregunta dio el nombre del negocio y pidió el precio
vigente de cada producto y el regular cuando hubiera oferta. El mensaje
omitió el ID, los nombres de productos y los importes.

## Gemini Agentic y MCP

Se restableció el microservicio de laboratorio y se usó la conexión
configurada con `gemini-3.8-flash-high`, esfuerzo `high`. Una atestación
técnica de MCP completó y quedó acusada. En la prueba de negocio, el
puente registró un `tools/list` exitoso de descubrimiento con estas ocho
herramientas.

- `nodia_capabilities_describe`
- `nodia_capabilities_search`
- `nodia_capabilities_select`
- `nodia_entities_search`
- `nodia_knowledge_get`
- `nodia_knowledge_index`
- `nodia_reports_describe`
- `nodia_reports_run`

El diagnóstico nativo registró `TimeoutError` en el proceso local del CLI
tras 119 segundos. El turno quedó `unknown`, con cero llamadas de
herramientas, cero recibos y sin respuesta. No llegó a ejecución. El
resultado remoto quedó indeterminado. Se reconcilió el intento, se
confirmó el ACK y se retiró la base de ensayo sin repetir el envío.

SHA-256 del registro sanitizado de Gemini: `b9738e75a91c9de6c1208ebe85b3ad40a26a30c582e6888e7ffab9085f329010`.


## Codex Agentic y herramientas nativas

Un turno independiente con OpenAI Codex Agentic usó el modelo configurado
`gpt-6.1-sol`, esfuerzo `medium`, y el llavero de la cuenta de laboratorio.
El primer arranque de la prueba salió antes de generar porque el socket de
systemd no era visible desde el proceso aislado. Se verificó que el socket
del anfitrión y el del servicio apuntaban al mismo inode. El turno posterior
usó ese socket, el mismo UID de servicio y una atestación de prueba aislada.

El inventario se observó en `thread/start.dynamicTools`. Las siete
herramientas técnicas fueron las de la lista de Gemini, excluyendo
`nodia_capabilities_select`. A ellas se sumaron las siguientes capacidades
por fase.

| Fase | Capacidades adicionales visibles | Llamadas del modelo |
| --- | --- | --- |
| Descubrimiento | `nodia_capabilities_select` | `nodia_capabilities_select` |
| Ejecución | `nodia_businesses_list`, `nodia_products_list` | `nodia_businesses_list`, seguida de `nodia_products_list` |

NodiaAI obtuvo el ámbito del negocio con su nombre y leyó el catálogo dentro
de la misma generación de ejecución. La proyección de la herramienta y la
respuesta final coincidieron con PostgreSQL para los once productos, incluido
el precio regular y el vigente en oferta. El producto del negocio ajeno quedó
fuera de la salida. Las dos generaciones del turno terminaron y quedaron
acusadas. El ensayo retiró la base aislada con cero trabajos activos, cero
recursos retenidos y cero propuestas.

SHA-256 del registro sanitizado de Codex: `75f635900a8519885c543f0fcd297e128a2afa71f956f1f316d7caed710f328e`.
