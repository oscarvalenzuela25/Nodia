# Despliegue de Nodia: destino productivo y antecedentes

## Destino vigente: piloto productivo Truobox — 2026-11-08

El usuario cambia el alcance: desplegar directamente un ambiente productivo para feedback de stakeholders, inicialmente dos personas, con VPS Truobox. Confirma conservar PostgreSQL en Northflank Free por ahora y evaluar migración a otro servicio o al VPS si sus límites lo requieren. La limitación de cortes/max-run discutida corresponde a **Instabox Free**, no a Truobox. Instabox queda como antecedente de laboratorio y no como hosting del piloto.

La lista vigente de pendientes, CI/CD propuesto y migración de ramas están en [plan99](99-production-deployment-and-cicd-plan.md), con [ADR097 propuesto](../architecture/decisions/ADR-097-monorepo-production-release-pipeline.md). develop será predeterminada/integración y master producción; GitHub aún usa main y no hay workflows versionados. API/Worker con systemd, Redis local privado y Client Pages conservan la distribución prevista. No hay compra, ajustes remotos, despliegue ni aceptación productiva acreditada por esta actualización. La elección de Northflank Free es explícita para el piloto; sus límites, condiciones y recuperación deben verificarse sin inventar garantías o subir de plan automáticamente.

Los procedimientos y checklists que siguen conservan su alcance histórico; no ejecutar sus comandos sin reconciliarlos con plan99 y el release actual.

## Ensayo histórico: Truobox y Northflank Sandbox — 2026-11-08

**Cambio solicitado por el usuario:** actualizar el ensayo para usar un VPS [Truobox](https://www.truobox.com/vps-barato/) ante las pausas obligatorias de Instabox Free, manteniendo dos personas y PostgreSQL en Northflank Sandbox. Instabox queda como alternativa para sesiones de laboratorio; la consulta sobre ajustar el Worker no autoriza alterar sus tiempos ni elimina los límites del proveedor. No se ha contratado un plan ni autorizado una compra concreta.

**Distribución vigente:** Client en Cloudflare Pages; API y Worker en el VPS con systemd; Redis local privado y persistente; único addon Northflank para PostgreSQL, con TLS validado en aplicación, migraciones y recuperación. Adaptadores IA internos conforme a ADR-008 y calificación por entorno de plan91. R2/backup cifrado/journal conservan sus contratos. No se modifica el laboratorio activo, la BD ni el runtime.

### Por qué ajustar el Worker no elimina el límite de Instabox

El [max-run de Instabox](https://instabox.sh/docs/machines/auto-pause) mide tiempo continuo de la máquina en ejecución, incluso ocupada; no horas de CPU ni una bolsa de ocho horas al día. En la modalidad dinámica publicada el máximo por ejecución es ocho horas, con ventanas iniciales menores y cooldown. Una pausa afecta también a API, Redis y procesos IA. Quitar el Worker o reducir su polling no mantiene la API disponible durante esa pausa. Instabox sigue siendo utilizable para ensayos por sesiones que toleren interrupciones y se prueben al reanudar; no se introducen mecanismos para eludir límites.

### Funcionamiento e impacto de los intervalos del Worker

Hechos confirmados por inspección de `nodia-server/src/nodia-ai-runtime/use-case/run-nodia-ai-worker.use-case.ts`, `run-nodia-ai-stage.use-case.ts`, `validate-nodia-ai-runtime-policy.use-case.ts` y `docs/mvp/nodia-ai-v1-runtime-policy.json`:

- Proceso separado sin listener HTTP; PostgreSQL conserva identidad/capacidad durables. La política configura dos consumidores de primer plano y un bucle de mantenimiento; no son tres máquinas ni tres procesos Worker.
- Cada consumidor intenta obtener trabajo de las fuentes registradas. Si no trabajó, espera cinco segundos; si trabajó, vuelve al ciclo sin esa espera en reposo. No se hace una inferencia nueva sólo por comprobar la cola.
- Mantenimiento ejecuta recuperación, limpieza/retención y observación, y después espera cinco segundos. La cantidad de ciclos no equivale a número de consultas SQL ni llamadas al proveedor.
- `timing.heartbeat_seconds = 5` se comparte entre la espera en reposo, mantenimiento y renovación de la reserva de etapas activas. `lease_seconds = 30`; el validador exige `heartbeat_seconds * 3 < lease_seconds`. Subir directamente heartbeat a 10, 30 o 60 segundos es inválido con esa reserva y compromete la coordinación si se omiten los guards. No se modifica.
- Una mejora futura separaría polling de cola en reposo, intervalo de mantenimiento y heartbeat activo; conservaría reservas, fencing, deadlines, cancelación y no-replay. Requiere medir carga real y probar admisión, recuperación y apagado antes de adoptarla; no está implementada ni constituye solución al max-run.

Ejemplos exclusivamente para un polling de cola separado, con capacidad libre y sin contar tiempo de SQL/planificación: pasar de 5 a 30 segundos reduce rondas en reposo de 720 a 120 por hora y por consumidor, pero aumenta la espera adicional de recogida de hasta aproximadamente 5 a 30 segundos. No acelera un trabajo ya iniciado ni reduce por sí solo las inferencias o la RAM del proceso. Retrasar mantenimiento también demora recuperación/limpieza; aumentar una reserva demora detección de un proceso perdido. No extrapolar este cálculo a carga total, costos o aceptación medida.

### Truobox: selección y precio aún por concretar

La [página oficial](https://www.truobox.com/vps-barato/) publica Pro S (2 vCPU/4 GB/60 GB) y Pro M (4 vCPU/8 GB/120 GB). Pro M es un candidato para medir API/Worker/Redis y adaptadores, no un tamaño aceptado o requisito deducido de dos usuarios. La tarjeta de Pro M anuncia US$8,25 mensuales equivalentes por tres años; otra tabla lo llama anual y el enlace de compra usa `triennially`. No es una cotización de pago mes a mes. Región, versión exacta de Ubuntu LTS, recursos disponibles, impuestos, renovación, anticipo y precio mensual real se verifican en el carrito antes de decidir una compra. El objetivo de disponibilidad anunciado no acredita continuidad efectiva de Nodia.

### Continuidad del ensayo

- [x] Registrar cambio de destino a Truobox; selección Instabox anterior conservada como historial.
- [x] Verificar código del Worker y distinguir polling, heartbeat, lease y límite de la máquina.
- [ ] Concretar plan/región/Ubuntu LTS y cotización de Truobox; sin compra ejecutada.
- [ ] Comprobar acceso, límites efectivos y estado de seguridad actual de Northflank; la revisión anterior dejó un incidente en seguimiento, sin aceptación de seguridad.
- [ ] Preparar TLS PostgreSQL, roles/pools y recuperación; verificar cuotas gratuitas de addon y backups sin asumir 30 días incluidos.
- [ ] Adaptar el release, secretos, systemd, Redis privado, proxy/TLS, auth/orígenes y almacenamiento; las recetas de octubre no son ejecutables sin reconciliación con el release vigente.
- [ ] Verificar dos usuarios, aislamiento, fallos DB/Redis, reinicio de host/servicios, recuperación sin replay, modalidades IA reales y backup/restore aislado.
- [ ] Medir RAM/CPU/latencia/consultas antes de optimizar polling o recomendar plan comercial. Los checklists inferiores son históricos, no aceptación de este destino.

Impacto de conocimiento NodiaAI: sólo selección de infraestructura y explicación del runtime existente; no cambia capacidades, herramientas, autoridad o contratos. No hay publicación nueva de fichas.

## Ensayo histórico: Instabox Free y Northflank Sandbox — 2026-11-08

> Sustituido para el destino de despliegue por Truobox en la revisión superior de la misma fecha. Límites y pendientes siguientes son el registro de aquella alternativa; no son instrucciones vigentes para provisionar Instabox.

**Confirmado por el usuario:** probar Nodia con dos personas usando exclusivamente planes gratuitos de Instabox y Northflank, antes de contratar un tier comercial o cambiar de proveedor. Esta selección sustituye Truobox y PostgreSQL local para este ensayo; no selecciona la infraestructura comercial ni aprueba el lanzamiento.

**Estado:** elección de proveedores registrada; distribución técnica propuesta, sin cuentas inspeccionadas, recursos provisionados, cambios de runtime, migraciones ni aceptación de capacidad o seguridad. Los comandos de la guía de octubre que sigue son históricos y no deben ejecutarse como receta de este entorno.

### Distribución propuesta

| Componente | Destino | Alcance |
| --- | --- | --- |
| Client | Cloudflare Pages Free | Mantener la intención previa; proyecto, dominios y límites efectivos pendientes |
| API y Worker | Una máquina Instabox Free, servicios systemd separados | Procesos disponibles sólo mientras la máquina esté activa |
| Redis | Contenedor privado en esa máquina | Loopback, autenticación, persistencia y claves de rate limiting sin expulsión; no es un segundo addon Northflank |
| PostgreSQL | Único addon Northflank Developer Sandbox | Conexión externa TLS validada; endpoint y puerto reales del panel |
| Adaptadores IA internos | Instabox, sólo si caben y se califican en ese entorno | Sin inferencia o disponibilidad acreditada por instalar herramientas o iniciar sesión |
| Archivos y recuperación | Conservar contratos R2 y NodiaAI existentes | Cuenta, cuotas gratuitas, claves y recuperación objetivo sin validar |

### Hechos comprobados en documentación oficial

- [Instabox Free](https://instabox.sh/docs/account/pricing): una máquina, 4 vCPU/8 GiB, disco de datos de 20 GiB, cinco snapshots y 100 GiB de salida mensual. Las cuotas efectivas de la cuenta y cualquier comportamiento ante excedentes deben comprobarse antes de operar; no se autoriza contratar Pro ni consumo pago.
- [Instabox limits](https://instabox.sh/docs/account/limits): la plantilla habitual `agent-browser` es Debian 13 con systemd y Docker; no asumir que la máquina creada será Ubuntu ni que sus herramientas preinstaladas satisfacen el release de Nodia. Persistir recursos propios en paths inventariados; `/data` no equivale a un respaldo externo.
- [Auto-pause y max-run](https://instabox.sh/docs/machines/auto-pause): Free impone pausas. La modalidad dinámica comienza con dos horas y puede extenderse según actividad, con máximo de ocho horas por ejecución. Un max-run puede imponer cooldown de 5–20 minutos, ampliado por pausas consecutivas. Una petición al URL HTTP puede despertar una pausa por inactividad, pero no anula una pausa manual o cooldown; puede recibir 503/Retry-After. Verificar la modalidad/valores efectivos de la máquina. No prometer 24/7 ni introducir keepalives para eludir límites.
- Una espera silenciosa de un trabajo puede ser considerada inactividad. El mecanismo oficial de activity leases existe para trabajo real, pero no está integrado ni validado en Nodia y no extiende el límite máximo. systemd reinicia servicios al arrancar el huésped; no controla la suspensión del proveedor.
- [Northflank Sandbox](https://northflank.com/docs/v1/application/billing/pricing-on-northflank): dos servicios, dos jobs y un addon. PostgreSQL y Redis administrados necesitarían dos addons, por lo que esta propuesta conserva Redis en Instabox. CPU/RAM/disco y disponibilidad regional del addon gratuito pendientes de comprobar en la cuenta.
- [PostgreSQL en Northflank](https://northflank.com/docs/v1/application/databases-and-persistence/deploy-databases-on-northflank/deploy-postgresql-on-northflank): admite conexión externa TLS; no asumir puerto externo 5432. No hay configuración TLS explícita en `nodia-server/src/config/db.config.ts` ni `data-source.ts`; preparar ambos consumidores y la recuperación antes de usar el destino.
- [Backups Northflank](https://northflank.com/docs/v1/application/databases-and-persistence/backup-restore-and-import-data): backup/restore y horarios están documentados, pero no se ha acreditado una cuota o retención gratuita para Sandbox. No prometer 30 días gratuitos ni sustituir el backup cifrado/journal de NodiaAI, cuya retención actual es de siete días.
- [Pricing](https://northflank.com/pricing) dice que no hace falta tarjeta, mientras la guía de billing exige método de pago. Onboarding real pendiente; no introducir datos de pago ni habilitar un plan comercial automáticamente.

### Seguridad y límites del ensayo

El [estado oficial de Northflank](https://status.northflank.com/) consultado el 2026-11-08 mantiene un incidente de seguridad en seguimiento; última actualización observada 2026-11-06 10:09 UTC, investigación/forense abiertas. El proveedor comunica parche aplicado y ausencia de evidencia de acceso a workloads/datos hasta ese corte, no ausencia demostrada de compromiso. Recomienda rotar secretos afectados. Comprobar el estado al provisionar y usar credenciales exclusivas del ensayo; si ya hubo secretos allí, evaluar y rotar los alcanzados. No registrar secretos en estas fuentes.

Dos usuarios delimitan el ensayo, pero no prueban capacidad, compatibilidad IA ni continuidad. Pausar la máquina también pausa API, Worker, Redis y servicios internos; PostgreSQL externo no los ejecuta. Al reanudar pueden haberse vencido conexiones, sesiones o leases: comprobar recuperación sin replay de inferencias ni escrituras inciertas. No restaurar snapshots de la máquina sobre un PostgreSQL externo más reciente sin conciliar las identidades y el journal. No alterar contratos ni relajar auth, rate limiting o permisos para adaptarse a Free.

Evaluación de conocimiento NodiaAI: cambio de infraestructura de ensayo, sin modificación de capacidades funcionales, catálogo de herramientas, modalidades ni autoridad. No requiere publicar fichas nuevas; cualquier adaptación de contratos posterior debe evaluar sus fichas y pruebas propias.

### Primer paso pendiente y comprobaciones

- [x] Registrar elección explícita Instabox Free + Northflank Sandbox, dos usuarios y ausencia de autorización de cargos.
- [x] Contrastar límites publicados y distinguirlos de recursos realmente disponibles.
- [ ] Comprobar cuentas/acceso del operador, plan gratuito efectivo, región, cuotas, almacenamiento, backups y condiciones de facturación, sin compartir claves por chat.
- [ ] Preparar paquete reproducible del release y secretos propios del ensayo; conservar el laboratorio actual.
- [ ] Preparar TLS PostgreSQL para API, migraciones y recuperación, roles y pools acotados; no desactivar la validación del certificado.
- [ ] Configurar entrada HTTPS/orígenes/cookies/Google OAuth y TRUST_PROXY con la cadena real de Instabox/Pages; los servicios internos permanecen privados.
- [ ] Provisionar el único addon y la máquina sólo después de concretar esos valores; inicializar la BD destino de forma controlada sin copiar datos privados por defecto.
- [ ] Comprobar login de las dos personas, aislamiento, errores DB/Redis, reinicio, pausa/despertar/cooldown y tareas interrumpidas sin replay.
- [ ] Calificar cada modalidad/proveedor IA que se vaya a usar conforme a plan91; la evidencia del laboratorio no se transfiere al nuevo entorno.
- [ ] Ensayar backup cifrado, restauración aislada y conciliación del journal; inventariar secretos, adjuntos y configuración fuera de snapshots.
- [ ] Medir consumo, latencia y estabilidad reales antes de recomendar tier comercial o migración. No asumir que el plan gratis acredita aceptación productiva.

## Procedimiento histórico — 2026-10-10

> Estado: procedimiento propuesto y revisado contra el código; no ejecutado en un VPS.
> Fecha: 2026-10-10.
> Alcance autorizado: ensayo con PostgreSQL y Redis en el mismo VPS. No reemplaza la decisión de producción sobre datos gestionados ni aprueba el lanzamiento.

## Topología del ensayo

Asumir Ubuntu 24.04 x86-64, repositorio en `/opt/nodia` y un usuario operador con sudo. Cambiar rutas/dominios de ejemplo por los reales. Usar `app.tudominio.cl` para Cloudflare Pages y `api.tudominio.cl` para el VPS, bajo el mismo dominio.

Proveedor elegido por el usuario el 2026-10-10: **Truobox**. Recomendación de imagen: Ubuntu Server **24.04 LTS amd64**, sin app/panel preinstalado; verificar la versión completa detrás de «Ubuntu-24». Elección del SO, plan, región y contratación todavía pendientes. Comparación y fuentes de soporte en [10-stack-devops](10-stack-devops.md#sistema-operativo-para-truobox--2026-10-10).

- VPS: Nginx HTTPS → Nodia Server en host con systemd, puerto 3000.
- PostgreSQL 16 y Redis 7 en Docker, publicados exclusivamente en loopback.
- Gemini en su Compose existente, publicado exclusivamente en 127.0.0.1:8000.
- Client en Cloudflare Pages; facturas en R2.
- Mantener el ensayo restringido a la IP del operador hasta cerrar las verificaciones.

El Compose de Server actual es de desarrollo: publica BD/Redis en todas las interfaces. **No arrancarlo tal cual en el VPS**. La configuración de ensayo que sigue utiliza volúmenes propios. Docker puede publicar puertos eludiendo reglas de UFW; el bind explícito a loopback es necesario ([documentación Docker](https://docs.docker.com/engine/install/ubuntu/)).

Pendientes reales: dependencias de runtime señaladas en VPS-03, readiness global DB/Redis, Linux/cuentas IA y confirmación integral factura/productos S-05. Revisar [19](19-prelaunch-review.md) antes de abrir acceso general. Las 18 migraciones y bootstrap Core sí están probados en PostgreSQL desechable.

## 1. Preparar el sistema y el release

Comandos de esta guía son Bash en el VPS. Registrar el commit concreto y comprobar que incluye los archivos nuevos de migración/bootstrap; subir código a una carpeta no asegura haber incluido archivos aún sin commit.

```bash
cd /opt/nodia
git rev-parse HEAD
sudo apt update
sudo apt install -y nginx ufw ca-certificates curl git openssl
```

Instalar Docker Engine con Compose plugin siguiendo el [repositorio oficial para Ubuntu](https://docs.docker.com/engine/install/ubuntu/). Instalar Node globalmente, con una versión compatible con el proyecto y el release probado; [24.20.0 oficial](https://nodejs.org/download/release/v24.20.0/) satisface el requisito actual del cliente. Verificar checksums del archivo descargado.

```bash
node --version
npm --version
command -v node
sudo docker version
sudo docker compose version
sudo systemctl enable --now docker
```

Los ejemplos systemd suponen Node en `/usr/local/bin/node`; reemplazarlo por la ruta absoluta comprobada si es distinta. El servicio no carga nvm ni el perfil interactivo del operador.

Crear usuario de aplicación y preparar su carpeta, si aún no existe:

```bash
sudo useradd --system --create-home --home-dir /var/lib/nodia --shell /usr/sbin/nologin nodia
sudo chown -R nodia:nodia /opt/nodia/nodia-server
sudo install -d -m 0700 /etc/nodia /var/backups/nodia
```

Ejecutar Docker como operador mediante sudo; el usuario de la API no necesita acceso al daemon Docker.

Permitir el puerto SSH real antes de habilitar el firewall. Estos ejemplos suponen SSH 22:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow from TU_IP_PUBLICA to any port 443 proto tcp
sudo ufw enable
sudo ufw status verbose
```

Aplicar también el firewall del proveedor. No autorizar 3000/5432/6379/8000 desde Internet. Durante la prueba, 443 queda autorizado solo para el operador. 80 se usa para emisión/renovación TLS y redirección. Confirmar acceso SSH en una segunda sesión.

## 2. Preparar configuración y secretos

En `nodia-server`, crear `.env` desde `.env.example` solo si no existe. Editarlo sin volcar secretos al historial de shell. Mantener todas las variables necesarias del ejemplo y reemplazar estos valores:

```dotenv
NODE_ENV=production
PORT=3000
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
POSTGRES_DB=nodia_db
POSTGRES_USER=nodia_user
POSTGRES_PASSWORD=REEMPLAZAR
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=REEMPLAZAR
RATE_LIMIT_STORAGE=redis
GOOGLE_CLIENT_ID=REEMPLAZAR.apps.googleusercontent.com
AUTH_ALLOWED_ORIGINS=https://app.tudominio.cl
AUTH_COOKIE_SAME_SITE=lax
AUTH_COOKIE_SECURE=true
AUTH_JWT_SECRET=REEMPLAZAR_POR_SECRETO_ALEATORIO
TRUST_PROXY=127.0.0.1/32
BOOTSTRAP_SUPER_ADMIN_EMAIL=oavr.18@gmail.com
AI_SECRET_MASTER_KEY=REEMPLAZAR_POR_64_HEXADECIMALES
GEMINI_SERVICE_TOKEN=REEMPLAZAR_POR_OTROS_64_HEXADECIMALES
GEMINI_MICROSERVICE_URL=http://127.0.0.1:8000
SECRET_SEED=
NODIA_CODEX_ENABLED=false
```

Configurar además las cuatro variables R2 de `.env.example` si se probarán archivos. Usar secretos independientes: la clave maestra IA y token Gemini deben ser dos valores aleatorios diferentes de 32 bytes, codificados como 64 caracteres hexadecimales. Respaldar de forma cifrada la clave maestra: sin ella no se pueden recuperar las API keys cifradas.

`SECRET_SEED` vacío mantiene inhabilitado el bootstrap HTTP heredado; `db:setup` usa el comando privado. `TRUST_PROXY` anterior corresponde exactamente a Nginx local sin proxy CDN delante; verificar IP efectiva con la topología real.

```bash
sudo chown nodia:nodia /opt/nodia/nodia-server/.env
sudo chmod 600 /opt/nodia/nodia-server/.env
```

Crear `/etc/nodia/infra.env` (root, 0600) con dos valores reales:

```dotenv
POSTGRES_ADMIN_PASSWORD=REEMPLAZAR
REDIS_PASSWORD=EL_MISMO_VALOR_DEL_SERVER
```

La contraseña del administrador PostgreSQL debe ser distinta de la de `nodia_user`. No compartir `infra.env` con la API.

## 3. Levantar PostgreSQL y Redis privados

Crear `/etc/nodia/compose.vps-test.yml` con esta configuración de ensayo:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    ports:
      - "127.0.0.1:5432:5432"
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_ADMIN_PASSWORD:?Configurar POSTGRES_ADMIN_PASSWORD}
      POSTGRES_DB: postgres
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d postgres"]
      interval: 5s
      timeout: 5s
      retries: 10
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    ports:
      - "127.0.0.1:6379:6379"
    environment:
      REDIS_PASSWORD: ${REDIS_PASSWORD:?Configurar REDIS_PASSWORD}
    command: ["sh", "-c", "exec redis-server --requirepass \"$$REDIS_PASSWORD\" --appendonly yes --maxmemory-policy noeviction"]
    volumes:
      - redisdata:/data
    healthcheck:
      test: ["CMD-SHELL", "REDISCLI_AUTH=\"$$REDIS_PASSWORD\" redis-cli ping"]
      interval: 5s
      timeout: 5s
      retries: 10
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
volumes:
  pgdata:
  redisdata:
```

Para el ensayo se conservan majors compatibles con el Compose local. Registrar los digests usados y fijarlos en el release productivo revisado. Los tamaños/rotación anteriores son configuración inicial, no evidencia de capacidad.

```bash
sudo docker compose -p nodia-vps-test --env-file /etc/nodia/infra.env -f /etc/nodia/compose.vps-test.yml config --quiet
sudo docker compose -p nodia-vps-test --env-file /etc/nodia/infra.env -f /etc/nodia/compose.vps-test.yml up -d --wait
sudo docker compose -p nodia-vps-test --env-file /etc/nodia/infra.env -f /etc/nodia/compose.vps-test.yml ps
```

Crear la base y un propietario de aplicación sin privilegios de superusuario:

```bash
sudo docker compose -p nodia-vps-test --env-file /etc/nodia/infra.env -f /etc/nodia/compose.vps-test.yml exec postgres psql -U postgres -d postgres
```

Dentro de psql, solo en la primera instalación:

```sql
CREATE ROLE nodia_user LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
\password nodia_user
CREATE DATABASE nodia_db OWNER nodia_user;
\q
```

El prompt de `\password` debe recibir exactamente la contraseña de `POSTGRES_PASSWORD` del Server. El propietario puede instalar la extensión confiable `uuid-ossp` requerida por el baseline ([PostgreSQL 16](https://www.postgresql.org/docs/16/uuid-ossp.html)). Separar posteriormente rol de migraciones y rol de ejecución si se formaliza este diseño para producción.

## 4. Instalar Server e inicializar la BD vacía

```bash
cd /opt/nodia/nodia-server
sudo -H -u nodia npm ci --include=dev
sudo -H -u nodia npm run db:setup
```

Este comando compila, aplica las **18 migraciones** y crea/verifica el usuario del correo configurado, rol `super_admin`, grupo `general_settings`, cuatro módulos Core y sus relaciones. No activa sincronización ni migra datos locales.

Si se probarán Finanzas/Reservas, antes de retirar herramientas de compilación:

```bash
sudo -H -u nodia npm run seed:finance
sudo -H -u nodia npm run seed:rental
```

Esos comandos registran navegación; asignar los módulos al usuario en Ajustes después del login. Negocios/Proveedores IA tienen tablas/catálogo pero su navegación/asignación no queda incluida en el bootstrap Core; crear/configurar sus módulos conforme a rutas/contratos vigentes.

Comprobar desde psql conectado a `nodia_db`:

```sql
SELECT count(*) FROM migrations;
SELECT email, is_active FROM users;
```

Esperar 18 migraciones y el administrador inicial activo. Revisar rol y cuatro asignaciones desde Ajustes. El usuario sigue autenticándose con Google; no se crea contraseña de acceso Nodia.

Después de completar migraciones/seeds/build:

```bash
sudo -H -u nodia npm prune --omit=dev
```

`db:setup`/seeds recompilan y necesitan devDependencies. En próximas actualizaciones, reinstalarlas explícitamente antes de estos comandos. `db:setup` es para instalación vacía/repetición completa; para releases incrementales usar `migration:run` tras backup y reconciliación del historial.

## 5. Preparar Gemini

Crear su `.env` desde el ejemplo solo si no existe, con el mismo `GEMINI_SERVICE_TOKEN` del Server. Para la primera medición, establecer `ANALYSIS_SLOTS=1`. Mantener cookies/modelos/configuración CLI vacíos hasta configurar el motor explícitamente.

```bash
cd /opt/nodia/nodia-gemini-microservice
sudo install -d -o 10001 -g 10001 -m 0700 browser_profile session_state
sudo chown 10001:10001 .env
sudo chmod 400 .env
sudo docker compose config --quiet
sudo docker compose up -d --build
sudo docker compose ps
curl --fail http://127.0.0.1:8000/health
curl -i http://127.0.0.1:8000/models
```

Esperar health correcto y 401 en `/models` sin token. El bind de Compose ya es loopback. En un VPS limitado, construir la imagen antes/fuera del host para evitar disputar memoria con BD/API. Aplicar rotación de logs al contenedor como en el ensayo de infraestructura.

Health no acredita sesión ni inferencia. Gemini Web requiere un mecanismo privado de operación en VPS aún pendiente; su botón local no funciona como login gráfico productivo. Agentic es independiente: preparar `agentic_profile` UID 10001 y usar el overlay documentado en [el microservicio](../../nodia-gemini-microservice/README.md) si se decide probarlo; validar login/inferencia Linux. Codex permanece deshabilitado hasta comprobar perfil/keyring del usuario del servicio. No sustituir modos.

## 6. Iniciar API con systemd

Crear `/etc/systemd/system/nodia-server.service`:

```ini
[Unit]
Description=Nodia API
After=network-online.target docker.service
Wants=network-online.target
Requires=docker.service

[Service]
Type=simple
User=nodia
Group=nodia
WorkingDirectory=/opt/nodia/nodia-server
Environment=NODE_ENV=production
ExecStart=/usr/local/bin/node /opt/nodia/nodia-server/dist/main.js
Restart=on-failure
RestartSec=5
TimeoutStopSec=360
UMask=0077
NoNewPrivileges=true
PrivateTmp=true
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

El Server carga `.env` mediante dotenv desde su directorio de trabajo. Reemplazar ExecStart si Node está en otra ruta. Comprobar la unidad en el host antes de activarla:

```bash
sudo systemd-analyze verify /etc/systemd/system/nodia-server.service
sudo systemctl daemon-reload
sudo systemctl enable --now nodia-server
sudo systemctl status nodia-server --no-pager
sudo journalctl -u nodia-server -n 100 --no-pager
curl --fail http://127.0.0.1:3000/api/v1
```

El endpoint raíz es liveness, no readiness DB/Redis. Verificar además consultas autenticadas, cuotas y escritura/lectura real de prueba. El código actual escucha 3000 en todas las interfaces: conservar el firewall del host/proveedor cerrado para ese puerto. No usar `npm run dev` ni watch para el servicio.

## 7. DNS, Nginx y HTTPS

Crear un registro A `api.tudominio.cl` hacia IPv4 del VPS; añadir AAAA solo si IPv6 está configurado/protegido. Para la prueba de análisis largos, mantener API **DNS-only**, sin proxy naranja de Cloudflare: su timeout publicado de lectura de 125 s puede cortar la petición antes de los 300–340 s de Nodia ([Cloudflare 524](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-524/)). Frontend Pages sigue en Cloudflare.

Crear `/etc/nginx/sites-available/nodia-api`:

```nginx
server {
    listen 80;
    server_name api.tudominio.cl;
    root /var/www/html;
    location / {
        try_files $uri =404;
    }
}
```

Habilitar ese sitio, instalar Certbot por sus [instrucciones oficiales Nginx](https://certbot.eff.org/instructions?ws=nginx&os=snap), emitir el certificado y comprobar renovación:

```bash
sudo ln -s /etc/nginx/sites-available/nodia-api /etc/nginx/sites-enabled/nodia-api
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d api.tudominio.cl --redirect
sudo certbot renew --dry-run
```

Certbot añade el bloque TLS y referencias de certificado. En el bloque HTTPS resultante, sustituir el `location /` del sitio inicial por el siguiente y añadir `client_max_body_size` al bloque server:

```nginx
client_max_body_size 12m;
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_read_timeout 360s;
    proxy_send_timeout 360s;
    proxy_buffering off;
}
```

El límite permite overhead multipart; el backend mantiene 10 MiB por archivo. Buffering desactivado permite observar SSE; el proxy sobrescribe la cadena de IP remitida por el cliente. Mantener redirección HTTP→HTTPS en 80. [Referencia Nginx](https://nginx.org/en/docs/http/ngx_http_proxy_module.html).

```bash
sudo nginx -t
sudo systemctl reload nginx
curl --fail https://api.tudominio.cl/api/v1
```

No abrir acceso general con VPS-03 pendiente. Para el ensayo, el firewall de 443 sigue restringido a la IP del operador.

## 8. Publicar Client y configurar Google

En Cloudflare Pages: raíz `nodia-client`, build `npm run build`, salida `dist` relativa a esa raíz; Node compatible y lockfile. Configurar variables antes de compilar:

```dotenv
VITE_API_URL=https://api.tudominio.cl/api/v1
VITE_GOOGLE_CLIENT_ID=EL_MISMO_GOOGLE_CLIENT_ID_DEL_SERVER
```

Configurar dominio `app.tudominio.cl`, origen OAuth web HTTPS exacto en Google y usuario de prueba si el consentimiento aún está en modo testing. Revisar [autenticación](14-authentication.md). `VITE_*` se incorpora al build: modificar variables exige un nuevo build.

La pareja app/API bajo el mismo sitio permite probar cookies `SameSite=lax`. Si se usa `*.pages.dev` frente a otro dominio API, revisar `SameSite=None; Secure` y restricciones de cookies de terceros; no asegurar funcionamiento por CORS solamente. Comprobar apertura directa de rutas SPA. [Build de Pages](https://developers.cloudflare.com/pages/configuration/build-configuration/).

## 9. Aceptación del ensayo

1. Login con el correo inicial; módulos Core y relaciones correctos; creación/edición real de un registro desechable y toast/respuesta.
2. Refresh tras recargar, cierre de sesión y rechazo de cuenta no autorizada.
3. Desde un equipo externo, 3000/5432/6379/8000 inaccesibles; 443 solo para IP permitida.
4. Rate limiting conserva cliente efectivo; Redis caído produce error esperado y no un fallback a memoria.
5. Reiniciar API y después el VPS; contenedores/API vuelven y datos persisten.
6. R2 con archivo sintético: guardar, recuperar y observar limpieza/recuperación de intentos fallidos. Probar IA real únicamente tras configurar explícitamente credenciales/modelo y medir recursos. Catálogo de 17 proveedores no representa 17 adaptadores disponibles.
7. Verificar memoria/disco, logs con rotación y estado de diario de uploads.
8. Respaldar y restaurar antes de considerar apertura general. Factura/productos conserva el límite S-05 y debe cerrarse si ese flujo entra al lanzamiento.

Un health 200 no reemplaza estas comprobaciones. No se ejecutaron en el VPS durante la preparación de esta guía.

## 10. Backup, restauración y actualizaciones

Ejemplo de backup lógico (operador con sudo, sin contraseña en línea de comandos):

```bash
sudo -i
umask 077
docker compose -p nodia-vps-test --env-file /etc/nodia/infra.env -f /etc/nodia/compose.vps-test.yml exec -T postgres pg_dump -U postgres -d nodia_db -Fc > /var/backups/nodia/nodia-inicial.dump
exit
```

Copiar cifrado fuera del VPS y comprobar restauración en una BD separada, nunca sobre la operativa. El respaldo de PostgreSQL no incluye objetos R2, roles globales ni perfiles IA; proteger también esos recursos y la clave maestra, con acceso separado. Configurar backups externos automáticos y rotación de journald/Docker; snapshot/volumen persistente por sí solo no basta.

Para ensayo de restauración, crear una BD nueva y vacía `nodia_restore_test` mediante el psql del paso 3; luego, desde shell root:

```bash
docker compose -p nodia-vps-test --env-file /etc/nodia/infra.env -f /etc/nodia/compose.vps-test.yml exec -T postgres pg_restore -U postgres --no-owner --no-privileges --exit-on-error -d nodia_restore_test < /var/backups/nodia/nodia-inicial.dump
```

Comprobar tablas, migraciones, relaciones y filas restauradas. Es un ensayo de datos con propietario de prueba; el proceso productivo debe reconstruir permisos/propietarios de la instalación. [pg_dump](https://www.postgresql.org/docs/16/app-pgdump.html) y [pg_restore](https://www.postgresql.org/docs/16/app-pgrestore.html).

Para futuros releases: backup externo verificado, identificar commit, detener API, instalar `npm ci --include=dev`, `npm run migration:run`, compilar, `npm prune --omit=dev`, iniciar API y repetir smoke; rebuild/redeploy Gemini/Pages solo si cambian. Registrar release anterior e imagen previa. No usar `db:setup` para una actualización con esquema existente y nuevas migraciones. Una migración irreversible exige restauración del backup y release compatible, con pérdida de escrituras desde la copia; no asumir que volver al commit anterior revierte la BD.

## Estado de preparación de esta guía

Revisión de código/configuración y fuentes oficiales; sintaxis del ejemplo Compose comprobada localmente con entorno ficticio, sin arrancar servicios ni crear volúmenes. Bloques Bash comprobados con `bash -n` sin ejecutarlos y cuatro enlaces locales correctos; diff sin errores de whitespace. No se ha ejecutado systemd/Nginx/OAuth/login/inferencia ni restore en Ubuntu/VPS. Las pruebas previas de instalación DB se describen en [database-installation](database-installation.md).
