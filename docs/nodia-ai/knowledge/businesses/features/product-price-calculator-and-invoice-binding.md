---
{
  "schema_version": 1,
  "document_id": "businesses.product-price-calculator-and-invoice-binding",
  "product_id": "businesses",
  "kind": "feature",
  "revision": 12,
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
      "path": "docs/architecture/decisions/ADR-095-independent-product-prices-and-reviewed-invoice-binding.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/89-module-access-and-user-data-scope.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/product/entities/product.entity.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/product/dto/bulk-update-product.dto.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/product/product.service.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductModal/productPricing.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/pages/BusinessDetail/components/ProductsTab/components/PriceSuggestion/PriceSuggestion.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductInvoiceImport/InvoiceProductMatch/InvoiceProductMatch.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductInvoiceImport/InvoiceProductMatch/infrastructure/services.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/components/AnalysisConsole/infrastructure/useServices.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductInvoiceImport/ProductInvoiceImport.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/invoice/analysis-observation.interceptor.ts",
      "kind": "implementation"
    },
    {
      "path": "docs/architecture/decisions/ADR-096-manual-invoice-ocr-cancellation-recovery.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/ai-provider-feature-contract.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/common/ai/gemini-upstream.exception.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/infrastructure/invoiceAiFailure.ts",
      "kind": "implementation"
    }
  ],
  "verification": {
    "checked_on": "2026-11-07",
    "evidence_paths": [
      "docs/evidence/business-product-pricing-documentation-20261106-r01.json",
      "docs/evidence/business-product-pricing-20261106-r01.json",
      "docs/evidence/invoice-analysis-cancellation-20261106-r01.json",
      "docs/evidence/invoice-gemini-cancellation-qa-20261106-r01.json",
      "docs/evidence/invoice-gemini-cancel-recovery-20261106-r01.json",
      "docs/evidence/invoice-manual-match-qa-20261107-r01.json",
      "docs/evidence/invoice-provisional-table-ui-20261107-r01.json",
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

# Calculadora local y vinculación OCR revisada de Productos

[Negocios](../README.md) · [plan94 §35](../../../../mvp/94-business-point-of-sale-and-product-refactor.md#35-precios-independientes-calculadora-local-y-vinculación-ocr-revisada--2026-11-06) · [ADR095 propuesto](../../../../architecture/decisions/ADR-095-independent-product-prices-and-reviewed-invoice-binding.md).

## Qué resuelve y qué significa

El precio de venta manual pertenece al producto y no recalcula costo neto o costo con impuesto. El porcentaje deja de persistirse: 30% es una sugerencia editable de una calculadora local sobre costo bruto, aplicada sólo mediante una acción explícita al borrador. Guardar producto es una acción posterior. No representa utilidad realizada ni añade impuestos a la venta. La oferta permanece independiente.

La fila extraída de una factura es una propuesta, no un producto confirmado. Vincularla permite elegir un producto real del mismo negocio y revisar valores anterior→nuevo por campo. No guarda ni repite OCR al seleccionar.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención y aclaración esperada |
|---|---|
| «Sugiere venta con 30% sobre el bruto» | Calcular localmente con el bruto informado; no guardar ni modificar costos. Aplicar y Guardar son decisiones distintas. |
| «Pon la venta en 2.000» | Cambiar sólo venta; preguntar el producto si falta identidad. No despejar costos ni aplicar oferta. |
| «Esta fila de factura corresponde a ese producto» | Elegir un resultado del negocio, consultar sus datos frescos y revisar campos. Un nombre parecido no acredita identidad. |
| «Cambia también el código» | Mostrar código anterior y extraído, su casilla y posible conflicto de unicidad. ID/version permanecen ligados al destino. |
| «Guárdalo todo automáticamente» | No hacerlo por el análisis, selección o texto afirmativo; remitir al guardado final explícito y sus validaciones. |

## Operaciones y contratos

| Operación semántica | Clase/efecto | Contrato/fuente real | Estado |
|---|---|---|---|
| Calcular y aplicar sugerencia | Cálculo local y edición del borrador, sin HTTP comercial | Helper local y PriceSuggestion implementados; pruebas de dinero/Aplicar explícito | No es herramienta del modelo |
| Buscar producto destino | Lectura paginada bajo negocio autorizado | `ProductController.findAll`, `GET /api/v1/products`, nombre/negocio y páginas de 25 | No inferir una escritura desde el resultado |
| Leer destino fresco | Lectura y comprobación de ID/negocio/versión | `GET /api/v1/products`, filtro negocio + `id_in` exacto, límite 1; guard de ID/negocio/versión | Precondición de la propuesta manual |
| Aplicar casillas a la fila OCR | Propuesta local, conserva campos no elegidos | Importador manual de Productos implementado; draft local, sin HTTP de escritura | Sin guardar al abrir/cerrar/seleccionar |
| Guardar cambios revisados | Escritura nativa final; ID y `expected_version` de destino | `PUT /api/v1/products/bulk`, `BulkUpdateProductItemDto`, `ProductService.updateBulkProducts` | Preserva autorización, unicidad y concurrencia; no publica bulk en NodiaAI |

Los endpoints se describen como fuente contractual del flujo manual. No se crea una herramienta o binding por escribir esta ficha. El chat mantiene sus propuestas/confirmación/recibos propios; no llama al manejador completo del importador ni obtiene permiso para crear una factura por vincular una fila.

## Datos mínimos y resolución de dudas

| Dato | Regla |
|---|---|
| Costo bruto | `cost_price_tax`, importe CLP; no es tasa tributaria. Cero es un valor real y ausencia no se vuelve cero. |
| Porcentaje sugerido | 30 inicial editable y local, finito no negativo con decimales y sin máximo arbitrario; no se manda como `profit_percentage` ni se rellena desde historia o IA. `Math.round(bruto × (1 + porcentaje/100))` CLP; bruto/resultado entero de 0 a 2.147.483.647. Ausencia/overflow bloquean Aplicar, sin clamp. Helper y regresiones de la entrega acreditan esta regla local; no implica un guardado comercial. |
| Destino | ID bigint como string, negocio y versión frescos; no resolver por el nuevo código ni convertir ID a Number. |
| Campos seleccionables | Código, nombre, costo neto, costo bruto y venta. Cada casilla muestra anterior→nuevo; campo no elegido conserva el destino. Código y costos válidos se ofrecen seleccionados; nombre/venta optativos. Igualdad no fabrica una diferencia. |
| Otros atributos | Proveedor, barcode, oferta, disponibilidad y unidad no se deducen de la vinculación. Cantidad de factura no se convierte en stock. |

## Reglas, acceso y restricciones

Destino canónico `/business` conforme ADR092 y política89: actor autorizado, negocio y pertenencia revalidados en Server. La búsqueda usa filtro del negocio y la lectura fresca vuelve a comprobarlo; el filtro Client no es autorización. Cambios de actor/negocio/sessionVersion invalidan el modal montado y requieren reabrirlo; destino nuevo requiere su snapshot. Sesión inactiva, lecturas en vuelo o padre ocupado bloquean Aplicar. Un fallo GET conserva los datos y permite retry de lectura. La unicidad de `code` por negocio sigue vigente; un conflicto no se solventa cambiando otro producto silenciosamente.

La retirada incluye `products.profit_percentage`, `product_logs.profit_percentage`, DTOs y consumidores activos. Se conservan migraciones, evidencia y propuestas firmadas históricas como historia; no se presentan como payloads actuales válidos. No se recalculan los demás importes guardados ni ventas históricas al eliminar el campo.

## Filtros e informes

Buscar y paginar son lecturas reales del catálogo; no descargarlo entero para filtrar localmente ni inventar páginas. La calculadora no es un informe de utilidad. El estilo de precio normal y oferta en tabla es 16px/700; es una mejora visual sin nuevos datos, agregaciones, herramientas o efectos. Ventas/reportes NodiaAI siguen sólo lectura conforme plan94 §26.

## Vista previa, confirmación y recuperación

1. El análisis mantiene sus filas; buscar/elegir destino no realiza escritura comercial.
2. Obtener el destino fresco y mostrar campos anterior→nuevo con selección explícita. Cancelar conserva el estado anterior; Aplicar modifica sólo la propuesta local.
3. Guardar el conjunto final utiliza ID/version del destino, revalida negocio y unicidad y conserva los campos no elegidos. Un error conserva modal y datos con feedback traducido.
4. No se promete atomicidad de factura y productos si siguen siendo solicitudes diferentes. Ante efecto parcial conservar lo guardado y su identidad; ante respuesta incierta conciliar antes de otro envío, sin repetir todo el flujo o la inferencia.

La retirada del porcentaje requiere respaldo/migración verificados antes de la adopción. Un down no reconstruye porcentajes eliminados ni autoriza pérdida del resto de los datos.

## Integración y evidencia

- [x] Regla solicitada, contrato anterior sustituido y fuentes de producto identificados en plan94 §35 y ADR095 propuesto.
- [x] Helpers/DTOs/consumidores activos contrastados y migración R10 aplicada una sola vez; runtime recuperado por R11.
- [x] Regresiones de dinero, ausencias/cero, campos no elegidos, paginación, contextos y errores verificadas.
- [x] SQL real aislado R02: cuatro checks de migración/preservación y cleanup; regresiones de servicio para versión/unicidad/negocio. No autentica HTTP ni usa BD operacional.
- [x] Compatibilidad selectiva revisada en46bindings: Productos/Logs sólo sirven lecturas sin margen persistido; OCR prohíbe inventarlo. Referencias antiguas no seleccionadas y44cuerpos aprobados intactos; no retirar capacidades compatibles ni publicar esta candidata.
- [x] Repins revisados y build aislado R03,81fuentes/37excluidas/44aprobadas/46fragmentos; sin aprobación nueva.
- [x] Evidencia local y QA CUA sintética registradas, sin OCR/persistencia/autenticación.
- [x] Recuperación ServerR11 y adopción ClientR28, health/entrega y QA autenticada de lectura/formulario; sin OCR/guardado comerciales reales o publicación implícita.

## Evolución y compatibilidad

| Revisión | Cambio y fuentes | Compatibilidad |
|---|---|---|
| 1 | Solicitud del 2026-11-06, plan94 §35 y ADR095 propuesto | Sustituye cálculo bidireccional de §23; retira el campo de contratos activos. Ficha draft/planned/unregistered, approval:null; no altera cuerpos aprobados ni autoriza nuevas capacidades. |
| 2 | Implementación local, regresiones, SQL aislado y CUA sintética; R11/R28 adoptados y QA de lectura verificada | Draft/partial/unregistered y approval:null;44cuerpos aprobados y46fragmentos intactos, sin nueva herramienta o publicación. |
| 6 | Identidad/cierre OCR, conflictos409 y GET de recuperación; primera cancelación R13 confirmada, fixR14 del header | R12/R31/R14 activos; cancelación y cierre R14 confirmados, extracción final validada sin guardado comercial. ADR096 propuesto y ficha sin aprobación/publicación. |

## Comprobación y adopción — 2026-11-06

ServerR11 y ClientR28 adoptados y verificados. R10 aplicó una sola migración44→45 con2DROP e invariantes de94tablas; su arranque falló por hashes estáticos de26contratos y quedó detenido. R11 recuperó el runtime con5JSON/assets,0DDL/0escriturasDB adicionales y API/Worker estables30s; no se repitió la migración. ClientR28 tuvo una activación/recarga,186outputs actuales verificados y assets históricos conservados. NativeR12, flags, entorno, auth y timers preservados. Client: 308 pruebas/25 suites, typecheck y lint correctos. Server: corrida inicial315/23 y posterior de metadatos159/3, parcialmente solapadas y sin sumarlas; typecheck de producción/lint correctos y fallo de specs WIP ajenos conservado. Una regresión adicional de bundle pasó (100casos filtrados, no101pruebas) y se verificaron153contratos/12familias más el constructor real LoadNodiaAiKnowledge. CUA autenticada1088/320 comprobó precios normal/oferta16px/700 y oferta roja, ausencia de margen, sugerencia30→40% con venta350intacta, venta manual990sin cambiar costos226/269 y Aplicar377sólo en borrador. Cancelar/reabrir conservó venta guardada350 y reinició30%; no se pulsó Guardar ni ejecutó OCR/proveedor. Móvil: diálogo288px, acciones256×44 y catálogo310client=scroll, sin overflow. La vinculación OCR se acredita con pruebas atómicas y fixture sintética, no con OCR/guardado reales. Conocimiento cerradoR04: release430bf6e7…/registrob9bdd8b2…; checkout96923334…/checkb8ad5d88… independiente por la admisión audioWIP no adoptada.81fuentes/37excluidas/44aprobadas/46fragmentos/153capacidades; cuerpos aprobados y fragmentos byte-idénticos, candidata excluida y sin aprobación/publicación nueva. [Evidencia consolidada](../../../../evidence/business-product-pricing-20261106-r01.json). El código elegido permanece ligado a ID/versión, y el guardado final sigue separado de la factura: no se supone atomicidad global. Sin aprobación/publicación de esta ficha, OCRreal o persistencia comercial acreditados por este QA.

## Impacto visual: etiquetas compactas — 2026-11-06

El catálogo muestra «Oferta: …» y «Normal: …» (EN: «Offer»/«Regular»), conservando los importes/unidades, orden, estados,16px/700 y color de oferta. La traducción de precio normal del POS no cambia. Es un ajuste exclusivamente visual: no cambia conceptos, operaciones ni interpretación de resultados, por lo que no afecta el contexto de NodiaAI ni requiere herramientas, bindings o aprobación/publicación nueva. Esta candidata sigue draft/unregistered/approval:null; los cuerpos aprobados se conservan. [Plan94§35](../../../../mvp/94-business-point-of-sale-and-product-refactor.md#etiquetas-compactas-de-oferta-y-normal--2026-11-06) y [evidencia](../../../../evidence/product-price-labels-20261106-r01.json).

## Cancelación del análisis manual — 2026-11-06

Corte histórico ClientR30/ServerR11/NativeR12; la recuperación identificada vigente se describe al final.

La reserva, subida/análisis y preparación comparten estado de ejecución: archivo, proveedor vinculado, conexión IA, modo, Analizar y edición/guardado se bloquean; Cancelar análisis sigue disponible. Cancelar aborta la espera de los transportes locales y descarta callbacks, datos y feedback tardíos; no guarda ni reenvía. Archivo, selección y último borrador completo se conservan. Código/total/fecha y filas nuevos se publican juntos después del histórico, sólo para la intención vigente. Renovar credenciales del mismo actor no desincroniza consola/controles; cambio de actor/sessionVersion/negocio o desmontaje invalida la ejecución previa, sin alterar autorización HTTP.

No hay endpoint nuevo ni modificación Server/Native/DB: la desconexión ya propaga AbortSignal por los adaptadores. observation.cancelled es cancelación local del transporte, no ACK de limpieza ni garantía de proveedor remoto detenido. La UI muestra esa diferencia. No trasladar proof3/ACK de executeNative de Teacher/NodiaAI al OCR manual Codex execute. No se amplía la atomicidad global de factura/productos ni se habilita cancelación durable tras recarga por añadir este botón.

Impacto de contexto: regla funcional manual documentada, sin nuevas operaciones del modelo, herramientas, bindings, autoridad o publicación. Esta ficha sigue draft/partial/unregistered/approval:null; cuerpos aprobados intactos. [Plan94§36](../../../../mvp/94-business-point-of-sale-and-product-refactor.md#36-bloqueo-y-cancelación-del-análisis-manual-de-facturas--2026-11-06) y [evidencia](../../../../evidence/invoice-analysis-cancellation-20261106-r01.json) distinguen75regresiones, CUA sintética y auditoría de adaptadores de una inferencia/cancelación real con proveedor, no ejecutada en esta entrega.


## QA real de cancelación Gemini — 2026-11-06

Bloqueo y conservación del archivo comprobados con un PNG sintético en la VM. El nuevo análisis explícito falló por cuarentena de la ejecución cancelada, sin nueva adquisición/CLI. La UI lo presentó como fallo de extracción/sesión: mensaje específico y recuperación OCR con identidad/cierre comprobable pendientes. No se retiró la cuarentena ni se reconectó la cuenta. Esta verificación no publica herramientas ni amplía pruebas de chat/Teacher o guardado comercial. [Evidencia](../../../../evidence/invoice-gemini-cancellation-qa-20261106-r01.json).

## Recuperación identificada y motivo real de indisponibilidad — 2026-11-06

Server R12, Client R31 y Native R14 activos. La primera cancelación R13 cerró localmente y conservó el archivo; su aviso genérico por header omitido queda registrado. R14 sólo corrige la allowlist409, con655 casos Linux sin omitidos, incluidos4 ASGI, y preservación posterior de identidades,186 estáticos actuales, fallback, SDK y timers.

Referencias públicas de implementación nativa: [dispatcher OCR](../../../../../nodia-gemini-microservice/manual_invoice_dispatch.py) y [handler HTTP](../../../../../nodia-gemini-microservice/main.py). Se enlazan en el cuerpo documental; los metadatos conservan las raíces autorizadas por su esquema.

La segunda intención real R14 fue cancelada tras38s con archivo, proveedor vinculado, conexión IA, modo y Analizar bloqueados y Cancelar disponible. La pestaña secundaria mostró ocupación real mediante GET, conservó Gemini/Agentic y no envió OCR. El mismo Blob principal se conservó; se observaron CLI0, unknown0, proofs0, grupos vacíos y quarantine=false. El GET explícito de disponibilidad bloqueó controles y después habilitó Analizar. La tercera intención nueva completó extracción validada en la UI tras104s:3 partidas sintéticas, total7140 y mismo Blob. El observador final confirmó CLI0, unknown0, proofs0, grupos vacíos y quarantine=false. No se pulsó Guardar ni hubo mutación comercial; no se afirma un HTTP terminal exportado independientemente. [Evidencia](../../../../evidence/invoice-gemini-cancel-recovery-20261106-r01.json).

La identidad OCR liga recurso físico, generación y referencia. Sólo cgroup propio vacío y retirado con ausencia comprobada, líder recogido e IO cerrado permiten conciliar y acusar el terminal local; prueba ausente o incompatible mantiene bloqueo. No se usa un recibo de Teacher/chat/login ni se reenvía lo cancelado. ACK local no implica ACK remoto o guardado comercial; no se afirma observación independiente de su ACK en esta QA.

`runtime_busy` explica ocupación/cuarentena; `native_proof_missing` y `native_proof_mismatch`, cierre no confirmado. Se mantienen instancia, archivo y borrador sin fallback. Cancelar solicita comprobación GET con bloqueo síncrono: un GET fallido no habilita caché vieja; uno exitoso exige otra acción explícita para una intención nueva.

La excepción legada específica ya se ejecutó una vez con copia/CAS/exclusión y resultado remoto `unknown` conservado. ADR096 sigue propuesto.78 Client/4 archivos,30 Server/3 archivos,651 R13 y655 R14 son corridas separadas. Sin nueva capacidad, binding, autoridad o publicación;44 cuerpos aprobados intactos y revisión6 draft/partial/unregistered/approval:null. [Plan94 §37](../../../../mvp/94-business-point-of-sale-and-product-refactor.md#37-recuperación-identificada-del-ocr-manual-y-motivo-real-de-bloqueo--2026-11-06).


## QA de vinculación manual — 2026-11-07

QA autenticada de vinculación manual en VM el 2026-11-07: un OCR Gemini Agentic de factura sintética, búsqueda por nombre y relectura exacta del producto9 del mismo negocio. Cancelar conserva la fila detectada. Preparar actualización sólo cambia el borrador: costo neto1000→900 y bruto1190→1071; código, nombre y venta1200 conservados. Reabrir consulta otra vez el producto y muestra los valores originales. No se pulsó Guardar Factura y Productos ni hubo mutaciones comerciales. ServerR12, ClientR33 y NativeR14 sin nueva adopción. Tabla provisional con columnas demasiado estrechas observada; pendiente visual. No acredita guardado final, concurrencia, atomicidad global ni otros proveedores. [Evidencia](../../../../evidence/invoice-manual-match-qa-20261107-r01.json).


## Tabla provisional: evaluación de presentación — 2026-11-07

ClientR35 activo en VM (R34 incorporó el menú y R35 corrigió sólo la anchura/nowrap de Acciones): menú por fila de tres acciones, control +/− junto a Precio Venta para cantidad/disponibilidad y columna del candado retirada. Las columnas empiezan ocultas y se abren al publicar una extracción con productos nuevos sin disponibilidad requerida; ocultarlas conserva valores y alinea el histórico. Objetivos44px y scroll horizontal local min1000/1200px.52pruebas/2archivos, tipos/lint y build aislado correctos. La nueva QA autenticada Gemini recibió409antes del dispatch por health_status; tras GET explícito, otra intención agotó240s y devolvió504 sin extracción. No se reenvió su resultado incierto. La comprobación visual escritorio/320/600px usa el componente R35 exacto en harness aislado, rotulado sintético y sin red; verifica menú/toggle/borrador, no inferencia real. Sin guardar factura/productos ni cambios Server/Native/SQL/modelos/permisos. Se preservó la pestañaR33 anterior. No acredita escritura final ni teléfono físico. [Evidencia](../../../../evidence/invoice-provisional-table-ui-20261107-r01.json). No cambia el conocimiento operativo aprobado, capacidades, herramientas o bindings. Esta ficha conserva draft/partial/unregistered/approval:null.


## Calculadora compacta: evaluación de presentación — 2026-11-07

ClientR36 activo en VM: calculadora compacta a la derecha del costo con impuestos desde sm600, porcentaje88px con%, importe visible e icono44px con tooltip «Usar precio sugerido». Un container query local de280px permite tres columnas (88+132+44+16); por debajo usa dos filas y conserva el importe entero. En xs el bloque va debajo del costo; no cambia el breakpoint global. Enter en el porcentaje evita enviar el formulario. Cambiar porcentaje/costo sólo actualiza la sugerencia; aplicar sólo cambia la venta del borrador.104pruebas/4archivos, tipos/lint/build aislado correctos. CUA autenticada1088/320px:30%→350,40%→377 con venta350 hasta aplicar, costos226/269 intactos y Cancelar/reabrir tras recarga recupera350/30%. Input/costo alineados, tooltip y targets44px comprobados; móvil sin overflow. Vista aislada600/320 verificó un importe1300000000 completo. No Guardar, mutaciones HTTP o inferencias; Server/Native/SQL/contratos/autoridad conservados. Una activación/recarga Nginx y185outputs actuales/18versiones históricas verificados. Sin publicación ni aprobación nueva. [Evidencia](../../../../evidence/product-price-suggestion-ui-20261107-r01.json). No crea capacidades, herramientas, grants o bindings NodiaAI. Esta ficha conserva draft/partial/unregistered/approval:null; los cuerpos aprobados no cambian.

## Alineación del precio sugerido — ClientR37, 2026-11-07

ClientR37 activo en VM: etiquetas del porcentaje y precio sugerido alineadas, importe sin sufijo CLP y centrado en una fila mínima de40px. El importe sigue siendo un estado informativo, no un input editable. Conserva porcentaje88px, icono44px, container query280px y dos filas en móvil estrecho. Siete pruebas atómicas, tipos/lint globales y build aislado correctos (1400entradas,185outputs);185assets actuales y181anteriores verificados. CUA autenticada1088px: diferencia vertical de etiquetas0,125px y de centros del input/importe0,0625px. A320×892px, documento320/320px sin desbordamiento y modal288px; composición de dos filas intencional. Cambiar40→30% conservó venta350; después se canceló el modal sin Aplicar ni Guardar y el producto mantuvo350. Ajuste visual de dos fuentes: la operación estática no reinició Server/Native ni accedió directamente aDB/SQL. La QA visual usó lecturas autenticadas del backend, sin realizar inferencias. [Evidencia](../../../../evidence/product-price-result-alignment-20261107-r01.json). Evaluación de impacto: presentación exclusivamente visual; conceptos, operaciones e interpretación comercial conservados. Continúa draft/partial/unregistered/approval:null; no publica ni habilita capacidades.

## OCR Gemini: NativeR15 adoptado, timeout real no resuelto — 2026-11-07

NativeR15 está adoptado y sus659pruebas Linux/fixture de cierre aislado pasaron, pero no resolvió el timeout OCR real. La nueva intención explícita recibióHTTP504 tras251s observados en UI; el runtime agotó su deadline240s con duración de inferencia242051ms. El progreso observó view_file (dos eventos, una finalización), document_read_completed=true, tool_error_counts={} y result_event_count=0; no acreditó resultado ni finish. Al cierre se observaron0CLI, marcadores, proofs y grupos propios,21fuentes verificadas y archivoPNG conservado con controles habilitados. Cierre local no demuestra éxito remoto: el resultado sigue unknown, sin replay, sin guardado o nuevo matching. Los cambios de prompt/diagnóstico no demuestran la causa del fallo. Se prepara instrumentación segura de cli.log/hook en R16; sigue pendiente, sin ampliar240/300/340/360s. [Evidencia](../../../../evidence/invoice-gemini-timeout-20261107-r01.json). Esta observación no crea capacidades ni cambia la autoridad de NodiaAI; la ficha permanece draft/partial/unregistered/approval:null.

## Diagnóstico NativeR16 adoptado, extracción aún bloqueada — 2026-11-07

NativeR16 está adoptado con instrumentación estructural segura, pero la extracción OCR continúa bloqueada. El delta añade sólo la captura best-effort de cli.log/hook en finally, con el helper heredado intacto; errores de diagnóstico no alteran el resultado y no se registra texto libre.660pruebas Linux sin fallos/omitidas y fixture aislado sin red/perfil real correctos. La nueva intención explícita sobre el mismo archivoPNG conservado recibióHTTP504 tras250s en UI: deadline240s, inferencia242057ms, lectura view_file completada y0eventos finish/resultado. El hook observado contabilizó1decisión,0rechazos y0finish; el log examinó30835bytes/128líneas con truncado. Sus indicadores vacíos de transporte/proveedor/HTTP no identifican la causa ni prueban ausencia de fallo. Tras el cierre:0CLI/marcadores/proofs/grupos propios y22fuentes verificadas; archivo y controles recuperados. No hubo replay, otro POST de análisis, guardado o nueva vinculación tras este fallo. Los10rechazos health_status observados fueron metadatos, no inferencias adicionales. No se aisló causa remota; no se atribuye el fallo a Google ni se presupone que otro modelo/CLI funcione. Permanecen CLI1.3.1, SDK, prompt/modelo/esfuerzo y límites240/300/340/360s; resolver una estrategia compatible y demostrar una extracción válida sigue pendiente. [Evidencia R16](../../../../evidence/invoice-gemini-timeout-20261107-r02.json). No cambia la autoridad, capacidades o permisos de NodiaAI; aprobación y publicación siguen separadas.
