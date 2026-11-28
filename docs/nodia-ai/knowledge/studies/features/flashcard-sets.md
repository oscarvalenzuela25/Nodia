---
{
  "schema_version": 1,
  "document_id": "studies.flashcard-sets",
  "product_id": "studies",
  "kind": "feature",
  "revision": 3,
  "document_status": "draft",
  "implementation": {
    "status": "implemented",
    "notes": "En la rama candidata, pertenencia obligatoria por cuenta, bajas transaccionales e importación revisable de mazos a Sets nuevos o existentes."
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento de Estudios y NodiaAI conforme AGENTS",
  "sources": [
    { "path": "docs/mvp/112-teacher-flashcards-plan.md", "kind": "specification" },
    { "path": "docs/architecture/decisions/ADR-122-teacher-required-flashcard-sets.md", "kind": "specification" },
    { "path": "nodia-server/src/teacher/teacher-flashcards.controller.ts", "kind": "implementation" },
    { "path": "nodia-server/src/teacher/use-case/teacher-flashcards.use-case.ts", "kind": "implementation" },
    { "path": "nodia-server/src/teacher/use-case/teacher-flashcard-set-import.use-case.ts", "kind": "implementation" },
    { "path": "nodia-client/src/modules/teacher/components/Flashcards/FlashcardImportDrawer.tsx", "kind": "implementation" },
    { "path": "nodia-client/src/modules/teacher/components/Flashcards/Flashcards.tsx", "kind": "implementation" }
  ],
  "verification": {
    "checked_on": "2026-11-28",
    "evidence_paths": ["docs/mvp/112-teacher-flashcards-plan.md"],
    "notes": "Nest y PostgreSQL aislado verificaron pertenencia, baja y resolución por nombre. Chromium con API sintética verificó la creación y revisión de JSON."
  },
  "approval": null
}
---

# Sets de mazos de Teacher

[Estudios](../README.md) · [Plan112](../../../../mvp/112-teacher-flashcards-plan.md#mazos-y-sets--2026-11-28).

## Qué resuelve

Un Set agrupa mazos personales. Cada mazo con nombre pertenece a un Set
del mismo propietario y conserva su categoría y sus tarjetas. **General**
reúne las tarjetas sin mazo. **Mazos sin clasificar** contiene los mazos
históricos sueltos y recibe las altas compatibles que no indican Set.

## Operaciones y contratos

| Solicitud | Resultado en Teacher |
|---|---|
| «Crea un mazo en mi Set de inglés» | Elegir el Set y crear el mazo a mano o **Crear desde JSON** con vista previa. La asociación por ID exige que ambos pertenezcan a la misma cuenta. |
| «Importa estos mazos al Set que trae el JSON» | En **Importar tarjetas**, pegar el JSON v1 con `set` y `decks`, revisar hasta 30 tarjetas y confirmar. Teacher reutiliza el Set por nombre en esa cuenta o lo crea junto con los mazos seleccionados. |
| «Muéstrame los mazos de gramática del Set» | Combinar Set y categoría. El árbol muestra cada Set como carpeta y la pantalla ofrece lista y cuadrícula con páginas de 30 mazos. |
| «Elimina este Set» | Confirmar la baja permanente de la carpeta y sus mazos, tarjetas, imágenes y marcas de repaso. Para conservar un mazo, moverlo primero a otro Set. |
| «Elimina el mazo» | Identificar el mazo por nombre y confirmar su baja, que elimina sus tarjetas, imágenes y marcas de repaso. |

El [controlador](../../../../../nodia-server/src/teacher/teacher-flashcards.controller.ts)
usa el acceso de Teacher y la propiedad por cuenta. Si dos nombres pueden
referirse a elementos distintos, solicitar si se trata de un Set o un mazo
antes de orientar a la acción. Usar la interfaz de Teacher para administrar
Sets, asignaciones y bajas de mazos. Las operaciones existentes del
[catálogo de Tarjetas](flashcards.md#operaciones-desde-nodiaai) mantienen
su revisión publicada.

El [formato y contrato de importación](../../../../mvp/112-teacher-flashcards-plan.md#mazos-y-sets--2026-11-28)
documenta validación, conflictos y recuperación del recibo.
