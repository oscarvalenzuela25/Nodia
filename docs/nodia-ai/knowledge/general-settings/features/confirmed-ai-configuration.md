---
{
  "schema_version": 1,
  "document_id": "general-settings.confirmed-ai-configuration",
  "product_id": "general-settings",
  "kind": "feature",
  "revision": 3,
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
      "path": "docs/mvp/74-nodia-ai-ai28-provider-configuration.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/ai-provider-feature-contract.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/41-nodia-ai-v1-contracts.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/nodia-ai-provider-operations/use-case/build-nodia-ai-provider-operations.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/ai-provider/dto/create-ai-provider.dto.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/ai-provider/dto/create-ai-provider-catalog.dto.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-write-tools/use-case/build-nodia-ai-write-tools.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-secure-preparation/use-case/build-nodia-ai-secure-operations.use-case.ts",
      "kind": "implementation"
    }
  ],
  "verification": {
    "checked_on": "2026-10-27",
    "evidence_paths": [
      "docs/mvp/74-nodia-ai-ai28-provider-configuration.md",
      "docs/evidence/nodia-ai-ai28-client-validation.json",
      "docs/evidence/nodia-ai-ai28-validation.json",
      "docs/evidence/nodia-ai-ai28-postgresql.json",
      "docs/evidence/nodia-ai-ai28-regressions.json",
      "docs/evidence/nodia-ai-ai28-ui-validation.json",
      "docs/evidence/nodia-ai-ai36-c01-validation.json",
      "docs/evidence/nodia-ai-ai36-c05-write-publication-r02-validation.json",
      "docs/evidence/ai-two-modes-knowledge-review-r01.json"
    ],
    "notes": "Publicación offline con builders nativos y schemas cerrados. El fragmento adicional es el único alcance nuevo; no equivale a cuenta real ni a una aceptación de todos sus efectos. Two-mode source review on 2026-10-27; new runtime/VM/API acceptance is separate and pending."
  },
  "approval": {
    "reference": "docs/evidence/ai-two-modes-knowledge-human-approval-r01.json",
    "revision": 3,
    "content_sha256": "9d42d48d2367e1c4ca73ef479ed31563794e49a48b7f979505e912848015734d"
  }
}
---

# Configuración IA confirmada — contexto funcional para NodiaAI

## Modos vigentes solicitados el 2026-10-27

Sólo **Agentic** (`agentic`) y **API key** (`api_key`), conforme al [plan90](../../../../mvp/90-agentic-api-only-web-retirement.md). Flags `use_agentic`/`can_use_agentic`, `use_api_key`/`can_use_api_key`; configuración por `fields.agentic` y `fields.api_key`. Los defaults/selecciones Web se desasignan y requieren elección explícita; no se convierten en otra modalidad. El historial anterior conserva su evidencia y no habilita Web.

La revisión aprobada anterior 2 se conserva byte exacta; el [informe de revisión](../../../../evidence/ai-two-modes-knowledge-review-r01.json) identifica originales y cambios. La disponibilidad de cada funcionalidad se verifica por proveedor/modo/modelo con el [plan91](../../../../mvp/91-ai-provider-onboarding-verification.md); las pruebas históricas de Web no acreditan API ni Agentic actual.

## Qué resuelve

Crear/editar instancias de conexiones y catálogo IA mediante propuesta no secreta, confirmación exacta y escritores nativos. [Entrega74](../../../../mvp/74-nodia-ai-ai28-provider-configuration.md) separa configuración global de selección del chat. Configuración, autenticación, disponibilidad e inferencia son hechos diferentes.

## Solicitudes y aclaraciones

«Crea una conexión para este catálogo» requiere resolver catalog_id real, no clave/nombre ambiguos. «Cambia el modelo de Agentic» exige identificar instancia, modo y modelo permitido; preguntar cuando falten. «Activa Agentic» cambia un flag configurable y no acredita que funcione. «Haz esta conexión predeterminada» debe mostrar los predeterminados previos. «Agrega una API key» debe abrir el futuro canal seguro de AI-29; nunca recibir secretos en el modelo.

## Operaciones y mínimos

Cuatro puertos internos: nodia_ai_providers_prepare_create/update y nodia_ai_providers_prepare_catalog_create/catalog_update. Crear conexión requiere catalog_id; crear catálogo key y name. Actualizar requiere ID y cambios explícitos. No DELETE ni lotes. La creación de conexión no añade modelos fantasma.

Las actualizaciones permiten nombre, modos habilitados, default_mode nullable, auto_rotate_api_keys, is_default, is_active y translates. Actualizar catálogo conserva key; actualizar conexión conserva catalog_id. Modelos e intensidad son paths cerrados por modo: selected_model, ocr_model, ocr_focus_model, thinking_level. Backend valida modelo/nivel contra configuración o descubrimiento disponible, sin listas de versiones estáticas ni deducciones por nombre. Omitido conserva el contrato; null limpia la asignación específica; para intensidad elimina la preferencia general y la del modelo seleccionado. Guardar intensidad actualiza ambas cuando hay un modelo seleccionado. Preview explica preferencias resultantes sin afirmar soporte.

## Acceso y restricciones

Ordinario necesita NodiaAI y /settings/ai-providers más ai:manage donde corresponde. Super_admin conserva identidad y autoridad transversal. Autoridad y precondiciones se revalidan en cada efecto. IDs bigint string, DTO cerrado, traducciones estructuradas y campos derivados readonly. Traducciones nativas se actualizan o agregan por clave; no admite eliminarlas enviando una colección vacía o retirando claves previas. Preview muestra la colección efectiva combinada. Nunca campos JSON arbitrarios, claves, cookies, códigos o credenciales del proveedor. Máximo100 traducciones y64KiB por comando; límites por campo en74.

## Consultas, informes y estado

Lecturas publicadas existentes conservan su contrato. can_use_* significa modalidad configurable, no ejecución disponible. Configuración no comprueba autenticación, cuotas o inferencia. Resultados desconocidos se explicitan sin cifras de respaldo; cero y ausencia son distintos. No añade medidas financieras o relaciones nuevas para informes.

## Vista previa, confirmación y recuperación

Mostrar instancia y ID, campos exactos, catálogo resuelto, predeterminados previos y conexiones afectadas. Revisión editada obtiene otro hash y botón humano. Writer y recibo mínimo comparten transacción; recuperar consulta recibo sin repetir el efecto. Cancelar no revierte commits anteriores. Completados invalidan cachés relevantes sin cambiar la selección del chat ni conceder acceso.

## Evidencia e integración pendiente

Cuatro puertos internos y Client implementados conforme74. Client1589/205, focal241/3, tipado/lint/build correctos; evidencia sintética separada de SQL, procesos y activación. La ficha permanece draft/unregistered con approval null. Publicar MCP y aceptar escrituras Gemini son gates independientes; secretos/login/interacciones externas siguen en AI-29. No se necesita subir este Markdown a cada chat ni explorar tablas o endpoints arbitrarios.

## Evolución

Cambiar campos, reglas o semántica requiere actualizar DTO, escritor, preparador, contrato/hash, pruebas y esta ficha. Invalidar propuestas incompatibles; respetar el recibo histórico. Un proveedor o modelo nuevo no se habilita por añadir su nombre a la documentación.

## IA: administración no secreta publicada en AI36-C05

Este fragmento añade sólo estas preparaciones publicadas:

- `nodia_ai_providers_prepare_catalog_create`
- `nodia_ai_providers_prepare_catalog_update`
- `nodia_ai_providers_prepare_codex_logout`
- `nodia_ai_providers_prepare_create`
- `nodia_ai_providers_prepare_gemini_web_logout`
- `nodia_ai_providers_prepare_sync_models`
- `nodia_ai_providers_prepare_update`
- `nodia_api_keys_prepare_delete`

Cada herramienta recibe un partial cerrado, devuelve mínimos faltantes o propuesta revisable y permite continuar sólo con draft_id/revisión CAS exactos. No aplica el cambio de dominio. Consulta las referencias reales; nunca inventes IDs o enlaces. Sólo el botón humano sobre revisión/hash exactos admite la ejecución y su recibo nativo. No se aceptan SQL, comandos arbitrarios, secretos ni bulk/importación. Configurar no acredita disponibilidad. Eliminar una clave usa sólo su identidad, nunca su secreto. Logout/sync son comandos explícitos separados: no fallback, login automático ni cambio de proveedor/modelo inferido. Los cuatro flujos seguros de credenciales/login C02 siguen fuera.

El backend exige NodiaAI y cada módulo/acción de destino vigentes, reautoriza al ejecutar y conserva recuperación/idempotencia. Publicación, selección del intento, disponibilidad, despliegue y aceptación real son estados distintos. Los apartados anteriores son históricos y no amplían este lote.
