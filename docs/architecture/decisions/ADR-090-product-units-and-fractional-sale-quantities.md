# ADR-090 — Unidades de producto y cantidades de venta con tres decimales

> Estado: propuesto
> Fecha: 2026-10-30

## Contexto

El usuario solicita código comercial opcional, unidades de medida y cantidades fraccionarias. Confirma cuatro unidades: Unidades, Kilos, Gramos y Atado. La venta sigue expresándose en CLP sin fracciones de peso. Los carritos anteriores y los recibos pendientes deben conservar su identidad; NodiaAI continúa limitado a consultar ventas y reportes.

## Opciones consideradas

### Float para calcular importes y cantidad entera en la BD

No representa la cantidad solicitada y permite diferencias de redondeo entre cliente, servidor e informes. Se descarta.

### Cantidades como strings en todos los transportes

Permite precisión lexical estricta, pero cambia los comandos e históricos que ya intercambian cantidades JSON numéricas. No se adopta para este corte.

### Cantidad JSON numérica validada y aritmética mediante milésimas enteras

Conserva los enteros anteriores y añade hasta tres decimales. Se convierte a milésimas usando su representación decimal validada; importes y subtotales se calculan con enteros, sin multiplicación monetaria float.

## Decisión

Se elige la tercera opción. Cantidad mayor que cero para persistir una partida, con máximo previo 2.147.483.647 y hasta tres decimales. Cada subtotal es `round_half_up(precio_CLP × cantidad)` al peso; el total es la suma de subtotales redondeados. La validación de comandos, casos de uso y restricciones SQL debe coincidir.

La BD usa NUMERIC sin typmod y CHECK de escala máxima tres: NUMERIC(p,3) redondearía una entrada con cuatro decimales antes de comprobarla. Se ensayan los rechazos directos y la conservación de ventas enteras anteriores. Los importes registrados siguen siendo enteros exactos.

El producto guarda `measurement_unit` (`unit`, `kg`, `g`, `bundle`) con default `unit`; la partida conserva `measurement_unit_snapshot`. Cambiar la unidad requiere revisión de producto vigente y no reinterpreta partidas anteriores. No se convierten kilos a gramos automáticamente. Los agregados de cantidades se separan por unidad; no se presenta la suma de unidades físicas distintas como un total.

`Product.code` y sus snapshots admiten null; los blancos manuales se normalizan a null. El identificador interno de producto permanece estable. El índice comercial mantiene unicidad de los códigos informados por negocio y permite múltiples productos sin código; barcode conserva su unicidad independiente.

El carrito local permite cero para continuar editando. El basurero elimina la fila sin confirmación; al confirmar se retiran automáticamente las filas en cero y sólo se prepara, registra y envía el comando con cantidades positivas. Un carrito sin partidas positivas no se guarda. El workspace pasa a versión2 y migra versión1 conservando carritos, ámbito y claves pendientes; primero persiste la versión nueva y después retira la anterior. Una lectura o compilación no reenvía una venta.

El porcentaje del listado es una preferencia visual de la vista: 100% inicial, pasos de10 entre80 y200. Cambia nombres, precios, cantidades y subtotales visibles, sin alterar importes ni comandos. No se persiste como dato comercial.

## Consecuencias

- Lecturas, CSV, formularios, comparación de precios, snapshots y reportes deben conocer la unidad y los códigos opcionales. No se comparan precios porcentualmente entre unidades distintas.
- Los formatos históricos sin unidad tienen la unidad previa documentada `unit`; un valor explícito inválido no se sustituye por un default.
- Los contratos de NodiaAI y sus fuentes se actualizan coordinadamente sin restaurar escritores de ventas. No se modifica una ficha aprobada ni se inventa aprobación documental.
- No se revierte el esquema tras introducir fracciones, códigos nulos o nuevas unidades: el down rechaza datos incompatibles. La recuperación requiere preservar esos datos y comprobar recibos/carritos; el respaldo previo no acredita por sí solo un ensayo de restauración.
- Deben comprobarse aritmética, máximos, redondeo por línea, migración, idempotencia y SQL real desechable antes de adopción.

## Referencias

- [Plan94, sección28](../../mvp/94-business-point-of-sale-and-product-refactor.md#28-unidades-cantidades-fraccionarias-y-presentación-del-listado--2026-10-30).
- [ADR085](ADR-085-business-sales-and-product-availability.md), [ADR087](ADR-087-atomic-point-of-sale-checkout.md), [ADR088](ADR-088-local-sale-workspaces-and-recovery.md).
- [Ficha candidata](../../nodia-ai/knowledge/businesses/features/product-units-and-fractional-sales.md).

## Aclaración visual posterior R20 — 2026-10-30

El usuario pide que la imagen también crezca con el porcentaje. Se amplía el alcance visual a texto e imágenes, sin cambiar datos, cantidades, dinero o comandos. La solicitud80mm y el flujo manual de impresión se documentan en [plan94 §29](../../mvp/94-business-point-of-sale-and-product-refactor.md#29-presentación-de-precios-y-ticket-térmico80mm--r20-2026-10-30); no altera la decisión aritmética o de persistencia de este ADR propuesto ni lo declara aprobado.
