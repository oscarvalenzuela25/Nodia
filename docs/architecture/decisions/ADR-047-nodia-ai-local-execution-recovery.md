# ADR-047 — Recuperación del efecto SQL local mediante su witness

> Estado: propuesto
> Fecha: 2026-10-17

## Contexto

AI-19 comparte transacción entre el escritor financiero nativo y su recibo. AI-20 conecta un worker que puede morir antes de iniciar SQL o después del commit y perder su respuesta. Cancelar, expirar el chat o renovar una sesión no autoriza repetir una creación.

## Opciones consideradas

### Reintentar toda escritura al vencer el lease

Sencillo, pero confunde una respuesta perdida con ausencia de efecto y puede duplicar movimientos.

### Añadir otro ledger de efectos y compensaciones

Permite coordinar efectos externos, pero duplica identidad y reglas del ledger nativo para este único efecto local; también amplía esquema y retención sin necesidad demostrada.

### Witness transaccional y barreras SQL compartidas

El recibo existente prueba el commit; adquirir las mismas barreras demuestra que una transacción anterior terminó. Su ausencia sólo permite concluir rollback para este puerto local, cuyo efecto y witness son indivisibles.

## Decisión

Usar la tercera opción. Separar claim durable de la transacción del efecto, congelar su fence e identidad y conciliar antes de cualquier reanudación humana. Reusar el job y un único marcador acotado de la última reanudación; no crear tablas ni un historial adicional. La sesión vigente puede renovar exclusivamente el grant de la intención original bajo reautorización completa.

Reservar espacio de outbox antes de admitir una reanudación. Cancelación y purga comparten orden de locks; una cancelación que observa completed conserva su recibo y el dato financiero.

## Consecuencias

- Worker, cancelación, recuperación y escritor deben mantener el mismo orden de barreras y la atomicidad del witness.
- Un fallo conocido sin efecto ofrece resume explícito; cambios materiales exigen propuesta nueva.
- Resultado incierto externo no hereda esta prueba ni permite retry automático.
- Los recibos resueltos se borran con el chat; el movimiento de negocio conserva su ciclo propio.
- Contratos y pruebas por familia son obligatorios antes de ampliar operaciones o secuencias.

## Referencias

- [AI-20](../../mvp/66-nodia-ai-ai20-execution-recovery.md), [AI-19](../../mvp/65-nodia-ai-ai19-financial-effect.md), [arquitectura43](../../mvp/43-nodia-ai-execution-architecture.md).
