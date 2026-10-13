# Ensayo de VPS en una VM Linux local

> Estado al 2026-10-12: Ubuntu, SSH, Docker/Compose, Node y reinicio verificados. Nodia todavía no está desplegado.
> OpenAI conserva Codex agéntico y API key; ChatGPT Web [descartado](../architecture/decisions/ADR-029-chatgpt-web-browser-adapter.md). Gemini conserva sus canales actuales.

## Configuración del laboratorio

| Elemento | Configuración observada |
|---|---|
| VM | `nodia-vps-lab`, Hyper-V generación 2, Ubuntu Server 24.04.5 LTS amd64 sin escritorio |
| Recursos | 4 vCPU, 8 GiB de RAM fija, disco virtual dinámico de 60 GiB, swap de 4 GiB |
| Disco en Windows | `C:/Users/Oscar/Documents/NodiaVMs/nodia-vps-lab` |
| Red | Default Switch interno/NAT existente; MAC `00155D199400` |
| IP privada | Última observada: `172.22.226.154`; DHCP puede cambiarla después de reiniciar |
| Operador | `operador`, sudo de laboratorio y clave SSH dedicada; contraseña local bloqueada |
| Runtime | Node 24.20.0, npm 11.19.0, Docker Engine 29.9.0, Compose 5.6.0 |
| Checkpoint base | `ubuntu-base-docker-node-2026-10-12`, ID `c8ab87fd-b51e-4458-901e-3ffbca62737c` |

Se eligió Hyper-V porque ya estaba activo en Windows 10 Pro. No se instalaron otros gestores ni se modificaron otras VMs, la red de Windows o Docker Desktop. Consola Hyper-V y terminal SSH permiten observar Ubuntu; no tiene escritorio gráfico.

## Verificación y operación

ISO oficial Ubuntu con SHA256 verificado, autoinstall y ambos ISO desmontados antes del arranque desde disco. Marcador `/var/lib/nodia-vm-installed=ready`, hostname y acceso SSH comprobados. Cloud-init informa `disabled-by-marker-file`, sin errores; el usuario ya está provisionado.

La clave privada permanece fuera de Git en `C:/Users/Oscar/Documents/NodiaVMs/keys/nodia-vps-lab`, con ACL exclusiva del propietario. Registro SSH dedicado `nodia-vps-lab-known_hosts`, alias `nodia-vps-lab`, huella ED25519 `SHA256:RTH1CRgJXRvM7+zMj3wdPCfkeyxXudQT4rfB6KL4khI`. Conservar la validación estricta aunque cambie la IP; consultarla con Hyper-V antes de conectar.

Node procede del tar oficial con checksum verificado; binarios en `/opt/node-v24.20.0-linux-x64`, enlaces en `/usr/local/bin`. Docker se instaló desde su repositorio apt oficial; herramientas de compilación, libsecret y linux-cloud-tools-virtual presentes. Libsecret instalado no demuestra un keyring utilizable para Codex.

El DNS DHCP dejó de resolver durante la preparación. `/etc/netplan/99-nodia-lab-dns.yaml` conserva DHCP para dirección/ruta y usa `use-dns:false` con DNS `1.1.1.1`/`8.8.8.8`. Netplan, resolución y HTTPS comprobados después del reinicio. SSH, Docker, KVP y VSS activos; cero unidades systemd fallidas. Ningún contenedor Nodia iniciado.

Scripts y evidencia fuera del repositorio: `C:/Users/Oscar/Documents/Codex/2026-10-12/me-p/outputs/`, con `estado-vm-nodia.json`, `inspeccion-vm-nodia.json` y `checkpoint-base-nodia.json`. El checkpoint existe; restauración y backup externo aún no probados. El cierre de un descargador anterior quedó pendiente: la revisión automática rechazó detenerlo con «blocked by policy»; no intentar otra vía automática para ese mismo stop.

## Próximos pasos

1. Preparar un release con los cambios autorizados actuales: clonar HEAD no incorpora los archivos sin commit. Usar configuración, secretos, datos sintéticos y volúmenes nuevos; no copiar node_modules, .env, BD ni perfiles/sesiones Windows.
2. Seguir [el runbook VPS](vps-first-test-deployment.md): PostgreSQL 16/Redis 7 en Docker con puertos loopback, Gemini privado, Server en systemd y Nginx. Aplicar [instalación Core](database-installation.md) en BD vacía; no usar el Compose de desarrollo que expone BD/Redis.
3. Preparar Client y un origen OAuth/CORS autorizado. Resolver HTTPS antes de ensayar el login en modo production; no cambiar globalmente Google OAuth para el laboratorio. La topología prevista conserva Client en Pages y archivos en R2.
4. Comprobar keyring headless, login por código y operación [Codex](../features/ai-providers/openai-codex-agentic.md): modelos/esfuerzos, PNG/PDF, cancelación y sesión tras reinicio. API key es independiente y exige configurar una credencial de ensayo antes de generar; no usar fallback.
5. Verificar arranque automático, puertos, memoria/logs, backup/restore, recuperación DB/Redis y persistencia después de reiniciar toda la VM.

El laboratorio ensaya Linux y despliegue; no acredita IP/reputación, latencia, recursos compartidos, firewall o rendimiento del VPS real.
