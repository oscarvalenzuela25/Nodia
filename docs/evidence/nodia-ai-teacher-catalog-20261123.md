# Calendarios y tarjetas de Teacher en NodiaAI — 2026-11-23

La verificación previa a la aprobación cubrió 7 consultas y
13 preparaciones de cambios. Los contratos se comprobaron con el
compilador del registro y con las proyecciones locales de parámetros
de OpenAI y Gemini.

En PostgreSQL 16 aislado con actores sintéticos se ejecutaron:

- 15 casos de calendario para propiedad, lotes, paginación, cambios
  obsoletos, categoría y bloqueo concurrente al confirmar un borrado.
- 10 casos de tarjetas para propiedad, importación, revisiones, retorno
  de metadatos permitidos y reversión de una transacción.
- La composición Nest de las 20 herramientas candidatas, la vista
  previa de un calendario de 28 jornadas, ausencia de efecto antes de
  confirmar, desafío humano, ejecución local, idempotencia del
  comprobante, avance derivado al marcar una actividad, alta y borrado
  de una tarjeta y rechazo de consultas de otra cuenta o sin asignación.

En el ensayo inicial, el puerto de prueba seleccionó los candidatos
de forma explícita. Se usaron actores y datos de laboratorio.
El usuario aprobó después ambas fichas para activar el catálogo en la rama.
[Aprobación](nodia-ai-teacher-catalog-approval-20261123.md).

El comando `npm run test:nodia-ai:teacher-catalog` en `nodia-server`
usa Docker o una base PostgreSQL vacía específica de prueba mediante
`NODIA_AI_TEACHER_TEST_DATABASE_URL`.

[Catálogo de operaciones](../mvp/40-nodia-ai-tool-catalog-v1.md#calendarios-y-tarjetas-de-teacher).

## Validación de la publicación aprobada

El build emitió `nodia-ai-teacher-study/1` con las 20 herramientas
de Teacher y los dos fragmentos aprobados. La auditoría del catálogo
confirmó 179 herramientas publicadas en total.

La prueba de integración volvió a ejecutarse en PostgreSQL 16.15
aislado con el registro real de Nest y el manifiesto fijado por el
build. Confirmó el descubrimiento con acceso a Teacher, el rechazo
sin asignación o con recursos de otra cuenta, la confirmación humana y
la ejecución persistida. Pasaron además las 47 pruebas del catálogo y
su compilador de contratos.

[Aprobación de las fichas](nodia-ai-teacher-catalog-approval-20261123.md).
