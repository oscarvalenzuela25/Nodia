# ADR-104 — Continuación de bytes y retención del inbox de despliegue

> Estado: propuesto, sin aprobación documental
> Fecha: 2026-11-16

## Contexto

Los rechazos de cuota y las respuestas perdidas de upload no pueden resolverse
repitiendo un deploy. [Plan99§30–31](../../mvp/99-production-deployment-and-cicd-plan.md#30-upload-de-backend-cuota-activa-y-diagnóstico--2026-11-15)
conserva los incidentes y la entrega nueva completada. El usuario solicita ahora
retención automática y recuperación de transferencias preservando funcionalidades
y la barrera contra operaciones inciertas. La cuenta SSH continúa restringida:
no shell, SFTP, credenciales nuevas o sudo genérico.

## Opciones consideradas

### Opción A — Repetir el ZIP o el job tras un fallo

- Ventaja: implementación pequeña.
- Desventajas: no distingue recepción de aplicación; puede repetir una intención
  incierta, no recupera parciales ni mantiene capacidad efectiva entre emisores.

### Opción B — Intención durable, prefijo comprobado y archivo terminal

- Ventajas: consultas puras, continuación sólo de bytes ausentes, cuotas
  reservadas y archivo reversible sin ampliar autoridad de ejecución.
- Costos: más intercambios SSH y hashing; requiere adopción coordinada de código
  root, pins y cliente. Una evidencia contradictoria conserva el bloqueo.

### Opción C — Servicio nuevo de almacenamiento/transferencia

- Ventajas: podría reducir viajes SSH y aportar transporte reanudable existente.
- Desventajas: añade custodia, credenciales, red y mantenimiento que no son
  necesarios para el VPS actual. No se incorpora por defecto.

## Decisión

Se implementa B por autorización del usuario; este ADR permanece propuesto.

1. Protocolo de upload v2 con `capabilities`, `upload-status`, `upload-open`,
   `upload-append` y `upload-finish`. Los comandos legacy `status/upload/deploy`
   conservan su contrato. Los planes nuevos eligen v2; un fallo de handshake no
   habilita fallback. El modo v1 requiere selección explícita del plan técnico,
   no se ofrece como un switch de producto ni como rescate de un error v2.
2. Identidad inmutable `(artifact_id, artifact_zip_sha256, run_id, run_attempt,
   bytes)` y upload ID SHA256 de
   `nodia-upload-v2:{run_id}:{run_attempt}:{artifact_id}:{digest}:{bytes}`.
   Otro digest/tamaño para la misma ruta física CI/artifact es conflicto incluso
   sin `.part`. La fuente Git y autorización de ejecución siguen vinculadas al
   artefacto oficial y CI/master por los gates existentes del updater.
3. `STATE/uploads/<id>/intent.json` root0600 y directorios0700 se sincronizan
   antes de crear/recibir bytes. Se reservan tamaño **total** y slot, incluyendo
   lo pendiente; ni un registro sin parcial ni un duplicado eluden la cuota.
   Se conservan los límites de768MiB por ZIP,2GiB/10archivos en incoming y2GiB
   de headroom real. Los8MiB máximos por append son una política nueva versionada,
   anunciada por el protocolo; no una capacidad supuesta del proveedor.
4. El estado de transferencia deriva del archivo protegido y su SHA256 completo
   de prefijo, con identidad de inode/bytes estable. No hay offset mutable de
   ledger que pueda quedar por detrás del archivo tras un crash. El cliente
   compara cada prefijo con su ZIP original previamente verificado.
5. Append exige offset y hash exactos; consume/verifica el bloque acotado antes
   de añadir bytes. Sólo usa append, nunca trunca o sobrescribe. Tras un corte,
   los bytes realmente presentes deben coincidir con el original; sólo se envía
   el sufijo ausente. El lock receiver serializa el CAS por comando y permite
   conservar reservas entre bloques. Los ACK se emiten tras fsync.
6. Finish exige tamaño y SHA256 totales, fsync del propio archivo, rename
   NOREPLACE y fsync de directorio antes del recibo inmutable. Si el rename ya
   ocurrió, una consulta lo demuestra y finish sólo puede sellar el recibo
   faltante del destino verificado; nunca repite el movimiento ni ejecuta app.
   Ambos archivos, digest distinto, ledger huérfano o parcial legacy requieren
   conciliación; no se adoptan, reinician o borran automáticamente.
7. `automatic_retry_allowed:false` conserva su significado sobre efectos de
   aplicación. La continuación de bytes está autorizada por pruebas de estado y
   CAS dentro de un presupuesto finito, no por reinterpretar ese flag. El cliente
   no relaja `prior_cd_run`/`allowNewSubmission`, baseline, CI/master o ausencia
   exacta de operación. Upload completo **no autoriza** un segundo submit,
   migración o activación. El deploy se envía una vez; su incertidumbre se conserva.
8. Retención automática bajo presión de cuota: primero validar disco real y el
   grafo completo de referencias; después archivar el mínimo de ZIPs complete,
   no-current, sin parcial y con todas sus referencias coherentes/completas.
   Largest-first minimiza movimientos; IDs numéricos desempatan, la edad no
   concede elegibilidad. Se conservan hashes, requests, submissions y attempts.
9. Se reutiliza el núcleo de archivo con locks receiver→installation sin adquirir
   dos veces el lock receiver. Todos los intents de archivo se indexan por ZIP
   físico: otro operation ID no evade una transición incompleta. Intent/originales
   durables preceden rename NOREPLACE; la interrupción detiene la preparación.
   No se realizan movimientos parciales de un lote que ya se sabe insuficiente.
10. Capabilities y pin root abarcan receiver, gateway y los dos módulos revisados.
    La adopción operatoria hace CAS de settings/código/current, registra originales
    antes de sus cinco escrituras y cambia el pin al final. Un fallo intermedio
    queda cerrado y exige inspección, sin autorollback o replay. No modifica
    updater, sudoers, app, servicios o credenciales. SSH nuevo acredita adopción.

## Consecuencias

- La cuota activa puede mantenerse sin intervenciones manuales repetidas y una
  respuesta perdida puede conciliarse sin reenviar bytes ya presentes.
- Hashing y viajes SSH crecen con los bloques;8MiB, memoria acotada,256peticiones,
  presupuesto temporal y locks limitan recursos. Medir el circuito real antes
  de afirmar mejoras de latencia; este cambio prioriza recuperabilidad.
- El archivo conserva bytes en el mismo filesystem: **no libera disco físico**.
  No hay borrado automático de archivos, releases, backups, secretos o evidencia.
  Si falta headroom o no hay candidatos seguros, se rechaza antes de nuevos bytes.
  La política de purga/offload del archivo requiere alcance y custodia propios.
- Los scans tienen límites y fallan cerrados; no se aprueba un inventario parcial.
  No se expiran reservas inciertas para obtener espacio. Los logs/recibos públicos
  sólo exponen hashes, IDs, offsets, límites y códigos cerrados.
- Se prueban cortes antes/después de append/fsync/rename/recibo, ACK perdido,
  CAS/hash/EOF, cuotas concurrentes, aliases, pins, locks y preservación de datos.
  Fixtures no equivalen a adopción remota ni a inferencia/aceptación de NodiaAI.
- Infraestructura exclusivamente: sin nuevos permisos, herramientas, modelos,
  contratos de dominio o corpus publicado; no se crean fichas funcionales.

## Referencias

- [Plan99](../../mvp/99-production-deployment-and-cicd-plan.md), [TODO OPS-001](../../mvp/TODO.md).
- [ADR097](ADR-097-monorepo-production-release-pipeline.md), [ADR099](ADR-099-pre-migration-deployment-reconciliation.md), [ADR103](ADR-103-backend-payload-equivalence-with-preserved-source.md).
- [Receiver](../../../ops/production/deploy-backend-receiver.py), [módulo de recepción](../../../ops/production/backend_upload.py), [archivo](../../../ops/production/archive-completed-backend-upload.py).
- [Cliente CI](../../../ops/ci/cd-upload.mjs), [operador de adopción](../../../ops/production/refresh-upload-transport.py).
