# ADR-095 — Precios independientes y vinculación revisada de productos desde factura

> Estado: propuesto
> Fecha: 2026-11-06

## Contexto

El usuario solicita retirar `profit_percentage` de la BD y de los contratos activos, sustituirlo por una calculadora local con 30% sugerido editable sobre costo bruto y mantener la venta manual independiente de los costos. También solicita asociar una fila OCR a un producto existente mediante búsqueda y una comparación de campos seleccionables, sin escribir hasta guardar el conjunto final. La instrucción autoriza estas reglas funcionales; no equivale a aprobar este ADR ni publicar contexto NodiaAI.

El [plan94 §23](../../mvp/94-business-point-of-sale-and-product-refactor.md#23-lista-de-compra-y-edición-manual-r14--2026-10-30) describía cálculo bidireccional de venta/costos con margen persistido. Es incompatible con la nueva petición y queda sustituido en esos dos cálculos por [§35](../../mvp/94-business-point-of-sale-and-product-refactor.md#35-precios-independientes-calculadora-local-y-vinculación-ocr-revisada--2026-11-06). `code` es opcional y único por negocio cuando existe; `barcode` es independiente. Una edición de código no puede convertirse en la identidad usada para resolver la actualización.

## Opciones consideradas

### Conservar margen persistido y recalcular campos automáticamente

Reduce cambios en el formulario anterior, pero mantiene dos fuentes de verdad y modifica costos al editar la venta. No satisface la retirada solicitada ni la independencia de precios. Se descarta.

### Sustituir productos por coincidencia de código o nombre durante OCR

Evita elegir un destino explícito, pero puede actualizar otro producto cuando cambia el código o hay nombres ambiguos. Guardar al seleccionar también impide revisar el conjunto y deja efectos parciales antes del consentimiento. Se descarta.

### Precios persistidos independientes y propuesta local ligada a ID/versión

La calculadora sólo propone un precio hasta que se pulsa Aplicar. La selección OCR conserva el ID real, negocio y versión observada del destino; muestra anterior→nuevo y limita los cambios a las casillas elegidas. Se mantiene la escritura final existente con autorización, validación y concurrencia del servidor.

## Decisión

Se elige la tercera opción. La venta (`sale_price`) queda independiente de los costos CLP; el vínculo existente entre costo neto (`cost_price`) y costo bruto (`cost_price_tax`) por IVA se conserva. La calculadora usa el costo bruto y un porcentaje local sugerido de 30, editable; ese porcentaje no es un atributo del producto, una utilidad real, un impuesto ni una preferencia persistida. Editar venta no cambia costos ni el porcentaje local; editar costo, IVA o porcentaje no aplica una venta automáticamente. Aplicar es una acción explícita sobre el borrador y Guardar es otra acción sobre el producto. La oferta conserva su importe y flag propios, sin derivarla de la calculadora.

La sugerencia es `Math.round(bruto × (1 + porcentaje/100))` al peso CLP: bruto entero de 0 a 2.147.483.647, porcentaje finito no negativo con decimales y sin máximo arbitrario, y resultado dentro del mismo dominio entero. Ausencia no es cero y overflow bloquea Aplicar sin recortar el importe. El [helper local](../../../nodia-client/src/modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductModal/productPricing.ts) y sus regresiones deben acreditar esta regla antes de darla por entregada.

La nueva migración retira la columna de `products` y `product_logs`, sin recalcular costos, impuestos, precios, ventas ni los demás snapshots monetarios. Se retira de DTOs, schemas, proyecciones, CSV y operaciones activas; no se acepta silenciosamente un campo retirado. Archivos de migraciones y evidencia anteriores, recibos y propuestas firmadas conservan sus bytes. Las propuestas incompatibles se rechazan por campo/contrato vigente; no se adaptan ni ejecutan automáticamente. La migración descendente no puede reconstruir porcentajes perdidos: debe rechazar la reversión ficticia y exigir una recuperación revisada desde respaldo compatible.

La vinculación manual OCR consulta productos del negocio con búsqueda/paginación reales, sin descargar todo el catálogo. Antes de preparar cambios se obtiene el producto fresco y se comprueban negocio, ID y versión. Los campos revisables son código, nombre, costo neto, costo bruto y venta. El código extraído cambiado se ofrece seleccionado por defecto; una igualdad no inventa un cambio. Un campo no seleccionado conserva el valor del producto destino, incluido su código; ni el texto OCR ni el código elegido sustituyen al ID/version del destino. Proveedor, barcode, oferta y disponibilidad no se deducen de esta elección. El servidor revalida unicidad y versión al guardar; conflicto conserva el borrador para revisar.

## Consecuencias

- Desaparece el acoplamiento venta→costo y el margen deja de formar parte del modelo activo. Una sugerencia de 30% no prueba utilidad, descuento o tratamiento tributario.
- La retirada de columnas es destructiva para esos porcentajes: antes de adoptar se requiere respaldo recuperable, ensayo de migración y revisión de todos los consumidores. No se fabrican porcentajes al revertir ni se reescribe historia para aparentar compatibilidad.
- Seleccionar/aplicar cambios OCR no escribe ni vuelve a ejecutar la extracción. La confirmación final conserva los contratos nativos de factura/productos; no se promete atomicidad entre solicitudes distintas ni idempotencia global que no exista. Un resultado incierto se concilia por la identidad/recibo disponible, sin repetir el conjunto ciegamente.
- Contextos NodiaAI aprobados que aún describen margen o cálculo anterior conservan su aprobación histórica. La revisión debe centrarse en los fragmentos realmente servidos: la auditoría de 46 bindings encontró que Productos/Logs publican sólo lecturas sin ese campo y OCR prohíbe inventar venta/margen/impuesto, sin afirmar margen persistido. Las referencias antiguas no seleccionadas quedan históricas; no se retiran capacidades compatibles ni se publica una regla nueva. Sólo un fragmento incompatible requeriría retirada o sucesión aprobada por alcance. El repin técnico de implementación/schemas se revisó tras freeze; el registro cerrado de release conserva la admisión R09 y excluye WIP ajeno, con44documentos aprobados/46fragmentos intactos. Este ADR y la ficha candidata no publican herramientas ni restauran escritores de ventas.
- La implementación local, pruebas, SQL aislado y CUA sintética están registradas en la [evidencia](../../evidence/business-product-pricing-20261106-r01.json). R10aplicó la migración pero falló al arrancar; recuperaciónServerR11 y ClientR28 adoptados y verificados, con QA autenticada de lectura/formulario y fixture OCR sintética. No se acredita OCR/guardado comerciales reales ni se aprueba este ADR por completar la adopción.

## Referencias

- [Plan94 §35](../../mvp/94-business-point-of-sale-and-product-refactor.md#35-precios-independientes-calculadora-local-y-vinculación-ocr-revisada--2026-11-06) y [ficha candidata](../../nodia-ai/knowledge/businesses/features/product-price-calculator-and-invoice-binding.md).
- [ADR080: OCR y guardado confirmado](ADR-080-conversational-invoice-ocr-product-comparison.md), [ADR090: dinero/unidades](ADR-090-product-units-and-fractional-sale-quantities.md) y [ADR091: precio de partida](ADR-091-manual-sale-line-prices-and-pos-exit.md).
- [Producto/versión](../../../nodia-server/src/product/entities/product.entity.ts), [DTO bulk](../../../nodia-server/src/product/dto/bulk-update-product.dto.ts) y [servicio de producto](../../../nodia-server/src/product/product.service.ts).
- [Publicación de conocimiento52](../../mvp/52-nodia-ai-ai06-knowledge-publication-contract.md) y [política de acceso89](../../mvp/89-module-access-and-user-data-scope.md).
