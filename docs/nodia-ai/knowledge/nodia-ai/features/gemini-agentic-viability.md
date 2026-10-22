---
{
  "schema_version": 1,
  "document_id": "nodia-ai.gemini-agentic-viability",
  "product_id": "nodia-ai",
  "kind": "feature",
  "revision": 3,
  "document_status": "draft",
  "implementation": {
    "status": "partial",
    "notes": "spike Agentic/MCP verificado; adaptador/runtime productivo pendiente"
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento del módulo NodiaAI conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/49-nodia-ai-ai03-gemini-agentic-viability.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/48-nodia-ai-mode-routing-policy.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/45-nodia-ai-implementation-plan.md",
      "kind": "specification"
    }
  ],
  "verification": {
    "checked_on": "2026-10-14",
    "evidence_paths": [
      "docs/evidence/nodia-ai-ai03-gemini-agentic-viability.json"
    ],
    "notes": "Informe, investigación local2026-10-14 Aprobación documental anterior: Pendiente"
  },
  "approval": null
}
---

# Evaluación de Gemini Agentic y MCP

[Producto](../README.md). Metadatos canónicos migrados en [AI-06](../../../../mvp/52-nodia-ai-ai06-knowledge-publication-contract.md); esta revisión no cambia el estado de aprobación ni publica capacidades.

## Propósito y límites

El spike comprobó lectura/preparación MCP con cuenta y modelo configurados, continuación entre procesos y recuperación canónica;25 checks y dos callbacks.18 checks independientes verifican shell denegado sin efecto y cancelación antes de callbacks, sin hijos CLI/MCP;14 recuperan valores aleatorios de historia sintética en perfil nuevo.175 pruebas aisladas pasan. Sigue `unregistered`: no anunciar herramientas de negocio disponibles ni habilitar alternancia por cuenta/catálogo solos.

## Autoridad y efectos

Herramientas de producción requieren ToolGateway, autoridad de actor/módulo/recurso y schemas. Los dos fixtures del ensayo no usan BD ni executor; preparar no confirma. El switch de política48 sólo autoriza delegación a un destino verificado, no escrituras. Solicitudes SQL/HTTP/confirmación o acceso I/O ajeno se rechazan. Las pruebas aisladas de esas fronteras no acreditan aislamiento total del runtime externo.

## Selección, contexto y recuperación

Modelo/esfuerzo exactos del modo Agentic, sin herencia Web/fallback. El CLI1.3.1 observado usa dispatcher call_mcp_tool y envía argumentos MCP serializados; el adaptador del ensayo los decodifica una vez con parsing/DTO cerrados, mediante compatibilidad explícita del supervisor. Continuidad por ID necesita su perfil; historia canónica tiene prueba independiente en perfil nuevo. Adapter_states no activado. Unknown históricos/cancelación se conservan sin replay; la prueba no cubre efectos de negocio confirmados. Sesión/perfil/credenciales nativas se administran fuera del modelo y las herramientas.

## Evolución

Registrar backend/contexto/ToolGateway antes de publicar; presupuestos globales, grants, admisión OCR/login y ciclo de perfiles pendientes AI-04/12. La compatibilidad de wire se revalida por binario/versión y no cambia schemas del dominio. Separar pruebas sintéticas, cuenta real/VM y aceptación Windows/VPS. No debilitar policy OCR ni copiar perfiles/credenciales a fixtures. Los ensayos de inyección no observados se descartaron; no son prueba de bloqueo.
