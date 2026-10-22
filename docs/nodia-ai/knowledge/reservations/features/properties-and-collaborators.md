---
{
  "schema_version": 1,
  "document_id": "reservations.properties-and-collaborators",
  "product_id": "reservations",
  "kind": "feature",
  "revision": 5,
  "document_status": "approved",
  "implementation": {
    "status": "partial",
    "notes": "Publicación AI-15 de las lecturas/referencias expresamente enumeradas mediante contratos cerrados y reglas nativas. Las escrituras y otras etapas del producto no se habilitan. La disponibilidad de cada dependencia se observa por separado; no se promete éxito de toda inferencia ni acceso a contenido R2 no configurado."
  },
  "integration_status": "published",
  "maintainer": "Mantenimiento de Reservas y NodiaAI conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/28-rental-reservations-contracts.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/26-rental-reservations-spec.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/27-rental-reservations-erd.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/rental-property/entities/rental-property.entity.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/rental-collaborator/entities/rental-collaborator.entity.ts",
      "kind": "implementation"
    },
    {
      "path": "docs/mvp/54-nodia-ai-ai08-transversal-authority.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/nodia-ai-products/reservations/use-case/nodia-ai-reservations-family.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-products/contracts/reservations.schema.json",
      "kind": "implementation"
    }
  ],
  "verification": {
    "checked_on": "2026-10-16",
    "evidence_paths": [
      "docs/mvp/51-nodia-ai-ai05-product-knowledge.md",
      "docs/evidence/nodia-ai-ai05-knowledge-validation.json",
      "docs/evidence/nodia-ai-ai08-authority-validation.json",
      "nodia-server/src/nodia-ai-products/reservations/use-case/nodia-ai-reservations-family.use-case.spec.ts",
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
    "content_sha256": "3444022fa8f2220b9aa639cd009004683e71ef55a96dbb3a5ac01cb7023ce662"
  }
}
---

# Alojamientos y colaboradores — contexto funcional para NodiaAI

Estado actual: esta revisión publica sólo el fragmento «Lecturas disponibles en AI-15». Las secciones de implementación/evidencia anteriores a ese fragmento conservan la trazabilidad de entregas iniciales; sus frases históricas sobre publicación pendiente no sustituyen el frontmatter actual ni habilitan escrituras.

[Producto](../README.md). Metadatos canónicos migrados en [AI-06](../../../../mvp/52-nodia-ai-ai06-knowledge-publication-contract.md); esta revisión tiene autorización específica de publicación para las lecturas enumeradas al final; las demás operaciones conservan sus gates.

## Qué resuelve y qué significa

Configurar casas, capacidad y miembros; alojamiento no comparte identidad ni permisos con negocio comercial.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención y aclaración esperada |
|---|---|
| «Crea una casa para…» | Preguntar nombre y capacidad; no exigir tarifa/horarios. |
| «Dale acceso a esta casa a…» | Resolver candidato y confirmar miembro, no cambiar dueño. |
| «Cambia de dueño» | No hay campo editable para transferirlo en v1. |

Ejemplos ilustrativos sin resultados ni identificadores reales. Preguntar sólo obligatorios y ambigüedades; los opcionales no bloquean salvo condición del dominio.

## Operaciones y contratos

| Handler y ruta de referencia | Candidato del catálogo40 | Tratamiento vigente |
|---|---|---|
| [RentalCollaboratorController.createRentalCollaborator](../../../../../nodia-server/src/rental-collaborator/rental-collaborator.controller.ts)<br>`POST /api/v1/rental/properties/:propertyId/collaborators` | `nodia_rental_collaborators_prepare_create` (prepare_change, candidato40) | Candidato; sin publicar |
| [RentalCollaboratorController.getRentalCollaboratorCandidates](../../../../../nodia-server/src/rental-collaborator/rental-collaborator.controller.ts)<br>`GET /api/v1/rental/properties/:propertyId/collaborator-candidates` | `nodia_rental_collaborators_candidates` (read, candidato40) | Publicado en el release AI-15 de lecturas; disponibilidad observada por separado |
| [RentalCollaboratorController.getRentalCollaborators](../../../../../nodia-server/src/rental-collaborator/rental-collaborator.controller.ts)<br>`GET /api/v1/rental/properties/:propertyId/collaborators` | `nodia_rental_collaborators_list` (read, candidato40) | Publicado en el release AI-15 de lecturas; disponibilidad observada por separado |
| [RentalCollaboratorController.updateRentalCollaborator](../../../../../nodia-server/src/rental-collaborator/rental-collaborator.controller.ts)<br>`PUT /api/v1/rental/properties/:propertyId/collaborators/:id` | `nodia_rental_collaborators_prepare_update` (prepare_change, candidato40) | Candidato; sin publicar |
| [RentalPropertyController.createRentalProperty](../../../../../nodia-server/src/rental-property/rental-property.controller.ts)<br>`POST /api/v1/rental/properties` | `nodia_rental_properties_prepare_create` (prepare_change, candidato40) | Candidato; sin publicar |
| [RentalPropertyController.getRentalProperties](../../../../../nodia-server/src/rental-property/rental-property.controller.ts)<br>`GET /api/v1/rental/properties` | `nodia_rental_properties_list` (read, candidato40) | Publicado en el release AI-15 de lecturas; disponibilidad observada por separado |
| [RentalPropertyController.getRentalProperty](../../../../../nodia-server/src/rental-property/rental-property.controller.ts)<br>`GET /api/v1/rental/properties/:propertyId` | `nodia_rental_properties_get` (read, candidato40) | Publicado en el release AI-15 de lecturas; disponibilidad observada por separado |
| [RentalPropertyController.updateRentalProperty](../../../../../nodia-server/src/rental-property/rental-property.controller.ts)<br>`PUT /api/v1/rental/properties/:propertyId` | `nodia_rental_properties_prepare_update` (prepare_change, candidato40) | Candidato; sin publicar |

Los aliases de [inventario39](../../../../mvp/nodia-ai-current-endpoints.json) no crean capacidades distintas. Los nombres de operaciones proceden del catálogo documentado en [catálogo40](../../../../mvp/40-nodia-ai-tool-catalog-v1.md): sólo las lecturas enumeradas en esta revisión tienen binding explícito de publicación; las escrituras continúan candidatas.

DTOs de entrada/filtros: [rental-params.dto.ts](../../../../../nodia-server/src/rental-common/dto/rental-params.dto.ts), [create-rental-collaborator.dto.ts](../../../../../nodia-server/src/rental-collaborator/dto/create-rental-collaborator.dto.ts), [rental-configuration-query.dto.ts](../../../../../nodia-server/src/rental-property/dto/rental-configuration-query.dto.ts), [update-rental-collaborator.dto.ts](../../../../../nodia-server/src/rental-collaborator/dto/update-rental-collaborator.dto.ts), [create-rental-property.dto.ts](../../../../../nodia-server/src/rental-property/dto/create-rental-property.dto.ts), [update-rental-property.dto.ts](../../../../../nodia-server/src/rental-property/dto/update-rental-property.dto.ts)

Delegación actual (casos de uso/servicios según controlador): [create-rental-collaborator.use-case.ts](../../../../../nodia-server/src/rental-collaborator/use-case/create-rental-collaborator.use-case.ts), [get-rental-collaborator-candidates.use-case.ts](../../../../../nodia-server/src/rental-collaborator/use-case/get-rental-collaborator-candidates.use-case.ts), [get-rental-collaborators.use-case.ts](../../../../../nodia-server/src/rental-collaborator/use-case/get-rental-collaborators.use-case.ts), [update-rental-collaborator.use-case.ts](../../../../../nodia-server/src/rental-collaborator/use-case/update-rental-collaborator.use-case.ts), [create-rental-property.use-case.ts](../../../../../nodia-server/src/rental-property/use-case/create-rental-property.use-case.ts), [get-rental-properties.use-case.ts](../../../../../nodia-server/src/rental-property/use-case/get-rental-properties.use-case.ts), [get-rental-property.use-case.ts](../../../../../nodia-server/src/rental-property/use-case/get-rental-property.use-case.ts), [update-rental-property.use-case.ts](../../../../../nodia-server/src/rental-property/use-case/update-rental-property.use-case.ts)

## Datos mínimos y resolución de dudas

| Dato/operación | Obligatorio, condicional u opcional; resolución |
|---|---|
| Crear alojamiento | name y max_guests; owner de sesión. Zona interna validada por configuración, tarifa/abono habituales/ubicación/notas/actividad opcionales. |
| Colaborador | user_id existente de candidato autorizado; posición/actividad opcionales. No pedir email ni invitar cuentas inexistentes. |

Actor, permisos efectivos, claves de intención, versiones de concurrencia y referencias internas los controla Server; no los inventa ni decide el modelo. DTOs enlazados son fuente de campos, no un JSON Schema estricto de herramienta ya publicado.

## Reglas, acceso y restricciones

Horarios pertenecen a cada reserva; no exigir timezone/horarios legacy al usuario para crear casa. Cambiar zona después de reservas/bloqueos prohibido. Capacidad no puede invalidar reservas vigentes; mínimo de recambio no invalida aprobaciones sin conflicto. Política default se asigna después de crear política de esa casa. Configuración/miembros: dueño o super_admin activo conforme AI-08.

Destino /tools/reservations, key rental_reservations. AI-08 permite super_admin activo sobre cualquier alojamiento, incluida configuración/colaboradores; distingue membership.type=super_admin sin cambiar dueño. Los demás conservan pertenencia y capacidades nativas. Auditoría y recuperación mantienen actor real; NodiaAI exige sus módulos; AI-15 implementa las lecturas como puertos tipados; esta revisión publica sólo las lecturas enumeradas y conserva las etapas de escritura.

## Filtros e informes

Casas por nombre/activo, colaboradores posición/activo. Candidatos search3..100, límite20 y proyección id/name/image_url sin email. No exponer lista global de usuarios para resolver miembros sin ámbito.

El nuevo registro combinable de [contratos41](../../../../mvp/41-nodia-ai-v1-contracts.md) sigue pendiente AI-30/31; filtros REST existentes no autorizan joins, campos o SQL libres. [Política50](../../../../mvp/50-nodia-ai-ai04-runtime-policy.md) acota trabajo del chat y no reemplaza silenciosamente límites del módulo.

## Vista previa, confirmación y recuperación

Preview capacidad, defaults, zona cuando cambie y altas/bajas de miembros; revalidar dependencias bajo lock. Header idempotente nativo en cada mutación; creación de casa usa excepción actor/request_key previa a conocer property_id, no doble alta.

Desde NodiaAI, preparar es distinto de ejecutar: cambios requieren vista previa exacta y botón humano de41; el switch Web→Agentic no confirma. Conservar efectos completados si falla un paso dependiente y no reenviar un resultado desconocido. Payload del chat caduca según50 sin borrar registros de dominio ni sus journals nativos.

## Integración y evidencia

- [x] Fuentes de producto/backend, diferencias y mínimos revisados estáticamente en AI-05.
- [x] Correspondencia de handlers/candidatos y enlaces comprobada offline; no prueba de autorización/efectos.
- [ ] Schema de herramienta/proyección, autoridad y contexto registrados con AI-06/07 y familia pertinente.
- [ ] Casos de uso reales de acceso/ambigüedad, confirmación, concurrencia y recuperación verificados para NodiaAI.
- [ ] Adaptador/modalidades, publicación y aceptación operativa comprobados.

Pendientes con efecto sobre disponibilidad: AI-24: integración del contexto/bridge del journal; super_admin real implementado en AI-08, no publicar membresía sólo por fiche.

## Evolución y compatibilidad

| Revisión | Cambio y fuentes | Contexto y propuestas |
|---|---|---|
| 1 | AI-05: explicación inicial a partir de contratos/código enlazados | Sin cambio de backend ni publicación. Al cambiar reglas/DTOs, actualizar ficha/schema/registro, invalidar propuestas incompatibles y mantener recuperación original |


Actualización AI-08: [autoridad compartida](../../../../mvp/54-nodia-ai-ai08-transversal-authority.md). Destinatarios, actor real y reglas nativas se validan en transacción. En Ajustes Generales se protegen último super_admin, rol reservado, key de módulos y asociaciones atómicas; esto no incorpora herramientas MCP administrativas.

## Historial de la implementación inicial de lecturas AI-15

Puertos nodia_rental_properties_list/get y nodia_rental_collaborators_list/candidates comparten sus casos de uso nativos. Cada lectura y replay relee sesión y pertenencia; candidatos exige dueño o super_admin vigente. list aplica actividad y filtros name_cont/position_cont autorizados, sin aceptar actor o membresía en argumentos. Paginación propia del chat: 25 por defecto, máximo 100; candidatos queda limitado al máximo nativo de 20.

En la entrega inicial, la metadata permanecía draft/unregistered y approval null; el frontmatter actual y la sección de lectura publicada sustituyen ese estado histórico. Esta implementación no activa herramientas por el nombre del proveedor ni permite llamadas Web; Agentic, conocimiento revisado, contrato congelado y permisos actuales conservan sus gates.

El replay de un listado/detalle de alojamientos contrasta además todos los IDs, dueños y flags de membresía devueltos con autoridad actual en un único batch. Una colaboración o rol revocado invalida el resultado previo; el manager sigue siendo el checkpoint.


## Lecturas disponibles en AI-15

Consultar colaboradores y candidatos conforme al permiso nativo. La lista de candidatos requiere la autoridad de dueño o super_admin; no concede membresía.

Consultar alojamientos y datos visibles conforme a la pertenencia vigente o super_admin. Un resultado almacenado se reautoriza si cambia la membresía.

Herramientas de esta sección: `nodia_rental_collaborators_candidates`, `nodia_rental_collaborators_list`, `nodia_rental_properties_get`, `nodia_rental_properties_list`.

Resolver entidades, destinatario, intervalo y filtros ambiguos antes de llamar. Usar sólo los campos del schema de la herramienta. Conservar IDs y dinero exactos, cero y falso; ausencia o unknown no equivalen a cero. La paginación y los límites de resultados deben comunicarse y una página no representa el universo completo. En recursos con actividad, iniciar Activo y usar Inactivo/Todos sólo cuando se soliciten; Todos omite el filtro.

Server valida sesión, módulo NodiaAI y todos los módulos destino actuales para usuarios ordinarios; super_admin conserva transversalidad y las reglas de dominio. Datos privados y autoridad se revalidan al devolver o recuperar resultados. Finanzas permite owner_id ajeno sólo a super_admin; Reservas conserva autoridad actual del alojamiento; administración IA conserva ai:manage. No construir SQL libre ni pedir tokens, cookies o secretos.

Esta publicación incluye lecturas y referencias privadas, no preparaciones ni ejecución de escrituras. Cualquier creación, edición, eliminación o confirmación conserva sus herramientas y etapas posteriores. No anunciar informes cruzados, un total por proveedor u otros filtros/agrupaciones si el schema o caso de uso no los soporta. Web permanece conversacional; MCP sólo se ejecuta mediante Agentic verificado, con delegación Web→Agentic opt-in de la misma conexión.

Las observaciones externas se ejecutan fuera de SQL, con deadline/cancelación y verificación posterior de autoridad y configuración. La recuperación de una llamada completada no repite red; una llamada interrumpida no se reintenta ciegamente. Los artefactos son referencias privadas current_on_download: la descarga humana reautoriza chat/recurso, rechaza exceso sin truncar y no conserva el archivo al expirar el chat; el original de factura pertenece al negocio.
