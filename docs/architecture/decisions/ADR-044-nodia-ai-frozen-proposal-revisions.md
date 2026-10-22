# ADR-044 — Revisiones inmutables de propuestas de NodiaAI

> Estado: propuesto; implementación AI-17 solicitada por el usuario
> Fecha:2026-10-16

## Contexto

La confirmación futura debe referir al comando exacto que una persona revisó. Volver a consultar o normalizar datos al confirmar podría cambiar destinatarios, importes o efectos. Guardar por separado comando, envelope y preview completos introduce varias fuentes de verdad.

## Opciones consideradas

### Opción A — Propuesta mutable y reconstrucción desde el negocio al confirmar

- Reduce filas pero no conserva la identidad exacta del contenido revisado.
- Una edición concurrente o cambio de defaults puede alterar el efecto sin nueva revisión humana.

### Opción B — Pasos congelados y envelope derivado, con revisión/hash

- Conserva comando y proyección normalizados bajo un contrato versionado.
- Evita duplicar envelope/preview; requiere verificación determinista, restricciones y pruebas de concurrencia.

## Decisión

Implementar B usando las cuatro tablas ya previstas en el ERD, sin ampliar M2 a desafíos/ejecuciones anticipadamente. Cada revisión crea pasos nuevos; se verifican dependencias y outputs tipados. Se deriva un único envelope con `jcs-rfc8785/1` y SHA-256. Identidad, alcance, fechas, comandos, contratos y proyección quedan incluidos; los estados de lifecycle no alteran el contenido firmado por el hash.

Triggers SQL congelan contenido y bloquean inserciones tardías o borrado individual, conservando cascada desde el chat. Se vuelve a comprobar autoridad para observar/revisar; una pérdida de autoridad deniega acceso y no sustituye valores. Una edición explícita regenera deliberadamente una nueva revisión bajo CAS, conservando el vencimiento anterior.

El preparador financiero comparte validadores/reglas/autoridad nativos y sólo produce borradores/propuestas. No se publica MCP prepare hasta cumplir los gates de confirmación/recuperación del catálogo. La existencia de HTTP GET/PATCH/cancel no habilita ejecución.

## Consecuencias

- Pruebas deben cubrir JCS oficial, alteración de cualquier componente del envelope, tipos/presencia, scope, revocación, CAS y purga real.
- La DB puede reconstruir la vista exacta sin consultar el negocio; una corrección material obliga a nueva revisión.
- Nuevo contrato de canonicalización o preparador exige versionar/migrar explícitamente; no reinterpretar silenciosamente filas históricas.
- AI-18 debe ligar desafío/confirmación a ID/revisión/hash; AI-19..20 implementarán el efecto nativo y su conciliación antes de publicación.

## Referencias

- [Entrega63](../../mvp/63-nodia-ai-ai17-drafts-revisions.md), [ERD42](../../mvp/42-nodia-ai-erd.md), [arquitectura43](../../mvp/43-nodia-ai-execution-architecture.md), [plan45](../../mvp/45-nodia-ai-implementation-plan.md).
- [RFC8785](https://www.rfc-editor.org/rfc/rfc8785.html).
