---
{
  "schema_version": 1,
  "document_id": "businesses.confirmed-business-effects",
  "product_id": "businesses",
  "kind": "feature",
  "revision": 5,
  "document_status": "approved",
  "implementation": {
    "status": "partial",
    "notes": "AI36-C05 publica sólo la sección adicional enumerada bajo autorización humana específica; los apartados previos conservan su fecha y alcance. Contratos internos y publicación no prueban despliegue, inferencia o aceptación productiva."
  },
  "integration_status": "published",
  "maintainer": "Mantenimiento de Negocios y NodiaAI conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/41-nodia-ai-v1-contracts.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/68-nodia-ai-ai22-business-operations.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/31-provider-contacts-proposal.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/nodia-ai-business-catalog/use-case/build-nodia-ai-business-catalog-operations.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-supplier-operations/use-case/build-nodia-ai-supplier-operations.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-invoice-operations/use-case/build-nodia-ai-invoice-operations.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "docs/mvp/78-nodia-ai-ai32-attachments-voice.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/nodia-ai-write-tools/use-case/build-nodia-ai-write-tools.use-case.ts",
      "kind": "implementation"
    }
  ],
  "verification": {
    "checked_on": "2026-10-24",
    "evidence_paths": [
      "docs/mvp/68-nodia-ai-ai22-business-operations.md",
      "docs/evidence/nodia-ai-ai32-r02-legacy-sql-attempt01.json",
      "docs/evidence/nodia-ai-ai32-r02-sql-regression.json",
      "docs/evidence/nodia-ai-ai32-r06-validation.json",
      "docs/evidence/nodia-ai-ai36-c01-validation.json",
      "docs/evidence/nodia-ai-ai36-c05-write-publication-r02-validation.json"
    ],
    "notes": "Publicación offline con builders nativos y schemas cerrados. El fragmento adicional es el único alcance nuevo; no equivale a cuenta real ni a una aceptación de todos sus efectos."
  },
  "approval": {
    "reference": "docs/evidence/nodia-ai-ai36-c05-write-publication-r02-authorization.md",
    "revision": 5,
    "content_sha256": "24f5392a70b035e7de8bd49353554e5fec794ef015e1e7e9f1b36e271da1c203"
  }
}
---

# Efectos confirmados de Negocios

## Qué resuelve y qué significa

Preparar operaciones individuales sobre negocios, colaboradores, proveedores/contactos, productos/logs y facturas para revisión humana exacta. Una factura registra un comprobante y no acredita un pago; un log es un snapshot de producto, no una venta. Esta ficha explica la ampliación interna de [AI-22](../../../../mvp/68-nodia-ai-ai22-business-operations.md). Sigue excluida de publicación y no cambia las siete fichas de lectura aprobadas del [producto](../README.md).

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención | Ambigüedad o mínimo faltante | Aclaración esperada |
|---|---|---|---|
| «Agrega este número al proveedor» | Crear o editar un contacto | Negocio, proveedor, persona y teléfono concretos | Resolver cada entidad; el teléfono pertenece al contacto, no al JSON libre del proveedor |
| «Actualiza el precio de ese producto» | Corregir producto y crear su log nativo | Producto, campo e importe | Preguntar si es costo, costo con impuesto o venta; no inferir los otros importes |
| «Registra esta factura sin archivo» | Crear metadatos de factura | Negocio y código obligatorios | Pedir lo mínimo; mostrar total cero y otros defaults si no se aportan |
| «Mueve esta factura a otro negocio» | Cambiar negocio y proveedor compatible | Destino y archivo ya asociado | Si tiene archivo, requiere seleccionar un nuevo adjunto para la copia independiente; traslado automático del archivo legacy continúa pendiente |
| «Borra ese proveedor» | Solicitud sin DELETE nativo | Puede significar desactivación | Aclarar y proponer actividad cuando corresponda, sin inventar borrado físico |

Son intenciones ilustrativas. Registrar estos puertos no acredita que Gemini ya pueda prepararlas mediante MCP.

## Operaciones y contratos

| Operación | Preparador interno | Writer nativo | Resultado |
|---|---|---|---|
| Crear/editar negocio | `nodia_businesses_prepare_create`, `_update` | `CreateBusinessUseCase`, `UpdateBusinessUseCase` | Negocio y traducciones en un commit |
| Gestionar colaboradores | `nodia_businesses_prepare_set_collaborators` | `AssignBusinessCollaboratorsUseCase` | Asociaciones según semántica nativa |
| Crear/editar producto | `nodia_products_prepare_create`, `_update` | `CreateProductUseCase`, `UpdateProductUseCase` | Producto y snapshot de log atómicos |
| Crear/editar log | `nodia_product_logs_prepare_create`, `_update` | `CreateProductLogUseCase`, `UpdateProductLogUseCase` | Snapshot explícito, UUID propio |
| Crear/editar proveedor | `nodia_providers_prepare_create`, `_update` | `CreateProviderUseCase`, `UpdateProviderUseCase` | Proveedor comercial del negocio |
| Crear/editar/activar contacto | `nodia_provider_contacts_prepare_create`, `_update`, `_set_active` | `CreateProviderContactUseCase`, `UpdateProviderContactUseCase` | Contacto versionado; horario y teléfonos propios |
| Crear/editar factura | `nodia_invoices_prepare_create`, `_update` | `CreateInvoiceUseCase`, `UpdateInvoiceUseCase` | Metadatos SQL; no upload nuevo del chat |

Los sufijos abreviados sustituyen el sufijo del nombre completo de la fila. Son catorce registros internos, sin publicación MCP. Aliases HTTP no agregan operaciones. Los siete bulk/import y DELETE ausentes siguen excluidos.

## Datos mínimos y resolución de dudas

| Concepto | Mínimo o condición | Fuente y resolución |
|---|---|---|
| Negocio | Nombre al crear; negocio objetivo para editar/colaboradores | [CreateBusinessDto](../../../../../nodia-server/src/business/dto/create-business.dto.ts) y [factory](../../../../../nodia-server/src/nodia-ai-business-catalog/use-case/build-nodia-ai-business-catalog-operations.use-case.ts); dueño procede del actor, no del modelo |
| Producto/log | Código, nombre, importes/porcentaje obligatorios; producto para log | [DTOs de producto](../../../../../nodia-server/src/product/dto/create-product.dto.ts) y [log](../../../../../nodia-server/src/product/dto/create-product-log.dto.ts); stock cero sólo como default nativo visible |
| Proveedor/contacto | Negocio/proveedor y nombre según operación | [Factory](../../../../../nodia-server/src/nodia-ai-supplier-operations/use-case/build-nodia-ai-supplier-operations.use-case.ts); teléfono/email/horario son opcionales cuando el contrato lo permite |
| Factura | Negocio y código; proveedor opcional | [CreateInvoiceDto](../../../../../nodia-server/src/invoice/dto/create-invoice.dto.ts); total entero 0..2147483647, data objeto estricto; no convertir datos inválidos a defaults |
| Update | Objetivo y al menos un cambio real | Campos omitidos conservados; no inicializar defaults de creación después de revisar |

Resolver IDs ambiguos antes de la preview. Origen, objetivo, clave de intención y versión no se cambian silenciosamente al responder una aclaración. Pedir sólo mínimos/condicionales reales; el modelo no completa importes dudosos ni inventa disponibilidad de R2.

## Reglas, acceso y restricciones

Usuarios ordinarios necesitan NodiaAI y `/tools/business` asignados. Negocio y colaboradores conservan autoridad de dueño/super_admin; los recursos comerciales mantienen el acceso global autenticado intencional de19. Las asociaciones deben ser coherentes con el negocio efectivo aunque el actor tenga acceso global. Inspeccionar el chat de otra persona no permite ejecutar como ella. Ver [autoridad54](../../../../mvp/54-nodia-ai-ai08-transversal-authority.md).

Contactos conserva request_key/version y reemplazos de colecciones nativos. Cambios de producto incluyen su log; no actualizar stock como si fuera una recepción o una venta que el modelo no tiene. Los números conservan cero y representación exacta; no se añaden valores por coerción. No hay SQL, HTTP arbitrario, credenciales, claves privadas de almacenamiento o URLs firmadas en el contexto público.

## Filtros e informes

AI-22 no agrega un motor de informes ni medidas nuevas. Las doce lecturas SQL, tres referencias privadas y elegibilidad OCR mantienen [AI-15](../../../../mvp/61-nodia-ai-ai15-product-reads.md) y las fichas [productos](products.md), [logs](product-logs.md), [proveedores](suppliers.md), [facturas](invoices-and-files.md). Listados siguen limitados/paginados; CSV se regenera al descargar. Total facturado no se etiqueta como dinero pagado. Informes combinables/cross-product mantienen AI-30/31 y procedencias separadas.

## Vista previa, confirmación y recuperación

Una propuesta congela comando, objetivo, negocio de origen/destino, referencias y snapshot material. Se muestran cambios antes/después y efectos derivados. Editar genera revisión/hash nuevos y requiere el botón humano exacto. Los writers y recibo comparten EntityManager y commit; un cambio material invalida la propuesta. [AI-20](../../../../mvp/66-nodia-ai-ai20-execution-recovery.md) recupera el witness sin reejecutar; un rollback local probado permite resume humano con la identidad original. Cancelar no revierte lo ya comprometido. Secuencias dependientes esperan AI-23.

Facturas AI-22 crea sin archivo nuevo o conserva el actual al editar; sólo expone `file_attached`. No acepta clave/URL del modelo ni referencia prestada. AI-32 incorpora nuevos adjuntos/promoción; R02 incorpora traslado con copia recuperable y binding negocio/clave descrito al final de esta ficha. El POST nativo conserva intent antes de PUT, I/O fuera de SQL y cleanup de [ADR-026](../../../../architecture/decisions/ADR-026-invoice-upload-recovery.md); eso no deduplica una intención conversacional. Las referencias AI-15 se reautorizan al descargar; R2 binario real sigue pendiente, sin éxito ficticio cuando falta configuración.

## Integración y evidencia

- [x] Fuentes, mínimos y límites de archivos contrastados; aprobación pendiente explícita.
- [x] Registros internos y proyecciones implementados; no publicación MCP.
- [ ] Evidencia final de las catorce operaciones SQL/HTTP/worker consolidada en68.
- [ ] Aceptación de preparación por Gemini y publicación específica.
- [x] Nuevo upload/promoción AI-32 y traslado legacy R02, verificados con SQL real y almacenamiento sintético.
- [ ] R2 binario real verificado.

Las pruebas de unidad usan datos y dependencias sintéticas; no se ejecuta OCR/R2 real. La evidencia final de la etapa distinguirá transacción PostgreSQL, QA del cliente y laboratorio de inferencia/productividad. Expirar un chat elimina su recibo/referencia, no los datos/archivos de negocio.

## Evolución y compatibilidad

| Revisión | Cambio y fuentes | Contexto/compatibilidad |
|---|---|---|
| 1 | AI-22: catorce puertos individuales y límite explícito de archivos | Nueva ficha draft excluida; conserva las siete lecturas aprobadas sin modificar sus cuerpos. Cambios materiales de contratos invalidan propuestas incompatibles; no amplían publicación por sí solos. |

AI-32: [adjuntos y promoción](../../../../mvp/78-nodia-ai-ai32-attachments-voice.md). attachment_id es referencia opaca del mismo chat; la vista previa incluye nombre, MIME, bytes y digest del contenido validado, nunca key/URL. Confirmar autoriza copiar a una key de dominio independiente con plazo/fence; factura, asociación e intención consumida y recibo se guardan juntos. Fallo SQL o PUT incierto conserva compensación; resume humano genera otra key y no reenvía la generación incierta. Purga del chat no elimina el archivo de factura. R2 real y MCP de escrituras mantienen sus gates; el traslado legacy se implementa en R02.


R02: `destination_business_id` indica destino de update; el origen es inmutable y create rechaza el alias. Sin adjunto nuevo, preview indica `file_preserved` y cambio de negocio. La identidad/key privada y metadata SQL se congelan, pero no se inventa un digest/tamaño/nombre legacy. Tras confirmar se lee con límite10 MiB, se valida MIME/firma y se observa SHA/tamaño reales; copia a key destino por paso/fence fuera de SQL. Descriptor legacy v2 convive con v1 de adjuntos nuevos; asociación, recibo e intención consumida comparten commit. El origen se conserva hasta commit y se retiene si otra factura lo usa. PUT incierto requiere conciliación/resume humano, sin repetirlo automáticamente. No hay versión/ETag legacy para detectar sobrescritura externa bajo la misma key; los escritores funcionales usan keys nuevas. Evidencia33+58+44 checks en [entrega78](../../../../mvp/78-nodia-ai-ai32-attachments-voice.md#revalidación-ai-32-r02--formatos-de-audio-y-traslado-legacy). Sin publicación MCP ni R2 real por documentarlo.


## Revalidación AI-32-R06

Purga por generación y copias de factura verificadas con R2 real, casos de uso compilados y SQL desechable; la copia de factura sobrevive a la expiración del chat. Reemplazo con contenido distinto, traslado legacy, rollback y recuperación conservan sus contratos. No se equipara esta prueba con publicación MCP o aceptación productiva. [Entrega R06](../../../../mvp/78-nodia-ai-ai32-attachments-voice.md#revalidación-ai-32-r06--purga-y-copias-de-factura-con-r2-real) mantiene evidencia y límites. Ficha draft/unregistered y approval null conservados.

## Negocios: preparaciones publicadas en AI36-C05

Este fragmento añade sólo estas preparaciones publicadas:

- `nodia_businesses_prepare_create`
- `nodia_businesses_prepare_set_collaborators`
- `nodia_businesses_prepare_update`
- `nodia_invoices_prepare_create`
- `nodia_invoices_prepare_update`
- `nodia_product_logs_prepare_create`
- `nodia_product_logs_prepare_update`
- `nodia_products_prepare_create`
- `nodia_products_prepare_update`
- `nodia_provider_contacts_prepare_create`
- `nodia_provider_contacts_prepare_set_active`
- `nodia_provider_contacts_prepare_update`
- `nodia_providers_prepare_create`
- `nodia_providers_prepare_update`

Cada herramienta recibe un partial cerrado, devuelve mínimos faltantes o propuesta revisable y permite continuar sólo con draft_id/revisión CAS exactos. No aplica el cambio de dominio. Consulta las referencias reales; nunca inventes IDs o enlaces. Sólo el botón humano sobre revisión/hash exactos admite la ejecución y su recibo nativo. No se aceptan SQL, comandos arbitrarios, secretos ni bulk/importación. No existe borrado físico de negocios, productos, logs, proveedores, contactos o facturas en estos preparadores. Actividad y set_active conservan su semántica; no simular DELETE. Archivos de factura sólo usan referencias acreditadas y el protocolo de adjuntos existente.

El backend exige NodiaAI y cada módulo/acción de destino vigentes, reautoriza al ejecutar y conserva recuperación/idempotencia. Publicación, selección del intento, disponibilidad, despliegue y aceptación real son estados distintos. Los apartados anteriores son históricos y no amplían este lote.
