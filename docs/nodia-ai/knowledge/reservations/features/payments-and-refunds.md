---
{
  "schema_version": 1,
  "document_id": "reservations.payments-and-refunds",
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
      "path": "nodia-server/src/rental-payment/entities/rental-payment.entity.ts",
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
    "content_sha256": "a701e2b12ca9dd1de333306d1d1834c0828214fdbf33517b84de958e30d4e8f3"
  }
}
---

# Pagos y devoluciones — contexto funcional para NodiaAI

Estado actual: esta revisión publica sólo el fragmento «Lecturas disponibles en AI-15». Las secciones de implementación/evidencia anteriores a ese fragmento conservan la trazabilidad de entregas iniciales; sus frases históricas sobre publicación pendiente no sustituyen el frontmatter actual ni habilitan escrituras.

[Producto](../README.md). Metadatos canónicos migrados en [AI-06](../../../../mvp/52-nodia-ai-ai06-knowledge-publication-contract.md); esta revisión tiene autorización específica de publicación para las lecturas enumeradas al final; las demás operaciones conservan sus gates.

## Qué resuelve y qué significa

Registrar dinero efectivamente recibido o devuelto; no ordenar transferencias bancarias ni crear pagos pendientes.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención y aclaración esperada |
|---|---|
| «Entró el abono» | Pedir reserva, importe y fecha real; confirmar es otra operación. |
| «Devuelve lo pendiente» | Aclarar si ya se devolvió; sólo registrar dinero efectivo, no una promesa. |
| «Edita el importe de ese pago» | Ofrecer corrección con anulación y nueva captura, respetando bloqueos. |

Ejemplos ilustrativos sin resultados ni identificadores reales. Preguntar sólo obligatorios y ambigüedades; los opcionales no bloquean salvo condición del dominio.

## Operaciones y contratos

| Handler y ruta de referencia | Candidato del catálogo40 | Tratamiento vigente |
|---|---|---|
| [RentalPaymentController.createRentalPayment](../../../../../nodia-server/src/rental-payment/rental-payment.controller.ts)<br>`POST /api/v1/rental/properties/:propertyId/payments` | `nodia_rental_payments_prepare_create` (prepare_change, candidato40) | Candidato; sin publicar |
| [RentalPaymentController.getRentalPayments](../../../../../nodia-server/src/rental-payment/rental-payment.controller.ts)<br>`GET /api/v1/rental/properties/:propertyId/payments` | `nodia_rental_payments_list` (read, candidato40) | Publicado en el release AI-15 de lecturas; disponibilidad observada por separado |
| [RentalPaymentController.getRentalPayment](../../../../../nodia-server/src/rental-payment/rental-payment.controller.ts)<br>`GET /api/v1/rental/properties/:propertyId/payments/:id` | `nodia_rental_payments_get` (read, candidato40) | Publicado en el release AI-15 de lecturas; disponibilidad observada por separado |
| [RentalPaymentController.voidRentalPayment](../../../../../nodia-server/src/rental-payment/rental-payment.controller.ts)<br>`POST /api/v1/rental/properties/:propertyId/payments/:id/void` | `nodia_rental_payments_prepare_void` (prepare_change, candidato40) | Candidato; sin publicar |

Los aliases de [inventario39](../../../../mvp/nodia-ai-current-endpoints.json) no crean capacidades distintas. Los nombres de operaciones proceden del catálogo documentado en [catálogo40](../../../../mvp/40-nodia-ai-tool-catalog-v1.md): sólo las lecturas enumeradas en esta revisión tienen binding explícito de publicación; las escrituras continúan candidatas.

DTOs de entrada/filtros: [rental-params.dto.ts](../../../../../nodia-server/src/rental-common/dto/rental-params.dto.ts), [rental-payment.dto.ts](../../../../../nodia-server/src/rental-payment/dto/rental-payment.dto.ts)

Delegación actual (casos de uso/servicios según controlador): [create-rental-payment.use-case.ts](../../../../../nodia-server/src/rental-payment/use-case/create-rental-payment.use-case.ts), [get-rental-payments.use-case.ts](../../../../../nodia-server/src/rental-payment/use-case/get-rental-payments.use-case.ts), [void-rental-payment.use-case.ts](../../../../../nodia-server/src/rental-payment/use-case/void-rental-payment.use-case.ts)

## Datos mínimos y resolución de dudas

| Dato/operación | Obligatorio, condicional u opcional; resolución |
|---|---|
| Crear | Casa/reservation_id, type payment/refund, amount string positivo y occurred_on civil no futuro; método/referencia/notas opcionales. |
| Primer pago y anulación | Directo requiere acuerdo válido con abono y snapshot; primer Airbnb requiere referencia y platform_policy. Void exige reason. |

Actor, permisos efectivos, claves de intención, versiones de concurrencia y referencias internas los controla Server; no los inventa ni decide el modelo. DTOs enlazados son fuente de campos, no un JSON Schema estricto de herramienta ya publicado.

## Reglas, acceso y restricciones

Payment confirmed sin status editable, sin PUT; corregir con void y nuevo registro con intención nueva. Cobros no exceden E−P; refund sólo cancelled y≤F−R, no anterior a fecha local de cancelación. Cancelar reserva no registra refund efectivo. Void no devuelve dinero; límites de abono y base congelada restringen anulación tras confirmar/cancelar.

Destino /tools/reservations, key rental_reservations. AI-08 permite super_admin activo sobre cualquier alojamiento, incluida configuración/colaboradores; distingue membership.type=super_admin sin cambiar dueño. Los demás conservan pertenencia y capacidades nativas. Auditoría y recuperación mantienen actor real; NodiaAI exige sus módulos; AI-15 implementa las lecturas como puertos tipados; esta revisión publica sólo las lecturas enumeradas y conserva las etapas de escritura.

## Filtros e informes

Lista por reserva/type/status, referencia y occurred_on [from,to). Caja cuenta confirmed; voided conserva historia y no cuenta. Airbnb registra liquidación neta, sin registrar además bruto y gasto de la misma comisión.

El nuevo registro combinable de [contratos41](../../../../mvp/41-nodia-ai-v1-contracts.md) sigue pendiente AI-30/31; filtros REST existentes no autorizan joins, campos o SQL libres. [Política50](../../../../mvp/50-nodia-ai-ai04-runtime-policy.md) acota trabajo del chat y no reemplaza silenciosamente límites del módulo.

## Vista previa, confirmación y recuperación

Preview reserva, dirección, importe, fecha y saldo resultante; no inferir que una referencia libre deduplica un banco. Same request_key/hash recupera efecto original; consultar GET recurso para su estado actual. Paso posterior fallido no revierte dinero creado.

Desde NodiaAI, preparar es distinto de ejecutar: cambios requieren vista previa exacta y botón humano de41; el switch Web→Agentic no confirma. Conservar efectos completados si falla un paso dependiente y no reenviar un resultado desconocido. Payload del chat caduca según50 sin borrar registros de dominio ni sus journals nativos.

## Integración y evidencia

- [x] Fuentes de producto/backend, diferencias y mínimos revisados estáticamente en AI-05.
- [x] Correspondencia de handlers/candidatos y enlaces comprobada offline; no prueba de autorización/efectos.
- [ ] Schema de herramienta/proyección, autoridad y contexto registrados con AI-06/07 y familia pertinente.
- [ ] Casos de uso reales de acceso/ambigüedad, confirmación, concurrencia y recuperación verificados para NodiaAI.
- [ ] Adaptador/modalidades, publicación y aceptación operativa comprobados.

Pendientes con efecto sobre disponibilidad: AI-25/26: vincular intención nativa y validar excepciones de fase/acuerdo.

## Evolución y compatibilidad

| Revisión | Cambio y fuentes | Contexto y propuestas |
|---|---|---|
| 1 | AI-05: explicación inicial a partir de contratos/código enlazados | Sin cambio de backend ni publicación. Al cambiar reglas/DTOs, actualizar ficha/schema/registro, invalidar propuestas incompatibles y mantener recuperación original |


Actualización AI-08: [autoridad compartida](../../../../mvp/54-nodia-ai-ai08-transversal-authority.md). Destinatarios, actor real y reglas nativas se validan en transacción. En Ajustes Generales se protegen último super_admin, rol reservado, key de módulos y asociaciones atómicas; esto no incorpora herramientas MCP administrativas.

## Historial de la implementación inicial de lecturas AI-15

nodia_rental_payments_list/get reutiliza pagos/devoluciones nativos. Listado admite reservation_id, type payment/refund, status confirmed/voided, referencia parcial, orden por occurred_on y par from_on/to_on. Importes CLP exactos permanecen strings; no se acepta active para un recurso cuyo contrato usa estado contable. No captura ni anula dinero.

En la entrega inicial, la metadata permanecía draft/unregistered y approval null; el frontmatter actual y la sección de lectura publicada sustituyen ese estado histórico. Esta implementación no activa herramientas por el nombre del proveedor ni permite llamadas Web; Agentic, conocimiento revisado, contrato congelado y permisos actuales conservan sus gates.


## Lecturas disponibles en AI-15

Consultar pagos y reembolsos registrados, diferenciando importes y estados. La consulta no registra, devuelve ni confirma dinero.

Herramientas de esta sección: `nodia_rental_payments_get`, `nodia_rental_payments_list`.

Resolver entidades, destinatario, intervalo y filtros ambiguos antes de llamar. Usar sólo los campos del schema de la herramienta. Conservar IDs y dinero exactos, cero y falso; ausencia o unknown no equivalen a cero. La paginación y los límites de resultados deben comunicarse y una página no representa el universo completo. En recursos con actividad, iniciar Activo y usar Inactivo/Todos sólo cuando se soliciten; Todos omite el filtro.

Server valida sesión, módulo NodiaAI y todos los módulos destino actuales para usuarios ordinarios; super_admin conserva transversalidad y las reglas de dominio. Datos privados y autoridad se revalidan al devolver o recuperar resultados. Finanzas permite owner_id ajeno sólo a super_admin; Reservas conserva autoridad actual del alojamiento; administración IA conserva ai:manage. No construir SQL libre ni pedir tokens, cookies o secretos.

Esta publicación incluye lecturas y referencias privadas, no preparaciones ni ejecución de escrituras. Cualquier creación, edición, eliminación o confirmación conserva sus herramientas y etapas posteriores. No anunciar informes cruzados, un total por proveedor u otros filtros/agrupaciones si el schema o caso de uso no los soporta. Web permanece conversacional; MCP sólo se ejecuta mediante Agentic verificado, con delegación Web→Agentic opt-in de la misma conexión.

Las observaciones externas se ejecutan fuera de SQL, con deadline/cancelación y verificación posterior de autoridad y configuración. La recuperación de una llamada completada no repite red; una llamada interrumpida no se reintenta ciegamente. Los artefactos son referencias privadas current_on_download: la descarga humana reautoriza chat/recurso, rechaza exceso sin truncar y no conserva el archivo al expirar el chat; el original de factura pertenece al negocio.
