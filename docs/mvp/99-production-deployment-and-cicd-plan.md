# Piloto productivo en Truobox y CI/CD del monorepo

> Estado: en revisión. Backend y frontend f01 publicados; backup/restore inicial verificados. Transporte restringido y actualizador instalados sin cambiar f01; Código CI/CD implementado y probado localmente en development. Ejecución GitHub y primer despliegue automático pendientes. Login/uso general reportados por el usuario; no se acredita aprobación integral de lanzamiento.
> Fecha: 2026-11-08. Continuidad actualizada el 2026-11-12 UTC.
> Dependencias: [stack10](10-stack-devops.md), [arquitectura11](11-architecture-overview.md), [runbook18](18-security-deployment-runbook.md), [revisión19](19-prelaunch-review.md), [instalación](database-installation.md), [historial de despliegue](vps-first-test-deployment.md), [ADR097 propuesto](../architecture/decisions/ADR-097-monorepo-production-release-pipeline.md).

## 1. Alcance confirmado y situación real

El usuario solicita pasar del ensayo de hosting a un **ambiente productivo para feedback de stakeholders**, inicialmente dos personas. Elige Truobox para la máquina y confirma conservar **Northflank Free para PostgreSQL** por el volumen inicial; si resulta insuficiente se evaluará otro servicio o PostgreSQL en el VPS. Cloudflare Pages para Client, Redis local privado y R2 para archivos/recuperación son los destinos ya configurados; la aceptación funcional y los pendientes operativos se distinguen a continuación.

La referencia del mensaje a que «Truobox no sirve para pruebas sin cortes» se interpreta por contexto como **Instabox Free**: las pausas/max-run discutidas pertenecen a Instabox. Truobox es la elección explícita de destino. La comparación y los ensayos previos se conservan como historia, no como recetas listas para producción.

Aclaración vigente del usuario (2026-11-12): las únicas ramas de integración y producción son **development** y **master**. El flujo es: **development** será la predeterminada y de integración; **master** contendrá lo que se publica en producción. «Main» en la petición describe el rol principal de development, no una tercera rama de integración obligatoria. El usuario confirma GitHub Actions como orquestador del monorepo con despliegue por componentes afectados; el diseño de detalle permanece en revisión.

### Estado vigente confirmado — 2026-11-12 UTC

- **Release y procesos:** master `f01b493336883403a84b1c80759ce4fc43cbd370`, paquete `backend-f01b49333688-ff33b6fdbbbc` instalado en `/opt/nodia/releases`, con `/opt/nodia/current` apuntando al release. API y Worker están active/enabled, mismo paquete/cwd y usuario nodia. Instalación SQL reconciliada sin repetir bootstrap: 45 migraciones, 68 tablas de entidades, 1 administrador y 4 asignaciones Core; f01 permanece inmutable.
- **API pública:** `https://166.0.112.187/api/v1` responde 200 con TLS estándar externo y CORS para `https://nodia-1ge.pages.dev`. OPTIONS de login devuelve 204; auth/me sin sesión devuelve 401. Se verificó desde el PC que 3000/6379 no son alcanzables. El proxy conserva ACME/redirect 308 y `/tls-check`. Estas pruebas no sustituyen Google login/cookies/refresh reales ni una renovación futura del certificado.
- **Frontend:** f01 publicado en `https://nodia-1ge.pages.dev`, deployment `214e120b-b6e5-400f-a70a-5cb77aa4d3d7`; index y asset API coinciden por hash en el alias bajo TLS estricto. URL API y Google Client ID coinciden con el backend. Pages conserva rama productiva master, auto-deploy deshabilitado y previews none. [Recibo frontend](../evidence/production-frontend-live-20261112-r01.json).
- **Recuperación:** backup `c2e5b337-3f3f-48db-b70a-71cfc15d00f7` ready en R2 a `2026-11-12T02:42:48.187Z`. Restore Docker aislado del PC verificado: 45 migraciones/68 entidades, fingerprints de 94 tablas/122 filas coincidentes y preparación en cuarentena sin dispatch ni release. Recibo local `output/production/restore-first-backup-20261111-r02.json`; no se restauró la base de origen. Backup diario a las 02:30 UTC y rotación cada 5 min habilitados; su futura ejecución y alertas conservan verificación propia.
- **Rutas y custodia:** los CLI backup/journal usan paths canónicos bajo `/opt/nodia/releases/backend-f01b49333688-ff33b6fdbbbc/scripts`, porque invocarlos por el symlink current no ejecutaba su main guard en f01. Se corrigió configuración externa, sin hotpatch. Cada futura adopción debe actualizar esos paths junto con current y comprobar escritores/backup. RSA privada y configuración cifrada custodiadas en el PC con acceso exclusivo del usuario y descifrado/digests comprobados; falta una segunda copia offline.
- **Pendientes de apertura:** rotar las credenciales PostgreSQL expuestas, pospuesto por el usuario hasta antes de stakeholders; probar Google login/cookies/refresh y aislamiento reales; completar alertas, CI/CD, recuperación integral ante fallos y calificación de features/IA. Publicación no equivale a aceptación del piloto.

El usuario confirma el 2026-11-12 que el login y el uso general ya funcionan.
Es una confirmación del operador, sin extrapolarla a todos los flujos, refresh/cookies
o proveedores IA. Autoriza ahora **CI primero**; el despliegue automático se conectará
después. Ordena conservar todo en la rama actual **development**, sin promover a
master porque mantiene otros cambios pendientes. No se renombra la rama a development.
Logs, monitoreo, consulta de errores y seguridad adicional conservan su etapa propia;
la rotación PostgreSQL expuesta sigue pendiente. La sesión sudo temporal está cerrada.

[Evidencia operativa consolidada](../evidence/production-backend-live-20261112-r01.json) y [runbook de operación](../../ops/production/README.md). Las secciones históricas siguientes registran sus cortes originales; no describen el estado actual de procesos, ramas o recuperación.

### Inspección inicial histórica, antes del aprovisionamiento

- El conector GitHub confirma `oscarvalenzuela25/Nodia`, repositorio público y rama predeterminada **main**. La consulta paginada de ramas devolvió `main` y `advances`; no se crearon development/master ni se alteraron ajustes.
- El checkout local está en `main`. No hay workflows versionados bajo `.github/` ni paquete/workspaces raíz. Client y Server tienen manifiestos y lockfiles npm independientes; Python y Rust conservan sus propios manifiestos/locks.
- API y Worker salen de **nodia-server** y comparten versión/recursos compilados. El servicio Python y el host nativo de Teacher/Codex tienen empaquetados independientes; no todos requieren un cambio de versión por cada cambio visual.
- La entrega activa del laboratorio no acredita operación en Truobox. No se compró VPS, crearon recursos, cambiaron ramas, aplicaron migraciones ni ejecutaron inferencias en esta revisión.
- Se revisaron scripts/manifiestos y fuentes; no se ejecutaron suites ni builds del producto para redactar este documento. Los resultados históricos pertenecen a su release/entorno.

### Avance comunicado y observado el 2026-11-09

- **Client:** el usuario reporta frontend desplegado en Cloudflare Pages y despliegues automáticos nativos deshabilitados. Falta el dominio definitivo de API y configurar `VITE_API_URL`; después habrá que recompilar/publicar Client. No se ha verificado remotamente la publicación, su configuración o el circuito de autenticación. Actions aún no está implementado.
- **PostgreSQL:** el usuario crea el addon y aporta una captura de Connection details con base `nodia_db` y `TLS_ENABLED=true`. Esto no acredita salud, conectividad, versión efectiva, plan/cuotas, accesibilidad ni backups. La recomendación de creación es PostgreSQL 16 y `wal_level=replica`; comprobar la selección efectiva. No se ejecutaron consultas ni migraciones desde esta sesión.
- **Credenciales:** rotar las credenciales normal y administrativa mostradas en la captura, completar la finalización de la rotación para revocar las anteriores y custodiar las nuevas fuera de Git/chat. No incorporar la captura ni sus valores al repositorio. La rotación no está acreditada.
- **Red y backups:** mantener Private y TLS mientras no exista VPS; después preparar acceso externo con TLS validado y reglas que permitan sólo la IP de salida del VPS. Schedule sugerido: dump diario, 02:30 UTC si el selector usa UTC, retención de siete días, únicamente tras comprobar inclusión/costo en Free. Su configuración y ejecución están pendientes; no sustituye la recuperación cifrada/journal del proyecto.
- **VPS:** posteriormente el usuario confirma Truobox contratado con Ubuntu. Su captura del panel muestra la instancia encendida en Virginia, EE. UU., con 4 vCPU, 8 GB de RAM y 120 GB de disco; son datos del panel, no una inspección del sistema invitado. Versión/arquitectura efectivas, acceso SSH y dominio API siguen pendientes; contratación comunicada no acredita configuración ni despliegue. Los resultados de inspección de ramas anteriores son históricos; no prueban la configuración remota actual. Continuar con la [secuencia inicial](#8-primer-acceso-y-despliegue-en-truobox).
- **Inspección SSH posterior:** conexión autenticada como root completada, con comprobación estricta contra la clave de host previamente guardada. Puerto 22 responde; Ubuntu 26.04.1 LTS x86-64, kernel 7.0.0-14-generic, 4 vCPU, RAM 7.8 GiB (7.2 GiB disponibles), raíz 116 GiB (113 GiB disponibles), sin swap. cloud-init finalizado, SSH activo, UFW inactivo y reinicio requerido. En TCP sólo se observaron SSH público y DNS de systemd en loopback. Inventario de lectura, sin cambios de configuración, instalación de paquetes, DB o servicios de aplicación. Dominio API, usuario administrativo con clave y rotación del acceso inicial siguen pendientes. No se conserva la contraseña en archivos, argumentos de procesos ni documentación.
- **Acceso por clave posterior:** ante el fallo de contraseña reportado en la consola del operador, se repitió una autenticación correcta sin determinar la causa de su intento fallido. Se generó una clave Ed25519 exclusiva en el equipo del operador, fuera de Git, y se añadió únicamente la pública a `authorized_keys` de root sin reemplazar entradas. Se comprobó una segunda conexión independiente con `BatchMode=yes`, `IdentitiesOnly=yes` y validación estricta de host: `id -un` devolvió root sin contraseña. Huella pública de la clave: `SHA256:Dcn8eCNbpJGqs5tKwq98c+I+tqo3yuWnVdgAhFhSP/8`. No se cambió la contraseña ni se deshabilitó su acceso; pasar a usuario administrativo con clave, rotar el acceso inicial y aplicar firewall siguen pendientes. No se atribuye el fallo manual a teclado, red o contraseña incorrecta sin evidencia.

### Continuidad guiada del 2026-11-10

El usuario solicita una ejecución educativa por bloques: explicar comandos y resultado esperado, revisar el resultado de cada bloque antes de avanzar. No ejecutar silenciosamente pasos posteriores del tutorial.

Aclaración posterior del usuario el mismo día: solicita que el agente continúe la configuración y deje el paso a paso por tópicos en su `VPS.md` de Obsidian. Se autoriza avanzar con el flujo HTTPS preparado y documentarlo sin pedir revisión de cada bloque; autenticación sudo y registro/términos de Certbot siguen introducidos por el operador en su terminal, sin compartir secretos. No cambia las aprobaciones funcionales ni autoriza declarar completo el despliegue de API por configurar HTTPS.

- **Rotación de root:** el usuario confirma que ejecutó `passwd` y obtuvo `password updated successfully`. Se registra su confirmación, sin recibir/almacenar la contraseña nueva ni probarla. No confundir esta rotación con las credenciales PostgreSQL, que conservan su pendiente independiente.
- **Usuario administrativo creado:** el usuario confirma creación y pertenencia al grupo sudo. Inspección SSH de lectura posterior verifica `nodia-admin`, UID/GID 1000, grupos sudo/users, shell `/bin/bash` y home `/home/nodia-admin` propiedad del usuario con modo 750. No se leyó ni recibió su contraseña. La API tendrá otro usuario de ejecución sin privilegios.
- **SSH administrativo comprobado:** el usuario solicita completar el paso. La inspección posterior encuentra `.ssh` y `authorized_keys` ya instalados, propiedad de `nodia-admin:nodia-admin`, modos 700/600 y huella pública correcta; no se sobrescribe ningún archivo ni se cambia la política SSH. Conexión independiente con clave exclusiva, `IdentitiesOnly=yes`, `BatchMode=yes` y validación estricta del host devuelve `whoami=nodia-admin` y grupos sudo/users. La política consultada como root permite `(ALL : ALL) ALL`. `sudo -n whoami` exige autenticación interactiva: permiso configurado y login SSH comprobados, contraseña/elevación efectiva aún por probar. Se abre PowerShell para el operador; introducir allí la contraseña propia al ejecutar `sudo whoami`, sin compartirla por chat. Mantener root abierto; no restringir su acceso ni activar firewall hasta acreditar el circuito alternativo. La clave privada permanece en el equipo del operador.
- **Elevación y bloque de firewall:** posteriormente el usuario confirma que `sudo whoami` devolvió root y elige Warp para continuar el tutorial. Preflight de lectura verifica SSH en 22/TCP IPv4/IPv6, `IPV6=yes`, UFW inactivo y ninguna regla de usuario. Bloque propuesto, aún sin ejecutar: defaults deny incoming/allow outgoing, permitir 22/TCP y comprobar `ufw show added`. Revisar la regla antes de habilitar UFW y probar una conexión SSH nueva después, conservando una sesión abierta. Abrir 80/443 al preparar HTTPS; Redis y adaptadores conservarán publicación exclusiva en loopback. UFW es un control del host, no acredita el firewall del proveedor ni el aislamiento de puertos publicados por Docker.
- **Reglas preparadas, activación pendiente:** el usuario confirma la regla 22/TCP. Una nueva lectura SSH verifica `ufw allow 22/tcp comment 'SSH administrativo'`, INPUT/FORWARD DROP y OUTPUT ACCEPT; UFW continúa inactivo. Siguiente bloque del operador: `sudo ufw enable`, comprobar `sudo ufw status verbose` y abrir una conexión independiente como `nodia-admin` desde una pestaña local de Warp con la clave del equipo. No dar por probada la conectividad posterior a activación con esta lectura previa ni con una sesión ya abierta.
- **Activación efectiva y bloque de actualización:** el usuario comunica UFW activo y nueva conexión administrativa correcta. El preflight posterior encuentra una discrepancia: UFW inactivo en el mismo host con regla 22/TCP conservada; no se atribuye causa al operador ni se da por persistente el reporte anterior. Tras comunicarlo, se ejecuta `ufw --force enable` con la regla SSH revisada y se verifica `Status: active`, habilitación al arranque, deny incoming/allow outgoing y reglas 22/TCP IPv4/IPv6. Una conexión SSH independiente posterior devuelve `nodia-admin`. `dpkg --audit` no reporta paquetes inconsistentes, cloud-init está finalizado, apt-daily/apt-daily-upgrade no están activos y `/run/reboot-required` está presente. Actualización de paquetes y reinicio siguen pendientes del bloque educativo del operador: `apt update`, `apt upgrade`, reinicio sólo al terminar sin errores y nueva comprobación de SSH, kernel/uptime y UFW después del arranque. No cambiar de release Ubuntu ni forzar paquetes retenidos por esta etapa.
- **Reinicio verificado y siguiente bloque SSH:** inspección posterior confirma arranque UTC `2026-11-10 04:21:23`, kernel `7.0.0-43-generic`, UFW activo con 22/TCP IPv4/IPv6 y marcador de reinicio ausente. `dpkg --audit` no reporta inconsistencias; simulación de upgrade no propone cambios y aplaza únicamente `python3-software-properties` y `software-properties-common` por phasing (0%), sin forzarlos ni ejecutar autoremove. Siguiente bloque educativo, aún pendiente: crear `00-nodia-hardening.conf`, validar sintaxis y valores efectivos, recargar SSH y comprobar otra conexión como `nodia-admin` antes de cerrar sesiones previas. Configuración actual inspeccionada: root/password permitidos, pubkey habilitado y keyboard-interactive deshabilitado. Include de snippets precede a las directivas principales y existen ajustes cloud-init/Truobox posteriores: el archivo 00 debe fijar los valores efectivos y comprobarse con `sshd -T`, no editar sólo una directiva tardía. No se ha cambiado SSH en esta inspección.
- **Autenticación sudo pendiente de recuperar:** el usuario reporta rechazos y comparte una credencial; no se conserva su valor. Se comprueba una sola autenticación como `nodia-admin` con `sudo -k` y `sudo whoami`, usando entrada oculta; devuelve `Authentication failed` y se cancela antes de otro intento. La consulta `passwd -S` muestra contraseña configurada (P), sin demostrar coincidencia ni resolver posibles causas de autenticación. Se verifica que root por clave todavía funciona. El reporte anterior de sudo correcto no acredita su disponibilidad actual. Prioridad: el operador entra como root por clave y ejecuta `passwd nodia-admin`, introduce una contraseña nueva sólo en su terminal y después prueba `sudo -k`/`sudo whoami` como nodia-admin. No recargar restricciones de root/SSH hasta recuperar elevación administrativa verificable; no desactivar autenticación sudo ni introducir NOPASSWD para sortear el fallo.

- **Configuración escrita y servicio aún sin aplicar:** consulta posterior `sshd -T` muestra root/password/keyboard-interactive deshabilitados y pubkey habilitado en la configuración en disco. Sin embargo, una conexión nueva como root por clave todavía funciona y una negociación sin credenciales como nodia-admin anuncia `(publickey,password)`: no acreditar restricciones activas a partir de `sshd -T` solamente. Quedan validar sintaxis, recargar el servicio y probar una conexión administrativa nueva y los métodos realmente ofrecidos, conservando sesiones previas. No se enviaron contraseñas en esa negociación ni se recargó SSH en esta comprobación.
- **Preflight de recarga:** tras la explicación solicitada y la petición de continuar, `sshd -t` termina correctamente y `sshd -T` para contexto nodia-admin muestra los cuatro valores esperados. Nueva conexión por clave devuelve nodia-admin. La recarga continúa pendiente del operador en Warp: invalidar el ticket sudo con `sudo -k` y ejecutar `sudo /usr/sbin/sshd -t && sudo systemctl reload ssh`; así la autenticación sudo y la sintaxis deben pasar antes de aplicar. Mantener la sesión previa y probar otra conexión administrativa. Comprobar después que root se rechaza y el servicio ya no ofrece contraseña; todavía no se acreditan esos efectos activos.
- **Restricciones SSH aplicadas y comprobadas:** tras el aviso del operador, una nueva conexión con la clave exclusiva como nodia-admin devuelve su identidad. La conexión como root con la misma clave se rechaza con `Permission denied (publickey)`. Una negociación nueva de nodia-admin sin enviar credenciales anuncia únicamente publickey, sin password: ahora se comprueba el servicio activo, no sólo el archivo. No se borraron cuentas/contraseñas ni claves autorizadas con esta recarga; sudo y la recuperación desde consola conservan sus mecanismos independientes. No queda acceso remoto root por clave para automatizar pasos siguientes; las acciones privilegiadas se ejecutarán desde nodia-admin con autenticación sudo del operador, sin sortearla ni pedir secretos por chat. Siguiente bloque educativo pendiente: preparar herramientas/runtime conforme a la versión del release y al Ubuntu verificado.
- **Preflight de herramientas y selección Node:** inspección como nodia-admin encuentra node/npm/docker/nginx ausentes; curl, xz y gpg presentes. APT ofrece Node 22.22.1, mientras Client declara `engines.node >=24.20.0` y Server no declara engines. Se selecciona Node 24.22.2 LTS para alinear la rama de runtime/CI; no atribuir ese mínimo al Server ni declarar compatibilidad del release sólo por la versión. Catálogo oficial consultado: v24.22.2 (2026-10-27), npm 11.19.1. Binario oficial Linux x64 responde HTTP 200; SHA256 publicado de `node-v24.22.2-linux-x64.tar.xz`: `48cc0e21e048790e54c0cf5749c2725005313d652651c40b7a21feb9697aaf75`. Bloque educativo pendiente: descargar archivo y SHASUMS desde nodejs.org como usuario no privilegiado en `~/nodia-setup/node-24.22.2` y comprobar el hash. Instalación posterior versionada y enlaces de sistema requieren sudo del operador; registrar paths efectivos para systemd/recovery. No se ha instalado ningún runtime ni iniciado aplicación. Mantener descarga como temporal de instalación, no dependencia de ejecución del release.
- **Descarga Node verificada, instalación pendiente:** el usuario confirma checksum OK; inspección del VPS repite la comprobación y acredita el SHA256 oficial anterior. El archivo contiene el directorio esperado `node-v24.22.2-linux-x64/` y ejecutables node/npm/npx. Se comprueba que `/opt/node-v24.22.2-linux-x64` y `/usr/local/bin/{node,npm,npx}` todavía no existen. Siguiente bloque del operador: extraer con sudo a `/opt` usando `--no-same-owner` para propiedad root e instalar enlaces simbólicos sin forzar/sobrescribir a los tres ejecutables. Verificar versión de Node/npm/npx y resolución a `/usr/local/bin/node`. Esta instalación fijada no se actualiza con apt upgrade; actualizarla explícitamente junto al runtime del release. No se ha extraído ni instalado todavía desde esta inspección.
- **Node instalado y comprobado:** reporte del operador y nueva conexión SSH verifican Node v24.22.2, npm/npx 11.19.1 y `/usr/local/bin/node` resolviendo a `/opt/node-v24.22.2-linux-x64/bin/node`. Directorio y binario pertenecen a root:root con modo 755. Esto acredita runtime disponible, no build, compatibilidad integral ni despliegue de Nodia.
- **Bloque Docker, preparación pendiente:** consultas de paquetes no encuentran docker.io/docker-compose/docker-compose-v2/docker-doc/podman-docker/containerd/runc/docker-ce/docker-ce-cli/containerd.io instalados; no existen docker.asc/docker.gpg ni docker.sources/docker.list. Seguir repositorio APT oficial de Docker, que admite Ubuntu 26.04 LTS resolute amd64 según documentación consultada. En Warp: dependencias ca-certificates/curl, clave pública en `/etc/apt/keyrings/docker.asc` legible por APT y fuente deb822 `/etc/apt/sources.list.d/docker.sources` con suite resolute, arquitectura amd64 y Signed-By acotado a esa clave. Revisar apt update y candidato docker-ce antes de instalar Engine/CLI/containerd.io/Buildx/Compose. Todavía no se añadió el repositorio ni se instaló Docker; mantener administración mediante sudo, sin dar acceso al socket Docker al usuario de aplicación. Publicar puertos de contenedores requiere revisar el bypass de UFW documentado por Docker; Redis/adaptadores conservarán loopback.
- **Repositorio Docker disponible, instalación pendiente:** salida aportada por el operador y consulta APT de lectura confirman repositorio oficial resolute/stable amd64 y ausencia de instalación. Candidatos: Engine/CLI `5:29.9.3-1~ubuntu.26.04~resolute`, containerd.io `2.4.2-3~ubuntu.26.04~resolute`, Buildx `0.38.1-1~ubuntu.26.04~resolute` y Compose `5.7.0-1~ubuntu.26.04~resolute`. Bloque siguiente del operador: instalar Engine/CLI en la versión revisada más containerd/Buildx/Compose, habilitar/iniciar servicio y verificar cliente/servidor, Compose, estado y contenedor efímero hello-world con nombre `template_docker_check` y `--rm`. Este test no es artefacto productivo ni acepta readiness de Nodia; registrar versiones efectivamente instaladas. No se han instalado paquetes ni ejecutado contenedores desde esta consulta; no añadir usuarios al grupo docker para evitar sudo. Revisar logging/rotación y publicación de puertos antes de crear servicios persistentes.
- **Docker instalado y bloque de logs:** el operador confirma Engine 29.9.3, Compose, servicio active y Hello from Docker. Inspección SSH verifica CLI 29.9.3 build 5457199, Compose v5.7.0, los cinco paquetes en las versiones candidatas anteriores y servicio active/enabled. Socket root:docker modo 660; nodia-admin conserva grupos sudo/users sin docker. `/etc/docker/daemon.json` no existe. Bloque educativo siguiente: comprobar contenedores activos antes de reiniciar, crear configuración local de logs con max-size 10m/max-file 3 y validar con `dockerd --validate`. Tras revisar resultado, reiniciar servicio y acreditar driver efectivo/aplicación en un contenedor nuevo; existentes no heredan automáticamente ese cambio. Configuración/reinicio aún no ejecutados desde la inspección. Esta rotación cubre stdout/stderr de contenedores, no logs de API/Worker bajo systemd ni backups/retención de datos.
- **Logs escritos y validados, aplicación pendiente:** el usuario reporta ausencia de contenedores activos y `configuration OK`. Lectura SSH verifica `/etc/docker/daemon.json` root:root modo 644 con driver local y opciones max-size 10m/max-file 3; servicio Docker active/enabled. Bloque del operador: reiniciar sólo Docker, comprobar estado y driver predeterminado con `docker info`; crear contenedor nuevo `template_log_check` con hello-world, inspeccionar HostConfig.LogConfig y leer mediante `docker logs`, después retirar ese contenedor detenido. No usar `--rm` antes de inspeccionarlo ni editar directamente archivos internos de logs. Verificar configuración/herencia y lectura no equivale a haber forzado/medido una rotación de 10m ni al cierre de retención de datos NodiaAI. Reinicio y pruebas del nuevo contenedor aún pendientes de resultados.
- **Logs comprobados por el operador y preflight Nginx:** el usuario confirma Docker active, driver local, LogConfig heredado max-file 3/max-size 10m, lectura mediante docker logs y eliminación del contenedor de prueba. No se forzó rotación real de 10m. Inspección SSH posterior verifica Docker activo, Nginx ausente, puerto 80 libre y candidato nginx `1.28.3-2ubuntu1.12` desde resolute-updates/security. Siguiente bloque educativo: instalar Nginx del repositorio Ubuntu, validar configuración, habilitar/iniciar y comprobar HTTP local en 127.0.0.1; todavía no configurar proxy API ni abrir puertos públicos por esta prueba. No se ha instalado Nginx en esta inspección.
- **URL Client confirmada:** el usuario elige mantener `https://nodia-1ge.pages.dev/` como frontend por ahora; usar origen `https://nodia-1ge.pages.dev` al preparar CORS/OAuth según el contrato real. El dominio/endpoint HTTPS de la API continúa por definir, no se obtiene de la URL administrada pages.dev del Client. No se configuró aún VITE_API_URL, DNS, cookies, CORS u OAuth ni se acredita su integración por registrar la URL. Se pregunta por dominio propio disponible para un subdominio API mientras avanza la instalación local independiente.
- **Sin dominio propio; hostname candidato no resoluble:** el usuario confirma que no tiene dominio y aporta `host-31462f.ns.truo.co`. Consultas A desde el resolvedor local, 1.1.1.1 y 8.8.8.8 devuelven nombre inexistente en este corte; no usarlo como endpoint API acreditado ni inferir que el hostname local tenga DNS público. No se cambiaron registros del proveedor. Como alternativa pendiente, se verifica en la documentación oficial de Let's Encrypt que hay certificados públicos para IP, perfil shortlived de seis días y soporte webroot en Certbot >=5.4; requieren renovación automática y recarga de Nginx mediante deploy-hook, con ensayo real antes de aceptarlos. Esto permite evaluar HTTPS por IP sin compra de dominio, pero no se ha elegido/configurado/emitido certificado ni se promete integración de auth/cookies entre Pages y API por esa posibilidad. Fuente: [IP y certificados en Certbot](https://letsencrypt.org/2026/03/11/shorter-certs-certbot.html). La instalación local de Nginx puede continuar independientemente.
- **Nginx verificado y HTTPS por IP elegido:** el usuario confirma Nginx activo y HTTP 200 local, y elige continuar con certificado HTTPS para la IP del VPS sin comprar dominio. Inspección SSH verifica nginx 1.28.3, servicio active/enabled, respuesta local HTTP 200 y único sitio habilitado default; listen 80 IPv4/IPv6, sin 443. No se acredita acceso público por esa prueba. HTTPS, endpoint API integrado y renovación permanecen pendientes.
- **Preflight Certbot para IP:** Certbot ausente y candidato APT 4.0.0-4, inferior al mínimo 5.4 del flujo webroot documentado. snapd 2.77.1 ya instalado; consulta de Snap Store desde el VPS confirma editor Certbot Project y canal latest/stable 5.9.0, frente a edge dev. `/snap/bin/certbot` y `/usr/local/bin/certbot` ausentes. Bloque educativo siguiente: instalar paquete oficial `certbot` con Snap classic y enlace de acceso en /usr/local/bin; verificar versión y flags --ip-address/--preferred-profile. No mezclar con APT Certbot 4.0 ni instalar canal edge. Luego preparar challenge HTTP-01/webroot y acceso público al puerto 80, ensayar staging aislado del certificado final, emitir certificado público, configurar Nginx TLS y renovar/recargar automáticamente con prueba real. No se instalaron paquetes, abrieron puertos ni emitieron certificados en este preflight; la versión candidata o los flags no prueban emisión/renovación. La aceptación de términos y datos de registro se realizará por el operador en su terminal cuando Certbot lo solicite.
- **Certbot instalado y bloque HTTP-01 local:** operador muestra flags IP/perfil; inspección SSH verifica Certbot 5.9.0, comando /usr/local/bin/certbot enlazado a /snap/bin/certbot. Nginx sólo tiene default habilitado, con webroot /var/www/html; nodia-api.conf y /var/www/letsencrypt aún ausentes. Bloque siguiente: crear /var/www/letsencrypt/.well-known/acme-challenge con permisos de lectura web, sitio /etc/nginx/sites-available/nodia-api.conf en puerto 80 default_server IPv4/IPv6 y server_name de la IP, location ^~ del challenge con root /var/www/letsencrypt/try_files y resto 404. Sustituir únicamente el enlace del sitio de bienvenida (conservar archivo default), validar y recargar Nginx. Preparar archivo de prueba público `prueba` con contenido `nodia-acme-ok` y comprobarlo por loopback con Host de la IP. Conservarlo sólo hasta validar acceso externo y luego limpiarlo. No se ha configurado todavía esta ruta, abierto puerto 80 en UFW ni solicitado certificado; HTTP local no acredita validación ACME externa.
- **Continuación delegada y helper preparado:** se crea [bootstrap HTTPS](../../ops/production/bootstrap-https-ip.sh) y [guía de operación](../../ops/production/README.md), limitado a infraestructura HTTPS inicial. Copia en `/home/nodia-admin/nodia-setup/bootstrap-https-ip.sh` comprobada por hash SHA256 `18e8c2e95cee333ce2c03af3de58deaa6b3c418c340c5d19c30b4a386581c41d`; `bash -n` pasa en Ubuntu y el guard de ejecución sin root rechaza la llamada sin cambiar archivos. Revisión técnica de lectura confirma flujo Certbot 5.9; se usa `--required-profile shortlived` comprobado, servidores ACME explícitos y dry-run sin guardar certificados de prueba. Snap ya dispone de `snap.certbot.renew.timer` enabled, sin crear scheduler paralelo. Se comunica al operador el comando sudo para iniciar: requiere autenticación interactiva, pues `sudo -n` no está autorizado y SSH root está bloqueado. Ninguna regla sudo/SSH se debilita para automatizar. Ejecución privilegiada, certificado y TLS externo aún pendientes hasta sus resultados; estado no secreto previsto en `/var/lib/nodia-https/status.json`.
- **Fallo HTTP local y corrección de permisos:** primera ejecución del operador llega a preparing_http y falla GET local con 404 antes de invocar Certbot. Estado raíz registra fallo de línea147; `namei` verifica `/var/www/letsencrypt` root:root 0700. El helper usaba umask077 y explicitaba modo0755 sólo en el directorio final; sus padres quedaron sin acceso para Nginx. Se corrige enumerando webroot/.well-known/acme-challenge por separado, todos0755, y se añade espera acotada del GET por la recarga graceful. Experimento aislado en Ubuntu reproduce padre0700 con comando anterior y ejecuta la línea corregida real: tres públicos0755, raíz privada de ensayo0700; pasa. Script corregido subido, `bash -n` y hash coincidente `13aeb1f4d1ae81131591c3d3ecf8ac7e8e25cfbd632c812e1fbb73d52c3e48e7`. No se cambian permisos de /etc/letsencrypt ni claves privadas. Puerto80 responde externamente404 al root del sitio (esperado sin API), lo que no demuestra challenge legible. Se pide al operador reejecutar el helper corregido; aún no se acredita certificado ni renovación.
- **HTTPS público verificado:** la reejecución pasa ensayo y emisión; el operador aporta renovación simulada exitosa y el estado raíz registra complete. Desde el PC, HTTP-01 devuelve nodia-acme-ok y HTTPS `/tls-check` devuelve HTTP200/nodia-https-ok con curl sin omitir TLS. Comprobación independiente SslStream con validación estándar autentica cadena/nombre IP, negocia TLS1.2 y observa issuer YE2 de Let's Encrypt, SAN166.0.112.187, vencimiento `2026-11-17T15:27:33Z` (12:27:33 America/Santiago) y huella pública registrada. HTTP raíz redirige308 a HTTPS y HTTPS raíz devuelve404 porque la API aún no está desplegada. Nginx active/enabled; ReloadResult success/ExecReload status0 tras el hook; timer snap.certbot.renew active/enabled con próxima ejecución observada `2026-11-11T06:54:00Z`. Temporales del probe retirados. La salida de nginx -t por stderr no equivale a fallo del hook: sintaxis/test y última recarga fueron positivos. Evidencia consolidada sin secretos: [HTTPS IP R01](../evidence/production-https-ip-20261110-r01.json). Quedan renovación automática transcurrida/alertas de caducidad y aceptación de aplicación/DB/Redis/auth/CI por sus alcances propios; este cierre es sólo transporte HTTPS inicial.

### Northflank Free: elección explícita del piloto

El usuario confirma mantenerlo después de informar que la [guía Sandbox](https://northflank.com/docs/v1/application/billing/pricing-on-northflank) lo destina a pruebas y no lo recomienda para aplicaciones productivas. La elección limita el alcance del piloto: no transforma Free en un servicio con garantías comerciales. Pocos registros no demuestran capacidad, conexiones, seguridad o recuperación. No es una decisión pendiente de escoger proveedor ni autoriza subir de plan automáticamente.

Usar PostgreSQL como único addon; mantener Redis en Truobox. Comprobar región, cuota real, conexiones, almacenamiento, egress y backups desde la cuenta. La disponibilidad de backups automáticos/retención sin costo y el comportamiento ante excedentes siguen sin acreditarse. Revisar el [incidente de seguridad de Northflank](https://status.northflank.com/) al provisionar: la consulta del 2026-11-10 mantiene Monitoring, con última actualización publicada el 6 de noviembre; no se declara resuelto. Usar secretos exclusivos del entorno y atender la rotación de los previamente alcanzados. La elección de hosting no aprueba pérdida de datos ni sustituye un restore ensayado.

## 2. Topología objetivo

| Unidad | Destino | Operación propuesta |
| --- | --- | --- |
| Client React/Vite | Cloudflare Pages | Assets compilados en CI, publicación coordinada por Actions |
| API NestJS y Worker | Truobox Ubuntu LTS x86-64 | Dos servicios systemd, mismo paquete/versionado |
| Redis | Docker en Truobox | Persistencia, autenticación, loopback y política que preserve cuotas |
| Adaptador Gemini | Docker privado en Truobox | Imagen identificada por digest; perfil/sesión externos a la imagen |
| Host nativo Teacher/Codex, si se habilita | Truobox | Binario Linux/metadata identificados y protocolos compatibles |
| PostgreSQL | Northflank Free | Endpoint externo y puerto reales, TLS con certificado validado |
| Archivos, journal y backups | R2 conforme a contratos vigentes | Configuración de entorno exclusiva; privada RSA fuera del VPS |

Nginx es la entrada HTTPS del API; microservicios sólo accesibles desde Server con credenciales exclusivas conforme a ADR-008. Verificar cadena real de proxies, IP efectiva/rate limiting, límites de subida y SSE. Teacher conserva dominio/destinos canónicos según ADR092; no asumir que sólo un origen del Client basta para todas sus rutas.

Truobox: contratación comunicada y acceso SSH/inventario comprobados: Ubuntu 26.04.1 LTS x86-64, 4 vCPU/7.8 GiB RAM; panel ubica la instancia en Virginia. Plan y condiciones finales de facturación siguen por registrar. Sus precios publicitados equivalentes a prepago no son una cotización mensual. systemd no aporta failover entre máquinas; un único VPS concentra fallos. No dimensionar únicamente por el número de usuarios: medir también procesos IA, compilación, memoria, disco y backups.

## 3. Ramas y promoción de versiones

```text
feature/* o codex/* → PR → development → PR de promoción → master → despliegue
                            CI              CI             CI + CD
```

- **development:** rama predeterminada, destino de integración; sus pushes pasan CI y no despliegan producción. No hace falta desplegar un segundo ambiente en esta primera entrega. Una preview futura usará datos/secrets propios, nunca producción por defecto.
- **master:** promoción deliberada por PR; el merge solicitado por el operador dispara CD después de pasar las verificaciones del commit final. No añadir por defecto una segunda aprobación manual de despliegue que duplique esa decisión.
- Proteger ambas ramas mediante PR y check requerido `CI`, sin force-push ni borrado accidental. El primer circuito puede operarlo el único desarrollador: no imponer una aprobación de un segundo reviewer inexistente. Revisores/CODEOWNERS y cualquier excepción quedan explícitos según roles reales.
- Para promociones entre ramas largas usar **merge commit**, conservando ancestros; después integrar master de vuelta a development para mantener historia común y devolver hotfixes. No squash/rebase de la promoción periódica sin rediseñar ese flujo. Las PR de features pueden tener otra política de merge documentada.
- Hotfix: rama desde master, PR/CI a master y devolución a development. El pipeline no cambia permisos de negocio ni confirmaciones de NodiaAI.
- Migración de ramas propuesta: fijar SHA de main, reconciliar trabajo no publicado/advances, crear development sin perder commits, activar CI y cambiar predeterminada/referencias. Conservar main temporalmente hasta inventariar consumidores. Crear master desde el primer corte validado, con CD aún sin activar hasta tener destino y configuración comprobados. No copiar ciegamente el estado local ni borrar advances.

## 4. CI del monorepo

### Orquestación propuesta

Un workflow raíz `ci.yml` se dispara en PR a development/master y push a ambas. **No filtrar su evento por paths**: un job inicial `changes` calcula componentes y dependencias; después ejecuta jobs separados con su directorio de trabajo. Un job final requerido y estable llamado **CI** comprueba el conjunto aplicable.

El check final debe ejecutarse aunque otro job falle, rechazar fallos/cancelaciones de trabajos aplicables y aceptar skipped sólo para trabajos realmente no afectados. Fallo de detección, diff incompleto/base ausente o componente desconocido debe fallar cerrado o ejecutar todos los checks pertinentes, nunca un verde vacío. Si se habilita merge queue, añadir `merge_group` antes de usarla. No convertir mensajes skip-ci en una forma de omitir un required check.

En CI se puede cancelar una ejecución antigua de la misma PR. No usar esa política para una activación productiva ya comenzada. PR no confiables no reciben secretos ni permisos de despliegue; no ejecutar su código con credenciales mediante `pull_request_target`. Preferir runners hospedados; no instalar un runner público de PR en el VPS productivo.

### Mapa inicial de dependencias

| Cambio | Validación/rebuild candidato |
| --- | --- |
| `nodia-client/**` | Client; también validar referencias del conocimiento si corresponden, sin asumir Server inalterado |
| `nodia-server/**` | Server/API/Worker; host Rust adicional si cambian sus fuentes/locks/protocolo |
| `nodia-gemini-microservice/**` | Python/imagen; compatibilidad Server si cambia su contrato, más referencias de conocimiento |
| `docs/nodia-ai/knowledge/**`, registry y paths publicados referenciados | Compilador/pins y artefactos Server si cambian sus entradas; nunca publicar drafts por el despliegue |
| `docs/mvp/nodia-ai-v1-runtime-policy.json`, su schema, schema common-contracts y validadores consumidos | Server y checks de contratos; no tratarlos como documentación prescindible |
| `.github/**`, herramientas de release, contratos/infra compartidos | Validar pipeline y unidades afectadas; decidir de forma conservadora según dependencia real |
| Prosa administrativa sin consumo en build/runtime | Links/formato/documentación; no reiniciar servicios por rutina |

Este mapa es una propuesta a convertir en clasificador probado. El build Server lee también `docs/evidence/scripts/validate-nodia-ai-ai04.cjs` y las referencias exactas del registry/compiler. Usar checkout completo aunque un job trabaje dentro de un subdirectorio. Un path desconocido se revisa; no excluir todo `docs/**`. Un cambio sólo visual puede desplegar únicamente Client **si** la integridad/pin del Server permanece igual.

### Checks y artefactos por unidad

| Unidad | Comandos/garantías a concretar en Linux aislado |
| --- | --- |
| Client | `npm ci`, lint, Vitest, typecheck/build con su lockfile; Node compatible con `engines >=24.20.0`; assets y rutas SPA verificados |
| Server | `npm ci`, lint, Vitest, tipos de producción y build completo; checks de conocimiento/contratos/assets según dependencias |
| PostgreSQL/Redis | Integraciones puntuales con servicios desechables para migración desde cero, upgrades, transacciones, auth, reservas e idempotencia |
| Gemini | Dependencias fijadas, runner offline `run_tests.py` con `test_support`, compatibilidad instalada y build de imagen privada |
| Host nativo | Rust toolchain/Cargo.lock, fmt/clippy/tests y paquete Linux cuando sus fuentes/protocolo cambien |

Los comandos de tipo y suites deben comprobarse en el checkout candidato antes de declararlos gates. No ocultar errores de WIP con exclusiones generales ni usar el typecheck de producción como prueba de que todos los fixtures están bien. No añadir tests espejo ni recorridos de páginas por rutina: priorizar unidades de lógica y las integraciones de riesgo concretas.

CI rutinario usa configuración sintética sin `.env` operativo, proveedores falsos/offline y ningún secreto de inferencia. El runner Python existente instala su aislamiento antes del discovery; conservarlo. Las pruebas reales de proveedores/modelos/modos se ejecutan separadas conforme a plan91, con presupuesto e intención controlados; login, catálogo o build no prueban inferencia.

`npm run build` del Server incluye políticas, conocimiento y contexto; entregar **dist completo**, package.json ESM, dependencias runtime Linux y scripts operativos requeridos. Preservar el check de assets antes de que otro build pueda reparar ausencias. API/Worker y CLI de recuperación salen del mismo paquete. No existe actualmente un Dockerfile general Server. El empaquetado Linux nativo ya está implementado en ops/production: release exacto f01b493336883403a84b1c80759ce4fc43cbd370 construido y ensayado en un entorno desechable; esto no acredita adopción en Truobox.

## 5. CD desde master

### Un solo punto de coordinación

Propuesta: workflow `release-production.yml` sobre push a master, con CI requerido del **mismo SHA final** y artefactos construidos/verificados para ese commit. Reusable workflows pueden evitar duplicación. No tomar un verde de otro SHA o sólo del merge sintético de la PR como prueba de ese paquete. Los ficheros de workflow citados todavía no existen.

Comparar el candidato con el **manifiesto de versiones efectivamente desplegadas**, no sólo con HEAD anterior. Si una ejecución falló o quedó sustituida, la siguiente debe incluir los componentes pendientes. Registrar por unidad su SHA/digest, schema/migraciones y estado: una publicación parcial no puede quedar como release completo. Primer despliegue sin manifiesto requiere inventario y entrega íntegra.

Serializar producción mediante `concurrency` sin cancelación en curso **y lock de operador en el destino**. No asumir orden FIFO ni que todas las ejecuciones pendientes llegarán a correr. Un job nuevo reconsulta manifiesto y elegibilidad antes de tocar procesos; rechazar promociones obsoletas, salvo rollback explícito compatible. Publicar artefactos y descargar por identidad, sin `git pull`/build de producción en el VPS ni imágenes `latest` como identidad de release.

### Secuencia de entrega

1. Construir/probar componentes afectados y sus contratos; empaquetar manifiesto, hashes y artefactos desde fuentes versionadas del SHA final. Cachear descargas por lockfile/plataforma, nunca perfiles, secretos o estado de DB.
2. Transferir release a un directorio nuevo, con usuario de despliegue limitado y host SSH verificado por un canal confiable; no confiar en `ssh-keyscan` recién ejecutado como única autenticación del servidor. Imágenes por digest y binarios con metadata Linux comprobada.
3. Bajo lock, verificar espacio/RAM/versiones, configuración, conectividad DB/Redis, release activo, journal y recuperación. Distinguir **primera instalación** de **actualización**. En actualización, preparar backup con escritores vigentes verificables **antes de detenerlos**: el runner actual exige API/Worker activos en el paquete correcto. En instalación nueva, comprobar que el destino está realmente vacío, preparar journal/configuración y ejecutar el bootstrap controlado probado; acreditar el primer backup y restore aislado cuando escritores/recuperación estén operativos, antes de abrir el piloto a stakeholders. Ausencia de manifiesto no demuestra BD vacía: si contiene datos, inventariar procedencia y recuperación y obtener el respaldo apropiado antes de modificarla; no improvisar un bypass del runner. El manifiesto debe resolver los servicios como `nodia-api.service` y `nodia-ai-worker.service`, no copiar el nombre histórico `nodia-server.service`.
4. Preparar mantenimiento/drenaje para el alcance necesario; no matar inferencias desconocidas y asumir que se cancelaron remotamente. Preservar fences, journals y estado de recuperación. No prometer cero downtime en un VPS único.
5. Aplicar migraciones pendientes una vez con el artefacto validado y credencial apropiada; sin recompilar durante el corte. La ruta actual `migration:run` recompila: preparar y verificar un comando para el paquete inmutable. `db:setup` pertenece a primera instalación, no al deploy rutinario. Nunca `synchronize:true`.
6. Activar coordinadamente API y Worker del mismo paquete. Si cambian protocolo/servicio interno/host nativo, respetar compatibilidad y orden registrados; no reiniciar componentes intactos ni destruir volúmenes/perfiles.
7. Comprobar readiness real, versiones y smoke externo autenticado sin efectos comerciales/inferencia automática. Un HTTP200 raíz sólo prueba liveness; DB/Redis y readiness del release siguen siendo trabajo pendiente.
8. Si corresponde, publicar el artefacto Client en Pages después de que el backend compatible esté listo. Mantener compatibilidad con clientes antiguos que sigan abiertos/en caché; no prometer atomicidad entre Pages y VPS. Cambios incompatibles requieren plan de transición, no sólo ordenar jobs.
9. Registrar versiones por componente, resultado, ventana/interrupción y evidencia sin secretos. Liberar lock y reactivar timers comprobando sus estados. Un fallo conserva diagnóstico y la versión realmente activa.

Los cambios exclusivamente frontend omiten el mantenimiento/reinicio/migración del Server cuando el mapa y el manifiesto lo demuestren. Una ejecución manual de recuperación puede seleccionar un artefacto previamente verificado desde master; no aceptar código arbitrario de development/PR con secretos de producción ni repetir efectos inciertos.

### Cloudflare Pages

Preferir publicación de assets precompilados mediante [Direct Upload/Wrangler desde Actions](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/) para compartir gates/orden con VPS. Comprobar si ya existe proyecto Git-integrated, su rama productiva y la ruta soportada para controlar auto-deploy; no prometer convertir el tipo del proyecto en sitio. Evitar dos mecanismos publicando lo mismo. Root lógico `nodia-client`, salida real comprobada, producción master y variables públicas por entorno; ningún secreto DB/API-key en `VITE_*`.

### Rollback

Retener artefacto anterior y comprobar compatibilidad con esquema actual. Rollback de código/Client no equivale a restaurar datos; no ejecutar automáticamente `migration:revert`, borrar volúmenes ni restaurar DB si falla un smoke. Restauración exige procedimiento aislado, journal externo y conciliación de borrados para no resucitar información ni reejecutar inferencias. La política NodiaAI actual conserva siete días, no 30 por defecto. [Operador de backups](../../ops/nodia-ai-backups/README.md).

## 6. Lista de pendientes en orden de ejecución

### P01 — Inventario y decisiones de destino

- [x] Registrar Truobox productivo, Northflank Free para piloto con stakeholders y flujo development/master.
- [x] Inspeccionar repositorio GitHub/local y dependencias de build; documentar diferencias con lo deseado.
- [x] Registrar contratación de Truobox y verificar Ubuntu 26.04.1 LTS, recursos efectivos y acceso administrativo por clave.
- [ ] Registrar condiciones finales de facturación/plan y región contratados.

- [ ] Inspeccionar Northflank Free efectivo, seguridad, endpoint/puerto/TLS, cuotas, backups y condiciones de costos. Conservar elección del usuario sin upgrades automáticos.
- [ ] Definir dominios de Client/API/Teacher, cuenta/proyecto Pages y R2; inventario de datos a crear y usuarios autorizados, sin copiar datos privados del laboratorio por defecto.

### P02 — GitHub y ramas

- [ ] Reconciliar inventario histórico main/advances con development/master actuales, trabajo pendiente e integraciones, sin pérdida de historia ni promoción automática.
- [ ] Verificar development como rama predeterminada y actualizar referencias, templates, badges, permisos y PR existentes.
- [ ] Crear/verificar check estable CI y después reglas de PR/protección; comprobar un fallo real bloqueante y una PR sólo documental que no quede pendiente.
- [ ] Configurar entorno production limitado a master, variables/secrets mínimos y permisos por job. Revisar protecciones disponibles en el plan real; no exigir reviewer adicional por defecto.

### P03 — CI y paquetes reproducibles

- [ ] Implementar clasificador de cambios y reusable workflows por unidad; probar cambios client-only, shared-docs, Server, Python, Rust, renombres/borrados y diff no disponible.
- [ ] Fijar versiones compatibles de Node/Python/Rust/CLI, acciones por SHA revisado y locks; especificar base Linux/arquitectura y dependencias nativas del paquete.
- [ ] Ejecutar checks acordados en Linux limpio, PostgreSQL/Redis desechables y transporte offline de IA; separar calificación real.
- [ ] Construir y validar paquetes, manifiesto de componentes, assets, scripts recovery y comandos efectivos de arranque/migración.

### P04 — Infraestructura y secretos

- [x] Preparar usuario administrativo por clave, usuario de ejecución sin privilegios, firewall y puertos externos; root/password SSH restringidos y conexión administrativa alternativa comprobada.
- [x] Completar Redis inicial privado: autenticación, conexión del host, persistencia tras recreación e inaccesibilidad externa ([evidencia](../evidence/production-redis-20261110-r01.json)). API/Worker usan Redis; recuperación integral ante caída, backup Redis, carga/OOM y alertas siguen pendientes.
- [x] Instalar/adoptar API y Worker systemd en el mismo release/cwd, entorno privado fuera del paquete y servicios active/enabled.
- [ ] Ensayar drenaje/parada con trabajo activo, reinicio efectivo, recuperación de dependencias y adaptadores internos por su alcance.
- [x] Verificar TLS PostgreSQL en Node, instalación y recuperación sin desactivar certificados. Backup/journal usan database.tls verify-full/CA; captura real con cliente 16 y restore aislado pasados. Revisar pools/timeouts bajo carga y separación de roles según el uso real.
- [x] Publicar HTTPS IP mediante Nginx, TRUST_PROXY loopback y CORS exacto; verificar TLS externo, 200/OPTIONS 204/401 y bloqueo externo de 3000/6379.
- [ ] Verificar Google OAuth/cookies/refresh reales, comportamiento entre Pages y API por IP, límites de upload y alertas de expiración/renovación. No se acredita SSE/WebSocket por deshabilitar buffering.
- [x] Provisionar configuración y secretos fuera de Git/imágenes/logs, sin copiar perfiles personales ni cambiar modelos/proveedores.
- [ ] Crear y comprobar segunda copia offline de RSA privada y sobre cifrado de configuración; custodia primaria del PC ya verificada.
- [ ] Completar y verificar la rotación de las credenciales PostgreSQL compartidas durante el aprovisionamiento antes de abrir el acceso a stakeholders; el usuario autorizó posponerla durante estas comprobaciones.

### P05 — Instalación y operación

- [x] Ensayar primera instalación del release exacto master f01b493336883403a84b1c80759ce4fc43cbd370:45 migraciones/68 tablas de entidades, bootstrap, repetición y rechazos controlados; PostgreSQL16.15/Redis desechables y recursos retirados ([evidencia](../evidence/production-first-install-20261111-r01.json)).
- [x] Completar primera instalación real f01 y adoptar releases/current con identidad verificada, preservando incidencias y reconciliación READ ONLY ([recibo](../evidence/production-first-install-20261111-r01.json)).
- [ ] Ensayar upgrade de una siguiente release y compatibilidad de rollback en PostgreSQL desechable; no reutilizar la receta de primera instalación.
- [x] Comprobar dependencias DB/Redis, versión efectiva, rotación de logs Docker y jobs/timers instalados/habilitados.
- [ ] Completar métricas/alertas de servicios, backups, retención, espacio y certificado; ensayar fallos y recuperación de uploads.
- [x] Capturar backup cifrado real ready en R2, privada fuera del VPS, restore aislado con fingerprints y preparación en cuarentena sin dispatch/release; journal conciliado y timers habilitados ([recibo operativo](../evidence/production-backend-live-20261112-r01.json)).
- [ ] Observar ejecución programada y comprobar alertas de fallo/retención; un primer backup manual no las acredita.
- [ ] Reconciliar hallazgos de revisión19 con cierres posteriores y features realmente incluidas; no tratar diagnósticos históricos como pendientes actuales sin verificar ni aprobar todo por un build verde.

### P06 — Despliegue y aceptación del piloto

- [ ] Implementar CD/lock/manifiesto, migración única, promoción Pages y manejo de fallo parcial; ensayar dos releases consecutivos y rollback compatible.
- [x] Publicar la primera entrega f01 del backend y frontend; transporte HTTPS/CORS,401 sin sesión, puertos privados y hashes del Client comprobados.
- [ ] Aceptar auth/refresh/aislamiento de ambos usuarios, errores DB/Redis, reinicio y actualización de versión; no confundir publicación con aceptación funcional.
- [ ] Calificar selecciones/modos IA habilitados en el entorno objetivo conforme a plan91; un bloqueo limita el alcance de la feature y no se oculta con un proveedor de respaldo.
- [ ] Probar migración con trabajo activo/drenaje, despliegues superpuestos, ejecución obsoleta, desconexión SSH y recuperación sin replay. No reutilizar un resultado remoto unknown como éxito o permiso de retry.
- [ ] Registrar feedback, consumo/latencia y capacidad real. Definir señales observables para migrar PostgreSQL: cuota/conexiones, latencia sostenida, necesidad de restore/disponibilidad y condiciones del servicio; no inventar umbrales antes de medir.

**Primer paso incompleto:** ver funcionar el frontend publicado y verificar Google login/cookies/refresh, acceso e aislamiento reales. Después retomar CI/CD, logs, monitoreo, revisión de errores y seguridad; la rotación PostgreSQL pospuesta debe completarse antes de abrir stakeholders. Backup/restore inicial, proxy HTTPS y activación de servicios/timers están cerrados con el alcance del [estado vigente](#estado-vigente-confirmado--2026-11-12-utc). Quedan segunda copia offline, alertas, recuperación integral ante fallos, CI/CD y aceptación de features/IA. La prueba cliente 18 hacia servidor 16 falló por SET transaction_timeout: captura/restore efectivos usan major 16 con exit-on-error, sin editar archivos ni ignorar errores. Los cortes anteriores, incluido unsafe_probe_unit_cleanup y su reconciliación sin replay, se conservan en [primera instalación R01](../evidence/production-first-install-20261111-r01.json); el [recibo operativo](../evidence/production-backend-live-20261112-r01.json) registra el cierre posterior.

### Continuidad para la próxima sesión

Retomar los checkboxes abiertos sin repetir instalación, bootstrap, custodia o restore ya verificados. P02/P03 deben partir del inventario GitHub actual: master f01 ya existe y hay trabajo development separado; main/advances pertenecen a la inspección histórica. CI/CD requiere clasificador por componentes, checks y promoción reproducible; no activar despliegues por el mero nombre de una rama.

Este plan centraliza los pendientes **de producción y CI/CD**, no certifica un inventario exhaustivo de todas las features del proyecto. Para los pendientes funcionales, bloqueos y evidencias vigentes, consultar primero [progreso general](00-progress.md) e [índice del MVP](README.md), y después el checklist de cada feature. Reconciliarlos en P05 según el alcance real del piloto; no dar por resueltos OCR, Teacher u otros gates por terminar el pipeline. El workflow CI está preparado en development según §9; CD y protecciones de GitHub siguen pendientes.

La limpieza y centralización solicitadas el 2026-11-09 se siguen en [plan100](100-repository-cleanup-and-documentation-consolidation-plan.md). Pueden avanzar en paralelo; el empaquetado CI/CD debe excluir salidas/secretos y resolver cualquier dependencia mantenida en temporales antes de retirarla. Consolidar historia no es un requisito para declarar todas las features listas ni un motivo para borrar evidencias de aceptación.

## 7. Estado documental y conocimiento NodiaAI

Destino productivo, PostgreSQL Free para stakeholders y nombres/función de ramas son decisiones explícitas del usuario. El ADR097 y este diseño siguen propuestos/en revisión; no se atribuye aprobación a otros ADR o gates existentes. Los documentos de ensayo inferiores quedan históricos para el objetivo de lanzamiento.

Evaluación de impacto: operación/entrega del software, sin nueva herramienta ni contrato funcional NodiaAI. No publicar conocimiento nuevo por cambiar hosting. Cuando una implementación altere configuración, disponibilidad, recuperación o contratos, actualizar sus fuentes/fichas conforme al estándar y distinguir implementación de calificación real. Build/deploy no amplían autoridad, no habilitan ventas mutables y no reactivan Web.

## 8. Primer acceso y despliegue en Truobox

Secuencia histórica preparada el 2026-11-09 tras confirmar la compra. Se conserva como trazabilidad educativa del aprovisionamiento; las instrucciones y pendientes de cada corte no sustituyen el estado vigente del 2026-11-12 ni autorizan repetir primera instalación sobre la DB existente. No pedir contraseñas ni claves privadas por chat.

### A. Acceso e inventario, antes de modificar el host

Desde PowerShell del operador, reemplazar los placeholders con los datos reales del proveedor:

```powershell
ssh -p PUERTO USUARIO@HOST_DEL_VPS
```

En la primera conexión, contrastar el fingerprint con un canal confiable del proveedor, por ejemplo la consola autenticada de la instancia; no aceptar un cambio inesperado ni desactivar `StrictHostKeyChecking`. Una entrada previamente guardada tampoco acredita por sí sola que corresponda a esta máquina.

Dentro de Ubuntu, obtener únicamente inventario, sin imprimir configuración de la app ni secretos:

```bash
cat /etc/os-release
uname -m
nproc
free -h
df -h /
timedatectl status
sudo ss -lntp
sudo ufw status verbose
```

Registrar versión/arquitectura, recursos, puertos ocupados y puerto SSH efectivo. Consultar si cloud-init sigue ejecutándose antes de modificar paquetes. Comprobar que la consola de recuperación del proveedor funciona y si hay firewall externo además de UFW. No ejecutar `ops/lab/remote.py`: su identidad, clave y restricciones pertenecen a la VM privada del laboratorio.

### B. Preparación y activación en orden

1. **Host:** completar actualizaciones iniciales y reinicio si corresponde; crear usuario administrativo con clave pública y usuario de ejecución sin privilegios. Probar una segunda sesión del administrador antes de restringir root/password. Preparar firewall conservando el puerto SSH real y abriendo 80/443 cuando corresponda. No aplicar un script de hardening a ciegas que pueda cortar el acceso.
2. **Herramientas y estado:** instalar Node compatible con el release, Docker Engine/Compose y Nginx desde fuentes oficiales para el Ubuntu efectivo. Preparar directorios de releases, configuración y datos; secretos fuera del paquete y permisos acotados. No dar acceso al socket/grupo Docker al usuario de la API. Construir en Linux aislado, no en el VPS productivo.
3. **Redis:** instalación inicial y reparación completadas; [evidencia R01](../evidence/production-redis-20261110-r01.json). Redis 7.4.12 Alpine fijado por digest, bridge dedicado `template_redis_private`, listener exclusivo `127.0.0.1:6379`, contraseña aleatoria sólo en destino, AOF everysec, maxmemory 256 MiB/noeviction, límite de contenedor 1 GiB y vm.overcommit_memory=1. El primer intento falló por publicación en red internal; resume-network conservó volumen y credenciales y superó autenticación, configuración efectiva, conexión TCP del host, Lua y clave temporal persistida tras recreación. Desde el PC, 22/443 conectan y 6379 agota timeout; alcance limitado a esa red/instante. No acredita integración API/Worker ni backup/alertas/carga. RATE_LIMIT_STORAGE=redis obligatorio. Gate de recuperación: limiter reconecta y devuelve 503 durante indisponibilidad, caché actual abandona tras tres intentos; probar/resolver recuperación integral antes del piloto.
4. **Northflank:** el usuario autoriza probar sólo lectura con las credenciales actuales y pospone rotación/revocación hasta antes de stakeholders. Public/TLS ya permite conectar desde Truobox al hostname `primary.nodia-db--8hqb8b7kvmx4.addon.code.run`, puerto externo29102 (5432 interno): DNS35.193.113.78, TCP y TLS1.3 con cadena/SAN validados por OpenSSL en el ensayo inicial sin credenciales. Desde PC de otra IP también responde al SSLRequest. El usuario informa que Security rules/IP policies requiere plan de pago en su cuenta; mantener Free, sin fingir allowlist ni cambiar plan. [Evidencia de transporte](../evidence/production-postgres-20261110-r01.json). [Prueba psql](../../ops/production/README.md#conexión-postgresql-de-sólo-lectura): cliente18.6 instalado; primer intento detenido por fallo DNS antes de autenticar/consultar SQL. DNS/TLS se recuperaron después (causa sin confirmar). Helper corregido con DNS/TLS antes de credenciales y PGHOSTADDR sólo por ejecución (hostname verificado, sin IP fija) reejecutado satisfactoriamente. psql confirma PostgreSQL16.14, wal_level replica, in_recovery=false, READ ONLY=on y backend TLS1.3; cero tablas de usuario según catálogos, sin acreditar baseline ni permiso automático para migrar. Password privada por TTY, verify-full/CA del sistema y consultas de metadatos en READ ONLY/ROLLBACK. No usar admin ni tratar cero tablas como baseline. Acreditar después runtime Node/Worker/CLI/journal, sin desactivar TLS. El contrato TLS explícito del runner de dumps y la conciliación ya fue implementado/probado localmente; aún falta provisionarlo y aceptar recuperación real en este destino.
5. **Release e instalación:** PR1 integrada en master f01b493336883403a84b1c80759ce4fc43cbd370; paquete backend-f01b49333688-ff33b6fdbbbc de fuente Git sin overlays construido, verificado y ensayado localmente (45 migraciones/68 tablas, bootstrap e idempotencia), extraído en candidates del VPS y dependencies_verified a 2026-11-11T23:29:20.969202+00:00; pendiente inventario real de instalación ([evidencia](../evidence/production-first-install-20261111-r01.json)). Como antecedente, candidato Linux preparado/verificado, copiado y extraído en /opt/nodia/candidates, sin activarlo: [evidencia](../evidence/production-backend-preparation-20261111-r01.json). Fuente base master ba8ebfa00b55f103465d0ab533a802152944d224 con tres overlays draft de documentación que corrigen seis rutas ignoradas; deployment_eligible=false en ese candidato histórico; la restricción de overlays quedó resuelta en el release Git nuevo tras versionar/promover esos cambios. Build/lint/contratos/conocimiento/unidades offline/nativos e inventario/hash/modos del tar comprobados; no equivale a primera instalación o aplicación operativa. Configuración privada guardada por el operador (bucket de archivos nodia-production y correo de bootstrap definido, sin publicar valores personales/secretos). Preparar artefacto completo identificado por SHA/digest, con dependencias Linux, `dist`, assets/políticas/conocimiento y scripts de operación. El build depende de entradas en la raíz/docs del monorepo. Probar instalación vacía con migraciones vigentes y bootstrap en PostgreSQL desechable antes de aplicar al destino; configurar el correo real del primer superadministrador. Usar primera instalación de P05, no reinstalar ni borrar una DB para solucionar un fallo. No importar datos/perfiles IA del laboratorio por defecto.
6. **Procesos y recuperación:** usuario nodia UID/GID900, nologin/contraseña bloqueada, sólo grupo nodia, directorios con permisos verificados y unidades instaladas disabled/inactive; [verificación consolidada](../../ops/production/README.md#baseline-de-identidad-y-unidades--2026-11-10). Runtime.env/recovery.json guardados privadamente y comprobados por el validador Node; PostgreSQL READ ONLY con verify-full/TLS1.3, Redis AUTH/PING y R2 HEAD superados como nodia. Reejecución final dependencies_verified, sin units temporales ni current; el falso fallo previo de limpieza quedó corregido y cubierto por 12 pruebas. Journal, permisos de escritura R2/restore y release desplegable aún pendientes; no se inicia la app por crear units. API mediante `node dist/main.js` y Worker mediante `node dist/nodia-ai-worker.js`, en servicios systemd `nodia-api`/`nodia-ai-worker` con mismo paquete/cwd y entorno productivo. El Worker es un proceso continuo sin listener HTTP; su parada debe permitir el drenaje vigente. Impedir acceso externo directo a 3000; el código actual no fija host loopback. Adaptadores internos privados según ADR008. Configurar journal/backup y ensayar restore aislado antes de abrir stakeholders; un PID activo o GET raíz no demuestra readiness DB/Redis.
7. **HTTPS y Client:** definir DNS del API, emitir/verificar certificado y preparar Nginx con rutas `/api/v1`, SSE, límites y `TRUST_PROXY` acordes a la cadena real. Configurar orígenes HTTPS exactos, OAuth y cookies según dominios reales. Actualizar `VITE_API_URL` con la URL completa del API y recompilar/publicar Client; no incluir credenciales de DB en variables Vite. Verificar login y acceso de ambos stakeholders, además de reinicio y fallos de dependencias.
8. **Automatización:** materializar ramas/checks/artefactos y Actions por dependencias según P02/P03/P06, ensayar una entrega controlada y sólo entonces activar CD. Mantener deshabilitado auto-deploy nativo de Pages. El primer despliegue y los siguientes comparten el mismo formato de paquete y manifiesto; no crear un camino manual sin versionado que luego Actions no pueda reproducir.

La auditoría estática inicial descrita arriba no habilitó servicios ni acreditó dependencias. Las comprobaciones posteriores de runtime/TLS/backup/restore y publicación sí se ejecutaron y se registran en el estado vigente y sus recibos. GET /api/v1 sigue siendo liveness; el alcance funcional IA exige su calificación propia de plan91, además de infraestructura disponible.

## Fuentes de plataforma

- [GitHub: sintaxis y filtros](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax) y [required checks](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks).
- [GitHub: concurrencia](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency) y [ramas protegidas](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches).
- [Cloudflare: CI y Direct Upload](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/).
- [Ubuntu: OpenSSH](https://ubuntu.com/server/docs/how-to/security/openssh-server/), [firewall](https://ubuntu.com/server/docs/how-to/security/firewalls/) y [Docker Engine en Ubuntu](https://docs.docker.com/engine/install/ubuntu/).
- [node-postgres: TLS](https://node-postgres.com/features/ssl), [PostgreSQL: verify-full](https://www.postgresql.org/docs/16/libpq-ssl.html) y [Northflank: acceso y certificados](https://northflank.com/docs/v1/application/databases-and-persistence/access-a-database).
- [Truobox](https://www.truobox.com/vps-barato/), [Northflank Sandbox](https://northflank.com/docs/v1/application/billing/pricing-on-northflank) e [Instabox max-run](https://instabox.sh/docs/machines/auto-pause).

## 9. CI preparado en development — 2026-11-12

El workflow [.github/workflows/ci.yml](../../.github/workflows/ci.yml) y la
[guía ejecutable](../../ops/ci/README.md) quedan en el checkout actual development,
sin commit de esa rama ni promoción a master. Se preservan los cambios de Teacher
y el resto del trabajo previo. Una PR auxiliar de validación se cerró sin integrar;
master y el release f01 del VPS/Pages no se modificaron.

Eventos preparados: push a development/master; PR dirigidas a esas ramas;
manual cuando el workflow esté disponible en GitHub. Las ramas feature no duplican
un evento push adicional. Detector por diff Git completo y dependencias de ambos
commits, con renombres/borrados; docs no compiladas pueden omitir builds. Las fichas,
evidencias o fuentes efectivamente compiladas activan sus consumidores. No se usa el
límite parcial de archivos de la API para autorizar skips. El check estable CI falla
si falta el detector, si los outputs son inválidos o si un componente seleccionado
no terminó correctamente; skipped sólo se acepta para componentes no afectados.

Client y Server compilan TypeScript una vez por componente/ejecución, exclusivamente
en npm run build. Vitest no añade typecheck y los lectores Node reutilizan dist;
no se invocan wrappers de integración que vuelvan a compilar. Client cubre sus tests
con tsc -b; Server conserva el alcance productivo de tsconfig.build y no promete
tipado estático de specs. Lint y pruebas de comportamiento siguen siendo checks
distintos. Vitest usa dos workers; build Node limita heap a4GiB y Cargo compila con
un job. Native conserva features por defecto y pruebas contra Wiremock local;
Python usa run_tests.py con aislamiento previo al discovery. El smoke PostgreSQL
usa una base Docker desechable, no Northflank.

La primera ejecución auxiliar de GitHub es
[43229534436](https://github.com/oscarvalenzuela25/Nodia/actions/runs/43229534436):
selector/actionlint y Python pasaron; Client/Server pasaron lint y build. El host
Rust completo pasó sus11tests de fixtures locales. El run global quedó en failure
por4expectativas Client y5casos Node históricos/desfasados; no se ocultan esos
fallos ni se interpreta el run como aceptación productiva. Las correcciones se
verificaron localmente y se dejan en development, sin otro push ni PR. La ejecución
integral de la versión corregida/Teacher pendiente tendrá su SHA cuando el usuario
termine y suba sus cambios. [Recibo de esta fase](../evidence/production-ci-20261112-r01.json).

GitHub confirmó el repositorio público. Los runners Linux estándar no consumen la
bolsa privada de minutos según la documentación vigente; no se consultó ni inventó
saldo de facturación personal. No se contratan larger runners, no se cambian budgets
y no se suben artefactos en esta primera fase. Cachés npm/pip/Cargo y almacenamiento
tienen su alcance y límites propios. CD, secretos de deploy y protecciones de ramas
siguen pendientes. CI no conecta con el VPS, Pages, R2, Northflank ni cuentas IA.


## 10. Datos y preparación para CD — 2026-11-12

El usuario confirma creado/configurado el environment GitHub `production`.
Confirmación reportada, sin inspección remota de sus reglas: aún no se acredita
la restricción a master ni la presencia/validez del token y las variables.
El usuario confirma después guardadas las variables CLOUDFLARE_ACCOUNT_ID y
CLOUDFLARE_PAGES_PROJECT_NAME dentro del entorno. Sus valores no se han consultado.
El usuario confirma guardado CLOUDFLARE_API_TOKEN como secret del entorno.
No se ha leído ni probado el secreto: la validez remota sigue pendiente. El
usuario confirma después VITE_API_URL/VITE_GOOGLE_CLIENT_ID agregados y production
restringido a master; son confirmaciones reportadas, sin inspección remota. Se prepara el preflight de lectura descrito
en §11, sin publicar ni promover cambios.

Las ramas son exclusivamente development (integración/CI) y master (producción).
El código del CD se preparará en development; no promover ni publicar cambios
hasta que el usuario los integre en master y el CI del SHA final sea satisfactorio.

Datos ya registrados: VPS 166.0.112.187:22, administrador nodia-admin, usuario de
runtime nodia; API https://166.0.112.187/api/v1; Pages proyecto nodia y URL
https://nodia-1ge.pages.dev. PostgreSQL/Redis/R2 y secretos runtime permanecen en
el VPS; no pedir ni copiar sus contraseñas a GitHub para desplegar el paquete.

Pendientes de credenciales y configuración:

- Cloudflare: identificar/revalidar el Account ID y crear token exclusivo para
  CD con permiso Account / Cloudflare Pages / Edit en la cuenta destino. Guardar
  CLOUDFLARE_API_TOKEN como secret; Account ID y proyecto pueden ser variables.
  El usuario reporta guardados Account ID/proyecto/token; la autenticación
  interactiva anterior de Wrangler no autentica un runner nuevo y el permiso
  efectivo de publicación sigue sin comprobarse.
- Frontend: reutilizar VITE_API_URL y comprobar VITE_GOOGLE_CLIENT_ID públicos
  de producción antes de construir; las variables existentes de Pages no se
  transfieren automáticamente al runner. No usar secretos en VITE_*.
- VPS: preparar usuario de despliegue separado (propuesto nodia-deploy), clave
  SSH exclusiva de Actions y host key contrastada por el acceso administrativo
  existente. La clave/pin ya se prepararon fuera de Git y el instalador de
  identidad de §12 quedó aplicada y SSH verificado según §12.2. Falta guardar
  el acceso en GitHub quedó reportado como guardado según §13. No conceder
  sudo genérico; el updater sigue pendiente.
- GitHub: environment production y Account ID/proyecto/token reportados como
  configurados, incluidas variables Vite y restricción master reportadas por el
  usuario. La comprobación remota sigue pendiente; no se activó CD.

Trabajo técnico que no se resuelve entregando credenciales: adaptar el paquete
Linux y el procedimiento de actualización (los helpers iniciales no son CD),
reutilizar el artefacto ya validado sin un segundo build/TypeScript, comparar con
versiones realmente desplegadas, backup previo, migración controlada, lock,
activación coordinada API/worker y readiness. No revertir datos automáticamente.
Client sólo publica Pages si ese componente lo requiere; backend sólo actualiza
el VPS cuando el manifiesto y las dependencias lo requieren. El CD todavía no existe.

Fuentes: [Pages con CI](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/),
[environments GitHub](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments),
[secrets GitHub](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets).


## 11. Preflight de acceso Pages preparado — 2026-11-12

El usuario confirma guardado el secret CLOUDFLARE_API_TOKEN en production. Sólo
se acredita su reporte; ni su valor ni el permiso remoto se han comprobado.
Se añade .github/workflows/check-production-pages.yml y el helper
ops/ci/check-pages-access.mjs. El workflow es manual, restringe el ref master y
usa environment production; no crea releases, compila ni publica. CI ahora valida
ambos workflows y sus pruebas offline. Todo continúa sin commit en development.

La consulta única GET requiere coincidencia con el proyecto Git-integrated nodia,
subdominio nodia-1ge.pages.dev y producción master, autodeploy false y previews
none. Falta el ensayo remoto; Read también autoriza el GET, por lo que un éxito
no demostraría permiso de upload/Edit. No se vuelcan respuestas/errores remotos,
variables del proveedor ni secretos. [Guía de ejecución y límites](../../ops/ci/README.md#preflight-manual-de-cloudflare-pages).

Verificación local: siete casos del comprobador pasados; suite ops/ci total27,
26pass/1skip de nombre con salto de línea en Windows; actionlint1.7.12 pasa ambos
workflows. No se ejecutó otro build ni TypeScript ni se conectó a Cloudflare/VPS.
[Recibo de preparación](../evidence/production-pages-preflight-20261112-r01.json).

El usuario confirma completadas las variables VITE_API_URL/VITE_GOOGLE_CLIENT_ID
y la regla de rama master en production. No se han inspeccionado remotamente.
Siguiente preparación: identidad SSH exclusiva para Actions según §12.
La ejecución del preflight espera el commit del usuario en development y su
integración posterior en master; no pedir ni realizar una promoción anticipada.
GitHub requiere el workflow en la rama predeterminada para ejecución manual.
No se añade CD automático por preparar el comprobador. Su implementación seguirá
la secuencia/compatibilidad/artefactos de §5, sin otro build TypeScript en CD.


## 12. Identidad SSH de Actions preparada — 2026-11-12

El usuario reporta variables públicas Vite y production sólo para master ya
configurados. SSH administrativo existente verificado con host checking estricto:
API/worker continúan active y current=f01. sudo -n exige autenticación privada;
no se intentó leer/usar contraseñas ni modificar sudoers para evitarla.

Se generó Ed25519 exclusiva en el PC fuera de Git:
C:/Users/Oscar/.ssh/nodia-actions-production y .pub. La privada queda con ACL
restringida al usuario; no se imprimió ni se envió al VPS/GitHub. La host key
ED25519 pública se obtuvo mediante la conexión administrativa ya validada, sin
ssh-keyscan, y se guardó en .ssh/nodia-actions-production.known_hosts.
Fingerprints y hashes públicos en el recibo; no contienen claves privadas.

El helper [bootstrap-deploy-identity.py](../../ops/production/bootstrap-deploy-identity.py)
está copiado en /home/nodia-admin/nodia-setup/cd con la clave pública, ambos
modo0600 y hashes iguales al PC. El primer intento root se detuvo antes de
crear nada por invalid_public_key_file; corrección CRLF copiada/verificada según
§12.1. Después se completó la creación y la prueba real de §12.2.

El helper crea nodia-deploy con contraseña bloqueada, grupo propio y home/keys
root-owned. Una clave authorized_keys con restrict y forced command sólo permite
status a un gateway Python -I root-owned; rechaza comandos arbitrarios/SFTP,
sin conceder sudo ni habilitar uploads/deploy. No modifica SSH/firewall ni
reinicia procesos. sudo_grant_created=false acredita que no crea grants,
no una auditoría exhaustiva de reglas sudo externas. El instalador valida
estado existente sin sobrescribir divergencias. Ejecutar una sola instancia;
una interrupción requiere revisar estado, sin autorreparación ni rollback.

Ensayo en Ubuntu26.04 desechable:26comprobaciones con sshd/cliente reales en
loopback; status aceptado, comandos/otra clave rechazados, archivos root-owned
no editables por la cuenta, grupo propio, repetición exacta y rechazo de otro
pubkey/hash. Contenedor eliminado al terminar; no se montaron secretos del PC.
La revisión independiente no encontró bloqueadores; señaló la ejecución única
y el límite sobre sudoers. Esto no sustituye la prueba posterior en el VPS.

Bloque listo para el operador en Warp como nodia-admin:

```bash
sudo python3 -I /home/nodia-admin/nodia-setup/cd/bootstrap-deploy-identity.py --public-key /home/nodia-admin/nodia-setup/cd/nodia-actions-production.pub --public-key-sha256 a308de574e3b951e7d80d6d579d8738f2dcea39b56f41241d0d2970bac7288e4
```

Requiere sudo privado del usuario para crear la cuenta/archivos protegidos.
Después verificar por SSH nuevo status y rechazo de comandos antes de cargar
la clave privada como VPS_SSH_PRIVATE_KEY en GitHub production. Variables
previstas: VPS_HOST, VPS_PORT, VPS_USER y VPS_KNOWN_HOSTS. Todavía no se da por
configurado ninguno de esos valores en GitHub ni por implementado el CD.
[Recibo de preparación](../evidence/production-deploy-identity-preparation-20261112-r01.json).


### 12.1. Corrección del parser CRLF antes de aprovisionar — 2026-11-12

El operador obtiene invalid_public_key_file. Diagnóstico de lectura confirma que
OpenSSH Windows generó la .pub con una terminación CRLF:107bytes, un CR/un LF.
PC y VPS tienen exactamente el hash a308de574e3b951e7d80d6d579d8738f2dcea39b56f41241d0d2970bac7288e4.
El hash era correcto; el parser original rechazaba cualquier CR. No es un fallo
de la clave ni de su contraseña. El rechazo ocurrió antes de crear home,
usuario o gateway: se verificó que los tres estaban ausentes.

El parser corregido acepta una sola terminación LF o CRLF opcional; rechaza
CR interno, líneas adicionales, opciones inyectadas, otro algoritmo o wire format
inválido. El hash sigue comprobándose sobre bytes originales antes del parseo.
No se regeneró ni normalizó la clave pública/privada y su fingerprint se conserva.

Pruebas:4unidades de formato pasadas; integración Ubuntu26.04 con SSH loopback
ampliada a28checks, incluyendo la .pub CRLF, repetición vía LF y bytes intactos.
El parser también aceptó en modo de lectura la .pub real del PC. El helper
corregido está copiado modo0600 y hash PC/VPS f5c780dce11a302b25118703bf9ca9720fd5f2a0accd33cea2632fb4e472144f.
Los hashes del recibo R01 se conservan como bytes históricos; el corte actualizado
está en [recibo R02](../evidence/production-deploy-identity-correction-20261112-r02.json).

En una lectura inicial systemctl is-active mostró worker inactive; dos consultas
posteriores de propiedades verifican API/worker active/running, Result=success;
worker NRestarts=0 en la primera de ellas. No se identificó la causa de esa
observación inicial ni se reinició servicio alguno. No atribuirla al parser,
que se detuvo antes de modificar el servidor.

Siguiente bloque del operador: repetir el mismo comando de §12; sólo cambió el
helper. El usuario de despliegue y la autenticación nueva siguen pendientes.


### 12.2. Identidad creada y SSH real verificado — 2026-11-12

El usuario ejecutó el helper corregido y reporta identity_prepared para
nodia-deploy, fingerprint SHA256:g3gyUmcKBJmtgjFvcWiQeJXwZfxMET7YKRmOxTSKzpg.
Después se probó desde el PC la clave nueva, con IdentitiesOnly/BatchMode y
host checking estricto usando el archivo dedicado del servidor conocido.

- status: exit0, identity_verified, usuario nodia-deploy, forced_command true,
  privileged_helper_enabled false, deployment_implemented false.
- id y sudo -n true: exit64, only_status_is_enabled; el gateway los rechaza,
  por lo que no se ejecuta sudo ni se afirma una auditoría total de sudoers.
- Lectura administrativa verifica root:root0755 de home/.ssh/gateway y
  root:root0644 de authorized_keys. Hashes del gateway y authorized_keys
  coinciden con los bytes revisados, sin imprimir claves ni archivos privados.
- Grupo de la cuenta: nodia-deploy. API/worker active/running, Result success.
  No se cambiaron servicios, firewall o configuración SSH en esta comprobación.

Esto acredita SSH desde el PC; todavía no acredita conexión desde un runner
GitHub ni implementación/autorización de un despliegue. No regenerar la clave.
[Recibo de conexión](../evidence/production-deploy-identity-live-20261112-r03.json).

Siguiente bloque del usuario: GitHub → Settings → Environments → production.
Guardar como Environment secret VPS_SSH_PRIVATE_KEY el contenido íntegro del
archivo privado C:/Users/Oscar/.ssh/nodia-actions-production; nunca .pub ni el
chat. Para copiar sin imprimir, ejecutar en PowerShell local del PC:

```powershell
Get-Content -Raw -LiteralPath "$env:USERPROFILE\.ssh\nodia-actions-production" | Set-Clipboard
```

Variables del mismo entorno: VPS_HOST=166.0.112.187, VPS_PORT=22,
VPS_USER=nodia-deploy; VPS_KNOWN_HOSTS con el contenido íntegro del archivo público
C:/Users/Oscar/.ssh/nodia-actions-production.known_hosts, usando:

```powershell
Get-Content -Raw -LiteralPath "$env:USERPROFILE\.ssh\nodia-actions-production.known_hosts" | Set-Clipboard
```

No ejecutar esos comandos dentro de la sesión Linux de Warp. El secreto permite
identificar al usuario; known_hosts permite verificar el servidor y conserva el
pin ED25519 obtenido por la conexión administrativa existente. Su valor es público.
La configuración en GitHub queda pendiente de confirmación del usuario; no se
leyó ni subió la privada desde herramientas de esta sesión.


## 13. Preflight de acceso VPS desde Actions preparado — 2026-11-12

El usuario confirma guardados VPS_SSH_PRIVATE_KEY y VPS_HOST/VPS_PORT/VPS_USER/
VPS_KNOWN_HOSTS en production. No se le solicitan otra vez ni se leen sus valores.
La configuración GitHub se acredita por reporte; la conexión desde runner sigue
pendiente. Se añade check-production-vps.yml con workflow_dispatch, master y
production, contents:read y acciones fijadas. No construye/publica ni usa sudo.

El helper check-vps-access.mjs sólo conecta al destino registrado, exige el pin
ED25519 conocido y envía status al gateway restringido. Privada/known_hosts se
escriben sin normalizar en temporales privados y se retiran al salir normalmente
con unlink/rmdir no recursivos. Captura errores SSH sin imprimir stderr, stack o
secrets; finalmente abrupto/SIGKILL puede impedir esa limpieza y no se afirma lo
contrario. No se suben temporales ni outputs remotos como artefactos.

Validación:4pruebas del helper pasadas Windows/Linux; ops/ci31/31 en Linux y
30pass/1skip Windows; tres workflows pasan actionlint1.7.12. Se ejecutó el CLI
exacto desde el PC y verificó acceso al VPS/status, sin desplegar. En el ensayo
Windows se añadieron variables estándar de sistema/perfil a la allowlist de
OpenSSH; no se heredan secretos del workflow. Primer montaje Docker incompleto
omitía sources de un test existente; al montar sus dependencias pasó31/31, sin
cambiar lógica ni excluir tests. Timeouts/buffers se validan como opciones y
fallos simulados, no con un corte remoto real. Revisión independiente sin
bloqueadores, con esos límites explícitos.
[Recibo de preparación](../evidence/production-vps-preflight-20261112-r01.json).

Todo continúa en development sin commit ni master/push/publicación. Cuando el
usuario integre los archivos, el workflow debe existir en la rama predeterminada
y en master: Actions → Check production VPS access → Run workflow → master.
También ejecutar Check production Pages access. No relajar production para
probar development ni declarar éxito remoto por los fixtures/PC.

Siguiente implementación: artefactos del CI y paquete/manifiesto por SHA, sin
otro build/TypeScript en CD; updater limitado bajo lock con versión efectiva,
backup, migración y activación API/worker/readiness según §5. Los instaladores
iniciales y el gateway status-only no son ese updater. No usar NOPASSWD genérico,
SFTP/shell libre ni rebuild en el VPS para sustituirlo. CD sigue sin implementarse.

## 14. Artefactos del CI y actualizador de operador preparados — 2026-11-12

Continuación de §13; supera el pendiente de **implementar** esos componentes,
sin acreditar aún instalación, CI del SHA final o CD automático. Todo permanece
sin commit en development junto al WIP del usuario. No se modificó master ni
VPS/Pages en esta entrega. Producción conserva f01 y sus 45 migraciones.

### 14.1. Construir una vez y conservar el resultado

`ci.yml` conserva selección por cambios y un chequeo TypeScript dentro del build
de cada componente. Añade tests puros del updater y empaquetado después de los
checks, usando dist sin otro build. Sólo **push a master** captura/package/verify/
upload de Client/Server seleccionados; PR/development/manual no pagan esa
instalación productiva adicional ni el upload. Las dos VITE públicas se leen del
environment production en un job limitado a master con Client seleccionado;
no se entrega ningún secreto productivo al build/tests.

Nombre `client|server-<SHA>-<run>-<attempt>`, exactamente cuatro archivos (tar,
manifiesto v1, build-metadata y artifact-result), retención **un día**. Esto no
cambia los siete días de backups. La captura de fuente precede a npm/build y
exige checkout limpio/committed; metadatos vinculan source, run, intento y
configuración pública Client. Un upload no prueba que el CI global terminara bien.
[Guía de CI](../../ops/ci/README.md#artefactos-del-sha-final-preparados-en-development-sin-publicación).

### 14.2. Actualización controlada, todavía de operador

`backend_update.py` separa política/orden de efectos del adaptador Linux
`update-backend.py`; la acción SQL corre como nodia con TLS verificado. El
instalador genera un bundle explícito de 14 archivos revisados. **No se instaló
en el VPS ni se extendió nodia-deploy**, que sólo acepta status y sigue sin grant
sudo de esta implementación.

La solicitud root0600 exige versión actual observada, fuente, ID y digest del
ZIP **original** de GitHub. Antes de abrirlo, el host verifica esos metadatos en
GitHub y exige CI completo success, evento push/master, intento exacto y fuente
igual al master actual. Comprueba después cuatro archivos, paquete/inventario,
prefijo inmutable de migraciones, unidades/drop-ins, PIDs/cgroups y espacio libre.
La API pública actual no requiere token; un repositorio privado necesitaría una
ampliación explícita de autenticación, sin saltarse procedencia.

Plan escribe estado y prepara candidato sin tocar la app. Apply con ID nuevo:
lock → pausa timers → mantenimiento503 → backup nuevo con escritores activos →
quiescencia/ACK → parada limpia y cgroups vacíos → repetir SQL/probe → migración
incremental única transaction:all → paths backup/current coordinados → arranque
API/worker/readiness/probe → HTTP público → restaurar timers → versión efectiva.
No usa seed/instalación inicial, build, git pull ni dependencias instaladas en VPS.
Fallos después de efectos conservan bloqueo/intención y mantenimiento cuando
sea posible, sin replay ni rollback/restore automático.
[Operador y comandos](../../ops/production/README.md#actualizador-de-backend-para-operador--preparado-no-instalado).

### 14.3. Evidencia y límites

- 48 tests Node y 17 Python pasados en Linux; tres workflows pasan actionlint.
- Empaquetado Linux real f01 sin build/TS: 24.491 archivos y tree SHA original
  `ff33b6fdbbbc05167745da9c2fde5f3d19355baf51d51214bbc7121cb6ea1e6f`.
  Contexto development sintético, production_eligible=false; no run GitHub nuevo.
- SQL real aislado: 39 checks, TLS verify-full, usuario no superuser/UID900,
  45 migraciones reales f01→46 sintética; gates/ACK, ledger/prefijo, hostname TLS,
  lock y rollback de una migración fallida. No Teacher48/seed/IA ni datos reales.
- Nginx aislado real: 200→503→200 y excepciones ACME/TLS-check. Recarga systemctl
  sustituida: no equivale a actualización completa sobre systemd real.
- Siete unidades y sitio Nginx actuales se compararon por lectura con las bases
  revisadas. No se subieron/instalaron assets nuevos ni reiniciaron procesos.
- [Recibo consolidado](../evidence/production-ci-artifacts-updater-20261112-r01.json).

Checklist vigente del siguiente tramo:

- [x] Preparar capture/package/verify/upload selectivo del build final.
- [x] Preparar política, adaptador, acción incremental, instalador y pruebas.
- [x] Actualizar fuentes canónicas y Obsidian, incluyendo VPS_KNOWN_HOSTS.
- [ ] Ensayar corte completo con systemd real, backup/timers y paquete final
  de development/Teacher48, sin ampliar la aceptación de las pruebas aisladas.
- [ ] Usuario termina e integra development; comprobar CI del SHA exacto. No
  llamar verde al primer run auxiliar fallido ni promover por estas pruebas locales.
- [ ] Ejecutar preflights production desde master cuando existan workflows
  versionados, instalar/adoptar updater revisado y diseñar el transporte mínimo.
- [ ] Conectar orquestación automática: consumir CI success/artifact oficial,
  backend antes de Client cuando haya dependencia, publicación Pages sin rebuild,
  serialización y registro de entregas parciales. Gateway status-only no lo hace.

ADR097 sigue propuesto. Sin cambio funcional de producto ni de contratos IA:
no requiere nuevas fichas de capacidades NodiaAI y no habilita inferencias.

## 15. Transporte instalado y cierre de CI/CD en curso — 2026-11-12

Este corte sucede a §14; no modifica sus recibos/hashes históricos. El usuario
pidió continuar hasta cerrar CI/CD, manteniendo sus cambios en development.
No se crea commit, push o promoción a master. Login/uso general siguen reportados;
la calificación de proveedores IA y las tareas de observabilidad conservan gates
independientes.

### 15.1. Pruebas del actualizador y preparación de infraestructura

- **Systemd real20checks:** PID1 Ubuntu26.04, timers, journald/cursor/InvocationID,
  UID900/cgroups/procesos, parada/cambio/arranque y registro efectivo. Un backup
  stale bloquea antes de parar/migrar. App/backupdata, SQL/probe y GitHub son
  fixtures explícitos; no es un backup R2 productivo ni inferencia real.
- **Transporte25checks:** SSH con host pin, sudo y Nginx reales dentro de una
  fixture sin red exterior. Regla sudo exacta, forced-command, subida por
  tamaño/hash/modos y rechazo de shell/SFTP/sudo libre/duplicados/truncados.
  Actualizador asíncrono falla al consultar GitHub sin red, antes de efectos,
  conserva current/PIDs y repetir el ID sólo consulta. App/manifiesto sintéticos.
- **SQL47checks reales:** incluye45→48 Teacher con dist local explícito, sin
  recompilar/seed. Se observaron102tablas públicas y68entidades ORM; son conteos
  distintos. Conserva TLS verify-full, gates/ACK, prefijo histórico, locks y
  rollback de migración fallida. No acredita procedencia Git del paquete final.
- **Unitarios Python34:**17del updater y17del receiver pasados en Linux aislado.
  Las comprobaciones de módulos de CI/CD se registran por separado al completar
  la integración; no se presenta una suma de tests como aceptación integral.

No se tocó la VM de development. Los contenedores propios terminaron eliminados;
sin secretos productivos ni puertos publicados. El fixture de systemd usa
privileged/cgroupnamespace privado, sin bind de cgroups del host. Se corrigió en
el harness la carrera del servidor temporal initdb esperando TCP, y una
expectativa incorrecta de conteo ORM; no se alteró producto para pasar pruebas.

### 15.2. Instalación y conexión productiva real sin entrega de otra app

El usuario autenticó sudo una vez en Warp mediante tmux. Se instaló el bundle
de19archivos copiado/verificado por hash, manifiesto
`e9690a51721272516741d49f5882275446dc442ae193efbe12c2c805ad88cf16`.
Instala assets root-owned, settings privados y hook Nginx revisados. Concede
solamente el comando fijo del receiver, sin argumentos libres en sudoers:

```text
nodia-deploy ALL=(root) NOPASSWD: /usr/bin/python3 -I /usr/local/lib/nodia/deploy-backend-receiver.py
```

El receiver vuelve a validar JSON acotado y permite status/upload/deploy tipados;
no ejecuta el paquete como root ni habilita shell/SFTP. Upload usa inbox root
en `/var/lib/nodia-updates/incoming`; reemplaza la ruta administrativa de §14.
Tiene límites768MiB/archivo,2GiB y10archivos, deadlines y hash/EOF. Parciales y
estados inciertos se conservan; retención automática de esos paquetes no está
implementada, una cuota alcanzada requiere mantenimiento explícito.

Deploy registra intención antes de request/systemd-run y usa unidad asíncrona
independiente de SSH. Repetir ID idéntico consulta sin volver a iniciar; cambiar
su contenido falla. Las operaciones inconclusas bloquean nuevas actualizaciones.
No hay retries, rollback o restore automáticos de efectos inciertos.

Después de instalar, una conexión nueva con la clave dedicada y known_hosts
verificó deployment_ready/blocked=false, f01 y API/worker activos. Siete assets
instalados coincidieron por hash; pedir sudo -n true por SSH fue rechazado por
el gateway antes de ejecutarlo. HTTPS200 y current=f01 comprobados. No se pidió
apply ni se reiniciaron API/worker por el instalador. Se invalidó sudo y se cerró
tmux. [Recibo vivo](../evidence/production-cd-transport-live-20261112-r01.json).

### 15.3. Integración del pipeline y cierre real pendiente

El remoto público se consultó por el conector GitHub: default_branch=development.
workflow_run usa el ref predeterminado; hacer checkout master no cambia ese ref
para las reglas de environment. Se conserva production sólo master: un
dispatcher sin secretos productivos verificará CI push/master completed/success
y solicitará workflow_dispatch explícito en master. Sólo ese dispatcher necesita
actions:write; el CD revalidará CI/run/intento/currentmaster con lectura.

CI master consultará por pasos separados las versiones reales Pages/VPS y
ampliará la selección por su diff con HEAD, sin reducir lo seleccionado por el
evento. Así un deploy fallido no se pierde ante el siguiente commit. El Client
también debe reconstruirse si cambia su configuración VITE pública. Build/TS
siguen una vez por componente; CD consume el ZIP oficial verificado sin rebuild.

La orquestación prepara artefactos y plan antes de efectos; backend precede a
Pages cuando ambos requieren entrega. Configuración/código estático se vinculan
por hash y se comprueban versiones efectivas, sin afirmar atomicidad entre ambos
destinos. Python/native conservan pruebas pero no son targets automatizados:
cambios efectivos de sus runtimes requieren rollout coordinado y bloquean CD,
sin confundirlos con flags amplios por cambios del propio pipeline.

Checklist para poder llamar cerrado al CI/CD:

- [x] Probar systemd real y transporte SSH/sudo limitado en laboratorio.
- [x] Probar45→48 Teacher y conservar el prefijo de45 migraciones.
- [x] Instalar transporte/updater y comprobar SSH nuevo/versión vigente.
- [x] Finalizar y validar workflow/CD helpers en development; recibo de preparación R01.
- [ ] Usuario termina WIP, versiona/sube development y reconcilia los commits operativos ya integrados en master remoto; verificar CI del SHA final.
- [ ] Promover a master cuando corresponda y comprobar CI del SHA integrado,
  dispatcher/CD y artefactos reales del intento exacto.
- [ ] Comprobar backend/Pages realmente publicados, HTTPS y login/smoke del corte;
  una entrega parcial o un POST incierto requiere reconciliación, no otro envío
  automático. No marcar éxito por las pruebas offline o por instalar el receiver.

Paso a paso Obsidian: utils/VPS/DEPLOY VPS.md§25.16 y continuidad posterior.
ADR097 sigue propuesto; no hay cambios de capacidades o fichas de producto IA.

### 15.4. Preparación del circuito cerrada; aceptación real pendiente

CI, cd-dispatch.yml y cd.yml implementados con los helpers de selección,
GitHub/ZIP, SSH, Pages y orquestación. **74/74tests Node Linux**, sin skips,
y **actionlint1.7.12 en cinco workflows** pasados. Los17tests del receiver
completos se comprobaron en Linux/root aislado; CI hospedado no-root omite
explícitamente sus casos de metadatos root y conserva parser/pipes. Las34
pruebas Python completas corresponden al laboratorio, no a un run GitHub.

El helper readBackend exacto también pasó desde el PC contra el VPS instalado,
con clave/known_hosts sólo en memoria/temporales privados y salida metadata:
baseline_verified f01, deployment_requested=false. API y frontend respondieron
200 desde el PC con validación TLS estándar. No se publicaron assets ni se
probó aquí el token de Pages guardado en GitHub.

Pages usa API de assets estáticos con hash/MIME fijados; protocolo contrastado
con fuente publicada de Wrangler4.161.0. No Functions/Workers ni scripts del
artefacto. Antes de crear consulta marker/config y confirma resultado por API.
CD no permite rerun de su intento, y usa historial de entregas del mismo CI para
evitar reenviar una operación incierta. Esto depende del historial conservado y
no garantiza exclusión ante borrado de historial/publicaciones externas; un
unknown requiere revisión explícita. No se añade un ledger de Pages al VPS.

**Lo que falta para dar CI/CD por operativo:** terminar y versionar el WIP,
reconciliar development con la preparación operativa de master remoto f01,
subir/verificar CI del SHA exacto y promover cuando el usuario lo decida. Después
acreditar CI del merge, dispatcher, CD, versiones efectivas/smoke y posibles
entregas parciales. El master local/main apuntan todavía a ba8 mientras el remoto
master apunta a f01; se observó esa diferencia sin reset ni cambios de refs.
El merge debe preservar los commits operativos y el WIP, resolviendo conflictos
reales, sin sobreescribirlos por copiar árboles.

[Recibo de preparación](../evidence/production-cd-preparation-20261112-r01.json),
[workflows/guía](../../ops/ci/README.md) y Obsidian§25.16–25.17 contienen el
recorrido. No se movió ningún branch, creó commit/push ni ejecutó un apply de
otra aplicación. Producción conserva f01; la instalación del transporte sí quedó
aplicada y verificada en15.2. ADR097 sigue propuesto.

## 16. PR completo hacia development y primera ejecución GitHub — 2026-11-12

El usuario autoriza publicar todos los cambios actuales para observar CI antes
de integrar en development. Se preparó una copia aislada en la rama
codex/development-ci-validation, dejando el checkout development y su WIP
intactos. Snapshot inicial:308archivos, commit6b6448b132ec7e1a14caa38f2dce4f87b3e291c2.
Se revisaron patrones de secretos y los cuatro ZIP históricos: sólo contienen
helpers/units/templates con sus manifiestos. Se corrigieron únicamente saltos
de línea finales antes de publicar.

[PR3](https://github.com/oscarvalenzuela25/Nodia/pull/3) apunta a development;
sin merge automático, cambio del remoto development/master ni entrega productiva.
El primer run43316161643 pasó Changes/pipeline y seleccionó todos los componentes,
pero GitHub omitió Server/Python/native por el skip transitivo del baseline
productivo. El agregador CI no los acepta como aprobados. La corrección explícita
del estado de los jobs evita el success() implícito; se conserva el requisito
needs.changes.result=success y se usa !cancelled() para permitir cancelar builds
obsoletos. always() permanece sólo en el agregador final del CI.

Los intentos anteriores se conservan como evidencia, no como verde integral.
La nueva ejecución se consulta en Checks del PR. Se mantiene TypeScript una vez
por build, sin introducir typecheck adicional ni desplegar a producción desde
esta PR. El siguiente gate es verificar las lanes reales y corregir fallos
observados antes de considerar listo el merge a development.

## 17. Login de Codex y Antigravity: infraestructura preparada — 2026-11-12

**Estado vigente:** infraestructura instalada y activa; API/worker reiniciados
con el mismo f01, keyring persistente/handshake nativo/HTTP comprobados. Codex y Antigravity conectan correctamente según pruebas humanas del usuario. Registro estricto de drop-ins y updater compatible
instalados sin otro reinicio ni despliegue. [Recibo vivo](../evidence/production-ai-login-live-20261112-r01.json).
Las notas iniciales siguientes conservan el contexto de preparación.

Rama `codex/enable-ai-provider-login` desde origin/development9495751a, en un
worktree independiente. Los contratos de login ya existen; no se promueve el
backend de development ni se habilita un proveedor/modelo por un flag.

Inspección inicial SSH de sólo lectura: API/worker activos en f01, sin drop-ins; Codex
no está habilitado por el bootstrap vigente, el binario nativo sí forma parte
del paquete; D-Bus instalado, gnome-keyring ausente y sin sudo administrativo
vigente. No se leyeron secretos ni se usaron credenciales de proveedores.

[Operador versionado](../../ops/production/ai-runtime/README.md): preparación
sin activar, D-Bus/Secret Service privado persistente, contenedor Antigravity
sólo loopback con token propio y volúmenes privados. La activación obtiene el
lock de CD, exige quiescencia SQL READ ONLY, valida infraestructura y coordina
el reinicio de API/worker sin cambiar current. Cada generación Docker debe
recibir y verificar su contención cgroup; no se monta Docker/cgroup global en
el adaptador. Wants/After conserva disponibilidad del resto de la aplicación
ante caída de un runtime IA.

Validación local: imagen fijada construida,660 pruebas Python Linux sin red ni
cuentas; keyring probado con systemd PID1 real/LoadCredential y secreto propio
persistente entre reinicios;14 regresiones del operador. Revisión corrigió
la carrera entre docker start y attachment, el campo has_active_session y la
serialización con CD. Paquete R02 de15 archivos transferido con hashes iguales,
manifiesto c6c3950e096174bad7bd5c700dc5690ce88bde762caa92c49a7c3ab440104032.

**Cierre operativo:** el operador autenticó sudo y se completó preparación,
12 controles de kernel y dos recorridos durables sintéticos sin red/cuentas,
persistencia de keyring, handshake nativo y quiescencia SQL con9 contadores en
cero. API200/auth401 con TLS externo Schannel y OpenSSL; puertos3000/6379/8000
no accesibles desde PC. Instancia/release y contratos conservados.

Se corrigieron el primer lock ausente, el modo del directorio público de código
bajo umask0077 y el gate que exigía sesión remota antes del login. APT suspendido
fue continuado por PID exacto; no se establece la causa. La reserva fallida no se
borró: continuación explícita sólo con consumidores intactos y nueva revisión
READ ONLY. Los originales/hashes están archivados en ops/maintenance.

El updater ahora acepta únicamente los dos drop-ins revisados en ambas unidades,
con registro root0600, rutas/inventario/bytes/SHA exactos y estabilidad entre
observaciones. Backups/timers no ganan esa excepción. Pasaron10 regresiones
nuevas,10 existentes de host,7 de política y20 comprobaciones systemd reales;
la instalación viva conserva los demás campos de settings, hashes base y proxy.

**Pendiente:** inferencias por selección/
modalidad de plan91, renovación/revocación prolongada y recuperación cifrada de
keyring/perfiles. Los backups DB/config anteriores no acreditan esa cobertura.
No se inició login desde el operador, copió sesión del PC, ejecutó inferencia o
migró datos. Ficha candidata sin aprobación, registro o publicación.

[recibo operativo final](../evidence/production-ai-login-live-20261112-r01.json)
y [ficha candidata](../nodia-ai/knowledge/general-settings/features/ai-login-host-setup.md).

## 18. Promoción a master y baseline detenido — 2026-11-13

PR5 quedó integrado en development `80666e6a` y PR6 promovió ese contenido a
master `7aa1da88`. El [CI43362648327](https://github.com/oscarvalenzuela25/Nodia/actions/runs/43362648327)
se detuvo en el baseline VPS, antes de build o despliegue. El cliente informó
`backend_status_failed`; SSH restringido reprodujo `writer_process_not_verified`.
API y worker continuaban activos en f01. El receptor de transporte conservaba
la condición antigua de cero drop-ins, incompatible con las cuatro extensiones
revisadas instaladas en §17; el updater ya aceptaba su registro estricto.

Arreglo preparado en `codex/fix-vps-baseline-status`, desde development. El status
comparte la política del updater instalado fijado por SHA: exige hashes base,
registro privado, rutas/inventario/bytes exactos y conserva la identidad completa
de los procesos. El refresco administrativo reemplaza sólo receptor y su hash,
con locks, preflight de lectura y originales protegidos; no reinicia aplicaciones
ni migra. [Procedimiento mantenido](../../ops/production/README.md#baseline-de-cd-y-configuraciones-registradas-de-ia--2026-11-13).

El operador instaló el receptor corregido `25d32d5a…` con sudo privado, sin cambiar
f01 ni PID de API/worker. SSH restringido nuevo, con clave y host pin productivos,
confirmó deployment_ready, blocked=false y ambos servicios activos. Se repitieron
sólo jobs fallidos: el intento2 pasó el baseline completo (job131684277110,
incluido SSH backend) y continuó Changes/pipeline. Builds y apply conservan sus
resultados propios; el verde de este gate no los acredita.

Validación local:21 pruebas de receptor,10 del instalador y29 comprobaciones
SSH/sudo/systemd/Nginx reales aisladas, sin red externa, PostgreSQL/R2/IA.
La identidad POSIX se verificó como root en contenedor; el runner CI normal sin
root no demuestra esa parte. [PR7 hacia development](https://github.com/oscarvalenzuela25/Nodia/pull/7)
versiona el arreglo y el procedimiento, sin merge automático ni nueva evidencia
JSON versionada. Obsidian26.14 contiene comandos, explicación y contraste EC2.

## 19. Prueba de rechazo de acceso histórico y siguiente promoción — 2026-11-13

El intento2 de master superó el baseline, pero Client falló en
`useObservation.test.tsx`: después de un error transitorio y un refetch403,
la prueba esperaba accessRejected antes de que React confirmara el nuevo render.
El fallo se reprodujo localmente sin modificar el hook. TanStack Query notifica
la suscripción React por lotes; completar refetch no garantiza que result.current
ya refleje esa notificación. El queryFn sí limpia la entrada del caché al recibir
el rechazo y vuelve a lanzar el error.

La rama `codex/fix-observation-access-rejection`, desde development `a3d5bf38`,
ajusta sólo la sincronización de esa prueba: espera la observación del error
transitorio y después el rechazo asentado, con error exacto, isError y fetch
terminado. Conserva la comprobación inmediata de caché null y datos ocultos;
extiende el mismo recorrido a401/403/404/410. No añade sleeps, cambia el scheduler,
omite assertions ni modifica la autorización o el comportamiento de producción.

Impacto en fichas NodiaAI: sólo test; contratos, capacidades, permisos, fuentes
aprobadas y publicación permanecen iguales. No requiere registrar/publicar una
ficha nueva. Validación y PR de promoción se completan con resultados efectivos
antes de entregar; master no se fusiona automáticamente.

Al preparar el commit:13/13 casos de observación, lint Client y build completos
correctos; TypeScript sólo en el build. Suite global con maxWorkers2 en curso.
El PR de promoción y Obsidian26.15 registran su resultado final por separado;
preparar esta corrección no acredita por sí solo un nuevo despliegue.

## 20. Importación CSV: esperar el resultado del lector — 2026-11-13

Tras integrar PR8, el [run43369345499 de master](https://github.com/oscarvalenzuela25/Nodia/actions/runs/43369345499)
pasó baseline/pipeline, Server/worker, Python y host nativo. Client pasó lint/build
y2890pruebas, pero falló un caso de ProductBulkImport: reintento tras rechazo400
de un producto sin código. El log muestra `submit-bulk-products` ausente después
de user.upload, antes del waitFor que comprueba si el botón está habilitado.

La lectura real usa FileReader.onload para establecer filas y renderizar ese
botón. La promesa de user.upload confirma selección/change, no la finalización
del lector. En una ejecución local aislada los21casos originales pasaron; ese
resultado no descarta la carrera observada en GitHub. Se localizaron tres
consultas con el mismo patrón y se cambian a findByTestId, conservando enabled,
recibos, payloads, reintento400 y prohibición de repetir creaciones inciertas.

Una regresión adicional controla sólo la frontera FileReader.readAsText: mantiene
la lectura pendiente, verifica ausencia de botón/fila y cero mutaciones, emite
load explícitamente y comprueba que sólo un clic posterior crea una vez. No usa
sleeps, modifica el componente/importador ni relaja la idempotencia. El spy se
restaura al terminar, sin dejar una promesa de búsqueda huérfana si falla el lector.
Validación final enfocada:57pruebas en3archivos (22del importador y35de helpers/
precios), lint completo y build Client correctos; TypeScript sólo en build. La
suite global del commit nuevo se verifica en GitHub; el resultado se registra en
el PR de promoción y Obsidian26.17, sin extrapolar el pase enfocado a toda la suite.

Rama codex/fix-product-import-test-readiness desde development6c1e5b84, en un
worktree independiente. El plan PWA pendiente del checkout principal queda
intacto y fuera de esta corrección. Impacto de conocimiento: sólo tests, sin
cambios funcionales, contratos, fichas aprobadas o capacidades publicadas.
No se reintenta el run antiguo como sustituto del arreglo versionado.

## 21. Primer CD: preparación fallida y diagnóstico protegido — 2026-11-13

El [CI43373323321 de master60494715](https://github.com/oscarvalenzuela25/Nodia/actions/runs/43373323321)
pasó completo tras PR9. El [CD43374689583](https://github.com/oscarvalenzuela25/Nodia/actions/runs/43374689583)
verificó sus baselines y solicitó backend; se detuvo con
`backend_operation_requires_reconciliation`. Pages no quedó confirmado por ese CD.

Consulta SSH restringida del ID37364cfb1765d6c2a24162d842066691: fase failed,
effects_started=false, migration_requested=false y error
host_command_failed_inspect_private_diagnostics. La consulta general devuelve
deployment_ready, blocked=false, f01 y API/worker activos. Esto sitúa el fallo
antes de pausar timers, mantenimiento, backup, migraciones y cambio de current;
prepare sí puede haber extraído archivos y ejecutado comprobaciones temporales.
No se deduce la causa ni ausencia de staging a partir de ese booleano.

Se prepara diagnóstico raíz acotado y de sólo lectura mediante
inspect-backend-operation.py: códigos de estado/recibos, sin logs libres o secretos.
Seis regresiones Linux correctas y copia verificada por SHA al VPS. La siguiente
acción necesita autenticación privada sudo del operador. Hasta leer los recibos
no se atribuye el fallo a PostgreSQL, red, runtime o proxy.

Se preserva el intento; no se relanza, elimina ni cambia su fase. El flujo no
ofrece un reset implícito: un dispatch nuevo del mismo CI conserva su operación
fallida. Corrección, conciliación por lecturas e intención nueva revisada deben
mantener las barreras existentes. [Procedimiento de diagnóstico](../../ops/production/README.md#diagnóstico-de-una-operación-cd-fallida-sin-replay).
Código y documentación se trabajan en codex/fix-cd-backend-preflight, separado
del plan PWA sin commit. Los párrafos anteriores registran la inspección inicial.

**Causa y corrección confirmadas:** el inspect SQL del candidato pasó READ ONLY
y TLS; el probe falló en configuración. El mismo validador en el sandbox node_job
identificó WRITABLE_STATE: ProtectSystem=strict impedía W_OK en home/codex. Con
sólo ReadWritePaths para esos dos directorios, el validador pasó. No se relaja la
validación ni el resto del aislamiento.17regresiones de updater y25checks
systemd reales reprodujeron EROFS anterior y aislamiento posterior; cierre
conjunto70pruebas Python root sin red, incluidos receptor/política/refresh/diagnóstico.

Refresco revisado instalado: updater703791f5… y su pin, preservando los demás
assets/settings y la operación. Helper requiere origen/destino por hash, locks,
fallo previo sin efectos y originales privados sincronizados; seis pruebas de
refresco incluyen lectura acotada/FIFO y fallo parcial sin replay. Tras instalar,
el Host real verificó inventarios y preflight del candidato60494715: configuración,
PostgreSQL TLS, Redis y R2 correctos; SQL45→48 con3pendientes, sin ejecutar ninguna.
current sigue f01 y el intento original conserva su estado/hash. No se inició la
aplicación candidata ni solicitó inferencia. [Procedimiento mantenido](../../ops/production/README.md#preflight-writable_state-corrección-verificada--2026-11-13).

El arreglo se versiona para una nueva revisión/CI confiable; master queda sujeto
al PR y sus checks. No se reintenta o limpia el ID anterior. Un preflight positivo
no acredita backup, migración, cambio de aplicación o publicación Pages: quedan
en el flujo de CD de la nueva intención. Obsidian26.18 conserva pasos/resultados.
Sudo fue invalidado y la sesión tmux temporal cerrada al terminar la intervención;
API/worker conservaron PID476489/476487, sin unidades temporales activas.

## 22. Parada limpia por SIGTERM, recuperación de disponibilidad y conciliación — 2026-11-13

El [CI43471624414](https://github.com/oscarvalenzuela25/Nodia/actions/runs/43471624414)
de master2cfce73d pasó. El dispatcher inició correctamente el
[CD43473542741](https://github.com/oscarvalenzuela25/Nodia/actions/runs/43473542741),
que falló en `stopping_writers` del intento f452dfa82420d710757945a652f0b172.
`effects_started=true`, `migration_requested=false`, `writer_shutdown_not_clean`.
Ambas unidades estaban inactivas, sin PID/cgroups vivos, con Result=success y
ExecMainCode2/ExecMainStatus15. Se rechazó un SIGTERM satisfactorio; no se detectó
un fallo real de origen CORS. Nginx devolvía mantenimiento503 sin cabeceras CORS.

La recuperación autenticada, revisada independientemente, tomó los locks de
receptor e instalación y fijó hashes de updater, estado y BLOCKED. Verificó el
inventario de f01, unidades/drop-ins, configuración de backups y el journal de
migraciones SQL mediante el action instalado en READ ONLY/TLS, con origen y
destino ambos f01:45aplicadas,45objetivo,0pendientes y9contadores de trabajo en0.
Registró intención durable antes de iniciar sólo API/worker del current original.
Comprobó UID, ejecutable, cwd, cgroup, readiness, CORS y nuevamente SQL; retiró
únicamente su mantenimiento tras las comprobaciones locales, verificó HTTPS
público y restauró el estado previo de los timers. Ante fallo habría restablecido
el mantenimiento, conservando los diagnósticos para inspección.

Resultado confirmado17:50:53UTC: mismo backend-f01b49333688-ff33b6fdbbbc y esquema45;
API/worker y ambos timers activos. OPTIONS de auth/refresh204 con origen exacto
`https://nodia-1ge.pages.dev` y credenciales permitidas; GET auth/me anónimo401
con las mismas cabeceras, desde VPS y PC. No hubo POST de login, inferencia,
migración, restauración SQL, cambio de current o publicación Pages.
Estado/BLOCKED originales byte a byte intactos. Recibo privado separado:
`/var/lib/nodia-updates/same-release-recovery-f452dfa82420d710757945a652f0b172.json`.
En ese punto la recuperación aún conservaba el bloqueo del CD; el cierre posterior
se registra al final de este apartado.

La corrección acepta exclusivamente las parejas de salida(0,0)/(1,0)/(2,15)
junto a inactive/success/PID0 y la comprobación independiente de cgroup vacío.
Se conservan rechazos de SIGKILL, aborto/core, salida no cero, timeout, PID o
cgroup vivo.20pruebas de Host y28checks con systemd259/Node24 reales aislados:
se observó API success/2/15 tras cleanup y worker success/1/0. El fixture conserva
sus límites sintéticos de aplicación/SQL/GitHub/proxy y no acredita Nginx/TLS.
La comprobación productiva de CORS/TLS se realizó separadamente como se indica.

La conciliación comparte contrato entre receptor y Host, según
[ADR099 propuesto](../architecture/decisions/ADR-099-pre-migration-deployment-reconciliation.md).
No cambia una operación fallida a success ni permite repetirla.
Impacto en fichas NodiaAI: ninguno; es una reparación operativa sin nuevas
capacidades, permisos o afirmaciones de disponibilidad de modelos.

**Cierre realizado:** se instalaron por hash exclusivamente updater3fb13508…,
política15697a43… y receptorb2880ea7…, con originales privados sincronizados
antes de escribir. No se reinició la aplicación durante ese refresco. El helper
`reconcile-pre-migration-update.py`0c55f102… verificó de nuevo SQL READ ONLY45/45,
TLS, quiescencia, procesos, CORS local/público y timers; guardó copia privada del
manifiesto y ACK exclusivo en el intento. Así no depende de conservar todo f01
cuando se limpien releases futuros. Ambos gates validan exactamente el mismo
contrato. Un ACK inválido, modificado o con archivos originales distintos sigue
bloqueando; un submission pendiente u otro fallo no queda resuelto por este ACK.

SSH restringido confirmó `deployment_ready`, `blocked=false` y ambos servicios
activos. La consulta específica del ID conserva failed/effects_started=true/
migration_requested=false y automatic_retry_allowed=false. No se cambia master,
no se despliega el candidato y no se repite la operación fallida. La siguiente
promoción exige la rama/PR development→master y un CI/CD nuevo.

Validación final:60pruebas Python Linux root sin skips (incluidas11del helper,
contrato puro y ficheros reales de los gates),4pruebas SQL/Node y los28checks
systemd del shutdown descritos arriba. El job CI ejecuta ahora Python en un
contenedor slim fijado por digest, sin red, privilegios extendidos, secretos o
montajes adicionales al código de operaciones read-only. El runner falla si
alguna regresión se omite. El fixture de identidad usa su propio archivo canónico
y compara inodos reales; no necesita instalar Node para comprobar metadatos.
No se añade otro TypeScript check ni se compila dos veces la aplicación.

Se confirmó ausencia de acciones temporales activas, se invalidó sudo en la PTY
y se cerró tmux. Obsidian26.20 explica causa, comandos de lectura, recuperación,
conciliación y equivalencia con EC2/ECS/ALB. El arreglo se versiona en la rama
codex/fix-backend-shutdown-recovery desde development, con PR de revisión.
