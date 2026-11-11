# Preparación del VPS del piloto

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
Las correcciones aún no están versionadas/promovidas; no cambiar current ni
arrancar API/Worker desde este candidato. Puede usarse para comprobaciones
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
