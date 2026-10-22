# AI-38 — observación acotada de infraestructura

Observación de la VM Linux local: **2026-10-20, 19:47 UTC**. El gate de
retención/backups/restore permanece **sin acreditar**. No se configuraron
servicios, backups o credenciales, ni se ejecutó una restauración.

## Qué se comprobó

La [proyección JSON](nodia-ai-ai38-infrastructure-observation-r01.json) procede
de [un script de metadatos](scripts/nodia-ai-ai38-infrastructure-observation-r01.py):
unidades/timers seleccionados por nombre, ubicaciones de ejecutables en el PATH
del host, tres directorios conocidos y cinco paths explícitos. Sólo se enumeró
el primer nivel; no se leyeron dumps, perfiles, `.env`, objetos o sus contenidos.

- En el inventario seleccionado no apareció una unidad/timer específico de
  backups Nodia, expiración de copias o journal de borrados. `dpkg-db-backup`,
  `logrotate` y `systemd-journald` son componentes del sistema: sus nombres y
  estados no acreditan backups de la aplicación o un journal de borrados NodiaAI.
- `/var/backups/nodia` contiene un directorio técnico AI-36; el path de dump
  `nodia-inicial.dump` del runbook VPS no existe en esta observación.
  `/opt/nodia/verification-backups` conserva directorios históricos de entregas,
  con modo0700. Un dump AI-33 explícitamente conocido existe: 296.521 bytes,
  modo0600 y mtime del 18 de octubre. **No se abrió ni descifró**.
- El host ofrece `gpg` y `openssl`. No se encontraron en su PATH `age`, `restic`,
  `borg`, `pgbackrest`, `wal-g`, `rclone`, `pg_dump` o `pg_restore`. Esto no
  inventaría binarios de contenedores ni otros hosts; AI-37 usó herramientas
  PostgreSQL dentro de Docker.
- El CLI de preparación de restore no existe en el path del Node operativo932;
  sí existe en el candidato Node AI-38. Esto coincide con su falta de adopción;
  un archivo candidato tampoco acredita infraestructura externa.
- API y worker estaban inactivos por el control del coordinador. El contenedor
  Gemini802d/b8ef conserva su arranque de las19:14:35 UTC. Esta observación no
  alteró estados ni verificó una nueva inferencia.

La ausencia observada es acotada. No se consultaron cron, el hipervisor, Windows,
otros hosts, servicios de backup externos, configuración PostgreSQL/WAL ni R2.
No se puede concluir que tales sistemas no existan fuera de este inventario.

## Qué no equivaldría a aceptación

Un directorio privado o modo0600 acredita permisos observados; no demuestra
cifrado. Tener `gpg` instalado no demuestra que una copia haya sido cifrada.
Un mtime o un nombre no acredita la fecha de captura del contenido ni su plazo
real de expiración. Un timer habilitado tampoco demuestra que completó la
rotación en todos los destinos.

Los pines de paquetes/registro y snapshots de configuración describen versiones
de código o un instante de configuración. No constituyen un inventario de
snapshots, WAL, exportaciones, versiones de objetos o multipart capaces de
reconstruir contenido. Un hash de journal permite validar los bytes entregados;
no prueba que todos los borrados hayan sido registrados.

La [recuperación AI-37](nodia-ai-ai37-recovery.json) conserva33 comprobaciones
aisladas, dump/restore PostgreSQL real y eliminación de objetos mediante puerto
sintético. Verifica el preparador; no demuestra restore operativo desde una
copia cifrada real, journal externo continuo o borrado físico en R2.

## Evidencia concreta que falta para cerrar el gate

Conforme a [política50](../mvp/50-nodia-ai-ai04-runtime-policy.md),
[AI-37](../mvp/83-nodia-ai-ai37-performance-recovery.md),
[AI-38](../mvp/84-nodia-ai-ai38-environment-acceptance.md) y el
[runbook de restore](nodia-ai-ai37-recovery-runbook.md):

| Área | Resultado verificable requerido |
| --- | --- |
| Inventario propio | Enumeración vinculada al entorno de todas las copias que puedan reconstruir contenido: dumps, snapshots, WAL/exportaciones y objetos/versiones aplicables. Identificar destinos, captura y expiración sin copiar contenido al reporte. |
| Cifrado y acceso | Copia realmente producida por el mecanismo elegido, cifrado comprobado y restauración con la clave bajo control del operador; acceso y separación de credenciales acreditados sin exponerlas. Un nombre/extensión no basta. |
| Rotación | Política aplicada de máximo7 días para copias con contenido NodiaAI, respaldada por ejecuciones/expiración observadas en todos los destinos propios, incluidos snapshots y versiones aplicables. |
| Journal externo | Productor de todas las rutas de borrado, durabilidad y secuencia contigua verificadas, head confiable fuera de la copia y cobertura hasta la cuarentena. Guardar sólo IDs opacos/generaciones; retirarlos cuando no quede una copia que pueda resucitarlos, dentro del horizonte de backup más limpieza. |
| Objetos | Inventario y comprobación de desaparición de generaciones/versiones y multipart aplicables. Si un destino no ofrece versionado, acreditar esa condición desde su contrato/configuración real; no asumirla. Conservar por separado los archivos promovidos a registros de negocio. |
| Restore operativo aislado | Restaurar una copia propia real en `nodia_restore_*`, con listeners/consumidores detenidos y aislamiento de red/credenciales verificado. Aplicar reloj actual, expiración y borrados recientes; revocar confirmaciones antiguas y mantener incertidumbre sin replay. |
| Conciliación antes de abrir | Contrastar efectos contra dominio y runtimes actuales, también identidades/objetos ausentes del backup. El preparador devuelve siempre `release_authorized:false`; no retirar marcas o liberar slots para conseguir una prueba verde. |

El objetivo de limpieza física24h y la retención90 días desde el último mensaje
nuevo del dueño conservan sus contratos. No se convierten aquí en garantías de
borrado de discos, WAL o copias del proveedor. La retención remota que no se
pueda comprobar sigue desconocida.

Acciones de esta observación: **cero consultas SQL, cero solicitudes a proveedor
o R2, cero escrituras de datos, cero cambios de servicios y cero secretos
emitidos**. Los únicos archivos nuevos están en el workspace como evidencia.
