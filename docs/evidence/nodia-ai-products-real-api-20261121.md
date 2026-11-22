# Consulta real de productos y precios en la VM — 2026-11-21

Se probó el commit `b09869e3`, catálogo `nodia-ai-business-pos/6`, con la
conexión de laboratorio OpenAI en modo API key y su modelo configurado
`gpt-6.1-terra`. La consulta de catálogo remoto devolvió HTTP 200 y confirmó
el modelo exacto antes de la inferencia.

Se leyó en modo de solo lectura el catálogo activo de un negocio existente de
la VM. Una PostgreSQL 16 desechable recibió una proyección de nombres,
unidades y precios, con un dueño ordinario provisto de los módulos Negocios y
NodiaAI. Se identificó el negocio al formular la pregunta. El mensaje pidió
una fila por producto con precio vigente CLP y precio regular en caso de
oferta. Los nombres y los importes provinieron de la herramienta ejecutada.

El turno completó tres POST reales, todos con HTTP 200. Los recibos
confirmaron `nodia_capabilities_select` y `nodia_products_list`. La salida de
la herramienta y el texto final coincidieron con PostgreSQL para los once
productos activos, incluido el precio regular y el vigente de un producto
en oferta. El registro de un negocio ajeno quedó fuera de la respuesta.

## Funciones enviadas al proveedor

Los tres POST expusieron `nodia_capabilities_describe`,
`nodia_capabilities_search`, `nodia_entities_search`, `nodia_knowledge_get`,
`nodia_knowledge_index`, `nodia_reports_describe` y `nodia_reports_run`.

| POST | Fase | Función adicional |
| --- | --- | --- |
| 1 | Descubrimiento | `nodia_capabilities_select` |
| 2 | Ejecución | `nodia_products_list` |
| 3 | Ejecución, con el resultado de la consulta | `nodia_products_list` |

El índice de descubrimiento incluyó la capacidad de listar productos y la
guía de precios. El catálogo compilado registró 159 capacidades publicadas
y el gateway delimitó las funciones activas del turno.

El primer armado se detuvo antes de la inferencia porque la base aislada
carecía del módulo Negocios. Se aplicó el seed del ensayo de integración y
se inició un turno nuevo. Al terminar quedaron cero trabajos pendientes,
cero POST sin acuse y cero propuestas. Se retiró la base desechable. La
prueba cubre esa selección API y el negocio identificado en el mensaje.
Gemini, Agentic y el despliegue productivo siguen fuera de esta comprobación.

SHA-256 del registro de ejecución sanitizado: `4d9e1110be60e020ba4fc2efc1f0c131f92f9d08192a1dc9ab3086a3b189230f`.
