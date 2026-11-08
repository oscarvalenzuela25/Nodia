# ADR-091 — Precio por partida y salida segura del punto de venta

> Estado: propuesto
> Fecha: 2026-10-31

## Contexto

El usuario necesita ajustar el precio de un producto para una venta concreta o guardar un precio normal para ventas posteriores. Son efectos distintos: el primero pertenece a una partida; el segundo modifica el catálogo. Una venta confirmada debe seguir explicando el precio cobrado aunque cambien el precio normal o la oferta del producto.

También solicita descartar los carritos locales al salir del POS, con confirmación y retorno a Venta 1 vacía. Esta decisión no permite perder una intención comercial enviada, de resultado incierto o no conservada correctamente en el navegador. Alternar entre Venta 1 y Venta 2 sigue conservando sus datos.

## Opciones consideradas

### Cambiar el producto para cualquier ajuste de precio

Simplifica la entrada, pero altera ventas futuras cuando el usuario sólo quiere ajustar una partida. Acopla el catálogo con la negociación de cada venta y elimina la distinción solicitada. Se descarta.

### Sustituir el precio normal/oferta del snapshot por el precio elegido

Evita ampliar el origen del precio, pero pierde procedencia y hace que un precio manual parezca una oferta o un cambio de catálogo. Se descarta.

### Separar el ajuste de partida, el cambio de catálogo y el descarte local

Conserva los snapshots observados y añade el origen manual del importe final. Cada operación mantiene sus propias validaciones y recuperación. La salida sólo descarta estado local que sea seguro descartar. Es la opción elegida.

## Decisión

`unit_price_override?: string | null` es opcional en cada partida del comando manual. Una cadena CLP canónica selecciona el precio final; null y omisión conservan la selección de catálogo. `expected_unit_price` sigue representando el precio efectivo observado, no el ajuste elegido. Server verifica producto, negocio, disponibilidad, unidad y versión antes de aceptar el comando.

La partida guardada conserva los snapshots originales de precio normal, oferta y flag, y registra `unit_price` como importe final y `price_source = manual` cuando hubo ajuste. No se añade una columna `unit_price_override`: el comando es entrada y los campos existentes explican el resultado. El evento nativo incluye las partidas manuales en `changes.manual_prices`, dentro de la transacción de venta y recibo de idempotencia.

Dinero sigue siendo entero exacto CLP, validado hasta el máximo bigint de Server; cantidad conserva hasta tres decimales y los subtotales redondean half-up por partida. Un precio manual cero es válido técnicamente, pero confirmar una venta exige total positivo. No se exige que el precio manual o la oferta sean menores que el precio normal. No se cambian conversiones de unidades ni reglas de stock.

La acción explícita de guardar permanentemente modifica `sale_price` normal y desactiva `is_offer_enabled` mediante el PUT/versionado existente de Producto. Reutiliza el cálculo inverso de ProductModal para asistir costes con el margen e impuesto inferido; no incorpora datos fiscales nuevos. Respeta el máximo propio del precio de Producto, distinto del máximo bigint de una partida. Tras el éxito, se actualiza sólo la partida del carrito originario con la versión y precios devueltos. Las otras ventas abiertas conservan sus snapshots y deben revisar un catálogo que haya cambiado. Producto y carrito no forman una transacción distribuida; un fallo no promete deshacer un cambio de catálogo ya confirmado.

`clearForExit` sustituye el workspace por una Venta 1 vacía sólo después de conservar correctamente el estado nuevo y si no hay bloqueo de almacenamiento, operaciones activas ni journals pendientes. La navegación interna que sale del POS requiere confirmar el descarte cuando hay datos locales; cancelar conserva todos los carritos. Alternar ventas no es una salida. Un resultado incierto se concilia con su misma identidad; la opción de salir no autoriza descartarlo ni repetirlo.

La migración `AddManualSaleLinePrices1793450000000` sustituye dos CHECK de `sale_items` para admitir el origen manual; no añade columnas ni transforma filas anteriores. Su down bloquea si encuentra origen manual en partidas, snapshots de recibos o auditoría, para evitar una reversión que pierda significado.

Las lecturas NodiaAI evolucionan al contrato `sales-read/3`, familia revisión 3, para mostrar el origen manual y el importe congelado. Se mantienen exclusivamente `nodia_sales_get` y `nodia_sales_list`, además de las fuentes de informes existentes. No se recupera ningún escritor de ventas, propuesta antigua, SQL libre o herramienta de impresión. La nueva ficha es un borrador excluido, no una publicación.

## Consecuencias

- El comando, journal local, snapshots guardados, auditoría e informes deben interpretar el precio final y conservar su procedencia. El precio actual del catálogo no recalcula ventas anteriores.
- La recuperación conserva el mismo comando y request_key cuando el resultado es incierto. El cambio permanente de Producto mantiene sus garantías y límites propios; no se le atribuye el recibo transaccional de ventas.
- Un rollback de Client debe conservar los carritos y journals que contengan el ajuste manual; un cliente anterior que no interprete ese campo no es una recuperación segura por sí solo.
- El descarte confirmado afecta a todos los carritos locales del ámbito, no a ventas registradas. Los bloqueos de resultado pendiente, operación activa o almacenamiento prevalecen sobre esa elección.
- La vista previa siempre muestra el detalle; los botones separados de confirmar e imprimir vale o detalle capturan el formato antes de esperar al checkout. Imprimir no es otra mutación comercial.
- Las pruebas locales no acreditan SQL real, migración objetivo, adopción, impresión física ni aprobación documental. Esos hitos se registran por separado en la evidencia R24.

## Referencias

- [Plan94, sección33](../../mvp/94-business-point-of-sale-and-product-refactor.md#33-precios-por-partida-salida-del-pos-y-legibilidad--r24-2026-10-31).
- [ADR087: checkout atómico](ADR-087-atomic-point-of-sale-checkout.md), [ADR088: workspace local](ADR-088-local-sale-workspaces-and-recovery.md), [ADR090: unidades y cantidades](ADR-090-product-units-and-fractional-sale-quantities.md).
- [Ficha candidata de ajuste de precios](../../nodia-ai/knowledge/businesses/features/sale-line-price-adjustments.md), [workspace](../../nodia-ai/knowledge/businesses/features/multi-sale-workspace.md) e [impresión manual](../../nodia-ai/knowledge/businesses/features/manual-sale-ticket-printing.md).
