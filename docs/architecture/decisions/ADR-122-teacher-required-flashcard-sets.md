# ADR-122 — Pertenencia y baja de mazos de Teacher

> Estado: propuesto
> Fecha: 2026-11-28

## Contexto

Un Set de Teacher agrupa mazos propios para repaso. La primera versión
permitía mazos sueltos y los desvinculaba al eliminar el Set. La regla
solicitada requiere un Set por mazo, la baja de sus descendientes y la
importación incremental de mazos bajo el mismo Set. **General** recibe
las tarjetas sin mazo.

## Opciones consideradas

### Mantener la pertenencia opcional

Permitiría que el frontend mostrara un árbol sin mazos sueltos con un
cambio acotado. Las migraciones, API y escrituras de NodiaAI todavía
podrían dejar filas sin ubicación y la baja seguiría dependiendo de
cada cliente.

### Exigir un Set en la base y ejecutar la baja en el caso de uso

La clave foránea compuesta protege la pertenencia dentro de la cuenta.
El caso de uso controla juntos la baja, las referencias de repaso y los
recibos de importación. Esta opción requiere clasificar las filas
históricas y mantener la compatibilidad con las entradas sin Set.

## Decisión

Cada mazo con nombre requiere un `set_id` y una referencia al Set del
mismo propietario. Se mantiene **General** como destino virtual para
tarjetas con `deck_id` nulo. Las filas históricas y las altas compatibles
sin Set se asignan a **Mazos sin clasificar** por propietario.

La baja opera en una transacción. Toma control del Set y de sus mazos
antes de retirar el contenido, conservar los recibos mínimos y borrar el
Set. La clave foránea impide que se salte esa secuencia mientras haya
mazos. Al importar con nombre, el título normalizado y la cuenta
identifican el Set. El servidor lo crea cuando falta y agrupa todos los
efectos de la importación en el mismo guardado.

## Consecuencias

- La migración conserva identidades y contenido ya guardado. La
  confirmación de borrado debe explicar la baja de todos los descendientes.
- Los reintentos conservan su identidad y el catálogo de NodiaAI puede
  seguir enviando sus contratos publicados.
- El control de pertenencia y la baja se deben verificar en PostgreSQL
  con importaciones concurrentes y recibos históricos.

## Referencias

- [ADR-117 de biblioteca de tarjetas](ADR-117-teacher-flashcard-library.md).
- [Plan112 · Mazos y Sets](../../mvp/112-teacher-flashcards-plan.md#mazos-y-sets--2026-11-28).
