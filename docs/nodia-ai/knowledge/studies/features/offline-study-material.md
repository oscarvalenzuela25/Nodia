---
{
  "schema_version": 1,
  "document_id": "studies.offline-study-material",
  "product_id": "studies",
  "kind": "feature",
  "revision": 3,
  "document_status": "draft",
  "implementation": {
    "status": "implemented",
    "notes": "PWA-005 publicado y verificado con Chrome para Windows. La iteración del lector recupera el acceso a la copia vigente al reabrir Teacher y presenta la estructura de lectura del Markdown."
  },
  "integration_status": "not_applicable",
  "maintainer": "Mantenimiento de Estudios y NodiaAI conforme AGENTS",
  "sources": [
    { "path": "docs/mvp/103-pwa-progressive-implementation-plan.md", "kind": "specification" },
    { "path": "docs/mvp/97-nodia-teacher-technical-contracts.md", "kind": "specification" },
    { "path": "docs/architecture/decisions/ADR-114-teacher-offline-study-copies.md", "kind": "specification" },
    { "path": "nodia-server/src/teacher/use-case/read-teacher.use-case.ts", "kind": "implementation" },
    { "path": "nodia-client/src/modules/teacher/infrastructure/downloadLesson.ts", "kind": "implementation" },
    { "path": "nodia-client/src/modules/teacher/infrastructure/offlineStudy.ts", "kind": "implementation" },
    { "path": "nodia-client/src/modules/teacher/offline/reader.ts", "kind": "implementation" }
  ],
  "verification": {
    "checked_on": "2026-11-21",
    "evidence_paths": ["docs/mvp/103-pwa-progressive-implementation-plan.md"],
    "notes": "Chrome con cuentas sintéticas verificó la apertura sin red, separación al cambiar de cuenta, borrado local y revocación conocida."
  },
  "approval": null
}
---

# Material de estudio de Teacher sin conexión — candidata

[Estudios](../README.md) · [PWA-005](../../../../mvp/103-pwa-progressive-implementation-plan.md#7-pwa-005--lectura-offline-por-módulo)

## Qué resuelve y qué significa

La persona puede leer una copia de la teoría, ejemplos y resumen de una
lección ya preparada en Teacher. La copia corresponde a la versión que
guardó y permanece disponible en ese navegador durante 24 horas. La
biblioteca señala que es una **Copia descargada** y muestra su caducidad.
En Teacher, **Abrir copia descargada** reaparece si coincide la versión y la
sesión de esa copia. Si hay material nuevo, **Actualizar copia descargada**
permite reemplazarla. En el lector se conservan títulos, listas y código. Los
rótulos de enlaces e imágenes se muestran como texto.

Con el [punto de lectura sin conexión](offline-reading-progress.md) se puede
marcar un bloque de una descarga que incluya la revisión de lectura.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Tratamiento |
| --- | --- |
| «Quiero estudiar esta lección durante el viaje» | Abrir el material conectado y pulsar **Descargar para leer sin conexión**. Confirmar que aparece la opción de abrir la copia. |
| «Ya estoy sin conexión, ¿dónde está la lección?» | Abrir **Descargas de Teacher** desde el aviso de arranque o mediante su enlace guardado. Comprobar la cuenta, sesión y vigencia de la copia. |
| «¿Puedo usar la descarga desde otra cuenta?» | Cada copia se limita a la sesión y cuenta que la guardó. La segunda cuenta puede descargar sus propias lecciones autorizadas. |
| «Quiero terminar la evaluación sin conexión» | La lectura offline comprende el texto descargado. Las evaluaciones, respuestas y generación siguen su flujo en línea. |

## Operaciones y contratos

| Operación | Contrato | Resultado |
| --- | --- | --- |
| Descargar | Lectura autenticada `GET /teacher/sessions/:id/units/:unitId` con `plan_revision_id` y versión exacta. Acción local de Client. | Al terminar, copia cifrada disponible en el lector del navegador. |
| Abrir o eliminar | `/nodia-teacher/downloads` exige la concesión local de esa cuenta y sesión. | Lectura temporal o eliminación de la copia del dispositivo. |
| Actualizar la copia | Abrir la lección vigente y descargarla de nuevo. | Reemplaza la copia de esa unidad y actualiza su caducidad. |

## Reglas, acceso y restricciones

- Se pueden conservar diez copias de hasta 256 KiB. Su vigencia es de 24
  horas. La salida o el cambio de cuenta invalidan el acceso anterior.
- La sesión sin conexión sólo habilita la copia local que ya autorizó el
  servidor. Las comprobaciones operativas de permisos siguen en línea.
- El lector muestra texto y excluye interacciones, calificaciones, respuestas,
  archivos adjuntos y acciones. Consultar la versión vigente requiere red.

## Vista previa, confirmación y recuperación

La descarga se confirma tras preparar el lector y completar su escritura
local. En ese momento aparece **Abrir copia descargada**. Si vence, se borra
o el navegador retira los datos locales, se puede volver a descargar desde
la lección en línea. La biblioteca muestra el estado aunque la copia solicitada
sea de otra cuenta o de una sesión anterior.

## Integración y evidencia

La descarga y lectura son acciones del navegador de la persona. La ficha
describe el flujo de Client. El ensayo y los límites por entorno constan
en [Plan103 §7](../../../../mvp/103-pwa-progressive-implementation-plan.md#7-pwa-005--lectura-offline-por-módulo).
