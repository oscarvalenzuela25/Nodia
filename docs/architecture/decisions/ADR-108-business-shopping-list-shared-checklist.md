# ADR-108 — Marcas compartidas en las listas de Market

> Estado: propuesto. El usuario confirmó el alcance compartido del checklist.
> Fecha: 2026-11-18.

## Contexto

Los usuarios autorizados de un negocio usarán una misma lista para consultar y
marcar productos. El editor puede cambiar la composición mientras alguien usa
el checklist. Productos permite traslados autorizados entre negocios, por lo
que un vínculo histórico no puede exponer el catálogo del destino.

## Opciones consideradas

### Guardar toda la lista en cada cambio

Un solo contrato simplifica el primer cliente. Cambiar un checkbox reenvía
datos de otros productos y puede sobrescribir marcas o cantidades guardadas
por otro usuario. Un conflicto obliga a revalidar toda la lista.

### Persistir la marca por partida con revisión propia

Cada usuario envía el estado explícito de una fila. La edición conserva las
marcas de las filas retenidas y dos usuarios pueden cambiar filas distintas
sin perder sus cambios. Requiere separar la revisión de contenido de la
revisión de cada marca.

## Decisión

La implementación propuesta usa una marca por partida de una lista de un
negocio. El usuario se registra como autor del cambio; todos los actores
autorizados observan ese mismo estado. El `PUT` recibe el booleano deseado y
la revisión de la partida, comprueba la pertenencia lista/negocio y registra
el nuevo estado dentro de la transacción. Dos cambios sobre la misma revisión
se resuelven por control de versión y relectura del estado vigente.

Las ediciones de composición emplean una revisión de lista y preservan
identidades y marcas de las partidas retenidas. Una partida retirada deja de
aceptar escrituras y su reincorporación obtiene otro ID. El alta de partidas
valida el negocio y el producto en Server. Una proyección limitada al negocio
actual y el nombre registrado al agregar preservan el dato propio de una
partida cuando el catálogo cambia de ámbito.

La migración `1793730000000` añade tres tablas para listas, partidas y
recibos de alta. Partidas y recibos referencian la lista por `(list_id,
business_id)`. `product_id` es una identidad histórica. Una nueva asociación
valida y bloquea el producto activo del negocio durante el guardado. Las
lecturas del catálogo acotan el `JOIN` al negocio original. Así, el traslado
o retiro de un producto conserva las partidas y su identidad comercial.

La lista y sus partidas se guardan en la misma transacción que el recibo
de alta. Un reenvío con la misma clave y contenido recupera ese recibo. Un
contenido distinto con la misma clave genera conflicto. El `down` sólo puede
retirar las tablas vacías y se bloquea si ya contienen datos.

## Consecuencias

- La revocación de un usuario se aplica antes de nuevas escrituras y conserva
  las marcas que el negocio ya recibió.
- Un fallo al guardar una marca se concilia por lectura de la partida.
  La actualización de la composición tiene su propia revisión y validación.
- La entrega verifica las carreras con dos transacciones y las reglas de
  proyección antes de integrar Client.

## Referencias

- [Plan de Listas de Market](../../mvp/110-market-shopping-lists-plan.md).
- [Acceso de negocio](../../mvp/89-module-access-and-user-data-scope.md).
