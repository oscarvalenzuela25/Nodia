# ADR-046 — Primer efecto financiero con testigo transaccional local en NodiaAI

> Estado: propuesto; implementación AI-19 solicitada, sin aprobación documental automática
> Fecha: 2026-10-17

## Contexto

AI-18 vincula la confirmación humana con una propuesta, revisión y hash exactos; crea una ejecución durable, pero mantiene cerrado el registro productivo de ejecutores. AI-19 necesita demostrar el primer gasto con efecto y recibo indivisibles antes de habilitar su dispatch y recuperación en AI-20.

`CreateFinanceMovementUseCase` ya define las reglas de movimientos y pagos de obligaciones. Su ledger acepta un manager transaccional compartido. Duplicar esas reglas en NodiaAI o comprometer el movimiento antes del recibo permitiría divergencias o duplicados tras una respuesta perdida. El usuario pidió una base limpia y no conservar archivos técnicos adicionales al chat.

## Opciones consideradas

### Opción A — Escribir por REST y registrar el recibo después

- Ventajas: reutiliza la entrada HTTP existente.
- Desventajas: no comparte el commit del movimiento; una pérdida de respuesta deja un intervalo sin testigo. El endpoint nativo no ofrece una garantía de idempotencia que cierre ese intervalo para este caso.

### Opción B — Puerto nativo con manager compartido y recibo en el paso existente

- Ventajas: conserva una sola regla financiera y compromete movimiento, recibo y estado del coordinador juntos. Reutiliza las tablas M2 de AI-18 y evita duplicar comandos o identidad en JSON.
- Desventajas: requiere propagar estrictamente el manager, verificar precondiciones y probar rollback/concurrencia reales. Sólo cubre efectos locales en esa misma base de datos; no resuelve el dispatch durable ni servicios externos.

### Opción C — Nuevo journal/idempotencia financiera general o un segundo ledger de NodiaAI

- Ventajas: un journal nativo podría servir a otros consumidores si surgiera esa necesidad.
- Desventajas: añade esquema y contratos sin necesidad para este primer efecto local; un ledger paralelo duplicaría reglas de negocio. No sustituye la verificación de autoridad y comando confirmado.

## Decisión

Se implementa B para un único paso confirmado de creación de movimiento, sin dependencias ni bindings. `ExecuteNodiaAiFinanceMovementEffectUseCase` resuelve el comando congelado completo y normalizado, revalida autoridad/scope/contrato/precondiciones y llama a `CreateFinanceMovementUseCase` con actor/sesión reales, dueño explícito y el manager activo del coordinador. No vuelve a preparar ni agrega defaults durante ejecución.

`ExecuteNodiaAiFinancialExecutionUseCase` reautoriza y verifica origen, revisión/hash, grant, job, epoch y presupuesto antes del efecto. Conserva el orden común autoridad → cola → chat → job/ejecución → dominio. Una sola transacción compromete movimiento, paso y recibo, ejecución completed, job done, revocación del grant, liberación del chat y outbox. Recuperar una ejecución completed no vuelve a ejecutar el puerto ni exige que su dominio siga igual después del efecto.

El recibo tiene sólo `schema_version`, `resource_key`, `resource_id` y `subject_user_id`. Identidad, hash del comando resuelto, clave nativa y tiempos permanecen en columnas. No se añade tabla/columna ni una copia del comando. La migración `1792600000000-FreezeNodiaAiFinancialWitness` congela el primer binding y los recibos/estados completados mediante triggers, complementando las restricciones existentes.

El contrato de preparación pasa a `nodia-ai-finance-movement-create/2`, catálogo interno `nodia-ai-ai19-finance-effect/1`. Categoría incluye nombre y clave en sus precondiciones para detectar cambios materiales aunque el timestamp coincida; no se asume precisión de versión en `Date`. Contratos anteriores se rechazan sin alias ni reinterpretar su aprobación. Las reglas y locks del ledger financiero se conservan.

El trabajo local se acota por el presupuesto `domain_step` y los vencimientos de sesión/grant/job/chat. Un fallo de transporte al comprometer el callback terminado se comunica como503 de resultado incierto, sin replay automático; errores SQL con rollback definitivo se clasifican como409. La observación del resultado se hace bajo autoridad actual mediante `GET operations/:id` y su referencia de entidad, sin exigir que el registro financiero continúe existiendo para reconocer el recibo histórico.

`NODIA_AI_EXECUTION_ADMISSION` permanece vacío y no se publican preparadores MCP ni dispatch del worker. La disponibilidad operativa requiere AI-20; una prueba aislada del puerto/coordinador no abre ese gate.

## Consecuencias

- Consecuencias positivas: efecto y testigo se confirman juntos; no hay un ledger paralelo ni nuevas tablas para este caso. La recuperación por identidad evita interpretar otra vez una orden ya cumplida. El registro financiero mantiene su ciclo de vida independiente del chat.
- Costos o riesgos aceptados: el puerto sólo es seguro frente a duplicados dentro del coordinador y su protocolo; llamarlo aisladamente no lo convierte en una API idempotente. El manager debe abarcar todos los repositorios y la proyección/outbox finales. Una caída durante el commit puede ocultar su resultado y requiere observación, no un reintento ciego.
- Compatibilidad: el cambio de snapshot exige nueva preparación para contratos anteriores. Los recibos completados son inmutables y se purgan con el chat conforme a la política, sin ampliar retención ni eliminar el registro financiero.
- Trabajo posterior: AI-20 implementará claim/leases/fences, conciliación durable, cancelación y recuperación antes de habilitar admisión productiva. Secuencias generales, bindings y efectos externos requieren sus garantías propias. Las pruebas SQL y cualquier despliegue se registran como evidencia comprobada, sin aprobación automática de este ADR.

## Referencias

- [Entrega AI-19/65](../../mvp/65-nodia-ai-ai19-financial-effect.md) y [evidencia AI-19](../../evidence/nodia-ai-ai19-validation.json).
- [Plan45](../../mvp/45-nodia-ai-implementation-plan.md), [Finanzas22](../../mvp/22-personal-finance-contracts.md) y [arquitectura43](../../mvp/43-nodia-ai-execution-architecture.md).
- [Propuestas AI-17/63](../../mvp/63-nodia-ai-ai17-drafts-revisions.md), [confirmación AI-18/64](../../mvp/64-nodia-ai-ai18-human-confirmation.md) y [política50](../../mvp/50-nodia-ai-ai04-runtime-policy.md).
- [ADR-033](ADR-033-nodia-ai-confirmation-and-sequential-recovery.md), [ADR-034](ADR-034-nodia-ai-postgres-jobs-and-retention.md) y [ADR-045](ADR-045-nodia-ai-human-confirmation-admission.md).
