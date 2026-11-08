# ADR-085 — Ventas por negocio y disponibilidad manual de productos

> R17, 2026-10-30: la decisión funcional del usuario retira las escrituras de ventas en NodiaAI. Sólo consultas/reportes mediante servicios autorizados; POS manual conserva el modelo y sus garantías. Referencias inferiores al CRUD conversacional describen el alcance anterior, sustituido por Plan94 §26. Este ADR conserva estado propuesto; no se aprueba por registrar el cambio.

> Estado: propuesto
> Fecha: 2026-10-28
> Implementación: Client/Server y siete herramientas adoptados en VM según plan94 R07, con34migraciones/70tablas, respaldo y smoke real. Hardware y proveedor reales pendientes. Desarrollo/publicación/despliegue no equivalen a aprobación documental de este ADR.

> Cierre funcional vigente R04, 2026-10-28: el usuario acepta las siete recomendaciones finales, los medios efectivo/transferencia/débito/crédito/otro y America/Santiago. Fuente literal en sección12 del plan94. El alcance funcional está cerrado; **este ADR técnico conserva estado propuesto**, sin aprobación de su contenido completo ni de fichas/publicación/implementación.

> Alcance R02: aclaraciones expresas del usuario sobre imagen opcional, barcode independiente de code, efectivo inicial y oferta habilitable. Se actualiza la propuesta; su estado documental sigue propuesto.

> Aclaración vigente R03: el precio alternativo se distingue para UI y se aplica por flag, sin validador que lo compare con el normal ni descuento/porcentaje automático. Puede ser menor, igual o mayor; estado propuesto sin aprobación global.

## Contexto

El usuario solicita un punto de venta dentro de cada empresa, carrito, imagen opcional de producto y has_stock manual en lugar de stock numérico operativo. Aclara que code es el código de factura/proveedor y se añade barcode independiente, asociado manualmente al producto para leerlo con el escáner. Moneda siempre CLP, medio informativo y efectivo como valor inicial de cada venta nueva. Añade precio de oferta y flag: si está habilitada se aplica ese precio. También requiere consultas, reportes, productos más vendidos y CRUD mediante NodiaAI.

El catálogo actual usa code como identificador único por negocio y para matching OCR; product_logs contiene snapshots posteriores, pero también admite creación/edición manual. No es una fuente de ventas ni una auditoría inmutable. Las facturas existentes son compras a proveedores y las finanzas son personales: reutilizarlas como ventas mezclaría semánticas, autoridad y medidas incompatibles.

El cambio afecta catálogo/CSV/OCR/logs, nuevas escrituras comerciales, informes, UI y herramientas IA; escoger sus invariantes es costoso de revertir. El [plan94 R05](../../mvp/94-business-point-of-sale-and-product-refactor.md) conserva alcance funcional R04 y registra implementación/evidencia y trabajo operativo pendiente.

## Opciones consideradas

### Opción A — Extender product_logs o invoices para representar ventas

- Ventajas: menos entidades iniciales y reutilización aparente de pantallas/consultas.
- Desventajas: un snapshot de producto no tiene cabecera/partidas, estado de venta, moneda, identidad de operación ni precio congelado por transacción. Facturas de compra y ventas tienen contrapartes/reglas distintas. Los logs editables no acreditan historia comercial y sus joins producen reportes incorrectos.

### Opción B — Venta normalizada con snapshots, estados e identidad nativa

- Ventajas: separación comercial clara, totales reproducibles, corrección trazable y casos de uso comunes para UI e IA. Permite concurrencia y recuperación de commit sin repetir efectos.
- Desventajas: requiere tablas/contratos nuevos, revisión de consumidores de stock y verificación SQL real aislada.

### Opción C — Venta con carrito/partidas solo en JSON

- Ventajas: estructura inicial flexible y persistencia sencilla de borradores.
- Desventajas: debilita FKs y coherencia entre empresas, complica validación, índices, ranking y reportes sobre partidas. Los mismos problemas reaparecen al implementar los informes pedidos.

### Opción D — Implantar inventario, pagos y caja completos desde el inicio

- Ventajas: modelo preparado para caja/cobros/reservas de unidades.
- Desventajas: excede la solicitud, añade reglas no definidas y sugiere garantías de pago/stock inexistentes. Medio informativo no justifica una contabilidad de pagos.

## Decisión propuesta

Adoptar B con cinco tablas: sales, sale_items, sale_events, sale_mutation_requests y product_images. Ampliar products, product_logs y businesses según94. No introducir microservicio, ledger financiero, tabla de pagos ni runtime IA adicional.

- Venta de un negocio en CLP, cantidades enteras positivas sin venta por peso/productos libres. Server calcula importes exactos; bigint/strings para snapshots y totales nuevos. Precio final = is_offer_enabled ? offer_price : sale_price, sin sobrescribir normal ni sustituir seleccionado inválido. Alternativo menor/igual/mayor permitido; sin comparación/Math.min/ahorro automático, impuestos adicionales ni override de precio en carrito. No deducir impuesto de venta desde provider.tax ni generar documento fiscal.
- products incorpora barcode nullable único por negocio, sin copiar code ni modificar matching OCR. Asociación explícita con revisión; producto sin barcode puede seleccionarse manualmente. Un solo barcode por producto en V1; sin tabla condicional de alias para resolver esta separación de campos.
- offer_price nullable comparte el dominio/comprobaciones generales del precio normal; is_offer_enabled default false selecciona el importe a usar. Sin restricciones comerciales propias ni relación de orden entre precios. Para usarlo debe haber un importe utilizable; omisión en updates conserva valores. OCR no asigna barcode ni activa/calcula precio alternativo. Cambios de precios/flag/barcode incrementan revisión y requieren revisar carrito/preview.
- payment_method admite cash/bank_transfer/debit_card/credit_card/other (efectivo/transferencia/débito/crédito/otro), con descripción opcional. Cash solo al crear por omisión; explícito se conserva y null inválido se rechaza. Default visible en preview sin acreditar cobro; edición/reload/replay no lo restablecen. Omisión/cash equivalentes para hash de creación, no para updates.
- Borrador editable/descartable, completed inmutable y cancelled con motivo; sin DELETE físico, reapertura ni reembolso implícito. Completar requiere total>0, draft vacío puede totalizar0; no reescribir datos históricos ni imponer comparaciones entre precios. completed_at de Server sin fecha comercial retroactiva/override. Anular conserva fecha original/importes y no cambia has_stock.
- FK compuesta de negocio/venta y negocio/producto; snapshots de code comercial/barcode observado, nombre, precio normal, oferta/flag, origen regular/offer, precio efectivo y costos disponibles. Reportes suman importes efectivos históricos, no catálogo vigente. Cambiar catálogo o retirar foto no reescribe ventas. Impedir traslado de producto referenciado a otro negocio.
- Identidad de mutación de dominio compartida por UI/IA, además del witness del runtime IA. Cabecera/partidas/evento/recibo en una transacción corta, sin red ni inferencia; misma clave y comando recuperan el resultado, clave reutilizada con otro comando rechaza. Revisión explícita de catálogo/venta y locks compatibles con autoridad.
- has_stock manual e independiente de is_active, con null solo en clasificación histórica. No traducir stock=0/default o quantity OCR a disponibilidad. Nuevas altas eligen booleano; POS exige true y producto activo, según aceptación R04. Retirar stock por etapas comprobadas, preservando históricos.
- Historial incluye barcode/oferta/flag para nuevos snapshots, sin rellenarlos en legacy ni fingir inmutabilidad de logs manuales. Variación de precio normal se separa de cambios de oferta; auditoría de ventas en sale_events append-only. No alterar aprobaciones históricas de fichas/ERD.
- product_images mantiene intento y objeto privado con una imagen is_current opcional por producto, para nuevos e históricos, sin bloquear altas/ventas. Puede haber candidata ready sin sustituir la actual. Upload/verificación/limpieza durable fuera de SQL; vinculación y revisión dentro. Compartir StorageService/patrón, no invoice_uploads.
- Informes desde sales/sale_items, con granos separados y ranking sobre toda la población. America/Santiago explícito para días/meses/presentación, instantes persistidos y reglas IANA/DST sin offset fijo. Diseñar sales_timezone con valor acordado en negocios existentes/nuevos. Anulación excluye la venta del total vigente de su período original y conserva evento aparte; no ajuste negativo nuevo ni reporte inmutable al cierre. Venta no acredita cobro.
- NodiaAI reutiliza ToolGateway, módulos/ownership, grants, propuestas, botón humano, ejecutor, idempotencia y recuperación comunes en Agentic/API key. No SQL libre, confirmación por texto, fallback ni ejecución por Markdown. Ficha rev5 approved/implemented/verified y publicación local autorizada bajo52 en plan94 R06; sin aceptación natural por proveedor ni despliegue bajo91/92. Esta aprobación no aprueba el ADR completo.

## Consecuencias

- Consecuencias positivas: historia estable de ventas, reportes coherentes, menos acoplamiento entre compras/catálogo/venta y recuperación común sin duplicaciones.
- Costos o riesgos aceptados: clasificación manual de disponibilidad y vinculación explícita de barcodes; no convertir automáticamente stock ni code. Imágenes privadas, versionado de ofertas y migración de consumidores forman parte del alcance.
- Trabajo posterior a R07: lector/teléfono físicos, aceptación natural por proveedor y clasificación/retiro histórico POS-09. Migración/despliegue/smoke objetivo POS-08 comprobados por94, con refinamiento de captura de barcode en alta/edición/CSV manteniendo guardado explícito. No quedan decisiones funcionales abiertas de R04. Las autorizaciones de desarrollo, publicación y despliegue no aprueban globalmente este ADR.

La aprobación de este ADR, del plan, de conocimiento y la aceptación técnica/operacional son estados diferentes. Este documento conserva estado propuesto.

## Referencias

- [Plan94](../../mvp/94-business-point-of-sale-and-product-refactor.md) y [ficha candidata](../../nodia-ai/knowledge/businesses/features/point-of-sale-and-sales.md).
- [ERD aprobado de Negocios](../../features/businesses/02-domain-model-erd.md), [ERD general](../../mvp/03-domain-model-erd.md) y [política89](../../mvp/89-module-access-and-user-data-scope.md).
- [ADR081 — ámbito de datos](ADR-081-module-access-and-business-data-scope.md) y [ADR084 — runtime común API](ADR-084-nodia-ai-api-chat-common-runtime.md).
- [Reportes76](../../mvp/76-nodia-ai-ai30-restricted-reports.md), [publicación52](../../mvp/52-nodia-ai-ai06-knowledge-publication-contract.md), [verificación91](../../mvp/91-ai-provider-onboarding-verification.md) y [paridad92](../../mvp/92-nodia-ai-api-chat-parity.md).
