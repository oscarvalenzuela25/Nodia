# ADR-013 — Disponibilidad, historia monetaria y reintentos de Reservas

> Estado: propuesto — ERD 27 aceptado; implementado localmente; aprobación documental y aplicación objetivo pendientes
> Fecha: 2026-10-04

## Contexto

Propietario y colaboradores pueden modificar disponibilidad y registrar dinero sobre una misma casa. Una consulta seguida de un insert no impide dobles reservas concurrentes; un timeout posterior al commit no demuestra que el pago falló. Las políticas configurables también deben conservar las condiciones acordadas por reserva.

El usuario aceptó el ERD 27 y autorizó incorporarlo a Obsidian/documentación y comenzar los contratos/plan Backend según la secuencia solicitada. Este ADR conserva revisión técnica propia; la evidencia de implementación local está al final; no se aplicó la migración objetivo.

## Opciones consideradas

### Opción A: comprobaciones previas sin protocolo persistente de concurrencia/reintentos

- Ventajas: menos tablas y implementación inicial breve.
- Desventajas: carreras entre colaboradores, pagos duplicados tras respuesta incierta, condiciones históricas recalculadas desde políticas actuales. No satisface las garantías propuestas para operación compartida.

### Opción B: tablas de reserva/bloqueo, lock por casa y operación idempotente transaccional

- Ventajas: modelo de dominio directo; protege escritores coordinados incluso con calendario vacío; reserva de intención y respuesta se confirman con el efecto; auditoría separada; sin Redis como fuente de integridad ni nuevas extensiones.
- Desventajas: todos los escritores de disponibilidad deben seguir el protocolo; escrituras de una misma casa se serializan donde comparten ese lock; SQL externo que omita el protocolo puede romper solapamientos. Requiere pruebas reales y un orden de locks explícito.

### Opción C: tabla única de ocupaciones y constraint de exclusión de rangos

- Ventajas: exclusión declarativa común a reservas/bloqueos, resistente a escritores que respeten la constraint.
- Desventajas: otra estructura que debe mantenerse coherente con la reserva y sus intervalos; habilitación de extensiones/índices y modelado de preparación; no elimina transacciones, historial, idempotencia ni validación de permisos.

## Decisión

Proponer **B** para el modelo inicial del [ERD 27](../../mvp/27-rental-reservations-erd.md). Reevaluar C si se necesitan escritores externos o mayores garantías declarativas; no afirmar que índices B-tree impiden solapamientos.

- En disponibilidad, adquirir lock exclusivo de la casa antes de releer reservas/bloqueos y escribir cambios. Aplicarlo a altas, fechas/horarios, confirmaciones/cancelaciones y bloqueos. No bloquear solo las filas de reservas, que pueden no existir.
- Proteger agregados monetarios con lock de reserva y transacción; todos los repositorios, auditoría e idempotencia usan el mismo manager.
- Concretar revocación concurrente con validación/locks de pertenencia compatibles y orden casa → reserva → filas dependientes. No ampliar innecesariamente el lock de disponibilidad a lecturas de calendario ni transacciones con llamadas externas.
- `rental_operations` mantiene la clave por casa/actor/intención, hash de comando y respuesta permitida. El efecto y su respuesta se confirman juntos; replay revalida acceso. No reutilizar la clave para otra intención ni borrar automáticamente las claves de dinero con un TTL no evaluado.
- `rental_audit_events` conserva historia append-only. No reemplaza a idempotencia, no se expone como CRUD ni almacena indiscriminadamente PII.
- Política/horarios/importes acordados se conservan en la reserva. `refund_amount` expresa devolución aprobada; pagos de tipo refund expresan devolución realizada. No almacenar saldos editables.
- Fechas civiles de estadía/efectivas de dinero separadas de timestamps de captura. Días calendario para política y base sobre pagado se presentaron como propuestas y quedaron incluidos en la aceptación explícita del ERD 27.

## Consecuencias

- Positivas: comportamiento compartido coherente, recuperación de escrituras inciertas, condiciones históricas preservadas y evidencia de actor/cambio.
- Costos o riesgos aceptados como propuesta: dos tablas técnicas, serialización por casa donde corresponde, retención de respuestas/claves y protocolo obligatorio para todos los escritores. Resultados monetarios no cubren pagos externos ejecutados realmente por una pasarela.
- Trabajo posterior: contratos 28/plan Backend 29, SQL de migración, diseño de revocación, implementación y pruebas aisladas de rollback, reintentos simultáneos, reservas/bloqueos concurrentes y límites monetarios. Las verificaciones posteriores están registradas en 29 y al final de este ADR; la aprobación documental sigue pendiente.

## Referencias

- [ERD de Reservas](../../mvp/27-rental-reservations-erd.md)
- [Especificación funcional](../../mvp/26-rental-reservations-spec.md)
- [ADR-012](ADR-012-rental-property-collaboration.md)
- [Locks de PostgreSQL](https://www.postgresql.org/docs/current/explicit-locking.html)
- [Constraints de PostgreSQL](https://www.postgresql.org/docs/current/ddl-constraints.html)

## Estado tras aceptar el ERD — 2026-10-04

Esquema27 aceptado e incorporado al diagrama; [contratos 28](../../mvp/28-rental-reservations-contracts.md) concretan revalidación de pertenencia y lock exclusivo de casa para escrituras, además de creación idempotente de casa cuando aún no existe property_id. [Plan 29](../../mvp/29-rental-reservations-backend-plan.md) requiere demostrar esos mecanismos en PostgreSQL aislado. Son refinamientos de implementación en revisión, sin cambiar tablas del modelo ni aprobar este ADR completo.

## Evidencia de implementación local — 2026-10-04

Backend implementado en módulos verticales `src/rental-*`, sin nuevas tablas respecto del ERD aceptado. [Entrega/runbook de 29](../../mvp/29-rental-reservations-backend-plan.md) registra tests de casos de uso y PostgreSQL/HTTP real aislado, incluidas concurrencia, revocación, idempotencia, fallos antes de commit y recuperación. No se conectó a la BD objetivo ni se aprueba automáticamente este ADR.

Runtime y CLI fijan `synchronize=false`: registrar entidades no puede ejecutar DDL implícito en desarrollo. El cambio afecta a todos los módulos y obliga a aplicar migraciones revisadas; no se provee un baseline histórico completo para una BD vacía. El presupuesto de 10 s empieza al iniciar la transacción y limita SQL/commit con un QueryRunner privado; no garantiza la adquisición de conexión ni latencia total HTTP. No se abandonan writes mediante Promise.race.
