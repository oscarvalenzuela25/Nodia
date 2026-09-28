# Modelo de dominio ERD — Nodia

> Estado: en revisión — ampliación auth, recursos de negocio e IA (ADR-006)
> Última actualización: 2026-09-27
> Dependencias: 01-interview.md aprobado, 02-prd-v1.md aprobado, 15-ai-providers-interview.md, 16-ai-provider-management-handoff.md

## 1. Resumen del modelo

El modelo cubre la base de identidad, autorización, navegación, internacionalización, el ecosistema de negocios y la gestión global de proveedores de Inteligencia Artificial (IA) de Nodia:

### Core & Seguridad (Identidad, Permisos, Navegación e i18n)
- `auth_sessions`: sesiones renovables, hash del refresh token, expiración y revocación.
- `users`: personas preautorizadas para iniciar sesión con Google.
- `roles`: agrupaciones reutilizables de permisos funcionales, identificadas por un `key`.
- `module_groups`: catálogo de grupos únicos para agrupar módulos de navegación, identificados por un `key` e ícono opcional `icon`.
- `modules`: catálogo plano de módulos de la aplicación, vinculados a un grupo mediante `module_group_id`, con ruta `link` e ícono opcional `icon`.
- `actions`: catálogo de acciones dinámicas (permisos de endpoints/operaciones), con un `key` globalmente único e independientes de módulos.
- `role_actions`: permisos asignados por rol (pivote rol + acción).
- `user_roles`: asignación de roles a usuarios (pivote usuario + rol).
- `user_modules`: asignación de visibilidad de módulos a usuarios (pivote usuario + módulo).
- `translations`: catálogo centralizado de traducciones i18n para cualquier entidad y campo (`source_entity`, `source_id`, `source_key`, `locale`).

### Dominio de Negocios y Facturación
- `businesses`: entidades comerciales gestionadas por un `owner_id` (PK uuid).
- `business_collaborators`: usuarios asociados a un negocio con su cargo y conjunto de permisos (`action_ids bigint[]`).
- `business_actions`: catálogo de permisos operativos específicos del contexto de negocio (ej. gestionar colaboradores, ver analítica, escanear facturas).
- `providers`: proveedores de insumos/mercancía de un negocio. Incluye `tax integer` (impuesto aplicable, default 19) y `fields jsonb` con la plantilla de mapeo de columnas e instrucciones para la extracción contable IA (`{ [field]: { value: string, instructions?: string } }` para `code`, `cost_price`, `cost_price_tax`, `packages`, `units_per_package`).
- `products`: catálogo de productos de un negocio con códigos/SKU, costos, impuestos, márgenes y precio de venta.
- `product_logs`: registro histórico e inmutable de auditoría para cada variación de producto (generado automáticamente tras creación o actualización).
- `invoices`: comprobantes de facturación asociados a un negocio y proveedor, con su código/número de factura (`code`), monto total (`total_amount`), ubicación física en storage R2/S3 (`path_storage`) y el contenido/items extraídos embebidos directamente en el campo estructurado `data jsonb` (por defecto `{}`).

### Proveedores de Inteligencia Artificial (IA)
- `ai_provider_catalog`: catálogo maestro de proveedores de IA reconocidos (`gemini`, `openai`, `anthropic`, `mistral`, `deepseek`, `groq`, `perplexity`, etc.) con su clave canónica, nombre comercial y estado de activación.
- `ai_providers`: instancias o conexiones configuradas asociadas opcionalmente a un proveedor del catálogo (`catalog_id`), con nombre descriptivo (`name`), clave técnica (`key`), método de conexión activo (`mode`: `web_session`, `api_key`), campos no secretos tipados (`fields jsonb`: `available_models`, `selected_model`, `ocr_focus_model`, `enable_extended_thinking`) y rotación automática de claves (`auto_rotate_api_keys`). Permite múltiples instancias por proveedor (ej. cuenta principal headless + API Key secundaria de respaldo).
- `ai_api_keys`: claves API cifradas en reposo (`secret_ciphertext`), asociadas directamente a `provider_id`, con huella HMAC para deduplicación (`secret_fingerprint`), máscara no sensible (`display_hint`), orden de rotación (`sort_order`), clave activa (`is_selected`) y monitoreo de salud (`health_state`: `untested`, `valid`, `needs_review`, `cooldown`).
- `ai_provider_events`: registro inmutable de auditoría para eventos operativos, cambios de modo, rotación de claves, inicios de sesión web y fallos del sistema sin exponer credenciales ni facturas.

---

## 2. Modelo DBML Unificado

```dbml
Enum ai_connection_mode {
  web_session
  api_key
}

Enum ai_key_health_state {
  untested
  valid
  needs_review
  cooldown
}

// ------------------------------------------
// CORE & SEGURIDAD (Identidad, Permisos, i18n)
// ------------------------------------------

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

Table modules [headercolor: #175e7a] {
	id bigint [ pk, increment, not null ]
	key varchar(255) [ not null, unique ]
	module_group_id bigint [ not null ]
	link varchar(255) [ not null ]
	icon varchar(255)
	is_active boolean [ not null, default: true ]
	created_at timestamp [ not null ]
	updated_at timestamp [ not null ]

	indexes {
		(module_group_id) [ name: 'idx_modules_module_group_id' ]
	}
}

Table module_groups [headercolor: #175e7a] {
	id bigint [ pk, increment, not null ]
	key varchar(255) [ not null, unique ]
	icon varchar(255)
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

Table roles [headercolor: #175e7a] {
	id bigint [ pk, increment, not null ]
	key text [ not null, unique ]
	is_active boolean [ not null, default: true ]
	created_at timestamp [ not null ]
	updated_at timestamp [ not null ]
}

Table users [headercolor: #175e7a] {
	id bigint [ pk, increment, not null ]
	name varchar(255)
	email text [ not null, unique ]
	image_url text
	google_sub varchar(255) [ unique ]
	is_active boolean [ not null, default: true ]
	created_at timestamp [ not null ]
	updated_at timestamp [ not null ]
}

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

Table auth_sessions [headercolor: #175e7a] {
	id bigint [ pk, increment, not null ]
	public_id uuid [ not null, unique ]
	user_id bigint [ not null ]
	image_url text
	refresh_token_hash varchar(64) [ not null ]
	expires_at timestamptz [ not null ]
	revoked_at timestamptz
	created_at timestamptz [ not null ]

	indexes {
		(user_id) [ name: 'idx_auth_sessions_user_id' ]
		(expires_at) [ name: 'idx_auth_sessions_expires_at' ]
	}
}

// ------------------------------------------
// DOMINIO DE NEGOCIOS Y FACTURACIÓN
// ------------------------------------------

Table businesses [headercolor: #4f46e5] {
	id uuid [ pk, not null ]
	name varchar(255) [ not null ]
	owner_id bigint [ not null ]
	has_description boolean [ not null, default: false ]
	is_active boolean [ not null, default: true ]
	created_at timestamp [ not null ]
	updated_at timestamp [ not null ]

	indexes {
		(owner_id) [ name: 'idx_businesses_owner_id' ]
	}
}

Table business_collaborators [headercolor: #4f46e5] {
	id bigint [ pk, increment, not null ]
	position varchar(255)
	user_id bigint [ not null ]
	business_id uuid [ not null ]
	action_ids "bigint[]" [ not null, default: '{}' ]
	is_active boolean [ not null, default: true ]
	created_at timestamp [ not null ]
	updated_at timestamp [ not null ]

	indexes {
		(business_id, user_id) [ name: 'uq_business_collaborator_user', unique ]
	}
}

Table business_actions [headercolor: #4f46e5] {
	id bigint [ pk, increment, not null ]
	key varchar(255) [ not null, unique ]
	has_description boolean [ not null, default: false ]
	is_active boolean [ not null, default: true ]
	created_at timestamp [ not null ]
	updated_at timestamp [ not null ]
}

Table products [headercolor: #4f46e5] {
	id bigint [ pk, increment, not null ]
	business_id uuid [ not null ]
	provider_id bigint
	code varchar(255) [ not null ]
	name varchar(255) [ not null ]
	cost_price integer [ not null ]
	cost_price_tax integer [ not null ]
	profit_percentage integer [ not null ]
	sale_price integer [ not null ]
	stock integer [ not null, default: 0 ]
	is_active boolean [ not null, default: true ]
	created_at timestamp [ not null ]
	updated_at timestamp [ not null ]

	indexes {
		(business_id, code) [ name: 'uq_business_product_code', unique ]
		(business_id) [ name: 'idx_products_business_id' ]
		(provider_id) [ name: 'idx_products_provider_id' ]
	}
}

Table product_logs [headercolor: #4f46e5] {
	id uuid [ pk, not null ]
	product_id bigint [ not null ]
	code varchar(255) [ not null ]
	name varchar(255) [ not null ]
	cost_price integer [ not null ]
	cost_price_tax integer [ not null ]
	profit_percentage integer [ not null ]
	sale_price integer [ not null ]
	stock integer [ not null, default: 0 ]
	created_at timestamp [ not null ]
	updated_at timestamp [ not null ]

	indexes {
		(product_id) [ name: 'idx_product_logs_product_id' ]
	}
}

Table providers [headercolor: #4f46e5] {
	id bigint [ pk, increment, not null ]
	business_id uuid [ not null ]
	name varchar(255) [ not null ]
	tax integer [ not null, default: 19 ]
	fields jsonb [ not null, default: '{}' ]
	is_active boolean [ not null, default: true ]
	created_at timestamp [ not null ]
	updated_at timestamp [ not null ]

	indexes {
		(business_id) [ name: 'idx_providers_business_id' ]
	}
}

Table invoices [headercolor: #4f46e5] {
	id bigint [ pk, increment, not null ]
	business_id uuid [ not null ]
	provider_id bigint
	code varchar(255) [ not null ]
	total_amount integer [ not null, default: 0 ]
	path_storage varchar(255) [ not null, default: '' ]
	data jsonb [ not null, default: '{}' ]
	is_active boolean [ not null, default: true ]
	created_at timestamp [ not null ]
	updated_at timestamp [ not null ]

	indexes {
		(business_id) [ name: 'idx_invoices_business_id' ]
		(provider_id) [ name: 'idx_invoices_provider_id' ]
	}
}

// ------------------------------------------
// PROVEEDORES DE INTELIGENCIA ARTIFICIAL (IA)
// ------------------------------------------

Table ai_provider_catalog [headercolor: #49e3e3] {
	id bigint [ pk, increment, not null ]
	key varchar(64) [ not null, unique, note: 'Clave canónica del proveedor: gemini, openai, anthropic, mistral, etc.' ]
	name varchar(128) [ not null, note: 'Nombre comercial del proveedor' ]
	is_active boolean [ not null, default: true ]
	created_at timestamp [ not null ]
	updated_at timestamp [ not null ]
}

Table ai_providers [headercolor: #49e3e3] {
	id bigint [ pk, increment, not null ]
	catalog_id bigint [ note: 'Referencia al catálogo de proveedor de IA' ]
	name varchar(128) [ note: 'Nombre descriptivo de la instancia o conexión' ]
	key varchar(64) [ note: 'Clave técnica del adaptador (ej: gemini, mistral, openai)' ]
	mode ai_connection_mode [ note: 'Método de conexión activo: web_session o api_key' ]
	fields jsonb [ not null, default: '{}', note: 'Configuración no secreta: available_models, selected_model, ocr_focus_model, enable_extended_thinking' ]
	fields_version smallint [ not null, default: 1 ]
	auto_rotate_api_keys boolean [ not null, default: true, note: 'Auto-rotar API Keys en caso de cuota excedida (429)' ]
	is_active boolean [ not null, default: true, note: 'Habilitación administrativa general' ]
	created_at timestamp [ not null ]
	updated_at timestamp [ not null ]
}

Table ai_api_keys [headercolor: #49e3e3] {
	id bigint [ pk, increment ]
	provider_id bigint [ not null, note: 'Proveedor al que pertenece la clave' ]
	label varchar(100) [ not null ]
	secret_ciphertext text [ not null, note: 'Sobre cifrado con AES-256-GCM' ]
	secret_fingerprint varchar(64) [ not null, note: 'Huella HMAC-SHA256 para detectar duplicados sin guardar el secreto plano' ]
	display_hint varchar(16) [ not null, note: 'Máscara visual, ej: ...a1b2' ]
	sort_order int [ not null, default: 0 ]
	is_selected boolean [ not null, default: false, note: 'Clave actualmente activa/seleccionada' ]
	health_state ai_key_health_state [ not null, default: 'untested' ]
	last_error_code varchar(64)
	last_error_message text [ note: 'Mensaje redactado sin credenciales ni datos sensibles' ]
	last_error_at timestamptz
	last_success_at timestamptz
	cooldown_until timestamptz
	is_active boolean [ not null, default: true ]
	created_at timestamp [ not null ]
	updated_at timestamp [ not null ]

	indexes {
		(provider_id, secret_fingerprint) [ name: 'uq_ai_api_key_fingerprint', unique ]
		(provider_id, sort_order, id) [ name: 'idx_ai_api_key_rotation' ]
		(provider_id, is_selected) [ name: 'idx_ai_api_key_selection' ]
	}
}

Table ai_provider_events [headercolor: #49e3e3] {
	id bigint [ pk, increment ]
	provider_id bigint [ not null ]
	api_key_id bigint
	actor_user_id bigint [ note: 'Usuario responsable o null para eventos automáticos del sistema' ]
	event_type varchar(64) [ not null ]
	reason_code varchar(64)
	message text [ note: 'Resumen redactado del evento' ]
	metadata jsonb [ note: 'Metadatos no sensibles del evento' ]
	is_active boolean [ not null, default: true ]
	created_at timestamp [ not null ]
	updated_at timestamp [ not null ]

	indexes {
		(provider_id, created_at) [ name: 'idx_ai_provider_events_recent' ]
		(api_key_id, created_at) [ name: 'idx_ai_api_key_events_recent' ]
	}
}

// ------------------------------------------
// RELACIONES (Foreign Keys)
// ------------------------------------------

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

Ref fk_users_id_businesses {
	users.id < businesses.owner_id [ delete: no action, update: no action ]
}

Ref fk_users_id_user_businesses {
	users.id < business_collaborators.user_id [ delete: cascade, update: no action ]
}

Ref fk_businesses_id_user_businesses {
	businesses.id < business_collaborators.business_id [ delete: cascade, update: no action ]
}

Ref fk_businesses_id_products {
	businesses.id < products.business_id [ delete: no action, update: no action ]
}

Ref fk_products_id_product_logs {
	products.id < product_logs.product_id [ delete: cascade, update: no action ]
}

Ref fk_businesses_id_providers {
	businesses.id < providers.business_id [ delete: no action, update: no action ]
}

Ref fk_providers_id_invoices {
	providers.id < invoices.provider_id [ delete: set null, update: no action ]
}

Ref fk_providers_id_products {
	providers.id < products.provider_id [ delete: set null, update: no action ]
}

Ref fk_businesses_id_invoices {
	businesses.id < invoices.business_id [ delete: no action, update: no action ]
}

Ref fk_auth_sessions_user {
	auth_sessions.user_id > users.id [ delete: cascade, update: no action ]
}

Ref fk_ai_providers_catalog {
	ai_providers.catalog_id > ai_provider_catalog.id [ delete: cascade, update: no action ]
}

Ref fk_ai_keys_provider {
	ai_api_keys.provider_id > ai_providers.id [ delete: cascade, update: no action ]
}

Ref fk_ai_events_provider {
	ai_provider_events.provider_id > ai_providers.id [ delete: cascade, update: no action ]
}

Ref fk_ai_events_api_key {
	ai_provider_events.api_key_id > ai_api_keys.id [ delete: set null, update: no action ]
}

Ref fk_ai_events_actor_user {
	ai_provider_events.actor_user_id > users.id [ delete: set null, update: no action ]
}
```
