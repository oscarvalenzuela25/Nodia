# ADR-099 — Conciliación explícita de un despliegue detenido antes de migrar

> Estado: propuesto, sin aprobación documental. Corrección operativa autorizada; la recuperación de disponibilidad no aprueba este ADR.
> Fecha: 2026-11-13

## Contexto

El CD43473542741 detuvo correctamente API y worker, pero el actualizador rechazó
`Result=success`, `MainPID=0`, `ExecMainCode=2`, `ExecMainStatus=15`. Nest puede
reenviar SIGTERM después de cerrar recursos. El rechazo ocurrió antes de solicitar
migraciones y dejó el mantenimiento503, los timers pausados y la barrera del CD.
El navegador informó CORS porque la respuesta503 de Nginx no era una respuesta
de la API. La recuperación comprobó release/esquema originales, ausencia de
trabajos y CORS antes de abrir de nuevo el tráfico.

La barrera original reconoce cualquier intento con efectos iniciados sin cierre
como incierto. Recuperar disponibilidad no debe borrar ese intento, convertirlo
en un despliegue exitoso ni permitir repetir sus efectos. Receptor SSH y Host
deben interpretar la misma conciliación, manteniendo las garantías del
[ADR097](ADR-097-monorepo-production-release-pipeline.md).

## Opciones consideradas

### Opción A — Borrar BLOCKED o marcar el intento como completo

- Ventaja: cambio operativo pequeño.
- Desventajas: destruye el significado del historial y puede habilitar replay;
  además, el segundo gate del Host sigue viendo los efectos sin resolver.

### Opción B — Conservar el fallo y emitir una conciliación privada verificable

- Ventajas: separa disponibilidad, fallo histórico y autorización de una intención
  nueva. Ambos gates verifican los mismos bytes e identidad.
- Costos: contrato y helper operatorio adicionales, con pruebas de rechazo.

## Decisión

Se implementa la opción B para el caso acotado de parada limpia rechazada antes
de migrar. Una salida SIGTERM sólo se acepta con estado inactivo, resultado
correcto, PID0 y cgroup vacío; no sustituye la comprobación SQL de quiescencia.

La recuperación del mismo release conserva `state.json` y `BLOCKED.json` y
registra un recibo independiente privado. La conciliación posterior exige ese
recibo completo, coincidencia de hashes e identidades, procesos y configuración
verificados y consultas nuevas READ ONLY/TLS al esquema original. No basta un
booleano ni un archivo con un ID. Una conciliación válida excluye exclusivamente
ese fallo de las barreras para una intención nueva; el ID fallido sigue sin poder
reaplicarse. Los efectos inciertos, migraciones solicitadas y recibos alterados
permanecen bloqueados.

### Respaldo previo interrumpido — 2026-11-18

El intento `1d6e3f19` de Listas de Market falló en `backup_requested` con
`migration_requested: false`. La API volvió a servir el release anterior y el
ledger quedó en 56. El resultado de la escritura del catálogo en R2 se conserva
como incierto.

Se usa el mismo registro privado de conciliación con estado
`backup_request_reconciled_before_migration`, separado del caso de SIGTERM.
La evidencia enlaza los bytes del intento fallido y su bloqueo, el recibo de
disponibilidad, los manifiestos del release activo y el candidato, una lectura
nueva del ledger por TLS y la verificación de un respaldo vigente por HEAD y
GET con digest. El respaldo observado demuestra que hay una copia legible.
La siguiente entrega debe generar y verificar su propio respaldo fresco.
Ambas barreras verifican el recibo antes de admitir una intención nueva.

### Espera agotada antes de detener escritores — 2026-11-27

La entrega de catálogo quedó en `waiting_for_quiescence` con
`live_or_unconfirmed_runtime_work`. El respaldo se registró y el
release anterior permaneció activo durante la recuperación de disponibilidad.
El ledger conservó 87 migraciones. El recibo de disponibilidad observó
tres trabajos históricos de Teacher y preservó el estado remoto incierto.

El candidato incorpora el estado independiente
`quiescence_reconciled_before_migration`, limitado a la operación
`4f74fce53e7101cddfa0484ed6711ca7` y a los originales verificados.
El recibo de disponibilidad acredita la recuperación del servicio.
Para el acuse de CD se exige además una inspección posterior del mismo
release con TLS autorizado, transacción de solo lectura, ledger sin
cambios y nueve contadores de quiescencia en cero. El acuse debe quedar
dentro de los 120 segundos siguientes a esa inspección y conservar la
identidad de ambos escritores. Las dos barreras verifican la misma
evidencia y los intentos ajenos conservan su propia barrera.
El ID fallido y su respaldo histórico se conservan. Una entrega posterior
necesita una intención nueva y su propio respaldo y verificaciones.
[Runbook del caso](../../../ops/production/README.md#conciliación-antes-de-detener-escritores--2026-11-27).

## Consecuencias

- Se conserva evidencia honesta: recuperar f01 no equivale a desplegar el candidato.
- No se ejecuta rollback SQL, seed, inferencia o migración durante la conciliación.
- Los originales y recibos permanecen privados en el VPS; no se versionan secretos
  o un JSON por intento. El procedimiento mantenido describe las garantías.
- La conciliación no aprueba artefactos futuros: éstos aún necesitan CI de master,
  procedencia, backup fresco, quiescencia, migraciones y verificaciones de CD.
- Una ejecución interrumpida o parcialmente instalada exige inspección; no existe
  reintento automático que borre el estado incierto.

## Referencias

- [Plan de producción99, sección22](../../mvp/99-production-deployment-and-cicd-plan.md#22-parada-limpia-por-sigterm-recuperación-de-disponibilidad-y-conciliación--2026-11-13).
- [Runbook de producción](../../../ops/production/README.md).
- [Incidente de Listas de Market](../../mvp/99-production-deployment-and-cicd-plan.md#35-respaldo-previo-interrumpido-en-listas-de-market--2026-11-18).
