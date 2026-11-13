---
{
  "schema_version": 1,
  "document_id": "general-settings.ai-connection-settings-ui",
  "product_id": "general-settings",
  "kind": "feature",
  "revision": 1,
  "document_status": "draft",
  "implementation": {
    "status": "partial",
    "notes": "Presentation and authenticated observation fixes implemented locally; no new tool, deployment or provider qualification."
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento de Ajustes Generales conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/ai-provider-feature-contract.md",
      "kind": "specification"
    },
    {
      "path": "nodia-client/src/modules/generalSettings/pages/AiProviders/components/ProviderDetail/ProviderDetail.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/generalSettings/pages/AiProviders/components/CodexSessionPanel/CodexSessionPanel.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/generalSettings/pages/AiProviders/infrastructure/useServices.ts",
      "kind": "implementation"
    }
  ],
  "verification": {
    "checked_on": "2026-11-12",
    "evidence_paths": [
      "docs/evidence/ai-provider-ui-state-20261112-r01.json"
    ],
    "notes": "Synthetic HTTP/component tests and browser fixture; production OAuth, backend configuration and real provider availability not established."
  },
  "approval": null
}
---

# Ajustes de conexión IA: modelos ausentes y consulta de estado

Una conexión puede existir sin modelos disponibles. En Gemini, Agentic/API key
ocultan los controles de potencia cuando no hay modelos, conservando preferencias
guardadas para una configuración posterior. Un catálogo o una preferencia no
acreditan autenticación, soporte de razonamiento o inferencia.

La recarga dentro del aviso Codex consulta estado; su tooltip y nombre accesible
explican la acción. No conecta una cuenta ni habilita un runtime. Un runtime
indisponible mantiene Conectar bloqueado hasta una observación disponible.

Las consultas protegidas esperan autenticación Nodia validada. Los 401/403 no se
reintentan mediante sondeo periódico; la persona debe recuperar sesión/permisos
o consultar explícitamente. Un 503 mantiene el error del servicio, sin fingir una
sesión vacía o una reparación. La UI no instala conexiones en el VPS.

| Solicitud | Interpretación y límite |
| --- | --- |
| «¿Por qué no veo los niveles de potencia?» | Gemini no tiene modelos disponibles; consultar/sincronizar según el estado real, sin inventar un modelo |
| «Volver a comprobar estado» | Lectura del estado, sin login ni inferencia |
| «Conecta aunque el runtime no esté disponible» | Informar la indisponibilidad y revisar el servidor; la UI no evita ese requisito |

No añade herramientas o autoridad NodiaAI. Las capacidades existentes conservan
su catálogo y confirmación; esta ficha es candidata draft/unregistered, sin
publicación ni aprobación nueva. Las fichas publicadas de conexiones/salud se
conservan byte a byte. Ver [contrato vigente](../../../../mvp/ai-provider-feature-contract.md)
y [evidencia local](../../../../evidence/ai-provider-ui-state-20261112-r01.json).
