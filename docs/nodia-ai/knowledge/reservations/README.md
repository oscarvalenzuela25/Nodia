---
{
  "schema_version": 1,
  "document_id": "reservations",
  "product_id": "reservations",
  "kind": "product",
  "revision": 8,
  "document_status": "draft",
  "implementation": {
    "status": "partial",
    "notes": "21 lecturas publicadas desde nueve fichas;22 escritores individuales internos de configuración, ciclo comercial, dinero, bloqueos y preparación verificados con confirmación exacta, recibos y recuperación. La recuperación nativa conserva actor original; super_admin observa ejecución ajena autorizada sin suplantar al dueño. Este resumen y las fichas de efectos siguen draft/unregistered; publicación MCP y aceptación de escrituras Gemini pendientes."
  },
  "integration_status": "unregistered",
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
      "path": "docs/mvp/54-nodia-ai-ai08-transversal-authority.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/70-nodia-ai-ai24-rental-configuration.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/nodia-ai-products/reservations/use-case/nodia-ai-reservations-family.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-products/contracts/reservations.schema.json",
      "kind": "implementation"
    },
    {
      "path": "docs/mvp/71-nodia-ai-ai25-rental-reservation-lifecycle.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/72-nodia-ai-ai26-rental-money-occupancy-preparation.md",
      "kind": "specification"
    }
  ],
  "verification": {
    "checked_on": "2026-10-17",
    "evidence_paths": [
      "docs/mvp/51-nodia-ai-ai05-product-knowledge.md",
      "docs/evidence/nodia-ai-ai05-knowledge-validation.json",
      "docs/evidence/nodia-ai-ai08-authority-validation.json",
      "nodia-server/src/nodia-ai-products/reservations/use-case/nodia-ai-reservations-family.use-case.spec.ts",
      "docs/evidence/nodia-ai-ai15-live-local.json",
      "docs/evidence/nodia-ai-ai15-live-artifacts.json",
      "docs/evidence/nodia-ai-ai15-live-routing-interrupted.json",
      "docs/evidence/nodia-ai-ai15-live-external-final.json",
      "docs/mvp/70-nodia-ai-ai24-rental-configuration.md",
      "docs/evidence/nodia-ai-ai24-postgresql.json",
      "docs/evidence/nodia-ai-ai24-regressions.json",
      "docs/evidence/nodia-ai-ai24-lab-runtime.json",
      "docs/evidence/nodia-ai-ai24-ui-validation.json",
      "docs/mvp/71-nodia-ai-ai25-rental-reservation-lifecycle.md",
      "docs/evidence/nodia-ai-ai25-postgresql.json",
      "docs/evidence/nodia-ai-ai25-regressions.json",
      "docs/evidence/nodia-ai-ai25-ui-validation.json",
      "docs/evidence/nodia-ai-ai25-lab-runtime.json",
      "docs/evidence/nodia-ai-ai25-knowledge-validation.json",
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
    "notes": "AI-24: seis escrituras internas verificadas con PostgreSQL/HTTP/worker, Server2418/191, Client1441/202 y227 comprobaciones integradas; laboratorio privado activo con32 ejecutores y0 pendientes. Registro47 fuentes/20 excluidas conserva67 capacidades y27 bindings funcionales de lectura. Esta ficha de producto conserva draft/unregistered y approval:null; la actualización no la publica. La evidencia histórica mantiene separados SQL/CSV positivos, R2 no configurado y resultados externos/Web parciales con unknown sin replay. No se acredita escritura Gemini ni aceptación productiva pública. AI-25: Server2487/192, Client1488/203,266 comprobaciones SQL/HTTP/procesos y7 QA sintéticas. Lab privado con38 ejecutores y0 pendientes; no crecimiento de esquema ni publicación MCP/escrituras Gemini. AI-26: Server2637/194, Client1526/203,310 comprobaciones SQL/HTTP/procesos (44 nuevas+266 regresiones,282 HTTP nativas) y9 QA sintéticas. Laboratorio privado con48 ejecutores,25 migraciones/18 tablas NodiaAI/241 columnas y0 pendientes; sin esquema nuevo. Ficha draft/unregistered y approval null, sin publicación MCP o aceptación de escrituras Gemini."
  },
  "approval": null
}
---

# Reservas — contexto de producto para NodiaAI

Metadatos canónicos migrados en [AI-06](../../../mvp/52-nodia-ai-ai06-knowledge-publication-contract.md); este resumen conserva aprobación pendiente y no se publica; las secciones funcionales de lectura publicadas se identifican debajo.

## Propósito y alcance

Gestionar alojamientos, estadías, disponibilidad, dinero recibido/devuelto, gastos, bloqueos y preparación. Crear un borrador no reserva fechas; registrar dinero no confirma una reserva.

El alcance confirmado comprende consultas y CRUD individual donde exista endpoint, con aclaraciones/vista previa y confirmación. Las fichas describen el backend actual y señalan ampliaciones pendientes; ninguna crea herramientas o permisos.

## Conceptos y relaciones

| Concepto | Significado y relación |
|---|---|
| Alojamiento / miembro | Casa con dueño, colaboradores y zona IANA interna; IDs bigint como strings. |
| Reserva / preparación | Acuerdo con fechas civiles y horarios propios; turnover separado para recambio y limpieza. |
| Ocupación / disponibilidad | Intervalo semiabierto de confirmadas/en curso/completadas y bloqueos activos, incluso reservas archivadas. |
| Pago / devolución / gasto | Flujos de dinero con fechas económicas propias; anular corrige captura, no transfiere dinero. |

## Módulos y autoridad

Destino /tools/reservations, key rental_reservations. AI-08 permite super_admin activo sobre cualquier alojamiento, incluida configuración/colaboradores; distingue membership.type=super_admin sin cambiar dueño. Los demás conservan pertenencia y capacidades nativas. Auditoría y recuperación mantienen actor real; NodiaAI exige sus módulos. AI-15 publica las lecturas y AI-24 verifica seis escrituras internas de configuración; la preparación MCP y aceptación de esas escrituras con Gemini siguen pendientes.

Rutas de destino trazadas al inventario/catálogo: `/tools/reservations`. Resolver sus IDs reales desde Server; la inspección no consulta asignaciones de la BD del usuario. Credenciales/cookies no se incorporan al contexto. Web sólo conversa y Agentic usa MCP conforme [política48](../../../mvp/48-nodia-ai-mode-routing-policy.md); disponibilidad exige evidencia del adaptador exacto.

## Índice de funcionalidades

| Función | Ficha | Implementación | Integración NodiaAI | Destino |
|---|---|---|---|---|
| Alojamientos y colaboradores | [properties-and-collaborators](features/properties-and-collaborators.md) | Backend existente/parcial; gates en ficha | Sólo lecturas AI-15 publicadas; resto pendiente | `/tools/reservations` |
| Políticas de cancelación | [cancellation-policies](features/cancellation-policies.md) | Backend existente/parcial; gates en ficha | Sólo lecturas AI-15 publicadas; resto pendiente | `/tools/reservations` |
| Reservas y transiciones | [reservations](features/reservations.md) | Backend existente/parcial; gates en ficha | Sólo lecturas AI-15 publicadas; resto pendiente | `/tools/reservations` |
| Disponibilidad, calendario y resumen | [availability-and-calendar](features/availability-and-calendar.md) | Backend existente/parcial; gates en ficha | Sólo lecturas AI-15 publicadas; resto pendiente | `/tools/reservations` |
| Pagos y devoluciones | [payments-and-refunds](features/payments-and-refunds.md) | Backend existente/parcial; gates en ficha | Sólo lecturas AI-15 publicadas; resto pendiente | `/tools/reservations` |
| Gastos de alojamiento | [expenses](features/expenses.md) | Backend existente/parcial; gates en ficha | Sólo lecturas AI-15 publicadas; resto pendiente | `/tools/reservations` |
| Bloqueos de disponibilidad | [blocks](features/blocks.md) | Backend existente/parcial; gates en ficha | Sólo lecturas AI-15 publicadas; resto pendiente | `/tools/reservations` |
| Preparación y recambio | [preparation](features/preparation.md) | Backend existente/parcial; gates en ficha | Sólo lecturas AI-15 publicadas; resto pendiente | `/tools/reservations` |
| Historial y recuperación | [audit-and-recovery](features/audit-and-recovery.md) | Backend existente/parcial; gates en ficha | Sólo lecturas AI-15 publicadas; resto pendiente | `/tools/reservations` |
| Configuración confirmada AI-24 | [confirmed-configuration](features/confirmed-configuration.md) | Seis puertos internos implementados/verificados en laboratorio privado | Ficha draft/unregistered; preparadores MCP sin publicar | `/tools/reservations` |
| Ciclo comercial AI-25 | [confirmed-reservation-lifecycle](features/confirmed-reservation-lifecycle.md) | Seis puertos internos implementados/verificados en laboratorio privado | Ficha draft/unregistered; preparadores MCP sin publicar | `/tools/reservations` |

## Interpretación de solicitudes que combinan funciones

«Crea una reserva» primero resuelve alojamiento y mínimos, crea draft con preview/botón; confirmar es otra transición con sus precondiciones. «Hay cupo» necesita días y horarios explícitos; availability no congela nada. No contabilizar una comisión descontada por plataforma también como gasto pagado.

Informes cruzados requieren medidas compatibles y procedencia separada según41; no deducir relaciones sólo porque dos productos usan la palabra gasto/proveedor. Pasos dependientes conservan resultados y se recuperan sin duplicarlos; el modelo no confirma ni ejecuta SQL libre.

## Restricciones y pendientes

No DELETE ni reapertura/edición libre de acuerdos con dinero; no integración Airbnb, holds o cancelación automática por reloj. Contratos28/implementación prevalecen sobre cabecera histórica no implementado de26; ERD27 tiene aprobación propia que no aprueba estas fichas. Transversalidad AI-08, lecturas AI-15 y seis escrituras internas de configuración AI-24 implementadas/verificadas; AI-25 verifica el ciclo comercial; dinero/bloqueos/preparación mantienen AI-26. Publicación MCP y aceptación Gemini de escrituras continúan pendientes.

Publicación de conocimiento, proyecciones y autoridad depende de AI-06/07/08/12 y de la familia de herramientas. Markdown explica, no habilita. No se cargan estos borradores automáticamente al proveedor. Política50 elimina contenido del chat y registros técnicos resueltos sin borrar dominio/preferencias aceptadas.

## Evolución y trazabilidad

| Revisión | Cambio funcional y fuentes | Impacto |
|---|---|---|
| 1 | AI-05: 9 fichas funcionales desde especificaciones/backend e inventario39 | [Cobertura/diferencias/gates](../../../mvp/51-nodia-ai-ai05-product-knowledge.md); sin migraciones/runtime/publicación ni aprobación automática |


Actualización AI-08: [autoridad compartida](../../../mvp/54-nodia-ai-ai08-transversal-authority.md). Destinatarios, actor real y reglas nativas se validan en transacción. En Ajustes Generales se protegen último super_admin, rol reservado, key de módulos y asociaciones atómicas; esto no incorpora herramientas MCP administrativas.

## 21 lecturas candidatas de AI-15

La familia tipada de AI-15 reúne las 21 lecturas existentes: alojamientos, colaboradores/candidatos, políticas, reservas y simulación de cancelación, pagos, gastos, bloqueos, preparación, calendario/disponibilidad/resumen e historial. Comparte los casos de uso HTTP y el EntityManager del checkpoint. Los exports son candidatos dormantes: no se incorporan al registro productivo ni al bundle hasta revisar/publicar sus contratos y contexto. No se implementan escrituras en esta etapa.

La metadata permanece draft/unregistered y approval null. Esta implementación no activa herramientas por el nombre del proveedor ni permite llamadas Web; Agentic, conocimiento revisado, contrato congelado y permisos actuales conservan sus gates.

El replay de un listado/detalle de alojamientos contrasta además todos los IDs, dueños y flags de membresía devueltos con autoridad actual en un único batch. Una colaboración o rol revocado invalida el resultado previo; el manager sigue siendo el checkpoint.


## Publicación de lecturas AI-15 — estado actual

21 capacidades de lectura publicadas desde nueve fichas funcionales, con autoridad actual del alojamiento y reglas nativas. El resumen de producto continúa draft/unregistered y fuera del bundle; transiciones, pagos y otras escrituras conservan sus etapas.

El corpus completo actual tiene50 fichas:27 funcionalidades approved/published ligadas a67 contratos read/read_artifact y23 fichas draft/unregistered excluidas —cinco resúmenes de producto, doce funciones propias de NodiaAI y seis fichas de efectos confirmados de Finanzas, Negocios y Reservas—. No hay escrituras publicadas. La [autorización específica](../../../evidence/nodia-ai-ai15-publication-authorization.md) alcanza esas secciones funcionales, no este resumen. Los estados del índice describen el alcance publicado de lectura de cada función y no todo su CRUD.

[AI-15](../../../mvp/61-nodia-ai-ai15-product-reads.md) distingue diez comprobaciones SQL con Gemini real y doce de referencias/CSV, observaciones externas con recibos positivos y final incierto, y routing Web parcial. R2 sin configurar no se transforma en descarga verificada; unknown no se reenvía. Los contratos se publican con permisos y límites actuales, sin prometer que todo turno del modelo termine correctamente. Sin cambios visuales ni nuevos bindings de resumen.

## Configuración confirmada AI-24 — ampliación interna

[Entrega70](../../../mvp/70-nodia-ai-ai24-rental-configuration.md) y [ficha de configuración](features/confirmed-configuration.md) incorporan crear/editar casas, colaboradores y políticas mediante revisión y botón humano exactos. Reutilizan escritores nativos, autoridad de dueño/super_admin y reglas existentes; no añaden DELETE ni transiciones/dinero. El editor estructurado de reglas y los recibos enlazan la ruta real de Reservas y conservan el estado ante errores. Server2.418/191, Client1.441/202 y227 comprobaciones SQL/HTTP/procesos verifican la entrega; laboratorio privado activo con25 migraciones/18 tablas NodiaAI/241 columnas,32 ejecutores y0 pendientes, sin añadir esquema.

La ampliación no modifica los cuerpos de las nueve fichas de lectura aprobadas ni publica escrituras MCP. El resumen y la nueva ficha siguen draft/unregistered y approval null. La nueva sourcepath explícita está registrada y validada, excluida del bundle sin añadir bindings aprobados.


## Ciclo comercial AI-25 — ampliación interna

[Entrega71](../../../mvp/71-nodia-ai-ai25-rental-reservation-lifecycle.md) y [ficha del ciclo comercial](features/confirmed-reservation-lifecycle.md) incorporan seis preparadores internos para crear/editar borradores, confirmar, iniciar/completar y cancelar reservas. Conservan disponibilidad como lectura sin hold, anticipo/plataforma y preparación nativos, cancelación distinta de devolución efectiva, botón exacto y recuperación. Implementación y laboratorio privado verificados: Server2487/192, Client1488/203,266 comprobaciones SQL/HTTP/procesos y7 QA sintéticas;38 ejecutores y0 pendientes, sin esquema nuevo. No se acredita publicación MCP o escritura Gemini. Dinero, bloqueos y preparación se verifican a continuación en AI-26. Las nueve fichas de lectura aprobadas permanecen intactas; la nueva ficha sigue draft/unregistered y approval null, excluida de publicación.


AI-26 incorpora [dinero confirmado](features/confirmed-money.md) y [bloqueos/preparación](features/confirmed-occupancy-preparation.md), conforme [72](../../../mvp/72-nodia-ai-ai26-rental-money-occupancy-preparation.md). Diez preparadores internos implementados y verificados en laboratorio privado; los nueve cuerpos de lectura aprobados se mantienen intactos. Publicación MCP y aceptación Gemini pendientes.

Revisión8 de este resumen: añade las dos fichas AI-26 y reconcilia corpus50/23, sin cambiar la aprobación ni habilitar publicación. La paridad44 distingue21 lecturas,22 escrituras internas y1 coordinación nativa de journal restringida al actor original; la observación administrativa del chat no permite confirmar/reanudar como otro dueño.
