# NodiaAI — catálogo de herramientas v1

> Decisión vigente R17 (2026-10-30): NodiaAI sólo consulta y muestra ventas/reportes; se retiran las cinco preparaciones comerciales de ventas, incluso para propuestas antiguas. El POS y la gestión manual se conservan. Véase [Plan94 §26](94-business-point-of-sale-and-product-refactor.md#26-nodiaai-ventas-y-reportes-de-solo-lectura--r17-2026-10-30). Las referencias inferiores al CRUD de ventas mediante IA son históricas y no lo rehabilitan.

> Estado: catálogo en revisión; tres ayudantes comunes y 67 lecturas/artefactos candidatos implementados, ninguna herramienta de negocio publicada
> Fecha: 2026-10-14
> Dependencias: [plan38](38-nodia-ai-research-and-v1-plan.md), [inventario39](39-nodia-ai-current-capabilities-inventory.md), [contrato IA](ai-provider-feature-contract.md), [ADR-032](../architecture/decisions/ADR-032-nodia-ai-domain-tools-and-conversation.md)

## Resultado y alcance

Actualización [AI-15/61](61-nodia-ai-ai15-product-reads.md): las 64 lecturas simples y las tres lecturas de artefactos tienen puertos tipados, schemas cerrados y proyecciones implementadas. Las 59 lecturas locales conservan su transacción nativa; las cinco externas preparan un snapshot en SQL, hacen I/O fuera del checkpoint y reautorizan al devolver. Las tres de artefactos emiten referencias privadas; el endpoint humano de descarga revalida acceso y genera el archivo con datos actuales, sin CSV ni URL pública en el prompt. Los tres ayudantes comunes de [AI-14/60](60-nodia-ai-ai14-capability-registry.md) conservan su estado. Los 156 candidatos mantienen `published:false`: implementación, aprobación documental, publicación y aceptación real del modo siguen siendo gates distintos. `implementationContract` enlaza archivo/definiciones/hashes exactos; las siete bibliotecas compilan **184 definiciones y 134 contratos cerrados**. El [transporte privado](../evidence/nodia-ai-ai15-mcp-transport-validation.json) verifica el catálogo íntegro de **72 descriptores —64 lecturas, tres artefactos y cinco técnicos—**, con **92.931 bytes** wire y **100.371 bytes** tools/list. Su techo propio pasa de64 a72 por los ocho candidatos efectivamente añadidos y probados, conserva128KiB y rechaza73 o un byte de exceso; no hay truncado ni selección opaca. Estos ensayos aislados no acreditan inferencia Gemini ni cuotas del proveedor. Familias y conocimiento operativos siguen vacíos, sin aprobación automática.

[AI-05/51](51-nodia-ai-ai05-product-knowledge.md) añade fichas de los4 productos/27 funcionalidades y[matriz documental](nodia-ai-ai05-knowledge-coverage.json):175 handlers vinculados,2 técnicos excluidos,141 candidatos de dominio/4 flujos seguros trazados y bulk7 preservado. No es registry ejecutable ni modifica estos nombres/contratos; las11 herramientas comunes futuras siguen bajo NodiaAI. Publicación de metadatos/fragmentos elegibles pendiente AI-06/12.

El catálogo propone **156 nombres**: **141 herramientas de dominio**, **11 herramientas comunes nuevas** y **4 entradas a flujos seguros**. Los 177 handlers del inventario tienen tratamiento explícito; los aliases HTTP no generan herramientas nuevas. PUT/PATCH de acciones, roles y módulos se agrupan en tres operaciones de actualización porque delegan al mismo caso de uso. No se agrupan otras operaciones por similitud de nombre.

Las 141 herramientas de dominio se distribuyen en 73 preparaciones de cambios, 64 lecturas, 3 lecturas de artefactos y 1 análisis de archivo. Estos números describen una propuesta derivada de fuentes, no disponibilidad real. El [manifiesto JSON](nodia-ai-v1-tool-catalog.json) contiene cada enlace con métodos/rutas, DTOs, archivos/líneas y destinos del backend; [los contratos41](41-nodia-ai-v1-contracts.md) definen su coordinación y condiciones de publicación.

Las siete escrituras masivas/importación quedan fuera de v1 por decisión expresa. Exportar CSV sigue siendo una lectura candidata acotada. Un flujo con varias operaciones individuales dependientes pertenece a v1: el usuario confirmó ejecución secuencial, resultados por paso y conservación de lo ya creado si falla otro paso, con recuperación sin duplicados.

## Catálogo histórico y extensiones explícitas

El [JSON de 156 candidatos](nodia-ai-v1-tool-catalog.json), sus conteos y sus evidencias conservan el corte histórico. Las operaciones semánticas posteriores se declaran en [extensiones del catálogo](nodia-ai-v1-tool-catalog.extensions.json). La auditoría actual fusiona una copia sólo en memoria: rechaza nombres duplicados, handlers desconocidos o excluidos y cobertura no recíproca; no reescribe el baseline ni sus cifras. Los totales actuales de la auditoría se calculan desde la unión, separados de los conteos históricos conservados.

`nodia_invoices_ocr` deriva semánticamente del OCR de Productos identificado por `InvoiceController.analyze`; no añade un handler HTTP ni invoca su endpoint legacy. `backendBindings:[]` hace explícita esa separación. Su [contrato cerrado](../../nodia-server/src/nodia-ai-invoice-ocr/contracts/invoice-ocr.json) contiene `prepare/request/read`; la etapa OCR durable reutiliza el núcleo después del terminal/ACK de planificación, sin HTTP arbitrario, defaults del caso de uso legacy o escrituras comerciales implícitas. La cobertura del handler sólo añade esta procedencia semántica y conserva la asociación histórica de C03.

El flag `published:false` de la extensión no concede ni retira autoridad de ejecución: la publicación efectiva procede exclusivamente del registro explícito y del conocimiento aprobado compilado. La extensión es un insumo de auditoría, sin permisos adicionales; no sustituye elegibilidad actual, autoridad por chat/negocio/archivo o confirmación humana para los efectos de Productos. La [ficha aprobada del recorrido](../nodia-ai/knowledge/nodia-ai/features/invoice-ocr-product-comparison.md) y su evidencia mantienen separados aprobación, implementación local, publicación y aceptación real.

## Cómo conoce NodiaAI los productos

Cada módulo registra una descripción funcional, recursos, operaciones, esquemas públicos, reglas de ámbito y medidas admitidas. NodiaAI descubre las capacidades relevantes y pide el detalle necesario; no necesita cargar 156 definiciones en cada turno. La publicación real incluye sólo herramientas verificadas y autorizadas para la sesión, el modo y el modelo seleccionados.

Un Markdown explica el negocio y acompaña al catálogo; no crea permisos ni operaciones. OpenAPI y DTOs aportan contratos; los casos de uso validan reglas; la BD aporta datos. Agregar tablas o endpoints no expone automáticamente una nueva capacidad. La entrega de cada módulo nuevo debe incluir registro, descripción, esquemas, correspondencia HTTP y pruebas de permisos/paridad, y publicar una nueva versión compatible.

Los nombres propuestos usan minúsculas ASCII y guiones bajos, sin modelos/versiones comerciales. Su compatibilidad se verifica por adaptador y transporte, con traducción explícita de nombres si fuera necesaria. MCP define esquemas, descubrimiento y anotaciones; las anotaciones son metadatos orientativos y no autorización. [Especificación oficial de herramientas MCP](https://modelcontextprotocol.io/specification/2025-11-25/server/tools). La API Gemini documenta function calling; esto no demuestra soporte del mismo protocolo en Gemini Web o Agentic. [Documentación oficial Gemini](https://ai.google.dev/gemini-api/docs/function-calling).

## Incorporar un producto o ampliar un módulo

El alcance confirmado incluye todos los productos/módulos actuales, incluidos Ajustes Generales. Para futuras entregas se propone que la integración NodiaAI forme parte del desarrollo de cada producto o ampliación; el núcleo del chat consume el registro, sin necesitar cambios específicos por cada módulo. El catálogo actual no es un límite permanente al número de funcionalidades.

| Paso de la entrega | Producto nuevo | Ampliación de producto existente |
|---|---|---|
| Contrato del backend | Crear recurso/casos de uso y reglas | Ampliar casos de uso/DTOs y preservar o versionar compatibilidad |
| Contexto funcional | Describir propósito, conceptos, relaciones, reglas y ejemplos | Actualizar la explicación del módulo y el significado de los campos/reglas nuevos |
| Capacidades | Registrar recursos/herramientas con módulo padre y esquemas públicos | Actualizar herramienta existente si conserva la operación; crear otra sólo para una operación semántica nueva |
| Consultas e informes | Declarar campos, medidas, unidades, grano y relaciones admitidos | Incorporar nuevos campos/medidas/relaciones de forma explícita, sin exponer todo el ORM/JSON |
| Garantías | Autoridad, preview/confirmación, idempotencia/recovery y proyecciones | Revisar las mismas garantías y consumidores/propuestas afectados por cambios |
| Publicación | Pruebas de paridad/permiso y viabilidad; publicar versión del catálogo | Regresiones, compatibilidad por adaptador y nueva versión; retirar definiciones obsoletas |

Por solicitud del usuario, la descripción funcional se mantiene en Markdown versionado bajo `docs/nodia-ai/knowledge/`, con fichas de producto y funcionalidad según el [estándar y sus plantillas](../nodia-ai/knowledge/README.md). Crear/actualizar estas fichas forma parte de la especificación y del mantenimiento de cada función; sus metadatos estructurados de runtime serán una proyección validada, no otra fuente independiente de reglas. No se sube manualmente a cada chat. Server entregará la explicación pertinente junto con las capacidades autorizadas; su autoría/mantenimiento pertenece al desarrollo del módulo. El publicador y la carga selectiva siguen pendientes de implementación. No copiar automáticamente documentos internos completos o instrucciones de archivos/usuarios como reglas de sistema.

Después del despliegue, al admitir el siguiente turno, Server resuelve la versión vigente del catálogo y las capacidades que puede usar ese actor con su modo/modelo. Conserva el historial del chat, actualiza su conocimiento operativo y carga detalles relevantes a la petición. Un chat existente puede descubrir el producto nuevo sin recrearse, siempre que conserve vigencia y el usuario tenga acceso. Los datos concretos se consultan mediante herramientas cuando se necesitan, no desde una copia permanente de la BD dentro del prompt.

El turno admitido mantiene su versión/configuración fija. Una publicación no modifica a mitad de ejecución un comando confirmado. Cambios incompatibles o retiro de capacidades invalidan propuestas pendientes afectadas y requieren nueva revisión; cambios aditivos pueden descubrirse en el próximo turno sin reescribir mensajes, resúmenes históricos o recibos. Los recibos de efectos previos nunca se reproducen para “actualizarlos”.

Ejemplo hipotético: si Reservas incorpora tarifas por temporada, su entrega describe las reglas, registra consulta/cálculo y preparación de cambios de tarifa cuando existan sus casos de uso, amplía medidas pertinentes y verifica permisos/preview/recovery. Tras publicar, un chat existente puede preguntar por la tarifa aplicable a unas fechas y utilizar esas capacidades. Este ejemplo no afirma que la función exista hoy ni modifica su alcance por sí solo.

La integración no queda lista sólo por crear un endpoint o editar un Markdown: se publica al verificar contrato, autoridad y ejecución. Estas condiciones se concretan en el checklist del estándar y las tareas AI-05/06/12/34/36 del [plan45](45-nodia-ai-implementation-plan.md), sin implementación todavía.

## Semántica de las herramientas

| Clase | Puede hacer | Resultado propuesto |
|---|---|---|
| `read` | Consultar recursos/proyecciones permitidos | Proyección pública versionada; paginación y ámbito comprobados |
| `read_artifact` | Preparar descarga/vista de archivo o exportación | Referencia privada controlada por la app; no URL arbitraria |
| `analyze_attachment` | Interpretar un adjunto autorizado usando conexión viable | Extracción revisable y ejecución identificada; no crear factura por analizar |
| `prepare_change` | Resolver datos y preparar create/update/delete/comando | `PreparationResult`; nunca aplica el cambio de dominio |
| Herramientas comunes | Descubrir, resolver entidades, informar, recuperar o preparar flujo/memoria | Contratos comunes estrictos y validación semántica en Server |
| Flujos seguros | Proponer que la app abra un formulario/login controlado | Propuesta sin clave, contraseña, código OAuth ni cookies |

Preparar puede guardar borradores y propuestas en NodiaAI. Por ello sus anotaciones no prometen ausencia de toda escritura, aunque todavía no modifiquen el registro de negocio. El impacto del comando futuro se declara separado: crear, editar, eliminar, asignar, pagar, cancelar o cerrar sesión. Un nombre como `prepare_delete` no da permiso para borrar ni sustituye una cancelación de Reservas.

**No existe herramienta de confirmar, ejecutar SQL, invocar HTTP arbitrario o completar el token de aprobación.** La confirmación pertenece al botón de la app y al endpoint autenticado descrito en41. Un mensaje “sí”, la respuesta del modelo o una instrucción en un PDF no ejecutan cambios. Tras confirmar, el coordinador ejecuta los comandos persistidos mediante casos de uso compartidos.

## Contrato mínimo por herramienta

El manifiesto es trazabilidad de diseño, no un `tools/list` listo para servir. Las referencias de TypeScript/DTO **no son esquemas JSON ejecutables**. Las 141 entradas requieren derivar y validar sus entradas y salidas estrictas antes de publicarlas.

| Elemento | Regla |
|---|---|
| Identidad | Nombre estable, versión/hash de contrato y operación semántica; aliases conservados como procedencia |
| Módulo | Resolver ID/key estable del módulo padre; las rutas de las tablas son referencias documentales de navegación |
| Entrada | Esquema estricto por operación, tipos/DTOs/reglas condicionales; borrador parcial separado del comando final completo |
| Datos administrados | Actor/sesión/confirmación/idempotencia/versiones de concurrencia los obtiene Server; el modelo no los inventa |
| Salida | Proyección pública tipada y validada; listas/totales/estado real sin entidades completas ni secretos |
| Autoridad | NodiaAI y módulo de destino para ordinarios, autoridad del recurso y `RequireAction` donde exista; super_admin transversal pendiente en Finanzas/Reservas |
| Cambio | Propuesta inmutable, botón, recuperación y garantía de efecto antes de habilitar la operación |
| Disponibilidad | Configuración, catálogo y ejecución viable son estados distintos; sin fallback entre conexiones/modos/modelos |
| Evolución | Cambiar reglas invalida propuestas incompatibles; conservar historial y evidencias anteriores |

No introducir un permiso granular nuevo por herramienta donde el producto lo descartó. Mantener `ai:manage` para administrar IA. Usar una conexión para conversar es una capacidad distinta de administrar sus claves o configuración; su listado apto para chat requiere contrato específico (41), sin reutilizar silenciosamente un endpoint administrativo.

## Herramientas de dominio

Cada fila identifica el handler de origen. Métodos, aliases, DTOs y destino de ejecución completos están en el manifiesto y en39. El módulo padre se hereda por grupo. “Preparar” significa propuesta; no escritura inmediata.


### /settings/actions — 10 herramientas

| Herramienta | Clase | Handler(s) de origen |
|---|---|---|
| `nodia_actions_get` | Leer | `ActionController.findOne` |
| `nodia_actions_list` | Leer | `ActionController.findAll` |
| `nodia_actions_prepare_create` | Preparar | `ActionController.create` |
| `nodia_actions_prepare_delete` | Preparar | `ActionController.remove` |
| `nodia_actions_prepare_update` | Preparar | `ActionController.update`, `ActionController.updatePatch` |
| `nodia_business_actions_get` | Leer | `BusinessActionController.findOne` |
| `nodia_business_actions_list` | Leer | `BusinessActionController.findAll` |
| `nodia_business_actions_prepare_create` | Preparar | `BusinessActionController.create` |
| `nodia_business_actions_prepare_delete` | Preparar | `BusinessActionController.remove` |
| `nodia_business_actions_prepare_update` | Preparar | `BusinessActionController.update` |

### /settings/ai-providers — 17 herramientas

| Herramienta | Clase | Handler(s) de origen |
|---|---|---|
| `nodia_ai_events_list` | Leer | `AiProviderEventController.findAll` |
| `nodia_ai_providers_catalog_list` | Leer | `AiProviderController.getCatalog` |
| `nodia_ai_providers_codex_session` | Leer | `AiProviderController.getCodexSession` |
| `nodia_ai_providers_gemini_engines` | Leer | `AiProviderController.getGeminiEngines` |
| `nodia_ai_providers_health` | Leer | `AiProviderController.getHealth` |
| `nodia_ai_providers_list` | Leer | `AiProviderController.findAll` |
| `nodia_ai_providers_models` | Leer | `AiProviderController.getSelectableModels` |
| `nodia_ai_providers_prepare_catalog_create` | Preparar | `AiProviderController.createCatalog` |
| `nodia_ai_providers_prepare_catalog_update` | Preparar | `AiProviderController.updateCatalog` |
| `nodia_ai_providers_prepare_codex_logout` | Preparar | `AiProviderController.logoutCodex` |
| `nodia_ai_providers_prepare_create` | Preparar | `AiProviderController.create` |
| `nodia_ai_providers_prepare_gemini_web_logout` | Preparar | `AiProviderController.disconnectGeminiWeb` |
| `nodia_ai_providers_prepare_sync_models` | Preparar | `AiProviderController.syncModels` |
| `nodia_ai_providers_prepare_update` | Preparar | `AiProviderController.update` |
| `nodia_ai_providers_supported_providers` | Leer | `AiProviderController.getSupportedProviders` |
| `nodia_api_keys_list` | Leer | `AiApiKeyController.findAll` |
| `nodia_api_keys_prepare_delete` | Preparar | `AiApiKeyController.remove` |

### /tools/business — 31 herramientas

| Herramienta | Clase | Handler(s) de origen |
|---|---|---|
| `nodia_businesses_get` | Leer | `BusinessController.findOne` |
| `nodia_businesses_list` | Leer | `BusinessController.findMyBusinesses` |
| `nodia_businesses_prepare_create` | Preparar | `BusinessController.create` |
| `nodia_businesses_prepare_set_collaborators` | Preparar | `BusinessController.assignCollaborators` |
| `nodia_businesses_prepare_update` | Preparar | `BusinessController.update` |
| `nodia_invoices_analyze` | Analizar | `InvoiceController.analyze` |
| `nodia_invoices_eligible_invoice_connections` | Leer | `InvoiceController.verifyIaProviders` |
| `nodia_invoices_file` | Artefacto | `InvoiceController.getViewUrl` |
| `nodia_invoices_get` | Leer | `InvoiceController.findOne` |
| `nodia_invoices_list` | Leer | `InvoiceController.findAll` |
| `nodia_invoices_prepare_create` | Preparar | `InvoiceController.create` |
| `nodia_invoices_prepare_update` | Preparar | `InvoiceController.update` |
| `nodia_product_logs_get` | Leer | `ProductLogController.findOne` |
| `nodia_product_logs_list` | Leer | `ProductLogController.findAll` |
| `nodia_product_logs_prepare_create` | Preparar | `ProductLogController.create` |
| `nodia_product_logs_prepare_update` | Preparar | `ProductLogController.update` |
| `nodia_product_logs_query` | Leer | `ProductLogController.query` |
| `nodia_products_export_csv` | Artefacto | `ProductController.exportCsv` |
| `nodia_products_get` | Leer | `ProductController.findOne` |
| `nodia_products_list` | Leer | `ProductController.findAll` |
| `nodia_products_prepare_create` | Preparar | `ProductController.create` |
| `nodia_products_prepare_update` | Preparar | `ProductController.update` |
| `nodia_provider_contacts_list` | Leer | `ProviderContactController.list` |
| `nodia_provider_contacts_prepare_create` | Preparar | `ProviderContactController.create` |
| `nodia_provider_contacts_prepare_set_active` | Preparar | `ProviderContactController.toggle` |
| `nodia_provider_contacts_prepare_update` | Preparar | `ProviderContactController.update` |
| `nodia_providers_export_csv` | Artefacto | `ProviderController.exportCsv` |
| `nodia_providers_get` | Leer | `ProviderController.findOne` |
| `nodia_providers_list` | Leer | `ProviderController.findAll` |
| `nodia_providers_prepare_create` | Preparar | `ProviderController.create` |
| `nodia_providers_prepare_update` | Preparar | `ProviderController.update` |

### /tools/finances-personal — 23 herramientas

| Herramienta | Clase | Handler(s) de origen |
|---|---|---|
| `nodia_finance_categories_get` | Leer | `FinanceCategoryController.findOne` |
| `nodia_finance_categories_list` | Leer | `FinanceCategoryController.findAll` |
| `nodia_finance_categories_prepare_create` | Preparar | `FinanceCategoryController.create` |
| `nodia_finance_categories_prepare_delete` | Preparar | `FinanceCategoryController.remove` |
| `nodia_finance_categories_prepare_update` | Preparar | `FinanceCategoryController.update` |
| `nodia_finance_category_groups_get` | Leer | `FinanceCategoryGroupController.findOne` |
| `nodia_finance_category_groups_list` | Leer | `FinanceCategoryGroupController.findAll` |
| `nodia_finance_category_groups_prepare_create` | Preparar | `FinanceCategoryGroupController.create` |
| `nodia_finance_category_groups_prepare_delete` | Preparar | `FinanceCategoryGroupController.remove` |
| `nodia_finance_category_groups_prepare_update` | Preparar | `FinanceCategoryGroupController.update` |
| `nodia_finance_movements_get` | Leer | `FinanceMovementController.findOne` |
| `nodia_finance_movements_list` | Leer | `FinanceMovementController.list` |
| `nodia_finance_movements_prepare_create` | Preparar | `FinanceMovementController.create` |
| `nodia_finance_movements_prepare_delete` | Preparar | `FinanceMovementController.remove` |
| `nodia_finance_movements_prepare_update` | Preparar | `FinanceMovementController.update` |
| `nodia_finance_obligations_get` | Leer | `FinanceObligationController.findOne` |
| `nodia_finance_obligations_list` | Leer | `FinanceObligationController.list` |
| `nodia_finance_obligations_prepare_create` | Preparar | `FinanceObligationController.create` |
| `nodia_finance_obligations_prepare_delete` | Preparar | `FinanceObligationController.remove` |
| `nodia_finance_obligations_prepare_update` | Preparar | `FinanceObligationController.update` |
| `nodia_finance_summaries_by_category` | Leer | `FinanceOverviewController.categories` |
| `nodia_finance_summaries_by_category_group` | Leer | `FinanceOverviewController.groups` |
| `nodia_finance_summaries_overview` | Leer | `FinanceOverviewController.overview` |

### /settings/modules — 9 herramientas

| Herramienta | Clase | Handler(s) de origen |
|---|---|---|
| `nodia_module_groups_list` | Leer | `ModuleGroupController.findAll` |
| `nodia_module_groups_prepare_create` | Preparar | `ModuleGroupController.create` |
| `nodia_module_groups_prepare_delete` | Preparar | `ModuleGroupController.remove` |
| `nodia_module_groups_prepare_update` | Preparar | `ModuleGroupController.update` |
| `nodia_modules_get` | Leer | `ModuleController.findOne` |
| `nodia_modules_list` | Leer | `ModuleController.findAll` |
| `nodia_modules_prepare_create` | Preparar | `ModuleController.create` |
| `nodia_modules_prepare_delete` | Preparar | `ModuleController.remove` |
| `nodia_modules_prepare_update` | Preparar | `ModuleController.update`, `ModuleController.updatePatch` |

### /tools/reservations — 43 herramientas

| Herramienta | Clase | Handler(s) de origen |
|---|---|---|
| `nodia_rental_audit_list` | Leer | `RentalHistoryController.history` |
| `nodia_rental_blocks_get` | Leer | `RentalBlockController.getRentalBlock` |
| `nodia_rental_blocks_list` | Leer | `RentalBlockController.getRentalBlocks` |
| `nodia_rental_blocks_prepare_create` | Preparar | `RentalBlockController.createRentalBlock` |
| `nodia_rental_blocks_prepare_update` | Preparar | `RentalBlockController.updateRentalBlock` |
| `nodia_rental_calendar_availability` | Leer | `RentalCalendarController.getRentalAvailability` |
| `nodia_rental_calendar_calendar` | Leer | `RentalCalendarController.getRentalCalendar` |
| `nodia_rental_cancellation_policies_get` | Leer | `RentalCancellationPolicyController.getRentalCancellationPolicy` |
| `nodia_rental_cancellation_policies_list` | Leer | `RentalCancellationPolicyController.getRentalCancellationPolicies` |
| `nodia_rental_cancellation_policies_prepare_create` | Preparar | `RentalCancellationPolicyController.createRentalCancellationPolicy` |
| `nodia_rental_cancellation_policies_prepare_update` | Preparar | `RentalCancellationPolicyController.updateRentalCancellationPolicy` |
| `nodia_rental_collaborators_candidates` | Leer | `RentalCollaboratorController.getRentalCollaboratorCandidates` |
| `nodia_rental_collaborators_list` | Leer | `RentalCollaboratorController.getRentalCollaborators` |
| `nodia_rental_collaborators_prepare_create` | Preparar | `RentalCollaboratorController.createRentalCollaborator` |
| `nodia_rental_collaborators_prepare_update` | Preparar | `RentalCollaboratorController.updateRentalCollaborator` |
| `nodia_rental_expenses_get` | Leer | `RentalExpenseController.getRentalExpense` |
| `nodia_rental_expenses_list` | Leer | `RentalExpenseController.getRentalExpenses` |
| `nodia_rental_expenses_prepare_create` | Preparar | `RentalExpenseController.createRentalExpense` |
| `nodia_rental_expenses_prepare_pay` | Preparar | `RentalExpenseController.payRentalExpense` |
| `nodia_rental_expenses_prepare_update` | Preparar | `RentalExpenseController.updateRentalExpense` |
| `nodia_rental_expenses_prepare_void` | Preparar | `RentalExpenseController.voidRentalExpense` |
| `nodia_rental_payments_get` | Leer | `RentalPaymentController.getRentalPayment` |
| `nodia_rental_payments_list` | Leer | `RentalPaymentController.getRentalPayments` |
| `nodia_rental_payments_prepare_create` | Preparar | `RentalPaymentController.createRentalPayment` |
| `nodia_rental_payments_prepare_void` | Preparar | `RentalPaymentController.voidRentalPayment` |
| `nodia_rental_properties_get` | Leer | `RentalPropertyController.getRentalProperty` |
| `nodia_rental_properties_list` | Leer | `RentalPropertyController.getRentalProperties` |
| `nodia_rental_properties_prepare_create` | Preparar | `RentalPropertyController.createRentalProperty` |
| `nodia_rental_properties_prepare_update` | Preparar | `RentalPropertyController.updateRentalProperty` |
| `nodia_rental_reservations_cancellation_preview` | Leer | `RentalReservationController.previewRentalCancellation` |
| `nodia_rental_reservations_get` | Leer | `RentalReservationController.getRentalReservation` |
| `nodia_rental_reservations_list` | Leer | `RentalReservationController.listRentalReservation` |
| `nodia_rental_reservations_prepare_cancel` | Preparar | `RentalReservationController.cancelRentalReservation` |
| `nodia_rental_reservations_prepare_complete` | Preparar | `RentalReservationController.completeRentalReservation` |
| `nodia_rental_reservations_prepare_confirm` | Preparar | `RentalReservationController.confirmRentalReservation` |
| `nodia_rental_reservations_prepare_create` | Preparar | `RentalReservationController.createRentalReservation` |
| `nodia_rental_reservations_prepare_start` | Preparar | `RentalReservationController.startRentalReservation` |
| `nodia_rental_reservations_prepare_update` | Preparar | `RentalReservationController.updateRentalReservation` |
| `nodia_rental_summaries_overview` | Leer | `RentalOverviewController.getRentalOverview` |
| `nodia_rental_turnovers_get` | Leer | `RentalTurnoverController.getRentalTurnover` |
| `nodia_rental_turnovers_list` | Leer | `RentalTurnoverController.listRentalTurnover` |
| `nodia_rental_turnovers_prepare_approve_same_day` | Preparar | `RentalTurnoverController.approveSameDayRentalTurnover` |
| `nodia_rental_turnovers_prepare_update` | Preparar | `RentalTurnoverController.updateRentalTurnover` |

### /settings/roles — 5 herramientas

| Herramienta | Clase | Handler(s) de origen |
|---|---|---|
| `nodia_roles_get` | Leer | `RoleController.findOne` |
| `nodia_roles_list` | Leer | `RoleController.findAll` |
| `nodia_roles_prepare_create` | Preparar | `RoleController.create` |
| `nodia_roles_prepare_delete` | Preparar | `RoleController.remove` |
| `nodia_roles_prepare_update` | Preparar | `RoleController.update`, `RoleController.updatePatch` |

### /settings/users — 3 herramientas

| Herramienta | Clase | Handler(s) de origen |
|---|---|---|
| `nodia_users_list` | Leer | `UserController.findAll` |
| `nodia_users_prepare_create` | Preparar | `UserController.create` |
| `nodia_users_prepare_update` | Preparar | `UserController.update` |

## Herramientas comunes nuevas

Los contratos de entrada/salida están en las definiciones homónimas de [JSON Schema común](nodia-ai-v1-common-contracts.schema.json). AI-14 implementa los tres primeros ayudantes como infraestructura técnica local; las otras ocho entradas continúan pendientes. Esto no publica las familias de negocio ni acredita despliegue o inferencia real.

| Herramienta | Entrada | Salida |
|---|---|---|
| `nodia_capabilities_search` | `CatalogSearchInput` | `CatalogSearchResult` |
| `nodia_capabilities_describe` | `CatalogDescribeInput` | `CapabilityDescriptor` |
| `nodia_entities_search` | `EntitySearchInput` | `EntityCandidates` |
| `nodia_proposals_get` | `ProposalGetInput` | `PublicProposal` |
| `nodia_operations_get` | `OperationGetInput` | `ExecutionStatus` |
| `nodia_reports_describe` | `ReportDescribeInput` | `ReportCatalog` |
| `nodia_reports_run` | `ReportQueryInput` | `ReportResult` |
| `nodia_workflows_prepare` | `WorkflowPrepareInput` | `PreparationResult` |
| `nodia_attachments_describe` | `AttachmentDescribeInput` | `AttachmentMetadata` |
| `nodia_preferences_list` | `PreferenceListInput` | `PreferencePage` |
| `nodia_preferences_prepare` | `PreferencePrepareInput` | `PreparationResult` |

## Entradas a flujos seguros

| Herramienta | Flujo | Cobertura de handlers |
|---|---|---|
| `nodia_secure_flows_prepare_api_key_create` | AI key create in existing secure form | 1 |
| `nodia_secure_flows_prepare_api_key_update` | AI key replacement in existing secure form | 1 |
| `nodia_secure_flows_prepare_connection_login` | Gemini Web/Agentic or Codex login in secure client flow | 14 |
| `nodia_secure_flows_prepare_nodia_logout` | Own Nodia session logout in trusted client | 1 |

API keys se ingresan/reemplazan en el formulario seguro. Login muestra su visor/flujo propio. El código OAuth de Gemini Agentic nunca es argumento del modelo; `AiProviderController.submitGeminiAgenticCode` queda clasificado I (interactivo), corrigiendo M del primer inventario. La clasificación vigente es **M75/L64/I18/F5/A6/B7/O2**; el total 177 no cambia. El logout de Nodia afecta sólo la sesión propia y se completa en la app, no mediante un actor elegido en el chat.

## Tratamiento de los 177 handlers

| Tratamiento | Handlers | Criterio |
|---|---:|---|
| `domain_tool` | 144 | 141 nombres con tres agrupaciones PUT/PATCH |
| `secure_client_flow` | 18 | Credenciales/login/logout por canal seguro |
| `infrastructure_only` | 2 | Infraestructura/bootstrap; no capacidades conversacionales |
| `coordinator_internal` | 6 | Sesión/contexto internos; no exponer como orden al modelo |
| `deferred_bulk` | 7 | Siete escrituras bulk/import excluidas expresamente |

La cobertura representa el tratamiento de cada handler, no equivalencia 1:1 entre handlers y herramientas. Los once ayudantes comunes son capacidades nuevas y no aumentan el número de endpoints existentes.

## Condiciones para publicar y siguiente paso

- Derivar esquema runtime y proyección por operación (NI-01/07), incluyendo reglas que no expresa el DTO, archivos y filtros legacy. Rechazar propiedades desconocidas y validar también la salida.
- Implementar autoridad compartida y revocación (NI-02/03); IDs de módulos y recursos comprobados.
- Implementar propuestas/confirmación y garantías por efecto (NI-04/05/08); un wrapper MCP no añade idempotencia a un caso de uso.
- Resolver NI-13 antes de habilitar escrituras administrativas afectadas: último superadministrador activo, asociaciones atómicas y claves de sistema inmutables. Son pendientes detectados en fuentes, no garantías ya comprobadas.
- Implementar consultas estructuradas/procedencia (NI-06), adjuntos/secretos (NI-09), evolución (NI-11) y pruebas de paridad (NI-12).
- Comprobar chat/contexto/herramientas/modalidades en cada modo Gemini (NI-10/NA-02); no basta con sesión, health o extracción OCR.

AI-01 completado como contratos comunes/baseline en[46](46-nodia-ai-ai01-contract-baseline.md); continuar con AI-02/AI-03 del [plan45](45-nodia-ai-implementation-plan.md), derivado de ERD42/ejecución43 y revisión44; la primera publicación depende de viabilidad y cierre de esos contratos. Los nombres son candidatos versionados y los documentos permanecen en revisión.

ERD y ejecución derivados en [42](42-nodia-ai-erd.md)/[43](43-nodia-ai-execution-architecture.md), con jobs PostgreSQL, receipts/grants, secuencia y conciliación. Siguiente: implementar tareas del plan45 y contratos por dominio; no añade herramientas a las156 candidatas ni publica MCP. Retención posterior precisada:90 días del último mensaje del dueño; adjuntos/transcripciones con chat, preferencias aceptadas independientes.

El usuario eligió primeras pruebas con Gemini Web y Agentic, y borrado automático del chat tras 90 días de inactividad humana. API permanece prevista por etapas. Son decisiones funcionales, no evidencia de soporte de herramientas ni cambios operativos en las conexiones existentes.
