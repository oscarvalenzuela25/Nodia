# ADR-024 — Eliminación explícita en Finanzas personales

> Estado: propuesto; comportamiento solicitado explícitamente por el usuario
> Fecha: 2026-10-09

## Contexto

El usuario solicita adaptar toda Finanzas personales a móvil y eliminar registros. Sustituye la limitación anterior de solo archivado en contratos22. Confirma que un préstamo con pagos no puede eliminarse; cuando solo tiene su movimiento inicial, permite eliminarlo. Una categoría vinculada a movimientos no se elimina.

## Opciones consideradas

### Opción A: mantener únicamente archivado

- Ventajas: conserva historia y sus efectos financieros.
- Desventajas: no satisface la solicitud de corregir registros mediante eliminación real.

### Opción B: eliminación física explícita con restricciones y transacciones

- Ventajas: elimina el registro solicitado y sus asociaciones prescindibles, conserva integridad y no elimina pagos implícitamente.
- Desventajas: pérdida irreversible de historia y recálculo de saldos. Requiere explicar las consecuencias antes de confirmar.

### Opción C: cascada automática de préstamo y pagos

- Ventajas: permite eliminar cualquier préstamo.
- Desventajas: el usuario rechaza esta alternativa; perdería pagos sin intervención individual.

## Decisión

Implementar B dentro de los cuatro recursos existentes, sin cambiar tablas ni FKs NO ACTION.

- Categoría: lock del registro propio; rechazar cualquier movimiento asociado, incluso cancelado/inactivo; retirar sus memberships activos/inactivos y eliminar categoría en una transacción.
- Grupo: lock propio; retirar memberships y grupo juntos, conservando categorías y movimientos.
- Movimiento: lectura de identidad, lock de obligación si existe y después lock de movimiento; eliminar movimientos ordinarios o pagos. Proteger movimiento inicial: se elimina únicamente desde su obligación.
- Préstamo/deuda: lock de obligación común con creación/actualización/eliminación de pagos; rechazar cualquier pago de cualquier estado/actividad. Exigir un movimiento inicial único y eliminarlo junto con la obligación.
- DELETE devuelve204; ID bigint exacto/DTO existente, propietario desde sesión, ausencia o propietario ajeno404, vínculo protegido409. FKs/locks respaldan carreras. Conflictos SQL se traducen sin exponer información interna.
- Client: trash/error.main y ConfirmDialog con advertencia por recurso. Error conserva target; no replay automático tras pérdida de respuesta. Revisar mediante GET exacto:404 confirma ausencia, registro presente permite reintento manual, fallo de lectura conserva incertidumbre. Invalidación financiera solo por usuario.
- No se cambia significado de is_active: archivar sigue conservando efecto financiero confirmado. Eliminar un movimiento confirmado sí modifica sus agregados; eliminar un pago confirmado aumenta el saldo pendiente.

## Consecuencias

- Sin migración ni cascada ORM global; no modificar Obsidian por no cambiar relaciones/tablas.
- Todos los registros móviles comparten consulta, filtro, página y handlers con escritorio; importes completos y errores conservados.
- Se mantiene revisión documental pendiente; esta decisión registra la solicitud, no aprueba automáticamente los documentos anteriores.
- Validar casos de uso, HTTP/DI y transacciones sobre PostgreSQL temporal, incluidos rollback y ambos órdenes de carrera pago/eliminación. Sesión real y aceptación física no se deducen de fixtures.

## Referencias

- [Contrato22](../../mvp/22-personal-finance-contracts.md)
- [Ledger previo ADR-011](ADR-011-personal-finance-ledger.md)
- [Plan Client24](../../mvp/24-personal-finance-client-plan.md)
