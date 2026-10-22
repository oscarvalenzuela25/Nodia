---
{
  "schema_version": 1,
  "document_id": "businesses",
  "product_id": "businesses",
  "kind": "product",
  "revision": 6,
  "document_status": "draft",
  "implementation": {
    "status": "partial",
    "notes": "16 capacidades de lectura/referencia publicadas: doce SQL, elegibilidad externa y tres referencias privadas de archivos/CSV. Siete fichas funcionales publican sólo sus secciones de lectura. La descarga binaria positiva R2 permanece pendiente; escrituras y análisis de factura siguen sus etapas. AI-22 incorpora catorce puertos internos individuales de Negocios con manager compartido y recibos de operación; preparación MCP sin publicar. Nuevo upload/promoción de adjuntos y traslado de facturas con archivo esperan AI-32; R2 binario real mantiene su gate. La verificación final de las catorce operaciones se consolida en68. AI36-C03 añade un candidato de análisis de factura en la generación Agentic activa, con parser nativo puro, origen acreditado y resultado revisable; sin publicación ni creación comercial."
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento de Negocios y NodiaAI conforme AGENTS",
  "sources": [
    {
      "path": "docs/features/businesses/01-prd.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/19-prelaunch-review.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/31-provider-contacts-proposal.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/nodia-ai-products/business/use-case/read-nodia-ai-business.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "docs/mvp/68-nodia-ai-ai22-business-operations.md",
      "kind": "specification"
    }
  ],
  "verification": {
    "checked_on": "2026-10-18",
    "evidence_paths": [
      "docs/mvp/51-nodia-ai-ai05-product-knowledge.md",
      "docs/evidence/nodia-ai-ai05-knowledge-validation.json",
      "docs/evidence/nodia-ai-ai15-postgres-integration.json",
      "docs/evidence/nodia-ai-ai15-live-local.json",
      "docs/evidence/nodia-ai-ai15-live-artifacts.json",
      "docs/evidence/nodia-ai-ai15-live-routing-interrupted.json",
      "docs/evidence/nodia-ai-ai15-live-external-final.json",
      "docs/mvp/68-nodia-ai-ai22-business-operations.md",
      "docs/evidence/nodia-ai-ai36-c03-validation.json"
    ],
    "notes": "Índice actualizado según el registro de 67 capacidades y 27 bindings funcionales. Esta ficha de producto conserva document_status:draft, integration_status:unregistered y approval:null; su actualización no aprueba el resumen ni lo publica. La evidencia real separa SQL/CSV positivos, factura R2 no configurado y resultados externos/Web parciales con unknown sin replay. No se certifica cada llamada del modelo ni despliegue productivo completo. AI-22 contrasta fuentes, puertos y límites de archivos; la evidencia final transversal queda pendiente de consolidar en68. Actualizar este borrador no modifica los siete cuerpos aprobados de lectura de Negocios ni publica escrituras."
  },
  "approval": null
}
---

# Negocios — contexto de producto para NodiaAI

Metadatos canónicos migrados en [AI-06](../../../mvp/52-nodia-ai-ai06-knowledge-publication-contract.md); este resumen conserva aprobación pendiente y no se publica; las secciones funcionales de lectura publicadas se identifican debajo.

## Propósito y alcance

Gestionar negocios, proveedores comerciales, sus contactos, productos, historial de precios y facturas. El proveedor comercial no es una conexión de IA y una factura no es un pago.

El alcance confirmado comprende consultas y CRUD individual donde exista endpoint, con aclaraciones/vista previa y confirmación. Las fichas describen el backend actual y señalan ampliaciones pendientes; ninguna crea herramientas o permisos.

## Conceptos y relaciones

| Concepto | Significado y relación |
|---|---|
| Negocio | Agrupa catálogo y facturas; identidad UUID y dueño asignado por Server. |
| Proveedor comercial / contacto | Proveedor bigint ligado a negocio; contactos independientes con horario propio. |
| Producto / log | Producto bigint con precios actuales; log UUID como snapshot registrado, no venta ni movimiento de caja. |
| Factura / extracción | Factura persistida con importe registrado y archivo opcional; extracción IA es propuesta de datos aún sin guardar. |

## Módulos y autoridad

Destino /tools/business. Server restringe editar negocio y colaboradores a dueño o super_admin; listado normal usa pertenencia y all_businesses requiere super_admin. El acceso global autenticado a productos/proveedores/facturas/archivos es intencional conforme19, no el RBAC granular del PRD inicial. NodiaAI añade módulo propio y destino para ordinarios (AI-07), sin inventar permisos por acción ni usar alcance global para romper asociaciones.

Rutas de destino trazadas al inventario/catálogo: `/tools/business`. Resolver sus IDs reales desde Server; la inspección no consulta asignaciones de la BD del usuario. Credenciales/cookies no se incorporan al contexto. Web sólo conversa y Agentic usa MCP conforme [política48](../../../mvp/48-nodia-ai-mode-routing-policy.md); disponibilidad exige evidencia del adaptador exacto.

## Índice de funcionalidades

| Función | Ficha | Implementación | Integración NodiaAI | Destino |
|---|---|---|---|---|
| Negocios y colaboradores | [businesses-and-collaborators](features/businesses-and-collaborators.md) | Backend existente/parcial; gates en ficha | Sólo lecturas AI-15 publicadas; resto pendiente | `/tools/business` |
| Proveedores comerciales | [suppliers](features/suppliers.md) | Backend existente/parcial; gates en ficha | Sólo lecturas AI-15 publicadas; resto pendiente | `/tools/business` |
| Contactos de proveedores | [supplier-contacts](features/supplier-contacts.md) | Backend existente/parcial; gates en ficha | Sólo lecturas AI-15 publicadas; resto pendiente | `/tools/business` |
| Productos | [products](features/products.md) | Backend existente/parcial; gates en ficha | Sólo lecturas AI-15 publicadas; resto pendiente | `/tools/business` |
| Historial de productos | [product-logs](features/product-logs.md) | Backend existente/parcial; gates en ficha | Sólo lecturas AI-15 publicadas; resto pendiente | `/tools/business` |
| Facturas y archivos | [invoices-and-files](features/invoices-and-files.md) | Backend existente/parcial; gates en ficha | Sólo lecturas AI-15 publicadas; resto pendiente | `/tools/business` |
| Efectos confirmados AI-22 | [confirmed-business-effects](features/confirmed-business-effects.md) | Catorce puertos internos; verificación final pendiente en68 | Draft/unregistered, sin publicación MCP | `/tools/business` |
| Análisis de facturas | [invoice-analysis](features/invoice-analysis.md) | Backend existente/parcial; gates en ficha | Sólo lecturas AI-15 publicadas; resto pendiente | `/tools/business` |

## Interpretación de solicitudes que combinan funciones

«Agrega este número al proveedor» debe resolver negocio, proveedor y contacto; el teléfono pertenece al contacto, no a fields del proveedor. «Cuánto gasté» requiere aclarar si significa total de facturas registradas o dinero pagado: este producto no tiene ledger de pagos y Finanzas no tiene provider_id.

Informes cruzados requieren medidas compatibles y procedencia separada según41; no deducir relaciones sólo porque dos productos usan la palabra gasto/proveedor. Pasos dependientes conservan resultados y se recuperan sin duplicarlos; el modelo no confirma ni ejecuta SQL libre.

## Restricciones y pendientes

PRD inicial es borrador histórico: delivery_cost, prorrateo, analítica global y matching automático no se publican como capacidades existentes. Bulk/import7 excluidos de NodiaAI v1, aunque la app los tenga. AI-22 incorpora manager compartido para producto+log y escritores individuales; las secuencias dependientes conservan AI-23 y los informes combinables AI-30/31. Nuevos adjuntos/promoción y traslado de facturas con archivo esperan AI-32; R2 binario real mantiene su gate.

Publicación de conocimiento, proyecciones y autoridad depende de AI-06/07/08/12 y de la familia de herramientas. Markdown explica, no habilita. No se cargan estos borradores automáticamente al proveedor. Política50 elimina contenido del chat y registros técnicos resueltos sin borrar dominio/preferencias aceptadas.

## Evolución y trazabilidad

| Revisión | Cambio funcional y fuentes | Impacto |
|---|---|---|
| 1 | AI-05: 7 fichas funcionales desde especificaciones/backend e inventario39 | [Cobertura/diferencias/gates](../../../mvp/51-nodia-ai-ai05-product-knowledge.md); sin migraciones/runtime/publicación ni aprobación automática |

## Lecturas locales AI-15

La [entrega AI-15](../../../mvp/61-nodia-ai-ai15-product-reads.md) implementa doce puertos locales de lectura para Negocios, con contratos cerrados y casos de uso compartidos bajo el manager del checkpoint. La familia de lecturas forma parte del release explícito publicado; este resumen de producto sigue excluido y no concede permisos por sí mismo. Los listados admiten páginas de hasta 100 filas, actividad inicial activa donde existe ese campo y selección explícita de inactivos o todos. No se permite `all:true`, SQL libre ni filtros derivados del ORM.

El negocio conserva pertenencia de dueño/colaborador activo y alcance global explícito de super_admin; los resultados recuperados de listados vuelven a verificar pertenencia. Productos, proveedores comerciales y facturas conservan su acceso global autenticado intencional, además del permiso NodiaAI y módulo destino. Las proyecciones excluyen relaciones de usuarios, claves de almacenamiento, JSON arbitrario e idempotencia interna.

Las cuatro capacidades adicionales están implementadas/publicadas: elegibilidad OCR externa y tres referencias privadas de archivo/CSV. El I/O ocurre fuera de SQL y las descargas reautorizan chat/recurso. Dos CSV tuvieron GET positivo real; la referencia de factura se verificó con GET503 por R2 no configurado. invoice_binary_download_r2_real permanece pendiente; no se afirma contenido binario descargado ni se crean enlaces firmados u objetos nuevos.

Los cinco listados de Negocios usan el ID como desempate cuando otro campo define el orden, preservando una ordenación explícita por ID. La integración verifica páginas disjuntas con fechas idénticas tanto en UUID como bigint; esto estabiliza el paginado sin convertirlo en una instantánea entre páginas.


## Publicación de lecturas AI-15 — estado actual

16 capacidades de lectura/referencia publicadas: doce SQL, elegibilidad externa y tres referencias privadas de archivos/CSV. Siete fichas funcionales publican sólo sus secciones de lectura. La descarga binaria positiva R2 permanece pendiente; escrituras y análisis de factura siguen sus etapas.

El corpus incorpora46 fichas:27 funcionalidades approved/published ligadas a67 contratos read/read_artifact y19 fichas draft/unregistered excluidas. La nueva ficha de efectos confirmados de Negocios está excluida; no modifica los cuerpos de las siete fichas aprobadas de lectura de ese producto. No hay escrituras publicadas. La [autorización específica](../../../evidence/nodia-ai-ai15-publication-authorization.md) alcanza esas secciones funcionales, no este resumen. Los estados del índice describen el alcance publicado de lectura de cada función y no todo su CRUD.

[AI-15](../../../mvp/61-nodia-ai-ai15-product-reads.md) distingue diez comprobaciones SQL con Gemini real y doce de referencias/CSV, observaciones externas con recibos positivos y final incierto, y routing Web parcial. R2 sin configurar no se transforma en descarga verificada; unknown no se reenvía. Los contratos se publican con permisos y límites actuales, sin prometer que todo turno del modelo termine correctamente. Sin cambios visuales ni nuevos bindings de resumen.


## Efectos individuales AI-22

[Entrega68](../../../mvp/68-nodia-ai-ai22-business-operations.md) y [ficha](features/confirmed-business-effects.md) incorporan catorce registros internos sobre escritores nativos con transacción/recibo compartidos. Preparadores MCP sin publicar; una operación por propuesta. La lectura global autenticada no sustituye integridad de relaciones. Contactos conserva request_key/version; producto incluye su snapshot. Facturas permite metadatos sin nuevo upload; preserva su archivo al editar y rechaza trasladarlo a otro negocio hasta tener copia recuperable. Referencias privadas/CSV de AI-15 se conservan; no se declara paridad completa de archivos ni descarga binaria R2 real.


## AI36-C03 — análisis de factura en generación activa

La [ficha de análisis activo](features/active-invoice-analysis.md) detalla el candidato MCP de dos fases y sus límites. Reutiliza el parser nativo, acredita el adjunto original del turno y conserva una extracción pendiente de revisión. No inicia OCR anidado ni crea registros comerciales. [Entrega82](../../../mvp/82-nodia-ai-ai36-integral-coverage.md) conserva la separación entre implementación, pruebas, publicación y aceptación real.
