---
{
  "schema_version": 1,
  "document_id": "studies.flashcards",
  "product_id": "studies",
  "kind": "feature",
  "revision": 4,
  "document_status": "draft",
  "implementation": {
    "status": "partial",
    "notes": "Biblioteca, repaso, importación JSON y propuesta de texto anclada a una cita implementados en Teacher. Inferencia real de texto por comprobar. Apuntes libres e imagen generada pendientes."
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
      "path": "nodia-server/src/teacher/teacher-flashcard-generation.controller.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/teacher/pages/Teacher/Teacher.tsx",
      "kind": "implementation"
    }
  ],
  "verification": {
    "checked_on": "2026-11-23",
    "evidence_paths": ["docs/mvp/112-teacher-flashcards-plan.md"],
    "notes": "Pruebas locales de propiedad, persistencia privada e importación atómica. La propuesta de texto se verifica con fixture de transporte. Pendientes la inferencia real, la imagen y la integración conversacional."
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
| «Haz tarjetas de estos apuntes para Inglés» | Se puede pedir JSON v1 a un LLM externo y revisarlo en Teacher. La generación nativa desde apuntes permanece pendiente. |
| «Guarda una tarjeta de este fragmento» | Preparar una tarjeta con acceso a la lección autorizada. Puede solicitarse una propuesta de texto antes de guardar. Usar **General** si se omite el mazo. |
| «Cambia la imagen de esta tarjeta» | Identificar la tarjeta y aclarar si la persona quiere subir una imagen o generar otra. |
| «Regenera esta tarjeta» | Una tarjeta con cita accesible permite pedir otro texto con la IA de la sesión de origen. La modificación se revisa y guarda explícitamente. |
| «Elimina esta tarjeta» | Identificar la pregunta y su mazo para confirmar la eliminación desde Teacher. |

## Operaciones y contratos

| Operación prevista | Efecto | Estado |
| --- | --- | --- |
| Crear manualmente y adjuntar una imagen | Guardar pregunta, respuesta, mazo e imagen opcional. | Flujo nativo local. |
| Crear desde una lección | Rellenar la respuesta y la fuente con la cita de un bloque. | Flujo nativo local. El vínculo abre la sesión autorizada. |
| Importar una tarjeta o un mazo | Revisar un JSON v1 y guardar hasta 30 tarjetas seleccionadas en un mazo existente o nuevo. El mazo nuevo admite categoría. | Flujo nativo local. |
| Generar o regenerar texto desde una cita | Preparar pregunta y respuesta con la selección exacta de la lección. La propuesta puede editarse antes de guardar. | Contrato local, pendiente de inferencia real por selección. |
| Generar desde apuntes nativamente o regenerar imagen | Proponer texto, imagen o ambos según alcance. | Ámbito de generación y calificación de imágenes pendientes. |
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
inválido conserva la imagen previa. El importador muestra la selección
antes de crear registros y recupera el mismo recibo ante un reintento.
La propuesta de texto se revisa antes de incorporarla al editor.
Recuperar una solicitud incierta consulta su clave y la operación de
guardado exige una acción humana posterior.

## Integración y evidencia

- [x] Revisar mockup móvil, captura de fragmento y representación de la imagen.
- [x] Validar con Nest y PostgreSQL aislado la autorización, la cita exacta,
  la persistencia de marcas y la limpieza de imagen al confirmar el borrado.
- [x] Verificar la vista previa y el guardado atómico del JSON.
- [ ] Calificar generación exacta en Teacher y verificar la regeneración
  parcial, sus errores y la confirmación.
- [ ] Evaluar un alcance de integración de NodiaAI por separado.

## Evolución y compatibilidad

| Revisión | Cambio | Compatibilidad pendiente |
| --- | --- | --- |
| 1 | Propuesta de mazos, origen en la lección, imágenes y repaso. | Conservar las tarjetas y marcas de repaso de sesión al incorporar la biblioteca. |
| 2 | Confirmación de eliminación y ajuste de la vista previa de imagen. | Precisar historial y retención de imágenes en el contrato nativo. |
| 3 | Primer corte local manual con mazos y procedencia de lección. | Generación, ubicación exacta de la cita y continuidad del repaso programado. |
| 4 | Formato JSON v1 con vista previa y propuestas de texto para citas. | Inferencia real, imágenes, apuntes libres y salto a la cita. |
