---
{
  "schema_version": 1,
  "document_id": "nodia-ai.conversation-organization",
  "product_id": "nodia-ai",
  "kind": "feature",
  "revision": 1,
  "document_status": "draft",
  "implementation": {
    "status": "implemented",
    "notes": "AI-35 incorpora organización del historial, búsqueda literal autorizada e interacción final. Pruebas de componentes/casos de uso y navegador sintético; ver entrega para distinguir activación de aceptación productiva."
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento NodiaAI conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/81-nodia-ai-ai35-conversation-organization.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/50-nodia-ai-ai04-runtime-policy.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/nodia-ai-conversation/nodia-ai-conversation.service.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/nodiaAi/pages/NodiaAI/NodiaAI.tsx",
      "kind": "implementation"
    }
  ],
  "verification": {
    "checked_on": "2026-10-18",
    "evidence_paths": [
      "docs/evidence/nodia-ai-ai35-unit-validation.json",
      "docs/evidence/nodia-ai-ai35-sql-validation.json",
      "docs/evidence/nodia-ai-ai35-browser-qa.json"
    ],
    "notes": "Casos de uso, componentes y QA sintética verifican organización, errores, acceso y borradores. PostgreSQL desechable comprueba47casos; la entrega81 distingue suites finales, activación y límites. Sin inferencia Gemini nueva, publicación MCP ni aprobación documental."
  },
  "approval": null
}
---

# Organización e interacción del chat

[Producto](../README.md) · [Entrega AI-35](../../../../mvp/81-nodia-ai-ai35-conversation-organization.md).

## Qué resuelve

Organiza conversaciones existentes sin modificar los datos de negocio ni renovar su plazo de conservación. Renombrar cambia su título; fijar permite encontrarlas con el filtro de fijadas; archivar las aparta del listado activo. No borra mensajes. Carpetas y acceso mediante globo global quedan fuera de v1.

## Solicitudes y operaciones

«Busca mi conversación sobre reservas» corresponde a la búsqueda del historial; no equivale a consultar las reservas reales. «Archiva esta conversación» debe identificar el chat exacto y usar los controles de su historial. No existe una herramienta MCP nueva que permita al modelo organizar chats ni confirmarse sus propios cambios. «Borra toda la historia de otros usuarios» no es una operación ofrecida por estos controles.

Las rutas existentes GET de conversaciones y PATCH de metadatos aplican el contrato de coordinación41. El frontend aporta la revisión esperada y únicamente el título o indicador solicitado. El caso de uso del backend valida dueño, permisos, revisión y ausencia de ejecución activa. Una conversación ajena observada por super_admin sigue de sólo lectura. Los DTOs existentes definen el resto del contrato; no se replica aquí su estructura completa.

## Datos mínimos, filtros y acceso

Se necesita un chat identificable y una revisión actual. El título es opcional: vacío vuelve a «Conversación sin título»; admite256 bytes UTF-8. Los filtros combinan texto literal, archivado, fijadas y ámbito propio/global autorizado. La búsqueda sólo incluye título y partes textuales visibles de mensajes del dueño o del asistente con scope válido. Excluye archivos, transcripciones, interpretaciones, herramientas, resúmenes compactados y preferencias. No ofrece agregados ni informes financieros desde este índice. El listado es paginado por updated_at/id y puede moverse ante cambios concurrentes.

## Confirmación y recuperación

El usuario guarda el título o confirma el cambio concreto de fijado/archivo. Ante fallo se conserva el formulario; revisar la versión vigente no reemplaza el texto editado. Otro clic explícito aplica el cambio con la revisión observada. No replay automático. Un rechazo de acceso retira datos privados y cancela lecturas pendientes; un error temporal conserva contenido anterior con feedback y reintento.

Los borradores sobreviven a cambios de breakpoint y a colapsar propuestas ya abiertas. La actividad oculta suspende lecturas/polling y revalida al abrir. Cargar mensajes antiguos conserva la posición de lectura; una respuesta parcial se identifica como tal. No hay garantía nueva de streaming ni cambio de los canales de confirmación de efectos.

## Integración y evidencia

Interfaz ES/EN, pruebas de casos de uso/componentes y QA sintética con página real. El índice PostgreSQL se ensaya con migraciones y corpus desechable; la activación y los límites medidos se documentan en la entrega. Esta ficha permanece draft/unregistered: no publica herramientas, permisos ni garantías productivas. La retención sigue contando90 días desde el último mensaje del dueño; organizar no la reinicia.
