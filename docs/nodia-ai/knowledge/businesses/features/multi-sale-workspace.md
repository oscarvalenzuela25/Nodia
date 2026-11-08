---
{
  "schema_version": 1,
  "document_id": "businesses.multi-sale-workspace",
  "product_id": "businesses",
  "kind": "feature",
  "revision": 13,
  "document_status": "draft",
  "implementation": {
    "status": "implemented",
    "notes": "ServerR11 y ClientR28 adoptados y verificados. R10 aplicó una sola migración44→45 con2DROP e invariantes de94tablas; su arranque falló por hashes estáticos de26contratos y quedó detenido. R11 recuperó el runtime con5JSON/assets,0DDL/0escriturasDB adicionales y API/Worker estables30s; no se repitió la migración. ClientR28 tuvo una activación/recarga,186outputs actuales verificados y assets históricos conservados. NativeR12, flags, entorno, auth y timers preservados. Client: 308 pruebas/25 suites, typecheck y lint correctos. Server: corrida inicial315/23 y posterior de metadatos159/3, parcialmente solapadas y sin sumarlas; typecheck de producción/lint correctos y fallo de specs WIP ajenos conservado. Una regresión adicional de bundle pasó (100casos filtrados, no101pruebas) y se verificaron153contratos/12familias más el constructor real LoadNodiaAiKnowledge. Sin OCR/guardado comercial reales, atomicidad global o aprobación/publicación nueva; cortesR24anteriores históricos."
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento de Negocios y NodiaAI conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/94-business-point-of-sale-and-product-refactor.md",
      "kind": "specification"
    },
    {
      "path": "docs/architecture/decisions/ADR-088-local-sale-workspaces-and-recovery.md",
      "kind": "specification"
    },
    {
      "path": "docs/architecture/decisions/ADR-087-atomic-point-of-sale-checkout.md",
      "kind": "specification"
    },
    {
      "path": "nodia-client/src/modules/business/infrastructure/useSaleDraft.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/infrastructure/saleWorkspaceEngine.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/config/businessSaleWorkspaceStorage.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/config/businessSaleRecoveryStorage.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/store/authStore.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/pages/BusinessDetail/components/SalesWorkspace/SalesWorkspace.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/infrastructure/usePosCatalog.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/pages/BusinessDetail/components/SalesWorkspace/ProductPrice/ProductPrice.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/pages/BusinessDetail/components/SalesWorkspace/QuantityStepper/QuantityStepper.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/sale/dto/sale-command.dto.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/sale/types/sale.types.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/pages/BusinessDetail/components/SalesWorkspace/OpenSaleTabs/OpenSaleTabs.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/infrastructure/salesPolicies.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/pages/BusinessDetail/components/SalesWorkspace/PaymentMethodButtons/PaymentMethodButtons.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/pages/BusinessDetail/components/SalesWorkspace/styles.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/pages/BusinessDetail/components/SalesWorkspace/PosProductCatalog/styles.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/pages/BusinessDetail/components/SalesWorkspace/QuantityStepper/styles.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductModal/ProductModal.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/pages/BusinessDetail/components/ProductsTab/ProductsTab.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductImageThumbnail/ProductImageThumbnail.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductSalePrice/ProductSalePrice.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/components/BusinessMobileCards/BusinessMobileCards.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/pages/BusinessDetail/BusinessDetail.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/product/dto/create-product.dto.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/product/entities/product.entity.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductModal/productPricing.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/infrastructure/useSaleLineImages.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/pages/BusinessDetail/components/SalesWorkspace/SaleLineList/SaleLineList.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/pages/BusinessDetail/components/SalesWorkspace/SalesRecords.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/pages/BusinessDetail/components/SalesWorkspace/SalesReports.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/theme/tablePanel.ts",
      "kind": "implementation"
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
      "path": "nodia-server/src/sale/entities/sale-item.entity.ts",
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
      "path": "nodia-client/src/modules/business/infrastructure/salesSchemas.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/infrastructure/useSaleTicketPrinting.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/pages/BusinessDetail/components/SalesWorkspace/SaleTicket/SaleTicket.tsx",
      "kind": "implementation"
    },
    {
      "path": "docs/architecture/decisions/ADR-091-manual-sale-line-prices-and-pos-exit.md",
      "kind": "specification"
    },
    {
      "path": "docs/nodia-ai/knowledge/businesses/features/sale-line-price-adjustments.md",
      "kind": "specification"
    },
    {
      "path": "nodia-client/src/modules/business/infrastructure/useSaleExitGuard.ts",
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
      "path": "nodia-server/src/sale/policies/sale-policy.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/migrations/1793450000000-AddManualSaleLinePrices.ts",
      "kind": "implementation"
    },
    {
      "path": "docs/nodia-ai/knowledge/businesses/features/product-price-calculator-and-invoice-binding.md",
      "kind": "specification"
    }
  ],
  "verification": {
    "checked_on": "2026-11-06",
    "evidence_paths": [
      "docs/evidence/business-pos-multi-sale-20261029-r01.json",
      "docs/evidence/business-pos-purchase-list-20261030-r01.json",
      "docs/evidence/business-sales-reports-ui-20261030-r01.json",
      "docs/evidence/business-mobile-20261030-r01.json",
      "docs/evidence/nodia-ai-sales-readonly-20261030-r01.json",
      "docs/evidence/business-pos-sale-actions-20261030-r01.json",
      "docs/evidence/business-product-units-20261030-r01.json",
      "docs/evidence/business-pos-ticket-20261030-r01.json",
      "docs/evidence/business-pos-followup-20261030-r21.json",
      "docs/evidence/business-pos-receipt-detail-20261030-r22.json",
      "docs/evidence/business-pos-usability-20261031-r24.json",
      "docs/evidence/business-product-pricing-20261106-r01.json"
    ],
    "notes": "CUA autenticada1088/320 comprobó precios normal/oferta16px/700 y oferta roja, ausencia de margen, sugerencia30→40% con venta350intacta, venta manual990sin cambiar costos226/269 y Aplicar377sólo en borrador. Cancelar/reabrir conservó venta guardada350 y reinició30%; no se pulsó Guardar ni ejecutó OCR/proveedor. Móvil: diálogo288px, acciones256×44 y catálogo310client=scroll, sin overflow. La vinculación OCR se acredita con pruebas atómicas y fixture sintética, no con OCR/guardado reales. Conocimiento cerradoR04: release430bf6e7…/registrob9bdd8b2…; checkout96923334…/checkb8ad5d88… independiente por la admisión audioWIP no adoptada.81fuentes/37excluidas/44aprobadas/46fragmentos/153capacidades; cuerpos aprobados y fragmentos byte-idénticos, candidata excluida y sin aprobación/publicación nueva. PRE/restore verificados con filas/secuencias y22checks de esquema equivalentes, no identidad raw schema. R10fallido y R11recuperado son recibos distintos. Evidencia consolidada sin nueva aprobación."
  },
  "approval": null
}
---
# Varias ventas locales — contexto funcional candidato

## Producto manual: regla posterior del 2026-11-06

[Plan94 §35](../../../../mvp/94-business-point-of-sale-and-product-refactor.md#35-precios-independientes-calculadora-local-y-vinculación-ocr-revisada--2026-11-06) y la [nueva ficha candidata](product-price-calculator-and-invoice-binding.md) sustituyen la derivación bidireccional de costos/venta descrita en los cortesR14 inferiores. Venta queda independiente; el porcentaje no persiste y sólo Aplicar utiliza la sugerencia local sobre bruto. El vínculo neto/bruto por IVA se conserva. Los contratos del POS manual, recibos y precios por partida no se amplían; NodiaAI sigue sólo lectura en ventas. Implementación local y comprobaciones en la [evidencia consolidada](../../../../evidence/business-product-pricing-20261106-r01.json); ServerR11/ClientR28 adoptados y verificados, con R10fallido conservado como historia. Historia/aprobaciones no se reescriben.

## Corte R24: precios y salida de todos los carritos locales

El [ajuste por partida](sale-line-price-adjustments.md) conserva el catálogo observado y sólo modifica el precio final de esa venta. Guardar permanentemente el precio normal y desactivar la oferta es una acción de Producto separada; sólo el carrito originario toma la respuesta confirmada. Las demás ventas abiertas mantienen sus datos y exigirán revisar un catálogo que cambió.

Alternar Venta 1/Venta 2 conserva sus productos, cantidades, medio, barcode y ajustes. Salir del POS a otra sección, negocio o ruta requiere confirmar si hay datos locales; aceptar descarta todos los carritos del ámbito y volver inicia Venta 1 vacía. Se conserva todo si se cancela. La salida no puede descartar resultados inciertos/pendientes, operaciones en curso ni un workspace con error de almacenamiento. clearForExit guarda el estado vacío antes de permitir navegar; un fallo no continúa. La recuperación de recarga/journals conserva su identidad y no es autorización para borrar o reenviar.

El input transforma sólo punto/coma inicial aislado a0./0, para escribir fracciones; mantiene tres decimales y cero editable. La vista previa siempre muestra detalle, sin switch; Cancelar/Confirmar/Confirmar e imprimir vale/Confirmar e imprimir con detalle conservan sus efectos separados. El formato se captura por llamada antes del guardado y sólo se imprime la Sale confirmada. Ver [impresión manual](manual-sale-ticket-printing.md) y [plan94 §33](../../../../mvp/94-business-point-of-sale-and-product-refactor.md#33-precios-por-partida-salida-del-pos-y-legibilidad--r24-2026-10-31).

La tabla Productos oculta tres columnas adicionales por defecto (9/12); es exclusivamente visual y conserva consulta, filtros, acciones, comparación y cards. La [evidencia R24](../../../../evidence/business-pos-usability-20261031-r24.json) debe cerrar las verificaciones globales/SQL/adopción del nuevo alcance. Esta revisión11 sigue draft/unregistered/approval:null; los cortes R13–R23 inferiores no reemplazan estas reglas de salida o confirmación.

## Corte histórico R22: vale y detalle opcional — 2026-10-30

El usuario solicita dos formatos: Imprimir vale omite únicamente la lista de productos; Imprimir ticket conserva el detalle. Ambos muestran los mismos negocio, título, ID/fecha cuando corresponde, total CLP, medio de pago y pie. No se recalcula ni modifica la venta al elegir formato. Un vale no es una venta distinta ni un documento fiscal nuevo.

En el panel de una venta confirmada, Anular venta e Imprimir vale comparten la primera fila; Imprimir ticket ocupa el ancho completo debajo. En xs las acciones conservan ancho completo y objetivos44px. El último recibo retenido también ofrece ambos formatos; se evita duplicar ese aviso cuando coincide con la venta mostrada en el panel.

Cada apertura de Confirmar venta comienza con Mostrar detalle apagado. Activarlo añade las partidas a la vista previa; apagarlo las retira. Confirmar e imprimir captura esa elección antes de guardar/esperar: imprime con la Sale confirmada, nunca un carrito provisional. Si falla checkout, el diálogo conserva la elección y los datos. Cancelar/reabrir inicia otra vez sin detalle. Confirmar sin imprimir mantiene su comportamiento.

Reimprimir un vale o ticket requiere el mismo GET fresco autorizado por ID/negocio/estado confirmado, usando snapshots. El formato es un argumento local por llamada, sin campo BD, preferencia persistida, permiso o herramienta IA nuevos. Los builders conservan detalle por defecto para callers existentes y la UI pasa true/false explícitos. Incluso sin detalle se validan todas las partidas/importes; únicamente lines resulta vacío en el documento, sin ocultar productos mediante CSS.

[Plan94 §31](../../../../mvp/94-business-point-of-sale-and-product-refactor.md#31-vale-y-ticket-con-detalle-opcional--r22-2026-10-30) y [evidencia R22](../../../../evidence/business-pos-receipt-detail-20261030-r22.json). Implementación y adopción Client verificadas; QA sintética ES/EN320/390/600/1569 y lectura real sin mutaciones. Transporte80mm y acceso Chrome de caja no cambian; impresión física y Opera mantienen su calificación pendiente. NodiaAI conserva sólo obtener y mostrar ventas/reportes; esta revisión candidata no se publica.

## Ajuste R21 y navegador de caja — 2026-10-30

El panel de una venta guardada muestra Anular venta e Imprimir ticket con dimensiones equivalentes. Se retira Consultar venta guardada de ese panel y su estado/modal local sin caller; el detalle e historia de Ventas se mantienen. Las ventas locales abiertas envuelven a la fila siguiente, con IDs, selección, importes, foco y navegación por teclado vigentes; no cambia el almacenamiento ni checkout.

El usuario indica que usará Chrome u Opera. Se confirma Chrome156 instalado y POS-80 predeterminada de Windows; se prepara el acceso de escritorio Nodia Caja (Chrome) con perfil propio y --kiosk-printing. Ese flag está documentado en la [fuente de Chromium](https://github.com/chromium/chromium/blob/main/chrome/common/chrome_switches.h) para confirmar automáticamente imprimir. La configuración pertenece al navegador de caja; no es una capacidad web, herramienta IA o transporte Server nuevo.

El acceso no copia autenticación, no modifica el navegador habitual o registro ni envía papel al crearlo. Se debe iniciar sesión en el perfil de caja y verificar el papel80mm del driver; la API de Windows devuelve tamaño desconocido, sin dimensiones verificables. No se promete cero parpadeo de vista previa, impresión física o disponibilidad de hardware. Opera y el navegador integrado no se califican por compartir motor. [Evidencia R21](../../../../evidence/business-pos-followup-20261030-r21.json) distingue preparación local, CI/QA y adopción Client.

## Base visual R20 y corte previo de confirmación — 2026-10-30

Por solicitud posterior del usuario, el porcentaje incluye ahora las imágenes además del texto; sustituye el alcance visual de R19. Conserva100% inicial, pasos10 entre80–200 y los mismos importes/comandos. A200% la imagen o placeholder80px pasa a160px; la fila se redistribuye en móvil.

Se usa x unidad en precios; el aviso visible de unidades no comparables se retira, conservando la guarda que evita porcentajes entre unidades distintas. Cantidad mantiene tres decimales y el máximo vigente, con error rojo/aria-invalid sin ayuda larga. Su ancho visual ronda cinco caracteres, sin maxlength o reducción de capacidad. Revisar precios y −/+ tienen hover/foco y objetivos táctiles44px. Colaboradores queda al final de tabs y selector xs.

La [ficha de impresión manual](manual-sale-ticket-printing.md) describe vista previa, Cancelar/Confirmar/Confirmar e imprimir, guardado antes de imprimir y reimpresión mediante GET fresco sin repetir checkout. El ticket80mm sólo usa snapshots de venta confirmada. NodiaAI permanece de sólo lectura. [Evidencia R20](../../../../evidence/business-pos-ticket-20261030-r01.json); la impresión física y la publicación de estas fichas continúan pendientes.

## Corte R19 de unidades y cantidades — 2026-10-30

[Plan94, sección28](../../../../mvp/94-business-point-of-sale-and-product-refactor.md#28-unidades-cantidades-fraccionarias-y-presentación-del-listado--2026-10-30), [ADR090 propuesto](../../../../architecture/decisions/ADR-090-product-units-and-fractional-sale-quantities.md) y la [ficha de unidades](product-units-and-fractional-sales.md) describen la ampliación vigente. Los recibos y apartados R13–R18 inferiores son históricos: sus observaciones de cantidades enteras o eliminación al llegar a cero no son la regla R19.

- El código de factura/proveedor es opcional; vacío se guarda como null. El producto conserva su ID interno estable y un código de barras independiente. Los códigos informados mantienen su unicidad por negocio.
- Cada producto tiene Unidades (`unit`, valor inicial), Kilos (`kg`), Gramos (`g`) o Atado (`bundle`). Cambiarla exige la versión vigente del producto. No se añaden miligramos ni conversiones automáticas. Cada partida conserva la unidad de su snapshot; cambiar después el catálogo no reinterpreta la venta guardada.
- La cantidad admite hasta tres decimales en las cuatro unidades. Cero permanece editable en la lista y su subtotal es cero. Al confirmar, las filas a cero se excluyen automáticamente y sólo se envían las partidas positivas; si no queda ninguna, no se guarda una venta. El basurero elimina únicamente esa partida sin confirmación, respetando los bloqueos de una operación pendiente o incierta. Reescanear el mismo producto vigente suma uno en el carrito activo.
- La lista muestra nombre, precio CLP por la unidad declarada y subtotal; la oferta habilitada conserva su precio efectivo. Cada subtotal redondea precio × cantidad al peso mediante half-up y el total suma esos subtotales. No se mezclan aritmética monetaria float ni conversiones entre kilos y gramos. Revisar precios vigentes rechaza un cambio de unidad de una partida; no cambia silenciosamente su significado.
- Después de Revisar precios vigentes, los controles − / porcentaje / + ajustan sólo el tamaño visible de nombres, precios, cantidades y subtotales: 100% inicial, pasos de10 entre80 y200. No modifican precios, cantidades ni el comando comercial.

Workspace2 conserva los carritos, el ámbito actor/negocio y las claves pendientes de workspace1. Primero guarda la representación nueva y después retira la anterior; migrar o recuperar no reenvía una venta. Los carritos locales no cuentan como ventas registradas. Los reportes separan cantidades por unidad y el ranking por producto/unidad histórica; no se presenta una suma de kilos, gramos, atados y unidades como una cantidad física única ni un porcentaje comparativo de precios entre unidades diferentes.

NodiaAI mantiene sólo las lecturas autorizadas de ventas/reportes. No crea, edita, confirma, anula o descarta ventas, tampoco mediante preparaciones o propuestas antiguas. El checkout y las demás acciones comerciales del POS son manuales. R19 está en curso: la [evidencia por alcance](../../../../evidence/business-product-units-20261030-r01.json) registra integración, pruebas y adopción separadas; este texto no acredita su finalización. La ficha continúa draft/unregistered/approval:null y las44 fichas aprobadas permanecen intactas.

## Alcance actual de NodiaAI sobre ventas — R17

R17 (2026-10-30): NodiaAI queda limitado a obtener y mostrar ventas/reportes. Retiradas cinco preparaciones comerciales; el POS manual y las dos lecturas/fuentes de informes se conservan. Registro, ejecución histórica y adopción se verifican por alcance; no se publica la ficha candidata nueva ni se cambia la aprobación de POS5. Véase [Ventas y reportes de solo lectura](sales-and-reporting-read-only.md) y Plan94 §26. Las referencias inferiores a escrituras de ventas por IA describen cortes anteriores y no las rehabilitan.

## R15: filtros, tablas y entrada de productos — 2026-10-30

[Plan94, sección24](../../../../mvp/94-business-point-of-sale-and-product-refactor.md#24-filtros-tablas-y-entrada-de-productos--r15-2026-10-30) mantiene contratos Server y confirma presentación: Filter compartido con borrador/aplicar/cancelar/limpiar, chips debajo y búsqueda fuera de la tabla de Ventas con paginado real. Reportes usa cuatro MUIcards independientes y «Promedio por venta» con ratio exacto/≈/redondeo; null o denominador0 permanecen desconocidos. Ranking top10 por métrica mantiene orden Server y carece de paginado/total global inventados. Panel estándar8px, toolbar fuera y primera fila primary; barcode primero/ancho completo/foco por apertura, breadcrumb sin margen y vacío centrado20px/16px.

[Recibo R15](../../../../evidence/business-sales-reports-ui-20261030-r01.json): suite2386/288 en210.80s,12Reportesfinales6.30s y3vacío finales3.80s posteriores a correccionesMUI; tipos/lint/build0,12.25s con warning preexistenteapi>500kB. QA8perfiles320/390/600/1569 ESoscuro/ENclaro/24vistas0overflow:radio8,centro≤.008,4cards y top10;Ventas25+19 y flujos de filtros/error/barcode. Productos conserva13columnas/oferta estrecha como límite histórico, sin nueva quiebra o legibilidad global acreditada.

Client70914765…ddf3 activo,173estáticos/169assets actuales/47previos;42paths(22modificados/20nuevos),1251inputs/FPR74316213…a171 y runtimeServer/KB/PIDs/Native/keyring/timers idéntico,sinSQLdirecto/Serverrestart/migraciones/inferencia. UIreal IAB1280×720 ESoscuro:Ventas2filas6064CLP;Reportes2ventas/4unidades/promedio≈3032/ranking1producto,4cards221.5px/tabla8/0overflow. Vacío POS centradoY0/X.0078,región285.44px/título20/ayuda16;tablaProductos8filas/radio8. Nuevoform barcodeprimero582px/trescampos,autofocus+0000123456789/Enter conserva diálogo sinerrores oSave;Cancelar mantiene8productos. Filtros reales sólo abiertos/cancelados,sinApply. SinSave/Confirm/imagen/inferencia,pestaña propia4cerrada y3pestañasusuario intactas. No checkout comercial/hardware/performance probado por este cambio.

Impacto de contexto: presentación sobre lecturas/edición y operaciones vigentes; no cambia dinero, fechas Santiago/completed_at, estados, permisos, herramientas o fuentes IA. Ficha3 draft/implemented/unregistered/approval:null y44aprobadas intactas, sin aprobación/publicación nuevas. Los apartados R14/R13 inferiores conservan sus cortes históricos.

## R14: lista de compra y edición manual — 2026-10-30

Esta revisión sustituye la composición visible R13: izquierda sólo partidas seleccionadas con imagen/nombre/precio y −/cantidad/+, búsqueda desplegable y barcode para agregar; sin catálogo completo o productos a0. Derecha Total→medios→Confirmar sin duplicar líneas; ambos paneles comparten altura clamp620–1040px. La composición móvil conserva un único estado. Cabecera del negocio inicialmente colapsada conserva tabs/selector y contenido montados. El motor multicarrito/snapshot/recuperación y la operación checkout no cambian.

Nuevo producto **manual** inicia has_stock=true; edición conserva false/null históricos y CSV/OCR/imports no reciben ese default. Al cambiar sale_price se conservan margen y tasa y se calculan cost_price_tax=round(sale_price/(1+margen/100)), después cost_price=round(cost_price_tax/(1+IVA/100)); el sentido hacia adelante sigue vigente. Se mantienen redondeo CLP/validaciones y no se promete identidad algebraica después de redondear. El helper rechaza derivados no finitos/fuera de rango y bloquea Guardar sin clamp. Abrir una historia no la recalcula; el CSV legacy cost_price_tax114 se conserva como componente de impuesto de ese ejemplo, sin reinterpretarlo o normalizarlo a la fórmula nueva.

Tabla y tarjetas usan miniatura50px para abrir el visor vigente, incluso con fallback de imagen ausente/fallida; abrir no guarda. Nombre sin barcode añadido. Oferta sólo con flag activo y precio real válido arriba/error.main, normal debajo; flag inactivo/null/importe inválido ocultan oferta y0 habilitado sigue siendo real. El alternativo puede ser mayor al normal, sin descuentos calculados.

Las imágenes de partidas son sólo metadatos de presentación: [useSaleLineImages](../../../../../nodia-client/src/modules/business/infrastructure/useSaleLineImages.ts) usa actor+sessionVersion+negocio, cache30s y seeds del producto ya leído para no hacer otro GET. Al recargar consulta sólo seleccionados faltantes en lotes100, como máximo2 para200partidas; no repricia el snapshot. [SaleLineList](../../../../../nodia-client/src/modules/business/pages/BusinessDetail/components/SalesWorkspace/SaleLineList/SaleLineList.tsx) es la única lista de compra. El selector conserva popup/scroll durante fetch y bloquea input/opciones sin desmontar la lista; [productPricing](../../../../../nodia-client/src/modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductModal/productPricing.ts) concentra la ayuda pura del formulario.

QA8perfiles320/390/600/1569 ESoscuro/ENclaro:paneles780px a1000px de alto,20partidas izquierda/0derecha, Total primero y4medios84px+Confirm56px;0overflow/cola. Popup24→48 mantiene UL/top2187 sin3página; retención layout/RAF cancelada por actor/sesión/negocio/búsqueda cruda/cierre. Oferta20px/700/error.main sobre blanco3.763:1 cumple texto grande3:1, sin afirmar4.5:1. Formulario1516→1166/980(tasa19/margen30), base1000→1190/1547,0→costes0;Cancelar0writes. Dos carritos/recarga, imágenes19IDs1GET/seeds0extra,400 conserva modal y503postcommitmock→1GETreceipt cierra sóloVenta2 originaria dejandoVenta1;0replay/2POST sólomock. Sin venta real, inferencia, pago o hardware acreditados. El primer build/captura previo a fixes no produjo paquete/VM; entrega final32paths(16modificados/16nuevos),1231inputs/FPRfd413ac2…9286.

UI autenticada real R14 verificada en pestaña propia1270×720: header colapsado/lector enfocado,2GETbarcode reales de Barra Protein→una partida/cantidad2/3032CLP, imagen80px y paneles620/620; derecha sin inputs/nombre de producto, cinco botones, Total28px/48px y0overflow. Qty0+X vacío repone Venta1, carrito propio retirado antes de Productos y0Confirmar venta. Tabla real thumb50×50/nombre solo/alternativo0 inactivo oculto; visor abre con Guardar deshabilitado y cierra sin cambios. Formulario Disponible/margen30/IVA19,1516→1166/980,Cancelar sin Save/tabla8productos. Oferta roja activa positiva sólofixture; sin mutación comercial producto/imagen/venta, inferencia o checkout real. Pestaña12 propia cerrada y trabajo del usuario intacto.

Impacto: presentación/navegación para layout, miniatura, colapso y colores; default/cálculo manual amplían interacción del editor y se registran aquí. Sin backend, tablas, migraciones, herramientas/permisos/reportes o source_paths nuevos;44aprobadas y fuentes Estudios ajenas preservadas. [Plan94 R14, sección23](../../../../mvp/94-business-point-of-sale-and-product-refactor.md#23-lista-de-compra-y-edición-manual-r14--2026-10-30) y [recibo R14 en progreso](../../../../evidence/business-pos-purchase-list-20261030-r01.json): implementación, suite2354/282 en234.37s,tipos/lint/build final0 sinwarnings y QA8perfiles correctos;14focales posteriores al ajuste de oferta/props. Client activo/verificado b67a244a…/173files/169assets actuales/47previos,3SPA200/protegidas401 y runtime protegido idéntico. UI autenticada real verificada. Los resultados R13 inferiores son históricos; no prueban R14. Las referencias base a un catálogo/listado exterior describen R13; la composición R14 las sustituye por la lista de compra y conserva los contratos de identidad/recuperación. Draft/implemented/unregistered/approval:null, sin nueva aprobación/publicación.

## Qué resuelve y qué significa

Plan94 R13 permite preparar varios carritos locales en la misma UI POS sin perder uno al activar otro. VentaN es un título local; el carrito tiene su propio ID estable y, al enviar, la identidad nativa de una intención comercial. No es una venta persistida ni un borrador de Server. La confirmación sigue usando el checkout atómico vigente de R12.

La nueva instrucción retira Other sólo de la nueva selección manual, agranda total y cantidad, simplifica los datos principales del catálogo/carrito y distingue visualmente el precio alternativo. Ocultar la leyenda del medio informativo no convierte ese medio en un cobro ni cambia permisos, gateway o confirmación IA.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención | Aclaración o límite |
|---|---|---|
| «Abre otra venta sin perder ésta» | Nuevo carrito local | Asignar el siguiente número y activarlo, conservando los demás; no crea una venta en Server. |
| «Confirma Venta2» | Acción explícita del operador | Cerrar sólo el carrito con el ID que originó el checkout exitoso; no confirmar o reiniciar Venta1/3. Un texto del chat no sustituye el botón humano. |
| «Cierra esta venta vacía» | Descarte local | Cero partidas cierra sin preguntar, incluso con datos locales residuales; con partidas exige confirmación y una intención pendiente no se descarta. |
| «Recupera la venta tras recargar» | Lectura/conciliación del mismo carrito | Misma pestaña de navegador, actor/negocio y request_key; sin otra clave automática ni promesa entre dispositivos. |
| «Esta venta histórica usa Otro» | Compatibilidad | Conservar el valor y descripción de historia/recuperación; retirarlo de selección nueva no lo invalida. |

## Operaciones y contratos

| Operación | Clase/efecto | Herramienta y estado | Contrato y resultado |
|---|---|---|---|
| Crear/activar/cerrar carrito local | Estado Client | Sin herramienta IA nueva; implementado | Workspace con IDs/números estables; no POST comercial por estas acciones. |
| Confirmar carrito | Escritura comercial vigente | Checkout de operador R12, sin binding nuevo | Snapshot escrito antes del envío; completed/partidas/evento/recibo atómicos en Server. |
| Conciliar pendiente | Recuperación vigente | Mantiene grants/autoridad e identidad | Consultar recibo del mismo request_key y aplicar sólo al carrito originario; sin replay automático. |
| Migrar journal anterior | Escritura local | No herramienta remota | Validar/incorporar/escribir snapshot antes de retirar journal legacy. |
| Cantidad0 y basurero | Edición local R19 | Cero permanece; basurero sin ConfirmDialog o efecto remoto inmediato | Hasta tres decimales. Al confirmar se retiran las filas en cero; sólo se envían partidas positivas y sin ellas no se guarda. El basurero permite retirarlas antes, respetando los bloqueos de operación pendiente. |

## Datos mínimos y resolución de dudas

| Dato | Regla y procedencia |
|---|---|
| actorId/businessId | Ámbito autenticado del snapshot; no reutilizar datos o resultados de otro actor/negocio. |
| ID de carrito/número | ID estable para efectos asíncronos; número sólo de presentación. Comienza1, luego2/3; no renumera sobrevivientes y cerrar el último reinicia1/siguiente2. |
| Estado por carrito | Líneas/cantidades editables, medio/nota, barcode y journal pendiente conservados al cambiar de pestaña. |
| request_key/payload | Una intención fijada y persistida localmente antes del transporte; recuperación usa la misma identidad. |
| Precio/importe | CLP por unidad y selección por flag; subtotal half-up por línea y total suma de subtotales. Sin descuentos inventados o pérdida de ceros reales. |
| Código y unidad | Código de factura/proveedor nullable, ID estable y barcode independiente; unidad de producto con default unit y unidad histórica por partida. |
| Medio | Nueva selección: efectivo/débito/crédito/transferencia, cash inicial. Historia/backend/IA/recuperación conservan other válido. |
| Storage inválido/indisponible | Bloqueo de mutaciones y recuperación explícita; no empezar en silencio una intención nueva para repetir un resultado incierto. |

## Reglas, acceso y restricciones

Regla R24 de salida interna: descartar todos los carritos requiere confirmación cuando hay datos y sólo puede ocurrir sin journals pendientes, operaciones activas o error de almacenamiento. clearForExit debe conservar primero el estado vacío; si falla no navega. Recuperar tras recarga no equivale a autorizar una salida destructiva. Alternar ventas no descarta.

Un único motor/useSyncExternalStore alimenta los carritos y un catálogo compartido. La respuesta de una petición pertenece al ID originario, aunque otra pestaña esté activa. Confirmar con éxito cierra únicamente ese carrito. X con cero partidas no pregunta, aunque haya dirty/barcode/input de cantidad residual; con una o más partidas pide confirmación y una petición activa o incierta impide descarte. No se elimina un borrador comercial histórico al cerrar una pestaña local.

El snapshot sessionStorage está versionado y acotado a actor+negocio en la misma pestaña del navegador. No es almacenamiento de credenciales, sincronización entre pestañas/dispositivos o garantía después de cerrar el navegador. Logout/cambio de identidad limpia el ámbito y descarta respuestas tardías. Snapshot corrupto, ámbito erróneo o fallo de escritura bloquea el envío comercial.

Las44 fichas aprobadas, incluida POS5, conservan sus bytes y alcance. Este borrador no habilita herramientas o permisos. R13 no añadió backend o migraciones; R19 sí amplía los campos y validaciones de productos/partidas con migraciones propias, cuya aplicación y adopción deben comprobarse en el recibo R19. No se añade un proveedor o modelo ni se publica esta ficha.

## Filtros e informes

Los carritos locales no se cuentan como ventas. Sólo el completed nativo entra en los reportes vigentes con CLP, America/Santiago y anulación; la numeración local no cambia esas definiciones. R19 separa cantidades por unidad y ranking por producto/unidad histórica. Una cantidad de kilos, gramos o atados no se suma a unidades como un total físico ni se convierte automáticamente.

El catálogo llena el espacio disponible con scroll local y consulta paginada compartida. Code/barcode se ocultan únicamente en las zonas principales del catálogo y carrito; siguen en contratos, edición, snapshots y lector exacto, con code opcional y barcode independiente. Reescanear incrementa la partida del carrito activo. Precio alternativo usa indicador de color y normal debajo cuando el flag aplica, incluso si el alternativo es mayor. Total agranda label/valor y se retira la leyenda visual informativa sin cambiar su significado.

## Vista previa, confirmación y recuperación

Antes de transportar una mutación, una única escritura local guarda todos los carritos y la identidad/payload pendiente. Si no puede escribirse, no se envía. Un resultado incierto se concilia con el recibo existente; un éxito remoto seguido de fallo local conserva una recuperación revisable y no obliga a repetir checkout. La migración legacy escribe el snapshot válido antes de eliminar la entrada antigua.

Los botones +/− y el campo de cantidad permiten edición local hasta tres decimales;0 permanece en la lista mientras se edita. Al confirmar se excluyen automáticamente las filas en cero; la venta sólo se envía si queda al menos una partida positiva. El basurero retira una fila sin confirmación antes del envío; los valores inválidos y las operaciones pendientes mantienen sus bloqueos. Las escrituras comerciales mantienen el botón humano, autoridad/validación/recibo vigentes; quitar un caption o cambiar pestaña no confirma operaciones.

## Integración y evidencia

- [x] Instrucción y diferencia R13/R12 sobre selección manual de Other registradas.
- [x] Auditoría inicial de DTO/medios/cantidades y paths existentes de motor/snapshot.
- [x] Pruebas atómicas de IDs/numeración, cierres fuera de orden y cantidades/precios correctas.
- [x] Storage fallido/corrupto, persistencia antes del envío, migración write-before-remove, logout y recarga por carrito verificados por alcance.
- [x] Suite2305/277,80focales posteriores, lint global y build R02/TypeScript correctos; QA sintética8perfiles y entrega R02 verificadas.
- [x] UI autenticada real R02: autofocus, dos barcode GET reales/cantidad2, dos ventas locales aisladas y restauración de medio/barcode; sin Confirmar venta o mutación comercial.
- [ ] Lector/teléfono físicos según evidencia disponible.
- [ ] Aprobación documental; ninguna capacidad nueva publicada por esta ficha.

[Recibo R13 por alcance](../../../../evidence/business-pos-multi-sale-20261029-r01.json): suite2305/277 en213.08s; después de los ajustes visuales sentinela1px y Stepperrelative pasan80focales/10archivos en8.5s, lint global y build R02/TypeScript. QA sintética320/390/600/1569px ESoscuro/ENclaro:catálogo780px con viewport1000px/scroll local392–431px, imágenes80px,+/−56px,pagos84px,total36/48px exacto,0overflow y CTA56px con hit-test. Chip oferta5.29:1 claro/13.01:1 oscuro. Dos escaneos producen una partida/cantidad2;0retira, input parcial vacío es distinto de0; dos ventas conservan medio/barcode al cambiar/recargar, números estables y reinicio1/siguiente2 al cerrar la última. Checkout cierra sólo su carrito;503 bloquea X y recupera mediante1GETreceipt sin replay. Tres POST exclusivamente mock, sin venta real en VM.

R01 se rechazó en staging privado por cola vacía a600px y no se activó. R02 activo/verificado: manifiesto3145c385…7f37,173archivos/169assets actuales/88previos,3SPA200 y rutas protegidas401. Respaldo Nginx y release anterior conservados, un reload graceful. Server73be…/KBcde…, API2263533/worker2263534, Native/keyring/timers idénticos;sin SQL directo/cambios auth/inferencias/backupcloud/reinicios. UI autenticada final R02 verificada, sin aceptación física/performance. Los resultados R12 no prueban R13;44aprobadas intactas y sin nueva publicación.

UI autenticada real R02 en pestaña propia del navegador integrado/negocio de laboratorio: dos GET de barcode reales del producto9 dejan una partida/cantidad2,total2400CLP/Venta1 efectivo. Venta2 inicia vacía/cash y conserva su unidad local/débito/barcode parcial002; volver a Venta1 restaura cantidad2/efectivo/barcode vacío, pestañas2400/1200. Label Total28px, Confirmar56px, cuatro medios sin Other, códigos ocultos e imagen cargada. Sin pulsar Confirmar venta, HTTP comercial o inferencia; no checkout real/hardware. Trabajo del usuario intacto; limpieza/cierre/captura del operador se consolidan en evidencia.

Volver a R12 después del uso requiere inventariar y conservar carritos/journals y revisar pendientes/recibos antes de devolver la UI anterior: R12 no interpreta el snapshot multicarrito. El kit de rollback se verificó sólo antes del uso, sin demostrar recuperación posterior ni autorizar descartar/repetir intenciones.

## Evolución y compatibilidad

| Revisión | Cambio | Compatibilidad |
|---|---|---|
| 1 | Plan94 R13 y ADR088 propuesto: varios carritos locales, recuperación y ajustes POS | Nueva selección manual sin Other; historia/backend/IA/recovery intactos. Draft/implemented/unregistered/approval:null; POS5 y44 cuerpos aprobados sin cambios. |
| 2 | R14: lista de compra, miniatura/oferta, default/cálculo de producto manual y colapso inicial | Motor/snapshot y contratos preservados; suite/build/QA y entrega verificados, UI autenticada real verificada. Sin defaults CSV/OCR o aprobación/publicación nuevas. |
| 7 | R19 en curso: código opcional, cuatro unidades, cantidad con tres decimales, cero/basurero, half-up por línea y escala de texto | Workspace2 conserva identidad/pendientes; unidades históricas y reportes separados. Integración/adopción pendientes de su recibo; NodiaAI sólo lectura y ficha sin aprobación/publicación. |
| 11 | R24: precio por partida, salida segura y formatos explícitos; tabla9/12 sin nuevas consultas | Implementación, QA, SQL desechable y adopción acreditados en el recibo R24; aceptación física pendiente. Draft/unregistered/approval:null;44aprobadas intactas |


## Presentación de Ventas y Reportes — R15, 2026-10-30

[Plan94, sección24](../../../../mvp/94-business-point-of-sale-and-product-refactor.md#24-filtros-tablas-y-entrada-de-productos--r15-2026-10-30) registra los siete ajustes pedidos. Filter agrupa estado comercial y fechas de Ventas, y período/orden de Reportes. La búsqueda y paginación de Ventas son del servidor; omitir estado excluye descartadas, sin prometer Todos. El rango se interpreta por completed_at en America/Santiago con último día incluido. Cancelar conserva lo aplicado; aplicar, limpiar o quitar criterios conserva la búsqueda y reinicia la página cuando corresponde.

Las métricas se muestran como tarjetas independientes. «Promedio por venta» conserva el ratio del servidor y el redondeo aproximado al peso. El ranking sigue mostrando hasta10productos por unidades o importe, sin paginación o total global inventados. No se crean medidas ni filtros backend nuevos. El estado vacío del POS indica cómo agregar el primer producto y se centra en el espacio restante. El formulario de producto pone barcode opcional primero y lo enfoca una vez al abrir, sin guardar con Enter ni volver a enfocar por refetch.

Evaluación de impacto conforme al estándar KB: radio8px de tablas y breadcrumb sin margen son exclusivamente visuales. Orden/foco, filtros agrupados y copy existente modifican la interacción/presentación, conservando conceptos, operaciones, autoridad, período y cifras. No cambian checkout, carritos recuperables, productos disponibles, permisos, propuestas exactas o efectos comerciales. No necesitan herramientas, capacidades o fichas nuevas. Las44fichas aprobadas, incluida POS5, permanecen intactas; esta revisión es draft/unregistered/approval:null y no se publica. Verificación y adopción R15 pendientes al preparar este texto.
| 3 | R15: filtros, tablas8px, cuatro cards, barcode/foco y vacío centrado | Suite/QA/entrega/UI real verificadas por alcance; sin contratos/permisos/publicación nuevos. |


## Adaptación móvil R16 — 2026-10-30

R16 móvil implementado y desplegado: tarjetas xs/listas y ranking, modales16px/X44/acciones44, precios íntegros y visores con nombre desplazable. POS conserva único motor y carritos; paneles compactos, lector visible al volver de Pago y popup acotado. Client2389/288, tipos/lint/build correctos; QA40vistas de Negocios,24Sales/Reports y10perfilesPOS. Clienta22f0170…8985 activo/runtime intacto; UI autenticada390×844 verificada sin Save/Confirmar. Sin contratos, Server, herramientas, permisos, aprobación o publicación nuevos. La disposición conserva conceptos, operaciones, interpretación monetaria y confirmación humana existentes; no afecta el contexto funcional ni exige una herramienta nueva. La ficha POS aprobada5 y las otras43 aprobadas conservan bytes. Los calendarios históricos y el teclado físico mantienen sus límites de aceptación. Ver [Plan94, sección25](../../../../mvp/94-business-point-of-sale-and-product-refactor.md#25-adaptación-móvil-de-negocios--r16-2026-10-30).


## Botones de venta guardada — ajuste visual 2026-10-30

«Anular venta» y «Consultar venta guardada» usan la variante contained de MUI; la anulación conserva el color de error y la consulta el color principal. Se conserva el apilado y ancho completo móvil, los bloqueos durante operaciones pendientes y los handlers existentes.

Evaluación de impacto en NodiaAI: exclusivamente visual; no cambia conceptos, operaciones, permisos, interpretación de importes ni confirmaciones. No habilita herramientas o escritura de ventas desde IA, no modifica la ficha POS5 aprobada y no requiere una nueva ficha o publicación. La validación y entrega se registran en la evidencia indicada.

Lectura adicional de PrintTicket: MediaSizeWidth71988µm y MediaSizeHeight3275974µm (71.988×3275.974mm), opción ZIJIPAPER420. Es la configuración que declara el driver; no se infiere papel físico80mm, corte, avance o salud. No se modifica. [Unidad del Print Schema](https://learn.microsoft.com/en-us/windows/win32/printdocs/pagemediasize).

## Verificación posterior de precios — 2026-11-06

ServerR11 y ClientR28 adoptados y verificados. R10 aplicó una sola migración44→45 con2DROP e invariantes de94tablas; su arranque falló por hashes estáticos de26contratos y quedó detenido. R11 recuperó el runtime con5JSON/assets,0DDL/0escriturasDB adicionales y API/Worker estables30s; no se repitió la migración. ClientR28 tuvo una activación/recarga,186outputs actuales verificados y assets históricos conservados. NativeR12, flags, entorno, auth y timers preservados. Client: 308 pruebas/25 suites, typecheck y lint correctos. Server: corrida inicial315/23 y posterior de metadatos159/3, parcialmente solapadas y sin sumarlas; typecheck de producción/lint correctos y fallo de specs WIP ajenos conservado. Una regresión adicional de bundle pasó (100casos filtrados, no101pruebas) y se verificaron153contratos/12familias más el constructor real LoadNodiaAiKnowledge. CUA autenticada1088/320 comprobó precios normal/oferta16px/700 y oferta roja, ausencia de margen, sugerencia30→40% con venta350intacta, venta manual990sin cambiar costos226/269 y Aplicar377sólo en borrador. Cancelar/reabrir conservó venta guardada350 y reinició30%; no se pulsó Guardar ni ejecutó OCR/proveedor. Móvil: diálogo288px, acciones256×44 y catálogo310client=scroll, sin overflow. La vinculación OCR se acredita con pruebas atómicas y fixture sintética, no con OCR/guardado reales. [Evidencia](../../../../evidence/business-product-pricing-20261106-r01.json). NodiaAI ventas sigue sólo lectura; no se publican esta candidata ni herramientas nuevas.
