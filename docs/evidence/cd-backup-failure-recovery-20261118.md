# Recuperación de disponibilidad tras un fallo de respaldo — 2026-11-18

El VPS adoptó la política y el actualizador integrados por el [PR 64](https://github.com/oscarvalenzuela25/Nodia/pull/64)
y promovidos por el [PR 65](https://github.com/oscarvalenzuela25/Nodia/pull/65).
La adopción se comprobó sobre `backend-7fa91a8832dd-1f8917ca3edf`.

## Ensayo aislado

El [ensayo de systemd](../../ops/production/tests/updater-systemd.integration.py)
pasó 36 comprobaciones con systemd como PID 1 en un contenedor sin red. La unidad
de respaldo simuló `nodia_ai:recovery_write_unknown` y se ejecutó una sola vez.
El proxy pasó de HTTP 503 a 200 y validó CORS tras retirar mantenimiento. API y
worker conservaron sus PID y release. Se restauraron los timers. La inspección
SQL del ensayo fue de solo lectura y `migration_requested` siguió en `false`.
El intento conservó `automatic_retry_allowed: false` y la barrera `BLOCKED`
rechazó una entrega posterior con `prior_update_requires_reconciliation`.
Los servicios de aplicación, el proxy y los resultados de R2 y SQL del ensayo
fueron sintéticos. Pasaron además 139 pruebas focalizadas de política,
actualizador, instaladores de refresco y receptor en Linux aislado.

## Adopción en el VPS

La comprobación previa y la instalación usaron el manifiesto revisado
`b425e22af3bef21bfeb1b015ec7a0e97594e62e26e542e9bd350c48668156ea8`.
La operación guardó originales y recibo en
`/var/lib/nodia-updates/backup-failure-recovery-refresh-<sha256-del-manifiesto>/`.
Los dos hashes instalados coincidieron con los del ensayo.

| Archivo | SHA-256 instalado |
| --- | --- |
| `backend_update.py` | `53de8fec475821809a5f6ec9a1f9ece9be3a83247a81cd2ade6185e69f00c7ab` |
| `update-backend.py` | `8e28860e1b6eb52bde96dedbf2589498c5a48c5748ab023e13ff167723d22d7f` |

El receptor restringido confirmó `deployment_ready`, `blocked: false` y
el mismo release. API y worker conservaron los PID `1681086` y `1681077` y
ambos timers de respaldo estaban activos. La API y Pages devolvieron HTTP 200,
y el preflight de `auth/refresh` devolvió 204 con el origen y las credenciales
CORS esperados. El intento histórico `1d6e3f19410a3cec6d2b97c958c44471` conservó
`phase: failed`, `migration_requested: false` y `automatic_retry_allowed: false`.
El fallo se indujo únicamente en el laboratorio. La sesión administrativa se
cerró y la autenticación de `sudo` se invalidó al terminar.
