# ADR-117 — Biblioteca personal de tarjetas de Teacher

> Estado propuesto, 2026-11-22.

## Contexto

La biblioteca reúne tarjetas de distintas sesiones y permite crear
tarjetas por cuenta propia. Su autoría y repaso requieren alcance por
propietario. El contrato previo de tarjetas por sesión conserva sus
identidades, intervalos y eventos.

## Opciones consideradas

### A. Extender las tarjetas por sesión

Esta opción reutiliza el almacenamiento existente. Una tarjeta manual
sin lección requeriría ampliar el alcance de la tabla o crear una
sesión artificial. También mezclaría la calificación por sesión con
la experiencia nueva de repaso por mazo.

### B. Biblioteca propia y miniaturas privadas acotadas

La biblioteca puede contener tarjetas libres y conservar la procedencia
de una lección. Las miniaturas acotadas se adjuntan a la tarjeta con una
escritura atómica. El volumen de binarios queda en la base y se lee por
una ruta privada dedicada.

### C. Biblioteca propia y almacenamiento de objetos

La alternativa separa el volumen binario de la base. Requiere
autorización, conciliación y limpieza entre dos servicios, incluida la
recuperación de archivos creados antes de una escritura que falla.

## Decisión propuesta

Usar la opción B en el primer corte. La autoridad se resuelve mediante
**/nodia-teacher** y el propietario del registro. **General** representa
las tarjetas sin mazo explícito. El mazo tiene identidad propia con
relaciones acotadas al propietario.

Guardar únicamente una miniatura WebP estática y acotada por tarjeta.
La lista devuelve metadatos ligeros. La lectura de bytes usa el acceso
vigente y se entrega como privada, con `no-store`. Reemplazar o
eliminar la tarjeta libera sus bytes dentro de la misma transacción.
El original elegido por la persona se prepara en Client.

## Importación y ampliación de generación

La importación recibe campos de texto revisados y se guarda en una
transacción del propietario. Se incorpora una categoría opcional al
mazo, con coincidencia por etiqueta en la biblioteca. El JSON no
adquiere autoridad para consultar recursos ni descargar imágenes.

Las propuestas de texto con una cita usan el ámbito de generación
de la sesión de origen y su selección expresa. El trabajo se registra
en el journal de Teacher y revalida la sesión, el fragmento y, para
regenerar, la revisión de la tarjeta. El resultado queda como propuesta
de texto. Guardar o cambiar una tarjeta sigue requiriendo el escritor
de biblioteca y una confirmación del usuario.

El [ADR-118](ADR-118-teacher-flashcard-proposal-execution.md) describe
el propietario de ejecución de biblioteca, la retención, el presupuesto
y el cierre para apuntes y propuestas con imagen.

## Agrupación de mazos

El Set tiene identidad y alcance propios por cuenta. Una referencia
opcional compuesta por propietario e ID garantiza que el mazo y su Set
pertenezcan a la misma cuenta. El Set se puede eliminar conservando los
mazos mediante la desvinculación en la misma transacción. Esta relación
permite importar y editar mazos independientes, incluidos los históricos.

La baja explícita de un mazo retira las tarjetas y sus datos de repaso.
Los recibos mínimos impiden que una solicitud de creación o importación
repetida vuelva a crear el material eliminado. Esta extensión conserva
la proyección del catálogo aprobado de NodiaAI.

## Consecuencias

- La sesión conserva sus tarjetas, marcas y política de repaso. Se
  evaluará la continuidad hacia la biblioteca con identidades y recibos
  históricos.
- El tamaño de las miniaturas y la lectura paginada acotan el volumen.
  Si las medidas muestran presión en los respaldos, se podrá mover el
  binario a almacenamiento de objetos con vínculos y retención propios.
- La creación y valoración aceptan claves de solicitud. El recibo
  mínimo de eliminación protege los reintentos de alta y borrado.

## Referencias

- [Plan de tarjetas](../../mvp/112-teacher-flashcards-plan.md)
- [Propiedad y acceso a módulos](../../mvp/89-module-access-and-user-data-scope.md)
- [Contrato de Teacher por sesión](../../mvp/97-nodia-teacher-technical-contracts.md#enriquecimiento-comandos-y-consultas)
- [ADR-116](ADR-116-teacher-study-calendar-ownership.md)
