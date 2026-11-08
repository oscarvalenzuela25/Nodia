# Ensayo de VPS en una VM Linux local

## Web y chat completos en VM — 2026-10-28

El acceso vigente es `http://localhost:5174/tools/nodia-ai`: un túnel SSH estricto lleva el puerto5174 local a Nginx8080 de la VM, que sirve Client estático y API `/api/v1` del mismo origen. Sustituye para este recorrido al Vite Windows/proxy3100 descrito en cortes inferiores. API/worker usan `/opt/nodia/releases/nodia-server-chat-redesign-r01`; Nginx sirve `/opt/nodia/releases/nodia-client-chat-redesign-r01/dist`, conservando assets de clientes anteriores. PostgreSQL/Redis y Native continúan en la VM; no se copian BD, `.env`, claves o perfiles Windows.

El servidor nuevo deriva del runtime Codex Model Catalog realmente activo, con overlay acotado del chat y conocimiento publicado intacto. Respaldo antes/después, conservación SQL/configuración/época nativa y pruebas en la [evidencia de adopción](../evidence/nodia-ai-chat-vm-adoption-20261028-r01.json). Los operadores y recibos privados están catalogados en `ops/lab/artifacts/chat-redesign-vm-20261028-r01/`; el driver de despliegue es de un solo uso y no debe repetirse para arrancar el laboratorio. API/worker tienen systemd; el acceso5174 depende del túnel de esta sesión Windows. No se reinició Native ni se calificaron modelos mediante inferencias nuevas.

## R2 y micrófono NodiaAI — actualización 2026-10-18

[R05](78-nodia-ai-ai32-attachments-voice.md#revalidación-ai-32-r05--r2-micrófono-y-contención-del-compositor) configura R2 privado en el entorno de la VM con las cuatro variables existentes R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET_NAME; valores nunca en repositorio o frontend. Backup privado y activación API/worker; Gemini y nginx preservados. Canario real PUT/GET/hash/DELETE/404 y chat real PNG/PDF/audio del micrófono comprobados, con descarga privada y recarga. R2 ya no está ausente en este laboratorio; las menciones posteriores a R2 pendiente corresponden a snapshots históricos. No acredita automáticamente promoción/legacy cloud, purga al vencer ni producción. Frontend5174 y túnel3100 encendidos; secretos sólo en los entornos privados.

## Actualización de niveles Web — 2026-10-13

Adaptador integrado y desplegado en API/microservicio habituales, sin runtime
experimental paralelo. Systemd Gemini incluye `docker-compose.web-reasoning.yml`;
registro público observado en `/opt/nodia/config/gemini-web-reasoning-profiles.json`,
montado readonly. `.env` sigue10001:10001/0600; credenciales/volúmenes conservados.
Flash descubierto tiene perfil Bajo/Medio/Alto; otros IDs necesitan observaciones.

Tres OCR privados con ocho checks correctos y un OCR adicional desde Nodia con
Medio produjeron borradores sintéticos correctos. No se guardaron productos/facturas.
R2 dejó de condicionar extracción Gemini en memoria; persistencia sigue pendiente.
[Resultados/operación](../features/ai-providers/gemini-web-login-viewer.md#niveles-integrados-y-ocr--2026-10-13).
Datos de pruebas previas abajo se conservan como historia, no como estado actual.

> Estado al 2026-10-12: API, PostgreSQL/Redis y microservicio Gemini desplegados; Client permanece en Windows localhost. Login y OCR PNG Codex comprobados, sesión conservada tras reiniciar toda la VM. Gemini y claves API aún requieren autenticación/configuración y pruebas reales.
> OpenAI conserva Codex agéntico y API key; ChatGPT Web [descartado](../architecture/decisions/ADR-029-chatgpt-web-browser-adapter.md). Gemini conserva sus canales actuales.

## Configuración del laboratorio

| Elemento | Configuración observada |
|---|---|
| VM | `nodia-vps-lab`, Hyper-V generación 2, Ubuntu Server 24.04.5 LTS amd64 sin escritorio |
| Recursos | 4 vCPU, 8 GiB de RAM fija, disco virtual dinámico de 60 GiB, swap de 4 GiB |
| Disco en Windows | `C:/Users/Oscar/Documents/NodiaVMs/nodia-vps-lab` |
| Red | Default Switch interno/NAT existente; MAC `00155D199400` |
| IP privada | Última observada: `172.22.232.160`; DHCP cambió desde172.22.232.85 al reiniciar |
| Operador | `operador`, sudo de laboratorio y clave SSH dedicada; contraseña local bloqueada |
| Runtime | Node 24.20.0, npm 11.19.0, Docker Engine 29.9.0, Compose 5.6.0 |
| Checkpoint base | `ubuntu-base-docker-node-2026-10-12`, ID `c8ab87fd-b51e-4458-901e-3ffbca62737c` |

Se eligió Hyper-V porque ya estaba activo en Windows 10 Pro. No se instalaron otros gestores ni se modificaron otras VMs, la red de Windows o Docker Desktop. Consola Hyper-V y terminal SSH permiten observar Ubuntu; no tiene escritorio gráfico.

## Verificación y operación

ISO oficial Ubuntu con SHA256 verificado, autoinstall y ambos ISO desmontados antes del arranque desde disco. Marcador `/var/lib/nodia-vm-installed=ready`, hostname y acceso SSH comprobados. Cloud-init informa `disabled-by-marker-file`, sin errores; el usuario ya está provisionado.

La clave privada permanece fuera de Git en `C:/Users/Oscar/Documents/NodiaVMs/keys/nodia-vps-lab`, con ACL exclusiva del propietario. Registro SSH dedicado `nodia-vps-lab-known_hosts`, alias `nodia-vps-lab`, huella ED25519 `SHA256:RTH1CRgJXRvM7+zMj3wdPCfkeyxXudQT4rfB6KL4khI`. Conservar la validación estricta aunque cambie la IP; consultarla con Hyper-V antes de conectar.

Node procede del tar oficial con checksum verificado; binarios en `/opt/node-v24.20.0-linux-x64`, enlaces en `/usr/local/bin`. Docker se instaló desde su repositorio apt oficial; herramientas de compilación, libsecret y linux-cloud-tools-virtual presentes. Keyrings cifrados privados por usuario y bus D-Bus comprobados, incluidos store/read/logout sintéticos dentro del aislamiento systemd de la API.

El DNS DHCP dejó de resolver durante la preparación. `/etc/netplan/99-nodia-lab-dns.yaml` conserva DHCP para dirección/ruta y usa `use-dns:false` con DNS `1.1.1.1`/`8.8.8.8`. Netplan, resolución y HTTPS comprobados después del reinicio. Reinicio completo posterior al despliegue: API, buses/keyrings, Gemini, Nginx y tres contenedores levantan automáticamente; cero unidades systemd fallidas. Login Codex nativo continúa válido y no existe `auth.json`.

Scripts y evidencia fuera del repositorio: `C:/Users/Oscar/Documents/Codex/2026-10-12/me-p/outputs/`, con `estado-vm-nodia.json`, `inspeccion-vm-nodia.json` y `checkpoint-base-nodia.json`. El checkpoint existe; restauración y backup externo aún no probados. El cierre de un descargador anterior quedó pendiente: la revisión automática rechazó detenerlo con «blocked by policy»; no intentar otra vía automática para ese mismo stop.

## Despliegue y conexión del frontend

- Release de archivos actuales autorizados, incluidos cambios sin commit: `/opt/nodia/nodia-server` y `/opt/nodia/nodia-gemini-microservice`. No se copiaron .env, BD, node_modules ni sesiones de Windows. Usuarios separados nodia10000 y nodia-gemini10001, perfiles privados fuera del checkout.
- PostgreSQL16/Redis7 en volúmenes nuevos `nodia-lab`; rol de aplicación sin superusuario,18 migraciones y bootstrap Core aplicados a `nodia_lab`. Negocio/proveedor sintéticos de ensayo; OpenAI conexión1 y Gemini2. Configuración elegida después por el usuario permanece intacta.
- Secretos nuevos generados en Ubuntu: `/etc/nodia-lab` root0700, .env privados0600, claves de servicio/cifrado/keyring distintas. No se exportaron valores al chat ni se importaron credenciales operativas.
- API systemd `nodia-api`, Gemini `nodia-gemini-lab`, dependencias de Docker y keyring. API3000 protegida por UFW; DB5432/Redis6379/Gemini8000/Nginx8080 en loopback. Único puerto de red autorizado22; los puertos de API/BD/Gemini/visor no son accesibles desde Windows directamente.
- Client `http://localhost:5174` → proxy Vite `http://127.0.0.1:3100` → SSH privado → Nginx `127.0.0.1:8080` → API. Override ignorado `nodia-client/.env.development.local`; .env original conservado. Google OAuth/CORS localhost verificados mediante login real de Nodia.
- Laboratorio `NODE_ENV=development`, cookies HTTP lax/no-secure y origen exacto localhost. Esto no verifica el despliegue production con HTTPS; no se modificó Google OAuth global.

Un reinicio puede cambiar la IP DHCP y cerrar SSH: Vite sigue disponible pero sus peticiones pueden devolver502 hasta restablecer el túnel. Consultar la IP de esta VM en Hyper-V y reconectar el mismo forward `-L 127.0.0.1:3100:127.0.0.1:8080`, preservando HostKeyAlias/known_hosts/validación estricta. No reiniciar ni recargar Client para conservar borradores. Estado y scripts fuera del repo en `outputs/frontend-ubuntu-status.json` y `outputs/reconectar-api-ubuntu.ps1`.

Codex login real por código y OCR PNG con `gpt-6.1-sol` completados: HTTP201,10,5s, folioTEST-0042, total11900 y dos productos/cantidades correctos. Solo borrador; no se guardaron factura ni inventario. Tras reinicio completo, lectura nativa confirmó cuenta ChatGPT conectada y almacenamiento exclusivamente en keyring. Health200≈12s; observaciones en paralelo y timeout Client45s evitan sumar demoras de canales.

Checks: Server Linux873/115, Client1167/186, Gemini120 pruebas, pip check, builds/tipado/lint y contratos HTTP/JSONL/PDF/nativo correctos. Server conserva dos warnings de lint y tres hallazgos previos de auditoría de dependencias, sin actualizaciones ajenas. Rasterización PDF probada sin cuenta; inferencia PDF aún pendiente.

## Pendientes

Diagnóstico inicial del2026-10-13: los GET200 solo seguían el intento y la ventana se abría en Ubuntu. Posteriormente, por solicitud explícita del usuario, se implementó el [visor HTTP de login desde Nodia](../features/ai-providers/gemini-web-login-viewer.md), [ADR-030](../architecture/decisions/ADR-030-gemini-web-login-viewer.md). Pantalla Gemini/formulario Google, clic, texto sintético y teclado comprobados desde Client con API/microservicio en VM; cancelación y cierre del navegador verificados. Docker inicia su propio Xvfb sin TCP; ya no monta X99/Xauthority del host ni depende del display systemd. Servicios legacy display/VNC/noVNC detenidos y deshabilitados; sus archivos conservados, sin exportar contraseñas ni abrir su túnel. En ese ensayo no se completó una cuenta real; la prueba posterior de login/OCR Web en VM figura en el punto2. VPS público pendiente.

1. Configurar claves de ensayo mediante el frontend para OpenAI/Gemini API; no compartirlas en el chat. No se importaron claves Windows ni hay fallback desde Codex.
2. Gemini Web: el usuario completó Google el2026-10-13; sesión autenticada y OCR privado real200/7,23s con factura sintética TEST-0042,total11900 y dos productos/cantidades correctos. Modelo elegido del descubrimiento vivo, sin cambiar selección persistida; Nodia muestra Web autenticada. [Evidencia/alcance](../features/ai-providers/gemini-web-login-viewer.md). Posteriormente se configuró Flash desde el catálogo y se integraron niveles Web; los tres OCR privados pasaron, ver la evidencia actual en la funcionalidad del visor. Gemini Agéntico sigue pendiente: CLI1.3.1 instalada/hash verificado, disponible pero sin sesión; su comprobación no autenticada indica `agentic_timeout`.
3. R2 no configurado: persistencia real de adjuntos pendiente. Se retiró R2 del gate de extracción Gemini porque produce un borrador en memoria; URL/token privado siguen obligatorios. Regresión de caso de uso sin almacenamiento. OpenAI/Codex OCR en memoria mantiene su flujo.
4. Login Google real del nuevo visor aceptado en VM. VPS/HTTPS siguen pendientes. Antecedente del visor legacy: la revisión automática rechazó copiar su contraseña a Windows y abrir otro forward con «blocked by policy»; esa acción no se ejecutó ni se reintentó. El nuevo visor es una integración de aplicación independiente, solicitada después: API autenticada, sin VNC ni traslado de contraseñas. Comprobar aceptación real de Google y repetir en VPS/HTTPS; no acreditar estos puntos con el ensayo de pantalla/entrada en VM.
5. Inferencia PDF, renovación/revocación Codex reales, cancelación con cuenta y conexiones adicionales. Ver [runbook Codex](../features/ai-providers/openai-codex-agentic.md); esta prueba no acredita todas las capacidades.
6. HTTPS production, R2 real, backup/restore externo y recuperación DB/Redis. Seguir [runbook VPS](vps-first-test-deployment.md) e [instalación Core](database-installation.md); checkpoint base sin aplicaciones y restauración aún no probada.

El laboratorio ensaya Linux y despliegue; no acredita IP/reputación, latencia, recursos compartidos, firewall o rendimiento del VPS real.

## Revalidación AI-32-R06

[Purga/copia R2](78-nodia-ai-ai32-attachments-voice.md#revalidación-ai-32-r06--purga-y-copias-de-factura-con-r2-real) verificadas en dos PostgreSQL desechables con26 migraciones cada uno y compilado909 idéntico. Los diez objetos propios y ambos contenedores se retiraron tras GET404; descriptores/ledgers privados borrados. La base operativa y el chat R05 quedaron intactos. API/worker/Gemini/nginx activos, sin reinicios ni inferencias. El cierre de estos gates de laboratorio no acredita aceptación productiva o una espera real de90 días. Los reportes sanitizados distinguen fallos de fixture, recuperación sin replay y fuentes ejecutadas/corregidas.

## Revalidación técnica AI-32-R07

R07 cierra técnicamente AI-32 en laboratorio: cuatro casos nuevos de lifecycle del inspector correctos Windows/Linux; diez checks SQL/R2 sobre PUT posterior al commit de expiración y janitor en PID distinto, sin modificar ventana70s. Un PUT/un DELETE y GET404 en cota superior real70.01s; nueve guardas offline. Falla inicial de montaje DI del arnés antes de PUT preservada, corregida sólo en pruebas. Sin código/configuración/migraciones/inferencias de aplicación nuevos; base y objeto sintéticos retirados, chat R05 intacto. No prueba SLA/producción ni publica MCP. [Entrega78](78-nodia-ai-ai32-attachments-voice.md#revalidación-ai-32-r07--aceptación-técnica-y-recuperación-tras-put-tardío) y [consolidado R07](../evidence/nodia-ai-ai32-r07-validation.json). Fichas y ADR conservan sus aprobaciones previas; el build de conocimiento no publica borradores.

## Activación AI-33 — preferencias aceptadas

[Entrega79](79-nodia-ai-ai33-accepted-preferences.md) y [activación](../evidence/nodia-ai-ai33-activation.json): backup privado antes de M4, migración aditiva exacta y reinicio exclusivo API/worker.923 outputs contrastados,27 migraciones,20 tablas NodiaAI/279 columnas; Gemini92 fuentes, configuración y chat R05 preservados, cuatro servicios activos y cero pendientes. Backup296.521B/0600; catálogo596 entradas/major16 validado después del despliegue, no antes. No se realizó restore, inferencia ni operación R2. SQL36 y UI sintética/lectura real acreditan AI-33, sin aceptación productiva. La BD de laboratorio sólo registra destinos Negocios y muestra dos claves de memoria; las cinco claves están verificadas en PostgreSQL aislado. Mantener la tabla al revertir código; down rechaza preferencias existentes. AI-34 implementará snapshots/compactación por separado.

## Activación AI-34 — contexto largo

[Entrega80](80-nodia-ai-ai34-long-context-compaction.md), [activación M4](../evidence/nodia-ai-ai34-runtime-activation.json) y [salud final](../evidence/nodia-ai-ai34-final-health.json): respaldo privado antes de27→28,21 tablas NodiaAI/289 columnas, tabla snapshot de nueve columnas y FK en runs. Código Node931 y Gemini99 fuentes contrastados; entorno, mounts, aislamiento, nginx y chat R05 preservados. Las activaciones posteriores conservan esquema y snapshots, con respaldos explícitos para revertir código/imagen sin borrar datos. La última [imagen](../evidence/nodia-ai-ai34-native-mcp-activation.json) ejecuta420 tests Linux; [refresh de metadatos](../evidence/nodia-ai-ai34-metadata-refresh.json) actualiza sólo pin/manifest, sin reiniciar el microservicio.

SQL36 desechable y canarios de cuenta son capas distintas: Web/Agentic compactan y responden desde memoria, MCP devuelve un nonce sintético mediante un callback real. Nueve solicitudes, cinco aceptadas/cuatro fallos previos conciliados, cero efectos de negocio y cero pendientes. Observación final acredita MCP en Agentic para la selección exacta, Web sin MCP y formatos de adjuntos aún sin verificar tras reinicio. Mantener la imagen/código anterior y los backups privados si hay rollback; down de M4 rechaza datos poblados. No se realizó restore ni se acredita producción, carga o un borrado esperado durante90 días.

## Activación AI-35 — organización del chat y búsqueda

[Entrega81](81-nodia-ai-ai35-conversation-organization.md), [activación](../evidence/nodia-ai-ai35-runtime-activation.json) y [salud](../evidence/nodia-ai-ai35-final-health.json): respaldo PG16 privado307.500B/0600 con catálogo verificado antes de aplicar únicamente1793100000000; ledger28→29 y esquema21tablas/289columnas conservado. Un GIN parcial válido,40KiB con el contenido actual (13.795.328B en corpus SQL sintético, sin confundir ambos volúmenes). API/worker reiniciados y932outputs iguales al candidato; pinb4a790219b41687d2bc4ac7ad70f436d5b9a3aa83cbdfc812533a06f8027dc23. Gemini conserva contenedor/imagenb110 y99fuentes sin reiniciar, junto con nginx, entorno, mounts y chatR05. Cuatro servicios activos/HTTP200, cero jobs/attempts/slots/artefactos pendientes. No nueva inferencia, operaciónR2 ni restore. Revertir código conserva el índice; un rollback del índice no debe eliminar pg_trgm compartido. AI-36..38 mantienen aceptación integral/carga/restore.
