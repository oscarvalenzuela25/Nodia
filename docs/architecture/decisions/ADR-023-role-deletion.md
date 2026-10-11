# ADR-023 — Eliminación transaccional de Roles y protección de super_admin

> Estado: propuesto (implementación solicitada; sin aprobación documental automática)
> Fecha: 2026-10-09

## Contexto

El usuario solicita eliminación de roles salvo super_admin, activos por defecto y tarjetas móviles. DELETE era un stub con conversión de bigint a Number. UserRole/RoleAction y traducciones dependen del rol; eliminar solo el padre falla por FK. La edición podía renombrar la clave reservada y eludir una protección basada en esa clave. Filtros Client sobre la página descargada y joins filtrados producían resultados/totales/asignaciones parciales.

## Opciones consideradas

### Opción A — Rechazar todo rol asignado

- Ventajas: no retira asociaciones existentes.
- Desventajas: añade un bloqueo no solicitado y exige desmontar cada asignación antes de borrar.

### Opción B — Limpiar asociaciones y rol de forma indivisible

- Ventajas: cumple la eliminación y evita huérfanos/limpieza parcial.
- Desventajas: permanente; recrear la clave no restaura sus asignaciones.

## Decisión

Elegir B, siguiendo ADR-021/022. DeleteRoleUseCase valida bigint string sin Number, bloquea Role FOR UPDATE, rechaza key=super_admin con403 (incluido inactivo), elimina UserRole, RoleAction, Translation del namespace roles y finalmente Role. DELETE en ambos aliases responde204; inválido400/ausente404. Las FK existentes serializan inserciones; cualquier fallo revierte la operación.

La edición usa transacción y el mismo bloqueo del padre: rechaza renombrar la clave super_admin antes de guardar y persiste cambios/asignaciones/traducciones sin parcialidad. TranslationService acepta un manager opcional para mantener la transacción; consumidores existentes conservan comportamiento. El formulario deja solo la clave reservada en lectura y mantiene traducciones editables. No se introducen permisos por acción; conserva autenticación del producto.

La confirmación describe permanencia y pérdida de asignaciones a usuarios/acciones/traducciones. Error conserva modal/selección; éxito invalida roles/usuarios/contexto Client y auth:context Server tras commit. Tarjetas xs/tablas sm comparten consulta, filtros, paginado y handlers. Los filtros de acciones usan EXISTS para devolver roles con todas sus acciones incluidas.

## Consecuencias

- No requiere migración de esquema ni modificaciones de catálogos reales en esta entrega.
- Borrado puede reducir asociaciones de personas; no elimina personas ni acciones generales.
- Redis conserva su política existente de mejor esfuerzo; no se garantiza revocación inmediata durante su caída.
- Pruebas de casos de uso y35 peticiones HTTP con PostgreSQL descartable verifican protección, rollback y concurrencia de ambas FK.
- La entrega cierra protección de borrado/renombrado del rol reservado; otras invariantes de S-04 (último superadministrador activo e inmutabilidad general) siguen pendientes y no se declara cerrada la revisión de seguridad.
- Revisión física y sesión/BD objetivo quedan fuera de la evidencia con fixtures.

## Referencias

- [Contrato de Roles](../../../nodia-client/src/modules/generalSettings/pages/Roles/CONTRACT.md)
- [ADR-022](ADR-022-general-action-deletion.md)
- [PRD](../../mvp/04-prd-v2.md)
- [Revisión previa](../../mvp/19-prelaunch-review.md)
- [Diseño móvil](../../mvp/35-mobile-cards-shortcuts-plan.md)
