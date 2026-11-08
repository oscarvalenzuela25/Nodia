# Autorización específica: preparaciones C01 adicionales en AI36-C05

Instrucción humana exacta del2026-10-24:

> Me parece bien, sigamos con lo pendiente de AI-36/C05 para habilitar la creación, edición y eliminación de datos de los módulos desde NodiaAI. Usa subagentes donde se pueda.

No se atribuye una revisión humana línea por línea.

Se publica únicamente el lote exacto de72 preparadores C01 enumerado abajo y las ocho secciones mínimas enlazadas en la validación. No se aprueban especificaciones, ADR ni apartados históricos completos. Se conserva el primer lote74 y sus bindings; no se publica ningún flujo C02 de credenciales/login ni el analizador C03. El agente realiza la revisión técnica bajo esta instrucción específica, conforme al precedente C05.

- `nodia_actions_prepare_create`
- `nodia_actions_prepare_delete`
- `nodia_actions_prepare_update`
- `nodia_ai_providers_prepare_catalog_create`
- `nodia_ai_providers_prepare_catalog_update`
- `nodia_ai_providers_prepare_codex_logout`
- `nodia_ai_providers_prepare_create`
- `nodia_ai_providers_prepare_gemini_web_logout`
- `nodia_ai_providers_prepare_sync_models`
- `nodia_ai_providers_prepare_update`
- `nodia_api_keys_prepare_delete`
- `nodia_business_actions_prepare_create`
- `nodia_business_actions_prepare_delete`
- `nodia_business_actions_prepare_update`
- `nodia_businesses_prepare_create`
- `nodia_businesses_prepare_set_collaborators`
- `nodia_businesses_prepare_update`
- `nodia_finance_categories_prepare_create`
- `nodia_finance_categories_prepare_delete`
- `nodia_finance_categories_prepare_update`
- `nodia_finance_category_groups_prepare_create`
- `nodia_finance_category_groups_prepare_delete`
- `nodia_finance_category_groups_prepare_update`
- `nodia_finance_movements_prepare_delete`
- `nodia_finance_movements_prepare_update`
- `nodia_finance_obligations_prepare_create`
- `nodia_finance_obligations_prepare_delete`
- `nodia_finance_obligations_prepare_update`
- `nodia_invoices_prepare_create`
- `nodia_invoices_prepare_update`
- `nodia_module_groups_prepare_create`
- `nodia_module_groups_prepare_delete`
- `nodia_module_groups_prepare_update`
- `nodia_modules_prepare_create`
- `nodia_modules_prepare_delete`
- `nodia_modules_prepare_update`
- `nodia_product_logs_prepare_create`
- `nodia_product_logs_prepare_update`
- `nodia_products_prepare_create`
- `nodia_products_prepare_update`
- `nodia_provider_contacts_prepare_create`
- `nodia_provider_contacts_prepare_set_active`
- `nodia_provider_contacts_prepare_update`
- `nodia_providers_prepare_create`
- `nodia_providers_prepare_update`
- `nodia_rental_blocks_prepare_create`
- `nodia_rental_blocks_prepare_update`
- `nodia_rental_cancellation_policies_prepare_create`
- `nodia_rental_cancellation_policies_prepare_update`
- `nodia_rental_collaborators_prepare_create`
- `nodia_rental_collaborators_prepare_update`
- `nodia_rental_expenses_prepare_create`
- `nodia_rental_expenses_prepare_pay`
- `nodia_rental_expenses_prepare_update`
- `nodia_rental_expenses_prepare_void`
- `nodia_rental_payments_prepare_create`
- `nodia_rental_payments_prepare_void`
- `nodia_rental_properties_prepare_create`
- `nodia_rental_properties_prepare_update`
- `nodia_rental_reservations_prepare_cancel`
- `nodia_rental_reservations_prepare_complete`
- `nodia_rental_reservations_prepare_confirm`
- `nodia_rental_reservations_prepare_create`
- `nodia_rental_reservations_prepare_start`
- `nodia_rental_reservations_prepare_update`
- `nodia_rental_turnovers_prepare_approve_same_day`
- `nodia_rental_turnovers_prepare_update`
- `nodia_roles_prepare_create`
- `nodia_roles_prepare_delete`
- `nodia_roles_prepare_update`
- `nodia_users_prepare_create`
- `nodia_users_prepare_update`

Preparar guarda borradores/propuestas, nunca autoriza ni ejecuta el efecto comercial. El botón humano confirma la revisión y hash exactos; módulos, acciones, referencias, reglas nativas y scope se revalidan. Borrado sólo existe donde el backend lo implementa: no traducir cancelar/anular/desactivar en DELETE ni habilitar bulk/importación. No se ingresa SQL, secretos ni códigos de login al modelo. Las operaciones administrativas IA aquí enumeradas reciben sólo identidades o configuración no secreta y siguen el canal de ejecución nativo existente.

Selección por etapas: máximo67 capacidades seleccionadas más siete técnicos,74 herramientas/131072 bytes por generación, JSON128 por colección y contexto262144 bytes. La publicación global146 no implica enviarlas juntas ni que cualquier selección67 quepa por bytes. Despliegue, inferencia, efectos y aceptación por capacidad/entorno permanecen pendientes de recibos reales; esta publicación no los acredita.
