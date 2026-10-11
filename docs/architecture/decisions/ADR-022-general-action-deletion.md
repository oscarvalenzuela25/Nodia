# ADR-022 — Eliminación transaccional de acciones generales

> Estado: propuesto (implementación solicitada; sin aprobación documental automática)
> Fecha: 2026-10-09

## Contexto

El usuario solicita eliminar acciones generales desde Ajustes. DELETE respondía con un stub y convertía IDs bigint a Number. La entidad Action tiene asignaciones RoleAction y traducciones polimórficas; eliminarlas por separado puede dejar limpieza parcial o fallar por FK.

## Opciones consideradas

### Opción A — Rechazar acciones asignadas

- Ventajas: mantiene las asignaciones sin cambios.
- Desventajas: impide eliminar el registro seleccionado y obliga a limpiar cada rol por separado. No se solicitó este bloqueo, a diferencia de grupos de módulos.

### Opción B — Eliminar registro y asociaciones en transacción

- Ventajas: satisface la eliminación solicitada y garantiza limpieza indivisible.
- Desventajas: irreversible; recrear la misma clave no restaura sus asignaciones.

## Decisión

Implementar B mediante DeleteActionUseCase: validar ID positivo dentro del rango bigint sin Number, bloquear Action FOR UPDATE, eliminar RoleAction activas/inactivas, traducciones exclusivamente del namespace actions y finalmente Action. La FK existente serializa nuevas asignaciones; un fallo revierte la operación. Invalidar caché de autorización después del commit con el mecanismo existente. Los aliases action/actions validan/delegan y devuelven204; ausente404 e ID inválido400.

La confirmación describe la eliminación permanente y la pérdida de asignaciones/traducciones. El modal conserva el registro ante error y permite reintento. Client invalida acciones, roles y contexto tras éxito. Autenticación global existente conservada; no se introducen permisos por acción, conforme a la decisión del producto del2026-10-03.

## Consecuencias

- Sin migraciones ni escrituras sobre catálogos reales durante la entrega.
- Pruebas de caso de uso más HTTP/PostgreSQL temporal verifican ambos aliases, IDs grandes, limpieza selectiva, rollback y ambos órdenes de asociación concurrente.
- La invalidación de Redis conserva su política existente de mejor esfuerzo; no se atribuye garantía de revocación inmediata durante una caída de Redis.
- Listados activos por defecto, tarjetas xs/tablas sm y misma consulta/filtros/página. Borrado del último registro de una página vuelve a la anterior.

## Referencias

- [Contrato de Acciones](../../../nodia-client/src/modules/generalSettings/pages/Actions/CONTRACT.md)
- [ADR-021](ADR-021-module-catalog-deletion.md)
- [Diseño y autorización vigente](../../mvp/07-design-constraints.md)
