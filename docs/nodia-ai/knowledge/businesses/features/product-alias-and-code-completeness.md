---
{
  "schema_version": 1,
  "document_id": "businesses.product-alias-and-code-completeness",
  "product_id": "businesses",
  "kind": "feature",
  "revision": 2,
  "document_status": "draft",
  "implementation": {
    "status": "partial",
    "notes": "Solicitud2026-11-16 plan94§41: nuevos alias desde nombre, alias existente conservado/editable, disponibilidad nueva true y existente intacta, precio OCR inicial30% sobre bruto y edición por fila; modelo/intensidad desde configuración persistida por instancia/modo. Implementación local y QA Chromium sintética6perfiles verificadas; tipos/lint/build correctos. Global2 correcta3125/378 y focal posterior124/10 cubre recuperación final; tipos/lint/build y pins locales correctos según evidencia2026-11-16; antecedentes fechados inferiores conservan su alcance. Sin nueva aprobación/publicación o adopción. Solicitado2026-11-14: alias humano independiente, revisión OCR explícita y filtros de códigos. Regresiones locales, SQL/HTTP aislados Linux y QA visual sintética correctos. Migración179366 y delta adoptados sólo en VM,13productos/33logs preservados; cierre operativo documentado aparte. Sin producción, inferencia OCR o publicación."
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento de Negocios conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/94-business-point-of-sale-and-product-refactor.md",
      "kind": "specification"
    },
    {
      "path": "docs/architecture/decisions/ADR-102-human-product-alias-and-code-completeness.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/product/entities/product.entity.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/product/product-alias.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/product/product-lookup-filters.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/product/product.service.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/product/dto/create-product.dto.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/product/dto/filter-product.dto.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/migrations/1793660000000-AddProductAlias.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductModal/ProductModal.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductInvoiceImport/helpers.ts",
      "kind": "implementation"
    }
  ],
  "verification": {
    "checked_on": "2026-11-16",
    "evidence_paths": [
      "docs/evidence/product-alias-and-code-completeness-20261114.md",
      "docs/evidence/invoice-ocr-review-defaults-20261116.md"
    ],
    "notes": "Delta2026-11-16: implementación local, tipos/lint/build y QA Chromium sintética6perfiles correctos; global2 correcta3125/378 y focal posterior124/10; tipos/lint/build y pins locales correctos. Sin inferencia ni mutaciones HTTP reales. Regresiones locales y SQL/visual se distinguen de migración operativa e inferencia; ver recibo consolidado."
  },
  "approval": null
}
---

# Alias humano y completitud de códigos — contexto funcional candidato

## Qué resuelve y qué significa

Un nombre de factura puede ser difícil de buscar. Alias da un nombre humano
independiente y opcional, sin cambiar ese nombre ni los identificadores.
Código corresponde al proveedor/factura; barcode al producto. Ambos pueden
estar sin asignar, y eso no crea una nueva identidad.

## Solicitudes en lenguaje natural

| Solicitud | Intención y resolución |
|---|---|
| «Ponle un alias legible» | Elegir producto exacto y nombre humano; usar formulario nativo. No existe nueva herramienta de alias publicada. |
| «Usa el nombre como alias» | Checkbox humano guarda una copia explícita al confirmar; no lo interpreta la extracción IA. |
| «Busca por alias o nombre» | Consulta nativa q.search, paginada y con autoridad vigente. No inferir que un resultado es la identidad de otra fila. |
| «Muéstrame los que no tienen código» | Aclarar código de factura o barcode si no es inequívoco; filtros independientes. |
| «Completa todos automáticamente» | No confirmar alias/identificadores implícitamente ni modificar nombres originales; revisión explícita del borrador. |

## Operaciones y contratos

| Operación | Contrato y efecto |
|---|---|
| Crear/editar producto nativo | CreateProductDto/UpdateProductDto, alias nullable max255; omitir conserva, null/blancos limpia. Update con alias exige expected_version. |
| Revisar alias OCR | Nuevo: copia local automática del nombre al alias, editable con lápiz. Existente: conserva alias de catálogo; sólo si falta requiere revisión breve. Editor local sin HTTP al guardar fila. |
| Buscar/filtrar | GET products con q.search o code_presence/barcode_presence present/missing; Todos omite. |
| Historial/CSV | Nuevos snapshots guardan alias de esa revisión; históricos null desconocidos. CSV añade columna y conserva valor si import antiguo la omite. |

Herramientas NodiaAI publicadas conservan sus contratos cerrados. Esta ficha
es candidata y no habilita escrituras, SQL libre o HTTP arbitrario.

## Datos mínimos y resolución de dudas

Alias no es obligatorio en el contrato de catálogo. Por la solicitud2026-11-16
del [plan94§41](../../../../mvp/94-business-point-of-sale-and-product-refactor.md#41-revisión-ocr-compacta-defaults-comerciales-y-selección-ia--solicitud2026-11-16), el importador
manual copia el nombre al alias de filas nuevas, con edición local opcional.
Para updates conserva el alias del destino, sin rellenarlo desde la respuesta IA.
Un producto existente sin alias sigue requiriendo revisión explícita; mensaje
breve «Revisar alias». Este default no modifica históricos ni el contrato nativo.
Texto con sólo espacios se considera vacío. No existe bool persistido del
checkbox; un alias personalizado no sigue cambios de nombre automáticamente.

## Reglas, acceso y restricciones

Se conservan módulo/ownership/colaboradores y bypass super_admin de89. Alias
no concede acceso, no cambia matching por código y no asigna barcode desde OCR.
No actualizar logs anteriores con alias actual ni reescribir snapshots de ventas.

## Filtros e informes

Nombre OR alias usa búsqueda literal escapada antes del paginado; code_presence
y barcode_presence distinguen presente/ausente incluyendo null/vacío/whitespace.
Actividad conserva ActiveStatusSelect/Activo inicial. Sin agregados, monedas,
progreso inventado ni filtros aplicados sólo a una página.

## Vista previa, confirmación y recuperación

La celda de alias muestra el valor y lápiz con nombre accesible; sólo el alias
pendiente de un producto existente se remarca con el texto breve «Revisar alias». Modal conserva
nombre original arriba, input/checkbox, borrador y errores. Guardar modal sólo
revisa fila; guardar factura/productos sigue siendo una acción posterior explícita.
Todas las filas/comandos se validan antes del primer POST. Las peticiones
separadas actuales no se presentan como una transacción global; recuperación
mantiene identidad y evita repetir writes inciertos. Fingerprint incluye alias.

## Integración y evidencia

- [x] Fuentes y solicitud contrastadas; aprobación documental no heredada.
- [x] Cierre local SQL/UI y regresiones consolidadas en evidencia.
- [x] Migración y adopción técnica VM con datos preservados, respaldo restaurado y servicios/timers reanudados; UI real manual pendiente.
- [ ] Aceptación de productos en producción: no desplegado por esta entrega.
- [ ] Herramientas/contexto de alias publicados: fuera de esta entrega.

[Plan94§38](../../../../mvp/94-business-point-of-sale-and-product-refactor.md#38-alias-humano-de-productos-y-revisión-ocr--solicitud2026-11-14),
[ADR102 propuesto](../../../../architecture/decisions/ADR-102-human-product-alias-and-code-completeness.md)
y [evidencia](../../../../evidence/product-alias-and-code-completeness-20261114.md).

## Evolución y compatibilidad

Revisión1: feature solicitada2026-11-14. Migración179366 aditiva y sin backfill;
requiere esquema actualizado antes del código. Down exige backup para evitar
perder alias posteriores. Contratos/capacidades publicadas y fichas aprobadas
permanecen intactos; esta ficha draft/partial/unregistered no se publica.

Revisión2: solicitud2026-11-16 del plan94§41 sustituye revisión obligatoria
del alias nuevo por copia local automática del nombre. Implementación local y
QA Chromium sintética verificadas; tipos/lint/build y pins locales correctos según
[evidencia](../../../../evidence/invoice-ocr-review-defaults-20261116.md).
Revisión1 conserva su recibo de2026-11-14.
