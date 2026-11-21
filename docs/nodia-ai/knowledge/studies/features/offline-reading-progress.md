---
{
  "schema_version": 1,
  "document_id": "studies.offline-reading-progress",
  "product_id": "studies",
  "kind": "feature",
  "revision": 4,
  "document_status": "draft",
  "implementation": {
    "status": "implemented",
    "notes": "PWA-006 publicado. Guardado offline, reintento y ambas decisiones de conflicto verificados con una lección sintética en dos perfiles de Chrome para Windows. La interfaz permite volver al bloque guardado y comparar los dos puntos."
  },
  "integration_status": "not_applicable",
  "maintainer": "Mantenimiento de Estudios y NodiaAI conforme AGENTS",
  "sources": [
    { "path": "docs/mvp/103-pwa-progressive-implementation-plan.md", "kind": "specification" },
    { "path": "docs/mvp/97-nodia-teacher-technical-contracts.md", "kind": "specification" },
    { "path": "docs/architecture/decisions/ADR-115-teacher-offline-reading-sync.md", "kind": "specification" },
    { "path": "nodia-server/src/teacher/use-case/execute-teacher-command.use-case.ts", "kind": "implementation" },
    { "path": "nodia-client/src/modules/teacher/infrastructure/offlineStudy.ts", "kind": "implementation" },
    { "path": "nodia-client/src/modules/teacher/infrastructure/syncOfflineReading.ts", "kind": "implementation" },
    { "path": "nodia-client/src/modules/teacher/offline/readingProgressView.ts", "kind": "implementation" }
  ],
  "verification": {
    "checked_on": "2026-11-21",
    "evidence_paths": ["docs/mvp/103-pwa-progressive-implementation-plan.md", "nodia-server/test/teacher-domain.integration.mjs"],
    "notes": "El piloto publicado verificó reapertura sin red, reintento y confirmación, conflicto con ambos puntos y las dos decisiones en Chrome para Windows. El ensayo HTTPS local con Server y PostgreSQL 16 comprobó la idempotencia al repetir el mismo PATCH. El laboratorio con API de prueba verificó recuperación de una respuesta perdida y separación al cambiar de cuenta."
  },
  "approval": null
}
---

# Punto de lectura de Teacher sin conexión — candidata

[Estudios](../README.md) · [Material descargado](offline-study-material.md) · [PWA-006](../../../../mvp/103-pwa-progressive-implementation-plan.md#8-pwa-006--escrituras-offline-y-sincronización)

## Qué resuelve y qué significa

**Guardar punto de lectura** registra el bloque seleccionado de una lección
descargada. El punto se conserva cifrado bajo la cuenta y sesión que guardaron
la copia, con la misma vigencia. Al recuperar la conexión con Teacher o el
lector abiertos y la sesión vigente, se consulta el recibo del envío y se
sincroniza la posición. La persona también puede reintentar desde el lector.
**Ir al punto de lectura** vuelve al bloque marcado. En un conflicto, el
lector identifica el origen de cada punto antes de ofrecer la elección.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Tratamiento |
| --- | --- |
| «Quiero volver al resumen que marqué sin internet» | El lector muestra el punto guardado y distingue el pendiente de la confirmación del servidor. |
| «Marqué dos lugares distintos en el teléfono y el PC» | Si el punto difiere del servidor, el lector permite elegir **Usar este punto** o **Conservar el del servidor**. |
| «No sé si se guardó, se cortó la red» | El envío pendiente conserva el identificador para consultar su recibo y recuperar el resultado sin repetir el efecto. |

## Alcance y autoridad

Server verifica la sesión actual, el acceso a Teacher, la pertenencia del
estudio y las versiones de material y cursor. Al coincidir con un punto ya
guardado, el lector confirma el resultado existente. Al elegir el punto local
después de un conflicto, Server vuelve a comprobar la revisión. La actividad
abarca el cursor de lectura y la visita a ese bloque. La práctica y las
evaluaciones mantienen su flujo online. Esta ficha es documental. La acción
la ejecuta la persona desde Teacher.
