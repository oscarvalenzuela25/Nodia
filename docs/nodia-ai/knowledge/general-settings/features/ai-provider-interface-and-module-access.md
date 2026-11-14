---
{
  "schema_version": 1,
  "document_id": "general-settings.ai-provider-interface-and-module-access",
  "product_id": "general-settings",
  "kind": "feature",
  "revision": 3,
  "document_status": "draft",
  "implementation": {
    "status": "partial",
    "notes": "Implementación local de interfaz, navegación/autorización y preferencias por proveedor. Backend comprobado por alcance; build/lint Client, ProviderDetail38/helper5 y QA visual correctos; suite global Client consolidada: 2812 casos/349 archivos, dos fixtures de Home corregidos y revalidados; ProviderDetail38 separado. Sin despliegue ni inferencia real de este lote. Continuación local2026-11-14: razonamiento recuperable desde catálogo real por conexión, metadatos advisory preservados, alta y navegación corregidas. Decisión funcional explícita: Teacher permite primera generación sin canary previo; conserva selección exacta, disponibilidad no generativa, autoridad, presupuesto y recuperación. Sin despliegue, inferencia real o publicación de este lote."
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento de Ajustes Generales y NodiaAI conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/ai-provider-feature-contract.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/89-module-access-and-user-data-scope.md",
      "kind": "specification"
    },
    {
      "path": "nodia-client/src/store/generalSettings/helpers.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/store/generalSettings/useGeneralSettings.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/generalSettings/pages/AiProviders/infrastructure/modelCards.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/generalSettings/pages/AiProviders/infrastructure/syncModelSelection.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/utils/modelVariantOptions.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/nodiaAi/components/ComposerSelection/ComposerSelection.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/nodiaAi/components/ConfigurationDrawer/ConfigurationDrawer.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/common/ai/api-reasoning.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/ai-provider/helpers/model-observation.helper.ts",
      "kind": "implementation"
    }
  ],
  "verification": {
    "checked_on": "2026-11-14",
    "evidence_paths": [
      "docs/mvp/ai-provider-feature-contract.md",
      "docs/evidence/model-selector-residual-audit-20261114.md",
      "docs/evidence/teacher-ai-selection-first-generation-20261114.md"
    ],
    "notes": "Build Server, autorización60, HTTP74 y API249 correctos; HTTP con fronteras sintéticas de sesión/persistencia. build/lint Client, ProviderDetail38/helper5 y QA visual correctos; suite global Client consolidada: 2812 casos/349 archivos, dos fixtures de Home corregidos y revalidados; ProviderDetail38 separado; sin publicación, inferencia real ni causa productiva de acceso probada. Continuación local2026-11-14: razonamiento recuperable desde catálogo real por conexión, metadatos advisory preservados, alta y navegación corregidas. Decisión funcional explícita: Teacher permite primera generación sin canary previo; conserva selección exacta, disponibilidad no generativa, autoridad, presupuesto y recuperación. Sin despliegue, inferencia real o publicación de este lote."
  },
  "approval": null
}
---

# Interfaz de proveedores, variantes y acceso a NodiaAI

## Preservación de opciones Codex — 2026-11-14

La lectura sanitizada de configuración conserva `supportedReasoningEfforts`
válidos como opciones advisory. Antes podía eliminarlos y un guardado posterior
perdía esos metadatos persistidos, bloqueando el selector Teacher. Se mantienen
fuera de esa proyección las cuotas/capacidades no comprobadas; conservar opciones
no demuestra inferencia. Teacher puede observar opciones vivas de su conexión
sin permisos de administración, activación de modelos o cambios de configuración.
Su [primera generación sin canary previo](../../../../mvp/96-nodia-teacher-implementation-plan.md#43-alta-de-estudio-razonamiento-recuperable-y-menú-persistente--2026-11-14)
es una decisión específica de Teacher, no un cambio del chat NodiaAI.

## Continuación local: selectores agrupados — 2026-11-14

Sincronización y sus roles, el compositor y la configuración del chat presentan
una opción por familia Gemini Agentic inequívoca y un selector de razonamiento.
La activación conserva todas las variantes reales en el catálogo; elegir esfuerzo
cambia sólo al ID explícito correspondiente. OCR conserva su ID y preferencia
efectiva, incluso si antes heredaba la preferencia general. Quitar OCR envía
`null`; el guardado del modo evita reenviar mapas raíz sin merge.

Un rol nuevo agrupado requiere esfuerzo explícito. Las contradicciones
históricas se muestran sin repararse al leer. El chat exige elegibilidad de la
tupla exacta antes de aplicar. Teacher reutiliza el algoritmo común sin cambiar
su contrato. Error de guardado conserva el borrador; vacío, descubrimiento
inválido/caído, doble envío y cambios de contexto están cubiertos por regresiones.

[Evidencia local](../../../../evidence/model-selector-residual-audit-20261114.md):
suite global2912, regresiones finales29 y helper/Teacher/chat41 correctos;
build/tipos y lint del código correctos; Chromium sintético320/600/1280 sin
overflow y con Medium principal/High OCR conservados al redimensionar.
El lint general conserva un error en un experimento previo ignorado. Sin
inferencia, aceptación operativa, publicación o aprobación documental nueva.

## Qué resuelve y qué significa

Este lote local facilita gestionar sesiones/modelos y distingue la preferencia de razonamiento de la capacidad realmente comprobada. El menú se obtiene del contexto del actor actual; la asignación NodiaAI sigue siendo obligatoria para usuarios ordinarios. La excepción del super_admin activo se conserva según [política89](../../../../mvp/89-module-access-and-user-data-scope.md).

Las acciones modificadas de gestionar/conectar/desconectar cuenta, autorización oficial, comprobar estado y sincronizar modelos usan contained. Es un ajuste visual: no cambia confirmaciones, disponibilidad, permisos ni contratos, y no añade herramientas.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención | Aclaración o límite |
|---|---|---|
| «¿Qué modelo y esfuerzo tengo configurados?» | Consultar configuración autorizada | Identificar conexión y modo; no deducir que una inferencia funcionará. |
| «Quiero cambiar el esfuerzo» | Configurar preferencia | Aclarar proveedor, conexión, modo y modelo exactos; usar el flujo existente de preparación/confirmación cuando corresponda. |
| «Cambia la variante Gemini sin tocar OCR» | Elegir variante del catálogo | Conservar la selección OCR independiente; sólo IDs reales de la tarjeta. |
| «Déjame entrar a NodiaAI sin tener el módulo» | Solicitar acceso | Remitir a asignación administrativa; la conversación no concede acceso. Se conserva el bypass super_admin vigente. |
| «Usa Ultra con API» | Preferencia no admitida | Explicar que API lo deshabilita/rechaza; no sustituir automáticamente esfuerzo, modelo, proveedor o modo. |

## Operaciones y contratos

| Operación semántica | Efecto | Contrato/estado real |
|---|---|---|
| Mostrar navegación del actor | Lectura del contexto | Consulta existente `GET /authorization/context`, identificada por usuario; ninguna herramienta nueva. |
| Entrar al chat | Acceso a la página y peticiones protegidas | Guard Client más guardas HTTP/dominio Server; asignación actual, sesión y actividad conforme89. |
| Elegir variante o preferencia | Modificar configuración por el flujo existente | Conserva modelo/conexión/modo exactos, confirmación e invariantes del [contrato de proveedores](../../../../mvp/ai-provider-feature-contract.md); esta ficha no registra una operación ejecutable. |
| Gestionar login/desconexión | Flujo seguro existente | Autorización oficial y confirmaciones existentes; nunca pedir tokens, claves ni códigos en el chat. |

La consulta de catálogo puede contactar al proveedor; no es una inferencia. Este lote no emite inferencias reales ni amplía presupuestos o permisos.

## Datos mínimos y resolución de dudas

| Dato | Significado | Resolución |
|---|---|---|
| Actor y módulo | Identidad de sesión, `nodia_ai` y destino `/nodia-ai` | Consulta del actor actual y validación Server. Nombre/grupo/prefijo no son autoridad. |
| Conexión, modo y modelo | Selección exacta de configuración | Deben ser explícitos; catálogo dinámico, sin IDs por defecto inventados. |
| Variantes Gemini Agentic | Variantes explícitas low/medium/high de una familia inequívoca | Agrupar sólo si etiqueta e ID real corresponden; casos ambiguos siguen planos. |
| Modelo OCR | Referencia independiente de la preferencia del chat | Se conserva al elegir esfuerzo; mostrar la variante OCR exacta si difiere. |
| Esfuerzo API | Preferencia de protocolo, no capacidad calificada | OpenAI low/medium/high/xhigh/max; Gemini low/medium/high. Ultra API no admitido. |

## Reglas, acceso y restricciones

El usuario ordinario necesita una coincidencia única del destino canónico y la clave exacta `nodia_ai`; claves parecidas y destinos ambiguos no autorizan. El super_admin activo conserva su bypass sin inventar recursos válidos. La sesión/contexto inexistente no muestra módulos; renombrar o mover grupos no crea asignaciones.

La navegación usa la consulta del actor actual. Su caché no concede autoridad ni promete revocación visual inmediata: el Server comprueba las peticiones protegidas contra la asignación/actividad actuales incluso con un token aún válido. No se afirma haber probado la causa productiva del síntoma original.

Agrupar tarjetas es presentación. El esfuerzo selecciona únicamente un ID real del mismo grupo; no fabrica un modelo base. La elección local de una tarjeta aún no seleccionada no cambia silenciosamente el modelo activo. Las contradicciones con preferencias históricas se advierten, sin corregirlas silenciosamente. OCR conserva su referencia propia.

OpenAI API acepta xhigh/max como preferencias; el proveedor puede rechazarlas para un modelo concreto. Ultra API está deshabilitado y Server lo rechaza. No hay degradación o cambio de modelo/modo automáticos. Catálogo, login, clave y configuración guardada no acreditan disponibilidad ni inferencia por modelo/modalidad/entorno; se mantiene [plan91](../../../../mvp/91-ai-provider-onboarding-verification.md).

## Filtros e informes

No añade informes, métricas, cuotas, fechas operativas ni agregaciones. Las tarjetas representan el catálogo recibido; no deducen capacidades por nombres ni completan datos ausentes.

## Vista previa, confirmación y recuperación

Se reutilizan los flujos existentes de configuración y desconexión, con estados ocupados, confirmaciones y manejo de errores. Este lote no amplía herramientas o efectos y no altera la confirmación humana exacta de propuestas. No repetir inferencias de resultado incierto ni cambiar silenciosamente la selección al recuperar un error.

## Integración y evidencia

- [x] Fuentes/implementación contrastadas; candidato draft, partial, unregistered y approval:null.
- [x] Build Server, 60 regresiones de autorización, 74 comprobaciones HTTP y 249 regresiones API correctas; HTTP aislado con fronteras sintéticas de sesión/persistencia.
- [x] Consolidada la suite global Client: 2812 casos/349 archivos; dos fixtures de Home corregidos y revalidados (Home5 + hook7). ProviderDetail38 separado, 2850 casos únicos verificados. Build/lint y QA Chromium320/1280 correctos; detalles en [verificación consolidada](../../../../mvp/ai-provider-feature-contract.md#verificación-consolidada-de-preferencias-y-acceso--2026-11-12).
- [ ] Despliegue y aceptación operativa de este lote, si se solicitan posteriormente.
- [ ] Calificación real de inferencia por selección conforme91; no solicitada ni consumida en este lote.

Ninguna ficha aprobada cambia por esta candidata. El refresco técnico de pins existentes preserva IDs/revisiones/esquemas/permisos y documentos aprobados; no equivale a aprobación documental o publicación de esta ficha.

## Evolución y compatibilidad

| Revisión | Cambio | Compatibilidad |
|---|---|---|
| 2 | Agrupación en sincronización/compositor/configuración y auditoría de residuos; OCR efectivo, borrador y contexto protegidos | IDs literales y elegibilidad exacta; sólo candidato local, sin publicación o inferencia. |
| 1 | Interfaz contained, contexto del actor, identidad NodiaAI y preferencias/variantes por proveedor | Reutiliza operaciones y permisos; IDs reales y OCR conservados. Sin nuevos bindings, aprobación, publicación o inferencia. |
