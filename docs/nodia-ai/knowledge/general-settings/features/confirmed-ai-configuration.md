---
{
  "schema_version": 1,
  "document_id": "general-settings.confirmed-ai-configuration",
  "product_id": "general-settings",
  "kind": "feature",
  "revision": 1,
  "document_status": "draft",
  "implementation": {
    "status": "implemented",
    "notes": "AI-28 integra cuatro puertos internos y revisión Client de configuración no secreta; verificación de laboratorio y límites en74. No publica MCP ni acredita aceptación Gemini."
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento de Ajustes Generales y NodiaAI conforme AGENTS",
  "sources": [
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
    }
  ],
  "verification": {
    "checked_on": "2026-10-17",
    "evidence_paths": [
      "docs/mvp/74-nodia-ai-ai28-provider-configuration.md",
      "docs/evidence/nodia-ai-ai28-client-validation.json",
      "docs/evidence/nodia-ai-ai28-validation.json",
      "docs/evidence/nodia-ai-ai28-postgresql.json",
      "docs/evidence/nodia-ai-ai28-regressions.json",
      "docs/evidence/nodia-ai-ai28-ui-validation.json"
    ],
    "notes": "Laboratorio privado:2893 pruebas Server,1589 Client,432 checks SQL/HTTP/procesos y2 suites adicionales,9 QA sintéticas;69 ejecutores,851 dist idénticos, esquema18/241 conservado. Sync remoto del chat, publicación MCP y aceptación Gemini pendientes; no aprobación documental."
  },
  "approval": null
}
---

# Configuración IA confirmada — contexto funcional para NodiaAI

## Qué resuelve

Crear/editar instancias de conexiones y catálogo IA mediante propuesta no secreta, confirmación exacta y escritores nativos. [Entrega74](../../../../mvp/74-nodia-ai-ai28-provider-configuration.md) separa configuración global de selección del chat. Configuración, autenticación, disponibilidad e inferencia son hechos diferentes.

## Solicitudes y aclaraciones

«Crea una conexión para este catálogo» requiere resolver catalog_id real, no clave/nombre ambiguos. «Cambia el modelo de Web» exige identificar instancia, modo y modelo permitido; preguntar cuando falten. «Activa Agentic» cambia un flag configurable y no acredita que funcione. «Haz esta conexión predeterminada» debe mostrar los predeterminados previos. «Agrega una API key» debe abrir el futuro canal seguro de AI-29; nunca recibir secretos en el modelo.

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
