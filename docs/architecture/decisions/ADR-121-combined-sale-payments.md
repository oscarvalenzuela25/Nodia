# ADR-121 — Asignaciones de pago por transacción de venta

> Estado: propuesto
>
> Fecha: 2026-11-25

## Contexto

Una salida de productos puede pagarse con dos o tres medios. Ventas
muestra cada importe por separado. Inventario, ticket, anulación y
reportes necesitan la identidad de la transacción original.

## Opciones consideradas

- Crear una venta completa por medio requeriría asignar productos,
  cantidades y redondeos a importes elegidos libremente.
- Guardar el reparto como JSON simplificaría la escritura, con más
  trabajo para ordenar, paginar e identificar cada asignación.
- Una fila relacional por asignación permite filtrar por medio y abrir
  la transacción original mediante una llave foránea.

## Decisión

Usar `sale_payments`, con identidad por pago y llave foránea compuesta por
negocio y venta. Guardar el carrito, sus asignaciones, el descuento de
stock, el evento y el recibo idempotente en la misma transacción. Validar
dos o tres medios distintos con montos positivos y suma exacta en CLP.

El listado nativo pagina ventas simples y asignaciones. Una consulta
produce los resultados, el conteo y la suma. El detalle vincula cada
asignación al ticket y a la anulación de la transacción completa. Los
reportes agregan cada transacción una vez.

## Consecuencias

- El filtro Tarjeta reúne débito, crédito y el nuevo código `card`.
- El esquema firmado `sales-read/3` usa su valor existente `other` con
  descripción para los medios nuevos. Sus lecturas devuelven transacciones.
- La migración conserva las filas anteriores. Su reversión se bloquea
  tras registrar una tarjeta nueva o una asignación. La activación exige
  Server y Client compatibles.

## Referencias

- [Plan94 §49](../../mvp/94-business-point-of-sale-and-product-refactor.md#49-pagos-combinados-y-total-filtrado-en-ventas--2026-11-25)
- [Migración](../../../nodia-server/src/migrations/1794050000000-AddCombinedSalePayments.ts)
