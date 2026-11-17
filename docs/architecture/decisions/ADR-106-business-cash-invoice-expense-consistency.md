# ADR-106 — Caja de Negocios y consistencia del egreso vinculado a factura

> Estado: propuesto
> Fecha: 2026-11-17
> R02: ampliación explícita de selectores y retiro del egreso al quitar categoría.
> CASH-01: contrato técnico definido en el plan109 para implementación por fases.
> CASH-02: categorías y recibos implementados localmente según plan109 §11.

## Contexto

El [plan109](../../mvp/109-business-cash-ledger-plan.md) propone Caja por negocio,
categorías compartidas por ingresos/egresos, agregados filtrados y registro
opcional de facturas como egresos. La primera categoría debe crear un solo egreso;
la recategorización debe conservarlo. La solicitud incluye cards mensuales en Overview.
La ampliación R02 confirma retiro del egreso cuando se guarda la factura sin
categoría, X para limpiar y + para crear categoría en contexto; unicidad del
nombre independiente de mayúsculas y espaciados. Sustituye la propuesta inicial
que impedía quitar una categoría ya vinculada.

Los movimientos de Finanzas personales pertenecen al usuario y tienen otros
estados. `business_actions` es un catálogo de permisos. Reutilizar cualquiera
como dinero del negocio mezcla identidades y autoridad. El OCR actual guarda
factura y lotes de productos mediante HTTP separados; añadir otra petición no
garantiza una única operación ni evita duplicar facturas después de un timeout.

## Opciones consideradas

### Opción A — adaptar Finanzas personales y coordinar efectos desde Client

- Ventajas: reutilización aparente de formularios/tablas existentes.
- Desventajas: ownership incorrecto, semántica financiera incompatible,
  efectos parciales, reintentos duplicados y agregados inconsistentes.

### Opción B — Caja propia por negocio, vínculo único y confirmación nativa

- Ventajas: aislamiento SQL, invariantes persistentes, una sola identidad de
  egreso por factura y recuperación idempotente de la confirmación OCR.
- Desventajas: nuevos recursos y contrato de confirmación; ampliar pruebas
  transaccionales y protocolo de archivo sin introducir I/O externo bajo locks.

### Opción C — ledger fiscal inmutable de doble partida desde esta entrega

- Ventajas: modelo contable más amplio con asientos de corrección explícitos.
- Desventajas: excede el CRUD/actividad solicitado y exige cuentas, saldos,
  cierres y reglas contables que aún no están definidos por el producto.

## Decisión

Se elige B como base técnica de V1. El ADR permanece propuesto para revisión.

- Tab bajo destino canónico Negocios, recursos `business_cash_categories` y
  `business_cash_movements` con `business_id`, scope/autorización compartidos.
- CLP entero positivo, tipo separado, fecha civil DATE. Categorías compartidas,
  FK mismo negocio, índice único de `invoice_id` también para egresos inactivos
  o retirados. Nombre canónico administrado por Server y unique por negocio,
  incluso para categorías inactivas; misma normalización en Drawer/modal.
- Factura y su egreso confirman en la misma transacción. Total, fecha y
  categoría se editan en Facturas y actualizan el mismo egreso. Caja cambia
  la actividad del egreso independientemente de la factura.
- Quitar categoría explícitamente retira el efecto de lista y agregados, incluso
  Todos, conservando auditoría mediante retiro lógico separado de actividad.
  Una nueva asignación restaura el mismo ID. Ausencia del campo conserva;
  null significa retiro y forma parte del comando/recibo idempotente.
- X edita el borrador, + crea categoría y la selecciona sin guardar factura o
  movimiento. Un solo overlay activo, borrador y foco conservados.
- Confirmación OCR identificada en `/invoices/ocr-confirmations`, con factura,
  productos, egreso, auditoría y recibo en una transacción. Preparar R2 antes
  de confirmar y cercar cada intento con concesión y clave de archivo propia.
  Recuperar por negocio, actor y `request_key`, verificando autoridad actual.
- Página, count y summary comparten una sentencia SQL tras revalidar autoridad
  en READ COMMITTED. Overview usa el mismo agregador y mes civil de Santiago.
- El [orden común](../../mvp/109-business-cash-ledger-plan.md#64-recibos-archivos-y-orden-de-locks)
  toma autoridad, negocio y recibo antes de recursos de dominio. Factura y
  productos preceden a categoría y movimiento. El contrato fija CAS, precisión
  decimal exacta y reglas para facturas históricas.
- Propuestas previas de NodiaAI se revalidan bajo lock antes del efecto. Los
  cambios que afectarían Caja se remiten a Facturas nativas sin reanudar una
  propuesta incompatible. Se preserva el contexto firmado de las operaciones
  conversacionales existentes.
- Sólo facturas generan egresos automáticos; cierres de caja se registran a mano
  como ingresos. Sin integración de ventas ni flujo formal de cierre por este alcance.

## Consecuencias

- Positivas: ausencia de duplicados respaldada por DB, recategorización estable,
  separación de dinero del negocio y personal, totales coherentes con búsqueda.
- Costos: la confirmación OCR implica un caso de uso compuesto, adaptar el orden
  de los escritores de Productos y proteger el DTO parcial de Facturas frente
  a defaults. La evidencia de rollback y concurrencia se obtiene en SQL aislado.
- CASH-01 cierra el contrato documental. CASH-02…07 implementan y verifican los
  límites y efectos en las capas correspondientes.

## Referencias

- [Plan109 y TODO CASH-001](../../mvp/109-business-cash-ledger-plan.md).
- [Negocios94](../../mvp/94-business-point-of-sale-and-product-refactor.md),
  especialmente R17/§26 y ampliación de facturas/precios§42.
- [ADR081: acceso y ownership](ADR-081-module-access-and-business-data-scope.md).
- [ADR092: destinos canónicos](ADR-092-stable-module-navigation-routes.md).
- [Ficha candidata Caja](../../nodia-ai/knowledge/businesses/features/cash-ledger-and-invoice-expenses.md).
