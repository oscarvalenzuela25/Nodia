# Login de Codex y Antigravity en el VPS

## Estado — 2026-11-12, America/Santiago

Rama `codex/enable-ai-provider-login`, creada desde `origin/development`
`9495751ad07efa9c399a9e0f342a4ca90a9d8080`. **Infraestructura instalada y activa en Truobox**; API/worker reiniciados de forma
coordinada y `/opt/nodia/current` conserva f01. Codex y Antigravity: login correcto reportado por el usuario.
No se ejecutó inferencia. Estos comandos describen primera instalación; no
repetirlos sobre el destino ya configurado para hacer una actualización.

Ambos flujos HTTP/UI ya existen. La inspección inicial de producción f01 encontró Codex sin opt-in y ningún
keyring privado/adaptador Python operativo. Los archivos de esos
contratos/runtime no tienen diferencias Git entre f01 y esta base development;
el aprovisionamiento no necesita promover el backend de development a master.
No implica que otras diferencias de esas ramas estén publicadas.

## Componentes

| Pieza | Operación |
| --- | --- |
| Codex | Binario Linux del paquete instalado; `NODIA_CODEX_ENABLED=true` sólo al activar |
| D-Bus privado | `nodia-codex-bus.service`, socket `/run/nodia-codex/bus`, sin puertos TCP |
| Secret Service | `nodia-codex-keyring.service`, usuario nodia y colección cifrada persistente |
| Antigravity | Imagen del microservicio existente, CLI y Python fijados por sus locks/digest |
| Contención de login | Helper host existente; delega únicamente el cgroup del contenedor actual |
| API/worker | Conservan usuario, paquete, sandbox y contratos; usan drop-ins al activar |

`Wants`/`After` ordenan las dependencias sin detener toda la API cuando un runtime
IA cae. `cli_auth_credentials_store=keyring` sigue siendo estricto: no se cambia
a `auto` ni se escribe un auth.json como sustitución silenciosa.

Antigravity escucha únicamente en `127.0.0.1:8000` del host, exige el token
interno existente y conserva un worker, UID10001, límites y volúmenes privados.
No recibe PostgreSQL, R2, JWT ni todo `runtime.env`. No se monta el socket Docker
ni cgroups globales dentro del adaptador. El helper privilegiado pertenece al
operador del host; la aplicación/modelo no puede invocarlo.

## 1. Preparar un paquete revisable

Desde el repositorio, con el código del microservicio sin cambios pendientes:

```powershell
python ops/production/ai-runtime/package-ai-runtime.py --output output/ai-runtime/bundle-r03
```

Genera un contexto con **git archive**, sin `.env`, sesiones o dependencias del
PC. El manifiesto fija cada archivo por SHA256. El paquete R03 actual para una instalación nueva contiene18 archivos y su
manifiesto tiene SHA256:

```text
e5ce08c6adf6f7db8b2cc1cc3ad5d3f527378332810097dda3b1b124d3a53113
```

Una generación nueva debe usar otro directorio y registrar su propio hash.
No sobrescribir paquetes ni reutilizar un hash después de editar un input.
Truobox se instaló con el R02 histórico de15 archivos y correcciones acotadas;
no se volvió a ejecutar la preparación para cambiarlo a R03. Los originales y
los hashes se conservan en ops/maintenance y en el recibo operativo.

## 2. Instalar sin activar la aplicación

En el VPS, como nodia-admin, con sudo autenticado privadamente:

```bash
sudo python3 -I /home/nodia-admin/nodia-setup/ai-runtime/bundle-r03/prepare-ai-runtime.py \
  --bundle /home/nodia-admin/nodia-setup/ai-runtime/bundle-r03 \
  --manifest-sha256 e5ce08c6adf6f7db8b2cc1cc3ad5d3f527378332810097dda3b1b124d3a53113
```

Valida el paquete antes de ejecutarlo, copia a rutas root, instala dependencias
del keyring, genera una contraseña independiente, prepara el almacén y construye
la imagen del adaptador. Fija el ID inmutable de imagen; no ejecuta `latest`.
Reutiliza sólo el token interno Gemini, leído del archivo protegido del VPS.

Registra unidades y deja los drop-ins de los consumidores en **staged**.
No llama a login/inferencia, cambia permisos SQL, ejecuta migraciones o inicia
API/worker. `prepare.log` y el estado quedan root0600 en
`/var/lib/nodia-ai-runtime-setup`; no compartir su contenido sin revisar/redactar.
Un fallo parcial conserva el estado y se inspecciona antes de repetir.

Antes de activar, comprobar el kernel con contenedores efímeros sin red:

```bash
sudo python3 -I /usr/local/lib/nodia/ai-runtime/verify-gemini-host.py
```

No utiliza cuentas ni el perfil configurado.

## 3. Activar de forma coordinada

Sólo después de `status=prepared`:

```bash
sudo python3 -I /usr/local/lib/nodia/ai-runtime/activate-ai-runtime.py
```

1. Obtiene el mismo lock que el actualizador CD para impedir operaciones simultáneas.
2. Revisa trabajo pendiente/unknown con el contrato SQL del actualizador, en READ ONLY y TLS verificado.
3. Arranca infraestructura privada y prueba persistencia del keyring con un secreto sintético propio.
4. Comprueba Codex con su RPC instalado, perfil temporal y cierre nativo, sin account/read ni inferencia.
5. Detiene API/worker, vuelve a comprobar ausencia de trabajo y aplica los drop-ins preparados.
6. Arranca los consumidores, verifica HTTP200 de la API, auth/me401 sin sesión y el release sin cambios.

Antigravity queda bajo systemd con `restart=no` en Docker. Cada arranque espera
la generación efectiva, verifica su política y reaplica la contención; fallar el
postarranque detiene también el contenedor. Liveness200 no sustituye la verificación del binario, contención y token.
El arranque valida SHA/version y la ruta protegida de documentación con y sin
token; no exige consultar una cuenta todavía no autorizada. `authenticated`
permanece desconocido en esa prueba de transporte. `/agentic/status` conserva
su comprobación real de sesión/catálogo y sus errores; un timeout no se convierte
en una sesión cerrada o en éxito.

La activación reserva estado antes de modificar consumidores. Un fallo o un
intento previo impide reintentar automáticamente; conservar diagnósticos y
conciliar. No borrar el directorio de setup, perfiles, keyrings o journals.

Después de la activación, registrar las extensiones exactas para el CD:

```bash
sudo python3 -I /usr/local/lib/nodia/ai-runtime/register-consumers.py
```

Requiere el updater compatible de esta rama. El registro root0600 sólo acepta
los dos drop-ins revisados en ambas unidades; conserva hashes de unidades base
y rechaza otros cambios. Backups/timers siguen rechazando todos los overrides.
En Truobox ya está instalado y comprobado, sin despliegue ni segundo reinicio.

## 4. Autorización humana, sin compartir secretos

Desde Nodia → Ajustes IA:

- OpenAI → Agentic → Cuenta Codex: Conectar, abrir la página oficial e introducir
  allí el código mostrado. Puede requerir habilitar el acceso por código en la
  seguridad de ChatGPT o por el administrador del workspace.
- Gemini → Agentic → Autenticar sesión: abrir el enlace oficial de Google y
  devolver únicamente el código al formulario de Nodia correspondiente.

El login Google de acceso a Nodia y el login del proveedor son sesiones distintas.
No copiar perfiles/tokens del PC, escribir contraseñas en Obsidian o enviar
códigos por el chat. La sesión Codex se conserva por conexión; el perfil físico
Antigravity mantiene su sesión compartida conforme al contrato existente.

Autenticación y catálogo no califican una inferencia. No se acreditan chat, OCR,
adjuntos, Teacher, MCP, renovación o recuperación con cuenta real por instalar
estos servicios. Cada selección/modalidad conserva los gates de plan91.

## Verificación local y recuperación pendiente

- Imagen Python construida con los pins existentes;660 pruebas Linux sin red/cuentas pasadas.
- Keyring: tres pruebas Linux y ensayo systemd PID1 real con LoadCredential/sandbox,
  persistencia entre reinicios y caída del keyring sin parar el consumidor sintético.
- 17 regresiones del operador: límites, token literal, paquetes peligrosos,
  aislamiento, carrera de arranque, primer lock, umask y arranque sin cuenta.
- En el VPS:12 controles kernel y dos recorridos de login durable sintético,
  keyring/handshake nativo reales, SQL READ ONLY con9 contadores en cero,
  API200/auth401 y puertos3000/6379/8000 no alcanzables desde el PC.
- CD:10 regresiones nuevas,10 de host,7 de política y20 checks systemd reales;
  registro y guard instalados/verificados sin migrar o publicar una app.

El backup existente de DB/configuración **no acredita cobertura de los nuevos
perfiles o del keyring**. Preparar recuperación cifrada de
`/var/lib/nodia/codex-keyring`, `/etc/nodia/codex-keyring.password` y estado privado
Antigravity antes de depender de sesiones de larga duración. No resetear una
colección para reparar un desbloqueo; no borrar marcadores unknown.

Fuentes: [contrato](../../../docs/mvp/ai-provider-feature-contract.md),
[plan91](../../../docs/mvp/91-ai-provider-onboarding-verification.md),
[seguridad interna](../../../docs/architecture/internal-microservice-security.md),
[OpenAI: autenticación](https://learn.chatgpt.com/docs/auth),
[Antigravity CLI](https://antigravity.google/docs/install?tab=cli).

## Incidencias conciliadas del primer montaje

1. APT quedó suspendido después de instalar los paquetes; se continuó su PID
   exacto y terminó. La causa de la suspensión no se estableció. R03 usa stdin
   no interactivo y deshabilita el PTY de dpkg para futuras instalaciones.
2. El primer lock todavía no existía: el activador lo creaba el updater en su
   primera operación. Se corrigió y probó su creación protegida y exclusión mutua.
3. Umask0077 dejó el directorio de código en0700. Tras verificar todos sus archivos
   públicos, se ajustó sólo ese directorio a0755; secretos/configuración quedaron privados.
4. Consultar sesión/catálogo como gate de arranque producía504 sin cuenta. Se separó
   transporte local de sesión remota. La continuación se ejecutó explícitamente con
   `--resume-infrastructure`, verificando release/unidades intactos y nueva quiescencia;
   no se borró la reserva del primer intento ni se inició otro login.

Los originales no se reescribieron para simular paridad. Ver los archivos de
[preparación](../../maintenance/production-ai-login-preparation-original-20261112-r01.json),
[activación](../../maintenance/production-ai-login-activation-original-20261112-r01.json),
[continuación](../../maintenance/production-ai-login-resume-original-20261112-r01.json) y
[updater](../../maintenance/production-ai-login-updater-original-20261112-r01.json).

Estado final de administración: ticket sudo invalidado y sesión tmux de instalación
cerrada; no quedaron trabajos administrativos en segundo plano. Ambos logins
fueron confirmados por el usuario. [Recibo vivo](../../../docs/evidence/production-ai-login-live-20261112-r01.json).
