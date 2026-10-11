# Contrato de módulos y grupos de módulos

Actualizado 2026-10-09 desde entidades, DTOs, consultas y casos de uso de nodia-server. Base `/api/v1`. IDs bigint PostgreSQL enviados como strings; no convertir a Number. Módulos pertenecen a grupos mediante `module_group_id`; no existe jerarquía parent/submodule en este contrato.

## Lecturas y campos

`GET /modules` y `GET /module-groups` (aliases singulares conservados) devuelven `{ data, meta: { page, limit, total_items, total_pages } }`.

- `page` empieza en 1; `limit`/`size` controlan el tamaño. `all=true` obtiene el catálogo para opciones.
- Módulos aceptan `includes`; con true se incluye `module_group`. Los selectores usan `all=true&includes=false`.
- Filtros Ransack utilizados: `q[is_active_eq]=true|false`, `q[key_cont]`, y en módulos `q[key_in]`, `q[module_group_id_in]`. Todos omite is_active_eq.
- Grupo: `id`, `key`, `icon`, `is_active`, timestamps y `translates`.
- Módulo: mismos campos más `link`, `module_group_id` y relación `module_group` cuando se solicita.
- Traducciones: `{ key: "key", es, en }` para el nombre. Datos ausentes no permiten inventar nombres ni disponibilidad.

## Creación y edición

`POST /module`, `PUT /module/:id`; grupo: `POST /module-group`, `PUT /module-group/:id`.

- Crear grupo requiere `key`; icon, is_active y translates son opcionales.
- Crear módulo requiere `key`, `module_group_id` y `link`; icon, is_active y translates son opcionales.
- is_active por defecto true. DTOs de actualización permiten cambios parciales. Desactivar se conserva como operación distinta de eliminar.
- Consultar DTOs y casos de uso para las validaciones vigentes; los formularios reutilizan inputs, React Hook Form y Zod.

## Eliminación permanente

| Endpoint (singular o plural) | Resultado |
| --- | --- |
| `DELETE /module/:id`, `/modules/:id` | 204 sin cuerpo. Transacción elimina asignaciones user_modules, traducciones cuyo source_entity es modules y el módulo. Conserva su grupo. |
| `DELETE /module-group/:id`, `/module-groups/:id` | 204 sin cuerpo solo si no existe ningún módulo asociado, incluidos inactivos. Elimina sus traducciones de module_groups y el grupo. |

- ID inválido/fuera del rango bigint positivo: 400 `modules:invalid_id`.
- Módulo inexistente/repetición: 404 `modules:not_found`; grupo: 404 `modules:groups.not_found`.
- Grupo con módulos: 409 `modules:groups.delete_has_modules`; no se elimina nada.
- Lock pesimista de la fila y FK protegen asociaciones concurrentes. Fallo de limpieza revierte toda la transacción.
- Cache de autorización invalidada después del commit. Se conserva la protección global de autenticación/autorización existente.

## Interfaz

Por ajuste solicitado el 2026-10-09, el buscador de grupos se ubica en la fila sobre los registros, a la izquierda; Activos/Inactivos/Todos al extremo derecho desde sm. En xs ambos controles se apilan con ancho completo; la cabecera conserva Nuevo Grupo y expansión.

Ambos listados inician activos. Grupos ofrece Activos/Inactivos/Todos, exclusivo y con búsqueda persistente. Filtros cambian a página 1; borrar el último registro de una página posterior regresa a la anterior.

En xs se usan MobileRecordCard; desde sm, tablas. Se comparten consultas, paginado y acciones. Menú Eliminar con trash/error.main y ConfirmDialog; cancelación no hace petición. Error conserva modal y target con Alert y toast traducido; éxito cierra, notifica y revalida listas/contexto (y usuarios al borrar módulo). Revalidación conserva información y bloquea controles. Ver DESIGN.md 9.6.

## Verificación reproducible

- Server: casos de uso `delete-module*.use-case.spec.ts`; `npm run test:modules:integration` usa PostgreSQL temporal en Docker y controladores/casos de uso reales, sin escribir en la BD configurada. Su guard de prueba comprueba una frontera sintética; no sustituye auditoría del sistema de login.
- Client: tests de Modules y MobileRecordCard; entrada visual aislada `src/test/manual/modules/README.md`.
