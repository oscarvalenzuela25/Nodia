---
{
  "schema_version": 1,
  "document_id": "businesses",
  "product_id": "businesses",
  "kind": "product",
  "revision": 49,
  "document_status": "draft",
  "implementation": {
    "status": "partial",
    "notes": "ClientR37 conserva la mejora visual de precio sugerido verificada1088/320px, sin Aplicar/Guardar en esa QA. NativeR16 adoptado con diagnóstico seguro best-effort y660Linux correctos, pero la nueva intención OCR real volvió aHTTP504 tras leer el archivo sin finish/resultado. Cierre local0CLI/marcadores/proofs/grupos yPNG conservado. Causa no aislada; no atribuir a Google/transporte ni convertir indicadores vacíos de un log truncado en ausencia de fallos. R15fallido y R37visual conservan sus recibos. Resolver extracción compatible con CLI1.3.1 sigue pendiente; sin replay, cambio de selección o ampliación de deadlines. No amplía guardado comercial, capacidades, permisos o bindings; draft/partial/unregistered sin nueva aprobación/publicación."
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento de Negocios y NodiaAI conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/94-business-point-of-sale-and-product-refactor.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/90-agentic-api-only-web-retirement.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/89-module-access-and-user-data-scope.md",
      "kind": "specification"
    },
    {
      "path": "docs/architecture/decisions/ADR-081-module-access-and-business-data-scope.md",
      "kind": "specification"
    },
    {
      "path": "docs/features/businesses/01-prd.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/19-prelaunch-review.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/31-provider-contacts-proposal.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/nodia-ai-products/business/use-case/read-nodia-ai-business.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "docs/mvp/68-nodia-ai-ai22-business-operations.md",
      "kind": "specification"
    },
    {
      "path": "docs/architecture/decisions/ADR-080-conversational-invoice-ocr-product-comparison.md",
      "kind": "specification"
    },
    {
      "path": "docs/nodia-ai/knowledge/nodia-ai/features/invoice-ocr-product-comparison.md",
      "kind": "specification"
    },
    {
      "path": "docs/nodia-ai/knowledge/businesses/features/point-of-sale-and-sales.md",
      "kind": "specification"
    },
    {
      "path": "nodia-client/src/modules/business/pages/BusinessDetail/components/OverviewTab/OverviewTab.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductModal/ProductModal.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/components/ProductImage/ProductImage.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductModal/ProductImageDraft/ProductImageDraft.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductModal/hooks/useDeferredProductSave.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductModal/ProductImageDraft/styles.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductImageModal/ProductImageModal.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductImageModal/styles.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/pages/BusinessDetail/components/ProductsTab/ProductsTab.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/components/BusinessMobileCards/BusinessMobileCards.tsx",
      "kind": "implementation"
    },
    {
      "path": "docs/architecture/decisions/ADR-087-atomic-point-of-sale-checkout.md",
      "kind": "specification"
    },
    {
      "path": "docs/nodia-ai/knowledge/businesses/features/point-of-sale-checkout-and-accessibility.md",
      "kind": "specification"
    },
    {
      "path": "nodia-client/src/modules/business/pages/BusinessDetail/BusinessDetail.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/pages/BusinessDetail/styles.ts",
      "kind": "implementation"
    },
    {
      "path": "docs/architecture/decisions/ADR-088-local-sale-workspaces-and-recovery.md",
      "kind": "specification"
    },
    {
      "path": "docs/nodia-ai/knowledge/businesses/features/multi-sale-workspace.md",
      "kind": "specification"
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
      "path": "nodia-client/src/modules/business/pages/BusinessDetail/components/SalesWorkspace/OpenSaleTabs/OpenSaleTabs.tsx",
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
      "path": "docs/evidence/nodia-ai-ai15-live-routing-interrupted.json",
      "kind": "evidence"
    },
    {
      "path": "docs/architecture/decisions/ADR-095-independent-product-prices-and-reviewed-invoice-binding.md",
      "kind": "specification"
    },
    {
      "path": "docs/nodia-ai/knowledge/businesses/features/product-price-calculator-and-invoice-binding.md",
      "kind": "specification"
    },
    {
      "path": "docs/architecture/decisions/ADR-096-manual-invoice-ocr-cancellation-recovery.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/ai-provider-feature-contract.md",
      "kind": "specification"
    }
  ],
  "verification": {
    "checked_on": "2026-11-07",
    "evidence_paths": [
      "docs/evidence/nodia-ai-c05-live-preparations-r01.json",
      "docs/evidence/nodia-ai-ai36-c03-publication-authorization-r01.json",
      "docs/evidence/nodia-ai-ai36-c03-VM-publication-r01.json",
      "docs/evidence/nodia-ai-c03-handoff-readback-20261025-r01.json",
      "docs/evidence/nodia-ai-c03-reconciliation-20261025-r01.json",
      "docs/evidence/nodia-ai-additive-continuity-20261025-r01.json",
      "docs/evidence/nodia-ai-c03-original-read-fix-adoption-20261025-r01.json",
      "docs/evidence/nodia-ai-c03-originals-eligibility-gate-20261025-r01.json",
      "docs/evidence/nodia-ai-c03-eligibility-diagnostic-adoption-20261025-r02.json",
      "docs/evidence/nodia-ai-c03-attachment-policy-client-adoption-20261025-r01.json",
      "docs/evidence/nodia-ai-c03-agentic-status-timeout-adoption-20261025-r02.json",
      "docs/evidence/nodia-ai-unused-build-cache-retirement-20261025-r01.json",
      "docs/evidence/nodia-ai-c03-agentic-status-evidence-cache-adoption-20261025-r01.json",
      "docs/evidence/nodia-ai-c03-cache-metadata-and-mcp-stop-20261025-r01.json",
      "docs/evidence/module-access-and-user-data-deployment-r01.json",
      "docs/evidence/business-pos-implementation-20261028-r01.json",
      "docs/evidence/business-pos-knowledge-publication-authorization-20261028-r01.json",
      "docs/evidence/business-pos-vm-adoption-20261028-r01.json",
      "docs/evidence/business-pos-nodia-ai-natural-20261028-r01.json",
      "docs/evidence/business-overview-rows-20261029-r01.json",
      "docs/evidence/business-product-editor-20261029-r01.json",
      "docs/evidence/business-mobile-20261030-r01.json",
      "docs/evidence/nodia-ai-sales-readonly-20261030-r01.json",
      "docs/evidence/business-pos-ticket-20261030-r01.json",
      "docs/evidence/business-pos-followup-20261030-r21.json",
      "docs/evidence/business-pos-receipt-detail-20261030-r22.json",
      "docs/evidence/business-pos-usability-20261031-r24.json",
      "docs/evidence/business-product-pricing-20261106-r01.json",
      "docs/evidence/product-price-suggestion-ui-20261107-r01.json",
      "docs/evidence/product-price-result-alignment-20261107-r01.json",
      "docs/evidence/invoice-gemini-timeout-20261107-r01.json",
      "docs/evidence/invoice-gemini-timeout-20261107-r02.json"
    ],
    "notes": "R16:660Linux sin fallos/omitidas más fixture cancel/setsid/IO/nuevaintención sin red/perfil real; Windows649pass/11skip es corrida separada. Adopción técnica verificada con configuraciónServerR12/ClientR37 preservada. OCR real504 con deadline240s/inferencia242057ms/UI250s, view_filecompletado y finish/result0. Hook1decisión/0rechazos; log truncado sin indicadores reconocidos no prueba causa ni ausencia. Cierre local0CLI/marcadores/proofs/grupos; no replay/guardar/vincularnuevo. R15yR37 históricos intactos;44aprobadas byte-idénticas. No se declara extracción resuelta."
  },
  "approval": null
}
---
# Negocios — contexto de producto para NodiaAI

## Regla nueva de Productos — 2026-11-06

[Calculadora y vinculación OCR revisada](features/product-price-calculator-and-invoice-binding.md) y [plan94 §35](../../../mvp/94-business-point-of-sale-and-product-refactor.md#35-precios-independientes-calculadora-local-y-vinculación-ocr-revisada--2026-11-06) sustituyen el cálculo bidireccional del corteR14: venta manual no cambia costos; sugerencia local30% editable sobre bruto sólo cambia borrador al Aplicar. Se retira profit_percentage de BD/contratos activos; la selección OCR compara código/nombre/costos/venta y conserva ID/version y campos no elegidos hasta el guardado final. Tabla de precios normal/oferta16px/700. Regla funcional solicitada; implementación/SQL/QA/adopción en curso. ADR095 propuesto y ficha draft/unregistered/approval:null; la publicación anterior no se extiende a esta regla. La revisión selectiva de46bindings confirma que los fragmentos de Productos/Logs/OCR no afirman margen persistido/autocálculo; sus referencias antiguas no se sirven. No se retiran capacidades compatibles ni se publica la candidata; repins técnicos esperan freeze/review backend, sin alterar hashes aprobados. Los cortes inferiores conservan su evidencia fechada.

## R24 vigente: precio de partida, catálogo y salida del POS

El precio se puede ajustar sólo para una partida o guardar de forma permanente como precio normal, desactivando la oferta mediante una acción explícita. La venta conserva snapshots y distingue el precio manual. La salida interna confirmada descarta todos los carritos locales seguros; alternar ventas los conserva. Resultados pendientes, operaciones activas y errores de almacenamiento bloquean el descarte. La vista previa siempre tiene detalle y ofrece confirmar sin imprimir, imprimir vale o imprimir con detalle; no hay switch de formato.

Productos empieza con nueve columnas y permite mostrar Disponibilidad, Estado y Última actualización desde +/− junto al precio; las cabeceras adicionales usan primary.dark y texto de contraste. Es una presentación local sin nuevas consultas, autoridad o herramientas. Cards móviles y acciones/histórico mantienen sus contratos. Ver [plan94 §33](../../../mvp/94-business-point-of-sale-and-product-refactor.md#33-precios-por-partida-salida-del-pos-y-legibilidad--r24-2026-10-31), [ajustes de precio](features/sale-line-price-adjustments.md), [workspace](features/multi-sale-workspace.md) e [impresión](features/manual-sale-ticket-printing.md).

Implementación local documentada; tabla18pruebas/tipos/lint/QA por alcance verificados. La [evidencia R24](../../../evidence/business-pos-usability-20261031-r24.json) debe acreditar el cierre global, SQL y adopción antes de atribuirlos. Negocios40 es draft/unregistered/approval:null; las44fichas aprobadas permanecen intactas. Los apartados anteriores son cortes históricos cuando contradicen R24. NodiaAI mantiene sólo consultas de ventas/reportes; un cambio de precio de venta nunca se ejecuta por chat.

## Corte histórico R22: vale o ticket de venta

[Ticket/vale](features/manual-sale-ticket-printing.md) permite imprimir el mismo comprobante con o sin productos. Mostrar detalle empieza apagado en cada confirmación y la elección se aplica a la impresión después de guardar. Panel Anular+Vale y Ticket de ancho completo debajo; sin cambios de datos, autoridad IA, Chrome o impresora. Ver [plan94 §31](../../../mvp/94-business-point-of-sale-and-product-refactor.md#31-vale-y-ticket-con-detalle-opcional--r22-2026-10-30) y [evidencia R22](../../../evidence/business-pos-receipt-detail-20261030-r22.json); Client desplegado/verificado con respaldo y runtime Server/KB preservados; impresión física pendiente. Fichas candidatas sin aprobación/publicación nuevas.

## Ajustes POS R21 y Chrome de caja — 2026-10-30

Las ventas abiertas envuelven en filas; el panel guardado conserva Anular e Imprimir con tamaño equivalente, sin la consulta redundante. El detalle de Ventas sigue disponible. El usuario elige Chrome u Opera; se crea un acceso de Chrome con perfil exclusivo y confirmación de impresión automática, sin modificar contratos, impresora o autenticación. Opera, driver80mm y salida física pendientes de calificación. Ver [ticket manual](features/manual-sale-ticket-printing.md) y [evidencia R21](../../../evidence/business-pos-followup-20261030-r21.json). Fichas candidatas sin aprobación/publicación nuevas; NodiaAI sólo obtiene y muestra ventas/reportes.

## POS vigente: unidades y ticket80mm — R20

[Plan94](../../../mvp/94-business-point-of-sale-and-product-refactor.md#29-presentación-de-precios-y-ticket-térmico80mm--r20-2026-10-30) y [ticket manual](features/manual-sale-ticket-printing.md): código opcional, cuatro unidades, cantidades hasta tres decimales y confirmación con vista previa imprimible80mm. Escala visual de texto e imágenes sin cambiar importes. NodiaAI sólo consulta ventas/reportes; las fichas candidatas continúan sin aprobar ni publicar. La evidencia R19 acredita unidades y R20 distingue entrega Client de impresión física pendiente.


## Alcance actual de NodiaAI sobre ventas — R17

R17 (2026-10-30): NodiaAI queda limitado a obtener y mostrar ventas/reportes. Retiradas cinco preparaciones comerciales; el POS manual y las dos lecturas/fuentes de informes se conservan. Registro, ejecución histórica y adopción se verifican por alcance; no se publica la ficha candidata nueva ni se cambia la aprobación de POS5. Véase [Ventas y reportes de solo lectura](features/sales-and-reporting-read-only.md) y Plan94 §26. Las referencias inferiores a escrituras de ventas por IA describen cortes anteriores y no las rehabilitan.

## Filtros, tablas y entrada de productos R15 — 2026-10-30

[Plan94 R15, sección24](../../../mvp/94-business-point-of-sale-and-product-refactor.md#24-filtros-tablas-y-entrada-de-productos--r15-2026-10-30), [ficha candidata3](features/multi-sale-workspace.md) y [recibo R15](../../../evidence/business-sales-reports-ui-20261030-r01.json): Filter/chips/búsqueda y tabla/paginado real en Ventas, cuatrocards/Promedio por venta≈ y top10 sinpaginación ficticia en Reportes. Radio8px/toolbar fuera, barcodeprimero/foco por apertura, breadcrumb sin margen y vacío20/16 centrado preservan contratos.

Suite2386/288 en210.80s;12Reportesfinales6.30s y3vacío finales3.80s tras correccionesMUI,tipos/lint/build0(12.25s) con warningapi>500kB previo. QA8perfiles24vistas0overflow/radio8/centro≤.008,4cards/top10,Ventas25+19 y flujosaplicar/cancelar/limpiar/error/barcode. TablaProductos13columnas/oferta estrecha conserva un límite histórico; no se afirma nueva quiebra o legibilidad global.

Client70914765…ddf3 activo,173estáticos/169assets actuales/47previos;42paths(22modificados/20nuevos),1251inputs/FPR74316213…a171, runtimeServer/KB/PIDs/Native/keyring/timers idéntico,sinSQLdirecto/Serverrestart/migración/inferencia. UIrealIAB1280×720ESoscuro:2ventas6064CLP/4unidades/promedio≈3032/ranking1,4cards221.5px/tabla8/0overflow;vacíoY0/X.0078/región285.44/título20/ayuda16. TablaProductos8filas/radio8;formulario barcodeprimero582px/trescampos,autofocus+Enter conserva diálogo sinSave yCancelar deja8productos. Filtros reales abiertos/cancelados sinApply. SinSave/Confirm/imagen/inferencia,pestaña propia4cerrada/3usuariointactas. Impacto de presentación/lecturas existentes, sin contratos/permisos/tools/publicación nuevos;Negocios33/ficha3 draft/unregistered/approval:null y44aprobadas intactas. Evidencia en cuerpo por límite32 de evidence_paths, sin aceptación física o rendimiento acreditados.

## Lista de compra y producto manual R14 — 2026-10-30

[Plan94 R14, sección23](../../../mvp/94-business-point-of-sale-and-product-refactor.md#23-lista-de-compra-y-edición-manual-r14--2026-10-30) y [ficha candidata rev2](features/multi-sale-workspace.md): alta manual inicia has_stock=true sin alterar false/null históricos o CSV/OCR/imports; cambiar venta conserva margen/IVA y recalcula costes con redondeo. Miniatura50px abre visor existente, nombre sin barcode y oferta válida habilitada arriba/error.main con normal debajo,0 válido y sin comparación de precios.

POS izquierdo sólo partidas seleccionadas/imagen/precio/−qty+, agrega por dropdown/lector; derecho Total→medios→Confirmar, sin líneas duplicadas y altura coordinada. Cabecera empieza colapsada; paneles comparten altura620–1040px y motor/snapshot/confirmación/recuperación/Server siguen intactos. Metadatos de imágenes cache30s actor+session/biz, seeds sin GET extra y lotes100 sólo seleccionados, sin cambiar precios congelados. Popup conserva lista/scroll durante fetch con input/opciones bloqueados. El pricing rechaza overflow y no reinterpreta CSV históricos. Evaluación de impacto: presentación/navegación, más default/cálculo del editor registrados en ficha existente; sin ADR nuevo, backend/tablas/migraciones/tools/permisos/reportes/source_paths o publicación remota. [Recibo R14 en progreso](../../../evidence/business-pos-purchase-list-20261030-r01.json): implementación, suite2354/282 en234.37s,tipos/lint/build final0 sinwarnings y QA8perfiles correctos;14focales posteriores al ajuste de oferta/props. Paneles780px,20partidasizq/0der,Totalprimero/4medios84+Confirm56,0overflow/cola;popup24→48/top2187 mismoUL/sin3página. Thumb50/visor,oferta20px700 error.main (3.763:1 sobre blanco, texto grande3:1),pricing1516→1166/980 y0válido. Recarga19IDs1GET/seeds0extra;400modal preservado y503mock→1GETsinreplay cierra sólooriginario,2POSTmock. Client activo b67a244a…/173files/169assets actuales/47previos,3SPA200/protegidas401 y Server73be/KBcde/PIDs/Native/keyring/timers idénticos, sinSQLdirecto/auth/inferencia/restart. Captura/build iniciales antes de fixes sinpaquete/VM; entrega final32paths/1231inputs/FPRfd413ac2…9286. UI autenticada real verificada. UI real R14: header colapsado/lector enfocado,2GETbarcode→una partida/cantidad2/3032CLP, imagen80 y paneles620/620 a1270×720; derecha sin inputs/nombre de producto,5botones,Total28/48 y0overflow. Qty0+X vacío reiniciaVenta1 y carrito propio retirado. Thumbreal50/visor sin cambios,alternativo0 inactivo oculto; formularioDisponible/30/19,1516→1166/980,Cancelar sin Save/tabla8productos. Oferta roja activa sólofixture; sin mutación producto/imagen/venta o inferencia, pestaña propia cerrada y usuario intacto. Negocios32 draft/partial y ficha rev2 draft/implemented, ambos unregistered/approval:null;44aprobadas y4fuentes Estudios ajenas preservadas.

## Varias ventas locales R13 — 2026-10-29

[Plan94 R13, sección22](../../../mvp/94-business-point-of-sale-and-product-refactor.md#22-varias-ventas-locales-y-presentación-del-pos-r13--2026-10-29), [ADR088 propuesto](../../../architecture/decisions/ADR-088-local-sale-workspaces-and-recovery.md) y [ficha candidata](features/multi-sale-workspace.md) registran varios carritos locales con motor único/catálogo compartido. Cada VentaN conserva ID estable, contenido e intención; Nueva venta activa la siguiente, éxito cierra sólo el ID originario y no renumera sobrevivientes. Cerrar la última repone Venta1/siguiente2. X con cero partidas cierra directamente aunque queden datos residuales; con partidas confirma y petición activa/resultado pendiente impide descarte.

Snapshot versionado en sessionStorage actor+negocio conserva carritos y journals con una escritura antes del envío; fallo/corrupción bloquea mutaciones. Migración legacy escribe antes de retirar el journal, recarga de la misma pestaña recupera cada identidad y logout/cambio de actor limpia el ámbito/invalida resultados tardíos. No hay sincronización entre dispositivos o venta persistida por crear un carrito.

La nueva selección manual retira Other respecto de R12; historia/backend/IA/recovery mantienen el valor sin convertirlo. Total label/importe crecen, leyenda informativa se oculta sin cambiar semántica, catálogo llena su panel y code/barcode se ocultan sólo en catálogo/carrito principales. Indicador de precio alternativo con normal debajo no compara importes ni exige rebaja; cantidad editable/+− grande,0 retira sin confirmación y otro escaneo incrementa el carrito activo. Checkout y reportes conservan contratos.

[Recibo R13 por alcance](../../../evidence/business-pos-multi-sale-20261029-r01.json): implementación completa, suite2305/277 en213.08s; después de sentinela1px/Stepperrelative pasan80focales/10archivos en8.5s, lint global y build R02/TS correctos. QA sintética8perfiles320/390/600/1569px ESoscuro/ENclaro:catálogo con cota620–1040px (780px con viewport1000px), scroll local392–431px, fotos80px,+/−56px,pagos84px,total36/48px exacto,0overflow y CTA56px/hit-test. Chip oferta5.29:1 claro/13.01:1 oscuro. Dos escaneos/cantidad2,0retira/input vacío distinto de0, dos ventas aisladas/recarga/números, cierre originario y503→1GETreceipt sin replay;3POST sólomock, sin venta real en VM.

R01 privado no activo se rechazó por cola vacía a600px; R02 corrige y queda activo/verificado: Client3145c385…7f37,173archivos/169assets actuales/88previos,3SPA200/protegidas401, respaldoNginx/release anterior conservados y un reload graceful. Server73be…/KBcde…, API2263533/worker2263534, Native/keyring/timers idénticos;sin SQL directo/cambios auth/inferencias/backupcloud/reinicios. UI autenticada final R02 verificada. UI real autenticada R02: lector autofocus; dos GETbarcode reales producen una partida/cantidad2/2400CLP en Venta1 efectivo. Venta2 local conserva una unidad/débito/barcode002 y volver restaura Venta1, pestañas2400/1200; Total28px,Confirm56px,4medios/códigos ocultos/imagen cargada. Sin Confirmar venta, HTTP comercial, inferencia o hardware acreditado; trabajo del usuario intacto. R12 no interpreta snapshots R13: después del uso revisar/conservar carritos/pendientes y recibos antes de volver; kit de rollback sólo preuso. Sólo source_path de ficha, sin bindings/backend/tablas/migraciones/herramientas/knowledge remoto nuevos. Negocios31 draft/partial y ficha draft/implemented, ambos unregistered/approval:null; ADR propuesto y44 aprobadas intactas. Evidencia en cuerpo por límite32 de evidence_paths.

## POS accesible y checkout atómico R12 — 2026-10-29

[Plan94 R12, sección21](../../../mvp/94-business-point-of-sale-and-product-refactor.md#21-ajustes-del-pos-y-checkout-atómico-r12--2026-10-29) registra nueve ajustes: retirar Alert vacío, pagos grandes/iconos conservando cinco medios/cash inicial, sin Guardar borrador para nuevas ventas UI, Confirmar a ancho completo/min56px, cabecera colapsable44px, Nueva venta contained/min56px, foco/Enter de escáner sin robar edición, búsqueda Select con imagen/información y catálogo paginado por scroll infinito sin paginador visual.

La instrucción nueva sustituye el paso draft previo sólo en nuevas ventas POS: checkout Server guarda completed, snapshots, evento y recibo en una transacción con identidad/autoridad nativas. Datos históricos, herramientas IA create/update/complete/discard y sus gates se conservan; no se borra un borrador ni se publica checkout por deducción. [ADR087 propuesto](../../../architecture/decisions/ADR-087-atomic-point-of-sale-checkout.md) y [ficha candidata checkout/accesibilidad](features/point-of-sale-checkout-and-accessibility.md) separan esta ampliación de POS5 aprobado.

[Recibo R12 por alcance](../../../evidence/business-pos-accessibility-20261029-r01.json): implementación local completa; Server5682/313 más1omitida, Client2261/273 y34checks PostgreSQL/HTTP aislados correctos, con tipos/lint/build finales correctos. QA sintética8perfiles320/390/600/1569px ESoscuro/ENclaro:0overflow, New/Confirm56px, imágenes80px, pagos5 y conservación del estado con0GETextra. Fallo400 conserva revisión;503 posterior al commit concilia por1GET del recibo completed,0replay/0POST draft o complete. Referencia Client R01 de1199 entradas/fingerprint d61f1271…f2faf,24 paths; R02 sólo cambia estilos de pagos. Repin técnico de tres fuentes/19entradas mantiene158capacidades/44cuerpos aprobados/46fragmentos, sin publicar ficha o herramienta checkout. Server VM adoptado/verificado:35migraciones/70tablas,69tablas de dominio preservadas y sólo dos CHECKs ampliados; Server73be36…/KBcde7…, API2263533/worker2263534 estables30.276s. Respaldos previos BD/config cifrados/verificados; Native/keyring/timers conservados y0ventas/proveedores nuevos. Respaldo posterior READY conciliado sin replay, quiet final0. Client R01 pasó UI autenticada, pero detectó Transferencia partida a1280px. R02 corrige sólo estilos de pagos y está activo/verificado: manifiesto08dcdfbc…ece9,173archivos/169assets actuales/32previos.18focales posteriores a la suite completa2261, lint/tipos/build y QA adicional320/600/1280px ESoscuro correctos. UI final IAB1280 confirma Transferencia162.59×84/label1línea, New/Confirm56px, cinco medios84px, foco/collapse y0overflow;0ediciones/guardados/inferencias. R01/Server/KB/PIDs/Native preservados y pestaña temporal cerrada con trabajo del usuario intacto. Sin aceptación física o de rendimiento. Negocios30 y ficha siguen draft/partial/unregistered/approval:null, ADR propuesto. Esta referencia se conserva en cuerpo por el límite32 de evidence_paths.


## Visor de imagen desde el catálogo R11 — 2026-10-29

[Plan94 R11, sección20](../../../mvp/94-business-point-of-sale-and-product-refactor.md#20-visor-de-imagen-desde-el-catálogo-r11--2026-10-29): columna «Imagen» con ojo en escritorio y acción equivalente en tarjetas móviles; se retira la miniatura de Nombre. El ojo abre un modal grande siguiendo el patrón de factura, con preview contenido y controles accesibles, para ver o reemplazar la imagen mediante el contrato existente.

Abrir consulta el producto actual y valida ID/empresa/versión conocida. La lectura de imagen puede devolver null para un producto sin imagen, con estado vacío que permite agregar cuando está autorizado; un error/404/rechazo no se convierte en vacío. Ver no concede escritura: ownership, módulo y contextos sólo lectura mantienen sus barreras. Una URL firmada fallida se recupera por lectura explícita, sin hacerla pública ni guardarla en el journal.

Seleccionar es local hasta Guardar; Cancelar antes de Guardar hace0 mutaciones de imagen. `saveImage(imageChange)` reutiliza la secuencia e identidad de imagen sin guardar campos ni enviar POST/PUT del producto. Asociación/retirada conserva CAS, versión/log nativos y conciliación explícita sin repetir PUT incierto. La imagen actual permanece hasta complete; fallos conservan modal/intención y no se promete atomicidad global o cancelación remota por cerrar.

Evaluación de impacto: navegación/presentación y operación image-only sobre contratos vigentes; sin backend, permisos, herramientas IA o cambios de interpretación/confirmación nuevos. [Evidencia R11](../../../evidence/business-product-image-viewer-20261029-r01.json), conservada en el cuerpo para respetar las32 referencias del frontmatter:14 paths implementados (9 modificados/5 nuevos),1187 entradas Client/fingerprint df9518f5…; suite2234/268 correcta en197.95s/8workers sin build pesado concurrente. Focales21hook/9modal de imagen/3tarjetas móviles/35existentes correctos. QA sintética19 comprobaciones/5 perfiles320–1569px ES oscuro/EN claro,0overflow; sin inlineimg/GETmetadata antes de abrir, apertura1GETproduct actual+1GETimg, ojo44px, controles ocupados bloqueados y archivo preservado al resize sin GET. Historial12cabeceras/12celdas y guion de Imagen, sin atribuirle una imagen actual.

Guardar hace sólo reserva/PUT/complete, sin POST/PUT de campos; Cancelar0escrituras y vacío permite agregar. PUT incierto conserva1 envío de archivo, GET de conciliación y Guardar posterior sin escrituras extra. CAS exige recuperar producto/metadatos y confirmación explícita (versión2 en esa fixture), conservando intento/1PUT y sin replay. Tipado/lint/build finales correctos. Client `/opt/nodia/releases/nodia-client-product-image-viewer-20261029-r01` activo, manifiesto d1562b32…;173 estáticos/169assets actuales/46previos comprobados y respaldo/fallback preservados. API1864113/worker1864114, Server22f928…/KBb49… y Native idénticos al corte previo, sin SQL/inferencias/reinicios del despliegue estático.

UI autenticada IAB1280×720: ojo abre imagen completa740×386.796875px igual al contenedor, objectFit contain, control de cambio presente, Guardar imagen deshabilitado sin cambios y0overflow.0 ediciones/guardados; pestaña temporal cerrada y trabajo del usuario intacto. Las escrituras, incertidumbre y CAS descritos antes son sintéticos, no nuevos reemplazos guardados en VM. Sin aceptación de nueva escritura productiva de imagen, hardware o rendimiento. Negocios29 sigue draft/partial/unregistered/approval:null; los44 cuerpos aprobados incluido POS5 permanecen intactos, sin aprobación o publicación heredada.


## Editor de producto e imagen al guardar R10 — 2026-10-29

[Plan94 R10, sección19](../../../mvp/94-business-point-of-sale-and-product-refactor.md#19-editor-de-producto-e-imagen-al-guardar-r10--2026-10-29) registra preview grande/X, imagen local persistida sólo al Guardar, comparación Campo/Guardado/Mis cambios con indicador de cambios, nombre primero y código de proveedor a todo el ancho después, precio alternativo/flag alineados y ayuda por label. Son presentación e interacción Client sobre APIs existentes, sin nuevas herramientas ni cambios de acceso o confirmación IA.

Sólo el formulario de producto nuevo inicia offer_price0; no cambia el default de BD/DTO, importación u OCR. En edición se conserva null hasta entrada explícita; vaciar representa null y con flag activo sigue siendo inválido.0 mantiene su significado numérico y el total positivo al completar una venta conserva su regla. No se rellena una ausencia histórica ni se fuerza relación entre precio normal y alternativo.

Elegir/X/Cancelar antes de Guardar no muta la imagen persistida. Guardar persiste campos y luego ejecuta la operación de imagen usando ID/versión devueltos; sustitución mantiene la anterior hasta asociación de la nueva. No existe atomicidad global con almacenamiento: un producto puede estar guardado si falla la imagen. Conservar modal, identidad de producto/intento y borrador permite recuperar sólo la fase pendiente, sin repetir create ni PUT incierto, con revisión explícita ante versión concurrente. Cancelar no promete deshacer una fase ya persistida.

[Recibo R10](../../../evidence/business-product-editor-20261029-r01.json):18 paths implementados; Client2215/266 correcto antes del último fix del preview y9/9 Draft finales después (la novena regresión es posterior a esa suite),16hook/14ProductsTab/11Modal/7inputs y tipado/lint/build correctos. Cinco perfiles sintéticos320/390/600/1569px ES oscuro/EN claro verifican preview220/280px, X44px, alineación/nombre/código, comparación tarjetas/tabla650, ayudas por teclado, resize sin nuevas queries y0overflow. El preview conserva blob/naturalWidth durante fallo y conciliación.

Alta sintética sin imagen hace1POST/0 operaciones de imagen; con imagen, campos→reserva→1PUT→complete. Cancelar antes de Guardar no muta; PUT incierto conserva1create/1file y se concilia sin replay; X sólo hace DELETE al Guardar. La primera inspección autenticada R01 confirmó orden/labels y X, pero detectó imagen recortada en frame280px. El sucesor estático R02 corrige sólo los estilos del preview (posición absoluta/inset0/objectFit contain);9/9 Draft, build/tipos/lint R02 pasan.173 estáticos/169assets actuales/32previos comprobados, con API/worker/Server22f928…/KBb49…/Native idénticos. UI autenticada final IAB1280×720: imagen completa580×278px igual al contenedor interior/frame exterior280px, naturalWidth cargado, X44px, nombre/código en orden y sin «Subir imagen».0 ediciones/guardados y pestaña temporal cerrada, trabajo del usuario intacto. Se acredita presentación real de VM; no un nuevo guardado de imagen allí, atomicidad global, hardware o rendimiento. Negocios28 sigue draft/partial/unregistered/approval:null. POS5 aprobado y sus hashes permanecen intactos; no publicación ni aprobación heredada. No se crea otra ficha o ADR para reutilizar el ciclo de imagen y recuperación ya existente.


## Resumen del negocio: orden visual R09 — 2026-10-29

[Plan94 R09, sección18](../../../mvp/94-business-point-of-sale-and-product-refactor.md#18-orden-visual-del-resumen-del-negocio-r09--2026-10-29) registra la distribución solicitada: desde md, Catálogo/Rendimiento comercial en la primera fila, Proveedores registrados/Proveedores clave en la segunda y Últimas facturas a todo el ancho en la tercera. Por debajo de md, una columna conserva el mismo orden DOM y de lectura; separación vertical24px/horizontal16px y un único árbol con estados/controles existentes.

Evaluación de impacto visual conforme al estándar de conocimiento: cambia la ubicación de paneles; no cambia datos, cálculo o interpretación de indicadores, fechas/importes, consultas/APIs, acceso/ownership, acciones, herramientas, contexto enviado a IA ni confirmación humana. La ficha POS5 y los otros cuerpos aprobados permanecen intactos. No hace falta una nueva ficha funcional o ADR por esta distribución reversible.

[Evidencia R09](../../../evidence/business-overview-rows-20261029-r01.json): Client2187/264,11Overview y tipos/lint/build correctos. QA sintética en12 perfiles320–1569px ES oscuro/EN claro verifica filas2/2/1 desde md, una columna por debajo, gaps16/24,0overflow, mes octubre2026/importe42000 y DOM conservados tras resize/refetch.0GET al resize,6GET distintos por refetch,0POST;3skeletons iniciales/0 en refetch. «Ver todo» y preview abrir/cerrar se probaron con fixture, sin PDF real.

Client estático R09 adoptado,169 assets actuales y33previos verificados; API/worker/Server22f928…/knowledgeb49… preservados. La UI autenticada de VM en IAB1280×720 confirma cinco paneles, filas2/2/1, última fila de934px y0overflow horizontal; captura inspeccionada y pestaña temporal cerrada sin tocar el trabajo del usuario. No acredita teléfono físico, teclado virtual o rendimiento. El índice revisión27 sigue draft/partial/unregistered/approval:null y no publica ni aprueba la revisión visual o capacidades adicionales. Las verificaciones POS R07/R08 inferiores conservan su alcance previo.


## Punto de venta y ventas — despliegue VM R07, 2026-10-28

[Plan94 R07, sección16](../../../mvp/94-business-point-of-sale-and-product-refactor.md#16-adopción-en-vm-r07) y [recibo de adopción](../../../evidence/business-pos-vm-adoption-20261028-r01.json): POS está desplegado en el entorno de uso, con respaldo previo verificado. Server `/opt/nodia/releases/nodia-server-business-pos-r02` tiene manifiesto `22f928167d186565cb08fed6eb0572d43263e0a0a424f235aad26e0c7063ef24`; Client `/opt/nodia/releases/nodia-client-business-pos-20261028-r02`, manifiesto `b2043f5c54117fb3bc2bd38cd71435247e94d2d684a8f7d42af60943f753f7e7`. Knowledge efectivo `b49fde74a53483fad4fe80b8175b36bb7c337415097dd9cfa4349285f9e1e2ea` mantiene 158 capacidades, 44 documentos y 46 fragmentos con los 44 cuerpos aprobados intactos. Dos migraciones llevan el entorno a 34 registros de migración y 70 tablas, preservando las 65 tablas previas y las 36 tablas IA por el alcance comprobado.

El smoke HTTP real pasó productos con code/barcode independientes, precio alternativo mayor al normal, borrador, confirmación, anulación y reportes en cero tras anular. Un negocio y dos productos de prueba quedaron inactivos, conservando trazabilidad. Delivery verifica 172 archivos actuales y 46 assets del chat anterior con sus hashes, SPA y restricciones sin JWT; el navegador aislado sólo acredita acceso anónimo/Login, no un recorrido POS autenticado. Imagen R02 pasó PUT PNG→JPEG/ready, asociación, lectura de metadatos actuales, retirada y eliminación R2 con GET404 verificado. El recorrido de URL firmada devolvió GET200 y el acceso sin firma fue rechazado sin devolver imagen; los tres intentos sintéticos quedaron sin objeto actual tras la limpieza. Tres respaldos cifrados fueron verificados y los timers restaurados. El ajuste multipart cuenta además con cuatro pruebas Nest, compilación Linux y runtime R02 estable durante30s.

La [aprobación específica POS rev5](../../../evidence/business-pos-knowledge-publication-authorization-20261028-r01.json) y su cuerpo permanecen intactos; este índice rev24 sigue draft/partial/unregistered y approval:null. La instantánea compilada R06 más overlay controlado está fijada: esta actualización local de índices no reconstruye knowledge ni redespliega. No acredita inferencia natural por proveedor/modelo/modo ni lector físico; cada efecto comercial mantiene confirmación humana exacta. Los cortes siguientes conservan sus estados históricos.

### Refinamiento de registro de barcode — Client R02 adoptado

La [aclaración de plan94](../../../mvp/94-business-point-of-sale-and-product-refactor.md#aclaración-de-registro-de-barcode-durante-el-despliegue) conserva alta individual, CSV y edición posterior con barcode opcional, textual e independiente de code. Nuevo/Editar producto muestra ayuda ES/EN: enfocar el campo y escanear/escribir; al enfocarlo selecciona el valor para sustituirlo. El Enter del lector HID sólo se consume en ese input: no envía el formulario ni se propaga como acción POS. Guardar permanece explícito; no hay escucha global ni asignación automática desde code. CSV mantiene valores suministrados, ceros y omisiones; puede asignarse después de importar.

[Verificación local R02](../../../../ops/lab/artifacts/business-pos-deployment-20261028-r01/barcode-client-r02/client-followup-verification.json): 15 pruebas focales y suite completa2101/258 archivos, tipos/lint/build correctos; Edge sintético en320/390/600/1280px, ES oscuro/EN claro, con cero submits al escanear y borrador conservado. Client `/opt/nodia/releases/nodia-client-business-pos-20261028-r02` adoptado y conciliado por lectura, con API `/api/v1`, sin repetir activación/reload ni reiniciar API/worker/Native. La [verificación HTTP final](../../../../ops/lab/artifacts/business-pos-deployment-20261028-r01/barcode-client-r02/client-web-final-readonly.json) acredita 172 estáticos actuales y cuatro SPA con hash exacto, BusinessDetail y ayudas barcode ES/EN actuales, cuatro muestras de fallback R01/chat, health200 y productos/ventas/reportes401 sin JWT; no hubo429. Impacto de contexto: refinamiento de interacción/ayuda de una capacidad existente, sin nuevos datos, reglas comerciales, permisos, herramientas ni fuentes. Las44 fichas aprobadas permanecen byteidénticas; no se reconstruye knowledge por estos índices. Lector y móvil físicos conservan su aceptación pendiente.

### Corte R06 anterior al despliegue

[Plan94 R06](../../../mvp/94-business-point-of-sale-and-product-refactor.md#15-aprobación-y-publicación-local-r06) y [autorización humana exacta](../../../evidence/business-pos-knowledge-publication-authorization-20261028-r01.json): la [ficha POS rev5](features/point-of-sale-and-sales.md) está approved/implemented/verified, con aprobación limitada a esa revisión y su publicación. Su cuerpo aprobado y contentHash `148a52fe4478f514b20283f0d6df5ac6db39c1f7340169e0afab5aab9f603a40` permanecen intactos. Se aplicó localmente el artefacto de publicación: siete herramientas de ventas (dos lecturas/cinco preparadores), su binding y dos fuentes de informes. `knowledge:check` local verifica 158 capacidades, 44 documentos, 46 fragmentos y 25 excluidos.

Este índice rev22 conserva draft/partial/unregistered y approval:null; la aprobación no se hereda al producto, ADR085 u otras fichas. Cada cambio comercial sigue requiriendo confirmación humana exacta. La publicación local no acredita despliegue, migración de la BD objetivo, inferencia real, aceptación del lector físico ni disponibilidad de una selección proveedor/modelo/modo. La implementación conserva la [evidencia por alcance](../../../evidence/business-pos-implementation-20261028-r01.json); aceptación natural y adopción/smoke objetivo siguen pendientes en94. Los cortes siguientes conservan su estado y evidencia anteriores.

### Corte R05 anterior a la aprobación y publicación

[Plan94](../../../mvp/94-business-point-of-sale-and-product-refactor.md), [ADR085 propuesto](../../../architecture/decisions/ADR-085-business-sales-and-product-availability.md) y [ficha rev5](features/point-of-sale-and-sales.md). Alcance funcional R04 implementado localmente: imagen opcional, code/barcode separados, disponibilidad manual, precio final normal/alternativo por flag, ventas CLP con estados/snapshots/idempotencia, cinco medios informativos y America/Santiago. Backend/HTTP/SQL/R2 e integración candidata de siete herramientas tienen evidencia por alcance en el [recibo](../../../evidence/business-pos-implementation-20261028-r01.json). Publicación preparada en [artefacto único](../../../../nodia-server/config/nodia-ai-pos-publication.candidate.json), sin aplicar. La ficha permanece draft/implemented/verified, approval:null; este índice rev21 conserva draft/partial/unregistered. Sin aceptación de proveedor/humano/hardware o despliegue por declarar el código implementado. Fichas aprobadas y cortes históricos se preservan.

## Cambio solicitado el 2026-10-27: Agentic y API key

La petición actual retira Web y su delegación a Agentic; se mantienen sólo `agentic` y `api_key`. [Modos IA Agentic y API key](../general-settings/features/agentic-api-modes.md), [implementación90](../../../mvp/90-agentic-api-only-web-retirement.md) y [aceptación de proveedores91](../../../mvp/91-ai-provider-onboarding-verification.md). Implementación en curso y aceptación VM/API por comprobar. La existencia de un modo no habilita todas las capacidades; historial/snapshots y evidencias anteriores se preservan con sus límites. Los apartados inferiores son cortes previos, no habilitan ejecución Web.

## Regla vigente de módulos y privacidad — 2026-10-25

[Política89](../../../mvp/89-module-access-and-user-data-scope.md) y [ADR081](../../../architecture/decisions/ADR-081-module-access-and-business-data-scope.md). El módulo habilita funcionalidades y no datos ajenos. Usuarios ordinarios necesitan el módulo y la propiedad o colaboración explícita; super_admin tiene bypass de permisos y acceso global. Las acciones de roles no bloquean. El guard vuelve a Inicio sin módulo. Se conservan sesión, recursos existentes, confirmaciones humanas y atribución del actor; ver un chat ajeno no permite confirmar como su autor. Esta revisión candidata sustituye las referencias históricas a ai:manage y al acceso global entre negocios; no publica conocimiento ni altera aprobaciones anteriores.


Metadatos canónicos migrados en [AI-06](../../../mvp/52-nodia-ai-ai06-knowledge-publication-contract.md); este resumen conserva aprobación pendiente y no se publica; las secciones funcionales de lectura publicadas se identifican debajo.

Corte anterior2026-10-25: [Client de retry17f adoptado](../../../evidence/nodia-ai-c03-attachment-policy-client-adoption-20261025-r01.json) con172 estáticos target/59legacy HTTP verificados y108 assets compartidos byteidénticos; R07 retenido mediante fallback nginx sólo hashed. Server4276 y publicación fda151/42/C03 revisión3/hash aprobados permanecen exactos. Once pruebas Linux root sin skips; cero SQL/SDK/generación en la adopción, sin restart de API/worker y con reserva backup preservada. La UI autenticada del retry y un PNG nuevo siguen pendientes. El texto conservado con panel de adjuntos vacío mantiene causa raíz pendiente; abrir Preferencias en la SPA anterior no prueba cache miss. No hay extracción0/null o C03 aceptados ni cierre AI36/38; este índice revisión10 sigue draft/unregistered y approval:null. Los cortes anteriores conservan sus evidencias.

Corte anterior2026-10-25,22:13UTC: [fix nativo de clasificación de timeout cf652 adoptado](../../../evidence/nodia-ai-c03-agentic-status-timeout-adoption-20261025-r02.json), sólo1módulo de51;29Linux/7FakeRunner de candidata, Server4276/Client17f/nginx8ea y publicación fda151/42 conservados. Backup4cabb174 ready7d/reserva preservada, API/worker196756/196757 activos y timers restaurados, cero generaciones o efectos comerciales durante adopción. Nueva epoch138e361d: MCP+PNG+PDF+WAV+WebM siguen pendientes, sin ningún caso de recalificación ejecutado en este corte. No se reclama disponibilidad actual ni C03/0/null o UI del retry aceptados; AI36/38 abiertos. El fallo de construcción R01 y los proofs8320 son históricos; causa de pérdida del estado del adjunto sigue pendiente. C03 aprobado3/hash no cambia; este índice revisión11 permanece draft/unregistered y approval:null.

Corte anterior de adopción2026-10-25,23:24UTC: [caché parcial b20f/cf5a adoptada](../../../evidence/nodia-ai-c03-agentic-status-evidence-cache-adoption-20261025-r01.json),51módulos/1delta,20FakeRunner Docker+29Linux. API239972/worker239973 Server4276 y Client17f/nginx8ea/fda151/42/C03 aprobado3/hash preservados, backup53f4c6f7 ready7d/timers y reserva conservados, cero generaciones/efectos durante adopción. Recalificación MCP+PNG/PDF/WAV/WebM y UI retry/C03/0/null aún pendientes al corte de adopción; cohorte posterior con evidencia separada. Build cache retirado sin imágenes/volúmenes/releases borrados, ampliación cancelada y mergeAccessDenied separado del servicio/C03. Índice revisión12 draft/unregistered, approval:null, sin knowledge build o aprobación nuevos.

Corte vigente posterior: [metadatos positivos, MCP incierto cerrado](../../../evidence/nodia-ai-c03-cache-metadata-and-mcp-stop-20261025-r01.json),1start9e161c28/0callbacks/6RPC/1155events, CANCEL/reconcile/ACK1completados,pendingidentityfalse ysinreplay.4MIME no intentados yC03/0/null/UIretry/AI36/38 siguen sin aceptar. La misma epochcf5a/adopciónb20f ypublicaciónfda151/42/C03aprobado3/hash siguen intactos. Diagnóstico terminal seguro antes deotrasinferencias; no causa atribuida, no disponibilidad por metadatos. Índice revisión13draft/unregistered/approval:null.

Ficha candidata de la regla vigente: [Privacidad de datos](features/business-data-privacy.md). Las referencias inferiores al acceso global de hijos de Negocios describen cortes históricos y quedan sustituidas por89.

## Propósito y alcance

Gestionar negocios, proveedores comerciales, sus contactos, productos, historial de precios, facturas de compra y ventas con partidas. El proveedor comercial no es una conexión de IA y una factura no es un pago.

El alcance confirmado comprende consultas y CRUD individual donde exista endpoint, con aclaraciones/vista previa y confirmación. Las fichas describen el backend actual y señalan ampliaciones pendientes; ninguna crea herramientas o permisos.

## Conceptos y relaciones

| Concepto | Significado y relación |
|---|---|
| Negocio | Agrupa catálogo y facturas; identidad UUID y dueño asignado por Server. |
| Proveedor comercial / contacto | Proveedor bigint ligado a negocio; contactos independientes con horario propio. |
| Producto / log | Producto bigint con precios actuales; log UUID como snapshot registrado, no venta ni movimiento de caja. |
| Factura / extracción | Factura persistida con importe registrado y archivo opcional; extracción IA es propuesta de datos aún sin guardar. |
| Venta / partida / disponibilidad | Venta CLP de una empresa con partidas congeladas y medio informativo; code comercial/barcode independientes. has_stock manual no cambia al vender; imagen opcional. Desplegado en VM con siete herramientas publicadas tras aprobación específica POS rev5; smoke HTTP de ventas/reportes por alcance. |

## Módulos y autoridad

Destino /tools/business. Conforme89, módulo y sesión vigentes más propietario/colaborador para usuarios ordinarios; super_admin conserva bypass de acceso. No se reactivan acceso global histórico ni bloqueos por acciones. NodiaAI exige además su módulo, revalida cada recurso/recibo y conserva confirmación humana exacta.

Los modos operativos son Agentic y API key conforme90/92. Function calling API no equivale a MCP; catálogo/login/clave no prueban inferencia. Referencias Web de cortes anteriores son históricas y no habilitan ejecución. Credenciales/cookies no se incorporan al contexto.

## Índice de funcionalidades

| Función | Ficha | Implementación | Integración NodiaAI | Destino |
|---|---|---|---|---|
| Negocios y colaboradores | [businesses-and-collaborators](features/businesses-and-collaborators.md) | Backend existente/parcial; gates en ficha | Sólo lecturas AI-15 publicadas; resto pendiente | `/tools/business` |
| Proveedores comerciales | [suppliers](features/suppliers.md) | Backend existente/parcial; gates en ficha | Sólo lecturas AI-15 publicadas; resto pendiente | `/tools/business` |
| Contactos de proveedores | [supplier-contacts](features/supplier-contacts.md) | Backend existente/parcial; gates en ficha | Sólo lecturas AI-15 publicadas; resto pendiente | `/tools/business` |
| Productos | [products](features/products.md) | Backend existente/parcial; gates en ficha | Sólo lecturas AI-15 publicadas; resto pendiente | `/tools/business` |
| Calculadora local y vinculación OCR revisada | [product-price-calculator-and-invoice-binding](features/product-price-calculator-and-invoice-binding.md) | Rev6: precios/vinculación y recuperación OCR; R12/R31/R14 activos, cancelación y cierre R14 confirmados; extracción final validada sin guardado comercial | Draft/partial/unregistered/approval:null; sin nueva publicación | `/business` |
| Historial de productos | [product-logs](features/product-logs.md) | Backend existente/parcial; gates en ficha | Sólo lecturas AI-15 publicadas; resto pendiente | `/tools/business` |
| Punto de venta, ventas y reportes | [point-of-sale-and-sales](features/point-of-sale-and-sales.md) | POS manual desplegado por los recibos previos; ampliación local R24 pendiente de su integración/adopción | Rev5 conserva su aprobación histórica; R17 limita ventas a dos lecturas/cero escritores. Fichas R24 draft sin publicación nueva | `/tools/business`, y módulo NodiaAI para chat |
| Ajustes de precio por partida — R24 | [sale-line-price-adjustments](features/sale-line-price-adjustments.md) | Implementación local; integración global/SQL/adopción pendientes del recibo R24 | Draft/unregistered/approval:null; dos lecturas de ventas, cero escritores | `/tools/business` |
| Confirmación e impresión manual80mm — R24 | [manual-sale-ticket-printing](features/manual-sale-ticket-printing.md) | R20–R23 adoptados por sus recibos; cambios locales R24 con integración/adopción pendientes | Draft/unregistered/approval:null; sin herramientas IA ni publicación | `/tools/business` |
| Facturas y archivos | [invoices-and-files](features/invoices-and-files.md) | Backend existente/parcial; gates en ficha | Sólo lecturas AI-15 publicadas; resto pendiente | `/tools/business` |
| Efectos confirmados AI-22 | [confirmed-business-effects](features/confirmed-business-effects.md) | Catorce puertos internos; verificación final pendiente en68 | Draft/unregistered, sin publicación MCP | `/tools/business` |
| OCR conversacional y comparación de Productos | [Recorrido NodiaAI](../nodia-ai/features/invoice-ocr-product-comparison.md) | Partial local; OCR separado y referencias privadas probados aisladamente; aceptación real/guardado pendientes | Draft/unregistered; sin publicación nueva | `/tools/nodia-ai` y autoridad de Negocios |
| Análisis de facturas | [invoice-analysis](features/invoice-analysis.md) | Backend existente/parcial; gates en ficha | Sólo lecturas AI-15 publicadas; resto pendiente | `/tools/business` |

## Interpretación de solicitudes que combinan funciones

«Agrega este número al proveedor» debe resolver negocio, proveedor y contacto; el teléfono pertenece al contacto, no a fields del proveedor. «Cuánto gasté» requiere aclarar si significa total de facturas registradas o dinero pagado: este producto no tiene ledger de pagos y Finanzas no tiene provider_id.

Informes cruzados requieren medidas compatibles y procedencia separada según41; no deducir relaciones sólo porque dos productos usan la palabra gasto/proveedor. Pasos dependientes conservan resultados y se recuperan sin duplicarlos; el modelo no confirma ni ejecuta SQL libre.

## Restricciones y pendientes

PRD inicial es borrador histórico: delivery_cost, prorrateo, analítica global y matching automático no se publican como capacidades existentes. Bulk/import7 excluidos de NodiaAI v1, aunque la app los tenga. AI-22 incorpora manager compartido para producto+log y escritores individuales; las secuencias dependientes conservan AI-23 y los informes combinables AI-30/31. Nuevos adjuntos/promoción y traslado de facturas con archivo esperan AI-32; R2 binario real mantiene su gate.

Publicación de conocimiento, proyecciones y autoridad depende de AI-06/07/08/12 y de la familia de herramientas. Markdown explica, no habilita. No se cargan estos borradores automáticamente al proveedor. Política50 elimina contenido del chat y registros técnicos resueltos sin borrar dominio/preferencias aceptadas.

## Evolución y trazabilidad

| Revisión | Cambio funcional y fuentes | Impacto |
|---|---|---|
| 1 | AI-05: 7 fichas funcionales desde especificaciones/backend e inventario39 | [Cobertura/diferencias/gates](../../../mvp/51-nodia-ai-ai05-product-knowledge.md); sin migraciones/runtime/publicación ni aprobación automática |
| 17 | Solicitud POS2026-10-28 y aclaraciones CLP/medio informativo; plan94/ADR085 | Ficha candidata nueva y migración stock planificada; fichas aprobadas y runtime preservados |
| 18 | Aclaración R02: imagen opcional, code comercial/barcode separados, efectivo inicial y oferta habilitable | Ficha rev2 y contratos planificados, sin aprobación documental/publicación ni implementación implícitas |
| 19 | Aclaración R03: precio adicional distinguible, sin comparación ni descuento/porcentaje automático | Ficha rev3; flag selecciona importe y se preservan snapshots; sin aprobación global, código ni publicación |
| 20 | Aceptación R04 de siete reglas finales, medios propuestos y America/Santiago | Alcance funcional cerrado/POS-01 completo; ficha rev4 planned, sin aprobación completa, implementación ni publicación |
| 21 | Implementación local R05 de POS, ventas, reportes y contratos/preparadores candidatos; recibo técnico por alcance | Ficha rev5 draft/implemented/verified; artefacto candidato sin aplicar en ese corte; índice draft/partial/unregistered |
| 22 | Aprobación humana exacta POS rev5 y publicación local R06; autorización y plan94 | Siete herramientas, binding y dos fuentes incorporados; knowledge:check158/44/46/25. Ficha POS aprobada intacta; índice draft/partial/unregistered, approval:null; sin despliegue ni aceptación natural |
| 23 | Adopción VM R07 con respaldo, dos migraciones y runtime R02; recibo de despliegue y plan94 sección16 | Ventas/reportes HTTP reales y preservación comprobados; ciclo de imagen probado hasta eliminación, URL firmada/denegación aún en verificación en ese corte. Knowledge efectivo158/44/46 y44cuerpos aprobados intactos; índice draft/partial/unregistered, approval:null; sin inferencia/lector aceptados |
| 24 | Cierre de smoke imagen R07 y refinamiento de registro de barcode Client R02 adoptado, con plan94 y evidencia del paquete | URL firmada200/sin firma rechazada/objetos404 comprobados. Barcode opcional, foco/Enter locales y guardado explícito;2101pruebas y build correctos. Sucesor Client adoptado/conciliado sin reiniciar API, con delivery172/4SPA/4muestras fallback correcto; índice draft/partial/unregistered, approval:null y44fichas aprobadas intactas |
| 40 | R24: precio por partida, salida segura y formatos explícitos; tabla9/12 sin nuevas consultas | Implementación, QA, SQL desechable y adopción acreditados en el recibo R24; aceptación física pendiente. Draft/unregistered/approval:null;44aprobadas intactas |

## Lecturas locales AI-15

La [entrega AI-15](../../../mvp/61-nodia-ai-ai15-product-reads.md) implementa doce puertos locales de lectura para Negocios, con contratos cerrados y casos de uso compartidos bajo el manager del checkpoint. La familia de lecturas forma parte del release explícito publicado; este resumen de producto sigue excluido y no concede permisos por sí mismo. Los listados admiten páginas de hasta 100 filas, actividad inicial activa donde existe ese campo y selección explícita de inactivos o todos. No se permite `all:true`, SQL libre ni filtros derivados del ORM.

El negocio conserva pertenencia de dueño/colaborador activo y alcance global explícito de super_admin; los resultados recuperados de listados vuelven a verificar pertenencia. Productos, proveedores comerciales y facturas conservan su acceso global autenticado intencional, además del permiso NodiaAI y módulo destino. Las proyecciones excluyen relaciones de usuarios, claves de almacenamiento, JSON arbitrario e idempotencia interna.

Las cuatro capacidades adicionales están implementadas/publicadas: elegibilidad OCR externa y tres referencias privadas de archivo/CSV. El I/O ocurre fuera de SQL y las descargas reautorizan chat/recurso. Dos CSV tuvieron GET positivo real; la referencia de factura se verificó con GET503 por R2 no configurado. invoice_binary_download_r2_real permanece pendiente; no se afirma contenido binario descargado ni se crean enlaces firmados u objetos nuevos.

Los cinco listados de Negocios usan el ID como desempate cuando otro campo define el orden, preservando una ordenación explícita por ID. La integración verifica páginas disjuntas con fechas idénticas tanto en UUID como bigint; esto estabiliza el paginado sin convertirlo en una instantánea entre páginas.


## Publicación de lecturas AI-15 — corte histórico

16 capacidades de lectura/referencia publicadas: doce SQL, elegibilidad externa y tres referencias privadas de archivos/CSV. Siete fichas funcionales publican sólo sus secciones de lectura. La descarga binaria positiva R2 permanece pendiente; escrituras y análisis de factura siguen sus etapas.

El corpus incorpora46 fichas:27 funcionalidades approved/published ligadas a67 contratos read/read_artifact y19 fichas draft/unregistered excluidas. La nueva ficha de efectos confirmados de Negocios está excluida; no modifica los cuerpos de las siete fichas aprobadas de lectura de ese producto. No hay escrituras publicadas. La [autorización específica](../../../evidence/nodia-ai-ai15-publication-authorization.md) alcanza esas secciones funcionales, no este resumen. Los estados del índice describen el alcance publicado de lectura de cada función y no todo su CRUD.

[AI-15](../../../mvp/61-nodia-ai-ai15-product-reads.md) distingue diez comprobaciones SQL con Gemini real y doce de referencias/CSV, observaciones externas con recibos positivos y final incierto, y routing Web parcial. R2 sin configurar no se transforma en descarga verificada; unknown no se reenvía. Los contratos se publican con permisos y límites actuales, sin prometer que todo turno del modelo termine correctamente. Sin cambios visuales ni nuevos bindings de resumen.


## Efectos individuales AI-22 — corte histórico

[Entrega68](../../../mvp/68-nodia-ai-ai22-business-operations.md) y [ficha](features/confirmed-business-effects.md) incorporan catorce registros internos sobre escritores nativos con transacción/recibo compartidos. Preparadores MCP sin publicar; una operación por propuesta. La lectura global autenticada no sustituye integridad de relaciones. Contactos conserva request_key/version; producto incluye su snapshot. Facturas permite metadatos sin nuevo upload; preserva su archivo al editar y rechaza trasladarlo a otro negocio hasta tener copia recuperable. Referencias privadas/CSV de AI-15 se conservan; no se declara paridad completa de archivos ni descarga binaria R2 real.


## AI36-C03 — análisis de factura en generación activa

La [ficha de análisis activo revisión3](features/active-invoice-analysis.md) tiene [aprobación humana específica](../../../evidence/nodia-ai-ai36-c03-publication-authorization-r01.json) y [publicación adoptada en VM](../../../evidence/nodia-ai-ai36-c03-VM-publication-r01.json). Únicamente su sección «Uso del análisis en la generación activa» está publicada: imagen/PDF original del mensaje actual hasta10MiB, prepare/extracción/complete y resultado revisable. Reutiliza el parser nativo; no inicia OCR anidado ni crea registros comerciales. Se conserva el contentHash aprobado `9fe8459c3831be7458a92b5636c50f0c6989b3a94019dff2a4f42bb24661098d`, sin cambiarlo por resultados operativos. [Entrega82](../../../mvp/82-nodia-ai-ai36-integral-coverage.md#publicación-c03-aprobada-y-adoptada-en-vm--2026-10-25) distingue implementación, aprobación, publicación y aceptación real pendiente.

## Estado sucesor C05 — 2026-10-25

El [catálogo vigente tras C03](../../../mvp/82-nodia-ai-ai36-integral-coverage.md#publicación-c03-aprobada-y-adoptada-en-vm--2026-10-25) publica151capacidades/42fragmentos de40documentos aprobados, con knowledge `fda677f49788f6dcfd250660f20a0483695969c23083044edb301052b415aefd`. Incluye las lecturas, preparadores individuales y análisis C03. Las siete escrituras masivas/importación siguen excluidas; producir efectos comerciales exige revisión exacta, botón humano y autoridad nativa vigente. No se inventan operaciones DELETE donde el recurso sólo tiene actividad u otra transición comercial.

La [aceptación técnica AI-40](../../../mvp/86-nodia-ai-ai40-codex-acceptance.md) y sus [variantes finales](../../../evidence/nodia-ai-ai40-data-variants-r01.json) acreditan descarga de un PDF sintético de factura desde R2. Esto supera el bloqueo histórico de esa descarga en AI-15 para ese entorno, sin aceptar toda cuenta/formato ni la entrada de PDF/audio al modelo Codex. Las [preparaciones reales C05](../../../evidence/nodia-ai-c05-live-preparations-r01.json) incluyen un proveedor propuesto para el negocio sintético, sin confirmar ni crear registros.

El [primer PDF C03 al traspaso](../../../evidence/nodia-ai-c03-handoff-readback-20261025-r01.json) quedó unknown después de un dispatch y una selección completada, con un slot retenido y cero propuestas/ejecuciones. Ese corte precede a la [conciliación nativa sin replay](../../../evidence/nodia-ai-c03-reconciliation-20261025-r01.json), con terminal/ACK y liberación técnica, sin análisis acreditado. La [continuidad aditiva Codex](../../../evidence/nodia-ai-additive-continuity-20261025-r01.json) conserva historial/selección, resume tres propuestas expired sin ejecutar y carga knowledge fda en un turno nuevo; sólo acredita el cambio compatible acotado, no NR-32 incompatible.

El [arreglo de lectura original](../../../evidence/nodia-ai-c03-original-read-fix-adoption-20261025-r01.json) alinea descubrimiento y prueba nativa sin OCR adicional. Los [ensayos nuevos PNG/PDF](../../../evidence/nodia-ai-c03-originals-eligibility-gate-20261025-r01.json), originales actuales con hashes exactos y sin texto aceptado, completan descubrimiento/ACK/selección pero fallan eligibility_changed antes del segundo dispatch. No llegan a prepare/complete ni normalización cero/null o resultado autenticado aceptado; no crean propuestas, facturas, productos o movimientos. La [instrumentación diagnóstica4276](../../../evidence/nodia-ai-c03-eligibility-diagnostic-adoption-20261025-r02.json) está adoptada, preserva la publicación/ficha3 y reglas, y mantiene causa pendiente al adoptar. Source6ef ya no está desplegado en su ruta VM; se conserva en un [archivo propio recuperable](../../../../ops/lab/artifacts/c03-first-fix-recovery-r01/README.md), sin reducir retención de backups. El siguiente ensayo necesita evidencia propia y no usa fallback/retry incierto.

AI-36/C05 y AI-38 siguen abiertos. Este índice draft no concede aprobación ni acceso MCP; la autorización C03 está registrada separadamente y no aprueba el producto completo. Las evidencias y fichas aprobadas conservan sus hashes.

## Recorrido planificado desde NodiaAI

[OCR conversacional y comparación](../nodia-ai/features/invoice-ocr-product-comparison.md), conforme [ADR-080 propuesto](../../../architecture/decisions/ADR-080-conversational-invoice-ocr-product-comparison.md): analizar la factura, comparar campos reales del catálogo y ofrecer guardado mediante una propuesta exacta/botón humano. Es una función nueva con implementación local parcial de NodiaAI que comparte núcleo OCR y usa contratos de Productos; no cambia las fichas aprobadas de Productos, OCR o C03. El guardado del chat no hereda una creación de factura ni un bulk genérico por reutilizar la pantalla existente. Esta revisión14 conserva draft/unregistered y approval:null; la ficha enlazada separa Client/nativo/workflow y compilación local de despliegue, guardado confirmado y aceptación real pendientes.

## Notas históricas de metadatos — revisión25

Reubicadas sin cambios el2026-10-29 para cumplir el límite4096 del esquema. Sus observaciones conservan la fecha/alcance originales y no describen un inventario vivo.

### Implementación registrada en R25

R08: prueba natural real OpenAI Agentic/conexión1/gpt-6.1-sol/medium hasta el gate humano. MCP real con nonce/terminal/ACK aceptado, fixture SQL eliminada. Ventas0 y ranking vacío de octubre/Santiago comprobados mediante SalesList completed y SQL; reports_run y ranking positivo no ejercitados. Propuesta ready/rev1 para producto9 marcado Prueba NodiaAI POS 20261028,1x1200CLP/efectivo/draft, sin venta guardada, challenge o ejecución; confirmación humana y expires_at pendientes. Cinco sesiones temporales revocadas, originales preservados y quiet0. ServerR02/ClientR02/knowledgeb49 sin cambios; no re-publicación ni aprobación heredada. Se mantiene draft/partial/unregistered, approval:null. Evidencia business-pos-nodia-ai-natural-20261028-r01.json. Corte histórico rev24: Refinamiento Client barcode R02 adoptado: ayuda ES/EN, selección al enfocar, Enter HID sin submit/propagación y guardado explícito, en alta/edición con barcode opcional; CSV preserva ceros/omisiones.2101pruebas/258archivos,15focales,tipos/lint/build y QA Edge320/390/600/1280 correctos. Paquete sucesor adoptado y conciliado por el coordinador en VM, sin reiniciar API/worker ni Native; no nuevas reglas, datos, permisos o herramientas. R07: POS desplegado en VM con Server business-pos-r02, Client business-pos-20261028-r02 y knowledge b49fde74a53483fad4fe80b8175b36bb7c337415097dd9cfa4349285f9e1e2ea (158capacidades/44documentos/46fragmentos). Dos migraciones aplicadas:34registros/70tablas;65tablas previas y36tablas IA preservadas por alcance. Smoke HTTP real de catálogo, borrador, confirmación, anulación y reportes pasó; un negocio/dos productos de prueba quedaron inactivos. Imagen R02: PUT PNG→JPEG/ready, asociación, metadatos actuales, retirada y eliminación R2 con GET404 comprobados; URL firmada GET200 y acceso sin firma rechazado sin imagen; los tres objetos de intento están ausentes tras limpieza. El fix multipart tiene cuatro pruebas Nest y compilación Linux. Cuerpos aprobados44 intactos; índice Negocios rev24 draft/partial/unregistered, approval:null. Sin inferencias de proveedor ni lector físico. Cortes históricos anteriores: R06: ficha POS revisión5 aprobada expresamente y publicación local autorizada aplicada a siete herramientas de ventas y dos fuentes de informes. Knowledge check local:158capacidades/44documentos/46fragmentos/25excluidos; no despliegue ni aceptación natural de proveedor/lector. El índice Negocios rev22 sigue draft/partial/unregistered, approval:null; la aprobación de POS no se hereda. Corte histórico R05 anterior a la autorización: POS revisión5 implementado localmente con contratos/preparadores/lecturas y reportes candidatos verificados por alcance; sin publicación ni inferencia de venta. Índice Negocios parcial/draft/unregistered, approval:null. Cortes históricos conservados: Índice sucesor 2026-10-25 al adoptar diagnóstico4276: 16 lecturas/referencias, catorce preparadores individuales de Negocios y C03 publicados dentro de151capacidades/42fragmentos. C03 aprobado revisión3/hash intactos. Unknown original conciliado sin replay; prompt de descubrimiento alineado con lectura original, pero nuevos PNG/PDF fallan eligibility_changed antes del segundo dispatch, sin prepare/complete ni extracción0/null aceptados. Instrumentación segura activa, causa aún pendiente al adoptar; publicación no equivale a aceptación por operación/cuenta. Continuidad aditiva Codex parcial conserva propuestas vencidas sin ejecución. AI-40 acredita descarga privada de PDF sintético R2 en VM Linux. Sin OCR anidado ni escrituras masivas; índice draft/unregistered. Corte sucesor: Client17f de retry adoptado; UI autenticada y nuevo PNG pendientes, sin aceptación C03 ni cambios de publicación. Corte sucesor22:13UTC: fix nativo mínimo cf652 adoptado, Server4276/Client17f/publicación fda intactos. Nueva epoch exige MCP+PNG/PDF/WAV/WebM aún no ejecutados en este corte; sin UI retry/C03 aceptados. Corte23:24UTC: caché b20f/cf5a adoptada con TTL30 original y presupuesto12/18, sin cache final de elegibilidad; Source4276/Client17f/fda15142 intactos. Recalificación nueva y C03/UI pendientes al corte de adopción. Cohorte posterior: metadatos positivos, primerMCP mcp_result_unknown cerrado/ACKsinreplay;4MIME no intentados,C03noaceptado. Nueva función con implementación local parcial: OCR durable separado tras terminal/ACK, proveedor explícito, referencias privadas entre turnos y comparación de Productos. Verificación aislada Client/nativo/workflow; guardado confirmado y aceptación real pendientes. No adoptada, unregistered y approval null; no cambia C03 aprobado3 ni fda151/42. Política89 implementada y desplegada en Server2029/Clienteada el2026-10-26: acceso por módulos sin bloqueo por acciones, super_admin bypass y privacidad por propietario/colaborador. Tres suites PostgreSQL reales y HTTP/navegador super_admin verificados; usuarios ordinarios probados aisladamente. Esta revisión documental sigue sin aprobación o publicación.

### Verificación registrada en R25

Client barcode R02 verificado y adoptado: foco/teclado del campo existente y traducciones, sin nueva capacidad ni cambio contractual. Paquete API relativa/api/v1 con seis archivos de producción (uno solo de tipos) y dos pruebas;172fuentes/pruebas del chat intactas. Tipos/lint/build y suite2101 correctos; adopción conciliada por lectura, sin repetir activación ni reload. API/worker1864113/1864114, Native y respaldos/timers preservados. Deliveryfinal172estáticos/4SPA/4muestras fallback, helper ES/EN y health200/protegidos401 sin JWT comprobados; R07: despliegue VM autorizado y respaldado; Server R02 manifest22f928167d186565cb08fed6eb0572d43263e0a0a424f235aad26e0c7063ef24, Client manifestb2043f5c54117fb3bc2bd38cd71435247e94d2d684a8f7d42af60943f753f7e7 y knowledge b49fde74a53483fad4fe80b8175b36bb7c337415097dd9cfa4349285f9e1e2ea. Preservación y smoke HTTP de ventas/reportes acreditados por alcance. El ciclo real de imagen pasó: PNG→JPEG, asociación, URL firmada GET200, acceso sin firma rechazado sin imagen, retirada y R2GET404; tres intentos sin objeto actual. Tres respaldos cifrados verificados y timers restaurados. La instantánea de knowledge R06 más overlay controlado queda fijada: estos índices locales posteriores no reconstruyen ni redespliegan ese release. POS rev5 y los otros43 documentos aprobados conservan bytes; no aceptación natural de proveedor/hardware ni aprobación heredada a este índice. Cortes históricos anteriores: Corte vigente R06: aprobación humana específica de POS rev5 y publicación local de siete herramientas de ventas (dos lecturas/cinco preparadores), binding y dos fuentes de informes, comprobada con knowledge:check (158capacidades/44documentos/46fragmentos/25excluidos). La ficha aprobada conserva su cuerpo y contentHash148a52fe4478f514b20283f0d6df5ac6db39c1f7340169e0afab5aab9f603a40; el índice rev22 permanece draft/partial/unregistered y approval:null. Sin despliegue objetivo, migración de BD de uso, inferencia real ni confirmación de ventas individuales. Cortes históricos anteriores: La publicación fda permanece congelada; este índice no hace knowledge build ni modifica una ficha aprobada. Conciliación y continuidad compatibles verificadas acotadamente, sin efectos comerciales; cambio incompatible sigue pendiente. Nuevos originales actuales/hash exactos sin texto aceptado completan descubrimiento/ACK/selección, pero fallan antes del segundo dispatch; no hay extracción C03 aceptada. Runtime4276 instrumentado y capacidad de backup recuperada con código source6ef archivado; causa de elegibilidad indeterminada al adoptar. Los39tests anteriores siguen reportados sin log bruto;146focales/11compiladosLinux/8+6guardasLinux capturados separados de inferencia. Este resumen sigue draft/unregistered y approval:null, sin nueva aprobación o herramientas. Adopción Client17f:172target/59legacy HTTP/hash/MIME/COOP,108shared byteidénticos,R07 retenido;11/11Linux sin skips. Server4276/config/epoch/fda/PIDs exactos,cero SQL/SDK/generación del operador y reserva preservada. UI retry/PNG pendientes; no inferir cache miss de Preferencias ni cerrar causa del adjunto perdido. NativeR02 modifica sólo agentic_service.py entre51módulos;29Linux+7FakeRunner de candidata pasan. API/worker196756/196757 y timers activos,41tablas/schema/proveedores/Client/nginx/fda preservados,backup4cabb174 ready7d y reserva mantenida. Cero generaciones/efectos/migraciones/restore durante adopción; no inferir disponibilidad MCP/MIME ni recalificación de epoch nueva a partir de pruebas aisladas o proofs8320 históricos. Adopción cache real:20FakeRunnerDocker+29Linux,51módulos/1delta;backup53f4c6f7 ready7d/timers/free4425900032. API239972/worker239973 y41tablas/schema/proveedores/Client/nginx/fda conservados,0generaciones/efectos en adopción. Nuevaepoch requiere cohorteMCP+4MIME; no disponibilidad niC03/0/null aceptados. Capacidad recuperada exclusivamente de build cache; ampliación cancelada/mergeAccessDenied aparte. Preflight metadata positivo1erintento;execute3observaciones/1retrymetadata,0retryinferencia.1startadmitido9e161c28,callbacks0/RPC6/1155events,CANCELreconcileACK1completados,pendingidentityfalse;nocualificaMCP/MIME,no causa técnica atribuida. Diagnóstico seguro antesdeotra inferencia;coste/llamadas internasnull. Política89: PostgreSQL real y adopción Server2029/Clienteada comprobados; HTTP y URL directa super_admin sin asignación verificados. Alcance y límites en el recibo; sin aprobar/publicar esta revisión.

### Referencias operativas privadas de R25

Conservadas como rutas históricas; los recibos públicos enlazados arriba consolidan su alcance. No son dependencias de publicación.

- `ops/lab/artifacts/business-pos-deployment-20261028-r01/barcode-client-r02/client-followup-verification.json`
- `ops/lab/artifacts/business-pos-deployment-20261028-r01/barcode-client-r02/client-web-final-readonly.json`


## Presentación de Ventas y Reportes — R15, 2026-10-30

[Plan94, sección24](../../../mvp/94-business-point-of-sale-and-product-refactor.md#24-filtros-tablas-y-entrada-de-productos--r15-2026-10-30) registra los siete ajustes pedidos. Filter agrupa estado comercial y fechas de Ventas, y período/orden de Reportes. La búsqueda y paginación de Ventas son del servidor; omitir estado excluye descartadas, sin prometer Todos. El rango se interpreta por completed_at en America/Santiago con último día incluido. Cancelar conserva lo aplicado; aplicar, limpiar o quitar criterios conserva la búsqueda y reinicia la página cuando corresponde.

Las métricas se muestran como tarjetas independientes. «Promedio por venta» conserva el ratio del servidor y el redondeo aproximado al peso. El ranking sigue mostrando hasta10productos por unidades o importe, sin paginación o total global inventados. No se crean medidas ni filtros backend nuevos. El estado vacío del POS indica cómo agregar el primer producto y se centra en el espacio restante. El formulario de producto pone barcode opcional primero y lo enfoca una vez al abrir, sin guardar con Enter ni volver a enfocar por refetch.

Evaluación de impacto conforme al estándar KB: radio8px de tablas y breadcrumb sin margen son exclusivamente visuales. Orden/foco, filtros agrupados y copy existente modifican la interacción/presentación, conservando conceptos, operaciones, autoridad, período y cifras. No cambian checkout, carritos recuperables, productos disponibles, permisos, propuestas exactas o efectos comerciales. No necesitan herramientas, capacidades o fichas nuevas. Las44fichas aprobadas, incluida POS5, permanecen intactas; esta revisión es draft/unregistered/approval:null y no se publica. Verificación y adopción R15 pendientes al preparar este texto.


## Adaptación móvil R16 — 2026-10-30

R16 móvil implementado y desplegado: tarjetas xs/listas y ranking, modales16px/X44/acciones44, precios íntegros y visores con nombre desplazable. POS conserva único motor y carritos; paneles compactos, lector visible al volver de Pago y popup acotado. Client2389/288, tipos/lint/build correctos; QA40vistas de Negocios,24Sales/Reports y10perfilesPOS. Clienta22f0170…8985 activo/runtime intacto; UI autenticada390×844 verificada sin Save/Confirmar. Sin contratos, Server, herramientas, permisos, aprobación o publicación nuevos. La disposición conserva conceptos, operaciones, interpretación monetaria y confirmación humana existentes; no afecta el contexto funcional ni exige una herramienta nueva. La ficha POS aprobada5 y las otras43 aprobadas conservan bytes. Los calendarios históricos y el teclado físico mantienen sus límites de aceptación. Ver [Plan94, sección25](../../../mvp/94-business-point-of-sale-and-product-refactor.md#25-adaptación-móvil-de-negocios--r16-2026-10-30).


Referencia histórica de verificación conservada fuera del índice limitado de evidencias: docs/mvp/51-nodia-ai-ai05-product-knowledge.md.


Referencia histórica adicional: docs/evidence/nodia-ai-ai05-knowledge-validation.json.

Lectura adicional de PrintTicket: MediaSizeWidth71988µm y MediaSizeHeight3275974µm (71.988×3275.974mm), opción ZIJIPAPER420. Es la configuración que declara el driver; no se infiere papel físico80mm, corte, avance o salud. No se modifica. [Unidad del Print Schema](https://learn.microsoft.com/en-us/windows/win32/printdocs/pagemediasize).

## Precios y vinculación manual: adopción de §35 — 2026-11-06

ServerR11 y ClientR28 adoptados y verificados. R10 aplicó una sola migración44→45 con2DROP e invariantes de94tablas; su arranque falló por hashes estáticos de26contratos y quedó detenido. R11 recuperó el runtime con5JSON/assets,0DDL/0escriturasDB adicionales y API/Worker estables30s; no se repitió la migración. ClientR28 tuvo una activación/recarga,186outputs actuales verificados y assets históricos conservados. NativeR12, flags, entorno, auth y timers preservados. Client: 308 pruebas/25 suites, typecheck y lint correctos. Server: corrida inicial315/23 y posterior de metadatos159/3, parcialmente solapadas y sin sumarlas; typecheck de producción/lint correctos y fallo de specs WIP ajenos conservado. Una regresión adicional de bundle pasó (100casos filtrados, no101pruebas) y se verificaron153contratos/12familias más el constructor real LoadNodiaAiKnowledge. CUA autenticada1088/320 comprobó precios normal/oferta16px/700 y oferta roja, ausencia de margen, sugerencia30→40% con venta350intacta, venta manual990sin cambiar costos226/269 y Aplicar377sólo en borrador. Cancelar/reabrir conservó venta guardada350 y reinició30%; no se pulsó Guardar ni ejecutó OCR/proveedor. Móvil: diálogo288px, acciones256×44 y catálogo310client=scroll, sin overflow. La vinculación OCR se acredita con pruebas atómicas y fixture sintética, no con OCR/guardado reales. [Evidencia consolidada](../../../evidence/business-product-pricing-20261106-r01.json). Estilo16px/700 sin nuevos datos/operaciones; calculadora y vinculación cambian contrato y cuentan con [ficha propia](features/product-price-calculator-and-invoice-binding.md), aún excluida.

Evidencia histórica conservada: [AI-15, cierre externo original](../../../evidence/nodia-ai-ai15-live-external-final.json).

## Recuperación OCR identificada — 2026-11-06

Server R12, Client R31 y Native R14 activos y verificados. La cancelación real inicial con R13 cerró localmente y conservó el archivo, pero mostró un aviso genérico por un header omitido. R14 corrigió sólo esa allowlist: 655 casos Linux sin omitidos, incluidos 4 ASGI. La segunda intención real fue cancelada con controles bloqueados, motivo runtime_busy correcto, mismo Blob y cierre local observado; el GET explícito de disponibilidad habilitó Analizar sin reenviar. La tercera intención nueva completó la extracción validada en la UI tras104s sobre el mismo Blob:3 partidas sintéticas y total7140. No se guardó la factura ni hubo mutaciones comerciales. Client 78 casos/4 archivos y Server 30/3 son corridas separadas; no se suman 651 de R13 y 655 de R14. La excepción legada se ejecutó una vez y conserva unknown. ADR096 propuesto; sin nuevas capacidades, bindings, aprobación o publicación. Ver [candidata rev6](features/product-price-calculator-and-invoice-binding.md) y [Plan94§37](../../../mvp/94-business-point-of-sale-and-product-refactor.md#37-recuperación-identificada-del-ocr-manual-y-motivo-real-de-bloqueo--2026-11-06). El bloqueo es un estado del motor, no permiso para reconectar o cambiar de instancia automáticamente. Las referencias de evidencia permanecen dentro del máximo32.

[Evidencia final de recuperación OCR](../../../evidence/invoice-gemini-cancel-recovery-20261106-r01.json). La especificación histórica68 permanece en las fuentes y enlaces del producto; se prioriza este recibo actual dentro del máximo de32 referencias de verificación.


## QA de vinculación manual — 2026-11-07

QA autenticada de vinculación manual en VM el 2026-11-07: un OCR Gemini Agentic de factura sintética, búsqueda por nombre y relectura exacta del producto9 del mismo negocio. Cancelar conserva la fila detectada. Preparar actualización sólo cambia el borrador: costo neto1000→900 y bruto1190→1071; código, nombre y venta1200 conservados. Reabrir consulta otra vez el producto y muestra los valores originales. No se pulsó Guardar Factura y Productos ni hubo mutaciones comerciales. ServerR12, ClientR33 y NativeR14 sin nueva adopción. Tabla provisional con columnas demasiado estrechas observada; pendiente visual. No acredita guardado final, concurrencia, atomicidad global ni otros proveedores. [Evidencia](../../../evidence/invoice-manual-match-qa-20261107-r01.json).

La recuperación anterior conserva su [evidencia histórica](../../../evidence/invoice-gemini-cancel-recovery-20261106-r01.json); la entrada directa de verificación se sustituye por esta QA más reciente para respetar el máximo de32. No cambia aprobación, publicación ni autoridad NodiaAI.


## Tabla provisional: evaluación de presentación — 2026-11-07

ClientR35 activo en VM (R34 incorporó el menú y R35 corrigió sólo la anchura/nowrap de Acciones): menú por fila de tres acciones, control +/− junto a Precio Venta para cantidad/disponibilidad y columna del candado retirada. Las columnas empiezan ocultas y se abren al publicar una extracción con productos nuevos sin disponibilidad requerida; ocultarlas conserva valores y alinea el histórico. Objetivos44px y scroll horizontal local min1000/1200px.52pruebas/2archivos, tipos/lint y build aislado correctos. La nueva QA autenticada Gemini recibió409antes del dispatch por health_status; tras GET explícito, otra intención agotó240s y devolvió504 sin extracción. No se reenvió su resultado incierto. La comprobación visual escritorio/320/600px usa el componente R35 exacto en harness aislado, rotulado sintético y sin red; verifica menú/toggle/borrador, no inferencia real. Sin guardar factura/productos ni cambios Server/Native/SQL/modelos/permisos. Se preservó la pestañaR33 anterior. No acredita escritura final ni teléfono físico. [Evidencia](../../../evidence/invoice-provisional-table-ui-20261107-r01.json). No cambia el conocimiento operativo aprobado, capacidades, herramientas o bindings. Esta ficha conserva draft/partial/unregistered/approval:null.


## Calculadora compacta: evaluación de presentación — 2026-11-07

ClientR36 activo en VM: calculadora compacta a la derecha del costo con impuestos desde sm600, porcentaje88px con%, importe visible e icono44px con tooltip «Usar precio sugerido». Un container query local de280px permite tres columnas (88+132+44+16); por debajo usa dos filas y conserva el importe entero. En xs el bloque va debajo del costo; no cambia el breakpoint global. Enter en el porcentaje evita enviar el formulario. Cambiar porcentaje/costo sólo actualiza la sugerencia; aplicar sólo cambia la venta del borrador.104pruebas/4archivos, tipos/lint/build aislado correctos. CUA autenticada1088/320px:30%→350,40%→377 con venta350 hasta aplicar, costos226/269 intactos y Cancelar/reabrir tras recarga recupera350/30%. Input/costo alineados, tooltip y targets44px comprobados; móvil sin overflow. Vista aislada600/320 verificó un importe1300000000 completo. No Guardar, mutaciones HTTP o inferencias; Server/Native/SQL/contratos/autoridad conservados. Una activación/recarga Nginx y185outputs actuales/18versiones históricas verificados. Sin publicación ni aprobación nueva. [Evidencia](../../../evidence/product-price-suggestion-ui-20261107-r01.json). No crea capacidades, herramientas, grants o bindings NodiaAI. Esta ficha conserva draft/partial/unregistered/approval:null; los cuerpos aprobados no cambian.

## Alineación del precio sugerido — ClientR37, 2026-11-07

ClientR37 activo en VM: etiquetas del porcentaje y precio sugerido alineadas, importe sin sufijo CLP y centrado en una fila mínima de40px. El importe sigue siendo un estado informativo, no un input editable. Conserva porcentaje88px, icono44px, container query280px y dos filas en móvil estrecho. Siete pruebas atómicas, tipos/lint globales y build aislado correctos (1400entradas,185outputs);185assets actuales y181anteriores verificados. CUA autenticada1088px: diferencia vertical de etiquetas0,125px y de centros del input/importe0,0625px. A320×892px, documento320/320px sin desbordamiento y modal288px; composición de dos filas intencional. Cambiar40→30% conservó venta350; después se canceló el modal sin Aplicar ni Guardar y el producto mantuvo350. Ajuste visual de dos fuentes: la operación estática no reinició Server/Native ni accedió directamente aDB/SQL. La QA visual usó lecturas autenticadas del backend, sin realizar inferencias. [Evidencia](../../../evidence/product-price-result-alignment-20261107-r01.json). Evaluación de impacto: presentación exclusivamente visual; conceptos, operaciones e interpretación comercial conservados. Continúa draft/partial/unregistered/approval:null; no publica ni habilita capacidades.

## OCR Gemini: NativeR15 adoptado, timeout real no resuelto — 2026-11-07

NativeR15 está adoptado y sus659pruebas Linux/fixture de cierre aislado pasaron, pero no resolvió el timeout OCR real. La nueva intención explícita recibióHTTP504 tras251s observados en UI; el runtime agotó su deadline240s con duración de inferencia242051ms. El progreso observó view_file (dos eventos, una finalización), document_read_completed=true, tool_error_counts={} y result_event_count=0; no acreditó resultado ni finish. Al cierre se observaron0CLI, marcadores, proofs y grupos propios,21fuentes verificadas y archivoPNG conservado con controles habilitados. Cierre local no demuestra éxito remoto: el resultado sigue unknown, sin replay, sin guardado o nuevo matching. Los cambios de prompt/diagnóstico no demuestran la causa del fallo. Se prepara instrumentación segura de cli.log/hook en R16; sigue pendiente, sin ampliar240/300/340/360s. [Evidencia](../../../evidence/invoice-gemini-timeout-20261107-r01.json). Esta observación no crea capacidades ni cambia la autoridad de NodiaAI; la ficha permanece draft/partial/unregistered/approval:null.

## Diagnóstico NativeR16 adoptado, extracción aún bloqueada — 2026-11-07

NativeR16 está adoptado con instrumentación estructural segura, pero la extracción OCR continúa bloqueada. El delta añade sólo la captura best-effort de cli.log/hook en finally, con el helper heredado intacto; errores de diagnóstico no alteran el resultado y no se registra texto libre.660pruebas Linux sin fallos/omitidas y fixture aislado sin red/perfil real correctos. La nueva intención explícita sobre el mismo archivoPNG conservado recibióHTTP504 tras250s en UI: deadline240s, inferencia242057ms, lectura view_file completada y0eventos finish/resultado. El hook observado contabilizó1decisión,0rechazos y0finish; el log examinó30835bytes/128líneas con truncado. Sus indicadores vacíos de transporte/proveedor/HTTP no identifican la causa ni prueban ausencia de fallo. Tras el cierre:0CLI/marcadores/proofs/grupos propios y22fuentes verificadas; archivo y controles recuperados. No hubo replay, otro POST de análisis, guardado o nueva vinculación tras este fallo. Los10rechazos health_status observados fueron metadatos, no inferencias adicionales. No se aisló causa remota; no se atribuye el fallo a Google ni se presupone que otro modelo/CLI funcione. Permanecen CLI1.3.1, SDK, prompt/modelo/esfuerzo y límites240/300/340/360s; resolver una estrategia compatible y demostrar una extracción válida sigue pendiente. [Evidencia R16](../../../evidence/invoice-gemini-timeout-20261107-r02.json). No cambia la autoridad, capacidades o permisos de NodiaAI; aprobación y publicación siguen separadas.
