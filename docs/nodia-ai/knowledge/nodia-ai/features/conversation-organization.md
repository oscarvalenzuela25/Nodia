---
{
  "schema_version": 1,
  "document_id": "nodia-ai.conversation-organization",
  "product_id": "nodia-ai",
  "kind": "feature",
  "revision": 3,
  "document_status": "draft",
  "implementation": {
    "status": "implemented",
    "notes": "Organización de historial y borradores de texto limitados a actor/chat/pestaña. Recuperación tras recarga/remount y cancelar drawer aceptada en Vite autenticado. Requiere GET fresco por montaje/actor/sesión/chat/resume; no guarda archivos ni restaura intenciones inciertas. Entrega compilada y variantes reales de sesión/autoridad/retención conservan pendientes."
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
    },
    {
      "path": "nodia-client/src/modules/nodiaAi/infrastructure/conversationDrafts.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/nodiaAi/infrastructure/useConversationDraft.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/config/nodiaAiDraftStorage.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/nodiaAi/infrastructure/useServices.ts",
      "kind": "implementation"
    }
  ],
  "verification": {
    "checked_on": "2026-10-23",
    "evidence_paths": [
      "docs/evidence/nodia-ai-ai35-unit-validation.json",
      "docs/evidence/nodia-ai-ai35-sql-validation.json",
      "docs/evidence/nodia-ai-ai35-browser-qa.json",
      "docs/evidence/nodia-ai-ai40-implementation-r03.json",
      "docs/evidence/nodia-ai-ai40-draft-browser-r01.json",
      "docs/evidence/nodia-ai-ai40-native-images-r01.json"
    ],
    "notes": "Continuación real AI-40:73 unidades y54 regresiones existentes Client, lint/tipado/build finales correctos. Borrador exacto tras recarga/remount y cancelar drawer en Vite autenticado; restauración exige lectura fresca por montaje/actor/sesión/chat/resume. PNG/JPEG/WebP completan tres probes semánticos con cuenta real, terminal/ACK y staging limpio, sólo en candidato Linux aislado. Sin adopción, aprobación o publicación; no acredita upload R2/admisión/worker/UI de imágenes. PDF/audio y gates restantes conservan sus pendientes."
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

## Continuidad del texto sin enviar — AI-40

El texto aún no enviado puede recuperarse en la misma pestaña después de renovar la sesión o remontar/recargar el chat. La copia es prescindible y sólo se restaura después del detalle autorizado, editable y vigente; no sustituye la conversación de Server. Cada actor/chat queda aislado. No contiene adjuntos, transcripciones, credenciales, mensajes ya enviados ni identidades de admisión.

El máximo persistido son32KiB UTF-8 del contrato de admisión. Un exceso editable o almacenamiento denegado conserva únicamente la memoria de la instancia. Un error de cuota intenta retirar la copia antigua para no restaurar texto obsoleto. Logout/cambio de actor purgan el namespace incluso antes de cargar el módulo; renovar el mismo actor conserva el borrador.

Antes de admitir un mensaje se retira la copia restaurable. Un envío incierto conserva el mecanismo explícito de conciliación vigente, sin convertirse en otro envío después de un remount. Una respuesta rechazada de una instancia desmontada no puede sobrescribir un borrador posterior. La expiración se comprueba al cargar/reanudar y mientras el chat está montado; no se promete borrado físico por un navegador cerrado/suspendido ni almacenamiento offline autoritativo. Bajo SecurityError, la limpieza del almacenamiento es best-effort.

Decisión y límites en [ADR-074](../../../../architecture/decisions/ADR-074-tab-scoped-unsent-chat-drafts.md) y [AI-40](../../../../mvp/86-nodia-ai-ai40-codex-acceptance.md). Pruebas atómicas y build no acreditan por sí solos el recorrido de navegador real.


### Continuación verificada: borrador y formatos nativos

La [aceptación de navegador](../../../../evidence/nodia-ai-ai40-draft-browser-r01.json) verifica recuperación exacta de texto sin enviar tras recarga/remount, cancelación del drawer y aislamiento frente a otro chat, sin enviarlo. La restauración exige un GET posterior al montaje, cambio de actor/sesión/chat o reanudación; caché o lecturas canceladas no acreditan acceso. Un fallo transitorio preserva texto ya autorizado en la misma época, bloqueando acciones; una denegación lo retira.

Los [tres probes de imágenes](../../../../evidence/nodia-ai-ai40-native-images-r01.json) aceptan PNG/JPEG/WebP por semántica/terminal/ACK en un candidato aislado con la cuenta real. Esto no adopta el paquete en R03 ni acepta imagen desde UI/R2/admisión/worker o MCP combinado; PDF/audio siguen pendientes. La [entrega86](../../../../mvp/86-nodia-ai-ai40-codex-acceptance.md#aceptación-2026-10-23--borrador-en-navegador-e-imágenes-codex-reales) conserva scope y gates, sin aprobación o publicación nuevas.

## Evaluación de impacto visual — 2026-10-27

Por solicitud del usuario, el encabezado NodiaAI usa la fuente existente del logotipo y retira su subtítulo. La búsqueda conserva su comportamiento con la lupa al final. Una flecha junto a «Conversaciones» muestra u oculta los filtros adicionales de archivado, ámbito autorizado y sólo fijadas, inicialmente plegados; este último usa un switch. Plegar no limpia los filtros ni cambia los resultados. Búsqueda, selecciones y estado de expansión viven fuera de la representación móvil/escritorio.

El ajuste afecta presentación y descubrimiento de controles, sin cambiar conceptos funcionales, operaciones, herramientas, permisos ni confirmaciones. No requiere una ficha o binding nuevos; esta ficha conserva su estado draft/unregistered y no modifica las seis revisiones aprobadas. La evidencia de verificación se registra en [ajustes de cabecera e historial](../../../../evidence/nodia-ai-sidebar-ui-r01.json).

### Ajuste del encabezado — 2026-10-28

Por solicitud del usuario, el encabezado visible pasa a «Nodia AI», con espacio, y utiliza el mismo degradado del logotipo (tokens primary→tertiary/secondary del tema). Conserva su fuente, semántica h1 y tamaño responsive. Sólo presentación: sin cambios de contexto funcional, contratos, herramientas, permisos o confirmaciones; sin publicación de esta ficha. [Evidencia de verificación](../../../../evidence/nodia-ai-title-ui-r01.json).
