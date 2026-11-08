---
{
  "schema_version": 1,
  "document_id": "businesses.product-units-and-fractional-sales",
  "product_id": "businesses",
  "kind": "feature",
  "revision": 2,
  "document_status": "draft",
  "implementation": {
    "status": "implemented",
    "notes": "R20 implementado, desplegado y verificado por alcance: vista previa y Cancelar/Confirmar/Confirmar e imprimir; ticket80mm sólo desde Sale confirmada y reimpresión con GET fresco sin duplicar checkout. Precio x unidad, Colaboradores al final, validación sólo roja y escala de texto e imágenes. Client2450/293, tipos/lint/build correctos; QA sintética8perfiles ESoscuro/ENclaro y confirmación320/390/600/1569; PDF80.09×89.24mm inspeccionado. Client6e141c…ff8f activo con173estáticos/169assets actuales/47previos, respaldo Nginx y un reload. Server55a06…5f08/KB070212…dc75/PIDs/Native/keyring/timers preservados, sin SQL/migraciones/inferencia. UI real productos10/ventas3/reportes12796CLP y tabs final comprobados sin mutación. No impresión física o diálogo nativo acreditados; fichas draft sin aprobación/publicación nuevas y44aprobadas intactas."
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento de Negocios y NodiaAI conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/94-business-point-of-sale-and-product-refactor.md",
      "kind": "specification"
    },
    {
      "path": "docs/architecture/decisions/ADR-090-product-units-and-fractional-sale-quantities.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/product/product-measurement-unit.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/sale/policies/sale-quantity.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/infrastructure/saleQuantities.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/config/businessSaleWorkspaceStorage.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/pages/BusinessDetail/components/SalesWorkspace/SaleLineList/SaleLineList.tsx",
      "kind": "implementation"
    }
  ],
  "verification": {
    "checked_on": "2026-10-30",
    "evidence_paths": [
      "docs/evidence/business-product-units-20261030-r01.json",
      "docs/evidence/business-pos-ticket-20261030-r01.json"
    ],
    "notes": "R20 implementado, desplegado y verificado por alcance: vista previa y Cancelar/Confirmar/Confirmar e imprimir; ticket80mm sólo desde Sale confirmada y reimpresión con GET fresco sin duplicar checkout. Precio x unidad, Colaboradores al final, validación sólo roja y escala de texto e imágenes. Client2450/293, tipos/lint/build correctos; QA sintética8perfiles ESoscuro/ENclaro y confirmación320/390/600/1569; PDF80.09×89.24mm inspeccionado. Client6e141c…ff8f activo con173estáticos/169assets actuales/47previos, respaldo Nginx y un reload. Server55a06…5f08/KB070212…dc75/PIDs/Native/keyring/timers preservados, sin SQL/migraciones/inferencia. UI real productos10/ventas3/reportes12796CLP y tabs final comprobados sin mutación. No impresión física o diálogo nativo acreditados; fichas draft sin aprobación/publicación nuevas y44aprobadas intactas."
  },
  "approval": null
}
---
# Unidades de producto y ventas con cantidades fraccionarias

## Actualización visual R20

Por solicitud posterior, −/100%/+ aumenta texto e imágenes del listado, sin modificar cantidades, precios o comandos. El precio se presenta x unidad. Se oculta el aviso visible de cambio de unidad, pero se conserva la guarda de comparabilidad; no se calcula un porcentaje entre unidades diferentes. Validación de cantidad roja y sin ayuda larga; ancho visual de cinco caracteres no limita precisión ni rango. El flujo comercial y los snapshots de R19 permanecen vigentes. Ver [ticket manual80mm](manual-sale-ticket-printing.md) y [evidencia R20](../../../../evidence/business-pos-ticket-20261030-r01.json).

## Qué resuelve

Registrar un producto manual sin conocer su código comercial y vender una cantidad fraccionaria con una unidad explícita. No introduce stock numérico, conversión de unidades ni precios por peso derivados del barcode.

## Datos y reglas

| Dato | Regla | Límite |
|---|---|---|
| Código de factura/proveedor | Opcional; vacío se guarda como null | No se fabrica un código ni se usa como identidad interna; barcode es independiente |
| Unidad del producto | Unidades (`unit`), Kilos (`kg`), Gramos (`g`), Atado (`bundle`) | Unidades por defecto; sin miligramos; cambiarla exige versión vigente |
| Cantidad | Hasta tres decimales para las cuatro unidades | Cero permanece mientras se edita; al confirmar se excluyen esas filas y sólo se envían cantidades positivas. Sin partidas positivas no se guarda |
| Eliminación | Basurero por partida, sin confirmación | Respetar bloqueo mientras exista operación o recuperación pendiente |
| Precio | CLP por la unidad declarada | Oferta seleccionada por flag, sin conversión kilo↔gramo ni descuento implícito |
| Subtotal | Precio × cantidad, redondeo half-up al peso por línea | Aritmética con milésimas enteras y dinero entero; total suma subtotales |
| Tamaño visible | − / porcentaje / +, 100% inicial | Pasos de10 entre80 y200; sólo presentación de la vista, no modifica cantidades o precios |

El listado muestra nombre, precio por unidad y subtotal. Guardar o consultar una venta conserva unidad, código, precio y cantidad de su snapshot. Cambiar después el catálogo no modifica la historia.

## Reportes y NodiaAI

Las cantidades vendidas se separan por unidad y por producto/unidad en ranking. No sumar kilos, gramos, atados y unidades como una misma medida. No comparar variaciones porcentuales de precios entre unidades diferentes; un dato ausente o no comparable no se convierte en cero. Ordenar cantidades expresadas en unidades distintas no equivale a comparar una magnitud física común; para comparar valor comercial usar el importe o limitar la unidad.

NodiaAI sigue pudiendo sólo obtener y mostrar ventas/reportes autorizados. Las fracciones y unidades no habilitan creación, edición, confirmación, anulación ni descarte mediante IA. Consultas usan backend y alcance actuales; no SQL libre.

## Recuperación y compatibilidad

Productos y partidas anteriores se migran a Unidades. Códigos nulos y unidades explícitas invalidan cualquier lógica que enlazaba productos sólo por un código vacío; altas masivas conservan el orden/identidad real.

Las altas individuales conservan su journal ante respuesta incierta. CSV no dispone de recibo idempotente: un alta incierta bloquea la instancia montada y conserva las filas; antes de iniciar otra importación se debe revisar manualmente el catálogo. No se adivina una asociación por nombre o código vacío y no se promete deduplicación entre nuevos workflows.

Workspace2 migra carritos y pendientes de workspace1 sin cambiar request_key ni hacer replay. El resultado incierto sigue conciliándose por recibo. La reversión del esquema rechaza fracciones, unidades nuevas o códigos nulos incompatibles; no se borran o redondean datos para forzar rollback.

## Verificación y estado

Implementado y desplegado conforme al recibo R19. Esta ficha continúa candidata, sin aprobación ni publicación; la evidencia distingue pruebas unitarias, integración SQL desechable, QA sintética y adopción real.
