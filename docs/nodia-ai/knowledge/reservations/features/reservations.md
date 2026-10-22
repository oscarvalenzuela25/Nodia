---
{
  "schema_version": 1,
  "document_id": "reservations.reservations",
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
      "path": "nodia-server/src/rental-reservation/entities/rental-reservation.entity.ts",
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
    "content_sha256": "a5dd403c338c3cc862d327456ef2f8962c6ac609e8b4174c08a86ec99c8fafed"
  }
}
---

# Reservas y transiciones — contexto funcional para NodiaAI

Estado actual: esta revisión publica sólo el fragmento «Lecturas disponibles en AI-15». Las secciones de implementación/evidencia anteriores a ese fragmento conservan la trazabilidad de entregas iniciales; sus frases históricas sobre publicación pendiente no sustituyen el frontmatter actual ni habilitan escrituras.

[Producto](../README.md). Metadatos canónicos migrados en [AI-06](../../../../mvp/52-nodia-ai-ai06-knowledge-publication-contract.md); esta revisión tiene autorización específica de publicación para las lecturas enumeradas al final; las demás operaciones conservan sus gates.

## Qué resuelve y qué significa

Capturar el acuerdo de estadía como borrador, confirmarlo y registrar inicio/fin/cancelación bajo reglas verificadas. Crear no ocupa fechas.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención y aclaración esperada |
|---|---|
| «Reserva desde…hasta…» | Pedir casa, fechas/horas y todos los mínimos; crear draft con preview. |
| «Confírmala» | Releer abono/política/availability y preparación; pedir lo faltante sin fabricar pago. |
| «Cancela la reserva y devuelve» | Mostrar cancelación y devolución como efectos distintos; preguntar resolución si plataforma. |

Ejemplos ilustrativos sin resultados ni identificadores reales. Preguntar sólo obligatorios y ambigüedades; los opcionales no bloquean salvo condición del dominio.

## Operaciones y contratos

| Handler y ruta de referencia | Candidato del catálogo40 | Tratamiento vigente |
|---|---|---|
| [RentalReservationController.cancelRentalReservation](../../../../../nodia-server/src/rental-reservation/rental-reservation.controller.ts)<br>`POST /api/v1/rental/properties/:propertyId/reservations/:id/cancel` | `nodia_rental_reservations_prepare_cancel` (prepare_change, candidato40) | Candidato; sin publicar |
| [RentalReservationController.completeRentalReservation](../../../../../nodia-server/src/rental-reservation/rental-reservation.controller.ts)<br>`POST /api/v1/rental/properties/:propertyId/reservations/:id/complete` | `nodia_rental_reservations_prepare_complete` (prepare_change, candidato40) | Candidato; sin publicar |
| [RentalReservationController.confirmRentalReservation](../../../../../nodia-server/src/rental-reservation/rental-reservation.controller.ts)<br>`POST /api/v1/rental/properties/:propertyId/reservations/:id/confirm` | `nodia_rental_reservations_prepare_confirm` (prepare_change, candidato40) | Candidato; sin publicar |
| [RentalReservationController.createRentalReservation](../../../../../nodia-server/src/rental-reservation/rental-reservation.controller.ts)<br>`POST /api/v1/rental/properties/:propertyId/reservations` | `nodia_rental_reservations_prepare_create` (prepare_change, candidato40) | Candidato; sin publicar |
| [RentalReservationController.getRentalReservation](../../../../../nodia-server/src/rental-reservation/rental-reservation.controller.ts)<br>`GET /api/v1/rental/properties/:propertyId/reservations/:id` | `nodia_rental_reservations_get` (read, candidato40) | Publicado en el release AI-15 de lecturas; disponibilidad observada por separado |
| [RentalReservationController.listRentalReservation](../../../../../nodia-server/src/rental-reservation/rental-reservation.controller.ts)<br>`GET /api/v1/rental/properties/:propertyId/reservations` | `nodia_rental_reservations_list` (read, candidato40) | Publicado en el release AI-15 de lecturas; disponibilidad observada por separado |
| [RentalReservationController.previewRentalCancellation](../../../../../nodia-server/src/rental-reservation/rental-reservation.controller.ts)<br>`POST /api/v1/rental/properties/:propertyId/reservations/:id/cancellation-preview` | `nodia_rental_reservations_cancellation_preview` (read, candidato40) | Publicado en el release AI-15 de lecturas; disponibilidad observada por separado |
| [RentalReservationController.startRentalReservation](../../../../../nodia-server/src/rental-reservation/rental-reservation.controller.ts)<br>`POST /api/v1/rental/properties/:propertyId/reservations/:id/start` | `nodia_rental_reservations_prepare_start` (prepare_change, candidato40) | Candidato; sin publicar |
| [RentalReservationController.updateRentalReservation](../../../../../nodia-server/src/rental-reservation/rental-reservation.controller.ts)<br>`PUT /api/v1/rental/properties/:propertyId/reservations/:id` | `nodia_rental_reservations_prepare_update` (prepare_change, candidato40) | Candidato; sin publicar |

Los aliases de [inventario39](../../../../mvp/nodia-ai-current-endpoints.json) no crean capacidades distintas. Los nombres de operaciones proceden del catálogo documentado en [catálogo40](../../../../mvp/40-nodia-ai-tool-catalog-v1.md): sólo las lecturas enumeradas en esta revisión tienen binding explícito de publicación; las escrituras continúan candidatas.

DTOs de entrada/filtros: [rental-params.dto.ts](../../../../../nodia-server/src/rental-common/dto/rental-params.dto.ts), [reservation-commands.dto.ts](../../../../../nodia-server/src/rental-reservation/dto/reservation-commands.dto.ts), [create-rental-reservation.dto.ts](../../../../../nodia-server/src/rental-reservation/dto/create-rental-reservation.dto.ts), [rental-reservation-query.dto.ts](../../../../../nodia-server/src/rental-reservation/dto/rental-reservation-query.dto.ts), [update-rental-reservation.dto.ts](../../../../../nodia-server/src/rental-reservation/dto/update-rental-reservation.dto.ts)

Delegación actual (casos de uso/servicios según controlador): [cancel-rental-reservation.use-case.ts](../../../../../nodia-server/src/rental-reservation/use-case/cancel-rental-reservation.use-case.ts), [complete-rental-reservation.use-case.ts](../../../../../nodia-server/src/rental-reservation/use-case/complete-rental-reservation.use-case.ts), [confirm-rental-reservation.use-case.ts](../../../../../nodia-server/src/rental-reservation/use-case/confirm-rental-reservation.use-case.ts), [create-rental-reservation.use-case.ts](../../../../../nodia-server/src/rental-reservation/use-case/create-rental-reservation.use-case.ts), [get-rental-reservation.use-case.ts](../../../../../nodia-server/src/rental-reservation/use-case/get-rental-reservation.use-case.ts), [list-rental-reservation.use-case.ts](../../../../../nodia-server/src/rental-reservation/use-case/list-rental-reservation.use-case.ts), [preview-rental-cancellation.use-case.ts](../../../../../nodia-server/src/rental-reservation/use-case/preview-rental-cancellation.use-case.ts), [start-rental-reservation.use-case.ts](../../../../../nodia-server/src/rental-reservation/use-case/start-rental-reservation.use-case.ts), [update-rental-reservation.use-case.ts](../../../../../nodia-server/src/rental-reservation/use-case/update-rental-reservation.use-case.ts)

## Datos mínimos y resolución de dudas

| Dato/operación | Obligatorio, condicional u opcional; resolución |
|---|---|
| Crear draft | Alojamiento; guest_name, guest_contact, guests_count, channel, check_in_on/check_out_on y ambos horarios propios; nightly_rate y deposit_amount explícitos. |
| Condicionales | Directo necesita política y abono>0 para primer pago/confirmación. Airbnb requiere abono0/política local null y referencia/condiciones externas al primer pago/confirmar. Limpieza/descuento/comisión/notas/plazos opcionales. |

Actor, permisos efectivos, claves de intención, versiones de concurrencia y referencias internas los controla Server; no los inventa ni decide el modelo. DTOs enlazados son fuente de campos, no un JSON Schema estricto de herramienta ya publicado.

## Reglas, acceso y restricciones

Canales whatsapp/airbnb/facebook/other; other sigue flujo directo, no integración nueva. Estado no se edita por PUT. Draft sin filas monetarias permite revisar acuerdo; desde cualquier pago, aun voided, o confirmación sólo huésped/contacto/notas/activo. Total/noches/instantes se derivan; no precio/horario inventado. Confirmar relee disponibilidad/vecinos y abono/condiciones; start exige horario y preparación real; complete requiere in_progress y checkout cumplido. Sin transición inversa ni cierre retrospectivo ficticio.

Destino /tools/reservations, key rental_reservations. AI-08 permite super_admin activo sobre cualquier alojamiento, incluida configuración/colaboradores; distingue membership.type=super_admin sin cambiar dueño. Los demás conservan pertenencia y capacidades nativas. Auditoría y recuperación mantienen actor real; NodiaAI exige sus módulos; AI-15 implementa las lecturas como puertos tipados; esta revisión publica sólo las lecturas enumeradas y conserva las etapas de escritura.

## Filtros e informes

Lista por actividad/estado/canal/huésped/referencia y ventana civil; detalle diferencia T bruto, E esperado, recibido/neto/saldos y snapshot. Canceladas saldo a cobrar0 pero devolución pendiente F−R; archivadas ocupantes siguen contando. No confirmar sólo porque hay dinero.

El nuevo registro combinable de [contratos41](../../../../mvp/41-nodia-ai-v1-contracts.md) sigue pendiente AI-30/31; filtros REST existentes no autorizan joins, campos o SQL libres. [Política50](../../../../mvp/50-nodia-ai-ai04-runtime-policy.md) acota trabajo del chat y no reemplaza silenciosamente límites del módulo.

## Vista previa, confirmación y recuperación

Cada transición es propuesta y botón, no cambio de status por el modelo. Cancelación primero preview sin efecto; cancel recalcula expected_refund_amount bajo lock y409 si varió. Dinero recibido/devolución son comandos separados. Conservar request_key/hash/actor nativos en recovery; no reenviar unknown.

Desde NodiaAI, preparar es distinto de ejecutar: cambios requieren vista previa exacta y botón humano de41; el switch Web→Agentic no confirma. Conservar efectos completados si falla un paso dependiente y no reenviar un resultado desconocido. Payload del chat caduca según50 sin borrar registros de dominio ni sus journals nativos.

## Integración y evidencia

- [x] Fuentes de producto/backend, diferencias y mínimos revisados estáticamente en AI-05.
- [x] Correspondencia de handlers/candidatos y enlaces comprobada offline; no prueba de autorización/efectos.
- [ ] Schema de herramienta/proyección, autoridad y contexto registrados con AI-06/07 y familia pertinente.
- [ ] Casos de uso reales de acceso/ambigüedad, confirmación, concurrencia y recuperación verificados para NodiaAI.
- [ ] Adaptador/modalidades, publicación y aceptación operativa comprobados.

Pendientes con efecto sobre disponibilidad: AI-24..26: integración de snapshots, disponibilidad bajo lock y composición idempotente; alcance transversal implementado en AI-08, sin nuevos DELETE/holds.

## Evolución y compatibilidad

| Revisión | Cambio y fuentes | Contexto y propuestas |
|---|---|---|
| 1 | AI-05: explicación inicial a partir de contratos/código enlazados | Sin cambio de backend ni publicación. Al cambiar reglas/DTOs, actualizar ficha/schema/registro, invalidar propuestas incompatibles y mantener recuperación original |


Actualización AI-08: [autoridad compartida](../../../../mvp/54-nodia-ai-ai08-transversal-authority.md). Destinatarios, actor real y reglas nativas se validan en transacción. En Ajustes Generales se protegen último super_admin, rol reservado, key de módulos y asociaciones atómicas; esto no incorpora herramientas MCP administrativas.

## Historial de la implementación inicial de lecturas AI-15

nodia_rental_reservations_list/get y nodia_rental_reservations_cancellation_preview están implementados como puertos candidatos de sólo lectura. La consulta admite guest_name_cont, external_reference_cont, estados/canales permitidos, actividad y ventana de estadía; conserva importes enteros CLP como strings y snapshots versionados. La simulación exige cancelled_at y aplica refund_amount/resolution_note cuando las reglas nativas lo requieren; no cancela, crea auditoría ni reserva una propuesta de escritura.

En la entrega inicial, la metadata permanecía draft/unregistered y approval null; el frontmatter actual y la sección de lectura publicada sustituyen ese estado histórico. Esta implementación no activa herramientas por el nombre del proveedor ni permite llamadas Web; Agentic, conocimiento revisado, contrato congelado y permisos actuales conservan sus gates.


## Lecturas disponibles en AI-15

Consultar reservas y la simulación nativa de cancelación. cancellation_preview es una lectura: no cancela ni confirma la reserva. Resolver alojamiento, reserva e intervalo ambiguos.

Consultar el resumen nativo de Reservas. Mantener procedencia y moneda; no tratarlo como un informe cruzado con Finanzas personales.

Herramientas de esta sección: `nodia_rental_reservations_cancellation_preview`, `nodia_rental_reservations_get`, `nodia_rental_reservations_list`, `nodia_rental_summaries_overview`.

Resolver entidades, destinatario, intervalo y filtros ambiguos antes de llamar. Usar sólo los campos del schema de la herramienta. Conservar IDs y dinero exactos, cero y falso; ausencia o unknown no equivalen a cero. La paginación y los límites de resultados deben comunicarse y una página no representa el universo completo. En recursos con actividad, iniciar Activo y usar Inactivo/Todos sólo cuando se soliciten; Todos omite el filtro.

Server valida sesión, módulo NodiaAI y todos los módulos destino actuales para usuarios ordinarios; super_admin conserva transversalidad y las reglas de dominio. Datos privados y autoridad se revalidan al devolver o recuperar resultados. Finanzas permite owner_id ajeno sólo a super_admin; Reservas conserva autoridad actual del alojamiento; administración IA conserva ai:manage. No construir SQL libre ni pedir tokens, cookies o secretos.

Esta publicación incluye lecturas y referencias privadas, no preparaciones ni ejecución de escrituras. Cualquier creación, edición, eliminación o confirmación conserva sus herramientas y etapas posteriores. No anunciar informes cruzados, un total por proveedor u otros filtros/agrupaciones si el schema o caso de uso no los soporta. Web permanece conversacional; MCP sólo se ejecuta mediante Agentic verificado, con delegación Web→Agentic opt-in de la misma conexión.

Las observaciones externas se ejecutan fuera de SQL, con deadline/cancelación y verificación posterior de autoridad y configuración. La recuperación de una llamada completada no repite red; una llamada interrumpida no se reintenta ciegamente. Los artefactos son referencias privadas current_on_download: la descarga humana reautoriza chat/recurso, rechaza exceso sin truncar y no conserva el archivo al expirar el chat; el original de factura pertenece al negocio.
