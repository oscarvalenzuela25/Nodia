---
{
  "schema_version": 1,
  "document_id": "nodia-ai.chat-admission-retention",
  "product_id": "nodia-ai",
  "kind": "feature",
  "revision": 1,
  "document_status": "draft",
  "implementation": {"status": "implemented", "notes": "API y retención de texto M1 verificadas aisladamente; interfaz, adjuntos y operación productiva pendientes."},
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento NodiaAI conforme AGENTS",
  "sources": [
    {"path": "docs/mvp/56-nodia-ai-ai10-admission-retention.md", "kind": "specification"},
    {"path": "nodia-server/src/nodia-ai-conversation/nodia-ai-conversation.controller.ts", "kind": "implementation"},
    {"path": "nodia-server/src/nodia-ai-conversation/use-case/admit-nodia-ai-message.use-case.ts", "kind": "implementation"},
    {"path": "nodia-server/src/nodia-ai-conversation/use-case/expire-nodia-ai-conversations.use-case.ts", "kind": "implementation"}
  ],
  "verification": {"checked_on": "2026-10-15", "evidence_paths": ["docs/evidence/nodia-ai-ai10-ai12-validation.json"], "notes": "Nest/PostgreSQL desechable y proveedor sintético; sin inferencia real."},
  "approval": null
}
---

# Admisión y retención del chat

[Producto](../README.md). [Entrega56](../../../../mvp/56-nodia-ai-ai10-admission-retention.md).

## Qué resuelve

Crear, organizar y continuar un chat propio con mensajes durables y vencimiento independiente del navegador. Ejemplos: «renombra mi chat», «busca lo que conversamos» y «continúa esta conversación». La API de coordinación no es una herramienta de negocio ni un permiso para operar módulos.

## Operaciones y datos mínimos

Crear requiere client_request_id; título y selección son opcionales. Admitir requiere chat, UUID de mensaje, revisión esperada y partes de texto. Una selección exacta y elegible es obligatoria para generar. No se inventa un modelo. La misma clave recupera el mensaje/run original antes de observar nuevamente al proveedor; otra entrada con esa clave falla.

## Reglas y autoridad

Acceso vigente a NodiaAI y propiedad para modificar. `super_admin` inspecciona chats vivos ajenos con auditoría y no habla en nombre del dueño. Ajeno404 y propio vencido410 mientras exista. Historial restringido si su procedencia deja de estar autorizada. No hay informes combinables ni confirmaciones de cambios de negocio en estas rutas.

## Retención y recuperación

90 días desde creación o último mensaje nuevo del dueño. Duplicados, lectura, ajustes y respuesta del asistente no renuevan. El mantenimiento elimina contenido y auditoría; resultados inciertos guardan sólo identidad operacional hasta conciliar, sin reenviar. Archivos incorporados a registros de negocio son independientes; adjuntos del chat y preferencias se implementarán en sus etapas.

## Estado de integración

Draft/unregistered y sin herramienta MCP publicada. Cambiar DTOs, límites, cursores o retención exige actualizar contratos y pruebas de concurrencia/recuperación. La interfaz de chat y aceptación productiva siguen pendientes.
