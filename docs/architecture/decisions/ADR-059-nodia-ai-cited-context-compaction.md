# ADR-059 — compactación canónica con citas y fuentes revalidadas

> Estado: propuesto
> Fecha: 2026-10-18

## Contexto

El corte anterior de 128 mensajes impide continuidad aunque haya presupuesto. Guardar un resumen libre podría inventar hechos, perder operaciones pendientes o reutilizar datos tras revocar permisos. Se necesita continuidad entre proveedores sin depender de sus sesiones opacas ni duplicar efectos.

## Opciones consideradas

### A. Resumen extractivo generado y validado por el backend

Reduce historial con selección semántica del mismo modo/modelo y conserva citas verificables. Requiere una inferencia adicional, contrato estricto, presupuesto y manejo de errores; no demuestra exhaustividad de lo recordado.

### B. Recorte determinista de mensajes recientes

Es económico y no genera texto nuevo, pero elimina decisiones antiguas y no satisface continuidad. No se presenta como compactación completa.

### C. Memoria vectorial o sesión nativa como fuente de verdad

Ofrece recuperación selectiva, con almacenamiento, consistencia, revocación y continuidad entre proveedores más costosos. Las sesiones nativas verificadas hasta ahora no sustituyen el historial canónico.

## Decisión

Implementar A: un snapshot mínimo por revisión con secuencia/hash/scope/versión; originales intactos. Una compactación máxima por run con la selección vigente, sin herramientas, sin archivos originales y dentro del presupuesto durable. Validar citas literales y conservar entradas previas. Cargar preferencias y referencias operativas actuales por separado; revalidar fuentes antes del dispatch y del commit.

Medir el prompt nativo inicial con el mismo constructor que lo ejecuta; distinguir medida exacta/cota superior y ventana de tokens desconocida. No sumar presupuestos independientes para eludir el techo del contexto. Reservar explícitamente el primer listado MCP y contar en el puente las respuestas JSON-RPC completas entregadas, sin reiniciar presupuesto por respawn ni aceptar éxito después de un exceso. Si no cabe o la respuesta es inválida, terminar explícitamente sin replay ni fallback de proveedor/modelo.

El CLI Agentic recibe un agente propio de capacidades mínimas para conversación/compactación: sólo finalización para texto o lectura de rutas exactas cuando existan adjuntos autorizados. Mantener los hooks y la validación terminal; una respuesta SUCCESS no prueba que respetó esas restricciones. La definición de ese agente es contenido controlado por Nodia y cuenta en el presupuesto inicial junto al prompt. Verificar identidad exacta del agente propio y del modelo en init; no cambiar selección, esfuerzo ni timeout para lograr un canario exitoso. MCP conserva el transporte anterior y su gate estricto de catálogo/dispatcher/finalización, con excepción de adjuntos ya autorizada. Un rol MCP nuevo fue rechazado por el CLI y se retiró sin atribuir una causa no conservada en el diagnóstico; no inventar su configuración ni relajar el gate.

## Consecuencias

- Historial portable y trazabilidad del resumen, con una tabla y un FK nullable adicionales; sin índices vectoriales ni nuevas fuentes de autoridad.
- Costo de una inferencia de compactación y verificaciones SQL sobre el prefijo. La selección semántica puede omitir detalles; los originales permanecen consultables y el resumen puede agotar su límite.
- La revocación invalida snapshots amplios, exigiendo reconstrucción acotada. Las cuotas cuentan resúmenes y reservas, incluidos resultados inciertos.
- AI-36..38 conservan aceptación integral, rendimiento y operación por entorno. No se aprueban fichas ni publican herramientas por actualizar su documentación.

## Referencias

- [Entrega AI-34](../../mvp/80-nodia-ai-ai34-long-context-compaction.md), [arquitectura43](../../mvp/43-nodia-ai-execution-architecture.md), [política50](../../mvp/50-nodia-ai-ai04-runtime-policy.md).
