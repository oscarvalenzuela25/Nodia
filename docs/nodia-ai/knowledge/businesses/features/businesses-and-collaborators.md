---
{
  "schema_version": 1,
  "document_id": "businesses.businesses-and-collaborators",
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
      "path": "nodia-server/src/business/entities/business.entity.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/business/entities/business-collaborator.entity.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/business/business.service.ts",
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
    "content_sha256": "18f5faef1819229a0ac63d90d5a21290bf75766afe3756a7f89fc06c10e69d67"
  }
}
---

# Negocios y colaboradores — contexto funcional para NodiaAI

Estado actual: esta revisión publica sólo el fragmento «Lecturas disponibles en AI-15». Las secciones de implementación/evidencia anteriores a ese fragmento conservan la trazabilidad de entregas iniciales; sus frases históricas sobre publicación pendiente no sustituyen el frontmatter actual ni habilitan escrituras.

[Producto](../README.md). Metadatos canónicos migrados en [AI-06](../../../../mvp/52-nodia-ai-ai06-knowledge-publication-contract.md); esta revisión tiene autorización específica de publicación para las lecturas enumeradas al final; las demás operaciones conservan sus gates.

## Qué resuelve y qué significa

Identificar el negocio operativo y mantener sus datos y colaboradores. Su nombre es de negocio; no identifica automáticamente un alojamiento de Reservas.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención y aclaración esperada |
|---|---|
| «Crea un negocio llamado…» | Pedir sólo nombre si falta; no exigir descripción opcional. |
| «Agrega a Ana al negocio» | Resolver usuario/negocio y acciones vigentes; no asignar todas por suposición. |
| «Borra el negocio» | Ofrecer desactivar con preview; DELETE no existe. |

Ejemplos ilustrativos sin resultados ni identificadores reales. Preguntar sólo obligatorios y ambigüedades; los opcionales no bloquean salvo condición del dominio.

## Operaciones y contratos

| Handler y ruta de referencia | Candidato del catálogo40 | Tratamiento vigente |
|---|---|---|
| [BusinessController.findMyBusinesses](../../../../../nodia-server/src/business/business.controller.ts)<br>`GET /api/v1/business` | `nodia_businesses_list` (read, candidato40) | Publicado en el release AI-15 de lecturas; disponibilidad observada por separado |
| [BusinessController.findOne](../../../../../nodia-server/src/business/business.controller.ts)<br>`GET /api/v1/business/:id` | `nodia_businesses_get` (read, candidato40) | Publicado en el release AI-15 de lecturas; disponibilidad observada por separado |
| [BusinessController.create](../../../../../nodia-server/src/business/business.controller.ts)<br>`POST /api/v1/business` | `nodia_businesses_prepare_create` (prepare_change, candidato40) | Candidato; sin publicar |
| [BusinessController.update](../../../../../nodia-server/src/business/business.controller.ts)<br>`PUT /api/v1/business/:id` | `nodia_businesses_prepare_update` (prepare_change, candidato40) | Candidato; sin publicar |
| [BusinessController.assignCollaborators](../../../../../nodia-server/src/business/business.controller.ts)<br>`PUT /api/v1/business/:id/collaborators` | `nodia_businesses_prepare_set_collaborators` (prepare_change, candidato40) | Candidato; sin publicar |

Los aliases de [inventario39](../../../../mvp/nodia-ai-current-endpoints.json) no crean capacidades distintas. Los nombres de operaciones proceden del catálogo documentado en [catálogo40](../../../../mvp/40-nodia-ai-tool-catalog-v1.md): sólo las lecturas enumeradas en esta revisión tienen binding explícito de publicación; las escrituras continúan candidatas.

DTOs de entrada/filtros: [get-businesses.dto.ts](../../../../../nodia-server/src/business/dto/get-businesses.dto.ts), [create-business.dto.ts](../../../../../nodia-server/src/business/dto/create-business.dto.ts), [update-business.dto.ts](../../../../../nodia-server/src/business/dto/update-business.dto.ts), [assign-collaborators.dto.ts](../../../../../nodia-server/src/business/dto/assign-collaborators.dto.ts)

Delegación actual (casos de uso/servicios según controlador): [get-my-businesses.use-case.ts](../../../../../nodia-server/src/business/use-case/get-my-businesses.use-case.ts), [get-business-by-id.use-case.ts](../../../../../nodia-server/src/business/use-case/get-business-by-id.use-case.ts), [create-business.use-case.ts](../../../../../nodia-server/src/business/use-case/create-business.use-case.ts), [update-business.use-case.ts](../../../../../nodia-server/src/business/use-case/update-business.use-case.ts), [assign-business-collaborators.use-case.ts](../../../../../nodia-server/src/business/use-case/assign-business-collaborators.use-case.ts)

## Datos mínimos y resolución de dudas

| Dato/operación | Obligatorio, condicional u opcional; resolución |
|---|---|
| Crear negocio | name de2..255; dueño autenticado lo fija Server. Descripción/traducciones/activo opcionales. |
| Colaborador | Negocio UUID, usuario existente y action_ids; position opcional. Leer estado antes de cambiar acciones. |

Actor, permisos efectivos, claves de intención, versiones de concurrencia y referencias internas los controla Server; no los inventa ni decide el modelo. DTOs enlazados son fuente de campos, no un JSON Schema estricto de herramienta ya publicado.

## Reglas, acceso y restricciones

Editar datos o colaboradores requiere dueño/super_admin. assignCollaborators procesa sólo usuarios enviados: actions [] inactiva ese colaborador; lista de acciones reemplaza las suyas y lista users vacía no borra todos. No presentarlo como reemplazo global ni asegurar transacción de todos los elementos; no hay DELETE de negocio.

Destino /tools/business. Server restringe editar negocio y colaboradores a dueño o super_admin; listado normal usa pertenencia y all_businesses requiere super_admin. El acceso global autenticado a productos/proveedores/facturas/archivos es intencional conforme19, no el RBAC granular del PRD inicial. NodiaAI añade módulo propio y destino para ordinarios (AI-07), sin inventar permisos por acción ni usar alcance global para romper asociaciones.

## Filtros e informes

Filtrar nombre/actividad y alcance permitido; conteos/listados no son totales de inventario calculados desde una página. all_businesses sólo super_admin. Analítica monetaria general pendiente; ver19.

El nuevo registro combinable de [contratos41](../../../../mvp/41-nodia-ai-v1-contracts.md) sigue pendiente AI-30/31; filtros REST existentes no autorizan joins, campos o SQL libres. [Política50](../../../../mvp/50-nodia-ai-ai04-runtime-policy.md) acota trabajo del chat y no reemplaza silenciosamente límites del módulo.

## Vista previa, confirmación y recuperación

Preview de datos y acciones por usuario; advertir desasignaciones. Escrituras legacy sin receipt transaccional general: AI-17/23 debe resolver atomicidad e idempotencia antes de ejecución conversacional.

Desde NodiaAI, preparar es distinto de ejecutar: cambios requieren vista previa exacta y botón humano de41; el switch Web→Agentic no confirma. Conservar efectos completados si falla un paso dependiente y no reenviar un resultado desconocido. Payload del chat caduca según50 sin borrar registros de dominio ni sus journals nativos.

## Integración y evidencia

- [x] Fuentes de producto/backend, diferencias y mínimos revisados estáticamente en AI-05.
- [x] Correspondencia de handlers/candidatos y enlaces comprobada offline; no prueba de autorización/efectos.
- [ ] Schema de herramienta/proyección, autoridad y contexto registrados con AI-06/07 y familia pertinente.
- [ ] Casos de uso reales de acceso/ambigüedad, confirmación, concurrencia y recuperación verificados para NodiaAI.
- [ ] Adaptador/modalidades, publicación y aceptación operativa comprobados.

Pendientes con efecto sobre disponibilidad: AI-07/14/17/23; no trasladar el PRD granular antiguo a capacidades publicadas.

## Evolución y compatibilidad

| Revisión | Cambio y fuentes | Contexto y propuestas |
|---|---|---|
| 1 | AI-05: explicación inicial a partir de contratos/código enlazados | Sin cambio de backend ni publicación. Al cambiar reglas/DTOs, actualizar ficha/schema/registro, invalidar propuestas incompatibles y mantener recuperación original |

## Historial de implementación local AI-15

`nodia_businesses_get/list` tienen puertos de lectura locales y schemas cerrados en [business.schema.json](../../../../../nodia-server/src/nodia-ai-products/contracts/business.schema.json), pendientes de publicación. Reutilizan los casos de uso nativos con manager heredado, traducciones y pertenencia actuales; omiten agregados secundarios y relaciones de usuarios para mantener la proyección acotada. `all_businesses:true` exige super_admin; el listado normal conserva pertenencia. La recuperación de un listado valida sus IDs en una consulta por lote, de modo que revocar una colaboración también oculta resultados anteriores. No implementan escrituras ni asignación de colaboradores. Ver [AI-15](../../../../mvp/61-nodia-ai-ai15-product-reads.md).


## Lecturas disponibles en AI-15

Consultar negocios y sus miembros con el alcance autorizado. El listado respeta pertenencia; all_businesses sólo corresponde a super_admin.

Herramientas de esta sección: `nodia_businesses_get`, `nodia_businesses_list`.

Resolver entidades, destinatario, intervalo y filtros ambiguos antes de llamar. Usar sólo los campos del schema de la herramienta. Conservar IDs y dinero exactos, cero y falso; ausencia o unknown no equivalen a cero. La paginación y los límites de resultados deben comunicarse y una página no representa el universo completo. En recursos con actividad, iniciar Activo y usar Inactivo/Todos sólo cuando se soliciten; Todos omite el filtro.

Server valida sesión, módulo NodiaAI y todos los módulos destino actuales para usuarios ordinarios; super_admin conserva transversalidad y las reglas de dominio. Datos privados y autoridad se revalidan al devolver o recuperar resultados. Finanzas permite owner_id ajeno sólo a super_admin; Reservas conserva autoridad actual del alojamiento; administración IA conserva ai:manage. No construir SQL libre ni pedir tokens, cookies o secretos.

Esta publicación incluye lecturas y referencias privadas, no preparaciones ni ejecución de escrituras. Cualquier creación, edición, eliminación o confirmación conserva sus herramientas y etapas posteriores. No anunciar informes cruzados, un total por proveedor u otros filtros/agrupaciones si el schema o caso de uso no los soporta. Web permanece conversacional; MCP sólo se ejecuta mediante Agentic verificado, con delegación Web→Agentic opt-in de la misma conexión.

Las observaciones externas se ejecutan fuera de SQL, con deadline/cancelación y verificación posterior de autoridad y configuración. La recuperación de una llamada completada no repite red; una llamada interrumpida no se reintenta ciegamente. Los artefactos son referencias privadas current_on_download: la descarga humana reautoriza chat/recurso, rechaza exceso sin truncar y no conserva el archivo al expirar el chat; el original de factura pertenece al negocio.
