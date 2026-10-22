---
{
  "schema_version": 1,
  "document_id": "businesses.products",
  "product_id": "businesses",
  "kind": "feature",
  "revision": 5,
  "document_status": "approved",
  "implementation": {
    "status": "partial",
    "notes": "Publicación AI-15 de las lecturas/referencias expresamente enumeradas mediante contratos cerrados y reglas nativas. Las escrituras y otras etapas del producto no se habilitan. La disponibilidad de cada dependencia se observa por separado; no se promete éxito de toda inferencia ni acceso a contenido R2 no configurado."
  },
  "integration_status": "published",
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
      "path": "nodia-server/src/product/entities/product.entity.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/product/product.service.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-products/business/use-case/read-nodia-ai-business.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-products/artifacts/artifacts.family.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-products/artifacts/use-case/execute-nodia-ai-artifact.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-products/artifacts/use-case/download-nodia-ai-artifact.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-products/contracts/artifacts.schema.json",
      "kind": "implementation"
    }
  ],
  "verification": {
    "checked_on": "2026-10-16",
    "evidence_paths": [
      "docs/mvp/51-nodia-ai-ai05-product-knowledge.md",
      "docs/evidence/nodia-ai-ai05-knowledge-validation.json",
      "docs/evidence/nodia-ai-ai15-postgres-integration.json",
      "docs/evidence/nodia-ai-ai15-artifacts-integration.json",
      "docs/evidence/nodia-ai-ai15-external-validation.json",
      "docs/evidence/nodia-ai-ai15-live-local.json",
      "docs/evidence/nodia-ai-ai15-live-artifacts.json",
      "docs/evidence/nodia-ai-ai15-live-routing-interrupted.json",
      "docs/evidence/nodia-ai-ai15-live-external-final.json",
      "docs/evidence/nodia-ai-ai15-live-quota-gateway-final.json",
      "docs/evidence/nodia-ai-ai15-live-codex-root-postfix.json"
    ],
    "notes": "Gemini Agentic real completó un turno de cinco familias SQL (10 comprobaciones) y otro de tres referencias (12): dos CSV autenticados correctos; factura devuelve 503 por R2 sin configurar. La emisión de referencia no certifica bytes disponibles. Routing real completó Web conversacional y delegación opt-in SQL; el siguiente turno Web quedó unknown/502 y se concilió sin replay. El ensayo externo final completó recibos health/engines y luego quedó unknown; no se registra como aceptación generativa completa. La regresión Gateway de las cinco salidas usa observaciones sintéticas y cero inferencias. Los fallos permanecen en sus informes, sin atribuirlos a causa no observada. Las demás lecturas conservan su evidencia aislada SQL/HTTP; publicar no garantiza que el modelo siempre construya llamadas válidas."
  },
  "approval": {
    "reference": "docs/evidence/nodia-ai-ai15-publication-authorization.md",
    "revision": 5,
    "content_sha256": "652f13e33e16c24dd265c18ee438fe6bc1e6584da53fae285e16fca81392ba6c"
  }
}
---

# Productos — contexto funcional para NodiaAI

Estado actual: esta revisión publica sólo el fragmento «Lecturas disponibles en AI-15». Las secciones de implementación/evidencia anteriores a ese fragmento conservan la trazabilidad de entregas iniciales; sus frases históricas sobre publicación pendiente no sustituyen el frontmatter actual ni habilitan escrituras.

[Producto](../README.md). Metadatos canónicos migrados en [AI-06](../../../../mvp/52-nodia-ai-ai06-knowledge-publication-contract.md); esta revisión tiene autorización específica de publicación para las lecturas enumeradas al final; las demás operaciones conservan sus gates.

## Qué resuelve y qué significa

Mantener código, nombre, precios enteros, margen y stock del catálogo. No es un registro de ventas ni caja.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención y aclaración esperada |
|---|---|
| «Muéstrame los productos de X» | Resolver proveedor y alcance; usar filtro tipado y paginar. |
| «Cambia el precio a…» | Aclarar costo neto, con impuesto o venta; no cambiar todos. |
| «Crea100 productos desde CSV» | Bulk/import fuera de v1; explicar excepción. |

Ejemplos ilustrativos sin resultados ni identificadores reales. Preguntar sólo obligatorios y ambigüedades; los opcionales no bloquean salvo condición del dominio.

## Operaciones y contratos

| Handler y ruta de referencia | Candidato del catálogo40 | Tratamiento vigente |
|---|---|---|
| [ProductController.findAll](../../../../../nodia-server/src/product/product.controller.ts)<br>`GET /api/v1/product` | `nodia_products_list` (read, candidato40) | Publicado en el release AI-15 de lecturas; disponibilidad observada por separado |
| [ProductController.createBulk](../../../../../nodia-server/src/product/product.controller.ts)<br>`POST /api/v1/product/bulk` | Sin herramienta del modelo | Excluida de v1 |
| [ProductController.updateBulk](../../../../../nodia-server/src/product/product.controller.ts)<br>`PUT /api/v1/product/bulk` | Sin herramienta del modelo | Excluida de v1 |
| [ProductController.exportCsv](../../../../../nodia-server/src/product/product.controller.ts)<br>`GET /api/v1/product/export-csv` | `nodia_products_export_csv` (read_artifact, candidato40) | Publicado en el release AI-15 de lecturas; disponibilidad observada por separado |
| [ProductController.findOne](../../../../../nodia-server/src/product/product.controller.ts)<br>`GET /api/v1/product/:id` | `nodia_products_get` (read, candidato40) | Publicado en el release AI-15 de lecturas; disponibilidad observada por separado |
| [ProductController.create](../../../../../nodia-server/src/product/product.controller.ts)<br>`POST /api/v1/product` | `nodia_products_prepare_create` (prepare_change, candidato40) | Candidato; sin publicar |
| [ProductController.update](../../../../../nodia-server/src/product/product.controller.ts)<br>`PUT /api/v1/product/:id` | `nodia_products_prepare_update` (prepare_change, candidato40) | Candidato; sin publicar |

Los aliases de [inventario39](../../../../mvp/nodia-ai-current-endpoints.json) no crean capacidades distintas. Los nombres de operaciones proceden del catálogo documentado en [catálogo40](../../../../mvp/40-nodia-ai-tool-catalog-v1.md): sólo las lecturas enumeradas en esta revisión tienen binding explícito de publicación; las escrituras continúan candidatas.

DTOs de entrada/filtros: [get-products.dto.ts](../../../../../nodia-server/src/product/dto/get-products.dto.ts), [bulk-create-product.dto.ts](../../../../../nodia-server/src/product/dto/bulk-create-product.dto.ts), [bulk-update-product.dto.ts](../../../../../nodia-server/src/product/dto/bulk-update-product.dto.ts), [export-products-csv.dto.ts](../../../../../nodia-server/src/product/dto/export-products-csv.dto.ts), [create-product.dto.ts](../../../../../nodia-server/src/product/dto/create-product.dto.ts), [update-product.dto.ts](../../../../../nodia-server/src/product/dto/update-product.dto.ts)

Delegación actual (casos de uso/servicios según controlador): [get-all-products.use-case.ts](../../../../../nodia-server/src/product/use-case/get-all-products.use-case.ts), [create-bulk-products.use-case.ts](../../../../../nodia-server/src/product/use-case/create-bulk-products.use-case.ts), [update-bulk-products.use-case.ts](../../../../../nodia-server/src/product/use-case/update-bulk-products.use-case.ts), [export-products-csv.use-case.ts](../../../../../nodia-server/src/product/use-case/export-products-csv.use-case.ts), [get-product-by-id.use-case.ts](../../../../../nodia-server/src/product/use-case/get-product-by-id.use-case.ts), [create-product.use-case.ts](../../../../../nodia-server/src/product/use-case/create-product.use-case.ts), [update-product.use-case.ts](../../../../../nodia-server/src/product/use-case/update-product.use-case.ts)

## Datos mínimos y resolución de dudas

| Dato/operación | Obligatorio, condicional u opcional; resolución |
|---|---|
| Crear | business_id UUID, code, name, cost_price, cost_price_tax, profit_percentage y sale_price enteros; provider_id opcional, stock default0 y actividad opcional. |
| Editar | ID bigint string y sólo campos pedidos; resolver proveedor y negocio coherentes. Cero stock no es desconocido. |

Actor, permisos efectivos, claves de intención, versiones de concurrencia y referencias internas los controla Server; no los inventa ni decide el modelo. DTOs enlazados son fuente de campos, no un JSON Schema estricto de herramienta ya publicado.

## Reglas, acceso y restricciones

Unicidad de code por negocio. No inventar precios/margen a partir del nombre; si faltan, preguntar o usar sólo una derivación publicada/verificada. create/update registran snapshot posterior en product_logs mediante saves separados; no garantizar atomicidad actual. Sin DELETE. Dos bulk excluidos.

Destino /tools/business. Server restringe editar negocio y colaboradores a dueño o super_admin; listado normal usa pertenencia y all_businesses requiere super_admin. El acceso global autenticado a productos/proveedores/facturas/archivos es intencional conforme19, no el RBAC granular del PRD inicial. NodiaAI añade módulo propio y destino para ordinarios (AI-07), sin inventar permisos por acción ni usar alcance global para romper asociaciones.

## Filtros e informes

Ransack permitido por código/nombre/precios/stock/negocio/proveedor/actividad; CSV artefacto. stock×precio estimaría inventario, no gasto real; totales globales no se deducen de una página.

El nuevo registro combinable de [contratos41](../../../../mvp/41-nodia-ai-v1-contracts.md) sigue pendiente AI-30/31; filtros REST existentes no autorizan joins, campos o SQL libres. [Política50](../../../../mvp/50-nodia-ai-ai04-runtime-policy.md) acota trabajo del chat y no reemplaza silenciosamente límites del módulo.

## Vista previa, confirmación y recuperación

Preview de campos finales y snapshot esperado. AI-22 debe compartir transacción producto+log y witness/idempotencia; no repetir update tras timeout creyendo que no pasó. Export no confirma importación ni crea productos.

Desde NodiaAI, preparar es distinto de ejecutar: cambios requieren vista previa exacta y botón humano de41; el switch Web→Agentic no confirma. Conservar efectos completados si falla un paso dependiente y no reenviar un resultado desconocido. Payload del chat caduca según50 sin borrar registros de dominio ni sus journals nativos.

## Integración y evidencia

- [x] Fuentes de producto/backend, diferencias y mínimos revisados estáticamente en AI-05.
- [x] Correspondencia de handlers/candidatos y enlaces comprobada offline; no prueba de autorización/efectos.
- [ ] Schema de herramienta/proyección, autoridad y contexto registrados con AI-06/07 y familia pertinente.
- [ ] Casos de uso reales de acceso/ambigüedad, confirmación, concurrencia y recuperación verificados para NodiaAI.
- [ ] Adaptador/modalidades, publicación y aceptación operativa comprobados.

Pendientes con efecto sobre disponibilidad: AI-14/22/31: atomicidad, proyección monetaria e informes antes de publicar.

## Evolución y compatibilidad

| Revisión | Cambio y fuentes | Contexto y propuestas |
|---|---|---|
| 1 | AI-05: explicación inicial a partir de contratos/código enlazados | Sin cambio de backend ni publicación. Al cambiar reglas/DTOs, actualizar ficha/schema/registro, invalidar propuestas incompatibles y mantener recuperación original |

## Historial de implementación local AI-15

`nodia_products_get/list` están implementados como puertos locales con [schemas cerrados](../../../../../nodia-server/src/nodia-ai-products/contracts/business.schema.json), sin publicación real. Usan los casos de uso y filtros permitidos del dominio bajo el checkpoint; bigint permanece string y cero stock/precio conserva su valor. La proyección incluye IDs de negocio/proveedor, código, nombre, precios, margen, stock, actividad y fechas; no serializa relaciones ORM. Los filtros de stock admiten las claves nativas `out`, `low`, `normal`; variación de precio conserva `increased`, `decreased`, `unchanged`. Actividad inicial activa, selección explícita de inactivos/todos y paginado máximo 100.

`nodia_products_export_csv` implementa una referencia privada regenerable, con [contrato cerrado](../../../../../nodia-server/src/nodia-ai-products/contracts/artifacts.schema.json), sin publicar. El modelo recibe sólo referencia UUID, nombre, MIME y semántica `current_on_download`: el CSV se genera con los registros actuales cuando la persona descarga por `GET /api/v1/nodia-ai/artifacts/:reference`; no es un snapshot del momento del mensaje. La descarga exige sesión, chat propio o inspección de super_admin, módulo de destino y autorización nativa vigentes, antes y después de materializar. El exportador nativo admite internamente el máximo de filas de política50 —100 actualmente—, consulta SQL con una fila de sondeo y rechaza exceso sin truncar; el límite de archivo también proviene de política50. Conserva ceros, inactivos y columnas nativas, y neutraliza fórmulas CSV. No se incorpora CSV completo, URL ni clave de almacenamiento al prompt.

La referencia se sostiene únicamente en el recibo existente de la llamada: la expiración o purga del chat invalida su descarga sin crear objetos, temporales ni auditoría adicional. La cancelación descarta el buffer y no borra productos. [24 comprobaciones compiladas con HTTP/PostgreSQL desechable y almacenamiento sintético](../../../../evidence/nodia-ai-ai15-artifacts-integration.json) cubren regeneración, 101 filas, permisos y purga; [casos de uso](../../../../../nodia-server/src/product/use-case/export-products-csv.use-case.spec.ts) cubren fórmula, bytes y cancelación. Publicación, controles visuales de descarga y Gemini real permanecen diferenciados. Ver [AI-15](../../../../mvp/61-nodia-ai-ai15-product-reads.md).


## Lecturas disponibles en AI-15

Solicitar referencia privada de exportación CSV. Se genera con datos vigentes al descargar, no un snapshot histórico; límites de filas/bytes se verifican sin truncar.

Consultar productos por sus filtros publicados y devolver identificadores/precios exactos. Stock o valor de inventario no equivalen a compras ni a gastos.

Herramientas de esta sección: `nodia_products_export_csv`, `nodia_products_get`, `nodia_products_list`.

Resolver entidades, destinatario, intervalo y filtros ambiguos antes de llamar. Usar sólo los campos del schema de la herramienta. Conservar IDs y dinero exactos, cero y falso; ausencia o unknown no equivalen a cero. La paginación y los límites de resultados deben comunicarse y una página no representa el universo completo. En recursos con actividad, iniciar Activo y usar Inactivo/Todos sólo cuando se soliciten; Todos omite el filtro.

Server valida sesión, módulo NodiaAI y todos los módulos destino actuales para usuarios ordinarios; super_admin conserva transversalidad y las reglas de dominio. Datos privados y autoridad se revalidan al devolver o recuperar resultados. Finanzas permite owner_id ajeno sólo a super_admin; Reservas conserva autoridad actual del alojamiento; administración IA conserva ai:manage. No construir SQL libre ni pedir tokens, cookies o secretos.

Esta publicación incluye lecturas y referencias privadas, no preparaciones ni ejecución de escrituras. Cualquier creación, edición, eliminación o confirmación conserva sus herramientas y etapas posteriores. No anunciar informes cruzados, un total por proveedor u otros filtros/agrupaciones si el schema o caso de uso no los soporta. Web permanece conversacional; MCP sólo se ejecuta mediante Agentic verificado, con delegación Web→Agentic opt-in de la misma conexión.

Las observaciones externas se ejecutan fuera de SQL, con deadline/cancelación y verificación posterior de autoridad y configuración. La recuperación de una llamada completada no repite red; una llamada interrumpida no se reintenta ciegamente. Los artefactos son referencias privadas current_on_download: la descarga humana reautoriza chat/recurso, rechaza exceso sin truncar y no conserva el archivo al expirar el chat; el original de factura pertenece al negocio.
