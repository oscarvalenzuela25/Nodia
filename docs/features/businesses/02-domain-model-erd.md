# Modelo de Dominio y ERD — Módulo Businesses y Core Nodia

> Estado: aprobado por el usuario el 2026-09-17
> Fuente de verdad: DBML unificado Core (`#175e7a`) y Negocio (`#4f46e5`)
> Convención: PKs autoincrementales `bigint` (o `uuid` según entidad), borrado lógico con `is_active`, relaciones TypeORM explícitas con `Relation<T>`

---

## 1. Diagrama Entidad-Relación (DBML Completo)

```dbml
// ==========================================
// TABLAS CORE (#175e7a)
// ==========================================

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

Table auth_sessions [headercolor: #175e7a] {
	id bigint [ pk, increment, not null ]
	public_id uuid [ not null, unique ]
	user_id bigint [ not null ]
	image_url text
	refresh_token_hash varchar(64) [ not null ]
	expires_at timestamp [ not null ]
	revoked_at timestamp
	created_at timestamp [ not null ]

	indexes {
		(user_id) [ name: 'idx_auth_sessions_user_id' ]
		(expires_at) [ name: 'idx_auth_sessions_expires_at' ]
	}
}

Table roles [headercolor: #175e7a] {
	id bigint [ pk, increment, not null ]
	key text [ not null, unique ]
	is_active boolean [ not null, default: true ]
	created_at timestamp [ not null ]
	updated_at timestamp [ not null ]
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

Table actions [headercolor: #175e7a] {
	id bigint [ pk, increment, not null ]
	key text [ not null, unique ]
	description text
	is_active boolean [ not null, default: true ]
	created_at timestamp [ not null ]
	updated_at timestamp [ not null ]
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

Table module_groups [headercolor: #175e7a] {
	id bigint [ pk, increment, not null ]
	key varchar(255) [ not null, unique ]
	icon varchar(255)
	is_active boolean [ not null, default: true ]
	created_at timestamp [ not null ]
	updated_at timestamp [ not null ]
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

// ==========================================
// TABLAS NEGOCIO (#4f46e5)
// ==========================================

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
	action_id bigint [ not null ]
	is_active boolean [ not null, default: true ]
	created_at timestamp [ not null ]
	updated_at timestamp [ not null ]

	indexes {
		(business_id, user_id) [ name: 'uq_business_collaborator_user', unique ]
		(action_id) [ name: 'idx_business_collaborators_action_id' ]
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
	path_storage varchar(255) [ not null ]
	is_active boolean [ not null, default: true ]
	created_at timestamp [ not null ]
	updated_at timestamp [ not null ]

	indexes {
		(business_id) [ name: 'idx_invoices_business_id' ]
		(provider_id) [ name: 'idx_invoices_provider_id' ]
	}
}

Table invoice_fields [headercolor: #4f46e5] {
	id bigint [ pk, increment, not null ]
	business_id uuid [ not null ]
	provider_id bigint
	fields json [ not null ]
	is_active boolean [ not null, default: true ]
	created_at timestamp [ not null ]
	updated_at timestamp [ not null ]

	indexes {
		(business_id, provider_id) [ name: 'uq_business_provider_invoice_fields', unique ]
	}
}

Table invoice_items [headercolor: #4f46e5] {
	id bigint [ pk, increment, not null ]
	invoice_id bigint [ not null ]
	data json [ not null ]
	created_at timestamp [ not null ]
	updated_at timestamp [ not null ]

	indexes {
		(invoice_id) [ name: 'idx_invoice_items_invoice_id' ]
	}
}

// ==========================================
// RELACIONES CORE (#175e7a)
// ==========================================

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

Ref fk_auth_sessions_user {
	auth_sessions.user_id > users.id [ delete: cascade, update: no action ]
}

// ==========================================
// RELACIONES NEGOCIO (#4f46e5)
// ==========================================

Ref fk_users_id_businesses {
	users.id < businesses.owner_id [ delete: no action, update: no action ]
}

Ref fk_users_id_user_businesses {
	users.id < business_collaborators.user_id [ delete: no action, update: no action ]
}

Ref fk_businesses_id_user_businesses {
	businesses.id < business_collaborators.business_id [ delete: no action, update: no action ]
}

Ref fk_business_detail_actions_id_business_collaborators {
	business_actions.id < business_collaborators.action_id [ delete: no action, update: no action ]
}

Ref fk_businesses_id_products {
	businesses.id < products.business_id [ delete: no action, update: no action ]
}

Ref fk_products_id_product_logs {
	products.id < product_logs.product_id [ delete: no action, update: no action ]
}

Ref fk_businesses_id_providers {
	businesses.id < providers.business_id [ delete: no action, update: no action ]
}

Ref fk_providers_id_invoices {
	providers.id < invoices.provider_id [ delete: no action, update: no action ]
}

Ref fk_providers_id_invoice_fields {
	providers.id < invoice_fields.provider_id [ delete: no action, update: no action ]
}

Ref fk_providers_id_products {
	providers.id < products.provider_id [ delete: no action, update: no action ]
}

Ref fk_businesses_id_invoices {
	businesses.id < invoices.business_id [ delete: no action, update: no action ]
}

Ref fk_businesses_id_invoice_fields {
	businesses.id < invoice_fields.business_id [ delete: no action, update: no action ]
}

Ref fk_invoices_id_invoice_items {
	invoices.id < invoice_items.invoice_id [ delete: no action, update: no action ]
}
```

---

## 2. Decisiones de Dominio y Reglas de Negocio

1. **Multi-tenancy por Negocio (1 Usuario : N Negocios):**
   - Un usuario registrado en Nodia puede ser dueño (`owner_id`) de múltiples negocios independientes.
   - La clave foránea `businesses.owner_id` no posee restricción de unicidad, soportando la cardinalidad 1 a N (`users.id < businesses.owner_id`).
   - El índice `idx_businesses_owner_id` optimiza la consulta del listado de negocios propios del usuario autenticado.

2. **Colaboradores y Permisos de Negocio:**
   - La tabla `business_collaborators` actúa como pivote de asignación de usuarios a negocios con una acción o rol (`action_id`).
   - Posee un índice único compuesto `uq_business_collaborator_user` sobre `(business_id, user_id)` para asegurar que un usuario no pueda ser duplicado como colaborador dentro de un mismo negocio.

3. **Productos, Variación de Precios y Trazabilidad:**
   - `products`: Los códigos de producto (`code`) son únicos dentro del contexto de cada negocio mediante el índice único compuesto `uq_business_product_code` sobre `(business_id, code)`.
   - Precios y porcentajes se gestionan como valores enteros (`integer`) para evitar imprecisiones de punto flotante (`cost_price`, `cost_price_tax`, `profit_percentage`, `sale_price`).
   - `product_logs`: Cada actualización o mutación de precios genera una entrada inmutable identificada por UUID, vinculada al producto (`product_id`) mediante una relación 1 a N (`products.id < product_logs.product_id`).

4. **Facturas, Plantillas Dinámicas e Ítems Extraídos:**
   - `invoices`: Registra los comprobantes físicos/digitales (`path_storage`) asociados al negocio y opcionalmente a un proveedor (`provider_id`).
   - `invoice_fields`: Permite definir una plantilla JSON personalizada (`fields`) por cada proveedor y negocio mediante el índice único compuesto `uq_business_provider_invoice_fields` sobre `(business_id, provider_id)`.
   - `invoice_items`: Almacena la extracción estructurada en JSON (`data`) de las líneas de la factura, vinculada a través de `invoice_id`.

5. **Integración con el Core de Nodia:**
   - Autenticación estable mediante `users.google_sub` y sesiones renovables en `auth_sessions`.
   - Internacionalización de nombres, descripciones y textos mediante el catálogo centralizado `translations`.
   - Compatibilidad total con el patrón modular de NestJS, controladores delgados, casos de uso y TypeORM con `Relation<T>`.
