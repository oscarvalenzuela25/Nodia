# ADR-080 — OCR durable de factura, comparación de Productos y guardado confirmado

> Estado: propuesto
> Fecha: 2026-10-25

## Contexto

El usuario solicita el recorrido natural «analiza los precios de esta factura» y, después en la misma conversación o en una petición conjunta, «¿algún producto subió?». NodiaAI debe reutilizar el OCR real de Productos, comparar con el catálogo guardado, mostrar variaciones y preguntar si se desea guardar los cambios mediante confirmación humana. La alternativa provisional de un botón OCR previo al envío queda descartada como flujo principal.

`AnalyzeInvoiceUseCase` ya valida el archivo y ejecuta el adaptador OCR configurado para Productos. Su orquestación conserva defaults propios; el chat comparte el núcleo, prompt/parser y validadores mediante un adaptador de identidad nativa, sin reentrar a ese caso de uso. El contrato C03 aprobado, en cambio, obtiene la extracción dentro de la misma generación Agentic mediante prepare/complete. Invocar OCR externo desde ese callback puede competir por el perfil físico ocupado y ocultaría otra inferencia. ADR-062 ya contempla una etapa OCR durable separada como alternativa, sin aprobarla o implementarla por sí mismo.

La tabla Productos tiene campos y reglas concretos. Su identidad de negocio es `business_id` y su código es `code`, único por negocio. No existe un campo SKU que pueda inventarse. El importador actual prepara filas y guarda primero una factura y después productos en solicitudes distintas; reutilizar todo ese manejador no equivale a confirmar únicamente cambios de Productos.

## Opciones consideradas

### Opción A — OCR anidado en la generación MCP activa

Reutiliza la operación, pero mantiene el riesgo de perfil ocupado y atribuye a la generación una extracción que no realizó. Se descarta, conforme a ADR-062.

### Opción B — Botón OCR manual como entrada principal

Separaría el análisis del envío, pero no satisface la interacción natural elegida por el usuario. Se descarta como diseño principal; no se documenta como función implementada.

### Opción C — Planificar, cerrar la generación y ejecutar OCR durable separado

Conserva la interacción conversacional, reutiliza la operación existente fuera de la reserva de la generación que planifica y permite reusar el resultado en un turno posterior. Requiere identidad durable, presupuesto explícito, recuperación y contratos de comparación/confirmación.

## Decisión

C es el diseño solicitado, con implementación local parcial y verificación aislada; esta decisión continúa propuesta y el nuevo recorrido no está publicado, desplegado o aceptado:

1. La petición natural y el adjunto autorizado originan una planificación tipada. Antes del OCR se pregunta qué proveedor comercial usar y se ofrece preferentemente la lista autorizada paginada y filtrada por `business_id` exacto, para utilizar sus campos/configuración nativos. Si el usuario ya dio un nombre explícito y se resuelve a un único proveedor autorizado del negocio, se conserva esa elección. No se toma el primero, un default o una omisión como selección de proveedor. También se resuelven negocio, archivo y selección OCR; el callback de planificación sólo registra intención, no llama al OCR mientras la generación está activa.
2. La generación de planificación debe terminar con prueba terminal y ACK. El worker existente revalida autoridad, archivo, selección y presupuesto antes de iniciar una etapa OCR separada que comparte el núcleo OCR de Productos, prompt/parser y validadores mediante `ProductsInvoiceOcrAdapter`. No reentra a `AnalyzeInvoiceUseCase` ni hereda sus defaults. No se crea otro microservicio o coordinador paralelo.
3. La selección OCR se revalida en el turno que completa `request` y queda explícita y cercada desde esa solicitud. La selección actual del chat puede servir de propuesta inicial sólo si es compatible; no se persiste un cambio de selección del chat ni se elige otro proveedor, modo o modelo por fallo. Los modelos proceden de configuración/descubrimiento reales.
4. El resultado OCR se conserva como datos revisables con procedencia del archivo y recibo, bajo la retención del chat. Un turno posterior de esa conversación puede reutilizarlo sin otra extracción. La comparación consulta Productos autorizados actuales y declara su momento de observación; no presenta una página incompleta como catálogo completo.
5. Se muestran coincidencias, campos comparables y variaciones. Se reutilizan contratos nativos de Productos y reglas verificadas; no se inventan códigos, precios, cantidad, impuesto, margen, stock o emparejamientos por similitud del nombre.
6. Pedir guardar prepara una vista previa exacta de altas/ediciones de Productos. La ejecución sólo ocurre mediante el canal humano existente sobre revisión/hash vigentes, con reautorización y recibos nativos. No crea una factura o mueve stock silenciosamente por el hecho de analizar o comparar.

La elección puede llegar en otro mensaje de la misma conversación. La intención debe conservar un ID de análisis durable y estado `awaiting_supplier`, con referencia al mensaje/archivo originales y su contenido, sin iniciar OCR mientras espera. El siguiente mensaje sólo completa la elección explícita de esa intención; no vuelve a adjuntar automáticamente archivos históricos ni reenvía una inferencia previa. Antes de continuar se revalidan actor, chat, retención, archivo/hash y pertenencia del proveedor al negocio. Si caducaron o cambiaron se detiene y aclara; no se reemplazan por un archivo/proveedor distintos. Elegir proveedor no aprueba guardar Productos. El siguiente contexto recupera referencias OCR privadas y acotadas, reautorizadas por conversación, para resolver esa intención sin pedir UUID técnicos al usuario. Las referencias son pistas para read/request, no una concesión de permisos, un resultado inferido del resumen o autorización de replay; su procedencia debe conservarse al compactar.

El plan completo debe contabilizar las inferencias OCR y conversacionales reales antes de enviarlas. No se ocultan dispatches, reinicia el ledger o amplían presupuestos para simular éxito. La implementación debe contrastar política50 y el coordinador existente; no se fija una cifra nueva sin ese contrato.

La comparación distingue `cost_price` (costo neto), `cost_price_tax` (costo con impuesto, no una tasa), `profit_percentage` y `sale_price`. Una subida de precio de venta derivado no prueba que haya subido el costo de la factura. Se compara el mismo campo y base; porcentaje con base cero o ausente queda sin calcular. La cantidad extraída no se convierte automáticamente en stock final. El mapeo funcional detallado queda en la ficha enlazada.

No se llama al manejador completo de `ProductInvoiceImport` para guardar desde el chat: incluye una creación de factura y varias solicitudes de escritura. Se reutilizan los casos de uso nativos y el protocolo confirmado de NodiaAI. Las múltiples filas respetan los límites existentes y los efectos parciales conservan sus recibos; no se promete atomicidad de todo el conjunto sin comprobarla. Los endpoints bulk existentes no se convierten en herramientas MCP genéricas por este encargo.

## Consecuencias

- El OCR ocurre fuera de la generación planificadora, pero puede tener coste y efectos externos; resultado incierto se concilia sin repetir inferencias automáticamente.
- El resultado no declara `extraction_source:active_agentic_generation` ni acredita que el chat haya recibido un original con MIME nativo verificado. Los gates MIME y el contrato C03 revisión3 permanecen independientes.
- Son necesarios contratos tipados de intención, resultado, comparación y propuesta, con aislamiento por dueño/chat/archivo y recuperación del worker; las observaciones efímeras de Productos no sustituyen ese estado durable.
- El resultado puede exponerse como datos de usuario, nunca como instrucciones de sistema. NR-26, revocación, cambio incompatible y confirmación humana siguen aplicando.
- Esta decisión propuesta y su ficha draft no aprueban una revisión nueva de C03 ni cambian la publicación fda151/42. Las pruebas locales se registran en la ficha; despliegue, disponibilidad real y aceptación siguen pendientes. El build Server del checkout completo no equivale a un paquete de adopción.

## Referencias

- [Ficha del recorrido conversacional](../../nodia-ai/knowledge/nodia-ai/features/invoice-ocr-product-comparison.md).
- [ADR-062: extracción en la generación activa y alternativa OCR separada](ADR-062-nodia-ai-active-invoice-analysis.md).
- [C03 revisión3 aprobada](../../nodia-ai/knowledge/businesses/features/active-invoice-analysis.md).
- [Política50](../../mvp/50-nodia-ai-ai04-runtime-policy.md), [contratos41](../../mvp/41-nodia-ai-v1-contracts.md) y [arquitectura43](../../mvp/43-nodia-ai-execution-architecture.md).
- [OCR existente de Productos](../../../nodia-server/src/invoice/use-case/analyze-invoice.use-case.ts), [adapter conversacional](../../../nodia-server/src/nodia-ai-invoice-ocr/adapters/products-invoice-ocr.adapter.ts), [núcleo nativo](../../../nodia-gemini-microservice/native_invoice_analysis.py), [prompt/parser compartido](../../../nodia-gemini-microservice/invoice_parser.py) y [proyección compartida](../../../nodia-server/src/common/ai/invoice-extraction.ts).
- [Snapshot y elección de proveedor](../../../nodia-server/src/nodia-ai-invoice-ocr/use-case/snapshot-nodia-ai-invoice-ocr.use-case.ts), [etapa durable](../../../nodia-server/src/nodia-ai-invoice-ocr/use-case/process-nodia-ai-invoice-ocr-stage.use-case.ts), [comparación](../../../nodia-server/src/nodia-ai-invoice-ocr/compare-invoice-prices.ts) y [validación de archivo](../../../nodia-server/src/invoice/invoice-file-validation.ts).
- [Entidad Products](../../../nodia-server/src/product/entities/product.entity.ts), [servicio nativo](../../../nodia-server/src/product/product.service.ts) y [mapeo del importador existente](../../../nodia-client/src/modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductInvoiceImport/helpers.ts).

## Estado de implementación local

Client, núcleo OCR y workflow tienen [evidencia separada en la ficha](../../nodia-ai/knowledge/nodia-ai/features/invoice-ocr-product-comparison.md#integración-y-evidencia). La recuperación privada del análisis entre turnos se incorpora antes del despacho con reautorización y límite por secuencia. Las pruebas con dobles y el EXPLAIN readonly no demuestran Nest DI, concurrencia transaccional ni cuenta real. El path documental se valida como fuente; la función sigue partial/unregistered y approval:null, sin capability nueva expuesta, aprobación C03 o publicación derivada de este ADR.
