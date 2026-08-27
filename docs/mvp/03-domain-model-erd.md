# Modelo de dominio ERD — Nodia Parte 1

> Estado: aprobado
> Última actualización: 2026-08-26
> Dependencias: 01-interview.md aprobado, 02-prd-v1.md aprobado

## 1. Resumen del modelo

El modelo cubre la base de identidad y autorización de Nodia con seis tablas:

- `users`: personas preautorizadas para iniciar sesión con Google.
- `roles`: agrupaciones reutilizables de permisos, identificadas por un `key` para soporte multiidioma.
- `modules`: módulos y submódulos de la aplicación, identificados por un `key` (una sola entidad con `type` y `parent_id`).
- `actions`: catálogo de acciones dinámicas (permisos), con un `key` (multiidioma) y vinculadas opcionalmente a un módulo (`module_id`).
- `role_actions`: permisos asignados por rol (pivote rol + acción).
- `user_roles`: asignación de roles a usuarios (pivote usuario + rol).

### Relaciones clave

- Un módulo puede tener muchos submódulos (`modules.parent_id` → `modules.id`).
- Una acción puede pertenecer opcionalmente a un módulo o submódulo (`actions.module_id` → `modules.id`).
- Un rol tiene muchas acciones (`role_actions`).
- Un usuario tiene muchos roles (`user_roles`).

### Supuestos importantes

- Se eliminan tablas y campos descriptivos (`name` en roles, `label` en modules) en favor de utilizar un `key` (ej. `viewUserPage`) para habilitar traducciones (i18n) desde el frontend.
- `Home` es un módulo exclusivamente de frontend (hardcodeado); no es una fila de `modules`.
- La identidad externa de Google no tiene tabla propia: `users` guarda nombre, correo e imagen, y Google completa los campos vacíos tras el primer acceso válido.
- El correo se persiste normalizado en minúsculas y es único.
- Se ha simplificado la autorización eliminando `resources`, vinculando directamente las acciones (dinámicas) a los roles.
- `users.is_allowed` fue removido; la autorización de ingreso ahora dependerá únicamente de `is_active` (u otra lógica si se define en el futuro).

## 2. Mapeo funcional → entidades

### Módulos detectados → entidades

| Módulo / submódulo | Entidad |
|---|---|
| `Home` (universal) | Sin tabla (frontend hardcodeado) |
| `Ajustes Generales` | `modules` (fila con `type = 'module'`) |
| `Users` | `users` + `user_roles` (submódulo de `generalSettings`) |
| `Modules` | `modules` (submódulo que administra la propia entidad) |
| `Roles` | `roles` + `role_actions` |
| `Actions` | `actions` (nuevo catálogo dinámico de permisos) |

### Flujos relevantes → relaciones necesarias

| Flujo | Relación que lo soporta |
|---|---|
| Inicio de sesión por correo permitido | `users.email`, `is_active` |
| Datos de Google completan identidad | `users.name`, `users.image_url` (nullable) |
| Permisos efectivos por roles | `user_roles` → `role_actions` → `actions` |
| Acción agrupada en módulo/submódulo | `actions.module_id` → `modules.id` (opcional) |
| Submódulo dentro de su módulo padre | `modules.parent_id` → `modules.id` |
| Borrado lógico | `is_active` en todas las entidades |

### Reglas de negocio → campos o estructuras que las soportan

| Regla | Soporte en el modelo |
|---|---|
| Sesión válida exige usuario activo | `users.is_active` |
| Alta de usuario requiere solo correo | `users.email` `not null, unique`; `name`/`image_url` nullable |
| Un rol no repite un permiso | índice único compuesto `(role_id, action_id)` en `role_actions` |
| Un usuario no repite un rol | índice único compuesto `(user_id, role_id)` en `user_roles` |
| Relación padre-hijo explícita | `modules.parent_id` con FK |
| Soporte Multiidiomas (i18n) | Uso exclusivo de `key` en `roles`, `actions`, `modules` |

## 3. Modelo DBML

```dbml
Table users [headercolor: #175e7a] {
	id uuid [ pk, not null ]
	name varchar(255)
	email text [ not null, unique ]
	image_url text
	is_active boolean [ not null, default: true ]
	created_at timestamp [ not null ]
	updated_at timestamp [ not null ]
}

Table roles [headercolor: #175e7a] {
	id uuid [ pk, not null ]
	key text [ not null ]
	is_active boolean [ not null, default: true ]
	created_at timestamp [ not null ]
	updated_at timestamp [ not null ]
}

Table actions [headercolor: #175e7a] {
	id uuid [ pk, not null ]
	module_id uuid
	key text [ not null, unique ]
	description text
	is_active boolean [ not null, default: true ]
	created_at timestamp [ not null ]
	updated_at timestamp [ not null ]
}

Table role_actions [headercolor: #175e7a] {
	id integer [ pk, increment, not null ]
	role_id uuid [ not null ]
	action_id uuid [ not null ]
	is_active boolean [ not null, default: true ]
	created_at timestamp [ not null ]
	updated_at timestamp [ not null ]

	indexes {
		(role_id, action_id) [ unique, name: 'uq_role_action' ]
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
	key text [ not null, unique ]
	type text [ not null ]
	parent_id uuid
	is_active boolean [ not null, default: true ]
	created_at timestamp [ not null ]
	updated_at timestamp [ not null ]
}

Ref fk_role_actions_role {
	role_actions.role_id > roles.id [ delete: no action, update: no action ]
}

Ref fk_role_actions_action {
	role_actions.action_id > actions.id [ delete: no action, update: no action ]
}

Ref fk_user_roles_user {
	user_roles.user_id > users.id [ delete: no action, update: no action ]
}

Ref fk_user_roles_role {
	user_roles.role_id > roles.id [ delete: no action, update: no action ]
}

Ref fk_modules_parent {
	modules.parent_id > modules.id [ delete: no action, update: no action ]
}

Ref fk_actions_module {
	actions.module_id > modules.id [ delete: no action, update: no action ]
}
```

## 4. Decisiones y supuestos del modelo

### Hechos confirmados

- `Home` es solo frontend y está hardcodeado; no se persiste.
- Eliminación de la entidad `resources` en favor de `actions` dinámicas, simplificando la relación permisos-roles.
- Uso generalizado de `key` en lugar de campos de texto descriptivo (`name`, `label`) para soportar internacionalización (i18n).
- La acción (`action`) se asocia opcionalmente a un módulo (`module_id`), permitiendo acciones transversales (nulas) o anidadas.
- No existe tabla de identidad externa: `users` es suficiente para el MVP; Google rellena `name` y `image_url` tras el primer acceso válido si siguen vacíos.
- El correo es `not null` y `unique`, y se persiste normalizado en minúsculas.
- La unicidad de los pivotes es compuesta y se declara con `indexes`.

### Inferencias razonables

- `type` en módulos admite valores que distinguen módulo de submódulo (p. ej. `module` / `submodule`); el valor exacto se fijará con el dominio de Route Specs o el seed.
- El rol `super admin` es un registro sembrado de `roles` con `key = 'super_admin'` y `is_active = true`.
- Los nombres a mostrar en el Frontend serán resueltos mediante un diccionario de traducción basado en las `keys` (ej. `viewUserPage` -> "Ver página de usuarios").

### Pendientes no bloqueantes

- `google_id` y soporte de múltiples proveedores quedan fuera del MVP; se considerarán en una iteración futura.
- La protección del último super admin operativo es una regla de aplicación (backend), no una restricción de base de datos.

## 5. Dudas y vacíos detectados

- **`actions.key` único global**: Al no haber contexto de resource, la `key` de la acción debe ser globalmente única y descriptiva (ej. `user.view`, `module.create`), para evitar colisiones.
- **`users.is_allowed` eliminado**: Al removerse este campo, se asume que un usuario validado por OAuth ingresa si `is_active = true` o si su correo existe previamente, esto se terminará de definir en las Specs.
- **PK mixtas**: entidades con `uuid` y pivotes con `integer increment`. Es válido para el MVP; uniformizar es opcional.
- **Navegación administrativa separada de Home**: se resuelve en Sitemap y Route Specs, no en el modelo.

## 6. Insumos recomendados para PRD V2

- Actualizar el modelo conceptual y eliminar referencias a "Resources".
- Definir convención de nomenclatura de `keys` para las acciones (ej. `camelCase`, `dot.notation`) para facilitar i18n.
- Revalidar permisos requeridos por cada módulo con las acciones dinámicas.