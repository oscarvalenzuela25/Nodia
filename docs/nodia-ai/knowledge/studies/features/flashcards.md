---
{
  "schema_version": 1,
  "document_id": "studies.flashcards",
  "product_id": "studies",
  "kind": "feature",
  "revision": 3,
  "document_status": "draft",
  "implementation": {
    "status": "partial",
    "notes": "Biblioteca manual, procedencia de lección, imagen privada y repaso implementados localmente en Teacher. Generación y regeneración pendientes."
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento de Estudios y NodiaAI conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/112-teacher-flashcards-plan.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/106-nodia-teacher-guided-ux-redesign.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/97-nodia-teacher-technical-contracts.md",
      "kind": "specification"
    },
    {
      "path": "docs/architecture/decisions/ADR-117-teacher-flashcard-library.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/teacher/teacher-flashcards.controller.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/teacher/pages/Teacher/Teacher.tsx",
      "kind": "implementation"
    }
  ],
  "verification": {
    "checked_on": "2026-11-22",
    "evidence_paths": ["docs/mvp/112-teacher-flashcards-plan.md"],
    "notes": "Pruebas locales aisladas de propiedad, persistencia, borrado y procedencia exacta. Pendientes la generación de texto y de imágenes, y la integración conversacional."
  },
  "approval": null
}
---

# Tarjetas de repaso de Teacher — ficha candidata

[Estudios](../README.md) ·
[Especificación](../../../../mvp/112-teacher-flashcards-plan.md).

## Qué resuelve y qué significa

Una tarjeta propone una pregunta breve y revela una respuesta. Puede
vincular una ilustración y una fuente. El mazo organiza tarjetas propias
de distintas sesiones. **General** es el mazo al omitir el destino.
Teacher ofrece autoría manual y repaso programado por sesión. La
biblioteca local organiza tarjetas personales de distintas sesiones y
admite imágenes privadas subidas por la persona.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención y aclaración |
| --- | --- |
| «Haz tarjetas de estos apuntes para Inglés» | Preparar borradores con pregunta, respuesta e imagen. Si faltan contenidos, pedir la fuente que sustente las respuestas. |
| «Guarda una tarjeta de este fragmento» | Preparar una tarjeta con acceso a la lección autorizada. Usar **General** si se omite el mazo. |
| «Cambia la imagen de esta tarjeta» | Identificar la tarjeta y aclarar si la persona quiere subir una imagen o generar otra. |
| «Regenera esta tarjeta» | Preparar cambios a partir del contenido guardado. Aclarar si se quiere regenerar texto, imagen o ambos. |
| «Elimina esta tarjeta» | Identificar la pregunta y su mazo para confirmar la eliminación desde Teacher. |

## Operaciones y contratos

| Operación prevista | Efecto | Estado |
| --- | --- | --- |
| Crear manualmente y adjuntar una imagen | Guardar pregunta, respuesta, mazo e imagen opcional. | Flujo nativo local. |
| Crear desde una lección | Rellenar la respuesta y la fuente con la cita de un bloque. | Flujo nativo local. El vínculo abre la sesión autorizada. |
| Generar desde texto o fragmento y regenerar | Preparar tarjetas revisables con imagen por defecto o proponer cambios. | Contrato y selección de generación pendientes. |
| Editar y mover | Guardar una revisión de los campos elegidos y cambiar de mazo. | Flujo nativo local. |
| Eliminar una tarjeta | Retirar la tarjeta, su imagen y sus marcas de mazo tras confirmar. | Flujo nativo local. |
| Repasar un mazo | Revelar la respuesta y registrar la elección de repaso. | Flujo nativo local. La programación conserva su alcance por sesión. |

## Datos, autoridad y filtros

La pregunta y la respuesta identifican el contenido visible. La persona
elige un mazo propio o usa General. La fuente y la imagen son campos
opcionales de la tarjeta guardada. Un fragmento requiere identidad de
lección y acceso vigente para abrir la procedencia. Las imágenes son
privadas y el filtro inicial de repaso es el mazo elegido.

## Vista previa, confirmación y recuperación

El editor manual conserva el borrador ante un error. Un archivo
inválido conserva la imagen previa. Para la generación se propone
editar o descartar cada borrador y confirmar qué guardar. Sus reglas
de persistencia, concurrencia y recuperación requieren validación
propia.

## Integración y evidencia

- [x] Revisar mockup móvil, captura de fragmento y representación de la imagen.
- [x] Validar con Nest y PostgreSQL aislado la autorización, la cita exacta,
  la persistencia de marcas y la limpieza de imagen al confirmar el borrado.
- [ ] Calificar generación exacta en Teacher y verificar la regeneración
  parcial, sus errores y la confirmación.
- [ ] Evaluar un alcance de integración de NodiaAI por separado.

## Evolución y compatibilidad

| Revisión | Cambio | Compatibilidad pendiente |
| --- | --- | --- |
| 1 | Propuesta de mazos, origen en la lección, imágenes y repaso. | Conservar las tarjetas y marcas de repaso de sesión al incorporar la biblioteca. |
| 2 | Confirmación de eliminación y ajuste de la vista previa de imagen. | Precisar historial y retención de imágenes en el contrato nativo. |
| 3 | Primer corte local manual con mazos y procedencia de lección. | Generación, ubicación exacta de la cita y continuidad del repaso programado. |
