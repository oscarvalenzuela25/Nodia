---
{
  "schema_version": 1,
  "document_id": "businesses.product-logs",
  "product_id": "businesses",
  "kind": "feature",
  "revision": 4,
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
      "path": "nodia-server/src/product/entities/product-log.entity.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/product/product.service.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/common/utils/ransack-query.policies.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-products/business/use-case/read-nodia-ai-business.use-case.ts",
      "kind": "implementation"
    }
  ],
  "verification": {
    "checked_on": "2026-10-16",
    "evidence_paths": [
      "docs/mvp/51-nodia-ai-ai05-product-knowledge.md",
      "docs/evidence/nodia-ai-ai05-knowledge-validation.json",
      "docs/evidence/nodia-ai-ai15-postgres-integration.json",
      "docs/evidence/nodia-ai-ai15-external-validation.json",
      "docs/evidence/nodia-ai-ai15-artifacts-integration.json",
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
    "revision": 4,
    "content_sha256": "32ea883e86b2d0065b0ce8b1e849e998cdb4c4dd97ffcd5d3ec3b693faa1ae75"
  }
}
---

# Historial de productos — contexto funcional para NodiaAI

Estado actual: esta revisión publica sólo el fragmento «Lecturas disponibles en AI-15». Las secciones de implementación/evidencia anteriores a ese fragmento conservan la trazabilidad de entregas iniciales; sus frases históricas sobre publicación pendiente no sustituyen el frontmatter actual ni habilitan escrituras.

[Producto](../README.md). Metadatos canónicos migrados en [AI-06](../../../../mvp/52-nodia-ai-ai06-knowledge-publication-contract.md); esta revisión tiene autorización específica de publicación para las lecturas enumeradas al final; las demás operaciones conservan sus gates.

## Qué resuelve y qué significa

Consultar y, donde lo permita el contrato, preparar registros de snapshot de precio/nombre/stock. Un snapshot no acredita una compra ni tiene vínculo directo a factura.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención y aclaración esperada |
|---|---|
| «Cómo cambió el precio de este producto» | Resolver producto y campo de precio; no equiparar logs con facturas. |
| «Corrige este registro histórico» | Identificar UUID y mostrar antes/después. |
| «Cuánto gasté sumando estos logs» | No es una medida de gasto; aclarar fuente económica. |

Ejemplos ilustrativos sin resultados ni identificadores reales. Preguntar sólo obligatorios y ambigüedades; los opcionales no bloquean salvo condición del dominio.

## Operaciones y contratos

| Handler y ruta de referencia | Candidato del catálogo40 | Tratamiento vigente |
|---|---|---|
| [ProductLogController.findAll](../../../../../nodia-server/src/product/product-log.controller.ts)<br>`GET /api/v1/product-log` | `nodia_product_logs_list` (read, candidato40) | Publicado en el release AI-15 de lecturas; disponibilidad observada por separado |
| [ProductLogController.query](../../../../../nodia-server/src/product/product-log.controller.ts)<br>`POST /api/v1/product-log/query` | `nodia_product_logs_query` (read, candidato40) | Publicado en el release AI-15 de lecturas; disponibilidad observada por separado |
| [ProductLogController.createBulk](../../../../../nodia-server/src/product/product-log.controller.ts)<br>`POST /api/v1/product-log/bulk` | Sin herramienta del modelo | Excluida de v1 |
| [ProductLogController.updateBulk](../../../../../nodia-server/src/product/product-log.controller.ts)<br>`PUT /api/v1/product-log/bulk` | Sin herramienta del modelo | Excluida de v1 |
| [ProductLogController.findOne](../../../../../nodia-server/src/product/product-log.controller.ts)<br>`GET /api/v1/product-log/:id` | `nodia_product_logs_get` (read, candidato40) | Publicado en el release AI-15 de lecturas; disponibilidad observada por separado |
| [ProductLogController.create](../../../../../nodia-server/src/product/product-log.controller.ts)<br>`POST /api/v1/product-log` | `nodia_product_logs_prepare_create` (prepare_change, candidato40) | Candidato; sin publicar |
| [ProductLogController.update](../../../../../nodia-server/src/product/product-log.controller.ts)<br>`PUT /api/v1/product-log/:id` | `nodia_product_logs_prepare_update` (prepare_change, candidato40) | Candidato; sin publicar |

Los aliases de [inventario39](../../../../mvp/nodia-ai-current-endpoints.json) no crean capacidades distintas. Los nombres de operaciones proceden del catálogo documentado en [catálogo40](../../../../mvp/40-nodia-ai-tool-catalog-v1.md): sólo las lecturas enumeradas en esta revisión tienen binding explícito de publicación; las escrituras continúan candidatas.

DTOs de entrada/filtros: [get-product-logs.dto.ts](../../../../../nodia-server/src/product/dto/get-product-logs.dto.ts), [query-product-logs.dto.ts](../../../../../nodia-server/src/product/dto/query-product-logs.dto.ts), [bulk-create-product-log.dto.ts](../../../../../nodia-server/src/product/dto/bulk-create-product-log.dto.ts), [bulk-update-product-log.dto.ts](../../../../../nodia-server/src/product/dto/bulk-update-product-log.dto.ts), [create-product-log.dto.ts](../../../../../nodia-server/src/product/dto/create-product-log.dto.ts), [update-product-log.dto.ts](../../../../../nodia-server/src/product/dto/update-product-log.dto.ts)

Delegación actual (casos de uso/servicios según controlador): [get-all-product-logs.use-case.ts](../../../../../nodia-server/src/product/use-case/get-all-product-logs.use-case.ts), [query-product-logs.use-case.ts](../../../../../nodia-server/src/product/use-case/query-product-logs.use-case.ts), [create-bulk-product-logs.use-case.ts](../../../../../nodia-server/src/product/use-case/create-bulk-product-logs.use-case.ts), [update-bulk-product-logs.use-case.ts](../../../../../nodia-server/src/product/use-case/update-bulk-product-logs.use-case.ts), [get-product-log-by-id.use-case.ts](../../../../../nodia-server/src/product/use-case/get-product-log-by-id.use-case.ts), [create-product-log.use-case.ts](../../../../../nodia-server/src/product/use-case/create-product-log.use-case.ts), [update-product-log.use-case.ts](../../../../../nodia-server/src/product/use-case/update-product-log.use-case.ts)

## Datos mínimos y resolución de dudas

| Dato/operación | Obligatorio, condicional u opcional; resolución |
|---|---|
| Crear log | product_id bigint, code/name y cuatro campos de precio/margen enteros; stock opcional. ID del log es UUID, distinto del producto. |
| Consulta | producto(s)/código(s)/período con filtros y páginas acotados; no enviar all=true ilimitado desde NodiaAI. |

Actor, permisos efectivos, claves de intención, versiones de concurrencia y referencias internas los controla Server; no los inventa ni decide el modelo. DTOs enlazados son fuente de campos, no un JSON Schema estricto de herramienta ya publicado.

## Reglas, acceso y restricciones

Create/update manual de logs existen; editar historial no modifica automáticamente producto actual. Sin DELETE y sin is_active. No prometer historial inmutable; nuevas snapshots automáticas guardan estado posterior, distinto del PRD antiguo que menciona estado anterior. Bulk create/update excluidos.

Destino /tools/business. Server restringe editar negocio y colaboradores a dueño o super_admin; listado normal usa pertenencia y all_businesses requiere super_admin. El acceso global autenticado a productos/proveedores/facturas/archivos es intencional conforme19, no el RBAC granular del PRD inicial. NodiaAI añade módulo propio y destino para ordinarios (AI-07), sin inventar permisos por acción ni usar alcance global para romper asociaciones.

## Filtros e informes

Comparar campos registrados por created_at e identificar producto; timestamps legacy sin zona explícita requieren resolver base temporal de informes. No sumar costo de snapshots como dinero gastado. Policy Ransack actual tipa id como bigint aunque entidad es UUID: filtro por id bloqueado hasta corregir/validar contrato.

El nuevo registro combinable de [contratos41](../../../../mvp/41-nodia-ai-v1-contracts.md) sigue pendiente AI-30/31; filtros REST existentes no autorizan joins, campos o SQL libres. [Política50](../../../../mvp/50-nodia-ai-ai04-runtime-policy.md) acota trabajo del chat y no reemplaza silenciosamente límites del módulo.

## Vista previa, confirmación y recuperación

Preview distingue edición del historial de cambio del catálogo actual. Logs sin dedup general requieren witness/caso de uso transaccional; recuperar UUID original, no recrear snapshot automáticamente.

Desde NodiaAI, preparar es distinto de ejecutar: cambios requieren vista previa exacta y botón humano de41; el switch Web→Agentic no confirma. Conservar efectos completados si falla un paso dependiente y no reenviar un resultado desconocido. Payload del chat caduca según50 sin borrar registros de dominio ni sus journals nativos.

## Integración y evidencia

- [x] Fuentes de producto/backend, diferencias y mínimos revisados estáticamente en AI-05.
- [x] Correspondencia de handlers/candidatos y enlaces comprobada offline; no prueba de autorización/efectos.
- [ ] Schema de herramienta/proyección, autoridad y contexto registrados con AI-06/07 y familia pertinente.
- [ ] Casos de uso reales de acceso/ambigüedad, confirmación, concurrencia y recuperación verificados para NodiaAI.
- [ ] Adaptador/modalidades, publicación y aceptación operativa comprobados.

Pendientes con efecto sobre disponibilidad: AI-14/22/31: UUID frente a policy id bigint y semántica de informes/recuperación pendientes.

## Evolución y compatibilidad

| Revisión | Cambio y fuentes | Contexto y propuestas |
|---|---|---|
| 1 | AI-05: explicación inicial a partir de contratos/código enlazados | Sin cambio de backend ni publicación. Al cambiar reglas/DTOs, actualizar ficha/schema/registro, invalidar propuestas incompatibles y mantener recuperación original |

## Historial de implementación local AI-15

`nodia_product_logs_get/list/query` están implementados como puertos locales con [schemas cerrados](../../../../../nodia-server/src/nodia-ai-products/contracts/business.schema.json), pendientes de publicación. El identificador de snapshot es UUID; `product_id` continúa bigint string. Las consultas reutilizan el caso de uso nativo y admiten hasta 100 productos/códigos y 100 filas por página, sin `all:true`. No se aplica actividad inexistente a snapshots, no se infiere una venta/pago y no se serializa la relación ORM del producto. Ver [AI-15](../../../../mvp/61-nodia-ai-ai15-product-reads.md).


## Lecturas disponibles en AI-15

Consultar snapshots del historial de productos. No equivalen a ventas, gastos ni existencias históricas completas fuera del alcance del log.

Herramientas de esta sección: `nodia_product_logs_get`, `nodia_product_logs_list`, `nodia_product_logs_query`.

Resolver entidades, destinatario, intervalo y filtros ambiguos antes de llamar. Usar sólo los campos del schema de la herramienta. Conservar IDs y dinero exactos, cero y falso; ausencia o unknown no equivalen a cero. La paginación y los límites de resultados deben comunicarse y una página no representa el universo completo. En recursos con actividad, iniciar Activo y usar Inactivo/Todos sólo cuando se soliciten; Todos omite el filtro.

Server valida sesión, módulo NodiaAI y todos los módulos destino actuales para usuarios ordinarios; super_admin conserva transversalidad y las reglas de dominio. Datos privados y autoridad se revalidan al devolver o recuperar resultados. Finanzas permite owner_id ajeno sólo a super_admin; Reservas conserva autoridad actual del alojamiento; administración IA conserva ai:manage. No construir SQL libre ni pedir tokens, cookies o secretos.

Esta publicación incluye lecturas y referencias privadas, no preparaciones ni ejecución de escrituras. Cualquier creación, edición, eliminación o confirmación conserva sus herramientas y etapas posteriores. No anunciar informes cruzados, un total por proveedor u otros filtros/agrupaciones si el schema o caso de uso no los soporta. Web permanece conversacional; MCP sólo se ejecuta mediante Agentic verificado, con delegación Web→Agentic opt-in de la misma conexión.

Las observaciones externas se ejecutan fuera de SQL, con deadline/cancelación y verificación posterior de autoridad y configuración. La recuperación de una llamada completada no repite red; una llamada interrumpida no se reintenta ciegamente. Los artefactos son referencias privadas current_on_download: la descarga humana reautoriza chat/recurso, rechaza exceso sin truncar y no conserva el archivo al expirar el chat; el original de factura pertenece al negocio.
