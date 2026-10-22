---
{
  "schema_version": 1,
  "document_id": "businesses.suppliers",
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
      "path": "nodia-server/src/provider/entities/provider.entity.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/provider/provider.service.ts",
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
    "content_sha256": "874daa57627550b89a4a078eef85cdab16b97128a122c86621a09d480bf017a3"
  }
}
---

# Proveedores comerciales — contexto funcional para NodiaAI

Estado actual: esta revisión publica sólo el fragmento «Lecturas disponibles en AI-15». Las secciones de implementación/evidencia anteriores a ese fragmento conservan la trazabilidad de entregas iniciales; sus frases históricas sobre publicación pendiente no sustituyen el frontmatter actual ni habilitan escrituras.

[Producto](../README.md). Metadatos canónicos migrados en [AI-06](../../../../mvp/52-nodia-ai-ai06-knowledge-publication-contract.md); esta revisión tiene autorización específica de publicación para las lecturas enumeradas al final; las demás operaciones conservan sus gates.

## Qué resuelve y qué significa

Administrar quién suministra productos y emite facturas al negocio. No confundirlo con proveedor/modelo de IA.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención y aclaración esperada |
|---|---|
| «Tráeme los productos del proveedor…» | Resolver proveedor y consultar products, no devolver todos los negocios. |
| «Agrega un proveedor» | Preguntar negocio/nombre; no pedir contacto obligatorio. |
| «Importa esta planilla de proveedores» | Excluir importación v1; no simularla como muchas altas individuales. |

Ejemplos ilustrativos sin resultados ni identificadores reales. Preguntar sólo obligatorios y ambigüedades; los opcionales no bloquean salvo condición del dominio.

## Operaciones y contratos

| Handler y ruta de referencia | Candidato del catálogo40 | Tratamiento vigente |
|---|---|---|
| [ProviderController.findAll](../../../../../nodia-server/src/provider/provider.controller.ts)<br>`GET /api/v1/provider` | `nodia_providers_list` (read, candidato40) | Publicado en el release AI-15 de lecturas; disponibilidad observada por separado |
| [ProviderController.createBulk](../../../../../nodia-server/src/provider/provider.controller.ts)<br>`POST /api/v1/provider/bulk` | Sin herramienta del modelo | Excluida de v1 |
| [ProviderController.importCsv](../../../../../nodia-server/src/provider/provider.controller.ts)<br>`POST /api/v1/provider/import` | Sin herramienta del modelo | Excluida de v1 |
| [ProviderController.updateBulk](../../../../../nodia-server/src/provider/provider.controller.ts)<br>`PUT /api/v1/provider/bulk` | Sin herramienta del modelo | Excluida de v1 |
| [ProviderController.exportCsv](../../../../../nodia-server/src/provider/provider.controller.ts)<br>`GET /api/v1/provider/export-csv` | `nodia_providers_export_csv` (read_artifact, candidato40) | Publicado en el release AI-15 de lecturas; disponibilidad observada por separado |
| [ProviderController.findOne](../../../../../nodia-server/src/provider/provider.controller.ts)<br>`GET /api/v1/provider/:id` | `nodia_providers_get` (read, candidato40) | Publicado en el release AI-15 de lecturas; disponibilidad observada por separado |
| [ProviderController.create](../../../../../nodia-server/src/provider/provider.controller.ts)<br>`POST /api/v1/provider` | `nodia_providers_prepare_create` (prepare_change, candidato40) | Candidato; sin publicar |
| [ProviderController.update](../../../../../nodia-server/src/provider/provider.controller.ts)<br>`PUT /api/v1/provider/:id` | `nodia_providers_prepare_update` (prepare_change, candidato40) | Candidato; sin publicar |

Los aliases de [inventario39](../../../../mvp/nodia-ai-current-endpoints.json) no crean capacidades distintas. Los nombres de operaciones proceden del catálogo documentado en [catálogo40](../../../../mvp/40-nodia-ai-tool-catalog-v1.md): sólo las lecturas enumeradas en esta revisión tienen binding explícito de publicación; las escrituras continúan candidatas.

DTOs de entrada/filtros: [get-providers.dto.ts](../../../../../nodia-server/src/provider/dto/get-providers.dto.ts), [bulk-create-provider.dto.ts](../../../../../nodia-server/src/provider/dto/bulk-create-provider.dto.ts), [import-providers.dto.ts](../../../../../nodia-server/src/provider/dto/import-providers.dto.ts), [bulk-update-provider.dto.ts](../../../../../nodia-server/src/provider/dto/bulk-update-provider.dto.ts), [export-providers-csv.dto.ts](../../../../../nodia-server/src/provider/dto/export-providers-csv.dto.ts), [create-provider.dto.ts](../../../../../nodia-server/src/provider/dto/create-provider.dto.ts), [update-provider.dto.ts](../../../../../nodia-server/src/provider/dto/update-provider.dto.ts)

Delegación actual (casos de uso/servicios según controlador): [get-all-providers.use-case.ts](../../../../../nodia-server/src/provider/use-case/get-all-providers.use-case.ts), [create-bulk-providers.use-case.ts](../../../../../nodia-server/src/provider/use-case/create-bulk-providers.use-case.ts), [import-providers.use-case.ts](../../../../../nodia-server/src/provider/use-case/import-providers.use-case.ts), [update-bulk-providers.use-case.ts](../../../../../nodia-server/src/provider/use-case/update-bulk-providers.use-case.ts), [export-providers-csv.use-case.ts](../../../../../nodia-server/src/provider/use-case/export-providers-csv.use-case.ts), [get-provider-by-id.use-case.ts](../../../../../nodia-server/src/provider/use-case/get-provider-by-id.use-case.ts), [create-provider.use-case.ts](../../../../../nodia-server/src/provider/use-case/create-provider.use-case.ts), [update-provider.use-case.ts](../../../../../nodia-server/src/provider/use-case/update-provider.use-case.ts)

## Datos mínimos y resolución de dudas

| Dato/operación | Obligatorio, condicional u opcional; resolución |
|---|---|
| Crear | business_id UUID y name; impuesto tax opcional (default backend19), fields y actividad opcionales. |
| Editar | ID bigint string y campos solicitados; confirmar alcance de negocio y nombre normalizado a minúsculas. |

Actor, permisos efectivos, claves de intención, versiones de concurrencia y referencias internas los controla Server; no los inventa ni decide el modelo. DTOs enlazados son fuente de campos, no un JSON Schema estricto de herramienta ya publicado.

## Reglas, acceso y restricciones

tax es porcentaje entero0..100; conservar0 real. fields es configuración heredada flexible, no autorización para columnas libres ni credenciales. Sin DELETE; desactivar no borra contactos. Create/update bulk e importación CSV excluidos de NodiaAI v1.

Destino /tools/business. Server restringe editar negocio y colaboradores a dueño o super_admin; listado normal usa pertenencia y all_businesses requiere super_admin. El acceso global autenticado a productos/proveedores/facturas/archivos es intencional conforme19, no el RBAC granular del PRD inicial. NodiaAI añade módulo propio y destino para ordinarios (AI-07), sin inventar permisos por acción ni usar alcance global para romper asociaciones.

## Filtros e informes

Listado por negocio/nombre/actividad/impuesto; export CSV es artefacto con filtros/ownership/límites propios, no permiso para importar. Gastado en proveedor se obtiene de facturas sólo con semántica acordada; proveedor no tiene ledger.

El nuevo registro combinable de [contratos41](../../../../mvp/41-nodia-ai-v1-contracts.md) sigue pendiente AI-30/31; filtros REST existentes no autorizan joins, campos o SQL libres. [Política50](../../../../mvp/50-nodia-ai-ai04-runtime-policy.md) acota trabajo del chat y no reemplaza silenciosamente límites del módulo.

## Vista previa, confirmación y recuperación

Preview de valores, impuesto y cambios de configuración admitidos; exigir esquema de fields finito antes de publicar. No deduplicar creación sólo por nombre; preparar proveedor y contacto como pasos individuales conservando lo completado.

Desde NodiaAI, preparar es distinto de ejecutar: cambios requieren vista previa exacta y botón humano de41; el switch Web→Agentic no confirma. Conservar efectos completados si falla un paso dependiente y no reenviar un resultado desconocido. Payload del chat caduca según50 sin borrar registros de dominio ni sus journals nativos.

## Integración y evidencia

- [x] Fuentes de producto/backend, diferencias y mínimos revisados estáticamente en AI-05.
- [x] Correspondencia de handlers/candidatos y enlaces comprobada offline; no prueba de autorización/efectos.
- [ ] Schema de herramienta/proyección, autoridad y contexto registrados con AI-06/07 y familia pertinente.
- [ ] Casos de uso reales de acceso/ambigüedad, confirmación, concurrencia y recuperación verificados para NodiaAI.
- [ ] Adaptador/modalidades, publicación y aceptación operativa comprobados.

Pendientes con efecto sobre disponibilidad: AI-14/22/23; contrato de fields/export acotado y receipts pendientes.

## Evolución y compatibilidad

| Revisión | Cambio y fuentes | Contexto y propuestas |
|---|---|---|
| 1 | AI-05: explicación inicial a partir de contratos/código enlazados | Sin cambio de backend ni publicación. Al cambiar reglas/DTOs, actualizar ficha/schema/registro, invalidar propuestas incompatibles y mantener recuperación original |

## Historial de implementación local AI-15

`nodia_providers_get/list` tienen puertos locales con [schemas cerrados](../../../../../nodia-server/src/nodia-ai-products/contracts/business.schema.json), sin publicación. La proyección incluye identidad bigint string, negocio, nombre, impuesto, actividad y fechas; no expone `fields` JSON arbitrario ni interpreta sus instrucciones como reglas. Se conservan el filtro por negocio/nombre y actividad inicial activa con selección explícita de inactivos/todos; páginas máximo 100. El acceso global autenticado del dominio no se sustituye por pertenencia al negocio.

`nodia_providers_export_csv` implementa una referencia privada regenerable con [schema cerrado](../../../../../nodia-server/src/nodia-ai-products/contracts/artifacts.schema.json), sin publicación. El mensaje entrega únicamente metadata y declara `current_on_download`: la persona descarga una exportación viva, no un snapshot histórico. `GET /api/v1/nodia-ai/artifacts/:reference` vuelve a autorizar sesión, chat, módulo y dominio; el CSV v2 nativo conserva contactos, mapeos y escape de fórmulas, exclusivamente en el archivo humano, nunca en el prompt. El consumidor de chat aplica el máximo de filas de política50 —100 actualmente—; preserva los topes nativos de 100 contactos por proveedor, 5.000 contactos totales y 2 MiB, o el límite de archivo de política si es menor. Se sondean filas y tamaños de JSON/texto antes de hidratar, bajo la misma transacción REPEATABLE READ; el exceso rechaza la exportación sin truncar.

Cada acceso regenera los datos actuales. Un recibo completado y su chat vigente sustentan la referencia; expiración/purga la invalida sin copiar archivos ni conservar historial extra. Cancelación descarta el buffer y no modifica proveedores. [Verificación HTTP/PostgreSQL desechable de los tres artefactos](../../../../evidence/nodia-ai-ai15-artifacts-integration.json): 24 comprobaciones con almacenamiento sintético, incluidos exceso de JSON, inactivos, permisos y purga real. Publicación, integración visual y Gemini real son gates separados. Ver [AI-15](../../../../mvp/61-nodia-ai-ai15-product-reads.md).


## Lecturas disponibles en AI-15

Solicitar referencia privada de exportación CSV de proveedores. Datos vigentes al descargar; respeta límites de filas/bytes y acceso actual. No importa ni modifica proveedores.

Consultar proveedores identificando al destinatario por ID y aclarando nombres ambiguos. Una lista de proveedores no calcula gasto.

Herramientas de esta sección: `nodia_providers_export_csv`, `nodia_providers_get`, `nodia_providers_list`.

Resolver entidades, destinatario, intervalo y filtros ambiguos antes de llamar. Usar sólo los campos del schema de la herramienta. Conservar IDs y dinero exactos, cero y falso; ausencia o unknown no equivalen a cero. La paginación y los límites de resultados deben comunicarse y una página no representa el universo completo. En recursos con actividad, iniciar Activo y usar Inactivo/Todos sólo cuando se soliciten; Todos omite el filtro.

Server valida sesión, módulo NodiaAI y todos los módulos destino actuales para usuarios ordinarios; super_admin conserva transversalidad y las reglas de dominio. Datos privados y autoridad se revalidan al devolver o recuperar resultados. Finanzas permite owner_id ajeno sólo a super_admin; Reservas conserva autoridad actual del alojamiento; administración IA conserva ai:manage. No construir SQL libre ni pedir tokens, cookies o secretos.

Esta publicación incluye lecturas y referencias privadas, no preparaciones ni ejecución de escrituras. Cualquier creación, edición, eliminación o confirmación conserva sus herramientas y etapas posteriores. No anunciar informes cruzados, un total por proveedor u otros filtros/agrupaciones si el schema o caso de uso no los soporta. Web permanece conversacional; MCP sólo se ejecuta mediante Agentic verificado, con delegación Web→Agentic opt-in de la misma conexión.

Las observaciones externas se ejecutan fuera de SQL, con deadline/cancelación y verificación posterior de autoridad y configuración. La recuperación de una llamada completada no repite red; una llamada interrumpida no se reintenta ciegamente. Los artefactos son referencias privadas current_on_download: la descarga humana reautoriza chat/recurso, rechaza exceso sin truncar y no conserva el archivo al expirar el chat; el original de factura pertenece al negocio.
