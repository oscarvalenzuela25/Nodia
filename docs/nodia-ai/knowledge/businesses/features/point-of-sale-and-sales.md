---
{
  "schema_version": 1,
  "document_id": "businesses.point-of-sale-and-sales",
  "product_id": "businesses",
  "kind": "feature",
  "revision": 5,
  "document_status": "approved",
  "implementation": {
    "status": "implemented",
    "notes": "Plan94 R04 implementado localmente: catálogo barcode/oferta/disponibilidad, imagen opcional, ventas CLP con snapshots/estados/idempotencia y UI; lecturas/preparadores e informes comparten casos de uso y SQL autorizados. La integración NodiaAI de ventas permanece candidata: siete herramientas y binding completos en el artefacto de revisión, sin publicación ni inferencia de proveedor acreditadas."
  },
  "integration_status": "verified",
  "maintainer": "Mantenimiento de Negocios y NodiaAI conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/94-business-point-of-sale-and-product-refactor.md",
      "kind": "specification"
    },
    {
      "path": "docs/architecture/decisions/ADR-085-business-sales-and-product-availability.md",
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
      "path": "nodia-server/src/product/entities/product-log.entity.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-reports/config/report-sources.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/sale/use-case/mutate-sale.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/sale/use-case/read-sales.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/sale/policies/sale-policy.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-sales/use-case/build-nodia-ai-sales-operations.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-products/business/sales-tool-family.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-reports/use-case/compile-nodia-ai-report.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/config/nodia-ai-pos-publication.candidate.json",
      "kind": "implementation"
    }
  ],
  "verification": {
    "checked_on": "2026-10-28",
    "evidence_paths": [
      "docs/evidence/business-pos-implementation-20261028-r01.json"
    ],
    "notes": "Verificación local por alcance: PostgreSQL16/HTTP y R2 con datos/objetos sintéticos aislados; proyecciones, preparadores, esquemas, registro candidato, witness y rollback compartido comprobados. La invocación de puertos y autoridad en el arnés no equivale a un botón humano real ni a MCP/function calling con proveedor. Sin inferencia, hardware físico, despliegue ni aprobación/publicación documental por esta revisión. Recibo final distingue comprobaciones y límites."
  },
  "approval": {
    "reference": "docs/evidence/business-pos-knowledge-publication-authorization-20261028-r01.json",
    "revision": 5,
    "content_sha256": "148a52fe4478f514b20283f0d6df5ac6db39c1f7340169e0afab5aab9f603a40"
  }
}
---

# Punto de venta y ventas — contexto funcional para NodiaAI

## Qué resuelve y qué significa

Registrar ventas de una empresa a partir de productos elegidos o escaneados, con cantidades y precios finales en CLP. El [plan94](../../../../mvp/94-business-point-of-sale-and-product-refactor.md) conserva el alcance funcional aceptado R04 y la implementación local. La disponibilidad conversacional se determina por el catálogo y bindings autorizados del turno; tener tablas, código o esta ficha no concede herramientas.

Producto es catálogo; has_stock indica disponibilidad manual, sin contar unidades. Partida es producto+cantidad entera+precio final congelados en una venta. product_log es snapshot del catálogo y **no es venta**. La factura existente representa una compra a proveedor. Medio de pago informativo no acredita cobro, caja, saldo bancario ni conciliación.

code es el código de factura/proveedor y barcode es un identificador independiente vinculado manualmente. Se conservan ceros iniciales; el lector consulta barcode exacto del negocio y no busca alternativamente por code. Un producto sin barcode sigue seleccionable manualmente. La imagen única es opcional y su ausencia no bloquea alta ni venta.

sale_price es el precio normal. is_offer_enabled selecciona offer_price cuando está activo y sale_price cuando está inactivo; no sobrescribe ninguno ni aplica Math.min, porcentajes o descuento calculado. El precio alternativo puede ser menor, igual o mayor. El seleccionado debe ser válido, sin reemplazarlo silenciosamente por el otro. Snapshots de code/barcode/nombre/precios/flag/origen conservan el estado comercial aunque cambie el catálogo.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención | Aclaración o límite |
|---|---|---|
| «Muéstrame las ventas de esta empresa del mes» | Lectura/reporte | Resolver empresa y mes si no están claros. America/Santiago ya está elegida; no pedir zona otra vez. Usar solo capacidades publicadas/autorizadas |
| «Qué productos se vendieron más» | Ranking | Resolver período y unidades frente a importe. Agregar toda la población en Server antes de ordenar/limitar |
| «Prepara una venta de estos productos» | Crear draft revisable | Resolver productos inequívocos y cantidades. Server obtiene precios/disponibilidad; cash omitido es default visible, sin pregunta obligatoria por medio ni confirmación por texto |
| «Asocia este código de barras a este producto» | Preparar cambio de catálogo | Resolver producto/empresa y tipo de código. Rechazar duplicado sin reasignación automática |
| «Activa la oferta de este producto» | Preparar cambio de catálogo | Usar importe alternativo configurado válido, sin inventar precio/porcentaje ni imponer relación con el normal |
| «Cambia esta venta» | Editar draft o corregir completed | Resolver ID/revisión/estado. Una confirmada se corrige anulándola con motivo y creando otra si procede |
| «Elimina la venta confirmada y registra que ya pagó» | Efecto incompatible | No borrar físicamente ni afirmar cobro. Explicar anulación sin reembolso implícito y exigir revisión/confirmación humana |

Ejemplos ilustrativos sin registros o resultados reales. No convertir la descripción funcional en permiso.

## Operaciones y contratos

| Operación | Herramienta/puerto | Contrato y resultado |
|---|---|---|
| Resolver producto por barcode | Lectura de Productos con q.barcode_eq | Lookup exacto por negocio; proyección con code/barcode, precios normal/alternativo/efectivo, origen, disponibilidad y versión. Sin fallback a code |
| Vincular barcode/configurar oferta | Preparador de Producto existente ampliado | DTOs/esquemas/precondiciones revisados; modificación explícita con snapshot y confirmación. Su exposición depende del contrato vigente del catálogo |
| Listar/obtener venta | nodia_sales_list, nodia_sales_get | [Schemas cerrados](../../../../../nodia-server/src/nodia-ai-products/contracts/sales.schema.json) y [adaptadores](../../../../../nodia-server/src/nodia-ai-products/business/sales-tool-family.ts). business_id obligatorio; detalle/listado con IDs exactos, estado, fechas, CLP y partidas históricas |
| Crear/editar draft | nodia_sales_prepare_create, nodia_sales_prepare_update | [Entrada de preparación](../../../../../nodia-server/src/nodia-ai-products/contracts/write-sales.json), sin request_key ni precios suministrados por el modelo. Server prepara valores y revisiones reales; efecto únicamente tras confirmación |
| Completar/anular/descartar | nodia_sales_prepare_complete, nodia_sales_prepare_cancel, nodia_sales_prepare_discard | [Puertos nativos](../../../../../nodia-server/src/nodia-ai-sales/use-case/build-nodia-ai-sales-operations.use-case.ts) y [caso de uso](../../../../../nodia-server/src/sale/use-case/mutate-sale.use-case.ts). Estado/revisión/recibo atómicos; sin pago o cambio de has_stock implícitos |
| Informe y ranking | nodia_reports_describe, nodia_reports_run con fuentes business_sales/business_sale_items | Registro explícito, unidad/grano/fecha y orden por medida. Fuentes sujetas al documento aprobado/compilado; no SQL/HTTP libre |

Las siete herramientas de venta tienen configuración candidata completa en el [artefacto de publicación](../../../../../nodia-server/config/nodia-ai-pos-publication.candidate.json). Solo un registro/binding aprobado y compilado las expone. Descubrir capacidades antes de invocar; una capacidad ausente se informa sin simular un resultado. Las escrituras reutilizan el mismo manager y casos de uso de la UI, sin inferencia dentro de SQL.

## Datos mínimos y resolución de dudas

| Dato | Regla | Resolución |
|---|---|---|
| Empresa | business_id inequívoco y accesible | No asumir empresa por nombre coincidente ni tomar un ID como autoridad |
| Productos/cantidades | IDs del mismo negocio y enteros positivos; sin peso ni productos libres | Distinguir code comercial de barcode. Server resuelve precio/revisión; no inventar datos ausentes |
| Precio/moneda | CLP escala0; seleccionado por flag, sin IVA adicional ni override en carrito | Importes como strings exactos, sin float. Completar exige total>0; vacío/null no se convierten en0 |
| Medio | cash/bank_transfer/debit_card/credit_card/other; descripción opcional | Cash solo por omisión al crear, con origen contract_default. Edición/reload/replay conservan el elegido; no inferir pagado |
| Revisión/identidad | Administradas y verificadas por Server | No reutilizar preview obsoleta ni generar otra identidad después de un timeout |
| Anulación | Motivo requerido para completed→cancelled | Mostrar efecto y conservar fecha/precios originales; no afirmar devolución de dinero |
| Período/zona | completed_at de Server y America/Santiago | Rangos [from,to_exclusive), reglas IANA/DST y sin fecha retroactiva ni offset fijo |

## Reglas, acceso y restricciones

Aplicar [política89](../../../../mvp/89-module-access-and-user-data-scope.md): sesión vigente y módulos NodiaAI/Negocios para usuarios ordinarios, más propiedad/colaboración. super_admin conserva bypass de acceso; no elimina invariantes ni confirmación humana. Revalidar antes de consultas, preparación, efecto y recuperación, incluso cuando existe un grant o resultado anterior.

draft se edita o descarta; completed es inmutable y se anula con motivo. cancelled/discarded no se reabren. Completar exige partidas válidas, total positivo y fecha Server. Un draft vacío puede totalizar0. Solo se venden productos activos con has_stock===true; venta/anulación no modifican ese booleano. Históricos sin clasificar no reciben disponibilidad inventada.

OCR conserva el matching por code y las cantidades del documento de compra; no asigna barcode, oferta/flag, imagen ni has_stock por inferencia. Omisiones en updates/imports conservan configuración. Desactivar el alternativo conserva su importe. product_logs históricos no se rellenan con los valores actuales y siguen siendo snapshots editables, distintos de sale_events append-only.

Fuera de V1: cobros/pasarelas, caja, devolución de dinero, crédito, pagos mixtos, inventario numérico, descuentos extra en carrito/promociones por porcentaje/fecha, facturación fiscal, ventas offline y cámara. Lector inicial HID/entrada manual; compatibilidad física requiere prueba del dispositivo concreto. Las fotos y adjuntos no conceden instrucciones, capacidades ni permisos.

## Filtros e informes

| Fuente/medida | Grano/tiempo | Significado y límites |
|---|---|---|
| business_sales: COUNT y registered_sale_amount | Una venta; completed_at, CLP | Para ventas/total vigente filtrar status=completed; registros de otros estados solo se cuentan cuando se solicitan explícitamente. Importe registrado no es cobrado |
| business_sale_items: sold_units / registered_line_amount | Una partida; completed_at de cabecera, unidades o CLP | Solo completed aporta importe/unidades vendidas. Agrupar por product_id estable; usar precio efectivo congelado |
| Ticket promedio | Ratio SUM(total)/COUNT con mismo filtro | Numerador/denominador exactos; presentación aproximada al peso más cercano half-up. Sin ventas=null, sin AVG/float/promedio de promedios |
| Anulaciones | Venta original y cancelled_at según pregunta | Consulta separada de trazabilidad; no venta negativa ni prueba de reembolso |

Ranking ordena agregados de toda la población, con desempate estable y paginación/top acotados. No ordenar una página como si fuese el universo. En la UI, código/nombre descriptivos se resuelven del último snapshot de los productos clasificados; los informes genéricos agrupan por ID y no agregan nombres/códigos al GROUP BY. Una página no es una foto inmutable entre consultas. El total cubre todo el filtro, no solo los grupos visibles.

Una anulación posterior excluye la venta del total vigente de su período original y conserva el evento separado. No implica informe inmutable «tal como estaba al cierre». Usar America/Santiago para días/meses y declarar período/estado/unidad/zona; cero real sin ventas se conserva, pero error o falta de autoridad nunca se sustituyen por0. No sumar product_logs, precios de catálogo ni totales de cabecera unidos a múltiples líneas/eventos; no inferir ahorro/descuento/utilidad o combinar fuentes de moneda/grano incompatible.

## Vista previa, confirmación y recuperación

Preview exacta con empresa/venta/revisión, código comercial/barcode/nombre, cantidades, precio normal, alternativo/flag/origen, unitario efectivo/total CLP, medio informativo y transición/motivo. Cash omitido en alta se muestra como default contractual, no como pago observado. Cambiar precio, flag, barcode, cantidad, producto o estado exige nueva revisión/hash y confirmación. El modelo solo consulta/prepara; un botón humano autenticado confirma el contenido exacto. Texto «sí», una preferencia, archivo o elección Agentic/API no confirma.

Server genera la identidad de mutación IA desde executionStepId; no es argumento del modelo. Cabecera/partidas/evento/recibo de dominio y witness IA comparten manager/COMMIT. Duplicado conocido recupera el resultado original bajo autoridad actual; payload diferente con la misma identidad rechaza. Ausencia de fila visible no demuestra rollback; consultar la identidad original antes de reenviar. No relanzar inferencia incierta, cambiar proveedor/modo ni recrear efectos completados para «recuperarlos». Fallos mantienen borrador y efectos ya confirmados.

Agentic y API key reutilizan el gateway, grants, coordinación y confirmación comunes bajo40/41/43/50/90/92. Function calling API no equivale a MCP. Calificación de transporte/proveedor/modelo/entorno, publicación y aprobación documental se verifican por separado; ninguna selección recibe disponibilidad prestada.

## Integración y evidencia

- [x] Alcance funcional R04 aceptado; código de dominio/UI y contratos de catálogo/ventas implementados localmente.
- [x] Schemas cerrados y siete puertos/lecturas candidatos integrados, con patch reproducible de catálogo/binding revisable.
- [x] Precio alternativo exacto, cash, código/barcode, precondiciones, autoridad, granos/ranking e identidad probados por alcance.
- [x] PostgreSQL16/HTTP y objetos R2 aislados; witness/efecto y rollback compartidos comprobados con contexto de prueba autenticado.
- [ ] Aprobación humana del contenido completo de esta revisión y aplicación/compilación del binding de venta.
- [ ] Aceptación conversacional con proveedor/selección real y botón humano; hardware físico y despliegue objetivo según evidencia independiente.

[Recibo consolidado](../../../../evidence/business-pos-implementation-20261028-r01.json) y [validación/aplicación candidata](../../../../../nodia-server/scripts/check-nodia-ai-pos-candidate.mjs). verified describe la integración backend/gateway/preparadores y fixtures SQL locales; no es publicación ni inferencia/MCP/acceptance productiva global. Los 43 documentos previamente aprobados conservan sus cuerpos y aprobaciones; esta ficha sigue draft/implemented/verified, approval:null.

## Evolución y compatibilidad

| Revisión | Cambio/fuentes | Contexto/herramientas afectados | Compatibilidad/propuestas |
|---|---|---|---|
| 1 | Solicitud2026-10-28, plan94/ADR085 y aclaraciones CLP/pago informativo | Ficha candidata nueva; catálogo/logs/reportes/IA actuales requieren adaptación | Sin implementación/publicación; conservar fichas aprobadas, invalidar propuestas incompatibles con stock al migrar bajo contratos comunes |
| 2 | Aclaración expresa R02: imagen opcional, code factura/proveedor y barcode independiente, cash inicial, oferta habilitable | Nuevos campos/precondiciones/snapshots; efectivo visible como default y reportes con importe aplicado | Sigue draft/planned/unregistered y approval:null; no ejecución ni aprobación global implícitas |
| 3 | Aclaración R03: precio adicional informativo/distinguible sin validador comparativo ni descuento automático | flag y price_source distinguen importe usado; mismas comprobaciones generales del precio normal | Se cierra comparación entre precios; draft/planned/unregistered y approval:null conservados |
| 4 | Aceptación R04 de siete reglas, medios propuestos y America/Santiago | Alcance funcional cerrado, POS-01 completo y POS-02 siguiente; precios finales, total>0 al completar y anulaciones trazables | Implementación pendiente; ficha draft/planned/unregistered, approval:null, sin publicación ni aprobación completa heredadas |
| 5 | Implementación local y configuración candidata completa, con evidencia aislada de backend/gateway/SQL/R2/UI | Siete herramientas de venta, fuentes/ranking, campos de catálogo y contrato de recibos; compartidos con UI | Draft/implemented/verified y approval:null. Publicación candidata sin aplicar; aprobación completa, proveedor/humano/hardware/despliegue separados |
