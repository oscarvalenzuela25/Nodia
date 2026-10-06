# Finanzas personales — entrevista de dominio

> Estado: en revisión — decisiones funcionales confirmadas; ERD técnico propuesto
> Actualización: 2026-10-04
> Dependencias: documentos 01, 02 y 03; aclaración de alcance de 04; ADR-002

## Fuente y alcance

Propuesta inicial leída por solicitud del usuario desde `C:\Users\Oscar\Documents\Obsidian Vault\obsidian-notes\To Do list.md`. Las respuestas posteriores sustituyen la estructura inicial. El usuario solicitó actualizar el diagrama Obsidian nodia.json, integrar Finanzas en documento 03 y preparar planes Backend/Client detallados para asignar a subagentes; no ejecutar todavía la implementación ni aprobar automáticamente todo el esquema técnico.

## Decisiones confirmadas

- Grupo de navegación `finances` y módulo `personal_finance`, reutilizando `module_groups` y `modules`.
- Finanzas por usuario: movimientos, categorías, grupos y obligaciones pertenecen al usuario y conservan ese propietario en todas sus relaciones.
- Cada movimiento tiene exactamente una categoría mediante `category_id`; sin pivote movimiento/categoría.
- Grupos de categorías muchos a muchos mediante pivote, utilizados principalmente para filtrar.
- Cada movimiento corresponde como máximo a una obligación; sin reparto entre obligaciones ni pivote movimiento/obligación.
- Préstamo otorgado: salida inicial y entradas posteriores por devoluciones. Deuda asumida: entrada inicial y salidas posteriores por pagos.
- Principal sin intereses; puede devolverse mediante varios movimientos. La mención de meses/fechas no define un motor de recurrencias.
- Entrada: pendiente, recibida, anulada. Salida: pendiente, pagada, anulada. Solo recibidas/pagadas afectan totales. Conservar registros anulados, sin motivo obligatorio.
- Pesos enteros, CLP como única moneda actual. Campos sin sufijo de divisa; no ampliar a currency/conversiones ahora.
- Solo `created_at` y `updated_at`; sin `occurred_on`. Fecha del evento y fecha de captura no se separan; no falsificar created_at para compensarlo.
- El usuario delega nombres de tablas y mejora de la semántica de amount.
- Corrección posterior: finance_obligations.amount conserva el monto inicial. Los pagos liquidan ese monto; saldo calculado sin sobrescribirlo. No derivar el principal desde el movimiento inicial ni añadir purpose o cancellation_reason.
- Experiencia Client confirmada: página con tabs, General inicial como centro de mando, movimientos/obligaciones/categorías/grupos; información en tablas, crear/editar en modales siguiendo Settings e inputs existentes.
- Toda tabla tiene InputSearch arriba izquierda y Crear arriba derecha; columna Actions al final, menú de tres puntos con Update y Activar/Desactivar.
- Filter en cada sección; comenzar con activos e incluir inactivos mediante filtro. Ruta nueva disponible en constante usada por catálogo de Modules.

## Propuesta técnica

Ver [ERD propuesto](21-personal-finance-erd.md) y [ADR-011 propuesto](../architecture/decisions/ADR-011-personal-finance-ledger.md).

- Cinco tablas con prefijo finance_.
- Amount en obligaciones representa monto inicial; amount en movimientos representa cada entrada/salida. Solo saldo pendiente se deriva de los pagos.
- Loan se liquida con income confirmados; debt con expense confirmados. Esa dirección basta para distinguir pagos del inicial, sin purpose.
- Proponer obligación/origen coherentes creados en una transacción y pagos sin sobrepasar saldo; ediciones monetarias preservan coherencia según contrato 22, sin introducir campos nuevos.
- Anulación del origen bloqueada mientras tenga pagos confirmados. Criterios técnicos propuestos, pendientes de revisión del ERD completo.
- Cambiar categorías de un grupo cambia sus filtros sobre movimientos históricos; los movimientos mantienen su categoría.
- Archivado mediante is_active no elimina efectos financieros confirmados.

## Límites

Reportes propuestos por fecha de creación. updated_at no es una fecha estable de pago; el modelo solicitado no distingue el mes de captura del mes real de liquidación de un pendiente.

Recurrencias automáticas, calendario de cuotas, saldos heredados, intereses y cuentas bancarias/transferencias no están definidos y no se incluyen en este diagrama. Pagos parciales manuales sí están representados.

Categorías y nombres personales no se traducen automáticamente; los textos de sistema/estados siguen i18n. Keys personales no sustituyen FKs.

## Continuidad

Revisar ERD. Antes de implementar, reconciliar modelo global, navegación, contratos y tickets; concretar idempotencia y verificar constraints/atomicidad/concurrencia en PostgreSQL aislado. Ninguna de esas garantías está probada por el diagrama. No se ejecutó SQL ni se implementó código/migración de Finanzas.

Actualización solicitada ejecutada sobre el diagrama externo y el documento 03. [Contratos 22](22-personal-finance-contracts.md), [26 tareas Server](23-personal-finance-backend-plan.md) y [25 tareas Client](24-personal-finance-client-plan.md) preparados; planes en revisión y tareas pendientes.
