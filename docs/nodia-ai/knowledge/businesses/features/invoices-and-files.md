---
{
  "schema_version": 1,
  "document_id": "businesses.invoices-and-files",
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
      "path": "nodia-server/src/invoice/entities/invoice.entity.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/invoice/use-case/create-invoice.use-case.ts",
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
    "content_sha256": "05dcd5b4671e1b355d5406ebe925fd3003cc6362c69c85fdd7fbdff566510dc5"
  }
}
---

# Facturas y archivos — contexto funcional para NodiaAI

Estado actual: esta revisión publica sólo el fragmento «Lecturas disponibles en AI-15». Las secciones de implementación/evidencia anteriores a ese fragmento conservan la trazabilidad de entregas iniciales; sus frases históricas sobre publicación pendiente no sustituyen el frontmatter actual ni habilitan escrituras.

[Producto](../README.md). Metadatos canónicos migrados en [AI-06](../../../../mvp/52-nodia-ai-ai06-knowledge-publication-contract.md); esta revisión tiene autorización específica de publicación para las lecturas enumeradas al final; las demás operaciones conservan sus gates.

## Qué resuelve y qué significa

Persistir comprobantes y adjuntos propios del negocio; el total registrado no demuestra pago a proveedor.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención y aclaración esperada |
|---|---|
| «Guarda esta factura» | Resolver negocio/código/proveedor y revisión de extracción antes de proponer guardar. |
| «Cuánto le compré a X en…» | Aclarar fecha/base económica y si usa totales registrados, no asumir pagos. |
| «Abre cualquier archivo de R2» | Sólo artefacto vinculado a factura autorizada; no key/URL libre. |

Ejemplos ilustrativos sin resultados ni identificadores reales. Preguntar sólo obligatorios y ambigüedades; los opcionales no bloquean salvo condición del dominio.

## Operaciones y contratos

| Handler y ruta de referencia | Candidato del catálogo40 | Tratamiento vigente |
|---|---|---|
| [InvoiceController.findAll](../../../../../nodia-server/src/invoice/invoice.controller.ts)<br>`GET /api/v1/invoice` | `nodia_invoices_list` (read, candidato40) | Publicado en el release AI-15 de lecturas; disponibilidad observada por separado |
| [InvoiceController.getViewUrl](../../../../../nodia-server/src/invoice/invoice.controller.ts)<br>`GET /api/v1/invoice/:id/view-url` | `nodia_invoices_file` (read_artifact, candidato40) | Publicado en el release AI-15 de lecturas; disponibilidad observada por separado |
| [InvoiceController.findOne](../../../../../nodia-server/src/invoice/invoice.controller.ts)<br>`GET /api/v1/invoice/:id` | `nodia_invoices_get` (read, candidato40) | Publicado en el release AI-15 de lecturas; disponibilidad observada por separado |
| [InvoiceController.create](../../../../../nodia-server/src/invoice/invoice.controller.ts)<br>`POST /api/v1/invoice` | `nodia_invoices_prepare_create` (prepare_change, candidato40) | Candidato; sin publicar |
| [InvoiceController.update](../../../../../nodia-server/src/invoice/invoice.controller.ts)<br>`PUT /api/v1/invoice/:id` | `nodia_invoices_prepare_update` (prepare_change, candidato40) | Candidato; sin publicar |

Los aliases de [inventario39](../../../../mvp/nodia-ai-current-endpoints.json) no crean capacidades distintas. Los nombres de operaciones proceden del catálogo documentado en [catálogo40](../../../../mvp/40-nodia-ai-tool-catalog-v1.md): sólo las lecturas enumeradas en esta revisión tienen binding explícito de publicación; las escrituras continúan candidatas.

DTOs de entrada/filtros: [get-invoices.dto.ts](../../../../../nodia-server/src/invoice/dto/get-invoices.dto.ts), [create-invoice.dto.ts](../../../../../nodia-server/src/invoice/dto/create-invoice.dto.ts), [update-invoice.dto.ts](../../../../../nodia-server/src/invoice/dto/update-invoice.dto.ts)

Delegación actual (casos de uso/servicios según controlador): [get-all-invoices.use-case.ts](../../../../../nodia-server/src/invoice/use-case/get-all-invoices.use-case.ts), [get-invoice-view-url.use-case.ts](../../../../../nodia-server/src/invoice/use-case/get-invoice-view-url.use-case.ts), [get-invoice-by-id.use-case.ts](../../../../../nodia-server/src/invoice/use-case/get-invoice-by-id.use-case.ts), [create-invoice.use-case.ts](../../../../../nodia-server/src/invoice/use-case/create-invoice.use-case.ts), [update-invoice.use-case.ts](../../../../../nodia-server/src/invoice/use-case/update-invoice.use-case.ts)

## Datos mínimos y resolución de dudas

| Dato/operación | Obligatorio, condicional u opcional; resolución |
|---|---|
| Crear | business_id UUID y code; provider_id, total_amount, data, actividad y archivo opcionales según DTO. path_storage lo controla el flujo de almacenamiento, no una URL del modelo. |
| Fecha e importe | Aclarar total de factura registrada versus gasto pagado. No usar una issue_date de data JSON como columna económica homologada. |

Actor, permisos efectivos, claves de intención, versiones de concurrencia y referencias internas los controla Server; no los inventa ni decide el modelo. DTOs enlazados son fuente de campos, no un JSON Schema estricto de herramienta ya publicado.

## Reglas, acceso y restricciones

Factura bigint con proveedor opcional; relación coherente con negocio. Sin DELETE. No aceptar transformaciones legacy de importe inválido→0 o JSON inválido→{} como validación del chat: derivar esquema estricto. Ver archivo usa URL autorizada/temporal, no publicar keys R2 ni acceso arbitrario.

Destino /tools/business. Server restringe editar negocio y colaboradores a dueño o super_admin; listado normal usa pertenencia y all_businesses requiere super_admin. El acceso global autenticado a productos/proveedores/facturas/archivos es intencional conforme19, no el RBAC granular del PRD inicial. NodiaAI añade módulo propio y destino para ordinarios (AI-07), sin inventar permisos por acción ni usar alcance global para romper asociaciones.

## Filtros e informes

Filtros públicos por negocio/proveedor/código/total/actividad/created_at. SUM(total_amount) es facturación registrada, no pagado; falta contrato temporal/zona para legacy timestamp. Pre-agregar factura antes de unirse a contactos/logs para no duplicar importes.

El nuevo registro combinable de [contratos41](../../../../mvp/41-nodia-ai-v1-contracts.md) sigue pendiente AI-30/31; filtros REST existentes no autorizan joins, campos o SQL libres. [Política50](../../../../mvp/50-nodia-ai-ai04-runtime-policy.md) acota trabajo del chat y no reemplaza silenciosamente límites del módulo.

## Vista previa, confirmación y recuperación

Separar crear factura de aplicar productos; flujo actual no es una transacción global. Uploads nativos tienen intent y recovery de objeto, que no deduplican toda intención conversacional. Archivo del chat promovido a key de dominio independiente; expiry chat no lo borra.

Desde NodiaAI, preparar es distinto de ejecutar: cambios requieren vista previa exacta y botón humano de41; el switch Web→Agentic no confirma. Conservar efectos completados si falla un paso dependiente y no reenviar un resultado desconocido. Payload del chat caduca según50 sin borrar registros de dominio ni sus journals nativos.

## Integración y evidencia

- [x] Fuentes de producto/backend, diferencias y mínimos revisados estáticamente en AI-05.
- [x] Correspondencia de handlers/candidatos y enlaces comprobada offline; no prueba de autorización/efectos.
- [ ] Schema de herramienta/proyección, autoridad y contexto registrados con AI-06/07 y familia pertinente.
- [ ] Casos de uso reales de acceso/ambigüedad, confirmación, concurrencia y recuperación verificados para NodiaAI.
- [ ] Adaptador/modalidades, publicación y aceptación operativa comprobados.

Pendientes con efecto sobre disponibilidad: AI-22/30..32: schema data finito, fuente de informe, ownership y witness de creación pendientes.

## Evolución y compatibilidad

| Revisión | Cambio y fuentes | Contexto y propuestas |
|---|---|---|
| 1 | AI-05: explicación inicial a partir de contratos/código enlazados | Sin cambio de backend ni publicación. Al cambiar reglas/DTOs, actualizar ficha/schema/registro, invalidar propuestas incompatibles y mantener recuperación original |

## Historial de implementación local AI-15

`nodia_invoices_get/list` tienen puertos locales con [schemas cerrados](../../../../../nodia-server/src/nodia-ai-products/contracts/business.schema.json), sin publicación. Devuelven identidad, asociaciones, código, importe registrado, actividad, fechas, presencia de archivo y `issue_date` almacenada cuando existe; no publican `path_storage`, URLs firmadas, JSON extraído arbitrario ni relaciones ORM. Los filtros conservan la fecha de emisión con fallback de registro del dominio; no convierten una factura en un pago. Páginas máximo 100, actividad activa inicial y selección explícita de inactivos/todos.

`nodia_invoices_file` implementa una referencia privada regenerable con [schema cerrado](../../../../../nodia-server/src/nodia-ai-products/contracts/artifacts.schema.json), sin publicación. El modelo sólo recibe UUID, nombre, MIME y semántica `current_on_download`; no recibe `path_storage`, URL firmada ni documento. La descarga humana `GET /api/v1/nodia-ai/artifacts/:reference` consulta la factura actual y valida su clave canónica bajo `invoices/<business_id>/`, preservando el acceso global autenticado nativo. Relee sesión, chat vigente, destino y recurso antes y después del I/O. La descarga binaria de almacenamiento ocurre fuera de transacción SQL, con `no-store`, sin redirección firmada y con máximo igual al menor entre el límite nativo de factura —10 MiB— y política50; acota ContentLength y bytes efectivos, incluidos servicios que omiten o mienten sobre el tamaño.

La referencia desaparece al purgar el chat/recibo; la factura y su archivo de negocio conservan vida independiente. No se duplican objetos ni se promete un snapshot: el archivo puede haber cambiado desde el mensaje. Una sustitución de clave durante la descarga rechaza el resultado; cancelación, expiración y revocación descartan bytes. [24 comprobaciones con HTTP/PostgreSQL real y SDK/stream sintéticos](../../../../evidence/nodia-ai-ai15-artifacts-integration.json) cubren estas garantías y el cierre del stream. No se probó R2 real ni se publicó la herramienta o verificó Gemini. Ver [AI-15](../../../../mvp/61-nodia-ai-ai15-product-reads.md).


## Lecturas disponibles en AI-15

Obtener una referencia privada al archivo de factura. La descarga humana requiere sesión, chat y recurso autorizados y devuelve bytes por proxy privado, nunca una URL firmada en el prompt.

Consultar facturas por filtros permitidos y obtener detalle público. Diferenciar registro, emisión y pago; aclarar qué fecha/importe solicita el usuario si el contrato no representa su pregunta.

Herramientas de esta sección: `nodia_invoices_file`, `nodia_invoices_get`, `nodia_invoices_list`.

Resolver entidades, destinatario, intervalo y filtros ambiguos antes de llamar. Usar sólo los campos del schema de la herramienta. Conservar IDs y dinero exactos, cero y falso; ausencia o unknown no equivalen a cero. La paginación y los límites de resultados deben comunicarse y una página no representa el universo completo. En recursos con actividad, iniciar Activo y usar Inactivo/Todos sólo cuando se soliciten; Todos omite el filtro.

Server valida sesión, módulo NodiaAI y todos los módulos destino actuales para usuarios ordinarios; super_admin conserva transversalidad y las reglas de dominio. Datos privados y autoridad se revalidan al devolver o recuperar resultados. Finanzas permite owner_id ajeno sólo a super_admin; Reservas conserva autoridad actual del alojamiento; administración IA conserva ai:manage. No construir SQL libre ni pedir tokens, cookies o secretos.

Esta publicación incluye lecturas y referencias privadas, no preparaciones ni ejecución de escrituras. Cualquier creación, edición, eliminación o confirmación conserva sus herramientas y etapas posteriores. No anunciar informes cruzados, un total por proveedor u otros filtros/agrupaciones si el schema o caso de uso no los soporta. Web permanece conversacional; MCP sólo se ejecuta mediante Agentic verificado, con delegación Web→Agentic opt-in de la misma conexión.

Las observaciones externas se ejecutan fuera de SQL, con deadline/cancelación y verificación posterior de autoridad y configuración. La recuperación de una llamada completada no repite red; una llamada interrumpida no se reintenta ciegamente. Los artefactos son referencias privadas current_on_download: la descarga humana reautoriza chat/recurso, rechaza exceso sin truncar y no conserva el archivo al expirar el chat; el original de factura pertenece al negocio.


La referencia de factura no confirma existencia ni disponibilidad de bytes en almacenamiento. En la VM de aceptación R2 no está configurado: la referencia se emitió mediante Gemini/MCP real y el GET humano devolvió 503 artifact_storage_unavailable. `invoice_binary_download_r2_real` permanece pendiente hasta comprobar un GET autorizado positivo con objeto real, MIME/bytes y reautorización. No anunciar descarga binaria o disponibilidad R2 como verificadas.
