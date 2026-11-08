---
{
  "schema_version": 1,
  "document_id": "businesses.manual-sale-ticket-printing",
  "product_id": "businesses",
  "kind": "feature",
  "revision": 4,
  "document_status": "draft",
  "implementation": {
    "status": "implemented",
    "notes": "R24 implementado y adoptado en la VM con respaldo previo y posterior. Client2479/296 y Server5773/317+1omitida, tipos/lint/build y11comprobaciones SQL desechables correctos. QA ES oscuro/EN claro en320/390/600/1569: cantidades, precio temporal/permanente, error/reintento, alternancia, salida y formatos. PDFs80mm del HTML real inspeccionados, sin impresión física. Migración37→38 conserva70tablas y69tablas de dominio; NodiaAI conserva2lecturas/0escritores. Draft/unregistered/approval:null;44cuerpos aprobados intactos. No acredita teléfono/impresora físicos, nueva inferencia IA o aprobación/publicación documental."
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento de Negocios y NodiaAI conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/94-business-point-of-sale-and-product-refactor.md",
      "kind": "specification"
    },
    {
      "path": "docs/architecture/decisions/ADR-087-atomic-point-of-sale-checkout.md",
      "kind": "specification"
    },
    {
      "path": "docs/architecture/decisions/ADR-090-product-units-and-fractional-sale-quantities.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/sale/sale.controller.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/sale/entities/sale-item.entity.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/infrastructure/salesServices.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/infrastructure/salesTypes.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/pages/BusinessDetail/BusinessDetail.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/pages/BusinessDetail/components/SalesWorkspace/SalesWorkspace.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/infrastructure/saleTicket.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/infrastructure/printSaleTicket.ts",
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
      "path": "nodia-client/src/components/ConfirmDialog/ConfirmDialog.tsx",
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
    }
  ],
  "verification": {
    "checked_on": "2026-10-31",
    "evidence_paths": [
      "docs/evidence/business-pos-ticket-20261030-r01.json",
      "docs/evidence/business-pos-followup-20261030-r21.json",
      "docs/evidence/business-pos-receipt-detail-20261030-r22.json",
      "docs/evidence/business-pos-usability-20261031-r24.json"
    ],
    "notes": "R24 implementado y adoptado en la VM con respaldo previo y posterior. Client2479/296 y Server5773/317+1omitida, tipos/lint/build y11comprobaciones SQL desechables correctos. QA ES oscuro/EN claro en320/390/600/1569: cantidades, precio temporal/permanente, error/reintento, alternancia, salida y formatos. PDFs80mm del HTML real inspeccionados, sin impresión física. Migración37→38 conserva70tablas y69tablas de dominio; NodiaAI conserva2lecturas/0escritores. Draft/unregistered/approval:null;44cuerpos aprobados intactos. No acredita teléfono/impresora físicos, nueva inferencia IA o aprobación/publicación documental."
  },
  "approval": null
}
---
# Confirmación e impresión manual de ticket y vale80mm — candidato

## R24 vigente: vista previa detallada y formato explícito

La vista previa siempre muestra el detalle de las partidas positivas y sus precios finales; se retira Mostrar detalle. Cancelar vuelve al carrito sin guardarlo. Confirmar guarda sin imprimir. Confirmar e imprimir vale y Confirmar e imprimir con detalle fijan false/true respectivamente antes de esperar al checkout y sólo imprimen después de recibir una venta confirmada. Un error conserva el diálogo y datos sin repetir una venta automáticamente. Ya no existe una elección de formato que restaurar al reabrir.

La acción Imprimir vale omite únicamente la lista de productos; Imprimir con detalle la conserva. Negocio, ID/fecha, importe final CLP, medio informativo y pie son los mismos. El ajuste manual de partida aparece con su precio final y procedencia guardados, no con el precio posterior del catálogo. Ambos formatos validan el documento completo antes de omitir lines. El formato continúa siendo local, no un campo de BD ni una preferencia del chat.

Los valores de la vista previa se muestran a17px y el total a18px; en el documento80mm los valores son16px y el total17px. Cantidad/precio pueden envolver y el subtotal dispone de su fila, sin ocultar desbordamiento. El transporte, escape/CSP, ciclo de iframe, espera del guardado y GET fresco autorizado para reimprimir se conservan. «Detalle» es la etiqueta de las acciones UI; los nombres internos de modelo/transporte no cambian el contrato.

El panel guardado mantiene Anular+Vale y el detalle de ancho completo debajo. El último recibo ofrece ambos formatos en fila desde600px y a ancho completo en xs; no se duplica si coincide con la venta mostrada. NodiaAI sólo consulta ventas/reportes, no confirma, modifica o imprime. Ver [plan94 §33](../../../../mvp/94-business-point-of-sale-and-product-refactor.md#33-precios-por-partida-salida-del-pos-y-legibilidad--r24-2026-10-31) y [precio por partida](sale-line-price-adjustments.md).

Implementación local revisada. La [evidencia R24](../../../../evidence/business-pos-usability-20261031-r24.json) debe acreditar integración y adopción nuevas; los resultados de R20–R23 y la impresora configurada no prueban impresión física R24. Esta revisión4 es draft/unregistered/approval:null y no publica una herramienta.

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

## Qué resuelve y qué significa

La solicitud R20 añade una vista previa legible al confirmar una venta y permite solicitar un ticket térmico de80mm. La persona elige entre Cancelar, Confirmar o Confirmar e imprimir. Esta es una operación manual del POS; no habilita a NodiaAI para guardar o modificar ventas.

El ticket representa la venta comercial registrada. No es una boleta o factura fiscal ni acredita por sí mismo un pago. El medio de pago conserva su carácter informativo. La app prepara un documento para el diálogo normal de impresión del navegador y del sistema operativo; no añade impresión silenciosa, un controlador de impresora o un servicio externo de generación.

R19 conserva código comercial opcional, las cuatro unidades y el redondeo CLP por línea. R20 no introduce campos Server, migraciones o medidas nuevas. Su incorporación a plan94 y al release se coordina por separado; esta ficha no demuestra adopción.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención y vía manual | Límite |
|---|---|---|
| «Quiero revisar antes de confirmar» | Abrir la vista previa de las partidas y el total en el POS | La vista previa local todavía no es una venta guardada |
| «Confirma e imprime esta venta» | Elegir confirmar e imprimir vale o con detalle; después del guardado se solicita impresión conforme al navegador de caja | El texto del chat no ejecuta checkout ni ordena imprimir |
| «Vuelve a imprimir la venta guardada» | Usar la acción manual disponible con el snapshot de una venta confirmada | Reimprimir no crea, confirma ni actualiza otra venta |
| «¿Este ticket acredita el cobro?» | Mostrar los datos registrados y distinguir el medio informativo | No deducir pago, documento fiscal ni reembolso a partir del ticket |

## Operaciones y contratos

| Operación | Efecto y fuente | Resultado y estado |
|---|---|---|
| Vista previa local | Lee el carrito actual y sus cantidades/precios; sin petición comercial por abrir o cancelar | Vista previa detallada con Cancelar, Confirmar y dos acciones explícitas de confirmar e imprimir; cierre R24 por alcance pendiente |
| Confirmar | Reutiliza checkout manual de [salesServices](../../../../../nodia-client/src/modules/business/infrastructure/salesServices.ts) y [SaleController](../../../../../nodia-server/src/sale/sale.controller.ts), con autoridad, versión y request_key existentes | Una Sale confirmada o recuperación de resultado incierto; el ticket no sustituye el recibo Server |
| Confirmar e imprimir | Primero confirma por el mismo checkout; sólo después prepara la impresión con la Sale devuelta y confirmada | No imprime datos provisionales como si fueran una venta registrada |
| Reimprimir | Consulta de nuevo la venta por su ID y negocio, exige que siga confirmada y abre la impresión con sus snapshots guardados | Sin POST comercial adicional; no modifica la venta |

No se crea una herramienta NodiaAI para estas acciones. Ventas/reportes desde IA permanecen limitados a obtener y mostrar información autorizada conforme a R17.

## Datos mínimos y resolución de dudas

| Dato | Procedencia y regla |
|---|---|
| Negocio | Nombre del negocio ya cargado en BusinessDetail y business_id real; no consulta adicional ni identidad inventada |
| Venta y fecha | ID y completed_at de la Sale confirmada. Presentar la fecha en America/Santiago; una ausencia se mantiene desconocida y no se sustituye por Date.now como fecha real de emisión |
| Partidas | Nombre, cantidad, unidad y precio efectivo de los snapshots guardados; no leer precios actuales del catálogo para reconstruir el ticket |
| Importes | CLP; subtotales y total devueltos por Server, conforme al half-up por línea de R19. No recalcular una venta histórica al imprimir |
| Medio de pago | Valor registrado, informativo; no acredita que el dinero se haya cobrado |
| Papel | Documento blanco de80mm con márgenes internos4mm; nombre y debajo cantidad × precio x unidad, con subtotal a la derecha. Configuración del papel/impresora corresponde al diálogo del sistema |

Cero permanece editable en el carrito; al confirmar se excluyen las filas en cero y sin partidas positivas no se guarda. Los valores inválidos no se descartan silenciosamente para habilitar una venta. Las unidades siguen siendo Unidades, Kilos, Gramos y Atado, sin conversión automática.

## Reglas, acceso y restricciones

La selección de negocio, el actor, los bloqueos y la autorización del checkout permanecen vigentes. Una respuesta tardía conserva la identidad del carrito originario; cambiar de pestaña no permite imprimir otra venta con sus datos. Se mantienen aislamiento de actor/negocio y bloqueo de envíos concurrentes.

La impresión usa un documento aislado del resto de la aplicación. Sólo puede representar datos de una Sale confirmada acreditada; no se imprimen campos de formularios pendientes, credenciales o datos de otras sesiones. El diálogo del navegador/sistema permanece bajo control humano. Cancelarlo o una excepción al abrirlo no anula ni borra una venta ya guardada.

NodiaAI no crea, edita, confirma, anula o descarta ventas, tampoco mediante propuestas antiguas. Esta ficha no añade permisos, herramientas, SQL libre, integración con impresoras ni publicación de conocimiento.

## Filtros e informes

Imprimir o reimprimir no añade una venta, evento monetario o medida a los reportes. Los reportes continúan usando las ventas registradas, CLP, America/Santiago y unidades históricas. El número de copias o la apertura del diálogo no equivale a una cantidad vendida ni prueba de impresión física.

## Vista previa, confirmación y recuperación

R24 sustituye el switch por vista previa siempre detallada y dos acciones explícitas de confirmar e imprimir. El boolean de cada llamada se fija antes del await; Confirmar sin imprimir no crea un documento de impresión. Se mantiene el recibo/identidad de ventas y la conciliación de resultados inciertos, sin replay.

1. La vista previa presenta las partidas y el total de la intención actual. Cancelar conserva la edición sin guardar una venta.
2. Confirmar y Confirmar e imprimir comparten la misma intención comercial, request_key y bloqueo; sólo la segunda elección solicita imprimir después del guardado confirmado.
3. Si el guardado falla, se conservan los datos y se permite corregir/reintentar conforme a la política nativa. Un resultado incierto se concilia por el recibo de la misma clave, sin otro POST automático ni impresión que suponga éxito.
4. La impresión toma la Sale confirmada, no el carrito activo después de una respuesta. Cancelar/fallar la impresión conserva la venta guardada y no repite checkout. Reimprimir hace un GET autorizado fresco, exige negocio/ID/estado confirmados y usa los snapshots guardados. Una venta anulada no se imprime. No repite POST comercial.

El navegador puede informar apertura/cierre del diálogo o una excepción; eso no certifica que salió papel, qué impresora se eligió ni cuántas copias físicas se produjeron. La prueba con una impresora real de80mm permanece pendiente hasta su evidencia específica.

## Presentación y navegación R20

Colaboradores pasa al último lugar tanto en los tabs de escritorio como en el selector de sección xs, con una fuente de orden compartida. Las rutas por clave, la sección seleccionada, los contadores y los permisos conservan su significado. Este cambio de orden es exclusivamente visual/de navegación; no modifica datos, consultas o capacidades IA.

La vista previa comparte el mismo carrito e intención entre móvil y escritorio. Las tres acciones deben permanecer legibles y alcanzables, con los bloqueos de la operación vigente. La presentación blanca del ticket80mm corresponde al documento imprimible; no crea un tema distinto para la app.

## Integración y evidencia

- [x] Flujo de vista previa, tres acciones, doble clic, error e incertidumbre verificados con datos sintéticos.
- [x] Impresión sólo después de Sale confirmada y reimpresión sin POST comprobadas.
- [x] Cancelación/fallo de impresión conserva la venta y no reenvía checkout.
- [x] Navegación desktop/xs, foco, temas e idiomas afectados verificados.
- [ ] Diálogo real del navegador/sistema y ticket físico80mm comprobados por separado.
- [x] Especificación, fuentes finales de impresión y evidencia de entrega enlazadas por alcance.
- [ ] Aprobación documental y registro/publicación coordinados conforme al contrato52, si se solicita publicar contenido.

Esta ficha permanece draft/implemented/unregistered/approval:null. Las44 fichas aprobadas y el KB publicado conservan su estado. La evidencia enlazada distingue tests/QA sintéticos, adopción y aceptación física pendiente. Registrar una fuente draft no publica sus contenidos.

## Evolución y compatibilidad

| Revisión | Cambio | Compatibilidad |
|---|---|---|
| 1 | Solicitud R20 de confirmación con impresión manual80mm y Colaboradores al final | Reutiliza checkout y snapshots R19; sin tablas/contratos Server, nuevas herramientas IA o publicación. El diálogo de impresión no es una segunda transacción comercial |
| 4 | R24: precio por partida, salida segura y formatos explícitos; tabla9/12 sin nuevas consultas | Implementación, QA, SQL desechable y adopción acreditados en el recibo R24; aceptación física pendiente. Draft/unregistered/approval:null;44aprobadas intactas |

La prueba de transporte simula window.print dentro de su iframe aislado: un primer fallo y una reimpresión, con un solo POST comercial sintético. El PDF usa el HTML real y papel80mm; esto verifica formato, no el spooler o papel físico. Cambiar actor/negocio aborta el documento local pendiente y descarta el ticket retenido; después de despachar impresión no se puede revocar una cola nativa ya aceptada.

Referencias del navegador: [CSS de impresión](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Media_queries/Printing) y [afterprint](https://developer.mozilla.org/en-US/docs/Web/API/Window/afterprint_event). Cerrar una vista previa también puede producir afterprint; no es confirmación de impresión física.

Lectura adicional de PrintTicket: MediaSizeWidth71988µm y MediaSizeHeight3275974µm (71.988×3275.974mm), opción ZIJIPAPER420. Es la configuración que declara el driver; no se infiere papel físico80mm, corte, avance o salud. No se modifica. [Unidad del Print Schema](https://learn.microsoft.com/en-us/windows/win32/printdocs/pagemediasize).

## Evaluación visual R23 — 2026-10-31

Los botones Imprimir vale e Imprimir ticket del aviso superior del último recibo comparten fila desde600px; en xs ocupan todo el ancho con altura44px. El panel guardado mantiene su distribución R22. Sólo se modifica la cuadrícula CSS: mismos datos, conceptos, formatos, operaciones, handlers, confirmación y autoridad IA. No afecta al contexto funcional ni exige herramienta/ficha nueva. [Plan94 §32](../../../../mvp/94-business-point-of-sale-and-product-refactor.md#32-acciones-del-último-recibo-en-línea--r23-2026-10-31) y [evidencia R23](../../../../evidence/business-pos-receipt-actions-row-20261031-r23.json); QA10perfiles y adopción Client verificadas con los mismos conceptos/contratos. Esta evaluación no concede aprobación ni publicación.
