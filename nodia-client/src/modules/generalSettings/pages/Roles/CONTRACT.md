# Contrato de Roles

> Revisado contra entidades, DTOs y runtime de Nodia Server el 2026-10-09. Implementación solicitada; sin aprobación documental automática.

## Rutas y datos

Los aliases `/api/v1/role` y `/api/v1/roles` comparten controlador. IDs bigint positivos como **strings**, nunca UUID ni Number. Rol: `id`, `key` único, `is_active`, timestamps y traducciones opcionales `translates: [{key,es,en}]`. Las traducciones usan namespace `roles` y la etiqueta utiliza `key` como source_key. Las acciones generales asociadas tienen ID, key, description nullable, is_active, timestamps y traducciones; **no tienen module_id**.

| Operación | Contrato |
| --- | --- |
| GET colección | `{data: Role[], meta: {page,limit,total_items,total_pages}}` |
| GET `/:id` | Rol y acciones/traducciones disponibles |
| POST colección | CreateRoleDto: key requerido; is_active, actions y translates opcionales. La creación existente actualiza el rol de la misma clave |
| PUT/PATCH `/:id` | UpdateRoleDto parcial. actions ausente conserva asignaciones; `[]` las retira. acepta claves o IDs string de acciones |
| DELETE `/:id` | 204 sin cuerpo; ID inválido400, ausente404 y super_admin403 |

La edición bloquea el registro y persiste rol, reemplazo de RoleAction y traducciones en la misma transacción. La clave `super_admin` no puede renombrarse (`roles:protected_key`); en el formulario se conserva en solo lectura con traducciones editables. Esta entrega no cierra las invariantes pendientes de última persona superadministradora activa ni la inmutabilidad general de claves de S-04 en19.

## Consulta y filtros

Paginación base1; `page`, `size` o `limit` (default10), `all=true` omite paginado. `includes=true` (default) devuelve acciones; false devuelve `actions: []`. Traducciones de Roles disponibles en ambos casos.

Predicados públicos: `key_cont`, `key_in`, `is_active_eq`, `actions_id_eq`, `actions_id_in`, `actions_key_cont`, `actions_key_in` y orden `s` conforme a la política Role. Booleanos estrictos; arrays transformados/validados por RoleFilterDto. Los filtros de acciones seleccionan roles mediante EXISTS y **no recortan las acciones incluidas en la respuesta**. Filtros/search se aplican antes de paginar; no filtrar solo la página descargada en Client.

Client inicia con `q.is_active_eq=true`; Limpiar restaura activos y vacía los filtros por roles/acciones. Quitar el chip permite todos; switch del filtro permite inactivos. Cambiar filtros/búsqueda/tamaño reinicia página. Búsqueda por identificador real (`key_cont`). Catálogos auxiliares: GET roles/actions con all=true/includes=false, conservan activos e inactivos y no heredan el filtro principal. Sin peticiones por tarjeta.

## Eliminación

DeleteRoleUseCase valida el ID exacto dentro del rango bigint, toma FOR UPDATE sobre Role y comprueba su clave canónica. **super_admin no se elimina aunque esté inactivo o tenga otro nombre traducido**. Para otros roles elimina UserRole y RoleAction activas/inactivas, traducciones exclusivamente `source_entity=roles/source_id=id`, y finalmente Role, en una sola transacción. Usuarios y acciones de catálogo permanecen. Un fallo revierte todos los cambios; las FK serializan nuevas asignaciones y evitan huérfanos. Redis auth:context se invalida después del commit con la política existente de mejor esfuerzo.

Menú Eliminar con DeleteOutlined/error.main y ConfirmDialog traducido: identifica rol y pérdida permanente de asignaciones/traducciones. No hay DELETE antes de confirmar; error conserva selección/modal y permite reintento. Éxito emite Sileo, cierra y revalida roles, usuarios y contexto. El último registro de una página posterior eliminado devuelve a la página anterior. Autenticación vigente conservada; sin nuevos permisos por acción conforme a la decisión del2026-10-03.

## Presentación responsive y estados

xs (<600px): MobileRecordCard con nombre traducido o clave real, estado textual, ID completo, identificador y todas las acciones asociadas con etiquetas que envuelven; ausencia explícita `-`. Actualizar principal y menú copiar/estado/eliminar (este último omitido para super_admin). sm+: tabla con mínimo650px y scroll local transparente; misma consulta/página/handlers. Paginación fuera del scroll/Skeleton con etiquetas ES/EN y controles44px.

Boneyard inicial informativo; refetch/mutación conserva registros y bloquea controles, incluido menú abierto. Error con Alert/reintento y toast del gestor HTTP; vacío solo tras respuesta exitosa. Formularios permanecen abiertos con datos ante fallo. Los botones de RoleModal se apilan al100% en móvil. Ver DESIGN9.6 y plan35.

## Evidencia y límites

Casos de uso e integración compilada Nest/HTTP/PostgreSQL temporal cubren aliases, IDs grandes, filtros, protección activa/inactiva/renombrado, limpieza selectiva, rollback de borrado/edición y ambos órdenes de nuevas asignaciones de usuarios/acciones. Fixtures Client aislados en `src/test/manual/roles`; medidas/capturas externas registradas en00. No se eliminan roles reales ni se aplican migraciones. Aceptación en teléfono físico, sesión real y garantías de revocación durante caída de Redis permanecen pendientes.
