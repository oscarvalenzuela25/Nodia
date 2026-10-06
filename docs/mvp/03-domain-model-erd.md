# Modelo de dominio ERD — Nodia

> Estado: en revisión — ampliación auth, negocios, IA, Finanzas personales, Reservas y Contactos
> Última actualización: 2026-10-05
> Dependencias: 01-interview.md aprobado, 02-prd-v1.md aprobado, 15-ai-providers-interview.md, 16-ai-provider-management-handoff.md, 20-personal-finance-interview.md, 21-personal-finance-erd.md, 27-rental-reservations-erd.md (esquema aceptado)

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
- `personal_info_provider`: contactos de cada proveedor con teléfonos E.164, email, horario semanal propio, comentario y estado; control de versión y creación idempotente. Implementación local según [31](31-provider-contacts-proposal.md); migración objetivo y aprobación documental pendientes.
- `product_logs`: registro histórico e inmutable de auditoría para cada variación de producto (generado automáticamente tras creación o actualización).
- `invoices`: comprobantes de facturación asociados a un negocio y proveedor, con su código/número de factura (`code`), monto total (`total_amount`), ubicación física en storage R2/S3 (`path_storage`) y el contenido/items extraídos embebidos directamente en el campo estructurado `data jsonb` (por defecto `{}`).

### Finanzas personales
- `finance_movements`: movimientos personales; una categoría y una obligación opcional; pesos enteros y estados por tipo.
- `finance_categories`: categorías de cada usuario.
- `finance_category_groups`: agrupadores personales para filtros.
- `finance_category_group_memberships`: pivote grupo/categoría del mismo usuario.
- `finance_obligations`: préstamos/deudas con `amount` inicial, sin intereses; pendiente calculado desde pagos confirmados.

### Reservas de alojamiento (Tools)

Once tablas nuevas, compartidas por casa: `rental_properties`, `rental_collaborators`, `rental_cancellation_policies`, `rental_cancellation_rules`, `rental_reservations`, `rental_payments`, `rental_expenses`, `rental_blocks`, `rental_turnovers`, `rental_audit_events` y `rental_operations`. Propietario/colaboradores, noches, CLP, preparación, caja, condiciones conservadas, auditoría e idempotencia. El usuario aceptó el [ERD 27](27-rental-reservations-erd.md) el 2026-10-04; esa aceptación no aprueba el resto del modelo global.

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

Table personal_info_provider [headercolor: #4f46e5] {
  id bigint [ pk, increment, not null ]
  provider_id bigint [ not null ]
  name varchar(255) [ not null ]
  phone jsonb [ not null, default: '[]' ]
  email varchar(254)
  schedule jsonb [ not null, default: '{}' ]
  description text
  is_active boolean [ not null, default: true ]
  version integer [ not null, default: 1 ]
  creation_key uuid [ not null ]
  creation_hash char(64) [ not null ]
  created_at timestamptz [ not null, default: `now()` ]
  updated_at timestamptz [ not null, default: `now()` ]

  indexes {
    (provider_id, id) [ name: 'idx_provider_contact_provider' ]
    (provider_id, creation_key) [ unique, name: 'uq_provider_contact_creation' ]
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
// FINANZAS PERSONALES
// ------------------------------------------

Table finance_categories [headercolor: #0f766e] {
  id bigint [ pk, increment, not null ]
  user_id bigint [ not null ]
  name varchar(255) [ not null ]
  key varchar(255) [ not null ]
  is_active boolean [ not null, default: true ]
  created_at timestamptz [ not null ]
  updated_at timestamptz [ not null ]

  indexes {
    (user_id, id) [ name: 'uq_finance_categories_user_id', unique ]
    (user_id, key) [ name: 'uq_finance_categories_user_key', unique ]
  }
}

Table finance_category_groups [headercolor: #0f766e] {
  id bigint [ pk, increment, not null ]
  user_id bigint [ not null ]
  name varchar(255) [ not null ]
  key varchar(255) [ not null ]
  is_active boolean [ not null, default: true ]
  created_at timestamptz [ not null ]
  updated_at timestamptz [ not null ]

  indexes {
    (user_id, id) [ name: 'uq_finance_category_groups_user_id', unique ]
    (user_id, key) [ name: 'uq_finance_category_groups_user_key', unique ]
  }
}

Table finance_category_group_memberships [headercolor: #0f766e] {
  id bigint [ pk, increment, not null ]
  user_id bigint [ not null ]
  category_group_id bigint [ not null ]
  category_id bigint [ not null ]
  is_active boolean [ not null, default: true ]
  created_at timestamptz [ not null ]
  updated_at timestamptz [ not null ]

  indexes {
    (user_id, category_group_id, category_id) [ name: 'uq_finance_memberships_user_group_category', unique ]
    (user_id, category_id, category_group_id) [ name: 'idx_finance_memberships_user_category_group' ]
  }
}

Table finance_obligations [headercolor: #0f766e] {
  id bigint [ pk, increment, not null ]
  user_id bigint [ not null ]
  name varchar(255) [ not null ]
  key varchar(255) [ not null ]
  type varchar(255) [ not null, check: `type IN ('loan', 'debt')` ]
  amount bigint [ not null, check: `amount > 0` ]
  description text
  is_active boolean [ not null, default: true ]
  created_at timestamptz [ not null ]
  updated_at timestamptz [ not null ]

  indexes {
    (user_id, id) [ name: 'uq_finance_obligations_user_id', unique ]
    (user_id, key) [ name: 'uq_finance_obligations_user_key', unique ]
  }
}

Table finance_movements [headercolor: #0f766e] {
  id bigint [ pk, increment, not null ]
  user_id bigint [ not null ]
  category_id bigint [ not null ]
  obligation_id bigint
  name varchar(255) [ not null ]
  amount bigint [ not null, check: `amount > 0` ]
  type varchar(255) [ not null, check: `type IN ('income', 'expense')` ]
  status varchar(255) [ not null, check: `(type = 'income' AND status IN ('pending', 'received', 'cancelled')) OR (type = 'expense' AND status IN ('pending', 'paid', 'cancelled'))` ]
  is_active boolean [ not null, default: true ]
  created_at timestamptz [ not null ]
  updated_at timestamptz [ not null ]

  indexes {
    (user_id, created_at, id) [ name: 'idx_finance_movements_user_created' ]
    (user_id, category_id, created_at, id) [ name: 'idx_finance_movements_user_category_created' ]
    (user_id, obligation_id, type, status) [ name: 'idx_finance_movements_user_obligation_type_status' ]
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

Ref fk_providers_id_personal_info_provider {
  providers.id < personal_info_provider.provider_id [ delete: restrict, update: no action ]
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

// Finanzas: relaciones personales y FKs compuestas por propietario
Ref fk_finance_categories_user {
  finance_categories.user_id > users.id [ delete: no action, update: no action ]
}

Ref fk_finance_category_groups_user {
  finance_category_groups.user_id > users.id [ delete: no action, update: no action ]
}

Ref fk_finance_memberships_user {
  finance_category_group_memberships.user_id > users.id [ delete: no action, update: no action ]
}

Ref fk_finance_obligations_user {
  finance_obligations.user_id > users.id [ delete: no action, update: no action ]
}

Ref fk_finance_movements_user {
  finance_movements.user_id > users.id [ delete: no action, update: no action ]
}

Ref fk_finance_movements_category {
  finance_movements.(user_id, category_id) > finance_categories.(user_id, id) [ delete: no action, update: no action ]
}

Ref fk_finance_movements_obligation {
  finance_movements.(user_id, obligation_id) > finance_obligations.(user_id, id) [ delete: no action, update: no action ]
}

Ref fk_finance_memberships_group {
  finance_category_group_memberships.(user_id, category_group_id) > finance_category_groups.(user_id, id) [ delete: no action, update: no action ]
}

Ref fk_finance_memberships_category {
  finance_category_group_memberships.(user_id, category_id) > finance_categories.(user_id, id) [ delete: no action, update: no action ]
}

// Tools: Reservas — esquema aceptado el 2026-10-04; documento 27.
Table rental_properties {
  id bigint [pk, increment, not null]
  owner_id bigint [not null]
  name varchar(255) [not null]
  location varchar(500)
  timezone varchar(64) [not null]
  max_guests integer [not null]
  check_in_time time [not null]
  check_out_time time [not null]
  default_nightly_rate bigint
  default_deposit_percent numeric(5,2)
  minimum_turnover_minutes integer [not null, default: 0]
  default_cancellation_policy_id bigint
  notes text
  is_active boolean [not null, default: true]
  created_by bigint [not null]
  updated_by bigint [not null]
  created_at timestamptz [not null]
  updated_at timestamptz [not null]
  indexes {
    owner_id [name: 'idx_rental_properties_owner']
  }
}

Table rental_collaborators {
  id bigint [pk, increment, not null]
  property_id bigint [not null]
  user_id bigint [not null]
  position varchar(255)
  is_active boolean [not null, default: true]
  created_by bigint [not null]
  updated_by bigint [not null]
  created_at timestamptz [not null]
  updated_at timestamptz [not null]
  indexes {
    (property_id, user_id) [unique, name: 'uq_rental_collaborator']
    (user_id, is_active, property_id) [name: 'idx_rental_collaborator_access']
  }
}

Table rental_cancellation_policies {
  id bigint [pk, increment, not null]
  property_id bigint [not null]
  name varchar(255) [not null]
  is_active boolean [not null, default: true]
  created_by bigint [not null]
  updated_by bigint [not null]
  created_at timestamptz [not null]
  updated_at timestamptz [not null]
  indexes {
    (property_id, id) [unique, name: 'uq_rental_policy_property_id']
    (property_id, is_active, id) [name: 'idx_rental_policy_listing']
  }
}

Table rental_cancellation_rules {
  id bigint [pk, increment, not null]
  policy_id bigint [not null]
  min_days_before integer [not null]
  refund_percent numeric(5,2) [not null]
  created_by bigint [not null]
  updated_by bigint [not null]
  created_at timestamptz [not null]
  updated_at timestamptz [not null]
  indexes {
    (policy_id, min_days_before) [unique, name: 'uq_rental_policy_threshold']
  }
}

Table rental_reservations {
  id bigint [pk, increment, not null]
  property_id bigint [not null]
  guest_name varchar(255) [not null]
  guest_contact varchar(255) [not null]
  guests_count integer [not null]
  channel varchar(32) [not null, note: 'whatsapp | airbnb | facebook | other']
  external_reference varchar(255)
  check_in_on date [not null]
  check_out_on date [not null]
  check_in_time time [not null]
  check_out_time time [not null]
  nightly_rate bigint [not null]
  cleaning_fee bigint [not null, default: 0]
  discount_amount bigint [not null, default: 0]
  total_amount bigint [not null]
  commission_amount bigint [not null, default: 0]
  deposit_amount bigint [not null]
  deposit_due_at timestamptz
  balance_due_at timestamptz
  cancellation_policy_id bigint
  policy_snapshot jsonb
  status varchar(32) [not null, note: 'draft | confirmed | in_progress | completed | cancelled']
  cancelled_at timestamptz
  refund_amount bigint
  cancellation_snapshot jsonb
  notes text
  is_active boolean [not null, default: true]
  created_by bigint [not null]
  updated_by bigint [not null]
  created_at timestamptz [not null]
  updated_at timestamptz [not null]
  indexes {
    (property_id, id) [unique, name: 'uq_rental_reservation_property_id']
    (property_id, check_in_on, id) [name: 'idx_rental_reservation_calendar']
    (property_id, status, check_in_on, id) [name: 'idx_rental_reservation_status']
    (property_id, channel, external_reference) [unique, name: 'uq_rental_reservation_external_reference']
  }
}

Table rental_payments {
  id bigint [pk, increment, not null]
  property_id bigint [not null]
  reservation_id bigint [not null]
  type varchar(16) [not null, note: 'payment | refund']
  amount bigint [not null]
  occurred_on date [not null]
  method varchar(100)
  reference varchar(255)
  notes text
  status varchar(16) [not null, note: 'confirmed | voided']
  created_by bigint [not null]
  updated_by bigint [not null]
  created_at timestamptz [not null]
  updated_at timestamptz [not null]
  indexes {
    (property_id, reservation_id, type, status) [name: 'idx_rental_payment_balance']
    (property_id, occurred_on, id) [name: 'idx_rental_payment_cash']
  }
}

Table rental_expenses {
  id bigint [pk, increment, not null]
  property_id bigint [not null]
  reservation_id bigint
  name varchar(255) [not null]
  category varchar(100)
  amount bigint [not null]
  incurred_on date [not null]
  paid_on date
  status varchar(16) [not null, note: 'pending | paid | voided']
  notes text
  created_by bigint [not null]
  updated_by bigint [not null]
  created_at timestamptz [not null]
  updated_at timestamptz [not null]
  indexes {
    (property_id, incurred_on, id) [name: 'idx_rental_expense_listing']
    (property_id, status, paid_on, id) [name: 'idx_rental_expense_cash']
    (property_id, reservation_id) [name: 'idx_rental_expense_reservation']
  }
}

Table rental_blocks {
  id bigint [pk, increment, not null]
  property_id bigint [not null]
  starts_at timestamptz [not null]
  ends_at timestamptz [not null]
  reason varchar(255) [not null]
  notes text
  is_active boolean [not null, default: true]
  created_by bigint [not null]
  updated_by bigint [not null]
  created_at timestamptz [not null]
  updated_at timestamptz [not null]
  indexes {
    (property_id, is_active, starts_at, id) [name: 'idx_rental_block_calendar']
  }
}

Table rental_turnovers {
  id bigint [pk, increment, not null]
  property_id bigint [not null]
  incoming_reservation_id bigint [not null]
  previous_reservation_id bigint
  linen_ready boolean [note: 'null = por confirmar; true = recambio completo disponible']
  cleaning_status varchar(16) [not null, note: 'pending | in_progress | completed']
  planned_ready_at timestamptz
  ready_at timestamptz
  same_day_approved_at timestamptz
  notes text
  created_by bigint [not null]
  updated_by bigint [not null]
  created_at timestamptz [not null]
  updated_at timestamptz [not null]
  indexes {
    incoming_reservation_id [unique, name: 'uq_rental_turnover_incoming']
    (property_id, planned_ready_at, id) [name: 'idx_rental_turnover_listing']
    (property_id, previous_reservation_id) [name: 'idx_rental_turnover_previous']
  }
}

Table rental_audit_events {
  id bigint [pk, increment, not null]
  property_id bigint [not null]
  actor_id bigint [not null]
  action varchar(100) [not null]
  resource_type varchar(64) [not null]
  resource_id bigint [not null]
  changes jsonb [not null]
  created_at timestamptz [not null]
  indexes {
    (property_id, created_at, id) [name: 'idx_rental_audit_history']
    (property_id, resource_type, resource_id, id) [name: 'idx_rental_audit_resource']
  }
}

Table rental_operations {
  id bigint [pk, increment, not null]
  property_id bigint [not null]
  actor_id bigint [not null]
  request_key uuid [not null]
  operation varchar(100) [not null]
  request_hash char(64) [not null]
  response jsonb [not null]
  created_at timestamptz [not null]
  indexes {
    (property_id, actor_id, request_key) [unique, name: 'uq_rental_operation_request']
  }
}

Ref: rental_properties.owner_id > users.id [delete: restrict]
Ref: rental_properties.created_by > users.id [delete: restrict]
Ref: rental_properties.updated_by > users.id [delete: restrict]
Ref: rental_properties.(id, default_cancellation_policy_id) > rental_cancellation_policies.(property_id, id) [delete: restrict]

Ref: rental_collaborators.property_id > rental_properties.id [delete: restrict]
Ref: rental_collaborators.user_id > users.id [delete: restrict]
Ref: rental_collaborators.created_by > users.id [delete: restrict]
Ref: rental_collaborators.updated_by > users.id [delete: restrict]

Ref: rental_cancellation_policies.property_id > rental_properties.id [delete: restrict]
Ref: rental_cancellation_policies.created_by > users.id [delete: restrict]
Ref: rental_cancellation_policies.updated_by > users.id [delete: restrict]
Ref: rental_cancellation_rules.policy_id > rental_cancellation_policies.id [delete: restrict]
Ref: rental_cancellation_rules.created_by > users.id [delete: restrict]
Ref: rental_cancellation_rules.updated_by > users.id [delete: restrict]

Ref: rental_reservations.property_id > rental_properties.id [delete: restrict]
Ref: rental_reservations.(property_id, cancellation_policy_id) > rental_cancellation_policies.(property_id, id) [delete: restrict]
Ref: rental_reservations.created_by > users.id [delete: restrict]
Ref: rental_reservations.updated_by > users.id [delete: restrict]

Ref: rental_payments.property_id > rental_properties.id [delete: restrict]
Ref: rental_payments.(property_id, reservation_id) > rental_reservations.(property_id, id) [delete: restrict]
Ref: rental_payments.created_by > users.id [delete: restrict]
Ref: rental_payments.updated_by > users.id [delete: restrict]

Ref: rental_expenses.property_id > rental_properties.id [delete: restrict]
Ref: rental_expenses.(property_id, reservation_id) > rental_reservations.(property_id, id) [delete: restrict]
Ref: rental_expenses.created_by > users.id [delete: restrict]
Ref: rental_expenses.updated_by > users.id [delete: restrict]

Ref: rental_blocks.property_id > rental_properties.id [delete: restrict]
Ref: rental_blocks.created_by > users.id [delete: restrict]
Ref: rental_blocks.updated_by > users.id [delete: restrict]

Ref: rental_turnovers.property_id > rental_properties.id [delete: restrict]
Ref: rental_turnovers.(property_id, incoming_reservation_id) > rental_reservations.(property_id, id) [delete: restrict]
Ref: rental_turnovers.(property_id, previous_reservation_id) > rental_reservations.(property_id, id) [delete: restrict]
Ref: rental_turnovers.created_by > users.id [delete: restrict]
Ref: rental_turnovers.updated_by > users.id [delete: restrict]

Ref: rental_audit_events.property_id > rental_properties.id [delete: restrict]
Ref: rental_audit_events.actor_id > users.id [delete: restrict]
Ref: rental_operations.property_id > rental_properties.id [delete: restrict]
Ref: rental_operations.actor_id > users.id [delete: restrict]
```

## 3. Reglas de Finanzas personales — 2026-10-04

Se incorpora el modelo simplificado solicitado por el usuario, sin aprobar de nuevo todo el documento ni resolver las revisiones históricas de auth/IA.

- Todas las tablas financieras tienen usuario propio. FKs compuestas evitan asociaciones entre usuarios.
- Una categoría por movimiento; varios grupos por categoría, usados como filtros sin duplicar movimientos.
- Como máximo una obligación por movimiento, sin pivote de pagos. Loan empieza con expense y se liquida con income received; debt empieza con income y se liquida con expense paid.
- `finance_obligations.amount` conserva monto inicial; `finance_movements.amount` representa cada entrada/salida. El saldo pendiente se calcula, no se sobrescribe el monto inicial.
- Sin `purpose`, `cancellation_reason`, `currency` ni `occurred_on`. Amount bigint positivo; solo pesos enteros. Timestamps timestamptz de servidor.
- `is_active` controla archivado/visibilidad; `status` controla validez financiera. Archivar pagos confirmados no aumenta el saldo pendiente de la obligación.
- Listados y filtros comienzan con activos; consultar inactivos es una elección explícita. Los totales de una vista filtrada describen ese conjunto, mientras el saldo de una obligación conserva todo su historial confirmado.
- Recurrencias automáticas, intereses y cuentas/transferencias fuera del alcance actual.

Ver [ERD de Finanzas](21-personal-finance-erd.md), [contratos](22-personal-finance-contracts.md), [plan Server](23-personal-finance-backend-plan.md) y [plan Client](24-personal-finance-client-plan.md). Sintaxis DBML de referencias compuestas: [documentación oficial](https://dbml.dbdiagram.io/docs/#relationships--foreign-key-definitions). Backend implementado; migración incremental ensayada exclusivamente sobre PostgreSQL aislado, con equivalencia de metadata y constraints, rollback, concurrencia y respaldo/restauración. No aplicada a la BD del usuario; evidencia en plan 23. El esquema/documento completo sigue en revisión.

## 4. Reservas de alojamiento — esquema aceptado 2026-10-04

El DBML incorpora las once tablas, 143 campos nuevos, 38 FKs RESTRICT (incluidas relaciones compuestas por casa) y 22 índices de [27](27-rental-reservations-erd.md). El JSON de Obsidian contiene ahora 37 tablas y 69 relaciones; los 26 objetos y 31 relaciones previos se conservaron íntegros y se respaldó el archivo antes de escribir. Es un diagrama, no una migración aplicada.

Las reglas temporales, monetarias, snapshots y checks descritos en 27 acompañan el esquema. Disponibilidad se comprueba después de bloquear la casa dentro de una transacción común a reservas y bloqueos; los pagos y reembolsos requieren también lock de reserva. is_active archiva reservas sin liberar ocupación ni modificar caja. Pagos/devoluciones y gastos pagados usan fechas efectivas. Los días de anticipación son días calendario locales; devolución directa sobre el dinero pagado, con tramos configurables. No se impone una política comercial por defecto.

Contratos y desarrollo se especifican en [28](28-rental-reservations-contracts.md) y [plan Backend 29](29-rental-reservations-backend-plan.md), en revisión. El plan Client se preparará después. La aprobación de 27 no cambia el estado de los otros documentos o ADRs.

Backend de Reservas implementado: once entidades TypeORM y migración incremental, con metadata sin drift en PostgreSQL aislado. Se conservan las 143 columnas/38 FKs/22 índices del diagrama; checks monetarios/estados/fechas/preparación acompañan la migración. [Entrega29](29-rental-reservations-backend-plan.md) separa ensayo aislado de aplicación objetivo pendiente.
