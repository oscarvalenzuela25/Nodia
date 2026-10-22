# ADR-033 — Confirmación versionada y recuperación secuencial de NodiaAI

> Estado: propuesto; decisiones funcionales confirmadas, implementación pendiente
> Fecha: 2026-10-14

## Contexto

NodiaAI permite consultar y proponer operaciones de todos los módulos actuales, con historial canónico en Nodia Server. El usuario confirma botón sobre vista previa exacta y ejecución secuencial de operaciones individuales dependientes: mostrar cada resultado, conservar lo creado ante fallo y recuperar sin duplicación. Confirma también informes de varios módulos con medidas compatibles y procedencia separada.

No existe una garantía uniforme de idempotencia en el backend: Reservas tiene identidad/recuperación transaccional, Contactos posee creación deduplicada y versionado, y Finanzas/escrituras legacy requieren garantías adicionales. Invocar casos de uso desde MCP tampoco aplica automáticamente guards o validación HTTP.

La confirmación no puede depender de texto generado por el modelo ni de un resumen ambiguo. La desconexión del navegador no cancela el trabajo admitido. Confirmar varias operaciones no concede atomicidad conjunta, permisos nuevos ni derecho a repetir una operación cuyo resultado se desconoce.

## Opciones consideradas

### Opción A — Herramientas que ejecutan directamente con confirmación conversacional

- Ventajas: menor infraestructura inicial y llamadas directas al backend.
- Desventajas: mezcla planificación con consentimiento, permite “sí” del modelo/documento y dificulta identificar el contenido aprobado; respuesta perdida puede duplicar efectos.

### Opción B — Propuesta inmutable, confirmación humana separada y diario por paso

- Ventajas: contenido exacto revisable, comandos persistidos independientes del modelo, resultados y recuperación por efecto, compatible con varios dominios y desconexión.
- Desventajas: requiere versionado, editor tipado, desafíos, deduplicación, persistencia y garantías por caso de uso; la secuencia puede terminar parcialmente.

### Opción C — Una transacción para todo el conjunto y rollback universal

- Ventajas: atomicidad local cuando todos los comandos y efectos realmente comparten transacción.
- Desventajas: no cubre login/archivos/proveedores externos; acopla módulos y mantiene locks innecesarios. Contradice conservar lo creado que confirmó el usuario. No debe sostener transacciones durante inferencia o revisión humana.

## Decisión

Proponer B. El modelo sólo consulta/prepara; no se registra herramienta de confirmar, SQL o HTTP arbitrario. La UI edita la propuesta y cada cambio genera revisión/hash nuevos. Un desafío fuera de MCP vincula actor/sesión/propuesta/revisión/hash; el botón confirma mediante endpoint autenticado. Confirmaciones repetidas/concurrentes recuperan la misma ejecución.

El hash comprende el comando normalizado, ámbito/destinatario, pasos, dependencias/bindings, proyección revisable, catálogo y precondiciones. El comando ejecutado es el persistido, nunca una nueva interpretación del modelo. Un token no prueba una interacción física: el aislamiento del runtime respecto del canal autenticado de confirmación debe comprobarse en cada adaptador.

Los conjuntos se forman con borradores reclamados una vez; propuestas individuales anteriores quedan superseded. Server valida DAG y bindings tipados a salidas registradas. La [revisión44](../../mvp/44-nodia-ai-data-model-review.md)/[ADR-035](ADR-035-nodia-ai-bounded-persistence-and-knowledge.md) concreta dependencias previas en los pasos, sin tabla de aristas, y aprobación reconstruida desde revisión/pasos congelados en lugar de JSON completos duplicados. Ejecutar un paso por vez; un fallo detiene el resto. Cada paso comprometido conserva resultado/ID y no se deshace automáticamente.

Identidad de efecto estable por ejecución/paso; efecto local y recibo se comprometen juntos o se enlazan con idempotencia nativa recuperable equivalente. Timeout/COMMIT incierto pasa a reconciliación/unknown, nunca replay ciego. Reanudar reutiliza consentimientos sólo para comandos pendientes idénticos, autoridad vigente y precondiciones compatibles. Cambios materiales exigen nueva propuesta/botón.

Persistir ejecución independiente del navegador; concesión de background acotada y revalidada antes de cada efecto, sin JWT/cookies guardados. Cancelar detiene futuros pasos y solicita detener inferencia, conservando/reconciliando los ya iniciados. NI-13 y las nuevas políticas de ámbito deben resolverse antes de habilitar sus escrituras.

Informes usan fuentes/medidas/relaciones registradas y cálculo exacto por grano. Comparaciones compatibles mantienen procedencia separada; no sumar fuentes solapadas o monedas desconocidas. No forma parte de esta decisión elegir un motor SQL libre, cola, transporte MCP o SDK de proveedor.

## Consecuencias

Derivación posterior: [ERD42](../../mvp/42-nodia-ai-erd.md), [arquitectura43](../../mvp/43-nodia-ai-execution-architecture.md) y [ADR-034](ADR-034-nodia-ai-postgres-jobs-and-retention.md) concretan diseño de jobs PostgreSQL/worker, payloads separados de receipts, grants/leases/fences y retención. Usuario precisa90 días del último mensaje del dueño, adjuntos/transcripciones con chat y preferencias aceptadas independientes. Continúan propuestos; no prueba ejecución ni aprueba estos ADR.

- Positivas: consentimiento verificable por contenido, continuidad entre proveedores, recuperación por efecto y resultados parciales explícitos.
- Costos/riesgos aceptados: persistencia y coordinación adicionales; necesidad de revisar casos legacy para atomicidad, estados inciertos y editor exacto; no se promete rollback universal.
- Trabajo posterior: ERD, serialización canónica, leases/unicidad/outbox, política de concesión/retención/deadlines, schemas por herramienta, pruebas de concurrencia y viabilidad real por adaptador.
- Los schemas/documentos son diseño; no sustituyen tests de permisos, transacción o inferencia. La aprobación funcional del usuario no marca este ADR como aprobado.
- La autorización general del proyecto permanece vigente; registrar este ADR no modifica runtime ni BD.

## Referencias

- [Plan38](../../mvp/38-nodia-ai-research-and-v1-plan.md), [inventario39](../../mvp/39-nodia-ai-current-capabilities-inventory.md), [catálogo40](../../mvp/40-nodia-ai-tool-catalog-v1.md), [contratos41](../../mvp/41-nodia-ai-v1-contracts.md).
- [ADR-032](ADR-032-nodia-ai-domain-tools-and-conversation.md).
- [Finanzas22](../../mvp/22-personal-finance-contracts.md), [Reservas28](../../mvp/28-rental-reservations-contracts.md), [Contactos31](../../mvp/31-provider-contacts-proposal.md).
- [Herramientas MCP](https://modelcontextprotocol.io/specification/2025-11-25/server/tools), [cancelación MCP](https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/cancellation).
