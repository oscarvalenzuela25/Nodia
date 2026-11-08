---
{
  "schema_version": 1,
  "document_id": "businesses.sale-line-price-adjustments",
  "product_id": "businesses",
  "kind": "feature",
  "revision": 2,
  "document_status": "draft",
  "implementation": {
    "status": "implemented",
    "notes": "R24 implementado y adoptado en la VM con respaldo previo y posterior. Client2479/296 y Server5773/317+1omitida, tipos/lint/build y11comprobaciones SQL desechables correctos. QA ES oscuro/EN claro en320/390/600/1569: cantidades, precio temporal/permanente, error/reintento, alternancia, salida y formatos. PDFs80mm del HTML real inspeccionados, sin impresión física. Migración37→38 conserva70tablas y69tablas de dominio; NodiaAI conserva2lecturas/0escritores. Draft/unregistered/approval:null;44cuerpos aprobados intactos. No acredita teléfono/impresora físicos, nueva inferencia IA o aprobación/publicación documental. R26: editor de precio compacto y acciones alineadas; mientras está abierto se bloquean lector, búsqueda/selección, cantidades, eliminación, otros precios, medios, revisión de precios, nueva venta, cierre/alternancia y confirmación. El editor activo conserva sus acciones. Cancelar o guardar con éxito libera el bloqueo; un rechazo conserva el valor y el bloqueo. Sólo estado transitorio de Client, sin nuevos contratos HTTP/BD o autoridad NodiaAI. Verificación local y adopción por alcance en el recibo R26; no hay nueva aprobación/publicación documental. R26 implementado y desplegado con respaldo/fallbackR25 y un reload Nginx. Client2486pruebas/297archivos en399.03s,12focales/3archivos, tipos/lint0 y build32.075s correctos. QA sintética ESoscuro/ENclaro en320/390/600/1569: input108px (84px en320), iconos44px centrados, bloqueos, rechazo400 con borrador, cancelar/guardar, teclado/panelmóvil/escala200% y0overflow correctos. 173estáticos/169assets actuales/32previos y túnel5174 verificados; runtime Server/KB/Native/keyring/timers intacto. Cero SQL, inferencias o mutaciones comerciales reales;44Markdown aprobados byte-idénticos. Sin nueva aprobación/publicación documental ni aceptación física móvil."
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento de Negocios y NodiaAI conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/94-business-point-of-sale-and-product-refactor.md",
      "kind": "specification"
    },
    {
      "path": "docs/architecture/decisions/ADR-091-manual-sale-line-prices-and-pos-exit.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/sale/dto/sale-command.dto.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/sale/policies/sale-policy.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/sale/use-case/mutate-sale.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/sale/entities/sale-item.entity.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/migrations/1793450000000-AddManualSaleLinePrices.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-products/contracts/sales.schema.json",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-products/business/sales-tool-family.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-reports/config/report-sources.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/infrastructure/salesPolicies.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/pages/BusinessDetail/components/SalesWorkspace/SaleLinePrice/SaleLinePrice.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/pages/BusinessDetail/components/SalesWorkspace/SaleLinePrice/priceChange.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductModal/productPricing.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/infrastructure/useSalePriceEditing.ts",
      "kind": "implementation"
    }
  ],
  "verification": {
    "checked_on": "2026-10-31",
    "evidence_paths": [
      "docs/evidence/business-pos-usability-20261031-r24.json",
      "docs/evidence/business-pos-price-editor-20261031-r26.json"
    ],
    "notes": "R24 implementado y adoptado en la VM con respaldo previo y posterior. Client2479/296 y Server5773/317+1omitida, tipos/lint/build y11comprobaciones SQL desechables correctos. QA ES oscuro/EN claro en320/390/600/1569: cantidades, precio temporal/permanente, error/reintento, alternancia, salida y formatos. PDFs80mm del HTML real inspeccionados, sin impresión física. Migración37→38 conserva70tablas y69tablas de dominio; NodiaAI conserva2lecturas/0escritores. Draft/unregistered/approval:null;44cuerpos aprobados intactos. No acredita teléfono/impresora físicos, nueva inferencia IA o aprobación/publicación documental. R26: editor de precio compacto y acciones alineadas; mientras está abierto se bloquean lector, búsqueda/selección, cantidades, eliminación, otros precios, medios, revisión de precios, nueva venta, cierre/alternancia y confirmación. El editor activo conserva sus acciones. Cancelar o guardar con éxito libera el bloqueo; un rechazo conserva el valor y el bloqueo. Sólo estado transitorio de Client, sin nuevos contratos HTTP/BD o autoridad NodiaAI. Verificación local y adopción por alcance en el recibo R26; no hay nueva aprobación/publicación documental. R26 implementado y desplegado con respaldo/fallbackR25 y un reload Nginx. Client2486pruebas/297archivos en399.03s,12focales/3archivos, tipos/lint0 y build32.075s correctos. QA sintética ESoscuro/ENclaro en320/390/600/1569: input108px (84px en320), iconos44px centrados, bloqueos, rechazo400 con borrador, cancelar/guardar, teclado/panelmóvil/escala200% y0overflow correctos. 173estáticos/169assets actuales/32previos y túnel5174 verificados; runtime Server/KB/Native/keyring/timers intacto. Cero SQL, inferencias o mutaciones comerciales reales;44Markdown aprobados byte-idénticos. Sin nueva aprobación/publicación documental ni aceptación física móvil."
  },
  "approval": null
}
---

# Ajustes de precio por partida — contexto funcional candidato

## Qué resuelve y qué significa

El lápiz del precio permite elegir un importe para esta venta o guardar permanentemente el precio normal del producto. «Sólo esta venta» modifica el carrito activo y después el importe de su partida al confirmar; no actualiza Producto. «Permanente» cambia el catálogo, desactiva la oferta y actualiza la partida originaria con el resultado confirmado del Producto. No son el mismo efecto ni una operación fiscal o de cobro.

El precio normal, la oferta y su flag conservan su significado. Una oferta es un precio adicional, no exige una comparación menor que el normal. Un ajuste manual tampoco calcula porcentajes de descuento. La venta congelada conserva esos valores observados y distingue el precio final mediante el origen manual. Ver [plan94 §33](../../../../mvp/94-business-point-of-sale-and-product-refactor.md#33-precios-por-partida-salida-del-pos-y-legibilidad--r24-2026-10-31) y [ADR091 propuesto](../../../../architecture/decisions/ADR-091-manual-sale-line-prices-and-pos-exit.md).

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención y aclaración | Respuesta permitida |
|---|---|---|
| «Muéstrame el precio que se vendió» | Resolver negocio y venta o período; distinguir catálogo actual de importe guardado | Consultar la venta autorizada y mostrar su unit_price/origen/snapshots |
| «¿Cuánto vendimos en el período?» | Aclarar fechas y negocio; total registrado, no cobrado | Usar lecturas/informes existentes con importe final y America/Santiago |
| «Cambia el precio sólo para esta venta» | Una escritura de venta, aunque aún no se haya confirmado | Explicar el lápiz del POS manual; NodiaAI no prepara ni ejecuta esa escritura |
| «Guárdalo para ventas futuras» | Cambio de Producto distinto del ajuste de partida | Remitir al flujo manual explícito de precio normal y desactivación de oferta; esta ficha no publica una herramienta de Producto |

## Operaciones y contratos

| Operación | Efecto y fuente | Resultado público y autoridad |
|---|---|---|
| Ajustar sólo la partida | Edición local unit_price_override y checkout manual mediante SaleCommandDto/sale-policy | Origen manual y precio final al confirmar; no PUT de Producto |
| Guardar permanentemente | GET vigente y PUT existente de Producto, expected_version, sale_price normal, costes asistidos e is_offer_enabled=false | Catálogo actualizado y partida originaria reconstruida con la respuesta; no transacción distribuida con el carrito |
| Consultar venta | nodia_sales_get y nodia_sales_list, familia revisión3 y sales-read/3 en el Server adoptado | Datos autorizados de la venta y sus partidas; sólo lectura |
| Consultar informes | Fuentes de ventas y partidas existentes | Importes registrados provenientes de snapshots, sin añadir un escritor o SQL libre |

Las selecciones manuales requieren `/tools/business` y la autoridad del negocio. Las herramientas de lectura conservan sus gates y módulo real; la compilación o el Markdown no habilitan ninguna operación.

## Datos mínimos y resolución de dudas

| Dato | Regla | Significado |
|---|---|---|
| product_id, cantidad, versión y expected_unit_price | Mantienen sus requisitos existentes | El precio esperado sigue siendo el efectivo de catálogo observado, no el elegido manualmente |
| unit_price_override | Opcional; null/omisión no ajustan; cadena CLP canónica no negativa dentro de bigint | Precio final de esta partida; no oferta nueva ni campo persistido de Producto |
| Precio normal permanente | Límite propio de Producto 0–2.147.483.647 y versión vigente | Reutiliza ProductModal para asistir costes manteniendo margen e impuesto inferido; no crea datos fiscales |
| quantity | Hasta tres decimales y unidad histórica | Subtotal half-up al peso por partida; no conversión entre unidades |
| request_key | Intención nativa conservada antes del envío | Conciliación/reintento de la misma operación cuando corresponda, sin crear otra venta |

El total confirmado debe seguir siendo positivo. Cero y ausencia son diferentes. Cambiar permanentemente un Producto no reescribe las otras ventas locales abiertas: conservan sus snapshots y deberán revisar versiones/precios que hayan cambiado.

## Reglas, acceso y restricciones

Server conserva ownership, módulo, disponibilidad, unidad, versión, locks e idempotencia. `price_source` admite regular, offer y manual. En una partida manual, `unit_price` guarda el precio final y se mantienen regular_unit_price, offer_price_snapshot e is_offer_enabled_snapshot observados. `sale_events.changes.manual_prices` conserva la procedencia en la transacción nativa de venta/recibo.

La migración1793450000000 sólo reemplaza dos CHECK de sale_items; no añade una columna override ni transforma filas anteriores. El down bloquea ante datos manuales actuales, snapshots de recibos o auditoría. La migración preparada no acredita que se haya aplicado a un entorno.

NodiaAI sólo obtiene y muestra ventas/reportes. No ajusta precios de una venta, crea, edita, confirma, anula ni descarta ventas, tampoco mediante propuestas históricas. No imprime. Las operaciones de Producto ya existentes se rigen por sus propios contratos y fichas publicadas, no se amplían mediante este borrador.

## Filtros e informes

Las fuentes existentes de ventas/partidas leen los importes finales congelados; el catálogo posterior no recalcula un período anterior. `price_source=manual` forma parte del contrato de partidas donde está declarado. Cantidades y ranking mantienen la separación por unidad de R19; CLP y America/Santiago no cambian. No se prometen nuevas métricas, filtros combinables o conversiones por añadir este documento.

## Vista previa, confirmación y recuperación

La vista previa siempre muestra todas las partidas positivas y su precio final. Cancelar no confirma una venta. Confirmar guarda sin imprimir; los botones separados de confirmar e imprimir vale o con detalle fijan el formato antes de esperar y sólo imprimen después de recibir una Sale confirmada.

El ajuste local permanece en el carrito hasta guardar o descartarlo de forma segura. El guardado permanente usa el Producto vigente y conserva el editor cuando falla; no promete revertir un catálogo ya persistido si el paso local posterior falla. No hay replay automático de un PUT o checkout de resultado incierto. La recuperación nativa de ventas conserva su identidad/payload y consulta el recibo antes de concluir el resultado.

La salida confirmada del POS descarta todos los carritos locales sólo si no hay operaciones activas, resultado pendiente o error de almacenamiento. Alternar ventas conserva los datos. Ver la [ficha de workspace](multi-sale-workspace.md).

## Integración y evidencia

- [x] Reglas confirmadas y contratos locales de comando, política, snapshots, auditoría, migración y editor contrastados.
- [x] Familia local de lectura revisión3/sales-read/3 sin añadir escritores de ventas.
- [x] Repin controlado, compilación y verificación final de integración del alcance R24.
- [x] SQL desechable, migración y despliegue objetivo acreditados por el recibo R24.
- [ ] Aprobación documental y publicación de esta ficha; permanece draft/unregistered/approval:null.

El [recibo consolidado R24](../../../../evidence/business-pos-usability-20261031-r24.json) acredita las pruebas, SQL y adopción por alcance. No se ejecutó inferencia IA nueva, operación comercial real ni impresión física para este QA.

## Evolución y compatibilidad

| Revisión | Cambio | Compatibilidad |
|---|---|---|
| 1 | R24: ajuste por partida y cambio permanente separados | Conserva snapshots y contratos de autoridad; amplía origen manual y lecturas a sales-read/3. Borrador excluido, sin aprobación ni herramientas de escritura nuevas |


## Edición exclusiva y presentación R26 — 2026-10-31

El editor manual usa un input compacto con label arriba y los tres iconos centrados con el input. Mientras está abierto, los otros cambios de la venta quedan deshabilitados: añadir productos, cantidades, eliminar, otros precios, pago, revisión, nueva venta, cerrar/alternar y confirmar. El precio escrito no se aplica hasta elegir una acción de guardado. Cancelar o guardar correctamente permite continuar; un rechazo mantiene el texto editable y el bloqueo. La edición se identifica por venta/producto y no se persiste ni se comparte con otra venta. El cambio de tamaño o panel móvil conserva el editor; el descarte explícito al salir del POS mantiene su confirmación existente.

Evaluación de impacto: el ancho/alineación sólo cambia presentación; el bloqueo documenta una garantía de interacción del POS manual. Sin cambios en DTO, transacciones, autoridad, herramientas o publicación NodiaAI. Esta revisión sigue candidata sin aprobación. Evidencia por alcance: [R26](../../../../evidence/business-pos-price-editor-20261031-r26.json).
