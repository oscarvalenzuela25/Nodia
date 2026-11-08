---
{
  "schema_version": 1,
  "document_id": "nodia-ai.invoice-ocr-product-comparison",
  "product_id": "nodia-ai",
  "kind": "feature",
  "revision": 2,
  "document_status": "approved",
  "implementation": {
    "status": "partial",
    "notes": "API chat code and common permission/confirmation/runtime contracts implemented. Real provider/model/media qualification and VM adoption require their separate receipts; documentary approval does not certify all151 operations."
  },
  "integration_status": "verified",
  "maintainer": "Mantenimiento de NodiaAI y Negocios conforme AGENTS",
  "sources": [
    {
      "path": "docs/architecture/decisions/ADR-080-conversational-invoice-ocr-product-comparison.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/41-nodia-ai-v1-contracts.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/50-nodia-ai-ai04-runtime-policy.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/nodia-ai-invoice-ocr/use-case/snapshot-nodia-ai-invoice-ocr.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-invoice-ocr/use-case/build-nodia-ai-invoice-ocr-tool.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-invoice-ocr/use-case/process-nodia-ai-invoice-ocr-stage.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-invoice-ocr/adapters/products-invoice-ocr.adapter.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-invoice-ocr/compare-invoice-prices.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-context/use-case/process-nodia-ai-stage.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-context/use-case/build-nodia-ai-context.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/common/ai/invoice-extraction.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/invoice/use-case/analyze-invoice.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/invoice/dto/analyze-invoice.dto.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/product/entities/product.entity.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/product/dto/create-product.dto.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/product/product.service.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductInvoiceImport/helpers.ts",
      "kind": "implementation"
    },
    {
      "path": "docs/mvp/92-nodia-ai-api-chat-parity.md",
      "kind": "specification"
    },
    {
      "path": "docs/architecture/decisions/ADR-084-nodia-ai-api-chat-common-runtime.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/89-module-access-and-user-data-scope.md",
      "kind": "specification"
    }
  ],
  "verification": {
    "checked_on": "2026-10-27",
    "evidence_paths": [
      "docs/evidence/nodia-ai-invoice-ocr-client-validation-20261025-r01.json",
      "docs/evidence/nodia-ai-invoice-ocr-native-validation-20261025-r01.json",
      "docs/evidence/nodia-ai-invoice-ocr-workflow-validation-20261025-r01.json",
      "docs/evidence/nodia-ai-invoice-ocr-sql-di-validation-20261025-r01.json",
      "docs/evidence/api-chat-knowledge-review-r01.json",
      "docs/evidence/api-chat-knowledge-review-r02.json",
      "docs/evidence/api-chat-sql-runtime-r01.json",
      "docs/evidence/api-chat-knowledge-human-approval-r01.json"
    ],
    "notes": "Approved successor/new explanatory revision;19 real isolated PostgreSQL runtime checks and local source/contract regressions verified. Full common-gateway SQL, live API/media and coordinated adoption are separate technical gates. Approved body unchanged from R02."
  },
  "approval": {
    "reference": "docs/evidence/api-chat-knowledge-human-approval-r01.json",
    "revision": 2,
    "content_sha256": "021645ae55f81e6129ee01a52bacda800ae8c18c2a423e4e982df72b3ae9eac7"
  }
}
---

# OCR de factura y comparación de Productos desde la conversación

## Ampliación API key — 2026-10-27

[Plan92](../../../../mvp/92-nodia-ai-api-chat-parity.md), [ADR-084](../../../../architecture/decisions/ADR-084-nodia-ai-api-chat-common-runtime.md) y [paridad API](api-key-chat-parity.md) definen esta ampliación. Aprobación documental, implementación, calificación técnica y adopción por entorno se acreditan por separado en sus metadatos e informes fechados. Los [originales anteriores](../../../../evidence/api-chat-knowledge-originals-catalog-r01.json) conservan sus bytes y aprobaciones históricas; no se revocan ni se sustituyen sus evidencias por un resultado inventado.

API OpenAI/Gemini reutiliza catálogo, ToolGateway, grants, permisos y confirmación comunes. Aplican [contratos41](../../../../mvp/41-nodia-ai-v1-contracts.md) y [política89](../../../../mvp/89-module-access-and-user-data-scope.md): módulo NodiaAI y destinos autorizados, propietario/colaborador y bypass legítimo de super_admin sin omitir invariantes o botón humano. Las acciones históricas de roles no añaden un bloqueo contrario a89. Seleccionar capacidades o escribir «sí» no confirma una propuesta ni ejecuta efectos; revisión/hash, ejecución idempotente y recibos permanecen independientes del modo.

`supports_tools` describe soporte de solicitudes de herramientas; API usa function calling y mantiene `supports_mcp:false`. Configuración/catálogo listos no son health remoto ni éxito de inferencia. Conexión/modelo/esfuerzo son explícitos y dinámicos, sin defaults de modelo ni fallback API↔Agentic. Los tres envíos generativos actuales por run incluyen cada POST API y sus continuaciones, reservados durablemente antes de transmitir; reiniciar o reintentar no devuelve presupuesto.

El ledger HTTP y descriptor privado schema3 distinguen cierre local (`local_transport_closed`) de resultado remoto (`remote_outcome:completed|unknown`); no simulan un proceso nativo cerrado. Timeout/abort/crash no prueban cancelación remota ni coste cero. Conciliación/ACK exigen identidad y cierre local demostrados, sin autoretry de inferencia incierta. Las pruebas y publicación se cierran por separado con [plan91](../../../../mvp/91-ai-provider-onboarding-verification.md), sin aceptar todas las operaciones por un success acotado.

La implementación API conserva `prepare/request/read`, proveedor comercial explícito y archivo/hash del chat autorizado. La planificación debe terminar/ACK antes de adquirir la etapa separada `invoice_ocr`; [ApiInvoiceOcrExecutor](../../../../../nodia-server/src/nodia-ai-invoice-ocr/adapters/api-invoice-ocr-executor.ts) utiliza el `ApiProviderService`/prompt/parser del core actual de Productos, la clave/modelo/esfuerzo exactos y el ledger HTTP durable. No reentra al manejador de importación ni usa sus defaults. El terminal schema3 distingue cierre HTTP local de resultado remoto desconocido; fallo incierto no repite OCR.

`invoice_ocr` es una ruta autorizada separada: no certifica MIME nativo del planificador. En el otro contrato `nodia_invoices_analyze`, la extracción en la generación activa API sólo procede con original/capacidad exactos y el mismo gateway; `extraction_source:active_api_generation` es procedencia aditiva y no reetiqueta la histórica `active_agentic_generation`. Ninguna de estas rutas acepta HTML, texto inventado o una key del modelo como fuente.

Comparar reutiliza la extracción existente y lee Productos actuales bajo el mismo negocio/propiedad/colaboración, sin otra inferencia. Conserva cero/null, costo neto frente a costo con impuesto, unidad/moneda y coincidencias ambiguas; no inventa porcentaje con base cero, sale_price, stock, impuesto o proveedor comercial. Guardar altas/ediciones exige la misma propuesta exacta y botón humano, con idempotencia/recibo; analizar/comparar no crea facturas o efectos comerciales. API OCR histórica del corte90 no acepta este recorrido conversacional nuevo: SQL, success real, comparación/reload y guardado humano siguen gates propios.

## Cortes anteriores conservados

> Las secciones inferiores conservan decisiones, pruebas y estados del corte anterior a esta ampliación API. Sus expresiones «actual», API posterior, permisos por acciones o publicación se leen en su fecha histórica, no como prohibición o aceptación del contrato nuevo. La regla vigente de esta revisión es el bloque API superior; las evidencias originales no se reescriben.

[Producto NodiaAI](../README.md) · [Productos](../../businesses/features/products.md) · [ADR-080 propuesto](../../../../architecture/decisions/ADR-080-conversational-invoice-ocr-product-comparison.md).

## Qué resuelve y qué significa

Una persona puede pedir analizar una factura y comparar sus precios con los productos guardados, en una sola petición o mediante una pregunta posterior de la misma conversación. El diseño solicitado reutiliza el OCR real de Productos como etapa separada después de cerrar la generación de planificación. No requiere un botón OCR manual previo como entrada principal.

OCR produce datos revisables; comparación produce observaciones; guardar requiere una propuesta exacta y confirmación humana. Ninguna de las dos primeras acciones crea Productos, factura o movimientos. Esta función tiene implementación local parcial y no habilita herramientas por estar documentada.

Complementa [C03 revisión3](../../businesses/features/active-invoice-analysis.md): no usa su afirmación de extracción en la misma generación, no modifica su aprobación/hash y no convierte el resultado OCR en prueba MIME nativa del chat.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención | Duda o respuesta esperada |
|---|---|---|
| «Analiza los precios de esta factura» | Planificar OCR del adjunto autorizado y mostrar datos revisables | Resolver negocio/archivo/selección OCR y preguntar qué proveedor comercial usar, preferentemente desde la lista autorizada del negocio |
| «Usa el proveedor de esa lista» en el siguiente mensaje | Completar la elección de la intención pendiente | Resolver una elección única y explícita; conservar el análisis original sin otro adjunto o OCR previo |
| «¿Algún producto subió?» después del análisis | Reutilizar el resultado de esta conversación y leer Productos actuales | Identificar costo neto/con impuesto o precio de venta; no volver a extraer por defecto |
| «Analiza esta factura y dime qué productos subieron» | OCR separado seguido de lectura/comparación | Mostrar coincidencias, diferencias y datos no comparables sin inventarlos |
| «Guarda esos cambios en Productos» | Preparar altas/ediciones exactas | Mostrar campos finales y pedir confirmación mediante el canal humano; el texto no ejecuta |
| «Usa cualquier conexión si falla» | Petición incompatible con la selección y recuperación | No cambiar proveedor/modo/modelo por error ni reenviar una extracción incierta |

## Operaciones y contratos

| Operación | Clase/efecto | Fuente real y estado de la integración |
|---|---|---|
| Planificar OCR | Intención durable sin inferencia OCR anidada | Contrato `prepare/request/read` y snapshot local; callback no ejecuta el OCR mientras su generación esté activa |
| Extraer factura | Inferencia externa separada | [Adapter conversacional](../../../../../nodia-server/src/nodia-ai-invoice-ocr/adapters/products-invoice-ocr.adapter.ts), [núcleo nativo](../../../../../nodia-gemini-microservice/native_invoice_analysis.py), [prompt/parser compartido](../../../../../nodia-gemini-microservice/invoice_parser.py) y [validador](../../../../../nodia-server/src/invoice/invoice-file-validation.ts); sin reentrar a `AnalyzeInvoiceUseCase` o sus defaults |
| Consultar y comparar | Lectura autorizada y cálculo por campos comparables | [Product](../../../../../nodia-server/src/product/entities/product.entity.ts), [GetProductsDto](../../../../../nodia-server/src/product/dto/get-products.dto.ts) y casos de uso nativos; no SQL libre |
| Preparar guardado | Propuesta, sin efecto comercial | [CreateProductDto](../../../../../nodia-server/src/product/dto/create-product.dto.ts), [UpdateProductDto](../../../../../nodia-server/src/product/dto/update-product.dto.ts) y coordinador confirmado; contrato del conjunto pendiente |
| Confirmar guardado | Efecto sólo tras revisión/botón humanos | Casos de uso [create](../../../../../nodia-server/src/product/use-case/create-product.use-case.ts)/[update](../../../../../nodia-server/src/product/use-case/update-product.use-case.ts), servicio y recibos nativos; recorrido nuevo sin verificar |

El código local define `nodia_invoices_ocr` con esquema `prepare/request/read`. El registro y la publicación efectiva deben comprobarse en el build del owner; esta ficha draft no publica por sí misma la herramienta. Los endpoints existentes no quedan publicados automáticamente para el modelo. Las observaciones OCR efímeras de Productos no son por sí solas jobs durables del chat.

## Uso del OCR de Productos en el chat

1. `prepare` conserva el original del mensaje actual y su intención mediante `analysis_id`; devuelve `awaiting_supplier` sin ejecutar OCR. Si falta la elección comercial, usar la lectura autorizada de proveedores con filtro de `business_id` exacto, recorrer sus páginas y mostrar las opciones del negocio. No presentar una página incompleta como lista total ni usar el primero. Pedir una elección única; un nombre explícito sólo se resuelve si identifica un proveedor autorizado sin ambigüedad.
2. La respuesta puede llegar en otro mensaje de la misma conversación. `request` recibe ese `analysis_id` y el `provider_id` explícito; revalida actor, negocio, proveedor, retención y archivo/hash originales. La selección OCR compatible del nuevo turno se valida de nuevo y queda fijada en la solicitud. No reenvía originales históricos al planificador ni persiste cambios de selección del chat.
3. Después de `request`, terminar la generación de planificación. Sólo tras su terminal y ACK el worker adquiere la reserva para la tercera etapa `invoice_ocr`. Se revalidan configuración/sesión, proveedor/campos/impuesto y archivo antes del dispatch. El OCR reutiliza el núcleo y parser de Productos con identidad nativa propia; no reentra al caso de uso HTTP `AnalyzeInvoiceUseCase`, no aplica sus selecciones predeterminadas y no acredita MIME nativo de la generación planificadora.
4. Mostrar la extracción como datos revisables. En un turno posterior, `read` con el mismo `analysis_id` recupera el resultado; `read(compare_prices:true)` consulta Productos actuales del negocio sin otra inferencia OCR. Compara costo neto con `cost_price` y costo con impuesto con `cost_price_tax`; no inventa `sale_price`, margen o impuesto. Conserva cero y desconocido por separado; con base cero no calcula porcentaje. Códigos ausentes, no encontrados o ambiguos se muestran sin inventar una asociación.
5. Pedir guardar usa los preparadores de altas/ediciones de Productos y su vista previa exacta. Sólo el botón humano sobre revisión/hash vigentes ejecuta efectos autorizados. Elegir proveedor, analizar, comparar o decir «guarda» no crea por sí mismo Productos, factura, stock o movimientos. Una preparación consumida o resultado incierto no habilita repetir OCR automáticamente.

El contexto de un turno posterior recupera, en el código local probado, referencias OCR privadas, acotadas y reautorizadas de esta conversación, con `analysis_id` y estado de espera/solicitud/resultado; no exige que la persona copie UUID técnicos ni reconstruye una intención desde texto libre. Son pistas para `read/request`, nunca permisos o autorización de replay. La referencia debe sobrevivir a la compactación mediante procedencia privada; ni un resumen ni el historial visible prueban que el OCR se ejecutó.

La lista comercial depende de las lecturas autorizadas existentes; el OCR comprueba que el proveedor elegido pertenezca al negocio. Su lista global autenticada no debe confundirse con una lista ya filtrada. Permisos/configuración se revalidan al retomar y durante la etapa; los resultados de otro chat o archivos vencidos no completan esta intención. Este apartado describe el contrato local para un binding propuesto, con `approval:null`; no acredita despliegue o aceptación real.

## Datos mínimos y resolución de dudas

| Concepto | Regla y procedencia |
|---|---|
| Archivo | Original autorizado del chat, identidad/contenido/MIME exactos. El OCR existente valida PDF/PNG/JPEG/WebP y máximo10MiB; esa validación no demuestra soporte de cada adaptador |
| Negocio | `business_id` obligatorio en el OCR y en el catálogo; preguntar si falta o hay varios posibles, sin asumir el primer negocio |
| Proveedor comercial | El DTO nativo lo permite opcional para otros consumidores, pero este recorrido exige elegirlo explícitamente antes del OCR y usar sus campos/configuración nativos. Mostrar preferentemente proveedores autorizados del negocio; un nombre explícito único puede resolverse sin volver a pedirlo. No usar primero/default ni opción sin proveedor por omisión. No es la conexión IA |
| Selección OCR | Conexión, modo, modelo/esfuerzo válidos y explícitos en la intención; puede proponerse la selección actual del chat si es compatible. No persistir un cambio de selección del chat ni ejecutar defaults silenciosos |
| Resultado previo | Referencia durable de esta conversación/archivo, reautorizada y no expirada; no reusar originales antiguos como si fueran adjuntos del mensaje actual |
| Campos ausentes | Permanecen desconocidos o requieren aclaración. Cero real se conserva; un campo requerido para guardar puede bloquear la propuesta sin invalidar toda la comparación |

### Mapeo con la tabla Productos

| Campo real | Significado y tratamiento del recorrido |
|---|---|
| `id`, `business_id`, `code` | ID interno y código dentro del negocio. La unicidad de Products es negocio+código; no inventar SKU o asociar por nombre. `trim/lower` del importador sirve como candidato de coincidencia, no para elegir entre candidatos ambiguos |
| `name`, `provider_id` | Nombre extraído/revisado y proveedor comercial autorizado. No inferir identidad o proveedor por una similitud textual |
| `cost_price` | Costo neto; comparar contra costo neto de la misma unidad/base |
| `cost_price_tax` | Costo con impuesto, no porcentaje de impuesto. No mezclarlo con costo neto o tratarlo como tasa |
| `profit_percentage`, `sale_price` | Margen y precio de venta. No son una extracción directa de costo. Derivación sólo con regla/entradas verificadas y visible en preview; no introducir nuevos defaults de margen o impuesto |
| `stock` | Stock final del catálogo; cantidad comprada en la factura no implica por sí sola asignarlo, sumarlo o inventar una cantidad |
| `is_active` | Actividad del producto; conservar o proponer un cambio explícito, sin activar productos por el mero hecho de encontrarlos en una factura |

El [mapeador actual del importador](../../../../../nodia-client/src/modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductInvoiceImport/helpers.ts) tiene derivaciones/defaults propios y compara `sale_price`. Copiar su salida no demuestra una subida de costo ni autoriza nuevas suposiciones en el chat. El nuevo recorrido debe explicar el campo, base, unidad y procedencia comparados. Si la base es cero/ausente no se inventa porcentaje; una diferencia absoluta comprobable puede mostrarse por separado.

## Reglas, acceso y restricciones

Se exige dueño/sesión y autoridad del chat, módulo NodiaAI y autoridad de Negocios/Productos pertinente. El negocio/proveedor/archivo y la configuración se revalidan antes de OCR, lectura y confirmación; el modelo no proporciona actor, credenciales, rutas o storage keys.

La planificación debe quedar terminal/ACK antes de adquirir recursos para OCR. El worker reutiliza su coordinación durable, presupuesto acumulado, cancelación y recibos; no nace otro worker ni se reentra al OCR desde la generación que mantiene el perfil. Una petición conjunta cuenta todos los dispatches reales; no es una forma de esconder otra inferencia o ampliar presupuestos.

Si falta proveedor, la intención permanece en `awaiting_supplier` con ID de análisis durable y procedencia exacta del adjunto del primer mensaje. La elección del mensaje siguiente completa esa misma intención: no exige volver a adjuntar ni reenvía automáticamente históricos. No hubo OCR anterior que repetir. Se revalidan dueño/sesión/chat/retención/archivo/hash y pertenencia del proveedor antes de continuar; una respuesta ambigua no libera la ejecución. La espera conserva la intención y cualquier resultado ya obtenido bajo la retención del chat, sin fabricar una extracción mientras aún no se eligió proveedor. La elección no confirma el guardado.

Disponibilidad de OCR y de conversación se verifica por separado. No se modifican los gates MIME de originales del chat: resultado OCR, texto revisado y archivo original son fuentes distintas. No hay fallback por error, conversión automática de proveedor/modo o modelos estáticos.

## Filtros e informes

La comparación usa lecturas autorizadas de Productos del negocio y sus campos permitidos. Muestra encontrados/no encontrados/ambiguos, valores anteriores observados, valores extraídos/revisados y diferencias comparables. Debe completar la consulta necesaria por códigos y paginación; una primera página no acredita que un producto no exista.

No es gasto, venta, pago o informe financiero. No inventa moneda, conversión, unidad, tasa o importe de inventario. Preguntar «subió» no autoriza guardar; la presentación debe nombrar el precio comparado. Historial de producto sólo se usa si el contrato y lectura correspondientes lo autorizan y se identifica el momento de referencia.

## Vista previa, confirmación y recuperación

OCR y comparación se presentan sin persistir Productos. El usuario puede solicitar guardar después o en la petición original; en ambos casos debe ver altas/ediciones, identidades y campos finales, desconocidos bloqueantes y efectos exactos antes del botón humano. Si cambiaron los datos o la autoridad, se necesita una preview nueva.

El [importador actual](../../../../../nodia-client/src/modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductInvoiceImport/ProductInvoiceImport.tsx) guarda primero una factura y luego Productos mediante solicitudes separadas. El nuevo recorrido no ejecuta ese manejador completo ni crea una factura implícita al confirmar únicamente Productos. Usa los casos de uso nativos y conserva sus snapshots `product_logs` y recibos bajo la transacción adecuada.

Para varias filas se respetan los límites del coordinador y la confirmación de cada conjunto exacto. No se ofrece un bulk/import genérico ni atomicidad total aún no probada; efectos parciales terminados se conservan. Timeout/resultado incierto no repite OCR o guardado automáticamente. Recargar/retomar debe recuperar intención/resultado con reautorización, no reconstruir una respuesta o volver a inferir.

## Integración y evidencia

- [x] Solicitud natural y fuentes contrastadas; ADR propuesto y ficha draft, `partial/unregistered`, sin aprobación atribuida.
- [x] Contrato `prepare/request/read`, snapshot, consumo único, etapa OCR y sellado local implementados; validación aislada del workflow y build Server final del owner, sin arrancar Nest DI.
- [x] Referencias privadas acotadas en `recovery_refs.invoice_ocr_references`, reautorizadas por chat/negocio/archivo y limitadas por `input_through_seq`; comprobación fresca antes del dispatch. Regresiones finales157/2 correctas. SQL EXPLAIN real readonly pasó; no demuestra resultados reales, locks o concurrencia.
- [x] Archivo/hash/retención, selección/configuración, proveedor comercial explícito, ceros/desconocidos, comparación neto/bruto y código ambiguo comprobados con dobles aislados. No se suman ejecuciones parciales como una suite única.
- [x] Cancelación, terminal/ACK previo y no replay de OCR incierto verificados en pruebas aisladas; presupuesto del coordinador conservado, sin probar una cuenta real.
- [x] Client exige elegibilidad fresca/selección exacta y policy GET resuelta para los cuatro MIME hasta10MiB; conserva File/borrador ante revalidación.2027 pruebas/249 archivos y build, tipado/lint correctos; sin prueba de navegador o servidor desplegado.
- [x] Path añadido al registro de fuentes para validación. El build conserva64 fuentes/24 excluidas y la publicación previa40 documentos/42 fragmentos/151 capacidades; la nueva capacidad OCR sigue sin exponer. Validar un path no registra/publica la capacidad ni cambia `integration_status`.
- [ ] Nest DI y garantías reales de transacción/concurrencia/recuperación del recorrido completo comprobadas.
- [ ] Propuesta exacta de Productos, cambio concurrente, confirmación humana y efectos/recibos nativos verificados de extremo a extremo.
- [ ] Recorrido real por selección/adaptador/entorno desplegado y aceptado. Las pruebas aisladas no prueban disponibilidad actual o aceptación C03.

Evidencias separadas: [Client](../../../../evidence/nodia-ai-invoice-ocr-client-validation-20261025-r01.json), [núcleo nativo](../../../../evidence/nodia-ai-invoice-ocr-native-validation-20261025-r01.json) y [workflow y referencias privadas](../../../../evidence/nodia-ai-invoice-ocr-workflow-validation-20261025-r01.json). Conservan sus intentos negativos y límites. El build Server final usa el checkout completo, incluidos cambios FX04 preexistentes cuyos pins se sincronizaron en otro carril; no constituye una entrega mínima para adoptar. No se ejecutaron VM, SDK o proveedor desde este carril documental/Client.

Publicación151/42/fda y C03 revisión3 permanecen intactos; no se hereda su aprobación ni se presenta esta extracción como realizada en la generación activa. `approval:null` e `integration_status:unregistered` permanecen explícitos.

## Evolución y compatibilidad

| Revisión | Cambio | Compatibilidad |
|---|---|---|
| 1 | Solicitud natural de OCR separado, comparación de Productos y guardado confirmado; opción provisional de botón principal descartada | Nueva función con implementación local parcial y validación aislada; no publicada ni adoptada. No modifica contratos/recibos C03 publicados ni invalida pruebas históricas; aceptación real y confirmación de efectos conservan sus gates |
