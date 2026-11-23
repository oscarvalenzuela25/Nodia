---
{
  "schema_version": 1,
  "document_id": "studies.flashcard-sets",
  "product_id": "studies",
  "kind": "feature",
  "revision": 1,
  "document_status": "draft",
  "implementation": {
    "status": "implemented",
    "notes": "Organización, filtros, vistas y confirmación de bajas en Teacher. Adopción en el entorno de destino pendiente."
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento de Estudios y NodiaAI conforme AGENTS",
  "sources": [
    { "path": "docs/mvp/112-teacher-flashcards-plan.md", "kind": "specification" },
    { "path": "nodia-server/src/teacher/teacher-flashcards.controller.ts", "kind": "implementation" },
    { "path": "nodia-server/src/teacher/use-case/teacher-flashcards.use-case.ts", "kind": "implementation" },
    { "path": "nodia-client/src/modules/teacher/components/Flashcards/Flashcards.tsx", "kind": "implementation" }
  ],
  "verification": {
    "checked_on": "2026-11-23",
    "evidence_paths": ["docs/mvp/112-teacher-flashcards-plan.md"],
    "notes": "Contrato y alcance por cuenta comprobados con Nest y PostgreSQL aislado."
  },
  "approval": null
}
---

# Sets de mazos de Teacher

[Estudios](../README.md) · [Plan112](../../../../mvp/112-teacher-flashcards-plan.md#sets-de-mazos--propuesta-de-interfaz).

## Qué resuelve

Un Set agrupa mazos personales. Un mazo admite un Set opcional y conserva
su categoría y sus tarjetas. **Mazos sin set** reúne mazos independientes.
**General** reúne tarjetas sin mazo y es un destino fijo.

## Operaciones y contratos

| Solicitud | Resultado en Teacher |
|---|---|
| «Organiza estos mazos de inglés en un set» | Crear un Set con nombre y elegirlo al crear o editar cada mazo. La asociación exige que ambos registros pertenezcan a la misma cuenta. |
| «Muéstrame los mazos de gramática del set» | Combinar Set y categoría. La pantalla usa páginas de diez mazos y ofrece lista y cuadrícula. |
| «Quita el set, quiero mantener los mazos» | Abrir la confirmación del Set. La baja desvincula sus mazos, que pasan a **Mazos sin set**. |
| «Elimina el mazo» | Identificar el mazo por nombre y confirmar su baja, que elimina sus tarjetas, imágenes y marcas de repaso. |

El [controlador](../../../../../nodia-server/src/teacher/teacher-flashcards.controller.ts)
usa el acceso de Teacher y la propiedad por cuenta. Si dos nombres pueden
referirse a elementos distintos, solicitar si se trata de un Set o un mazo
antes de orientar a la acción. Usar la interfaz de Teacher para administrar
Sets, asignaciones y bajas de mazos. Las operaciones existentes del
[catálogo de Tarjetas](flashcards.md#operaciones-desde-nodiaai) mantienen
su revisión publicada.
