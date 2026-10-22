---
{
  "schema_version": 1,
  "document_id": "reservations.confirmed-money",
  "product_id": "reservations",
  "kind": "feature",
  "revision": 1,
  "document_status": "draft",
  "implementation": {
    "status": "implemented",
    "notes": "AI-26 implementa y verifica en laboratorio privado6 puertos internos con escritores/reglas nativas, revisión exacta y recibo atómico. No publica herramientas MCP ni acredita escrituras Gemini."
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento de Reservas y NodiaAI conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/28-rental-reservations-contracts.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/41-nodia-ai-v1-contracts.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/72-nodia-ai-ai26-rental-money-occupancy-preparation.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/rental-payment/dto/rental-payment.dto.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/rental-payment/use-case/create-rental-payment.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/rental-payment/use-case/void-rental-payment.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/rental-expense/dto/rental-expense.dto.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/rental-expense/use-case/create-rental-expense.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/rental-expense/use-case/update-rental-expense.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/rental-expense/use-case/pay-rental-expense.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/rental-expense/use-case/void-rental-expense.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-rental-money/use-case/build-nodia-ai-rental-money-operations.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-rental-money/nodia-ai-rental-money.service.ts",
      "kind": "implementation"
    }
  ],
  "verification": {
    "checked_on": "2026-10-17",
    "evidence_paths": [
      "docs/mvp/72-nodia-ai-ai26-rental-money-occupancy-preparation.md",
      "docs/evidence/nodia-ai-ai26-validation.json",
      "docs/evidence/nodia-ai-ai26-postgresql.json",
      "docs/evidence/nodia-ai-ai26-regressions.json",
      "docs/evidence/nodia-ai-ai26-ui-validation.json",
      "docs/evidence/nodia-ai-ai26-client-validation.json",
      "docs/evidence/nodia-ai-ai26-tested-release-parity.json",
      "docs/evidence/nodia-ai-ai26-lab-activation.json",
      "docs/evidence/nodia-ai-ai26-deployed-equality.json",
      "docs/evidence/nodia-ai-ai26-lab-runtime.json",
      "docs/evidence/nodia-ai-ai26-knowledge-validation.json"
    ],
    "notes": "AI-26: Server2637/194, Client1526/203,310 comprobaciones SQL/HTTP/procesos (44 nuevas+266 regresiones,282 HTTP nativas) y9 QA sintéticas. Laboratorio privado con48 ejecutores,25 migraciones/18 tablas NodiaAI/241 columnas y0 pendientes; sin esquema nuevo. Ficha draft/unregistered y approval null, sin publicación MCP o aceptación de escrituras Gemini."
  },
  "approval": null
}
---

# Dinero confirmado de Reservas — contexto funcional para NodiaAI

## Qué resuelve

Registrar dinero ya recibido o devuelto por una reserva y gestionar gastos de la casa. No efectúa transferencias, cobros bancarios ni movimientos de Finanzas personales. [AI-26/72](../../../../mvp/72-nodia-ai-ai26-rental-money-occupancy-preparation.md) reutiliza el protocolo de propuesta, botón humano exacto, writer nativo y recibo atómico.

## Operaciones internas

| Preparador | Efecto nativo |
|---|---|
| `nodia_rental_payments_prepare_create` | Registra cobro (`type=payment`) o devolución efectiva (`type=refund`) |
| `nodia_rental_payments_prepare_void` | Anula por completo un registro monetario, conservando historial |
| `nodia_rental_expenses_prepare_create` | Crea gasto explícitamente pending o paid |
| `nodia_rental_expenses_prepare_update` | Modifica campos autorizados según estado |
| `nodia_rental_expenses_prepare_pay` | Registra el pago completo de un gasto pending existente |
| `nodia_rental_expenses_prepare_void` | Anula un gasto completo sin borrarlo |

Son preparadores internos; añadir esta ficha no publica herramientas MCP.

## Mínimos y aclaraciones

Un cobro/devolución exige casa, reserva de esa casa, tipo, monto entero positivo CLP y día efectivo. Medio, referencia y notas son opcionales/nulos conforme DTO. Anular exige registro y motivo. No inferir devolución a partir de anulación ni pago a partir de crear una reserva.

Un gasto exige casa, nombre, importe entero positivo, día de gasto y estado explícito pending/paid. Paid requiere día de pago no anterior al gasto ni futuro; pending no admite día de pago. Asociación de reserva, categoría y notas son opcionales y pueden ser null. Pagar exige gasto pending y día de pago; no crear un segundo gasto por pagar el primero. Si «compré comida» no define estado o casa, preguntar lo ambiguo.

Ejemplos ilustrativos: «Registra el abono que recibí» → resolver reserva, importe y día; «Devuelve lo aprobado» → aclarar si se solicita registrar dinero efectivamente devuelto; «Anula el cobro incorrecto» → resolver registro y motivo, no crear refund; «Paga el gasto de limpieza» → usar pay sobre el gasto pendiente concreto.

## Reglas y autoridad

DTOs y casos de uso enlazados en frontmatter son la fuente de verdad. Importes bigint se transportan como strings, sin Number ni redondeo. Días civiles usan la zona de la casa para validar hoy. Cobros no pueden superar el importe neto esperado; no se registran nuevos cobros sobre una reserva cancelada. El primer cobro fija las condiciones de cancelación, incluidas condiciones externas explícitas de Airbnb cuando corresponda; no consulta la plataforma. Registrar dinero no confirma una reserva.

Refund exige reserva cancelada y devolución aprobada; no puede superar lo aprobado pendiente ni lo recibido, ni anteceder al día local de cancelación. Anular conserva el registro, recalcula saldos conforme reglas y no transfiere dinero. Cobros de reservas canceladas no se anulan para eludir el acuerdo; el backend preserva el anticipo exigible de reservas directas confirmadas.

Gastos anulados no se editan. Un gasto pagado restringe importe y fecha del gasto; campos descriptivos/asociación siguen el DTO. No se cambian estados con un PUT genérico. No hay DELETE, anulación parcial, lote, pasarela bancaria ni espejo automático en Finanzas personales.

Usuarios ordinarios requieren NodiaAI, módulo rental_reservations y acceso nativo a la casa; super_admin conserva actor real. Cada asociación se resuelve dentro de property_id. Casa archivada conserva historial y liquidación conforme reglas nativas. No hay SQL libre ni permisos concedidos por Markdown.

La observación administrativa usa la ejecución/recibo histórico autorizado del chat; no permite confirmar o reanudar como el dueño. El GET nativo operations/:requestKey mantiene actor original según28 y no se publica como herramienta ni entrega claves técnicas al modelo. AI-26 completa22 escrituras individuales internas de Reservas junto a21 lecturas y esa coordinación nativa, sin alterar su autoridad.

## Informes, confirmación y recuperación

Las lecturas de [dinero](payments-and-refunds.md) mantienen sus contratos publicados. Separar cobros, devoluciones efectivas, devolución aprobada pendiente, gastos pending/paid/voided y fechas efectivas; no sumar páginas ni mezclar monedas/productos sin procedencia. Informes cruzados conservan AI-30/31.

Propuesta y snapshots congelan comando, ámbito y precondiciones materiales. Cambiar importe/tipo/día exige nueva revisión/hash y botón exacto. Platform_policy se representa readonly recursivamente; no se usa editor JSON libre. Recibo RentalEffectReceipt identifica rental_payments o rental_expenses, operación, casa e ID; no afirma estado actual del recurso.

Writer nativo y recibo comparten transacción/journal; reanudación consulta lo comprometido antes de repetir. Timeout/COMMIT incierto exige conciliación. Cancelar ejecución no deshace dinero ya registrado. Conjuntos secuenciales conservan pasos completados y no añaden bindings futuros de Reservas. Contenido técnico resuelto expira con chat según50; registros de negocio mantienen conservación nativa.

## Integración y evolución

Implementación y laboratorio privado verificados; ver [72](../../../../mvp/72-nodia-ai-ai26-rental-money-occupancy-preparation.md). Ficha draft/unregistered y approval null. Publicación MCP y aceptación Gemini pendientes independientes. Los nueve cuerpos de lectura aprobados permanecen intactos.

| Revisión | Cambio | Compatibilidad |
|---|---|---|
| 1 | AI-26 integra seis puertos internos de dinero conforme DTOs/casos de uso nativos | Revalidar snapshots/propuestas ante cambios materiales; recuperar recibos sin repetir efectos. No publica escrituras por añadir Markdown |
