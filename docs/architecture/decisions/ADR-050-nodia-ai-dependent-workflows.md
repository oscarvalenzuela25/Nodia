# ADR-050 — conjuntos dependientes y comandos enlazados de NodiaAI

> Estado: propuesto
> Fecha: 2026-10-17

## Contexto

Los efectos locales de AI-19..22 se ejecutan individualmente con confirmación exacta y recibo atómico. Crear un proveedor y después su contacto necesita pasar un ID todavía inexistente, conservar el primer commit si falla el contacto y reanudar sin duplicarlo. También debe impedirse confirmar la propuesta individual una vez que su borrador fue reclamado por un conjunto.

Los contratos41/43 ya establecen pasos secuenciales, bindings tipados, primer enlace persistido y revisión nueva ante corrección material. Se necesita concretarlos sin un motor de workflows genérico ni mantener duplicados del modelo de dominio.

## Opciones consideradas

### Orquestar llamadas desde el navegador o volver a pedir el ID al modelo

- Reduce código inicial del worker.
- Depende de una sesión abierta y no conserva una fuente transaccional de recuperación.
- Permite enlaces y efectos distintos de la propuesta confirmada; no resuelve una respuesta perdida ni duplicación entre sesiones.

### Una transacción SQL para todo el conjunto

- Puede hacer atómico un conjunto homogéneo local.
- Contradice la conservación de efectos por paso confirmada para v1 y mantiene locks durante toda la secuencia.
- No compone con operaciones externas, formularios seguros o evolución de los dominios; requeriría otro contrato de cancelación/recuperación.

### Reutilizar pasos durables y persistir la resolución inicial

- Reutiliza la identidad, recibo y writer nativo de cada operación.
- Permite resultados parciales y recupera el mismo enlace sin búsquedas heurísticas.
- Exige validación estricta de referencias, reclamación transaccional de borradores e inmutabilidad del payload enlazado.

## Decisión

Se implementa la tercera opción para el alcance AI-23: uno a ocho pasos en orden estable, sólo referencias a antecedentes de la misma revisión y compatibilidad declarada por código. El primer binding operativo es `provider.create.id → contact.create.provider_id`; registrar otros outputs no promete que ya puedan enlazarse.

La propuesta conjunta reclama los borradores y reemplaza sus propuestas individuales anteriores. El canal humano confirma el conjunto exacto. El worker ejecuta un paso por vez y se detiene al fallar; no repite los completados y no compensa sus efectos automáticamente.

El first-bind persiste un envelope cerrado `command_template/scope/preconditions` en `execution_steps.bound_command`, nullable para las ejecuciones históricas y los pasos todavía no enlazados. El payload es inmutable mientras exista su fuente y se purga con ella. La corrección de pasos pendientes prepara otra propuesta con `prior_execution_id`, conserva los recibos comprometidos y exige otro botón. No se añaden tablas de workflow/aristas ni un scheduler DAG.

## Consecuencias

- Los datos nativos continúan siendo propiedad de sus módulos; el coordinador sólo guarda intención, resolución y resultado mínimos.
- Un conjunto parcial conserva cambios visibles. La UI debe decirlo y distinguir recuperar, reanudar el mismo comando y confirmar una corrección.
- Las migraciones añaden dos columnas, sin una tabla por flujo. La relación de continuación y la purga deben probarse con PostgreSQL real y retención.
- La validación de binding necesita recibo comprometido, contrato registrado, relación de dominio y alcance; el texto del modelo y una consulta por nombre no son prueba.
- Publicación MCP, aceptación con Gemini, R2 y adjuntos AI-32 conservan sus gates independientes. Implementar el coordinador no los cierra.
- La implementación y evidencia de concurrencia/caída/COMMIT perdido se consolidan en69; este ADR permanece propuesto y no atribuye aprobación a la ejecución de tests.

## Referencias

- [Conjuntos y confirmación41](../../mvp/41-nodia-ai-v1-contracts.md)
- [Arquitectura43](../../mvp/43-nodia-ai-execution-architecture.md)
- [Recuperación66](../../mvp/66-nodia-ai-ai20-execution-recovery.md)
- [Negocios68](../../mvp/68-nodia-ai-ai22-business-operations.md)
- [Entrega AI-23/69](../../mvp/69-nodia-ai-ai23-dependent-workflows.md)
