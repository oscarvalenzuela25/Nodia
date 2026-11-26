---
{
  "schema_version": 1,
  "document_id": "businesses.combined-sale-payments",
  "product_id": "businesses",
  "kind": "feature",
  "revision": 1,
  "document_status": "draft",
  "implementation": {
    "status": "implemented",
    "notes": "El reparto y el total filtrado se implementaron en Client y Server. Las consultas de NodiaAI conservan el contrato sales-read/3."
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento de Negocios y NodiaAI conforme AGENTS",
  "sources": [
    {"path": "docs/mvp/94-business-point-of-sale-and-product-refactor.md", "kind": "specification"},
    {"path": "docs/architecture/decisions/ADR-121-combined-sale-payments.md", "kind": "specification"},
    {"path": "nodia-server/src/sale/dto/sale-command.dto.ts", "kind": "implementation"},
    {"path": "nodia-server/src/sale/use-case/mutate-sale.use-case.ts", "kind": "implementation"},
    {"path": "nodia-server/src/sale/use-case/read-sales.use-case.ts", "kind": "implementation"}
  ],
  "verification": {
    "checked_on": "2026-11-25",
    "evidence_paths": [],
    "notes": "Plan94 §49 registra la verificación local con PostgreSQL 16, Nest y el navegador interno. Se validó el esquema sales-read/3 con transacciones sintéticas. La aceptación y la publicación por entorno permanecen pendientes."
  },
  "approval": null
}
---

# Pagos combinados y filtro de Ventas — contexto funcional para NodiaAI

## Qué resuelve y qué significa

Una transacción puede repartir su total entre Efectivo, Tarjeta y
Transferencia. Ventas muestra una fila por pago combinado. Cada fila
identifica la transacción de origen. Los montos son pesos chilenos enteros
y los medios son informativos. [Plan94 §49](../../../../mvp/94-business-point-of-sale-and-product-refactor.md#49-pagos-combinados-y-total-filtrado-en-ventas--2026-11-25).

## Solicitudes en lenguaje natural

| Solicitud | Interpretación |
|---|---|
| «¿Cuánto se registró en esta venta?» | Consultar la transacción autorizada por identificador y negocio. |
| «Filtra las ventas por Tarjeta» | El filtro de medio está en Ventas. La lectura conversacional admite búsqueda, período y estado. |
| «Registra $5.000 en efectivo y el resto en tarjeta» | Remitir al Punto de venta manual. |

## Operaciones y contratos

- El checkout nativo acepta `payments` con dos o tres medios distintos.
  Los importes positivos suman el total a confirmar. El recibo recuperable
  conserva el desglose exacto.
- El listado nativo acepta `payment_method`. Cada asignación devuelve
  `record_payment` con su identificador, medio e importe. La venta raíz
  conserva el carrito y el total íntegro. `meta.total_amount` suma las
  coincidencias antes de paginar.
- `nodia_sales_get` y `nodia_sales_list` consultan transacciones
  autorizadas. El esquema vigente usa `other` con una descripción para
  Tarjeta o para el desglose de pagos. Los reportes cuentan la venta una vez.

## Acceso, filtros y recuperación

El Server verifica negocio y sesión. Tarjeta agrupa débito y crédito
históricos. Las fechas usan America/Santiago. El total filtrado suma los
importes nominales de las filas visibles por criterio, incluidas
anulaciones si están seleccionadas. El resumen comercial suma confirmadas.

La anulación aplica a la transacción completa. Se conserva el descuento
de stock realizado al confirmar. Recuperar una confirmación usa la clave
de la misma intención. El POS conserva el carrito y los montos al fallar.

## Evidencia y compatibilidad

La ficha es candidata y permanece fuera del contexto publicado. Las
capacidades de ventas y reportes de NodiaAI siguen siendo de solo lectura.
