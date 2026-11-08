---
{
  "schema_version": 1,
  "document_id": "general-settings.ai-connections",
  "product_id": "general-settings",
  "kind": "feature",
  "revision": 7,
  "document_status": "approved",
  "implementation": {
    "status": "partial",
    "notes": "Agentic and API key only. Existing publication fragments retained; implementation verification and live operational acceptance are separate. Human documentary approval recorded 2026-10-27."
  },
  "integration_status": "published",
  "maintainer": "Mantenimiento de Ajustes Generales y NodiaAI conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/90-agentic-api-only-web-retirement.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/02-prd-v1.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/19-prelaunch-review.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/ai-provider-feature-contract.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/ai-provider/entities/ai-provider.entity.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/ai-provider/entities/ai-provider-catalog.entity.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/ai-provider/ai-provider.service.ts",
      "kind": "implementation"
    },
    {
      "path": "docs/mvp/61-nodia-ai-ai15-product-reads.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/nodia-ai-products/external/external-read.family.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-products/external/use-case/read-external.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-products/contracts/external.schema.json",
      "kind": "implementation"
    }
  ],
  "verification": {
    "checked_on": "2026-10-27",
    "evidence_paths": [
      "docs/mvp/51-nodia-ai-ai05-product-knowledge.md",
      "docs/evidence/nodia-ai-ai05-knowledge-validation.json",
      "docs/evidence/nodia-ai-ai15-postgres-integration.json",
      "docs/evidence/nodia-ai-ai15-external-validation.json",
      "docs/evidence/nodia-ai-ai15-artifacts-integration.json",
      "docs/evidence/nodia-ai-ai15-live-local.json",
      "docs/evidence/nodia-ai-ai15-live-artifacts.json",
      "docs/evidence/nodia-ai-ai15-live-routing-interrupted.json",
      "docs/evidence/nodia-ai-ai15-live-external-final.json",
      "docs/evidence/nodia-ai-ai15-live-quota-gateway-final.json",
      "docs/evidence/nodia-ai-ai15-live-codex-root-postfix.json",
      "docs/evidence/ai-two-modes-knowledge-review-r01.json"
    ],
    "notes": "Gemini Agentic real completó un turno de cinco familias SQL (10 comprobaciones) y otro de tres referencias (12): dos CSV autenticados correctos; factura devuelve 503 por R2 sin configurar. La emisión de referencia no certifica bytes disponibles. Routing real completó Web conversacional y delegación opt-in SQL; el siguiente turno Web quedó unknown/502 y se concilió sin replay. El ensayo externo final completó recibos health/engines y luego quedó unknown; no se registra como aceptación generativa completa. La regresión Gateway de las cinco salidas usa observaciones sintéticas y cero inferencias. Los fallos permanecen en sus informes, sin atribuirlos a causa no observada. Las demás lecturas conservan su evidencia aislada SQL/HTTP; publicar no garantiza que el modelo siempre construya llamadas válidas. Pulido documental: evidencia aislada anterior etiquetada como histórica y referencia Codex alineada con su publicación real. Sin nuevas observaciones, herramientas, contratos ni cambios de fragmentos publicados. Two-mode source review on 2026-10-27; new runtime/VM/API acceptance is separate and pending."
  },
  "approval": {
    "reference": "docs/evidence/ai-two-modes-knowledge-human-approval-r01.json",
    "revision": 7,
    "content_sha256": "7356cc5b7fa06997c0f79de70eb5ac1d8031e66baa007b3c4ba08e938a95d2a1"
  }
}
---

# Catálogo y conexiones de IA — contexto funcional para NodiaAI

## Modos vigentes solicitados el 2026-10-27

Sólo **Agentic** (`agentic`) y **API key** (`api_key`), conforme al [plan90](../../../../mvp/90-agentic-api-only-web-retirement.md). Flags `use_agentic`/`can_use_agentic`, `use_api_key`/`can_use_api_key`; configuración por `fields.agentic` y `fields.api_key`. Los defaults/selecciones Web se desasignan y requieren elección explícita; no se convierten en otra modalidad. El historial anterior conserva su evidencia y no habilita Web.

La revisión aprobada anterior 6 se conserva byte exacta; el [informe de revisión](../../../../evidence/ai-two-modes-knowledge-review-r01.json) identifica originales y cambios. La disponibilidad de cada funcionalidad se verifica por proveedor/modo/modelo con el [plan91](../../../../mvp/91-ai-provider-onboarding-verification.md); las pruebas históricas de Web no acreditan API ni Agentic actual.

Estado actual: esta revisión publica sólo el fragmento «Lecturas disponibles en AI-15». Las secciones de implementación/evidencia anteriores a ese fragmento conservan la trazabilidad de entregas iniciales; sus frases históricas sobre publicación pendiente no sustituyen el frontmatter actual ni habilitan escrituras.

[Producto](../README.md). Metadatos canónicos migrados en [AI-06](../../../../mvp/52-nodia-ai-ai06-knowledge-publication-contract.md); esta revisión tiene autorización específica de publicación para las lecturas enumeradas al final; las demás operaciones conservan sus gates.

## Qué resuelve y qué significa

Distinguir identidad de proveedor del catálogo e instancia de conexión configurable; una instancia admite varios modos independientes sin probar disponibilidad.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención y aclaración esperada |
|---|---|
| «Configura Gemini» | Aclarar crear instancia o editar existente y el modo; no pedir credenciales aquí. |
| «Hazlo predeterminado» | Identificar instancia y efecto sobre el default actual. |
| «Habilita cualquier proveedor del catálogo» | Requiere adaptador real; un flag no lo implementa. |

Ejemplos ilustrativos sin resultados ni identificadores reales. Preguntar sólo obligatorios y ambigüedades; los opcionales no bloquean salvo condición del dominio.

## Operaciones y contratos

| Handler y ruta de referencia | Candidato del catálogo40 | Tratamiento vigente |
|---|---|---|
| [AiProviderController.getCatalog](../../../../../nodia-server/src/ai-provider/ai-provider.controller.ts)<br>`GET /api/v1/ai-provider/catalog` | `nodia_ai_providers_catalog_list` (read, candidato40) | Publicado en el release AI-15 de lecturas; disponibilidad observada por separado |
| [AiProviderController.createCatalog](../../../../../nodia-server/src/ai-provider/ai-provider.controller.ts)<br>`POST /api/v1/ai-provider/catalog` | `nodia_ai_providers_prepare_catalog_create` (prepare_change, candidato40) | Candidato; sin publicar |
| [AiProviderController.updateCatalog](../../../../../nodia-server/src/ai-provider/ai-provider.controller.ts)<br>`PUT /api/v1/ai-provider/catalog/:id` | `nodia_ai_providers_prepare_catalog_update` (prepare_change, candidato40) | Candidato; sin publicar |
| [AiProviderController.getSupportedProviders](../../../../../nodia-server/src/ai-provider/ai-provider.controller.ts)<br>`GET /api/v1/ai-provider/supported` | `nodia_ai_providers_supported_providers` (read, candidato40) | Publicado en el release AI-15 de lecturas; disponibilidad observada por separado |
| [AiProviderController.findAll](../../../../../nodia-server/src/ai-provider/ai-provider.controller.ts)<br>`GET /api/v1/ai-provider` | `nodia_ai_providers_list` (read, candidato40) | Publicado en el release AI-15 de lecturas; disponibilidad observada por separado |
| [AiProviderController.create](../../../../../nodia-server/src/ai-provider/ai-provider.controller.ts)<br>`POST /api/v1/ai-provider` | `nodia_ai_providers_prepare_create` (prepare_change, candidato40) | Candidato; sin publicar |
| [AiProviderController.update](../../../../../nodia-server/src/ai-provider/ai-provider.controller.ts)<br>`PUT /api/v1/ai-provider/:id` | `nodia_ai_providers_prepare_update` (prepare_change, candidato40) | Candidato; sin publicar |

Los aliases de [inventario39](../../../../mvp/nodia-ai-current-endpoints.json) no crean capacidades distintas. Los nombres de operaciones proceden del catálogo documentado en [catálogo40](../../../../mvp/40-nodia-ai-tool-catalog-v1.md): sólo las lecturas enumeradas en esta revisión tienen binding explícito de publicación; las escrituras continúan candidatas.

DTOs de entrada/filtros: [create-ai-provider-catalog.dto.ts](../../../../../nodia-server/src/ai-provider/dto/create-ai-provider-catalog.dto.ts), [update-ai-provider-catalog.dto.ts](../../../../../nodia-server/src/ai-provider/dto/update-ai-provider-catalog.dto.ts), [get-ai-providers.dto.ts](../../../../../nodia-server/src/ai-provider/dto/get-ai-providers.dto.ts), [create-ai-provider.dto.ts](../../../../../nodia-server/src/ai-provider/dto/create-ai-provider.dto.ts), [update-ai-provider.dto.ts](../../../../../nodia-server/src/ai-provider/dto/update-ai-provider.dto.ts)

Delegación actual (casos de uso/servicios según controlador): [get-ai-provider-catalog.use-case.ts](../../../../../nodia-server/src/ai-provider/use-case/get-ai-provider-catalog.use-case.ts), [create-ai-provider-catalog.use-case.ts](../../../../../nodia-server/src/ai-provider/use-case/create-ai-provider-catalog.use-case.ts), [update-ai-provider-catalog.use-case.ts](../../../../../nodia-server/src/ai-provider/use-case/update-ai-provider-catalog.use-case.ts), [get-supported-ai-providers.use-case.ts](../../../../../nodia-server/src/ai-provider/use-case/get-supported-ai-providers.use-case.ts), [get-all-ai-providers.use-case.ts](../../../../../nodia-server/src/ai-provider/use-case/get-all-ai-providers.use-case.ts), [create-ai-provider.use-case.ts](../../../../../nodia-server/src/ai-provider/use-case/create-ai-provider.use-case.ts), [update-ai-provider.use-case.ts](../../../../../nodia-server/src/ai-provider/use-case/update-ai-provider.use-case.ts)

## Datos mínimos y resolución de dudas

| Dato/operación | Obligatorio, condicional u opcional; resolución |
|---|---|
| Catálogo | key/name en alta y flags can_use_* configurables según integración; actualizar catálogo no crea un adaptador. |
| Conexión | catalog_id activo compatible (o key de compatibilidad), nombre opcional y modos use_*; default_mode debe estar habilitado. is_default/is_active/auto_rotate_api_keys opcionales. |

Actor, permisos efectivos, claves de intención, versiones de concurrencia y referencias internas los controla Server; no los inventa ni decide el modelo. DTOs enlazados son fuente de campos, no un JSON Schema estricto de herramienta ya publicado.

## Reglas, acceso y restricciones

Proveedor de catálogo de una conexión no cambia al editar. Sólo catálogo compatible activo admite instancia. Modelo por modo y sincronización explícita; alta borra selección/modelos preexistentes y empieza sin modelo. No meter secrets en fields. API, Web y Agentic mantienen configuración/identidad independiente; no elegir primer modelo ni fallback por nombre.

Cinco destinos distintos: /settings/users, /settings/roles, /settings/actions, /settings/modules y /settings/ai-providers. No habilitar todos por asignar uno. Administración global autenticada intencional en19, sin inventar permisos por acción; IA conserva su requisito real ai:manage o super_admin. NodiaAI aplica su módulo más cada destino (AI-07) y salvaguardas NI-13/AI-08.

## Filtros e informes

Listar catálogo, compatibles e instancias con filtros/actividad; compatible/configurable no significa saludable. Catálogo global contiene identidades sin adaptador; no anunciarlas como disponibles. Sin DELETE de instancia/catálogo en inventario.

El nuevo registro combinable de [contratos41](../../../../mvp/41-nodia-ai-v1-contracts.md) sigue pendiente AI-30/31; filtros REST existentes no autorizan joins, campos o SQL libres. [Política50](../../../../mvp/50-nodia-ai-ai04-runtime-policy.md) acota trabajo del chat y no reemplaza silenciosamente límites del módulo.

## Vista previa, confirmación y recuperación

Preview conexión exacta, modos habilitados/predeterminado y cambios de default; no apagar ni heredar otros modos por editar uno. Campos JSON del legado necesitan contrato finito/proyección. No aplicar opt-in del chat48 a OCR existente.

Desde NodiaAI, preparar es distinto de ejecutar: cambios requieren vista previa exacta y botón humano de41; elegir Agentic o API key no confirma. Conservar efectos completados si falla un paso dependiente y no reenviar un resultado desconocido. Payload del chat caduca según50 sin borrar registros de dominio ni sus journals nativos.

## Integración y evidencia

- [x] Fuentes de producto/backend, diferencias y mínimos revisados estáticamente en AI-05.
- [x] Correspondencia de handlers/candidatos y enlaces comprobada offline; no prueba de autorización/efectos.
- [ ] Schema de herramienta/proyección, autoridad y contexto registrados con AI-06/07 y familia pertinente.
- [ ] Casos de uso reales de acceso/ambigüedad, confirmación, concurrencia y recuperación verificados para NodiaAI.
- [ ] Adaptador/modalidades, publicación y aceptación operativa comprobados.

Pendientes con efecto sobre disponibilidad: AI-28/29: modelos/configuración dinámica y autoridad ai:manage o super_admin con destino /settings/ai-providers; schema estricto de fields y idempotencia.

## Evolución y compatibilidad

| Revisión | Cambio y fuentes | Contexto y propuestas |
|---|---|---|
| 1 | AI-05: explicación inicial a partir de contratos/código enlazados | Sin cambio de backend ni publicación. Al cambiar reglas/DTOs, actualizar ficha/schema/registro, invalidar propuestas incompatibles y mantener recuperación original |


## Historial AI-15 — implementación previa a publicación

[Entrega y gates](../../../../mvp/61-nodia-ai-ai15-product-reads.md). Los puertos `nodia_ai_providers_list`, `nodia_ai_providers_catalog_list` y `nodia_ai_providers_supported_providers` comparten casos de uso nativos y manager del checkpoint. Listas paginadas, máximo 100 registros; el catálogo rechaza exceso sin truncar. Se proyectan identidad, flags y configuración pública, sin JSON fields arbitrario ni claves. Sus exports son candidatos verificados sobre SQL aislado; publicación/aprobación y Gemini real permanecen pendientes.


## AI-15 — observación externa acotada

Las cinco lecturas de [entrega61](../../../../mvp/61-nodia-ai-ai15-product-reads.md) reutilizan reglas de proveedor: `nodia_ai_providers_health`, `nodia_ai_providers_gemini_engines`, `nodia_ai_providers_models`, `nodia_ai_providers_codex_session` y `nodia_invoices_eligible_invoice_connections`. Las cuatro administrativas requieren el módulo IA y `ai:manage`; elegibilidad de factura conserva su permiso nativo de Negocios. Todas pasan además por la autorización NodiaAI vigente.

El backend captura proveedores, catálogo y claves mediante consultas por conjuntos acotadas por la política. La observación de red/perfil se realiza después del commit; el resultado sólo se entrega tras releer autoridad y contrastar el hash privado de configuración. Recuperar una llamada completa compara ese snapshot sin repetir la observación; una llamada inconclusa no se reenvía automáticamente. `models` y `codex_session` exigen una conexión exacta, sin selección implícita de otra instancia.

Las proyecciones excluyen JSON arbitrario, secretos, ciphertext, fingerprint, mensajes privados y relaciones no declaradas. Cero, false y null permanecen distintos; modelos salen de descubrimiento dinámico, sin nombres estáticos. Las consultas no generan una inferencia para comprobar salud. Codex no interrumpe un perfil ocupado por otra operación; una cancelación detiene únicamente el perfil admitido por esa observación. La petición remota consume tiempo/recursos y puede fallar; no habilita ni cambia el modo del chat.

Estado histórico de la verificación aislada anterior a la publicación AI-15; el estado vigente y sus límites se registran en el frontmatter y en «Lecturas disponibles en AI-15».

[Evidencia aislada](../../../../evidence/nodia-ai-ai15-external-validation.json): cinco resultados de UCs nativos con SQL real, sin SQL durante la observación, rechazo por cambios de configuración o revocación y descarte tras cancelación. Adaptadores externos sintéticos; cuenta real, publicación y despliegue permanecen pendientes.


## Lecturas disponibles en AI-15

Consultar catálogo de conexiones con proyección y límites explícitos; no confundir configuración con salud real.

Consultar conexiones y su configuración pública. can_use_* define modos configurables; no acredita autenticación, inferencia ni herramientas disponibles.

Consultar proveedores/modos soportados en el backend. El catálogo no demuestra que una cuenta o modelo pueda ejecutar inferencia.

Herramientas de esta sección: `nodia_ai_providers_catalog_list`, `nodia_ai_providers_list`, `nodia_ai_providers_supported_providers`.

Resolver entidades, destinatario, intervalo y filtros ambiguos antes de llamar. Usar sólo los campos del schema de la herramienta. Conservar IDs y dinero exactos, cero y falso; ausencia o unknown no equivalen a cero. La paginación y los límites de resultados deben comunicarse y una página no representa el universo completo. En recursos con actividad, iniciar Activo y usar Inactivo/Todos sólo cuando se soliciten; Todos omite el filtro.

Server valida sesión, módulo NodiaAI y todos los módulos destino actuales para usuarios ordinarios; super_admin conserva transversalidad y las reglas de dominio. Datos privados y autoridad se revalidan al devolver o recuperar resultados. Finanzas permite owner_id ajeno sólo a super_admin; Reservas conserva autoridad actual del alojamiento; administración IA conserva ai:manage. No construir SQL libre ni pedir tokens, cookies o secretos.

Esta publicación incluye lecturas y referencias privadas, no preparaciones ni ejecución de escrituras. Cualquier creación, edición, eliminación o confirmación conserva sus herramientas y etapas posteriores. No anunciar informes cruzados, un total por proveedor u otros filtros/agrupaciones si el schema o caso de uso no los soporta. Web se retira conforme al plan90; MCP requiere Agentic verificado elegido directamente, sin delegación ni fallback de modo.

Las observaciones externas se ejecutan fuera de SQL, con deadline/cancelación y verificación posterior de autoridad y configuración. La recuperación de una llamada completada no repite red; una llamada interrumpida no se reintenta ciegamente. Los artefactos son referencias privadas current_on_download: la descarga humana reautoriza chat/recurso, rechaza exceso sin truncar y no conserva el archivo al expirar el chat; el original de factura pertenece al negocio.
