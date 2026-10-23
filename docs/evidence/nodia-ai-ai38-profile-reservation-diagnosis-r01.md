# AI-38: propietario real de la reserva Agentic

La prueba controlada A identifica una colisión entre dos lecturas no generativas en la época diagnóstica. El propietario del perfil era **`health_status`**; la observación de elegibilidad fue rechazada mientras ese sondeo mantenía la reserva. No era un gasto, un turno en ejecución ni una cuarentena.

## Cadena observada

El [probe con los adaptadores reales de Server](nodia-ai-ai38-profile-reservation-diag-probe-a-r01.json) lee exclusivamente la conexión2 y su selección persistida mediante SQL de solo lectura, sin modelo de respaldo. Tras esperar31s, inicia `GeminiService.getDualEngineStatus()` y100ms después `GeminiNodiaAiAdapterUseCase.observe()`. Las dos únicas peticiones son `GET /engines/status` y `POST /nodia-ai/agentic/observe`. No se solicita un turno, generación, herramienta, login o escritura SQL.

La [proyección cerrada de eventos](nodia-ai-ai38-profile-reservation-diag-probe-a-events-r01.json) verifica el origen `profile_admission:_diagnostic`, campos y valores permitidos; no conserva logs crudos, cabeceras, cuerpos, cookies o secretos. El nonce técnico `d6f7a92451cf45f799011cd7dc003dea` enlaza:

| Evento UTC | Operación | Resultado |
| --- | --- | --- |
| 19:36:55.801665 | `health_status` Agentic | Adquiere el perfil |
| 19:36:55.914875 | `eligibility` Agentic | Rechazada con `runtime_busy`; propietario anterior, antigüedad113ms |
| 19:37:00.537100 | `health_status` Agentic | Libera la misma reserva tras4736ms |

No hay liberación anterior al rechazo, y `quarantined:false` en toda la cadena. HTTP devuelve409 para la observación y200 para health. El sondeo final informa sesión Agentic activa. Jobs, intentos y slots SQL son cero antes y después; la selección no cambia y no hay reintento automático. Se ejecutó únicamente la prueba A; B no se ejecutó.

## Paquete y alcance

La imagen diagnóstica `sha256:32dfd5144d841b6ce7de155d8533dccdc0c8518d8f40d01b4b556a087187a6d3` deriva de la imagen operativa B8 con una capa COPY,47fuentes Python públicas y42distribuciones conservadas. [Build R02](nodia-ai-ai38-profile-reservation-diag-build-r02.json):458pruebas Linux correctas, sin omisiones. El corpus de prueba contiene42fuentes históricas congeladas y dos nuevas de diagnóstico; no se atribuye paridad a las489pruebas del workspace actual, que contiene funcionalidades no adoptadas en B8.

El [primer build](nodia-ai-ai38-profile-reservation-diag-build-r01.json) falló por mezclar cinco fuentes actuales con dependencias productivas anteriores. Se conserva:281pruebas descubiertas,38errores de importación y un fallo, sin adopción. El [inventario de divergencias](nodia-ai-ai38-profile-reservation-source-drift-r01.json) documenta47fuentes de B8 frente a48locales. R02 aplica únicamente14etiquetas estáticas de propósito sobre cuatro fuentes B8 —AST idéntico al retirar ese keyword— y la instrumentación del gate. El [diff exacto](nodia-ai-ai38-profile-reservation-diag-overlay-r02.diff) conserva imports, protocolos y funcionalidades de B8.

Durante el probe se mantiene el contenedor `3733fb…`, iniciado `2026-10-22T19:32:16.119742741Z`, distinto de la época anterior. Server conserva `owner-r01` y el journal. Esta prueba identifica el propietario del rechazo **reproducido después de instrumentar**; no reconstruye retrospectivamente el propietario del409 de las18:00:08 de la época B8. La corrección de la competencia entre health y elegibilidad, su aceptación y la revalidación MCP de la época final requieren evidencias posteriores.
