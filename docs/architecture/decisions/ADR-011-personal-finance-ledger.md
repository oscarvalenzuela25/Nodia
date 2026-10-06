# ADR-011 — Movimientos y obligaciones de Finanzas personales

> Estado: propuesto
> Fecha: 2026-10-04

## Contexto

Finanzas personal por usuario, una categoría por movimiento, grupos muchos a muchos para filtrar, una obligación opcional por movimiento y principal sin intereses. Importes enteros sin sufijo de divisa y solo created_at/updated_at por instrucción explícita del usuario. Se solicitó diagramar antes de crear la BD.

## Opciones consideradas

### Opción A: principal derivado del movimiento inicial y propósito adicional

- Ventajas: principal almacenado en el movimiento y clasificación explícita de eventos para un dominio más amplio.
- Desventajas: elimina el monto propio de la obligación requerido por el usuario y agrega propósito sin necesidad en el alcance simple confirmado. Descartada por la corrección explícita del usuario.

### Opción B: monto inicial en obligación y saldo derivado de pagos

- Ventajas: representa directamente monto inicial y pagos parciales; sin campo purpose ni pivote de pagos. Type loan/debt y dirección income/expense determinan liquidación.
- Desventajas: mantener coherencia del importe inicial con el primer movimiento al crearlos; el saldo requiere una suma de pagos confirmados.

## Decisión

La corrección del usuario confirma monto inicial propio de la obligación y descarta propósito/motivo adicionales. Se refleja B en [ERD de Finanzas](../../mvp/21-personal-finance-erd.md); el ADR técnico completo permanece propuesto.

- Cinco tablas finance_ dentro del backend modular existente, sin microservicio.
- amount bigint positivo; contratos JSON con strings decimales y aritmética exacta. Sin currency por ahora.
- finance_obligations.amount es principal inicial; finance_movements.amount es importe de cada flujo. Loan se liquida con income recibidos y debt con expense pagados. Saldo calculado; crear obligación/movimiento inicial coherentes en una transacción.
- FKs compuestas por propietario y unicidad de pertenencia grupo/categoría.
- Conservar cancelados; sin campo cancellation_reason obligatorio. No compensar otra vez con inversos si ya se excluye el original.
- Transacciones y controles de propietario/importe para pagos/anulaciones. Implementación local: lock pesimista de obligación antes de leer liquidación, escrituras READ COMMITTED y lecturas de saldos/overview REPEATABLE READ. Verificado con carreras reales sobre PostgreSQL aislado; sin clasificaciones de dominio adicionales.
- Solo created_at/updated_at; proponer reportes por creación, sin afirmar fecha real de liquidación.

## Consecuencias

- Positivas: dominio pequeño, sin repartos/divisas, saldo trazable y datos personales separados del acceso global autorizado en negocios.
- Costos/riesgos propuestos: agregaciones, captura sin fecha efectiva separada, filtros de grupos sobre categorías actuales. Recurrencias, intereses, cuentas/transferencias y principal heredado no están definidos.
- Trabajo posterior: revisión documental, Client, aplicación a la BD objetivo y despliegue. Migración/DTOs/casos de uso y constraints/concurrencia ya verificados en PostgreSQL aislado. No se modificó la BD del usuario. La versión conserva sin deduplicación persistente el resultado incierto de escrituras: refetch/revisión antes de repetir. No hay tablas nuevas de idempotencia ni garantía de efecto único. El ADR permanece propuesto, sin aprobación automática.

## Referencias

- [Entrevista](../../mvp/20-personal-finance-interview.md)
- [ERD](../../mvp/21-personal-finance-erd.md)
- [Dominio general en revisión](../../mvp/03-domain-model-erd.md)
- [Contratos propuestos](../../mvp/22-personal-finance-contracts.md)
- [Plan Backend](../../mvp/23-personal-finance-backend-plan.md)
- [Plan Client](../../mvp/24-personal-finance-client-plan.md)
