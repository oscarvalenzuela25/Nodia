# ADR-038 — NodiaAI: metadatos únicos y contexto compilado por contrato

> Estado: propuesto; implementación del compilador no aprueba este ADR
> Fecha: 2026-10-15

## Contexto

AI-05 entrega31 fichas y NodiaAI tiene otras5. Sus metadatos en tablas Markdown no son un contrato de publicación validable. El contexto debe evolucionar con backend/herramientas, sin explorar todo el repositorio, publicar borradores ni convertir texto en permisos. ADR-035 eligió artefactos versionados y ninguna tabla/vector store nuevo.

## Opciones consideradas

### Opción A — Descubrir Markdown durante cada petición

- Ventajas: edición inmediata y poca preparación de build.
- Desventajas: mezcla borradores/secretos, dependencia del repo en VPS, permiso y versión inconsistentes; un cambio de archivo podría reinterpretar un turno en vuelo.

### Opción B — Frontmatter único y bindings de código con assets de build

- Ventajas: validación determinista, contenido/contrato/módulos enlazados y bundle inmutable sin DB nueva; separar aprobación, implementación e integración.
- Desventajas: disciplina de revisiones/approval y release; requiere composición/autorización runtime posterior y revisión semántica humana.

### Opción C — Metadatos en Markdown más JSON editorial paralelo o tablas

- Ventajas: fácil consultar un índice externo.
- Desventajas: dos fuentes editables de estado/revisión y sincronización adicional; no justificado para este corpus.

## Decisión

Implementar B bajo[contrato52](../../mvp/52-nodia-ai-ai06-knowledge-publication-contract.md). Frontmatter JSON estricto, no YAML libre ni dependencia nueva. Fuente estructural única en[JSON Schema](../../../nodia-server/scripts/nodia-ai-knowledge/contracts.schema.json); registro de código referencia documento/secciones y capacidades/revisiones/schemas/módulos, sin repetir metadata editorial. Matriz AI-05 conserva sólo correspondencia de recursos.

Build valida antes de Nest y emite después de deleteOutDir; produce manifiesto/fragmentos elegibles y comprueba hashes. Entradas explícitas y paths controlados; borradores/plantillas fuera. Aprobación exige referencia/revisión/hash, pero su procedencia humana no se demuestra por escribir un flag o un archivo. Registro, tests de familia y autoridad siguen separados.

El corpus actual sigue draft/unregistered y el registro real de capacidades/bindings vacío; no inventar implementaciones para conseguir un bundle no vacío. Las37 fichas incluyen la nueva función de publicación, sin tablas, servicios o modelos estáticos. Los tests no trasladan sus aprobaciones sintéticas al producto.

## Consecuencias

- Positivas: autoría única, evolución por release y fallos explícitos ante fuentes/contratos incompatibles; no necesita docs en VPS ni afecta datos de negocio.
- Costos o riesgos aceptados: menos inmediatez que leer archivos vivos; revisar aprobación/hash/revisión y cambios semánticos aun con schemas compatibles. Un checksum no prueba autoría, seguridad ni disponibilidad real.
- Trabajo posterior: AI-07/08 autoridad y módulo; AI-12 loader/contexto/runtime con release de confianza y validación empaquetada tras prune; AI-36/38 baseline de despliegue y aceptación. No claim de startup/runtime por tests de build.
- Complementa ADR-035 sin modificar contratos de confirmación, slots, retención, credenciales o routing.

## Referencias

- [Estándar](../../nodia-ai/knowledge/README.md), [ficha de publicación](../../nodia-ai/knowledge/nodia-ai/features/knowledge-publication.md), [AI-05/51](../../mvp/51-nodia-ai-ai05-product-knowledge.md), [plan45](../../mvp/45-nodia-ai-implementation-plan.md).
- [ADR-035](ADR-035-nodia-ai-bounded-persistence-and-knowledge.md), [ejecución43](../../mvp/43-nodia-ai-execution-architecture.md), [AI-06/52](../../mvp/52-nodia-ai-ai06-knowledge-publication-contract.md).
