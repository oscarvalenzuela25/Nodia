---
{
  "schema_version": 1,
  "document_id": "nodia-ai.conversation-persistence",
  "product_id": "nodia-ai",
  "kind": "feature",
  "revision": 2,
  "document_status": "draft",
  "implementation": {
    "status": "implemented",
    "notes": "Persistencia M1; AI-10 añade API y retención. Worker/contexto avanzados en AI-11/12 sin aceptación real ni publicación."
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento NodiaAI conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/55-nodia-ai-ai09-conversation-persistence.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/migrations/1792200000000-CreateNodiaAiConversationPersistence.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-conversation/use-case/create-nodia-ai-conversation.use-case.ts",
      "kind": "implementation"
    }
  ],
  "verification": {
    "checked_on": "2026-10-15",
    "evidence_paths": [
      "docs/evidence/nodia-ai-ai09-persistence-validation.json"
    ],
    "notes": "Verificación PostgreSQL/DI/contratos aislada, no despliegue o disponibilidad de un proveedor."
  },
  "approval": null
}
---

# Persistencia inicial y contratos de conversación

[Producto](../README.md). [Entrega55](../../../../mvp/55-nodia-ai-ai09-conversation-persistence.md).

## Qué resuelve

Conservar la identidad e historia de un chat en Nodia, independientemente de la pestaña o proveedor. Once tablas M1 agrupan conversación, turnos y runtime; no replican BD de productos ni habilitan herramientas.

## Operaciones y datos mínimos

Un puerto interno crea un chat propio con client_request_id UUIDv4; título y selección son opcionales. Sin selección no se inventa un modelo. Misma clave/entrada recupera el chat; otra entrada produce conflicto. El dueño procede de una sesión vigente con acceso a NodiaAI. [AI-10](chat-admission-retention.md) incorpora siete rutas de coordinación reales, verificadas localmente; no implica despliegue productivo.

## Reglas y autoridad

Revisiones positivas, bigint como cadena y fecha UTC. Vencimiento inicial90 días desde creación, renovado únicamente por mensaje nuevo del dueño en AI-10. Super_admin no suplanta al dueño para crear. Proyecciones cerradas excluyen identidad técnica de sesión, grants, hashes y payload privado.

## Routing y uso de herramientas

Web es conversacional. La preferencia para delegar a Agentic está apagada inicialmente y tiene revisión/destino exacto de la misma conexión. Esfuerzo/modelo son dinámicos y los snapshots separan base de etapa. Presupuesto del run no se reinicia al delegar. DTOs y constraints no demuestran elegibilidad o dispatch: AI-11/12 implementarán los mecanismos y sólo después se publicarán.

## Retención y fallos

Mensajes y auditoría del chat se borrarán con él; trabajos inciertos y slots conservan datos mínimos hasta conciliar, sin replay. Datos de negocio/preferencias independientes no se borran por el chat. Un paquete de política ausente o corrupto impide inicializar el módulo, sin defaults. Eliminación de una conexión conserva selección histórica indisponible, sin reemplazar proveedor.

## Estado de integración

Draft/unregistered; ningún MCP publicado. [AI-10/56](../../../../mvp/56-nodia-ai-ai10-admission-retention.md) incorpora admisión/retención/listados/mensajes; [worker](durable-worker.md) y [contexto](context-execution.md) avanzan aisladamente. Runtime real, interfaz y aceptación integral siguen pendientes.
