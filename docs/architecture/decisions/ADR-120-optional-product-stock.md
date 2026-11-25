# ADR-120 — Control opcional de stock por producto

> **Estado** propuesto · **Fecha** 2026-11-25.

## Contexto

Productos conserva un saldo entero y un indicador de disponibilidad manual.
El POS actual usa ese indicador para autorizar la venta y admite cantidades
de hasta tres decimales. Se solicita retirar la disponibilidad manual,
activar el inventario por producto y descontar el saldo al confirmar
ventas. El cambio alcanza ajustes manuales, OCR, contratos de lectura y la
compatibilidad con catálogos, ventas y recibos previos.

## Opciones consideradas

| Opción | Ventaja | Costo |
|---|---|---|
| Reutilizar `has_stock` como control | Cambio de esquema pequeño | Reinterpretaría datos históricos y activaría descuentos sin una decisión explícita. |
| Nuevo control y saldo entero | Conserva el tipo actual | Las ventas fraccionarias exigirían redondeo o un régimen de venta distinto. |
| Nuevo control y saldo decimal exacto | Permite adhesión explícita y mantiene el contrato de cantidades del POS | Exige una transición de esquema, proyecciones y escritores con compatibilidad comprobada. |

## Decisión

Proponer la tercera opción. `track_stock` empieza apagado para todos los
productos. Los saldos existentes se conservan. El saldo exacto en la unidad
del producto usa hasta tres decimales. Un producto activo con control
apagado sigue vendible sin mutar stock. El control encendido exige saldo
suficiente en el momento de confirmar. Los cambios de unidad que afecten
un saldo controlado requieren revisar el saldo de destino.

La confirmación POS bloquea productos por ID, valida y registra el
descuento en la misma transacción que la venta y su recibo idempotente.
Los ajustes OCR usan la versión del destino revisado y la transacción
nativa de facturas. Las intenciones de sumar y reemplazar son distintas y
se incluyen en el hash de confirmación. La cantidad de factura conserva
su propio significado.

El resumen, los filtros y los contratos públicos afectados se revisan
antes de retirar `products.has_stock`. La evidencia de ventas y de la
disponibilidad histórica conserva su semántica. La propuesta mantiene la
anulación comercial sin reposición automática de unidades.

## Consecuencias

- Los activos antes clasificados como no disponibles o desconocidos pasan a
  ser vendibles con el control apagado. Revisar ese subconjunto antes del corte.
- La revisión de producto también cambia con el saldo. Un carrito
  concurrente puede volver a revisión aunque todavía quede cantidad
  suficiente. Mantener las transacciones cortas y adquirir los bloqueos
  de productos en un orden común.
- Tras el primer descuento, la recuperación debe preservar los efectos de
  stock y los recibos. La activación exige retirar o bloquear ejecutores
  antiguos capaces de confirmar ventas sin aplicar el descuento.

## Referencias

- [Plan94 §47 — Stock opcional por producto](../../mvp/94-business-point-of-sale-and-product-refactor.md#47-stock-opcional-por-producto).
- [ADR085 — Disponibilidad manual anterior](ADR-085-business-sales-and-product-availability.md).
- [ADR087 — Confirmación atómica en POS](ADR-087-atomic-point-of-sale-checkout.md).
- [ADR090 — Cantidades de venta](ADR-090-product-units-and-fractional-sale-quantities.md).
- [ADR106 — Consistencia de facturas y Caja](ADR-106-business-cash-invoice-expense-consistency.md).
