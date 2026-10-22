---
{
  "schema_version": 1,
  "document_id": "personal-finance.categories-and-groups",
  "product_id": "personal-finance",
  "kind": "feature",
  "revision": 5,
  "document_status": "approved",
  "implementation": {
    "status": "partial",
    "notes": "Publicación AI-15 de las lecturas/referencias expresamente enumeradas mediante contratos cerrados y reglas nativas. Las escrituras y otras etapas del producto no se habilitan. La disponibilidad de cada dependencia se observa por separado; no se promete éxito de toda inferencia ni acceso a contenido R2 no configurado."
  },
  "integration_status": "published",
  "maintainer": "Mantenimiento de Finanzas personales y NodiaAI conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/22-personal-finance-contracts.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/21-personal-finance-erd.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/finance-category/entities/finance-category.entity.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/finance-category-group/entities/finance-category-group.entity.ts",
      "kind": "implementation"
    },
    {
      "path": "docs/mvp/54-nodia-ai-ai08-transversal-authority.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/nodia-ai-products/finance/finance-read.family.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-products/finance/use-case/execute-nodia-ai-finance-read.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-products/contracts/finance.schema.json",
      "kind": "implementation"
    }
  ],
  "verification": {
    "checked_on": "2026-10-16",
    "evidence_paths": [
      "docs/mvp/51-nodia-ai-ai05-product-knowledge.md",
      "docs/evidence/nodia-ai-ai05-knowledge-validation.json",
      "docs/evidence/nodia-ai-ai08-authority-validation.json",
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
    "revision": 5,
    "content_sha256": "aa2b03e1a2aab6003ff940fb48d1f0a1148f0f30daaa36a78094011d6ae8d117"
  }
}
---

# Categorías y grupos — contexto funcional para NodiaAI

Estado actual: esta revisión publica sólo el fragmento «Lecturas disponibles en AI-15». Las secciones de implementación/evidencia anteriores a ese fragmento conservan la trazabilidad de entregas iniciales; sus frases históricas sobre publicación pendiente no sustituyen el frontmatter actual ni habilitan escrituras.

[Producto](../README.md). Metadatos canónicos migrados en [AI-06](../../../../mvp/52-nodia-ai-ai06-knowledge-publication-contract.md); esta revisión tiene autorización específica de publicación para las lecturas enumeradas al final; las demás operaciones conservan sus gates.

## Qué resuelve y qué significa

Clasificar cada movimiento con una categoría y reunir categorías en grupos reutilizables de filtros; un grupo no es otra categoría del movimiento.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención y aclaración esperada |
|---|---|
| «Crea categoría comida» | Resolver name/key sin imponer traducciones; proponer key para revisión si falta. |
| «Añade comida al grupo casa» | Leer miembros y conservar los existentes; no reemplazar por una sola categoría. |
| «Borra categoría usada» | Explicar conflicto; ofrecer desactivar sin borrar historia. |

Ejemplos ilustrativos sin resultados ni identificadores reales. Preguntar sólo obligatorios y ambigüedades; los opcionales no bloquean salvo condición del dominio.

## Operaciones y contratos

| Handler y ruta de referencia | Candidato del catálogo40 | Tratamiento vigente |
|---|---|---|
| [FinanceCategoryGroupController.findAll](../../../../../nodia-server/src/finance-category-group/finance-category-group.controller.ts)<br>`GET /api/v1/finance/category-groups` | `nodia_finance_category_groups_list` (read, candidato40) | Publicado en el release AI-15 de lecturas; disponibilidad observada por separado |
| [FinanceCategoryGroupController.findOne](../../../../../nodia-server/src/finance-category-group/finance-category-group.controller.ts)<br>`GET /api/v1/finance/category-groups/:id` | `nodia_finance_category_groups_get` (read, candidato40) | Publicado en el release AI-15 de lecturas; disponibilidad observada por separado |
| [FinanceCategoryGroupController.create](../../../../../nodia-server/src/finance-category-group/finance-category-group.controller.ts)<br>`POST /api/v1/finance/category-groups` | `nodia_finance_category_groups_prepare_create` (prepare_change, candidato40) | Candidato; sin publicar |
| [FinanceCategoryGroupController.update](../../../../../nodia-server/src/finance-category-group/finance-category-group.controller.ts)<br>`PUT /api/v1/finance/category-groups/:id` | `nodia_finance_category_groups_prepare_update` (prepare_change, candidato40) | Candidato; sin publicar |
| [FinanceCategoryGroupController.remove](../../../../../nodia-server/src/finance-category-group/finance-category-group.controller.ts)<br>`DELETE /api/v1/finance/category-groups/:id` | `nodia_finance_category_groups_prepare_delete` (prepare_change, candidato40) | Candidato; sin publicar |
| [FinanceCategoryController.findAll](../../../../../nodia-server/src/finance-category/finance-category.controller.ts)<br>`GET /api/v1/finance/categories` | `nodia_finance_categories_list` (read, candidato40) | Publicado en el release AI-15 de lecturas; disponibilidad observada por separado |
| [FinanceCategoryController.findOne](../../../../../nodia-server/src/finance-category/finance-category.controller.ts)<br>`GET /api/v1/finance/categories/:id` | `nodia_finance_categories_get` (read, candidato40) | Publicado en el release AI-15 de lecturas; disponibilidad observada por separado |
| [FinanceCategoryController.create](../../../../../nodia-server/src/finance-category/finance-category.controller.ts)<br>`POST /api/v1/finance/categories` | `nodia_finance_categories_prepare_create` (prepare_change, candidato40) | Candidato; sin publicar |
| [FinanceCategoryController.update](../../../../../nodia-server/src/finance-category/finance-category.controller.ts)<br>`PUT /api/v1/finance/categories/:id` | `nodia_finance_categories_prepare_update` (prepare_change, candidato40) | Candidato; sin publicar |
| [FinanceCategoryController.remove](../../../../../nodia-server/src/finance-category/finance-category.controller.ts)<br>`DELETE /api/v1/finance/categories/:id` | `nodia_finance_categories_prepare_delete` (prepare_change, candidato40) | Candidato; sin publicar |

Los aliases de [inventario39](../../../../mvp/nodia-ai-current-endpoints.json) no crean capacidades distintas. Los nombres de operaciones proceden del catálogo documentado en [catálogo40](../../../../mvp/40-nodia-ai-tool-catalog-v1.md): sólo las lecturas enumeradas en esta revisión tienen binding explícito de publicación; las escrituras continúan candidatas.

DTOs de entrada/filtros: [finance-query.dto.ts](../../../../../nodia-server/src/finance-common/dto/finance-query.dto.ts), [finance-id.dto.ts](../../../../../nodia-server/src/finance-common/dto/finance-id.dto.ts), [create-finance-category-group.dto.ts](../../../../../nodia-server/src/finance-category-group/dto/create-finance-category-group.dto.ts), [update-finance-category-group.dto.ts](../../../../../nodia-server/src/finance-category-group/dto/update-finance-category-group.dto.ts), [create-finance-category.dto.ts](../../../../../nodia-server/src/finance-category/dto/create-finance-category.dto.ts), [update-finance-category.dto.ts](../../../../../nodia-server/src/finance-category/dto/update-finance-category.dto.ts)

Delegación actual (casos de uso/servicios según controlador): [get-finance-category-groups.use-case.ts](../../../../../nodia-server/src/finance-category-group/use-case/get-finance-category-groups.use-case.ts), [get-finance-category-group.use-case.ts](../../../../../nodia-server/src/finance-category-group/use-case/get-finance-category-group.use-case.ts), [create-finance-category-group.use-case.ts](../../../../../nodia-server/src/finance-category-group/use-case/create-finance-category-group.use-case.ts), [update-finance-category-group.use-case.ts](../../../../../nodia-server/src/finance-category-group/use-case/update-finance-category-group.use-case.ts), [delete-finance-category-group.use-case.ts](../../../../../nodia-server/src/finance-category-group/use-case/delete-finance-category-group.use-case.ts), [get-finance-categories.use-case.ts](../../../../../nodia-server/src/finance-category/use-case/get-finance-categories.use-case.ts), [get-finance-category.use-case.ts](../../../../../nodia-server/src/finance-category/use-case/get-finance-category.use-case.ts), [create-finance-category.use-case.ts](../../../../../nodia-server/src/finance-category/use-case/create-finance-category.use-case.ts), [update-finance-category.use-case.ts](../../../../../nodia-server/src/finance-category/use-case/update-finance-category.use-case.ts), [delete-finance-category.use-case.ts](../../../../../nodia-server/src/finance-category/use-case/delete-finance-category.use-case.ts)

## Datos mínimos y resolución de dudas

| Dato/operación | Obligatorio, condicional u opcional; resolución |
|---|---|
| Categoría | name y key únicos por usuario dentro del mantenedor; actividad opcional. |
| Grupo | name, key y category_ids (puede ser []); categorías del mismo dueño. Campo omitido en PUT conserva, [] vacía y lista reemplaza. |

Actor, permisos efectivos, claves de intención, versiones de concurrencia y referencias internas los controla Server; no los inventa ni decide el modelo. DTOs enlazados son fuente de campos, no un JSON Schema estricto de herramienta ya publicado.

## Reglas, acceso y restricciones

Nombres personales no exigen translates. Nuevas asociaciones activas; historia con categoría archivada se conserva. DELETE categoría bloqueado por cualquier movimiento; libre elimina pertenencias. DELETE grupo conserva categorías/movimientos.

Destino /tools/finances-personal, key personal_finance según22. AI-08 separa actor/sesión y destinatario owner_id explícito: super_admin activo puede operar datos de otro usuario, sin transferir propiedad ni saltar reglas financieras. Ausencia de destinatario mantiene ámbito propio. Otros roles sólo datos propios. NodiaAI exige además sus módulos conforme AI-07. AI-15 aporta puertos de lectura con manager compartido; esta revisión publica exclusivamente las lecturas enumeradas.

## Filtros e informes

Nombre/key/activo; GET grupo por ID hidrata categorías y devuelve category_count. Grupos se solapan: no sumar sus totales como total general; filtro de varios grupos une categorías y combina otros filtros por intersección.

El nuevo registro combinable de [contratos41](../../../../mvp/41-nodia-ai-v1-contracts.md) sigue pendiente AI-30/31; filtros REST existentes no autorizan joins, campos o SQL libres. [Política50](../../../../mvp/50-nodia-ai-ai04-runtime-policy.md) acota trabajo del chat y no reemplaza silenciosamente límites del módulo.

## Vista previa, confirmación y recuperación

Preview del conjunto final de categorías y asociaciones removidas; reemplazo atómico según22. DELETE identifica consecuencias reales. Sin journaling general de creación; versión de catálogo y receipts necesarios en AI-21.

Desde NodiaAI, preparar es distinto de ejecutar: cambios requieren vista previa exacta y botón humano de41; el switch Web→Agentic no confirma. Conservar efectos completados si falla un paso dependiente y no reenviar un resultado desconocido. Payload del chat caduca según50 sin borrar registros de dominio ni sus journals nativos.

## Integración y evidencia

- [x] Fuentes de producto/backend, diferencias y mínimos revisados estáticamente en AI-05.
- [x] Correspondencia de handlers/candidatos y enlaces comprobada offline; no prueba de autorización/efectos.
- [ ] Schema de herramienta/proyección, autoridad y contexto registrados con AI-06/07 y familia pertinente.
- [ ] Casos de uso reales de acceso/ambigüedad, confirmación, concurrencia y recuperación verificados para NodiaAI.
- [ ] Adaptador/modalidades, publicación y aceptación operativa comprobados.

Pendientes con efecto sobre disponibilidad: AI-08/21: mismo destinatario y dedup; catálogo/publicación de filtros combinables pendientes.

## Evolución y compatibilidad

| Revisión | Cambio y fuentes | Contexto y propuestas |
|---|---|---|
| 1 | AI-05: explicación inicial a partir de contratos/código enlazados | Sin cambio de backend ni publicación. Al cambiar reglas/DTOs, actualizar ficha/schema/registro, invalidar propuestas incompatibles y mantener recuperación original |


Actualización AI-08: [autoridad compartida](../../../../mvp/54-nodia-ai-ai08-transversal-authority.md). Destinatarios, actor real y reglas nativas se validan en transacción. En Ajustes Generales se protegen último super_admin, rol reservado, key de módulos y asociaciones atómicas; esto no incorpora herramientas MCP administrativas.


## Historial de puertos de lectura AI-15

Familia tipada de Finanzas con once lecturas individuales: obtener/listar categorías, grupos, movimientos y obligaciones, más resumen general y desgloses por categoría/grupo. Reutiliza los casos de uso nativos; no crea SQL generado por el modelo, permisos o tablas. El scope toma la identidad de sesión y admite owner_id ajeno exclusivamente para super_admin vigente.

Todo puerto exige transacción activa REPEATABLE READ heredada del checkpoint. Importes y IDs conservan strings exactos; fechas se serializan como HTTP. Los schemas son cerrados, listados acotados a100, actividad activa por defecto y all omite el predicado. Los pagos históricos de obligaciones y el solapamiento de grupos conservan las reglas nativas. El resultado guardado vuelve a comprobar autoridad de dueño, scope e identidad del detalle.

Once pruebas focales verificadas localmente; fixtures sintéticas no constituyen aprobación de contenido ni publicación. Las once capacidades continúan sin habilitar en el registro real hasta cumplir las barreras de publicación. Confirmación de escrituras, resolución genérica de entidades, reportes combinables y operación Gemini real conservan sus etapas.


## Lecturas disponibles en AI-15

Consultar categorías y grupos. Las asociaciones múltiples no autorizan sumar dos veces importes de una misma categoría.

Herramientas de esta sección: `nodia_finance_categories_get`, `nodia_finance_categories_list`, `nodia_finance_category_groups_get`, `nodia_finance_category_groups_list`.

Resolver entidades, destinatario, intervalo y filtros ambiguos antes de llamar. Usar sólo los campos del schema de la herramienta. Conservar IDs y dinero exactos, cero y falso; ausencia o unknown no equivalen a cero. La paginación y los límites de resultados deben comunicarse y una página no representa el universo completo. En recursos con actividad, iniciar Activo y usar Inactivo/Todos sólo cuando se soliciten; Todos omite el filtro.

Server valida sesión, módulo NodiaAI y todos los módulos destino actuales para usuarios ordinarios; super_admin conserva transversalidad y las reglas de dominio. Datos privados y autoridad se revalidan al devolver o recuperar resultados. Finanzas permite owner_id ajeno sólo a super_admin; Reservas conserva autoridad actual del alojamiento; administración IA conserva ai:manage. No construir SQL libre ni pedir tokens, cookies o secretos.

Esta publicación incluye lecturas y referencias privadas, no preparaciones ni ejecución de escrituras. Cualquier creación, edición, eliminación o confirmación conserva sus herramientas y etapas posteriores. No anunciar informes cruzados, un total por proveedor u otros filtros/agrupaciones si el schema o caso de uso no los soporta. Web permanece conversacional; MCP sólo se ejecuta mediante Agentic verificado, con delegación Web→Agentic opt-in de la misma conexión.

Las observaciones externas se ejecutan fuera de SQL, con deadline/cancelación y verificación posterior de autoridad y configuración. La recuperación de una llamada completada no repite red; una llamada interrumpida no se reintenta ciegamente. Los artefactos son referencias privadas current_on_download: la descarga humana reautoriza chat/recurso, rechaza exceso sin truncar y no conserva el archivo al expirar el chat; el original de factura pertenece al negocio.
