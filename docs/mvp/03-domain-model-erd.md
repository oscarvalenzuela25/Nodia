# Modelo de dominio ERD — Nodia Parte 1

> Estado: en revisión — ampliación auth 2026-09-12; aprobación histórica del MVP conservada
> Última actualización: 2026-09-07
> Dependencias: 01-interview.md aprobado, 02-prd-v1.md aprobado

## 1. Resumen del modelo

El modelo cubre la base de identidad, autorización, navegación e internacionalización de Nodia con diez tablas (incluida la ampliación técnica de sesiones):

- `auth_sessions`: sesiones renovables, hash del refresh token, expiración y revocación.
- `users`: personas preautorizadas para iniciar sesión con Google.
- `roles`: agrupaciones reutilizables de permisos funcionales, identificadas por un `key`.
- `module_groups`: catálogo de grupos únicos para agrupar módulos de navegación, identificados por un `key`.
- `modules`: catálogo plano de módulos de la aplicación, vinculados a un grupo mediante `module_group_id`.
- `actions`: catálogo de acciones dinámicas (permisos de endpoints/operaciones), con un `key` globalmente único e independientes de módulos.
- `role_actions`: permisos asignados por rol (pivote rol + acción).
- `user_roles`: asignación de roles a usuarios (pivote usuario + rol).
- `user_modules`: asignación de visibilidad de módulos a usuarios (pivote usuario + módulo).
- `translations`: catálogo centralizado de traducciones i18n para cualquier entidad y campo (`source_entity`, `source_id`, `source_key`, `locale`).

### Relaciones clave

- Un usuario tiene muchos roles (`user_roles`).
- Un usuario tiene muchos módulos asignados (`user_modules`).
- Un rol tiene muchas acciones (`role_actions`).
- Un módulo pertenece a un grupo de módulos (`module_groups` vía `module_group_id`).
- Las acciones son independientes del árbol de navegación (`actions` no tiene `module_id`).
- Las traducciones identifican de forma unívoca la traducción de cualquier campo por registro e idioma (`translations`).

### Supuestos importantes

- Se eliminan la jerarquía recursiva de módulos (`parent_id`, `type = 'submodule'`) y el atributo de agrupación en string (`group_by`); ahora los módulos son homogéneos y se normalizan relacionalmente asociándose a una entidad `module_groups` mediante `module_group_id`.
- Las acciones dinámicas quedan 100% desacopladas de los módulos de navegación, separando los permisos operativos (backend/acciones) de la navegación en UI (módulos asignados al usuario).
- La gestión de traducciones (i18n) se centraliza en la tabla `translations` con clave cuádruple (`source_entity`, `source_id`, `source_key`, `locale`), permitiendo traducir dinámicamente atributos como `key`, `comment`, `description`, etc., en múltiples idiomas.
- `Home` es un módulo exclusivamente de frontend (hardcodeado); no es una fila de `modules`.
- La identidad externa de Google no tiene tabla propia: `users` guarda nombre, correo e imagen, y Google completa los campos vacíos tras el primer acceso válido.
- El correo se persiste normalizado en minúsculas y es único.

## 2. Mapeo funcional → entidades

### Módulos detectados → entidades

| Módulo / Funcionalidad | Entidad |
|---|---|
| `Home` (universal) | Sin tabla (frontend hardcodeado) |
| `Grupos de Módulos` | `module_groups` (agrupadores normalizados de módulos) |
| `Módulos de navegación` | `modules` (vinculados a `module_groups` vía `module_group_id`) |
| `Asignación de navegación` | `user_modules` (relación usuario - módulo) |
| `Users` | `users` + `user_roles` + `user_modules` |
| `Roles` | `roles` + `role_actions` |
| `Actions` | `actions` (catálogo dinámico de permisos sin `module_id`) |
| `Traducciones (i18n)` | `translations` (catálogo centralizado cuádruple) |

### Flujos relevantes → relaciones necesarias

| Flujo | Relación que lo soporta |
|---|---|
| Inicio de sesión por correo permitido | `users.email`, `is_active` |
| Datos de Google completan identidad | `users.name`, `users.image_url` (nullable) |
| Permisos efectivos por roles | `user_roles` → `role_actions` → `actions` |
| Módulos visibles en frontend por usuario | `user_modules` → `modules` → `module_groups` |
| Borrado lógico | `is_active` en todas las entidades |
| Traducción dinámica de entidades y campos | `translations(source_entity, source_id, source_key, locale)` |

### Reglas de negocio → campos o estructuras que las soportan

| Regla | Soporte en el modelo |
|---|---|
| Sesión válida exige usuario activo | `users.is_active` |
| Alta de usuario requiere solo correo | `users.email` `not null, unique`; `name`/`image_url` nullable |
| Un rol no repite un permiso | índice único compuesto `(role_id, action_id)` en `role_actions` |
| Un usuario no repite un rol | índice único compuesto `(user_id, role_id)` en `user_roles` |
| Un usuario no repite un módulo | índice único compuesto `(user_id, module_id)` en `user_modules` |
| Agrupación de módulos | `modules.module_group_id` con clave foránea a `module_groups.id` e índice `idx_modules_module_group_id` |
| Soporte Multiidiomas (i18n) | Unicidad cuádruple en `translations(source_entity, source_id, source_key, locale)` con índice de búsqueda por `(locale, source_entity, source_id)` |

## 3. Modelo DBML

```dbml
Table user_modules [headercolor: #175e7a] {
	id bigint [ pk, increment, not null ]
	user_id bigint [ not null ]
	module_id bigint [ not null ]
	is_active boolean [ not null, default: true ]
	created_at timestamp [ not null ]
	updated_at timestamp [ not null ]

	indexes {
		(user_id, module_id) [ name: 'uq_user_module', unique ]
	}
}

Table users [headercolor: #175e7a] {
	id bigint [ pk, increment, not null ]
	name varchar(255)
	email text [ not null, unique ]
	image_url text
	is_active boolean [ not null, default: true ]
	created_at timestamp [ not null ]
	updated_at timestamp [ not null ]
}

Table roles [headercolor: #175e7a] {
	id bigint [ pk, increment, not null ]
	key text [ not null, unique ]
	is_active boolean [ not null, default: true ]
	created_at timestamp [ not null ]
	updated_at timestamp [ not null ]
}

Table actions [headercolor: #175e7a] {
	id bigint [ pk, increment, not null ]
	key text [ not null, unique ]
	description text
	is_active boolean [ not null, default: true ]
	created_at timestamp [ not null ]
	updated_at timestamp [ not null ]
}

Table module_groups [headercolor: #175e7a] {
	id bigint [ pk, increment, not null ]
	key varchar(255) [ not null, unique ]
	is_active boolean [ not null, default: true ]
	created_at timestamp [ not null ]
	updated_at timestamp [ not null ]
}

Table modules [headercolor: #175e7a] {
	id bigint [ pk, increment, not null ]
	module_group_id bigint [ not null ]
	link varchar(255) [ not null ]
	key varchar(255) [ not null, unique ]
	is_active boolean [ not null, default: true ]
	created_at timestamp [ not null ]
	updated_at timestamp [ not null ]

	indexes {
		module_group_id [ name: 'idx_modules_module_group_id' ]
	}
}

Table role_actions [headercolor: #175e7a] {
	id bigint [ pk, increment, not null ]
	role_id bigint [ not null ]
	action_id bigint [ not null ]
	is_active boolean [ not null, default: true ]
	created_at timestamp [ not null ]
	updated_at timestamp [ not null ]

	indexes {
		(role_id, action_id) [ name: 'uq_role_action', unique ]
	}
}

Table user_roles [headercolor: #175e7a] {
	id bigint [ pk, increment, not null ]
	user_id bigint [ not null ]
	role_id bigint [ not null ]
	is_active boolean [ not null, default: true ]
	created_at timestamp [ not null ]
	updated_at timestamp [ not null ]

	indexes {
		(user_id, role_id) [ name: 'uq_user_role', unique ]
	}
}

Table translations [headercolor: #175e7a] {
	id bigint [ pk, increment, not null ]
	source_entity varchar(255) [ not null ]
	source_id varchar(255) [ not null ]
	source_key varchar(255) [ not null ]
	locale varchar(10) [ not null ]
	value text [ not null ]
	is_active boolean [ not null, default: true ]
	created_at timestamp [ not null ]
	updated_at timestamp [ not null ]

	indexes {
		(source_entity, source_id, source_key, locale) [ name: 'uq_translation_entity_id_key_locale', unique ]
		(locale, source_entity, source_id) [ name: 'idx_translation_lookup' ]
	}
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

Ref fk_user_modules_user {
	user_modules.user_id > users.id [ delete: no action, update: no action ]
}

Ref fk_user_modules_module {
	user_modules.module_id > modules.id [ delete: no action, update: no action ]
}

Ref fk_modules_module_group {
	modules.module_group_id > module_groups.id [ delete: no action, update: no action ]
}
```

## 4. Decisiones y supuestos del modelo

### Hechos confirmados

- `Home` es solo frontend y está hardcodeado; no se persiste.
- Eliminación de la entidad `resources` en favor de `actions` dinámicas, simplificando la relación permisos-roles.
- Uso generalizado de `key` en lugar de campos de texto descriptivo (`name`, `label`) para soportar internacionalización (i18n).
- La gestión de i18n reside en el backend en la tabla `translations`, con un catálogo indexado por `(key, locale)` para proveer traducciones de forma ultra rápida tanto en bundles completos como en consultas individuales.
- La acción (`action`) se asocia opcionalmente a un módulo (`module_id`), permitiendo acciones transversales (nulas) o anidadas.
- No existe tabla de identidad externa: `users` es suficiente para el MVP; Google rellena `name` y `image_url` tras el primer acceso válido si siguen vacíos.
- El correo es `not null` y `unique`, y se persiste normalizado en minúsculas.
- La unicidad de los pivotes y pares de traducción es compuesta y se declara con `indexes`.

### Inferencias razonables

- `type` en módulos admite valores que distinguen módulo de submódulo (p. ej. `module` / `submodule`); el valor exacto se fijará con el dominio de Route Specs o el seed.
- El rol `super admin` es un registro sembrado de `roles` con `key = 'super_admin'` y `is_active = true`.
- Los textos legibles de roles, acciones y módulos son resueltos contra la tabla `translations` usando el token `key` de cada registro.

### Pendientes no bloqueantes

- `google_id` y soporte de múltiples proveedores quedan fuera del MVP; se considerarán en una iteración futura.
- La protección del último super admin operativo es una regla de aplicación (backend), no una restricción de base de datos.

## 5. Dudas y vacíos detectados

- **`actions.key` único global**: Al no haber contexto de resource, la `key` de la acción debe ser globalmente única y descriptiva (ej. `user.view`, `module.create`), para evitar colisiones.
- **`users.is_allowed` eliminado**: Al removerse este campo, se asume que un usuario validado por OAuth ingresa si `is_active = true` o si su correo existe previamente, esto se terminará de definir en las Specs.
- **Estrategia de PKs**: Se establece el uso universal de `bigint` autoincremental (`increment`) para todas las tablas del modelo (entidades principales `users`, `roles`, `actions`, `modules`, `translations` y tablas pivote `user_roles`, `role_actions`), optimizando el rendimiento de índices B-Tree y garantizando consistencia total en PostgreSQL.
- **Navegación administrativa separada de Home**: se resuelve en Sitemap y Route Specs, no en el modelo.

## 6. Insumos recomendados para PRD V2

- Actualizar el modelo conceptual y eliminar referencias a "Resources".
- Definir convención de nomenclatura de `keys` para las acciones (ej. `camelCase`, `dot.notation`) para facilitar i18n.
- Revalidar permisos requeridos por cada módulo con las acciones dinámicas.
## Ampliación de autenticación — 2026-09-12

Implementación solicitada por el usuario; revisión documental pendiente. `users.google_sub` es nullable y único para vincular el identificador estable de Google. No se agrega una tabla de identidades externas.

```dbml
Table auth_sessions {
  id bigint [pk, increment, not null]
  public_id uuid [unique, not null]
  user_id bigint [not null, ref: > users.id]
  image_url text
  refresh_token_hash varchar(64) [not null]
  expires_at timestamptz [not null]
  revoked_at timestamptz
  created_at timestamptz [not null]
}
```

El UUID es un identificador público adicional; la PK sigue siendo bigint. Una sesión se revoca mediante `revoked_at` y caduca por `expires_at`, sin borrar al usuario. Detalles: [ADR-004](../architecture/decisions/ADR-004-auth-sessions.md).
