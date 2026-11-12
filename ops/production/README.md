# Preparación del VPS del piloto

## Estado vigente — 2026-11-12 UTC

**Continuación CD:** transporte fijo y actualizador instalados; conexión nueva de
Actions desde el PC verificada. No se desplegó otra app: f01 sigue activo.
Ver [instalación CD](#transporte-cd-instalado--2026-11-12). Los estados
«sólo status / no sudo / no instalado» inferiores son cortes históricos.

El backend de master `f01b493336883403a84b1c80759ce4fc43cbd370` está instalado en
`/opt/nodia/releases/backend-f01b49333688-ff33b6fdbbbc`; `/opt/nodia/current`
apunta a ese release. API y Worker están **active y enabled**, bajo `nodia`,
con el mismo paquete/cwd. Se conserva el runtime f01 inmutable; las correcciones
de operación se mantienen fuera del paquete. Los estados disabled/inactive y
current ausente descritos después corresponden a cortes históricos del montaje.

Nginx publica `https://166.0.112.187/api/v1`. Se comprobaron desde el PC la cadena
y el nombre IP con clientes TLS estándar, respuesta HTTP 200, CORS para
`https://nodia-1ge.pages.dev`, OPTIONS de login 204 y acceso sin sesión a auth/me 401.
Los puertos 3000 y 6379 no son alcanzables desde esa prueba externa. Se conservan
HTTP-01/redirect 308, `/tls-check` y la renovación de Certbot. Son comprobaciones de
transporte y autorización sin sesión; el login Google, cookies y refresh reales
siguen pendientes. El frontend f01 ya se publicó en
`https://nodia-1ge.pages.dev`: index y asset API coinciden por hash con el paquete,
y URL API/Google Client ID coinciden con el backend. Pages conserva producción
master y auto-deploy deshabilitado; ver [frontend R01](../../docs/evidence/production-frontend-live-20261112-r01.json).

El backup `c2e5b337-3f3f-48db-b70a-71cfc15d00f7` quedó **ready** en R2 a
`2026-11-12T02:42:48.187Z`. Su restauración en Docker aislado del PC verificó
45 migraciones, 68 tablas de entidades y fingerprints coincidentes de 94 tablas/
122 filas; también pasó la preparación en cuarentena, sin dispatch ni release
del trabajo recuperado. El recibo local es
`output/production/restore-first-backup-20261111-r02.json`; la base de origen no
se restauró. Los timers de backup diario a las 02:30 UTC y rotación cada 5 min están
habilitados. Esto no demuestra una ejecución futura del timer ni una alerta.

La privada RSA y el sobre cifrado de configuración están custodiados en el PC
con acceso exclusivo del usuario; el descifrado y los digests se comprobaron.
La privada no se envió al VPS. Falta una segunda copia offline. La rotación de
las credenciales PostgreSQL expuestas fue pospuesta por el usuario hasta antes
de stakeholders. También quedan CI/CD, alertas, recuperación integral ante
fallos y aceptación funcional/IA por sus alcances propios.

La prioridad indicada ahora por el usuario es **ver funcionar la aplicación**:
abrir el frontend publicado y probar Google login/cookies/refresh y el uso real.
CI/CD, ampliación de logs, monitoreo, revisión de errores y mejoras de seguridad
se retomarán después; no se implementan por publicar este corte documental.
La rotación PostgreSQL conserva su compromiso previo a abrir stakeholders.
La sesión administrativa quedó con el ticket sudo invalidado mediante `sudo -k`.

Fuente consolidada: [backend operativo R01](../../docs/evidence/production-backend-live-20261112-r01.json).
Las recetas siguientes conservan la secuencia y las incidencias históricas;
los helpers de primera instalación no son comandos de actualización rutinaria.

## Configuración privada inicial

El host debe estar preparado y ambas unidades disabled/inactive. Bundle:
`configure-backend.py` y `defaults.json` privado, modo 0600, en
`/home/nodia-admin/nodia-setup/backend/`. Los defaults incluyen sólo preferencias
no secretas; no se versionan correo personal ni el archivo concreto en Git.

```bash
sudo python3 /home/nodia-admin/nodia-setup/backend/configure-backend.py \
  --defaults-file /home/nodia-admin/nodia-setup/backend/defaults.json
```

El operador introduce en Warp USERNAME normal/password de PostgreSQL y los datos
S3 de R2: endpoint HTTPS raíz **sin `/nombre-del-bucket`**, account ID, Access Key
ID y Secret Access Key. Son las credenciales S3 de R2, no un bearer token genérico
de Cloudflare. Password y claves se solicitan ocultos; no pegarlos en el chat.
Bucket de archivos confirmado: `nodia-production`. El prompt de recuperación
permite otro bucket; Enter conserva el de archivos y el contrato usa su prefijo
de deployment único, sin modificar objetos hasta inicializar el journal aparte.

Antes de pedir secretos, prueba el escapado EnvironmentFile mediante una unidad
systemd efímera con valores sintéticos. Se confirmó también el roundtrip real en
el manager de usuario del VPS, incluyendo `$`, comillas, backslashes y símbolos
de shell; no se usa `source` ni `eval` sobre la contraseña.

Genera JWT, cifrado IA, token interno Gemini y clave/era/identidad del journal una
vez. Guarda `/etc/nodia/runtime.env` root, modo 0600 y
`/var/lib/nodia/config/recovery.json` nodia, modo 0400 con creación exclusiva, sin seguir
symlinks y fsync. Un archivo previo/parcial impide repetir: inspeccionar, nunca
borrarlo o regenerar claves a ciegas. `/etc/nodia/redis.env` existente se conserva.

Configura el puerto 3000, TLS verificado, orígenes exactos, cookies Secure/None y
proxies loopback. SameSite=None no garantiza que cada navegador permita cookies
entre Pages y la API por IP; el login público tiene aceptación propia pendiente.
El Google Client ID prellenado procede del frontend local; su paridad con la
configuración publicada y Google OAuth todavía requiere comprobación real.

Estado local sin valores en `/var/lib/nodia-backend-setup/config-status.json`,
root, modo 0600. Guardar archivos no valida permisos R2, inicializa journal/backups,
califica proveedores o ejecuta migraciones. No instala RSA privada en el VPS.
No habilita ni inicia API/Worker. El operador confirmó configuración guardada;
no se leen ni copian sus secretos al chat. Cinco pruebas puras y la autoprueba
systemd con valores sintéticos cubren el guardado local. La prueba Node separada
completó configuración, PostgreSQL READ ONLY/TLS, Redis AUTH/PING y R2 HEAD;
ver el staging siguiente. Esto todavía no acredita escritura R2 ni recuperación.

## Usuario de ejecución y systemd

Primera preparación del host, con los cuatro archivos del bundle juntos en
`/home/nodia-admin/nodia-setup/backend/`:

```bash
sudo bash /home/nodia-admin/nodia-setup/backend/bootstrap-backend-host.sh
```

Crea `nodia:nodia` con UID/GID de sistema libres entre 900–989, distintos del
UID 999 de Redis. Cuenta con contraseña bloqueada, shell `/usr/sbin/nologin`,
sin sudo, Docker o claves SSH. `nodia-admin` conserva la administración.
No modifica SSH/firewall ni crea una credencial adicional de login.

| Ruta | Propietario/modo | Uso |
| --- | --- | --- |
| `/opt/nodia/releases` | root:root, 0755 | Paquetes versionados, no escribibles por la app |
| `/var/lib/nodia` | root:nodia, 0750 | Padre del estado de ejecución |
| `/var/lib/nodia/home` | nodia:nodia, 0700 | HOME privado |
| `/var/lib/nodia/codex` | nodia:nodia, 0700 | Perfiles/locks si se califican proveedores nativos |
| `/var/lib/nodia/config` | root:nodia, 0750 | Configuración de recuperación futura, sólo lectura en units |
| `/etc/nodia` | root:root, 0700 | EnvironmentFiles leídos por systemd, sin abrir Redis |

Instala `nodia-api.service`, `nodia-ai-worker.service` y el validador local
`/usr/local/lib/nodia/validate-runtime-env.mjs`. Valida sintaxis y hace
`daemon-reload`, pero deja ambas unidades **disabled/inactive**. No inicia API,
worker, migraciones, seeds ni llamadas a proveedores. Rechaza unidades distintas,
activas/habilitadas o una identidad existente incompatible; no es un actualizador.
Una preparación fallida conserva estado para inspección, sin borrarlo automáticamente.

Ambos servicios usan el mismo `WorkingDirectory=/opt/nodia/current` y ejecutan
Node sobre `dist/main.js` / `dist/nodia-ai-worker.js`. `Type=exec` acredita exec,
no readiness. `Restart=on-failure`, SIGTERM, KillMode=mixed y TimeoutStopSec=180
reservan margen sobre el drain actual de 150 s; parada real sigue por comprobar.
UMask=0077, NoNewPrivileges, capacidades vacías, ProtectHome y ProtectSystem=strict;
escritura sólo en HOME/perfiles y el temporal privado. No se bloquea V8 JIT ni
se oculta `/proc`, necesarios para el runtime auditado. Estas reglas iniciales
no califican inferencias o proveedores nativos automáticamente.

EnvironmentFiles `/etc/nodia/runtime.env` y `/etc/nodia/redis.env`
(ambos ya configurados privadamente) son leídos por PID1. No crear un `.env` dentro del release. El JSON
de recuperación lo lee Node: debe ir en la ruta compartida
`/var/lib/nodia/config/recovery.json`, UIDnodia, modo 0400, accesible al proceso y
montado de sólo lectura por ambas units. No sirve root, modo 0600 bajo `/etc/nodia`
ni dos LoadCredential con rutas diferentes: el runner exige mismo path/cwd.
Los CLI que carguen este JSON deben ejecutarse con la identidad `nodia`: el
loader acepta root o el UID del proceso como propietario, y aquí el archivo
pertenece a nodia. Ejecutarlo como root con ese archivo no cumple la validación
de ownership. Preparar las unidades/configuración de recuperación con esa
identidad al abordar journal y backups, sin cambiar el propietario a ciegas.

ExecStartPre valida producción/TLS, DB explícita, Redis local, auth, políticas,
assets, recuperación real y Node 24 >=24.22.2 sin arrancar Nest o contactar DB/R2.
Emite sólo campos/códigos de error, nunca valores. Sin release/env/recovery,
el servicio no está listo para arrancar. El API actual escucha PORT sin fijar
host; UFW debe seguir bloqueando acceso directo al puerto 3000 hasta la integración Nginx.

```bash
cat /var/lib/nodia-backend-setup/status.json
getent passwd nodia
id nodia
sudo passwd --status nodia
systemctl is-enabled nodia-api.service nodia-ai-worker.service
systemctl is-active nodia-api.service nodia-ai-worker.service
```

Estado al 2026-11-10: bundle copiado, Bash/Python/Node comprobados y systemd-analyze
verify en VPS devuelve0. Los avisos CPUAccounting de xfs pertenecen al sistema.
Nueve pruebas pequeñas de validador/paquete pasaron en Linux aislado; no son
pruebas de aplicación activa. **Ejecutado satisfactoriamente:** usuario nodia UID/GID 900, units disabled/inactive
y pruebas de permisos superadas. [Evidencia](../../docs/evidence/production-backend-host-20261110-r01.json).
El administrador sin sudo tampoco puede listar el estado privado de la app; es
una restricción esperada y no se amplían permisos para inspeccionarlo.

## Paquete Linux del backend

`build-backend-release.sh SOURCE_SHA OUTPUT_DIR SOURCE_MANIFEST_JSON` se ejecuta
desde un snapshot `git archive` completo, en Linuxx64 con Node24.22.2. Verifica
todos sus archivos contra el manifiesto de fuente antes de `npm ci`; build y
checks operan sin entorno productivo, `.env`, perfiles o sesiones. No compilar
en el VPS ni empaquetar node_modules de Windows. La raíz final del paquete es
Server: package.json/lock, dist completo (incluidos fragmentos Markdown),
dependencias productivas Linux y scripts de instalación/journal/backup/PDF.

`package-backend-release.mjs` valida assets/pins, módulos nativos y enlaces
internos; produce tar, manifiesto e identidad/hashes por contenido. No inicia
API/worker ni ejecuta migraciones. El paquete y el validador del host tienen
checks pequeños bajo `tests/`, ejecutables con `node --test`.

Corte inicial del candidato (2026-11-11): master `ba8ebfa00b55f103465d0ab533a802152944d224`, igual a HEAD
local development en la inspección. Builder Ubuntu24.04 local/WSL con Node oficial
y checksum comprobado; snapshot de 6867 archivos sin `.env`. Se corrigieron seis
referencias locales en tres borradores, manteniendo fuentes/aprobaciones intactas.
El paquete `backend-candidate-ba8ebfa00b55-e61ee5a268e7` pasó build, lint,
pruebas offline y módulos nativos; los 24490 archivos/enlaces y modos fueron
comprobados de nuevo contra el tar y su manifiesto. Usa tooling congelado y
permisos normalizados 0644/0755.

Es **candidato no desplegable** (`deployment_eligible=false`): registra el SHA
base y los tres overlays de documentación sin atribuirlos falsamente a master.
Las correcciones de ese corte se versionaron/promovieron después mediante PR1;
el candidato histórico conserva su procedencia con overlays. No cambiar current
ni arrancar API/Worker desde ese candidato. Puede usarse para comprobaciones
explícitas de sólo lectura en una ruta separada. Evidencia consolidada:
[preparación R01](../../docs/evidence/production-backend-preparation-20261111-r01.json).

## Staging aislado y prueba Node de dependencias

Ejecutado el 2026-11-11 desde Warp, con sudo del operador y sin volver a pedir
credenciales de aplicación:

```bash
sudo python3 /home/nodia-admin/nodia-setup/backend/stage-backend-candidate.py \
  /home/nodia-admin/nodia-setup/backend/backend-candidate-ba8ebfa00b55-e61ee5a268e7.tar.gz \
  9a2df3918462bc7d000c2fab51de3bcbfc532ff2b0768aec1e97d2cd1dd9218b \
  --probe-sha256 d8063829b6a1a55c9b0ad6bd394e9cae313f7d1e0a387ff935d80f829c4a95f3
```

`stage-backend-candidate.py` copia primero el tar a una ruta privada root,
comprueba hash, manifiesto, inventario, enlaces y modos antes de extraerlo en
`/opt/nodia/candidates/backend-candidate-ba8ebfa00b55-e61ee5a268e7`.
No cambia `/opt/nodia/current`. Reutiliza un candidato existente sólo tras
comprobar su recibo e inventario; no sobreescribe una instalación activa.

Una unidad temporal ejecuta `probe-backend-dependencies.mjs` como nodia, con
los EnvironmentFiles privados y el candidato como cwd. Valida configuración
local; PostgreSQL con verify-full, TLS1.3 y metadatos READ ONLY/ROLLBACK;
Redis AUTH/PING y R2 HeadBucket. No arranca Nest, ejecuta migraciones/seeds,
inicializa journal ni escribe objetos R2. HEAD no demuestra permisos PUT o restore.

El primer intento pasó todas las dependencias, pero clasificó como fallo un
stop/reset-failed de la unidad ya descargada. Se corrigió la limpieza para
comprobar sus postcondiciones reales: inactiva, PID cero, fragmento ausente y
archivo temporal eliminado. Doce pruebas de regresión pasaron. La reejecución
completa terminó `dependencies_verified` a las `2026-11-11T03:58:22.350240+00:00`.
Hash del stager corregido:
`8c6c0b6a58fd972237639e976dc47687cbd5d530414967807a26cfc68e201a32`.

Resultados públicos filtrados, sin credenciales:

```bash
cat /var/lib/nodia-backend-setup/candidate-status.json
cat /var/lib/nodia-backend-setup/dependency-result.json
systemctl is-enabled nodia-api.service nodia-ai-worker.service
systemctl is-active nodia-api.service nodia-ai-worker.service
systemctl list-units --all --type=service 'nodia-backend-check-*'
```

La inspección SSH posterior confirmó cero units/archivos temporales, current
ausente y API/worker disabled/inactive. El candidato conserva
`deployment_eligible=false`: primero versionar/promover las tres correcciones,
producir el release exacto de master y ensayar primera instalación/journal/backup.
[Evidencia consolidada](../../docs/evidence/production-backend-preparation-20261111-r01.json).

## Release versionado y ensayo de primera instalación

Preparar una rama `codex/production-first-install` desde el master observado,
en un worktree aislado. Incluir sólo las correcciones documentales de compilación,
las herramientas de producción y el contrato TLS de backups. El trabajo Teacher
no publicado permanece en development; no hacer `git add` global en ese checkout.

Construir desde `git archive` del commit elegido, comprobar su identidad con
`git get-tar-commit-id` y generar el manifiesto a partir de sus bytes. Builder y
packager deben salir del mismo archive y permanecer congelados durante el build.
Un manifiesto `git_archive` sin overlays acredita identidad de fuente; su
`deployment_eligible=true` no equivale a autorización de rollout o aceptación del entorno.

El stager conserva el modo candidate-only por defecto. Para un release Git
versionado exige `--allow-git-release` además del hash del tar y del probe; aun así
extrae sólo en `/opt/nodia/candidates` y no activa current ni inicia escritores.
La promoción final debe corresponder al SHA efectivo de master, no a una etiqueta
mutable ni a un paquete recompuesto sin identidad.

`rehearse-first-install.mjs` ensaya el paquete Linux ya compilado con PostgreSQL16
y Redis desechables. Recibe hashes de ambos tars (backend y Node) e IDs inmutables
de las tres imágenes locales. Usa red interna, entorno sintético cerrado y
volúmenes de sólo lectura para Node/paquete; no reutiliza los contenedores de desarrollo.
El comando ejecutado dentro del paquete es `node scripts/seed-core.mjs --migrate`,
sin npm ni recompilación. Comprueba esquema, ledger, administrador, asignaciones
Core e idempotencia, y conserva un recibo seguro con la limpieza de sus recursos.
El ensayo local no acredita permisos del usuario normal de Northflank ni el
estado vacío del destino: comprobarlos por separado antes de migrar allí.

El contrato opcional `database.tls` de backups admite exclusivamente verify-full
con CA explícita; pg_dump y conciliación del journal comparten esa selección.
Seis pruebas unitarias y un fixture real PostgreSQL16.15 verificaron dump válido,
rechazo de CA ajena y rechazo de hostname incorrecto; todos sus recursos se retiraron.
No se generó un backup operativo ni se contactó R2 en ese fixture. Provisionar
esta configuración en el VPS y ensayar cifrado/restore siguen siendo pasos posteriores.

Estado posterior al merge de [PR1](https://github.com/oscarvalenzuela25/Nodia/pull/1):
master `f01b493336883403a84b1c80759ce4fc43cbd370`, paquete
`backend-f01b49333688-ff33b6fdbbbc`, SHA256 del tar
`b8ac639b2cc032839dd17769b81f1da85cb16263f39594230e06ed2e1f1b7f38`.
Build completo y ensayo del paquete exacto pasados (45 migraciones, 68 tablas de
entidades y bootstrap idempotente); tar y cuatro helpers copiados al VPS con
hashes coincidentes. El parser remoto admitió el archive sin extraerlo. Staging
privilegiado completado por el operador: dependencies_verified a
2026-11-11T23:29:20.969202+00:00. PostgreSQL16.14/READ ONLY/TLS1.3, Redis
AUTH/PING y R2 HEAD pasados; cero units/archivos temporales. API/Worker siguen
disabled/inactive y current ausente. [Recibo](../../docs/evidence/production-first-install-20261111-r01.json).

Después de un staging terminado en `dependencies_verified`, ejecutar la
inspección READ ONLY, sin inicializar TypeORM:

```bash
sudo bash /home/nodia-admin/nodia-setup/backend/inspect-postgres-installation.sh \
  /opt/nodia/candidates/backend-f01b49333688-ff33b6fdbbbc \
  0f75b5d9dddcc08e0722274d0df37f1b5ffef7cc828bd293ed8a62097ed6cb7b
```

El wrapper comprueba identidad del paquete y writers detenidos, instala el helper
por hash y usa PID1 para leer el EnvironmentFile privado. Inspecciona TLS,
privilegios, extensiones y catálogos de relaciones/rutinas/tipos/esquemas en
READ ONLY/ROLLBACK. Códigos: 0 precondiciones satisfechas, 2 inspección bloqueada,
1 error. No concede permisos ni migra. El resultado debe revisarse antes de
journal, migración y activación real. La primera inspección ya terminó: conexión/TLS/READ ONLY correctos, pero rol normal sin CREATE de DB, extensiones requeridas aún sin instalar e inventario1esquema/1rutina/2extensiones adicionales,0relaciones. No atribuir ese inventario a Northflank sin identificarlo. El comando anterior conserva el hash histórico; la continuación diagnóstica usa el helper actualizado siguiente.

### Diagnóstico del catálogo antes de adoptar una baseline

El modo explícito `--catalog-details` conserva todos los gates y añade listas
cerradas/acotadas a 100 nombres por categoría, con totales y truncación. No lee
filas de negocio, cuerpos de funciones o nombres de roles; ownership se publica
sólo como owner_is_current. Diez tests y SQL real en PostgreSQL16.15 desechable
pasaron, incluyendo1esquema/1rutina/2extensiones adicionales; recursos retirados.

Helpers ya copiados y hashes verificados. Ejecutado por el operador; comando histórico de diagnóstico:

```bash
sudo bash /home/nodia-admin/nodia-setup/backend/inspect-postgres-installation.sh \
  /opt/nodia/candidates/backend-f01b49333688-ff33b6fdbbbc \
  54b743132c49e27e8400de6151dfa4181014e110ea7537fdc960cd104a5428e9 \
  --catalog-details
```

Exit2 sigue siendo esperado mientras las precondiciones estén sin resolver.
No borrar objetos, conceder permisos o añadir excepciones a la baseline antes de
revisar los nombres y su origen. El release de aplicación f01b4933 permanece
inmutable; esta revisión es del helper externo de operación.

El diagnóstico identificó pooler.user_lookup (firma i_username text, OUT uname
text, OUT phash text, plpgsql SECURITY DEFINER), pg_stat_kcache2.3.2 y
pg_stat_statements1.10 en public, todos de otro propietario. Sus metadatos
coinciden con infraestructura de pooling/estadísticas; la procedencia exacta
del proveedor sigue siendo inferencia, no un atestado. Se conserva el inventario
crudo y se prepara una baseline explícita ligada al destino, sin permitir objetos extra.

`prepare-postgres-extensions.sh` y `.sql` ya se copiaron al VPS con hashes
comprobados; el operador reportó mantenimiento completo en producción. Piden
ADMIN_USERNAME y password sólo en terminal, con psql/verify-full/CA y entorno
cerrado. El SQL transaccional instala únicamente uuid-ossp/pg_trgm en public,
rechaza una ubicación previa distinta y no concede permisos ni migra la app.
Doce comprobaciones PostgreSQL16.15 desechable acreditaron que el rol normal
puede usarlas después manteniendo database CREATE=false. El operador completó la autenticación/ejecución administrativa privada; la
revalidación normal y la comparación exacta de la baseline también pasaron.

### Estado inicial gestionado, journal e instalación SQL controlada

Tras el mantenimiento administrativo, el operador confirmó desde la cuenta
normal uuid-ossp1.1/pg_trgm1.6 en public y CREATE de DB=false. La inspección con
perfil explícito d720/7f49 comparó exactamente destino, PostgreSQL16.14,
pooler.user_lookup y extensiones de monitoreo: application_destination_empty y
first_installation_preconditions=true. El inventario crudo no se borra ni se
presenta como una base literalmente vacía. El perfil nuevo es
`postgres-provider-baseline.json`; su procedencia está marcada como inferencia
sin atestación o aprobación de producto, y los tests rechazan cualquier cambio
adicional/truncación/destino diferente.

`bootstrap-recovery-journal.py` fue ejecutado por el operador y confirmado por
SSH: journal ready, abierto/vacío, sin backups desde 2026-11-12T00:30:06.249Z. Usa el mismo installation.lock que la primera instalación, verifica
paquete/configuración/writers detenidos y preflight fresco. Llama al CLI del
paquete como nodia (status/bootstrap/status). Un intent root durable precede al
único PUT inicial; una respuesta incierta nunca autoriza reenviar la escritura.
Conserva sólo últimos diagnósticos root600 acotados; no cierra eras, migra o activa.
Doce pruebas de contrato pasaron; PID1/R2 reales confirmaron creación y lectura
del estado inicial. Esto no acredita un backup ni cobertura histórica.

`install-backend-database.py` + `.mjs` ya instalaron la base en Northflank.
Exigen journal existente abierto/prístino y preflight completo antes del CLI
compilado seed-core --migrate. Verifican45 migraciones/68 entidades/identidad privada
con4 accesos Core, sin provider credentials. Estado durable antes del intento SQL;
failed/unknown no se reintenta automáticamente y complete sólo permite lectura.
La primera acción terminó, pero el wrapper ocultó su resultado al limpiar con
un namespace incompatible. Se corrigió el helper (17 tests, dos con PID1 real)
y el operador ejecutó --reconcile-only con la unidad exacta, sin repetir SQL.
El resultado original validado y un nuevo postcheck READ ONLY confirman45 migraciones,
68 tablas de entidades,1 administrador,4 asignaciones Core y0 credenciales de proveedores.
Estado público phase=complete/completion_kind=reconciled_read_only a
2026-11-12T00:49:42.103712+00:00. Se conservan fallo y diagnósticos originales.
En ese corte, API/Worker seguían disabled/inactive, current ausente y0 unidades/archivos temporales; la activación posterior figura en el estado vigente.

`new-recovery-key.ps1` generó la pareja RSA3072 real en el UserProfile fuera de
Git, con DACL exclusiva del usuario y no sobrescritura. El privado PKCS8 no tiene
cifrado de archivo/passphrase; no llegó al VPS ni se imprime. La pública SPKI se
copió al setup del operador; su DER coincide con
`f7af9aea7868daa71a9500f9bbd91f35a3fe6fea396f82d5f5a9c78ab8510bbd`.
OAEP-SHA256 pasó en .NET y Node. Posteriormente se instalaron pública/configuración
y se comprobaron backup/restore y custodia en el PC; queda la segunda copia offline.

La investigación local de restore conservó captura completa y probó
pg_restore --schema=public --no-owner --no-acl --exit-on-error con extensiones
requeridas precreadas. Antes de adoptarlo debe acreditarse que no hay objetos
Nodia fuera de public, large objects u otros requisitos sin cubrir; el dump
completo incluye metadata del proveedor que no se debe recrear a ciegas con
propietarios/ACL distintos. El ensayo cliente16.15→servidor16.15 pasó. Una prueba posterior con dump/restore 18.6
hacia16.15 falló antes de DDL por SET transaction_timeout=0. Provisionar cliente16
para captura/restauración; no ignorar errores ni modificar headers del archive.
Cliente16.15 ya está instalado en producción y verificado por rutas explícitas. Recibos consolidados en
[primera instalación R01](../../docs/evidence/production-first-install-20261111-r01.json).

### Cliente16 para backup/restauración sobre Northflank16

`prepare-postgres-client.sh` fue ejecutado por el operador; comprobación SSH
confirma client16.15 y sus tres binarios root:root0755, client18/libpq18 preservados. Configura PGDG oficial con clave verificada/Signed-By y pin negativo
para otros paquetes. La simulación sólo admite postgresql-client-16; no upgrades,
removals ni servidor. Fija16.15-1.pgdg26.04+2 revisado, preserva client18 y comprueba
pg_dump/pg_restore/psql por sus rutas explícitas en `/usr/lib/postgresql/16/bin`.
Cinco pruebas de política y sintaxis pasaron; índices firmados y DEB verificados.

```bash
sudo bash /home/nodia-admin/nodia-setup/backend/prepare-postgres-client.sh
```

Sólo necesita sudo de Linux en la terminal privada; no usa credenciales de la DB,
no conecta Northflank/R2, migra, genera backups o inicia aplicaciones. Si cambia
el candidato oficial o requiere otro paquete, aborta para revisar el plan.

El primer intento se detuvo después de leer índices sin instalar client16. El
parser Candidate cerraba el pipe; apt-cache recibió SIGPIPE141 bajo pipefail.
El parser corregido consume toda la salida, con regresión de productor grande.
Copia/sintaxis/hash verificados; consulta y simulación reales sin sudo pasaron
(único cambio client16, cero upgrades/removals). Helper actual SHA256
`dcfbb2465cec7bb46e4a47ce3dd480f318a803cfd8a1a6b1e2d206cc5249bde9`. Repetir el bloque sudo conserva la fuente/clave/pin existentes;
la continuación terminó correctamente y la instalación fue verificada. Originales
en ops/maintenance.

### Preparar runner y custodia cifrada de configuración

Primer helper Python SHA256 `fe2af13c0a42e181e18a32a3a82f6cf8b6eb994309b5bf35bc28016179f48fb1`,
action `764e7de11f880b0c14f67e445607ee6b430aedce13fc3ce10622c6f427a1847b`.
Ambos se copiaron/verificaron, junto al guard dd3a existente. La ejecución ya
terminó con el helper corregido `ee87cd58428584ab391091257e79862df69b4aabdd3a50e3b6137163fccacf53`;
la validación inicial rechazaba installation.lock vacío. Se conservaron originales
en `ops/maintenance`, sin regenerar secretos ni alterar el runtime f01.
Diez tests, revisión independiente, loader f01 real en UID900/Docker y semántica
FD root600/EnvironmentFile con PID1 WSL comprobados; no sustituyen ejecución real.
Se retiró escritura de grupo/otros de las rutas setup propias del operador y de
la pública subida (0644); la privada RSA permanece fuera del VPS.

```bash
sudo python3 -I /home/nodia-admin/nodia-setup/backend/configure-production-backups.py \
  /opt/nodia/candidates/backend-f01b49333688-ff33b6fdbbbc \
  --source-sha f01b493336883403a84b1c80759ce4fc43cbd370 \
  --tree-sha256 ff33b6fdbbbc05167745da9c2fde5f3d19355baf51d51214bbc7121cb6ea1e6f \
  --helper-sha256 ee87cd58428584ab391091257e79862df69b4aabdd3a50e3b6137163fccacf53 \
  --action-sha256 764e7de11f880b0c14f67e445607ee6b430aedce13fc3ce10622c6f427a1847b
```

Crea de forma exclusiva pública nodia0400, backup.json nodia0600 y spool nodia0700.
Configura dump16/TLS verify-full y límites explícitos256MiB/300s. Conserva bytes
originales de runtime.env/redis.env/recovery.json y los cifra en sobre NODCFG01
(AES256GCM + RSA-OAEP-SHA256); sólo ciphertext sale al setup administrativo.
No modifica esos originales ni migra/inicia writers/contacta R2/crea dump.
Si termina, descargar ciphertext y probar descifrado fuera del VPS antes de
aceptar custodia. Si falla, preservar el estado parcial y revisarlo antes de repetir.

### Unidades de backup y rutas canónicas del CLI

`bootstrap-backup-units.sh` instala las unidades sin arrancar ni habilitar timers.
El servicio de backup requiere que la conciliación del journal termine bien;
la rotación la solicita como Wants y conserva su propio control de retención,
con el fallo de conciliación visible por separado. Tras el backup manual y el
restore aislado se habilitaron los timers diario a las 02:30 UTC y cada 5 min.

`/etc/nodia/backup-runner.env` contiene sólo cuatro paths, sin credenciales.
Los scripts apuntan a la ruta canónica del release:

```text
NODIA_AI_BACKUP_SCRIPT=/opt/nodia/releases/backend-f01b49333688-ff33b6fdbbbc/scripts/nodia-ai-backups.mjs
NODIA_AI_JOURNAL_SCRIPT=/opt/nodia/releases/backend-f01b49333688-ff33b6fdbbbc/scripts/nodia-ai-journal.mjs
NODIA_AI_BACKUP_CONFIG=/var/lib/nodia/config/backup.json
NODIA_AI_RECOVERY_CONFIG=/var/lib/nodia/config/recovery.json
```

En f01, invocar el CLI mediante `/opt/nodia/current/scripts/...` no ejecutaba su
main guard porque compara la ruta invocada con la URL real del módulo. Se reparó
el archivo de paths con `pin-backup-runner-paths.py`, sin hotpatch del paquete.
`WorkingDirectory=/opt/nodia/current` se conserva: el cwd real de los escritores
coincide con el release canónico. Cada futura adopción deberá actualizar ambos
paths junto con el release activo y verificar backup/conciliación; dejar los
anteriores no acredita el nuevo paquete y puede fallar `writers_unverified`.
El reparador es específico de la configuración antigua y no es un actualizador
genérico para siguientes despliegues.

### Publicación HTTPS de la API

`enable-backend-proxy.py` aplica `nodia-api.nginx.conf` sólo después del gate de
restore, comprobando la atestación root de la prueba aislada en el PC y la
identidad del release/escritores. Conserva ACME y el certificado IP, valida
Nginx y recarga con restitución del sitio anterior si falla. Esa atestación
expresa evidencia del operador fuera del VPS; no repite la restauración en Linux.

El proxy mantiene `/api/v1` hacia 127.0.0.1:3000, sobrescribe headers forwarded,
no reintenta peticiones y conserva 404 fuera de las rutas previstas. El límite
32 MiB es una envolvente de transporte; no amplía los límites de archivos/DTO.
Buffering deshabilitado no acredita SSE ni WebSocket; el contrato expuesto de
f01 usa polling. La aplicación efectiva y las pruebas externas constan en el
[recibo operativo](../../docs/evidence/production-backend-live-20261112-r01.json).

## Conexión PostgreSQL de sólo lectura

Copiar juntos `check-postgres.sh` y `check-postgres.sql` a
`/home/nodia-admin/nodia-setup/postgres/`. Desde Warp, como nodia-admin:

```bash
bash /home/nodia-admin/nodia-setup/postgres/check-postgres.sh \
  primary.nodia-db--8hqb8b7kvmx4.addon.code.run 29102 nodia_db
```

El puerto externo confirmado es29102; 5432 es interno. El script se invoca sin
sudo. Si falta psql instala exclusivamente `postgresql-client` mediante sudo
(candidato Ubuntu18.6 observado); esa primera contraseña es la de Linux. No
instala ni arranca un servidor PostgreSQL en el VPS. Después pide `USERNAME`
normal de Northflank y psql solicita su contraseña con entrada oculta por TTY:
esa segunda contraseña es la de la base. No usar ADMIN_USERNAME para esta prueba.
La contraseña no se guarda en argumentos, entorno, archivos o historial.

Antes de pedir credenciales resuelve DNS (hasta tres búsquedas, máximo15s) y
comprueba TLS con OpenSSL. Pasa la IP resuelta sólo a esa ejecución mediante
PGHOSTADDR, conservando PGHOST para validar el hostname; no escribe `/etc/hosts`
ni fija la IP en configuración de aplicación. No reintenta autenticación/SQL.

Fuerza `verify-full`, CA `/etc/ssl/certs/ca-certificates.crt`, negociación
PostgreSQL y GSS deshabilitado para exigir TLS. Desactiva psqlrc, usa timeouts,
`default_transaction_read_only=on`, `BEGIN READ ONLY` y `ROLLBACK`. Consulta sólo
metadatos: base esperada, versión, wal_level, recovery, estado TLS de su sesión y
conteo de tablas en catálogos. No ejecuta migraciones, seeds ni lee filas de
negocio. Cero tablas no prueba una base vacía ni habilita un bootstrap.

Resultado sin usuario/contraseña en
`/home/nodia-admin/nodia-setup/postgres/status.json`, modo 0600. La salida de errores
de psql puede incluir usuario/base; no incluye por diseño la contraseña. Un
`complete` acredita sólo este cliente psql; Node/TypeORM/API/Worker, migraciones,
recuperación y rotación tienen comprobaciones separadas. `backend_tls` describe
el tramo observado por PostgreSQL; no confundirlo con la validación TLS del cliente
si hay un proxy intermedio. No reintenta conexiones automáticamente.

Corte2026-11-10: DNS/TCP/TLS verificados desde el VPS mediante OpenSSL sin enviar
credenciales: TLS1.3, cadena y hostname válidos. Desde un PC con IP distinta también
responde al SSLRequest PostgreSQL. El usuario informa que IP policies requiere
plan de pago en su cuenta: se conserva Free y esta prueba no tiene allowlist de
IP. El usuario pospone la rotación para probar conectividad con credenciales
actuales; mantenerla pendiente antes de abrir stakeholders, sin upgrades automáticos.
psql18.6 instalado; primer intento detenido por fallo DNS antes de autenticar
o consultar SQL. Después DNS y TLS volvieron a responder; causa no confirmada.
Helper corregido reejecutado satisfactoriamente: psql autentica y consulta metadatos
READ ONLY con verify-full; servidor PostgreSQL16.14, wal_level replica,
in_recovery=false y backend TLS1.3. No hay tablas de usuario según catálogos;
no demuestra baseline vacía. Ver [evidencia](../../docs/evidence/production-postgres-20261110-r01.json).
Sin migraciones ni seeds. Node se comprobó después mediante el staging separado;
arranque API/Worker y recuperación siguen pendientes. Sintaxis Bash/Python y hashes local/remoto
comprobados; el parser rechaza base incorrecta y modo writable incluso con Python-O.

Fuentes: [psql](https://www.postgresql.org/docs/18/app-psql.html),
[TLS verify-full](https://www.postgresql.org/docs/18/libpq-ssl.html) y
[acceso Northflank](https://northflank.com/docs/v1/application/databases-and-persistence/access-a-database).

## Redis privado

Primera instalación: copiar juntos `bootstrap-redis.sh`, `redis.compose.yml`,
`redis.conf.template` y `redis-cli-auth.sh` a
`/home/nodia-admin/nodia-setup/redis/`. El operador ejecuta:

```bash
sudo bash /home/nodia-admin/nodia-setup/redis/bootstrap-redis.sh
```

El bloque descarga Redis oficial 7.4.12 Alpine fijado por digest, comprueba su
UID 999 / GID 1000 y genera una contraseña aleatoria de 256 bits sólo en el VPS.
No acepta secretos en argumentos ni imprime sus valores. Configuración:

- `template_redis`, publicación exclusiva `127.0.0.1:6379`, bridge dedicado
  `template_redis_private` y volumen `template_redis_data`. No usa `internal:true`:
  en el primer intento impidió publicar el puerto hacia Node en el host. El
  bridge permite salida; la privacidad de entrada se basa en loopback/autenticación.
- AOF/fsync cada segundo; sin snapshots RDB periódicos. Memoria Redis de 256 MiB con
  `noeviction`, límite contenedor de 1 GiB y una CPU: valores iniciales, no capacidad
  probada. Evitar expulsión de contadores de cuotas bajo presión de memoria.
- Proceso sin root, filesystem raíz de sólo lectura, capacidades retiradas,
  `no-new-privileges`, reinicio `unless-stopped` y logs locales de 10m × 3.
- `/etc/nodia/redis.env` root:root, modo 0600 para futuros `EnvironmentFile` de systemd;
  no hacer `cat` ni copiar valores a Git, documentación o logs. El directorio
  `/etc/nodia/redis` es root:root, modo 0700; el `redis.conf` montado en sólo lectura es
  UID 999 / GID 1000 modo 0400. No abrir el directorio para solucionar permisos.
- `/etc/sysctl.d/60-nodia-redis.conf` configura `vm.overcommit_memory=1` para
  permitir el fork de reescritura AOF bajo presión; no elimina los límites del
  contenedor ni sustituye monitoreo. La inspección previa encontró valor 0.

La contraseña del usuario Redis `default` conserva el contrato actual
`REDIS_HOST/PORT/PASSWORD`; la app no configura usuario ACL separado ni TLS para
esta conexión local. Permite administrar esa instancia: no compartirla con otros
servicios ni publicar su puerto. El wrapper lee la contraseña dentro del
contenedor y la entrega al cliente mediante `REDISCLI_AUTH`; no aparece como
argumento o variable en la configuración visible de Docker. `redis-cli -e`
devuelve error ante fallos Redis para que healthcheck no acredite un falso sano.

El bootstrap comprueba PONG autenticado, NOAUTH sin contraseña, conexión real
desde el host por loopback, configuración efectiva y EVAL. Escribe una clave
con TTL de 300 segundos, confirma su AOF con WAITAOF en la misma conexión, recrea el contenedor
conservando el volumen, comprueba la clave y la elimina. Rechaza contenedores o
volúmenes previos para evitar esa prueba sobre una instancia ya usada. No es un
upgrade: ante fallo conserva archivos/datos y exige inspección, sin regenerar
secretos ni borrar volúmenes automáticamente. No ejecutar `down -v`, `volume
prune` ni `FLUSHALL`.

```bash
cat /var/lib/nodia-redis/status.json
sudo bash /home/nodia-admin/nodia-setup/redis/bootstrap-redis.sh verify
sudo docker compose -f /opt/nodia/redis/redis.compose.yml ps
sudo docker logs --tail 50 template_redis
```

`verify` no recrea el contenedor ni cambia credenciales. `complete` acredita
pruebas locales del bootstrap, no integración API/Worker, cierre del puerto 6379 desde fuera,
backup o alertas. AOF no es backup ni protege ante pérdida del VPS; fsync cada
segundo permite perder escrituras recientes en una caída. No se ha probado crash,
carga/OOM ni reescritura bajo presión. No añadir una regla UFW para Redis.

Estado al 2026-11-10: el primer intento con sudo creó Redis saludable; pasaron PONG
autenticado y NOAUTH, pero falló antes de la prueba de persistencia: la red
`internal` dejó sin puerto publicado a Redis. Volumen/secretos conservados.
La reparación se ejecutó satisfactoriamente: autenticación/configuración, acceso
desde el host y prueba de persistencia tras recrear completados, conservando
volumen y credenciales. SSH de lectura confirma listener127.0.0.1:6379; desde
el PC 22/443 conectan y 6379 agota timeout. Ver [evidencia R01](../../docs/evidence/production-redis-20261110-r01.json).
Integración de app, backup/restore, carga/OOM y alertas siguen pendientes.

Continuación utilizada para resolver exclusivamente aquel fallo inicial
(histórica, no volver a ejecutarla tras complete):

```bash
sudo bash /home/nodia-admin/nodia-setup/redis/bootstrap-redis.sh resume-network
```

Ese modo exige el estado fallido de la línea 52 del primer helper, Redis vacío,
imagen/proyecto/volumen/red esperados y permisos de configuración. Instala sólo
el Compose corregido, recrea conservando volumen, compara internamente hashes de
credenciales/configuración, comprueba acceso desde el host y retira únicamente
la red antigua si está vacía y pertenece al proyecto. Después realiza la prueba
de persistencia inicial. No es un modo genérico de reintento o actualización.

`RATE_LIMIT_STORAGE=redis` debe ser explícito. Redis caído/saturado produce 503
en rutas protegidas, sin fallback a memoria. El caché actual abandona reconexión
tras tres intentos; el limiter continúa: probar y resolver/documentar recuperación
de ambos antes del piloto. PONG no cierra esa garantía de aplicación.

Fuentes: [imagen oficial](https://hub.docker.com/_/redis),
[persistencia](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/),
[evicción](https://redis.io/docs/latest/develop/reference/eviction/),
[WAITAOF](https://redis.io/docs/latest/commands/waitaof/) y
[publicación en loopback](https://docs.docker.com/engine/network/port-publishing/).
Contrato local: [ADR003](../../docs/architecture/decisions/ADR-003-api-rate-limiting.md).

## HTTPS inicial

`bootstrap-https-ip.sh` prepara exclusivamente el HTTPS inicial de una IPv4
pública en el VPS nuevo. Se ejecuta mediante sudo del operador, con Nginx,
Certbot Snap >=5.4, UFW y OpenSSL instalados. No configura Node, PostgreSQL,
Redis, autenticación de Nodia, proxy de la API ni CI/CD.

```bash
sudo bash bootstrap-https-ip.sh 166.0.112.187
```

Leer el script antes de ejecutarlo. Certbot pide de forma interactiva los datos
de registro y la aceptación de términos; no se infiere correo ni se aceptan
términos automáticamente. Las contraseñas y claves privadas no van en argumentos,
estado, documentación o Git. El script no modifica SSH ni concede NOPASSWD.

El proceso valida HTTP-01 con un ensayo sin guardar certificados de pruebas,
solicita el certificado público del perfil `shortlived`, configura TLS, instala
un deploy-hook que valida/recarga Nginx y ensaya la renovación con el timer Snap
existente. No crea otro scheduler ni elimina locks de Certbot. Los puertos 80 y
443 se permiten en UFW; HTTP-01 debe seguir accesible para renovar. Se conserva
el archivo default de Nginx y una copia inicial del sitio en
`/var/lib/nodia-https/before`, con permisos privados.

El webroot público, su subdirectorio `.well-known` y `acme-challenge` reciben
modo 0755 explícitamente. Con umask 077, crear sólo el último con `install -d`
dejaba sus padres en 0700 e impedía que Nginx leyera el challenge. La corrección
se limita a `/var/www/letsencrypt`; no abre permisos de `/etc/letsencrypt` ni de
las claves privadas. La prueba GET espera brevemente, de forma acotada, a los
workers nuevos tras la recarga antes de declarar un fallo.

El estado sin secretos está en `/var/lib/nodia-https/status.json`. Un fallo no
declara listo el entorno ni restaura automáticamente certificados ya emitidos.
Si falla `nginx -t`, se repone la configuración de sitio anterior sin recargarla.
Si falla la recarga del servicio, queda el estado failed y la configuración
válida nueva en disco: comprobar el servicio y reconciliar antes de continuar.
Una interrupción HUP/INT/TERM se registra sin declarar completada la emisión.
Revisar la terminal del operador; no repetir una emisión de resultado incierto
sin inspeccionar el estado local de Certbot. El helper rechaza sitios proxy y
sitios habilitados adicionales: no usarlo como despliegue rutinario después de
incorporar la API.

`/tls-check` es una prueba temporal del transporte HTTPS; no acredita readiness
del backend. Además del ensayo local se debe verificar TLS desde fuera del VPS,
incluyendo cadena, SAN IP y caducidad. El timer habilitado y un dry-run positivo
no prueban una renovación automática futura ni reemplazan las alertas de
caducidad. La aceptación funcional y de recuperación se conserva en
[plan99](../../docs/mvp/99-production-deployment-and-cicd-plan.md).

Fuentes: [IP con Certbot](https://letsencrypt.org/2026/03/11/shorter-certs-certbot.html),
[renovación y hooks](https://eff-certbot.readthedocs.io/en/stable/using.html#renewing-certificates).

Corte verificado del piloto (2026-11-10, America/Santiago): certificado público,
HTTP-01 externo, HTTPS externo con cadena/SAN IP validados, renovación simulada
y última recarga exitosa. Ver [evidencia R01](../../docs/evidence/production-https-ip-20261110-r01.json).
No interpretar este corte como garantía de futuras renovaciones ni como API lista.

## Sesión administrativa compartida

El usuario pide operación autónoma con paso a paso en Obsidian. sudo-rs0.2.13
usa timestamps porTTY; no se cambia sudoers/global ni se concede NOPASSWD.
El operador crea la sesión tmux privada y autentica una vez:

```bash
tmux -f /dev/null -L nodia-deploy new-session -s setup 'sudo -v && tmux -L nodia-deploy set-option -t setup @nodia-ready yes && printf "\nNODIA_ADMIN_READY\n" && exec bash --noprofile --norc'
```

Esperar @nodia-ready=yes y pane bash antes de enviar trabajos sudo-n por SSH.
No capturar el prompt/contraseña. Comprobar usuario, socket, paneID/PID/TTY y
usar recibos de cada comando; sin replay de acciones inciertas. Al completar,
sudo-k y cierre de la sesión. Si expira, sudo-n falla y requiere reautenticación
privada del operador, sin modificar la política para evitarla.


## Identidad restringida para el futuro CD

El bootstrap-deploy-identity.py prepara sólo la identidad nodia-deploy, con
contraseña bloqueada y grupo propio. No instala un updater, concede sudo,
transfiere releases ni activa la app. Usa restrict y forced command en la clave:
solamente status ejecuta el gateway root-owned con Python -I; los demás comandos,
shell y SFTP quedan rechazados. Directorios y authorized_keys son de root; sus
modos0755/0644 permiten lectura de la clave pública sin escritura del usuario.
Los modos se fijan explícitamente al crear directorios aun con umask077.

El helper requiere root y la ruta/hash de una clave pública Ed25519. No acepta
claves privadas. Repetir exactamente verifica estado; divergencias fallan sin
sobrescritura ni eliminación. Ejecutar una sola instancia; revisar manualmente
interrupciones. No crea reglas sudo: no interpreta eso como auditoría de reglas
externas. Autenticación nueva verificada desde el PC (status permitido; id/sudo denegados), según
[plan99§12](../../docs/mvp/99-production-deployment-and-cicd-plan.md#12-identidad-ssh-de-actions-preparada--2026-11-12).

El ensayo mantenido tests/deploy-identity.integration.sh está diseñado únicamente
para un contenedor Ubuntu desechable como root. Rechaza ejecutarse fuera del
contenedor, usa claves generadas dentro y sshd en loopback sin publicar puertos;
no montar claves/configuración del host. Instaló dependencias de Ubuntu26.04 y
pasó26checks. No está conectado como job obligatorio del CI actual. Readiness
remota, secret GitHub y permisos de actualización todavía no acreditados.


Corrección del12 de noviembre: el parser de claves públicas acepta una única
terminación LF/CRLF opcional de ssh-keygen Windows; no reescribe el input y exige
su SHA256 original. Sigue rechazando CR interno, varias líneas/opciones y wire
format incorrecto. Regresión local: python -B -m unittest discover -s
ops/production/tests -p test_deploy_identity_public_key.py -v (4pasadas).
La integración de contenedor ahora usa CRLF y suma28checks; la primera preparación
R01 conserva el recibo de26 y sus hashes históricos. El rechazo real del primer
intento en VPS fue previo a cualquier creación de cuenta/archivo protegido.


Continuidad de identidad: el usuario aplicó el bootstrap corregido y se verificó
SSH real con el par dedicado y host pin. Home/.ssh/gateway y authorized_keys son
root-owned con modos esperados, hashes exactos y grupo propio. No se concedió
sudo por el bootstrap ni se habilitó deploy. Se prepara el guardado por el usuario
de VPS_SSH_PRIVATE_KEY y variables VPS_HOST/VPS_PORT/VPS_USER/VPS_KNOWN_HOSTS en
production; aún no confirmado. Ver plan99§12.2 y recibo live R03.

## Actualizador de backend para operador — preparado, no instalado

Código en development, sin commit ni cambios productivos en esta entrega.
`update-backend.py` es un **operador root**, no el gateway SSH de Actions.
`nodia-deploy` sigue aceptando sólo status: no se añaden upload, shell o sudo.
No hay aún workflow que publique Pages o active automáticamente el backend.

### Preparar e instalar son operaciones diferentes

En el checkout local, `--prepare` crea un directorio nuevo con 14 archivos
revisados y su manifiesto; no usa secretos, no compila ni conecta al VPS:

```powershell
python -B ops/production/install-backend-updater.py --prepare .tmp/production/updater-reviewed
```

El bundle preparado en esta entrega es `.tmp/production/updater-bundle-1b7969ae4d1a`;
manifiesto SHA256 `8c90a8378e39b35b0455f6d93222a51161f64cf0fa0f7378274a65992e592f3f`.
Es una salida regenerable, no una dependencia única de un temporal. Si cambia un
asset, preparar y revisar otro bundle con su nuevo digest.

**Instalación futura, no ejecutada:** tras el ensayo completo de systemd, copiar
ese bundle revisado a Linux y ejecutar su instalador como root con
`--install <directorio-bundle> --manifest-sha256 <digest-revisado>`.
Instala assets root-owned en `/usr/local/lib/nodia`, settings privados y el
include Nginx que devuelve 503 cuando existe el flag de mantenimiento. Verifica
las siete unidades existentes y el sitio exactos; nginx -t precede a reload.
No reinicia API/worker ni cambia SSH/sudoers. Una recarga fallida requiere
reconciliación; no declarar éxito por tener configuración escrita en disco.

### Entrada revisada del operador

El ZIP original descargado de Actions se coloca en
`/home/nodia-admin/nodia-setup/backend/server-<run_id>-<run_attempt>/<artifact_id>.zip`.
No descomprimir/recomprimir: la API oficial informa el digest de ese ZIP, distinto
del tar interior. Preparar como root una solicitud JSON 0600, sin symlinks, en
`/var/lib/nodia-updates/requests/<operation_id>.json`. Esquema exacto:

```json
{
  "schema_version": 1,
  "operation_id": "<32 caracteres hexadecimales nuevos>",
  "artifact_directory": "server-<run_id>-<run_attempt>",
  "artifact_id": "<ID numérico oficial de GitHub>",
  "artifact_zip_sha256": "<SHA256 del ZIP original de Actions>",
  "source_sha": "<SHA completo del commit master con CI success>",
  "expected_current_release": "<backend-SHA12-tree12 observado>",
  "expected_current_tree_sha256": "<tree SHA256 observado>"
}
```

Los marcadores no son valores ejecutables. El actualizador debe estar instalado
y el artefacto real todavía disponible; actualmente no existe un artefacto de
Actions para este código. El repositorio público permite consultar metadatos sin
token; convertirlo en privado exige diseñar autenticación explícita, sin omitir
la comprobación cuando la API rechace acceso.

Comandos futuros dentro del VPS, con ruta/ID reales:

```bash
# PLAN: verifica origen, paquete, versión actual y prepara candidato separado.
# Escribe estado/directorios; no crea backup, migra, detiene ni inicia la app.
sudo python3 -I /usr/local/lib/nodia/update-backend.py --request /var/lib/nodia-updates/requests/ID_PLAN.json

# APPLY: otra solicitud revisada con operation_id NUEVO; sí modifica producción.
sudo python3 -I /usr/local/lib/nodia/update-backend.py --request /var/lib/nodia-updates/requests/ID_APPLY.json --apply
```

Un ID ya usado se rechaza incluso si fue plan. También se bloquean intentos
anteriores con efectos pendientes. No borrar sus estados para poder continuar.

### Secuencia de apply

1. Adquirir el lock de instalación. Autenticar ZIP/digest, SHA/run/intento/evento,
   workflow y master actual en GitHub antes de extraer. Verificar cuatro archivos,
   tar/inventario, versión vigente, unidades, ausencia de drop-ins, PIDs/cgroups,
   rutas canónicas y espacio libre con margen. No ejecutar código de PR.
2. Guardar estado de timers, pausarlos y esperar servicios de backup/rotación
   libres. Activar mantenimiento HTTP503 sin afectar ACME/TLS-check.
3. Pedir backup nuevo **con API/worker todavía activos**. Exigir unidad exitosa y
   un único recibo ready posterior al cursor journal, con InvocationID nuevo,
   tiempos/digest/tamaño válidos. La CLI existente puede rotar/prunar R2: un
   fallo ya puede haber tenido efectos remotos, no se repite automáticamente.
4. Esperar trabajo local cerrado/confirmado hasta 120s. Detener API/worker de forma
   normal; exigir éxito y cgroups vacíos. Repetir gates SQL y probe TLS/Redis/R2.
   Unknown remoto histórico cerrado con su ACK no se trata como ejecución viva;
   trabajo local incierto o sin confirmación sí bloquea.
5. Registrar intención y ejecutar una única migración incremental TypeORM en
   transacción all, como nodia y sin AppModule, seed, synchronize o build. El
   prefijo de migraciones existente debe conservar nombres y hashes exactos.
6. Con escritores/timers detenidos, actualizar paths canónicos del runner de
   backups y current. Son escrituras coordinadas, no una transacción atómica
   entre archivos. Arrancar API/worker; comprobar versión/PIDs, ledger, HTTP local
   y dependencias. Retirar mantenimiento, probar HTTPS público y restaurar el
   estado previo de timers. Registrar la versión efectiva sólo al completar.

Cada fase registra intención antes del efecto. Si falla tras comenzar efectos,
conserva estado privado y bloqueo, e intenta reponer mantenimiento. **No hay
rollback automático, restore de DB, replay de migración o arranque del código
anterior.** Revisar `/var/lib/nodia-updates/attempts/<ID>/state.json` y diagnósticos
privados. SIGKILL/corte eléctrico puede impedir limpieza; la intención persistida
no equivale a demostrar qué efecto terminó. Un fallo temprano de preflight no
implica que API/worker se hayan detenido.

### Qué se probó y qué falta

- 48 tests Node y 17 Python: validaciones, cambios, procedencia, errores y orden
  de efectos con adaptadores controlados. No prueban todo systemd real.
- SQL real en PostgreSQL16 desechable: 39 checks, usuario sin superpoderes y
  Node UID900, TLS verify-full con CA sintética; 45 migraciones f01 → una JS
  sintética46. Incluye 21 estados/ACK, prefijo/ledger, hostname TLS incorrecto,
  lock ocupado y rollback SQL ante migración fallida; salida JSON sin SQL crudo.
- Nginx real aislado: instalación/include, 200→503→200, ACME/TLS-check accesibles,
  repetición de instalación y modos/propietarios. systemctl reload sustituido en
  el contenedor; no acredita un corte completo con systemd PID1.
- Paquete Linux f01 real sin recompilar: tree original de 24.491 archivos.
- Pendiente: ensayo de actualización integral con systemd real, timers/backup y
  API/worker; paquete final Teacher de 48 migraciones; CI real del SHA integrado;
  instalación/adopción en VPS y transporte/orquestación CD bajo identidad mínima.

Tests mantenidos (Docker local; no montar secretos ni conectar producción):

```powershell
node --test ops/ci/*.test.mjs ops/production/tests/update-backend-action.test.mjs
python -B -m unittest discover -s ops/production/tests -p 'test_backend_update*.py'
# Proporcionar explícitamente un paquete f01 precompilado y su hash real:
python -B ops/production/tests/update-backend-sql.integration.py --runtime-archive RUTA_RELEASE_F01.tar.gz --runtime-sha256 SHA256_REAL
```

El último runner verifica/extracta el tar con las funciones de staging y elimina
sólo sus contenedores/red/volúmenes propios al terminar. Alternativa de laboratorio:
`--runtime-volume <volumen-preparado>` con `/runtime-r02`; ese volumen externo no
se elimina. No depende implícitamente de un temporal o volumen específico.
El test Nginx es `tests/updater-maintenance.integration.sh` dentro de Ubuntu
desechable; rechaza un host normal. Evidencia y límites consolidados en
[R01](../../docs/evidence/production-ci-artifacts-updater-20261112-r01.json).

## Transporte CD instalado — 2026-11-12

Se instaló el bundle revisado con manifiesto
`e9690a51721272516741d49f5882275446dc442ae193efbe12c2c805ad88cf16`;
su bundle updater tiene SHA256
`18579160e69fa243fdf3f46c99e78a0f19399a23ab69329fd2660e5aaefe105f`.
Fuente/changes continúan en development sin commit. Instalación no equivale a
desplegar otro backend. API/worker siguen activos en f01, HTTPS200, sin operación
apply productiva. [Recibo vivo](../../docs/evidence/production-cd-transport-live-20261112-r01.json).

`install-production-cd.py --prepare <directorio-nuevo>` genera17assets y dos
manifiestos (19archivos en total); no accede al servidor. Su `--install` necesita
root y el SHA256 revisado; valida la identidad bloqueada/sin grupos adicionales,
una única clave Ed25519 con forced-command/fingerprint, directorios protegidos y
unidades existentes antes de habilitar el transporte. Nginx incorpora el include
de mantenimiento, se verifica y recarga; API/worker no se reinician. No usar el
bootstrap original de identidad para sobrescribir ahora el gateway actualizado.

El usuario nodia-deploy tiene una sola regla sudo de argv fijo, validada por
visudo; no es sudo genérico ni shell privilegiada:

```text
nodia-deploy ALL=(root) NOPASSWD: /usr/bin/python3 -I /usr/local/lib/nodia/deploy-backend-receiver.py
```

El gateway valida comandos SSH tipados y serializa un header JSON acotado. El
receiver root vuelve a validar todo, exige SUDO_USER/UID correctos y sus assets
root-owned/pinned. No acepta argv adicional, rutas libres, shell, SFTP o código
subido para ejecutar como root. El código Node del paquete se ejecuta como nodia.

| Comando SSH | Resultado permitido |
| --- | --- |
| `status` | Versión observada por manifiesto y procesos/PIDs/cwd/exe/cgroups, bloqueos y API/worker activos |
| `status <operation_id>` | Consultar fase y resultado seguro de una operación existente |
| `upload <artifact_id> <zip_sha256> <run_id> <attempt> <bytes>` | Recibir ZIP original por stdin, comprobar tamaño/hash/EOF y guardar root0600 |
| `deploy <operation_id> <artifact_id> <zip_sha256> <run_id> <attempt> <source_sha> <expected_release> <expected_tree>` | Crear solicitud root0600 e iniciar una unidad systemd fija/asíncrona del updater |

Upload usa `/var/lib/nodia-updates/incoming/server-<run>-<attempt>/<id>.zip`,
sustituyendo la ruta de entrada administrativa descrita en el corte anterior.
Límite768MiB por ZIP, cuota2GiB/10archivos, margen2GiB de disco y deadlines
total240s/idle20s. No sobrescribe duplicados ni elimina parciales por error. Una
cuota alcanzada bloquea nuevas subidas: revisar operaciones y retirar sólo
entradas ya reconciliadas con procedimiento de mantenimiento; esta entrega no
implementa retención automática de releases/diagnósticos.

Deploy escribe intención durable **antes** de crear la solicitud y antes de
systemd-run. Unidad `nodia-cd-<operation_id>.service`, Restart=no, independiente
de la conexión SSH. Repetir exactamente el ID consulta el resultado sin volver a
iniciar; cambiar el contenido con el mismo ID falla. Un resultado unknown exige
reconciliación; no se transforma en éxito o en otro apply. Lock de receiver y
lock de instalación son distintos para que el proceso hijo tome el suyo.

La conexión real nueva desde el PC con la clave dedicada/host pin devolvió
deployment_ready, blocked=false, f01 y ambos escritores activos. La petición
`sudo -n true` por ese SSH fue rechazada por el parser antes de ejecutar sudo.
Siete assets públicos instalados coinciden por hash con el bundle. Se invalidó
sudo en la terminal administrativa y se cerró la sesión tmux. Esto todavía no
prueba conexión desde runner GitHub ni permisos efectivos del token Cloudflare.

### Ensayos mantenidos de esta continuación

```powershell
python -B ops/production/tests/updater-systemd.integration.py
python -B ops/production/tests/deploy-transport.integration.py
python -B ops/production/tests/update-backend-sql.integration.py --runtime-volume nodia-ci-artifact-f01 --candidate-dist nodia-server/dist
```

Los dos primeros crean contenedores systemd PID1 propios con privileged y
cgroup namespace privado, sin montar cgroups del host, secretos o puertos. La
red del contenedor de ensayo es none; imágenes/dependencias se preparan antes.
El tercero exige una fixture f01 explícita; alternativamente usar runtime-archive
y runtime-sha256 como en §anterior. candidate-dist es opcional y sólo un fixture
compilado local: no demuestra procedencia Git de un release productivo.

- Systemd20checks: timers/backup journald InvocationID/cursor, procesos y
  cgroups reales, parada/cambio/arranque, cleanup de unidades y versión efectiva;
  backup stale se rechaza antes de parar/migrar. App/datos de backup, SQL/probe,
  preparación GitHub y mapeo HTTP público son fronteras sintéticas explícitas.
- Transporte25checks: SSH/sudo/systemd/Nginx reales, status, regla exacta,
  subida/hash/modos, rechazos de shell/SFTP/sudo libre/truncados/duplicados,
  ejecución asíncrona. GitHub sin red falla antes de efectos, conserva PIDs/current;
  repetir consulta sin reiniciar unidad. App/manifiesto son sintéticos.
- SQL47checks en PostgreSQL16/TLS real: conserva los39 anteriores y agrega
 45→48 reales de Teacher desde dist explícito; tres migraciones,102tablas públicas
  y68entidades ORM observadas. Las tablas Teacher adicionales no son entidades
  ORM nuevas; no se afirma que TypeORM cubra sus reglas funcionales. Sin seed/IA.
- Dos correcciones del harness, no del producto: pg_isready usa TCP para esperar
  al servidor final en vez del socket temporal de initdb; el conteo ORM se separa
  del número de tablas públicas. Los intentos con expectativas incorrectas no
  modificaron producción; el pase final conserva el alcance real.

Pendientes reales: CI/CD del SHA final desde GitHub y primer apply productivo con
sus recibos/versión/smoke; empaquetado del checkout committed de development tras
terminar el WIP; mantenimiento de retención de paquetes/diagnósticos. El usuario
mantiene a su cargo la promoción a master; no se crea por instalar este transporte.
