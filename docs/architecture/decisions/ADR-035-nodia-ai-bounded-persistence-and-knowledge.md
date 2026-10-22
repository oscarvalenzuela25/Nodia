# ADR-035 — Persistencia acotada y contexto compilado de NodiaAI

> Estado: propuesto; revisión solicitada por el usuario, sin implementación ni aprobación automática
> Fecha: 2026-10-14

## Contexto

La revisión previa a implementar NodiaAI busca reducir persistencia redundante conservando preview/confirmación, trabajos durables, recuperación sin duplicación y borrado de contenido del chat. Todos los productos actuales y ampliaciones deben integrarse mediante herramientas y conocimiento funcional versionados; el usuario solicita fichas Markdown mantenidas al especificar nuevas funciones.

El esquema previo dispone24 tablas y repite comandos/previews en varias representaciones. La v1 ejecuta pasos secuencialmente y se detiene ante fallo. Ningún protocolo comprobado exige todavía la tabla de continuación opaca de proveedor. Cargar documentación arbitraria desde el repositorio en cada turno mezclaría borradores, permisos y despliegues.

## Opciones consideradas

### Opción A — Conservar todo el modelo y explorar Markdown en runtime

- Ventajas: menos cambios al diseño previo y edición inmediata de contexto.
- Desventajas: duplicación de datos, tabla de aristas sin necesidad actual, estructuras de proveedor sin evidencia y conocimiento potencialmente no revisado/incompatible con el backend desplegado.

### Opción B — Persistencia por ciclo de vida y artefacto de contexto publicado con el backend

- Ventajas: comandos/proyección de pasos como fuente única para aprobación, estructura secuencial acotada, activación por evidencia y versiones de código/contexto coherentes. Nuevos productos no exigen tablas de chat.
- Desventajas: compilación/validación documental durante build, reconstrucción determinista del envelope y revisión de propuestas afectadas al cambiar contratos.

### Opción C — Una tabla de chats con todo en JSON

- Ventajas: pocas tablas al inicio.
- Desventajas: crecimiento/locks por documento completo, FKs/orden/purga débiles y mezcla de consentimiento, datos caducables y recibos que deben sobrevivir. No cumple continuidad y recuperación verificables.

## Decisión

Proponer B. Eliminar step_dependencies, los JSON duplicados approval_envelope/public_preview y la propiedad redundante del adjunto; reconstruir aprobación desde revisión/pasos congelados. Validar dependencias previas del mismo conjunto y bindings tipados, sin ejecutor DAG paralelo. Retirar índices cubiertos/sin consumidor. Mantener recibos, payloads, attempts, grants y slots con responsabilidades distintas.

Modelo revisado:23 tablas previstas/284 columnas/62 FKs;22 para la v1 completa y adapter_states condicional a protocolo comprobado. La migración inicial sólo incluye lo que necesita su etapa; añadir columna/FK de continuación junto con la tabla cuando se justifique. Un context_manifest por run conserva referencias/hashes, sin copiar documentos completos.

[AI-04/50](../../mvp/50-nodia-ai-ai04-runtime-policy.md)/[ADR-037](ADR-037-nodia-ai-admission-and-minimal-retention.md) fijan posteriormente cero archivo adicional para audit/receipts resueltos/attempts terminales. La separación permite terminar pendientes mínimos tras purgar payload; no conservar un historial indefinido. Baseline estructural conservado, delta tipado de routing/contadores en AI-09/12 antes de migrar; política validada no acredita runtime.

El conocimiento se mantiene en docs/nodia-ai/knowledge y se compila desde una lista explícita y contratos tipados a un artefacto inmutable del backend. No crear tablas de producto/conocimiento ni RAG/vector store para esta escala. Vincular release del catálogo con hashes de contexto, comprobarlo al arrancar y autorizar fuentes antes de entregar explicación al modelo. Plantillas, borradores, secretos y documentos de usuario no se publican como conocimiento operativo.

Implementación parcial posterior: [AI-06/52](../../mvp/52-nodia-ai-ai06-knowledge-publication-contract.md)/[ADR-038](ADR-038-nodia-ai-compiled-knowledge-contract.md) incorporan frontmatter único, schema/registro de bindings y compilador de build.37 fichas siguen draft/unregistered y el bundle es vacío, sin herramientas reales publicadas. Loader/startup, pin de catálogo y autoridad por actor continúan AI-07/08/12; no cambia el estado propuesto de este ADR ni acredita esas garantías.

El runtime recibe producto/resumen y funciones relevantes autorizadas, descubre detalles bajo demanda y consulta datos mediante herramientas. Código y contenido evolucionan juntos; turno conserva release, publicación nueva se descubre al siguiente turno e incompatibilidad invalida propuestas pendientes. No alterar efectos históricos ni introducir fallback de modo/modelo.

## Consecuencias

- Menos duplicación e índices de mantenimiento; el efecto en rendimiento debe medirse, no presumirse por el número de tablas.
- Se requiere verificar canonicalización/inmutabilidad y orden/bindings en la aplicación y SQL aislado. Quitar la tabla de aristas no vuelve seguros datos JSON libres.
- Cambiar reglas/funciones exige actualizar fichas, registro, esquemas y pruebas. El build/deploy publica capacidades sólo al cerrar sus garantías reales.
- El publicador y adaptadores quedan como tareas del plan; elegir esta propuesta no acredita herramientas viables en Gemini Web o Agentic.
- Especificaciones y ADR anteriores mantienen estado de revisión. La autorización general del proyecto no se cambia.

## Referencias

- [Revisión44](../../mvp/44-nodia-ai-data-model-review.md), [plan45](../../mvp/45-nodia-ai-implementation-plan.md), [ERD42](../../mvp/42-nodia-ai-erd.md), [ejecución43](../../mvp/43-nodia-ai-execution-architecture.md).
- [Estándar de conocimiento](../../nodia-ai/knowledge/README.md), [catálogo40](../../mvp/40-nodia-ai-tool-catalog-v1.md), [contratos41](../../mvp/41-nodia-ai-v1-contracts.md).
- [ADR-033](ADR-033-nodia-ai-confirmation-and-sequential-recovery.md), [ADR-034](ADR-034-nodia-ai-postgres-jobs-and-retention.md).
