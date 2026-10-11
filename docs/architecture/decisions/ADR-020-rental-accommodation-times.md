# ADR-020 — Horarios por reserva y zona interna del alojamiento

> Estado: propuesto — implementación autorizada por el usuario; sin aprobación documental automática
> Fecha: 2026-10-09

## Contexto

El usuario retira los horarios habituales y el input IANA del formulario de alojamiento. Cada clientela acuerda su entrada y salida. El calendario, la ocupación y las cancelaciones siguen necesitando una zona para resolver fechas civiles y cambios de hora; quitarla de persistencia invalidaría esas reglas y la historia.

## Opciones consideradas

### Opción A: eliminar columnas y zona

- Ventaja: esquema más pequeño.
- Desventajas: pérdida de datos históricos y de semántica DST; ruptura de clientes existentes y snapshots. No satisface las reglas de integridad de Reservas.

### Opción B: quitar inputs, exigir horarios por reserva y conservar zona interna

- Ventajas: formulario comprensible, acuerdos explícitos e historia preservada.
- Costos: conservar dos campos legacy nullable hasta una futura retirada versionada del contrato.

## Decisión

Implementar B. Una creación de alojamiento requiere nombre y capacidad. La zona omitida se resuelve con `RENTAL_DEFAULT_TIMEZONE`, con base `America/Santiago` acorde al ámbito chileno confirmado en25. Se valida antes de persistir; no depende del navegador. La API conserva zona explícita para compatibilidad y su inmutabilidad con historia. Operar en otra zona requiere configurar el despliegue antes de crear alojamientos; no se convierten alojamientos existentes.

Los horarios del alojamiento pasan a nullable en una migración incremental, conservando los valores existentes. Nuevas reservas comienzan con ambos horarios vacíos y los exigen al guardar; no heredan valores legacy. Reservas existentes conservan sus propios horarios. El hash idempotente representa la intención recibida, separada de la zona resuelta para persistencia: cambiar la configuración no duplica un alojamiento ante replay de la misma clave.

## Consecuencias

- Crear/editar alojamiento no muestra zona IANA ni horarios; Activo queda al final.
- Respuestas/OpenAPI/validadores Client aceptan null solo para horarios legacy de propiedad; los horarios de reserva siguen obligatorios.
- Down rechaza alojamientos sin horarios legacy: no inventa horas ni rellena datos para forzar reversión. Restaurar el respaldo correspondiente.
- La migración original de once tablas permanece intacta. La aplicación local usa exclusivamente estas dos migraciones; no ejecuta pendientes de otros dominios, no crea módulos duplicados ni asigna permisos.
- ERD03/27 documentan la nulabilidad ajustada. Por solicitud posterior explícita del 2026-10-09, el JSON de Obsidian se alinea y usa una nota SQL para la FK de retorno de política predeterminada:37 tablas,68 aristas visuales y1 FK real documentada. El modelo físico/DBML conserva todas las relaciones; ver evidencia en27. Exportar SQL del JSON exige añadir el complemento adjunto después de crear las tablas.

## Referencias

- [Requisito25](../../mvp/25-rental-reservations-interview.md#ajuste-solicitado--2026-10-09), [contratos28](../../mvp/28-rental-reservations-contracts.md), [evidencia29](../../mvp/29-rental-reservations-backend-plan.md), [Client30](../../mvp/30-rental-reservations-client-plan.md).
- [Migración incremental](../../../nodia-server/src/migrations/1791540000000-OptionalRentalPropertyTimes.ts) y [script de aplicación selectiva](../../../nodia-server/scripts/migrate-rental-reservations.mjs).
