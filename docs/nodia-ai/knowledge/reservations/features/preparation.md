---
{
  "schema_version": 1,
  "document_id": "reservations.preparation",
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
      "path": "nodia-server/src/rental-turnover/entities/rental-turnover.entity.ts",
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
    "content_sha256": "223a845a72f056d9337736b6706f54a688e8cfc020fb4aea2aa04eed7c6fd71c"
  }
}
---

# Preparación y recambio — contexto funcional para NodiaAI

Estado actual: esta revisión publica sólo el fragmento «Lecturas disponibles en AI-15». Las secciones de implementación/evidencia anteriores a ese fragmento conservan la trazabilidad de entregas iniciales; sus frases históricas sobre publicación pendiente no sustituyen el frontmatter actual ni habilitan escrituras.

[Producto](../README.md). Metadatos canónicos migrados en [AI-06](../../../../mvp/52-nodia-ai-ai06-knowledge-publication-contract.md); esta revisión tiene autorización específica de publicación para las lecturas enumeradas al final; las demás operaciones conservan sus gates.

## Qué resuelve y qué significa

Planificar limpieza/ropa y registrar preparación real de la entrada; aprobación del plan no significa trabajo terminado.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención y aclaración esperada |
|---|---|
| «Deja lista la llegada» | Aclarar si plan o hecho real; pedir sólo información necesaria. |
| «Hay salida y entrada el mismo día» | Consultar requisitos/vecinos y preparar/aprobar plan antes de confirmar. |
| «Marca limpieza hecha para que deje entrar» | No fabricar hecho/instante; pedir estado real. |

Ejemplos ilustrativos sin resultados ni identificadores reales. Preguntar sólo obligatorios y ambigüedades; los opcionales no bloquean salvo condición del dominio.

## Operaciones y contratos

| Handler y ruta de referencia | Candidato del catálogo40 | Tratamiento vigente |
|---|---|---|
| [RentalTurnoverController.approveSameDayRentalTurnover](../../../../../nodia-server/src/rental-turnover/rental-turnover.controller.ts)<br>`POST /api/v1/rental/properties/:propertyId/turnovers/:id/approve-same-day` | `nodia_rental_turnovers_prepare_approve_same_day` (prepare_change, candidato40) | Candidato; sin publicar |
| [RentalTurnoverController.getRentalTurnover](../../../../../nodia-server/src/rental-turnover/rental-turnover.controller.ts)<br>`GET /api/v1/rental/properties/:propertyId/turnovers/:id` | `nodia_rental_turnovers_get` (read, candidato40) | Publicado en el release AI-15 de lecturas; disponibilidad observada por separado |
| [RentalTurnoverController.listRentalTurnover](../../../../../nodia-server/src/rental-turnover/rental-turnover.controller.ts)<br>`GET /api/v1/rental/properties/:propertyId/turnovers` | `nodia_rental_turnovers_list` (read, candidato40) | Publicado en el release AI-15 de lecturas; disponibilidad observada por separado |
| [RentalTurnoverController.updateRentalTurnover](../../../../../nodia-server/src/rental-turnover/rental-turnover.controller.ts)<br>`PUT /api/v1/rental/properties/:propertyId/turnovers/:id` | `nodia_rental_turnovers_prepare_update` (prepare_change, candidato40) | Candidato; sin publicar |

Los aliases de [inventario39](../../../../mvp/nodia-ai-current-endpoints.json) no crean capacidades distintas. Los nombres de operaciones proceden del catálogo documentado en [catálogo40](../../../../mvp/40-nodia-ai-tool-catalog-v1.md): sólo las lecturas enumeradas en esta revisión tienen binding explícito de publicación; las escrituras continúan candidatas.

DTOs de entrada/filtros: [rental-params.dto.ts](../../../../../nodia-server/src/rental-common/dto/rental-params.dto.ts), [reservation-commands.dto.ts](../../../../../nodia-server/src/rental-reservation/dto/reservation-commands.dto.ts), [rental-turnover-query.dto.ts](../../../../../nodia-server/src/rental-turnover/dto/rental-turnover-query.dto.ts), [update-rental-turnover.dto.ts](../../../../../nodia-server/src/rental-turnover/dto/update-rental-turnover.dto.ts)

Delegación actual (casos de uso/servicios según controlador): [approve-same-day-rental-turnover.use-case.ts](../../../../../nodia-server/src/rental-turnover/use-case/approve-same-day-rental-turnover.use-case.ts), [get-rental-turnover.use-case.ts](../../../../../nodia-server/src/rental-turnover/use-case/get-rental-turnover.use-case.ts), [list-rental-turnover.use-case.ts](../../../../../nodia-server/src/rental-turnover/use-case/list-rental-turnover.use-case.ts), [update-rental-turnover.use-case.ts](../../../../../nodia-server/src/rental-turnover/use-case/update-rental-turnover.use-case.ts)

## Datos mínimos y resolución de dudas

| Dato/operación | Obligatorio, condicional u opcional; resolución |
|---|---|
| Origen | Turnover creado con el draft; incoming/previous derivados por Server, sin POST público para crearlo. |
| Editar | linen_ready boolean/null, cleaning_status, planned_ready_at/ready_at/notas opcionales. Aprobar mismo día recibe{} y revalida transición. |

Actor, permisos efectivos, claves de intención, versiones de concurrencia y referencias internas los controla Server; no los inventa ni decide el modelo. DTOs enlazados son fuente de campos, no un JSON Schema estricto de herramienta ya publicado.

## Reglas, acceso y restricciones

Plan exige ventana checkout previo+minimum_turnover_minutes≤preparación≤checkin; mismo día requiere recambio disponible y aprobación vigente. ready_at real sólo con ropa lista y cleaning completed, no futuro/antes de salida previa. Start exige preparación real vigente; no inventar hora para permitir entrada. Cambios materiales de vecinos/plan invalidan aprobaciones/hechos incompatibles.

Destino /tools/reservations, key rental_reservations. AI-08 permite super_admin activo sobre cualquier alojamiento, incluida configuración/colaboradores; distingue membership.type=super_admin sin cambiar dueño. Los demás conservan pertenencia y capacidades nativas. Auditoría y recuperación mantienen actor real; NodiaAI exige sus módulos; AI-15 implementa las lecturas como puertos tipados; esta revisión publica sólo las lecturas enumeradas y conserva las etapas de escritura.

## Filtros e informes

Filtrar cleaning_status/incoming/linen_ready true,false,unknown y fechas de checkin. null es desconocido, no false. Sin gastos automáticos ni conteos completos deducidos de próximas listas.

El nuevo registro combinable de [contratos41](../../../../mvp/41-nodia-ai-v1-contracts.md) sigue pendiente AI-30/31; filtros REST existentes no autorizan joins, campos o SQL libres. [Política50](../../../../mvp/50-nodia-ai-ai04-runtime-policy.md) acota trabajo del chat y no reemplaza silenciosamente límites del módulo.

## Vista previa, confirmación y recuperación

Preview distingue plan/ejecución y aprobación; no fijar same_day_approved_at desde texto. Comandos nativos bajo lock/idempotencia; confirm puede aprobar atómicamente sólo turnovers afectados con plan válido. Sin crear approvals arbitrarios.

Desde NodiaAI, preparar es distinto de ejecutar: cambios requieren vista previa exacta y botón humano de41; el switch Web→Agentic no confirma. Conservar efectos completados si falla un paso dependiente y no reenviar un resultado desconocido. Payload del chat caduca según50 sin borrar registros de dominio ni sus journals nativos.

## Integración y evidencia

- [x] Fuentes de producto/backend, diferencias y mínimos revisados estáticamente en AI-05.
- [x] Correspondencia de handlers/candidatos y enlaces comprobada offline; no prueba de autorización/efectos.
- [ ] Schema de herramienta/proyección, autoridad y contexto registrados con AI-06/07 y familia pertinente.
- [ ] Casos de uso reales de acceso/ambigüedad, confirmación, concurrencia y recuperación verificados para NodiaAI.
- [ ] Adaptador/modalidades, publicación y aceptación operativa comprobados.

Pendientes con efecto sobre disponibilidad: AI-25: validar transiciones cambiantes y confirmación conjunta con reservas.

## Evolución y compatibilidad

| Revisión | Cambio y fuentes | Contexto y propuestas |
|---|---|---|
| 1 | AI-05: explicación inicial a partir de contratos/código enlazados | Sin cambio de backend ni publicación. Al cambiar reglas/DTOs, actualizar ficha/schema/registro, invalidar propuestas incompatibles y mantener recuperación original |


Actualización AI-08: [autoridad compartida](../../../../mvp/54-nodia-ai-ai08-transversal-authority.md). Destinatarios, actor real y reglas nativas se validan en transacción. En Ajustes Generales se protegen último super_admin, rol reservado, key de módulos y asociaciones atómicas; esto no incorpora herramientas MCP administrativas.

## Historial de la implementación inicial de lecturas AI-15

nodia_rental_turnovers_list/get reutiliza las reglas nativas de preparación. Consulta estados de limpieza, linen_ready true/false/unknown, reserva entrante, rango civil y orden planned_ready_at. El detalle calcula predecesora actual, validez del plan y necesidad de aprobación; no modifica las aprobaciones o el plan. IDs permanecen strings y ausencia de predecesora se representa null.

En la entrega inicial, la metadata permanecía draft/unregistered y approval null; el frontmatter actual y la sección de lectura publicada sustituyen ese estado histórico. Esta implementación no activa herramientas por el nombre del proveedor ni permite llamadas Web; Agentic, conocimiento revisado, contrato congelado y permisos actuales conservan sus gates.


## Lecturas disponibles en AI-15

Consultar preparaciones y estado del alojamiento, sin marcarlas completadas ni reemplazar la disponibilidad nativa.

Herramientas de esta sección: `nodia_rental_turnovers_get`, `nodia_rental_turnovers_list`.

Resolver entidades, destinatario, intervalo y filtros ambiguos antes de llamar. Usar sólo los campos del schema de la herramienta. Conservar IDs y dinero exactos, cero y falso; ausencia o unknown no equivalen a cero. La paginación y los límites de resultados deben comunicarse y una página no representa el universo completo. En recursos con actividad, iniciar Activo y usar Inactivo/Todos sólo cuando se soliciten; Todos omite el filtro.

Server valida sesión, módulo NodiaAI y todos los módulos destino actuales para usuarios ordinarios; super_admin conserva transversalidad y las reglas de dominio. Datos privados y autoridad se revalidan al devolver o recuperar resultados. Finanzas permite owner_id ajeno sólo a super_admin; Reservas conserva autoridad actual del alojamiento; administración IA conserva ai:manage. No construir SQL libre ni pedir tokens, cookies o secretos.

Esta publicación incluye lecturas y referencias privadas, no preparaciones ni ejecución de escrituras. Cualquier creación, edición, eliminación o confirmación conserva sus herramientas y etapas posteriores. No anunciar informes cruzados, un total por proveedor u otros filtros/agrupaciones si el schema o caso de uso no los soporta. Web permanece conversacional; MCP sólo se ejecuta mediante Agentic verificado, con delegación Web→Agentic opt-in de la misma conexión.

Las observaciones externas se ejecutan fuera de SQL, con deadline/cancelación y verificación posterior de autoridad y configuración. La recuperación de una llamada completada no repite red; una llamada interrumpida no se reintenta ciegamente. Los artefactos son referencias privadas current_on_download: la descarga humana reautoriza chat/recurso, rechaza exceso sin truncar y no conserva el archivo al expirar el chat; el original de factura pertenece al negocio.
