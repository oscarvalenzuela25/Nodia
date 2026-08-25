# Modelo de dominio ERD — Nodia Parte 1

> Estado: aprobado
> Última actualización: 2026-08-19
> Dependencias: 01-interview.md aprobado, 02-prd-v1.md aprobado

## 1. Resumen del modelo

El modelo cubre la base de identidad y autorización de Nodia con siete tablas:

- `users`: personas preautorizadas para iniciar sesión con Google.
- `roles`: agrupaciones reutilizables de permisos, incluido el rol reservado `super admin`.
- `modules`: módulos y submódulos de la aplicación (una sola entidad con `type` y `parent_id`).
- `resources`: secciones o capacidades funcionales protegidas, ligadas a un módulo o submódulo.
- `actions`: catálogo fijo de las cuatro acciones `view`, `create`, `update` y `delete`.
- `role_resource_actions`: permisos por rol (pivote rol + recurso + acción).
- `user_roles`: asignación de roles a usuarios (pivote usuario + rol).

### Relaciones clave

- Un módulo puede tener muchos submódulos (`modules.parent_id` → `modules.id`).
- Un recurso pertenece a exactamente un módulo o submódulo (`resources.module_id` → `modules.id`).
- Un rol tiene muchos permisos (`role_resource_actions`), cada uno sobre un recurso y una acción.
- Un usuario tiene muchos roles (`user_roles`).

### Supuestos importantes

- `Home` es un módulo exclusivamente de frontend (hardcodeado); no es una fila de `modules`.
- La identidad externa de Google no tiene tabla propia: `users` guarda nombre, correo e imagen, y Google completa los campos vacíos tras el primer acceso válido.
- El correo se persiste normalizado en minúsculas y es único.
- `actions` es un catálogo fijo sembrado por el backend, no administrable desde la interfaz.

## 2. Mapeo funcional → entidades

### Módulos detectados → entidades

| Módulo / submódulo | Entidad |
|---|---|
| `Home` (universal) | Sin tabla (frontend hardcodeado) |
| `Ajustes Generales` | `modules` (fila con `type = 'module'`) |
| `Users` | `users` + `user_roles` (submódulo de `generalSettings`) |
| `Modules` | `modules` (submódulo que administra la propia entidad) |
| `Roles` | `roles` + `role_resource_actions` |
| `Resources` | `resources` |

### Flujos relevantes → relaciones necesarias

| Flujo | Relación que lo soporta |
|---|---|
| Inicio de sesión por correo permitido y activo | `users.email`, `is_allowed`, `is_active` |
| Datos de Google completan identidad | `users.name`, `users.image_url` (nullable) |
| Permisos efectivos por roles | `user_roles` → `role_resource_actions` → `actions` |
| Recurso protegido dentro de un módulo/submódulo | `resources.module_id` → `modules.id` |
| Submódulo dentro de su módulo padre | `modules.parent_id` → `modules.id` |
| Borrado lógico de usuarios, roles, recursos y módulos | `is_active` en cada entidad y pivote |

### Reglas de negocio → campos o estructuras que las soportan

| Regla | Soporte en el modelo |
|---|---|
| Sesión válida exige `allowed` y activo | `users.is_allowed` + `users.is_active` |
| Alta de usuario requiere solo correo | `users.email` `not null, unique`; `name`/`image_url` nullable |
| Acciones fijas (4) | `actions` sembrado con valores únicos |
| Un rol no repite un permiso | índice único `(role_id, resource_id, action_id)` |
| Un usuario no repite un rol | índice único `(user_id, role_id)` |
| Un recurso pertenece a un solo módulo/submódulo | `resources.module_id` `not null` con FK |
| Relación padre-hijo explícita sin `split` de key | `modules.parent_id` con FK |

## 3. Modelo DBML

```dbml
Table users [headercolor: #175e7a] {
	id uuid [ pk, not null ]
	name varchar(255)
	email text [ not null, unique ]
	image_url text
	is_allowed boolean [ not null, default: true ]
	is_active boolean [ not null, default: true ]
	created_at timestamp [ not null ]
	updated_at timestamp [ not null ]
}

Table roles [headercolor: #175e7a] {
	id uuid [ pk, not null ]
	name text [ not null ]
	is_active boolean [ not null, default: true ]
	created_at timestamp [ not null ]
	updated_at timestamp [ not null ]
}

Table resources [headercolor: #175e7a] {
	id uuid [ pk, not null ]
	name text [ not null ]
	key text [ not null, unique ]
	module_id uuid [ not null ]
	comment text
	is_active boolean [ not null, default: true ]
	created_at timestamp [ not null ]
	updated_at timestamp [ not null ]
}

Table actions [headercolor: #175e7a] {
	id uuid [ pk, not null ]
	value varchar(255) [ not null, unique ]
	is_active boolean [ not null, default: true ]
	created_at timestamp [ not null ]
	updated_at timestamp [ not null ]
}

Table role_resource_actions [headercolor: #175e7a] {
	id integer [ pk, increment, not null ]
	role_id uuid [ not null ]
	resource_id uuid [ not null ]
	action_id uuid [ not null ]
	is_active boolean [ not null, default: true ]
	created_at timestamp [ not null ]
	updated_at timestamp [ not null ]

	indexes {
		(role_id, resource_id, action_id) [ unique, name: 'uq_role_resource_action' ]
	}
}

Table user_roles [headercolor: #175e7a] {
	id integer [ pk, increment, not null ]
	user_id uuid [ not null ]
	role_id uuid [ not null ]
	is_active boolean [ not null, default: true ]
	created_at timestamp [ not null ]
	updated_at timestamp [ not null ]

	indexes {
		(user_id, role_id) [ unique, name: 'uq_user_role' ]
	}
}

Table modules [headercolor: #175e7a] {
	id uuid [ pk, not null ]
	label text [ not null ]
	key text [ not null, unique ]
	type text [ not null ]
	parent_id uuid
	is_active boolean [ not null, default: true ]
	created_at timestamp [ not null ]
	updated_at timestamp [ not null ]
}

Ref fk_roles_id_role_resource_action {
	roles.id < role_resource_actions.role_id [ delete: no action, update: no action ]
}

Ref fk_actions_id_role_resource_action {
	actions.id < role_resource_actions.action_id [ delete: no action, update: no action ]
}

Ref fk_resources_id_role_resource_action {
	resources.id < role_resource_actions.resource_id [ delete: no action, update: no action ]
}

Ref fk_users_id_user_role {
	users.id < user_roles.user_id [ delete: no action, update: no action ]
}

Ref fk_roles_id_user_role {
	roles.id < user_roles.role_id [ delete: no action, update: no action ]
}

Ref fk_modules_id_resources {
	modules.id < resources.module_id [ delete: no action, update: no action ]
}

Ref fk_modules_id_modules {
	modules.id < modules.parent_id [ delete: no action, update: no action ]
}
```

## 4. Decisiones y supuestos del modelo

### Hechos confirmados

- `Home` es solo frontend y está hardcodeado; no se persiste.
- No existe tabla de identidad externa: `users` es suficiente para el MVP; Google rellena `name` y `image_url` tras el primer acceso válido si siguen vacíos.
- El correo es `not null` y `unique`, y se persiste normalizado en minúsculas.
- Un recurso pertenece a exactamente un módulo o submódulo mediante `resources.module_id`.
- La jerarquía módulo/submódulo usa una sola entidad `modules` con `type` y `parent_id`.
- La unicidad de los pivotes es compuesta y se declara con `indexes`.

### Inferencias razonables

- `type` admite valores que distinguen módulo de submódulo (p. ej. `module` / `submodule`); el valor exacto se fijará con el dominio de Route Specs o el seed.
- El rol `super admin` es un registro sembrado de `roles` con nombre `super admin` y `is_active = true`.
- `resources.key` es estable y se usa para construir claves semánticas de autorización; su alcance exacto de unicidad se valida en PRD V2.

### Pendientes no bloqueantes

- Normalización del correo (minúsculas) confirmada para esta etapa; la comparación con Google se detallará en Route Specs.
- `google_id` y soporte de múltiples proveedores quedan fuera del MVP; se considerarán en una iteración futura.
- La protección del último super admin operativo es una regla de aplicación (backend), no una restricción de base de datos.

## 5. Dudas y vacíos detectados

- **Unicidad global de `resources.key`**: la clave de autorización completa sigue `module:resource:action` o `module:submodule:resource:action`. Si dos módulos distintos llegaran a usar el mismo `resources.key`, la unicidad global bloquearía el caso. Para el MVP actual (catálogo pequeño) es aceptable, pero conviene validar en PRD V2 si la unicidad debe ser global o por módulo.
- **Valores exactos de `modules.type`**: se definen como `module` / `submodule` salvo confirmación contraria.
- **`actions.value`**: los valores son `view`, `create`, `update` y `delete`; el seed los crea y el backend los trata como catálogo fijo.
- **PK mixtas**: entidades con `uuid` y pivotes con `integer increment`. Es válido para el MVP; uniformizar es opcional.
- **Navegación administrativa separada de Home**: se resuelve en Sitemap y Route Specs, no en el modelo.

## 6. Insumos recomendados para PRD V2

- Reconciliar las entidades aprobadas del ERD con el comportamiento del PRD V1.
- Validar la unicidad de `resources.key` (global vs por módulo/submódulo).
- Formalizar la derivación del contexto de autorización (roles → permisos → claves semánticas).
- Definir el ciclo de vida y edición de `modules` y `resources` (mutabilidad de `key`, estados de `is_active`).
- Revisar que las rutas del sitemap representen los mismos recursos que `resources`.