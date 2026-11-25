---
{
  "schema_version": 1,
  "document_id": "businesses.product-stock-tracking",
  "product_id": "businesses",
  "kind": "feature",
  "revision": 4,
  "document_status": "draft",
  "implementation": {
    "status": "implemented",
    "notes": "Productos, Facturas OCR y POS implementados localmente según Plan94 §47. El corte operativo y el retiro físico de la clasificación anterior están pendientes."
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento de Negocios y NodiaAI conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/94-business-point-of-sale-and-product-refactor.md",
      "kind": "specification"
    },
    {
      "path": "docs/architecture/decisions/ADR-120-optional-product-stock.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/migrations/1794030000000-TrackProductStock.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/sale/use-case/mutate-sale.use-case.ts",
      "kind": "implementation"
    }
  ],
  "verification": {
    "checked_on": "2026-11-25",
    "evidence_paths": [],
    "notes": "Integraciones de ventas y confirmación nativa OCR sobre PostgreSQL 16 aislado. Se verificaron saldos decimales, recuperación y rollback. La evidencia de activación operativa está pendiente."
  },
  "approval": null
}
---

# Control opcional de stock — contexto funcional candidato

[Producto Negocios](../README.md) ·
[Plan94 §47](../../../../mvp/94-business-point-of-sale-and-product-refactor.md#47-stock-opcional-por-producto).

## Qué resuelve y qué significa

El diseño incorpora saldo operativo sólo cuando la persona activa
**Usar stock** en un producto. Con control activo, el POS descuenta la
cantidad confirmada en la unidad del producto. Con el control apagado,
el saldo queda fuera de operación. Actividad, control y saldo representan
decisiones independientes. El corte operativo conserva la clasificación
anterior como dato de compatibilidad.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Interpretación y tratamiento |
|---|---|
| «Muéstrame los productos con stock hasta cinco» | El filtro nativo incluye sólo los productos controlados, dentro del negocio y con saldo hasta cinco. Aclarar la unidad cuando sea relevante. El filtro se usa desde Productos. |
| «Reponer con esta factura» | Remitir a la revisión nativa OCR. El campo Stock propone la cantidad extraída cuando el producto usa stock. La persona revisa el producto y confirma el valor del campo y el modo sumar o reemplazar. |
| «Descuenta lo que vendí» | Dirigir al POS manual para confirmar la venta. Las capacidades operativas de NodiaAI para ventas y reportes son de solo lectura. |

## Operaciones y contratos

| Operación | Efecto | Flujo nativo implementado localmente |
|---|---|---|
| Controlar o ajustar stock | Activar/desactivar el control o editar el saldo | Alta y edición de Productos |
| Sumar o reemplazar desde OCR | Ajustar el saldo de un producto revisado | Confirmación de Facturas OCR |
| Confirmar venta | Descontar stock de los productos controlados | POS manual |
| Filtrar por stock máximo | Productos controlados con saldo menor o igual al umbral | Listado de Productos |

## Datos mínimos y resolución de dudas

Resolver el negocio y el producto exacto. Para ajustar desde OCR, usar
cantidad explícita en la unidad del producto y elegir sumar o reemplazar.
El campo Stock propone la cantidad extraída en modo **Sumar**, sin
conversión de unidad. La persona puede editar o borrar la propuesta.
Vacío omite el ajuste. Cero es un valor explícito y reemplazar por cero
agota el saldo. El saldo controlado admite hasta tres decimales. La
cantidad original de factura se guarda en `line.quantity`.

## Reglas, acceso y restricciones

Los flujos nativos requieren sesión y autoridad vigente sobre el destino
`/business`. La vinculación y la escritura se validan dentro del mismo
negocio. Las escrituras de stock descritas corresponden a los flujos nativos.
El catálogo vigente y sus schemas determinan las consultas y herramientas
disponibles para NodiaAI.

## Filtros e informes

El filtro nativo usa un máximo inclusivo sobre el saldo actual.
El grano es producto y la unidad es la del catálogo. Un umbral vacío omite
el criterio. Un saldo cero con control activo significa agotado. Las
lecturas existentes de Productos e Historial admiten saldos decimales y
marca de control desde la revisión 4. El filtro de stock máximo pertenece
al listado nativo.

## Vista previa, confirmación y recuperación

La revisión OCR presenta destino, saldo leído, modo, cantidad y saldo
proyectado. La persona confirma el valor visible en el campo Stock.
Al revisar el mismo destino se conserva el ajuste editado. Al cambiar de
destino se toma su saldo y se restaura la propuesta basada en la factura,
cuando el control está activo. Los recibos nativos permiten recuperar
confirmaciones y evitan un segundo ajuste o descuento tras un reenvío.

## Integración y evidencia

- [x] Plan, fuentes y estado documental enlazados.
- [x] Validar altas, ajustes, descuentos y filtro sobre los contratos nativos.
- [x] Verificar concurrencia, idempotencia y contratos de lectura en entorno aislado.
- [ ] Revisar contexto y bindings si se autoriza una futura publicación.

## Evolución y compatibilidad

| Revisión | Cambio | Compatibilidad |
|---|---|---|
| 1 | Diseño del control de stock opcional | Conservar el significado de historiales, recibos y propuestas previas. Los cambios de contratos requieren revisión coordinada. |
| 2 | Implementación local y lectura de cantidades exactas | Las capacidades de ventas siguen siendo de solo lectura. El retiro físico de `has_stock` queda en el corte. |
| 3 | Ajuste de presentación en Productos, OCR y búsqueda de POS | La alineación, el ancho del campo y el indicador de carga sólo afectan la interfaz. El contexto funcional conserva los mismos conceptos de cantidad, saldo y confirmación. |
| 4 | Propuesta de cantidad en el campo compacto de Stock de Facturas OCR | La factura conserva la cantidad extraída y el ajuste usa el valor del campo al confirmar. La regla se aplica en el borrador nativo. |
