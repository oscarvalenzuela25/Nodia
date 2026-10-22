# ADR-043 — Observación durable de NodiaAI y proyección humana de resultados

> Estado: propuesto; implementación autorizada de AI-16. Aprobación documental pendiente.
> Fecha:2026-10-16

## Contexto

M1 ya incluye eventos/recibos y secuencias; los adaptadores entregan respuesta final. El cliente necesita volver a un turno sin repetir efectos y recuperar datos con permisos actuales, después de revocar el grant de ejecución.

## Opciones consideradas

### A — Polling durable sobre M1 y resultados exactos

- Ventajas: transacción compartida con cada efecto local; sin nuevo broker/tablas; reanudación por cursor individual y compatibilidad con autenticación HTTP actual.
- Desventajas: consultas durante actividad y revalidación acotada por recibo; no streaming de tokens.

### B — SSE obligatorio y read model adicional

- Ventajas: entrega inmediata si los adaptadores producen chunks reales.
- Desventajas: más estado/conexiones/autenticación, sin datos incrementales nativos actuales. No evita persistencia/reautorización ni prueba que un chunk sea durable.

## Decisión

Usar A, permitido por arquitectura43. Persistir transiciones reales con refs en la transacción existente. Separar el resultado exacto registrado de una proyección cerrada de fuente/fecha/conteos/navegación. No usar el callback MCP como endpoint de lectura humana, porque exigiría grants antiguos y consumiría presupuesto o repetiría trabajo.

El cursor añade huella de visibilidad y `EventPage.has_more` distingue backlog del checkpoint de cola. La navegación es estructurada y registrada en código; nunca una URL emitida por el modelo. El historial asocia mensajes con runs mediante consulta por conjuntos y apertura por intención.

## Consecuencias

- Se conservan once tablas M1 y retención en cascada; un índice incremental apoya las consultas nuevas.
- Client y Server cambian juntos el contrato cerrado: `has_more`, `Message.run_id` y `ToolObservation`.
- La revalidación usa las transacciones nativas de cada dominio, sin prometer snapshot global; máximo12 recibos por run. Cada GET exige identidad vigente. No llamadas de red ni ejecución bajo locks de observación.
- SSE/deltas pueden añadirse después sin cambiar el journal ni producir eventos falsos hoy. Cancelación HTTP, escrituras y confirmaciones no se implementan incidentalmente.

## Referencias

- [AI-16/62](../../mvp/62-nodia-ai-ai16-observation-navigation.md).
- [Arquitectura43](../../mvp/43-nodia-ai-execution-architecture.md), [M1/ADR-040](ADR-040-nodia-ai-m1-persistence.md).
