# CI/CD del monorepo: validar y entregar artefactos

Estado de esta entrega: código preparado y probado localmente en `development`;
primera ejecución real de Actions y publicación mediante este circuito pendientes.

CI comprueba el código y construye cada componente una sola vez. En push a
`master`, primero consulta las versiones desplegadas usando los secretos de
Cloudflare y SSH del environment `production`, en pasos separados. Amplia la
selección según el backlog real y prepara los artefactos necesarios. Los jobs de
build/tests no reciben esos secretos. CD está implementado, pero esta entrega
permanece local en `development`: no se ejecutó una entrega real desde GitHub.
PostgreSQL, R2 y claves privadas de Google/proveedores IA permanecen en el VPS.

El diseño y los pendientes del despliegue se mantienen en
[plan99](../../docs/mvp/99-production-deployment-and-cicd-plan.md). Esta guía no
aprueba el ADR097 ni da por aceptadas todas las funcionalidades del producto.

## Cuándo se ejecuta

La configuración ejecutable está en [ci.yml](../../.github/workflows/ci.yml):

- PR dirigidas a `development` o `master`.
- Push a `development` o `master`, para comprobar el commit integrado.
- Ejecución manual mediante `workflow_dispatch`.

Las únicas ramas de integración y producción son `development` y `master`,
según la aclaración del usuario del 2026-11-12; no se utiliza `develop`.
Las ramas feature no lanzan además un circuito de push: su PR realiza
esa validación. La rama actual `development` sí ejecuta CI al subir cambios,
y el futuro push final a master también se comprueba porque su SHA integrado
puede diferir del evaluado en una PR.

Hay además un workflow manual de **lectura** separado:
[Check production Pages access](../../.github/workflows/check-production-pages.yml).
Consulta el proyecto existente usando el entorno production; no construye ni
publica. Está documentado en [preparación de Pages](#preflight-manual-de-cloudflare-pages).
El segundo preflight manual es [Check production VPS access](../../.github/workflows/check-production-vps.yml),
que verifica únicamente SSH y la identidad restringida, sin actualizar procesos.

Los cambios de esta entrega se dejan en el checkout `development` por
instrucción del usuario. No se fusionan con master ni se publica una versión.

El evento no se filtra por paths. Así también una PR documental produce el
check estable **CI**, en vez de dejarlo esperando por un workflow omitido.
Una ejecución CI antigua de la misma PR/ref puede cancelarse al sustituirse;
esta política no autoriza cancelar una futura migración o entrega productiva.

## Cómo decide qué comprobar

El detector calcula el cambio y sus dependencias. Sus salidas son booleanos
explícitos: `client`, `server`, `python`, `native`, `contracts`, `docs`, `ci` y
`docs_only`. No basta con mirar si apareció una carpeta en el diff.

| Cambio | Criterio de validación |
| --- | --- |
| Client | Lint, build con TypeScript y pruebas del frontend |
| Server/API/Worker | Lint, build completo, pruebas y contratos compilados pertinentes |
| Python | Pruebas offline del microservicio y sus dependencias compartidas |
| Host nativo | Checks de Rust cuando cambien sus fuentes o contratos |
| Conocimiento/políticas/contratos compartidos | Validación de sus consumidores; pueden requerir Server aunque estén en `docs` |
| Prosa exclusivamente administrativa | Checks ligeros de `changes` y resultado final `CI`, sin los builds de componentes |
| CI o clasificación incierta | Validación conservadora; no aceptar un resultado vacío como éxito |

Un renombre o borrado también es un cambio. Un diff ausente o incompleto, una
salida inválida o un path que no tenga clasificación segura no permiten
concluir que no hay trabajo. El detector debe fallar o ampliar las comprobaciones.

El agregador **CI** corre con `always()` y depende del detector y los jobs de
validación. Rechaza fallos y cancelaciones; sólo acepta un job `skipped` cuando
las salidas válidas del detector demuestran que no era aplicable. No convierte
en verde un error del detector ni una prueba omitida indebidamente.

## Qué instala y ejecuta el workflow

Todos los jobs utilizan **Ubuntu 24.04 estándar hospedado por GitHub**. Hay ocho
jobs: `production-baselines`, `changes`, `production-client-config`, `client`, `server`, `python`, `native` y `ci`. `contracts` es una
salida del detector que selecciona Server, no otro job. Tampoco hay un job `docs`:
un cambio realmente docs-only pasa por los checks ligeros y el agregador final.
Modificar `.github` u `ops/ci`, incluida esta guía, selecciona todos los checks.

| Job | Instalación | Comandos efectivos de validación |
| --- | --- | --- |
| `production-baselines` | Solo push master, environment production | GET de Pages y SSH `status`; exporta SHA publicos y cambio de configuracion publica |
| `changes` | Python 3.12 y Node 24.22.2; actionlint 1.7.12 descargado y comprobado por SHA-256 | `node --test ops/ci/*.test.mjs`, tests puros del updater Node/Python, actionlint, detector sobre el diff completo y `git diff --check` |
| `production-client-config` | Sin checkout ni dependencias de la app | Sólo push master con Client seleccionado: valida/exporta VITE_API_URL y VITE_GOOGLE_CLIENT_ID públicos |
| `client` | Node 24.22.2; `npm ci --no-audit --no-fund` | `npm run lint`, `npm run build`, `npm test -- --maxWorkers=2` |
| `server` | Node 24.22.2; `npm ci --include=optional --no-audit --no-fund` | `context:prepare`, lint, build, lectores offline, Vitest con dos workers y fixture PostgreSQL desechable |
| `python` | Python 3.12; `python -m pip install -r requirements.txt` | `python -m pip check` y `python run_tests.py` |
| `native` | Prerrequisitos Linux y Rust 1.95.0 | `cargo fetch --locked` y `cargo test --locked --offline`, con feature SDK predeterminada |
| `ci` | Node 24.22.2 | `node ops/ci/check-results.mjs` sobre resultados y selección de los jobs |

El job Server ejecuta [run-server-checks.sh](run-server-checks.sh) directamente
sobre `dist`: verifica API/worker y assets compilados; ejecuta 13 archivos MJS de
contratos offline mediante Node con concurrencia máxima dos; después comprueba
contratos y conocimiento con sus scripts lectores. No usa sus wrappers npm que
recompilan. La lista exacta mantenida está en ese script, no en una segunda lista
copiada aquí.

Luego `node test/database-setup.integration.mjs` usa Docker y PostgreSQL 16
descartable, con puerto loopback y configuración sintética. Comprueba instalación
del esquema y bootstrap Core con casos de repetición/errores; no conecta a la
base de Northflank. La llamada directa evita otro build. La cobertura de esta
fixture no equivale a restaurar un backup productivo ni a probar todas las
integraciones de la aplicación.

Python instala su aislamiento de tests **antes del discovery** mediante
`run_tests.py`; no sustituirlo por un discovery que importe primero las fronteras
reales. Native compila la feature SDK predeterminada y ejecuta los tests del host
contra fixtures locales, incluido Wiremock, sin cuentas ni inferencias remotas.
Rustfmt y Clippy se instalan como componentes del toolchain; este workflow no
los invoca como checks adicionales.

Native instala `pkg-config`, `libssl-dev`, `clang`, `cmake`, `make` y
`protobuf-compiler`; fija `CARGO_BUILD_JOBS=1`, sin compilación incremental y sin
debug de desarrollo. El primer build puede necesitar descargar/compilar muchas
dependencias; no hay una duración garantizada. `cargo fetch` permite descargar
las dependencias fijadas; `--offline` en el test evita nuevas resoluciones de
Cargo durante esa ejecución, no afirma ausencia de todo tráfico de instalación.

## Tipos, build, lint y pruebas son comprobaciones distintas

Se fija **Node 24.22.2** y se instalan dependencias con `npm ci`, usando los
lockfiles independientes del Client y Server. El checkout conserva el monorepo
completo: el build del Server también consume conocimiento y políticas de docs.

### Client

`npm run build` ejecuta `tsc -b && vite build`. El chequeo TypeScript cubre los
archivos de `src`, incluidos sus tests, y `vite.config.ts`, según los proyectos
referenciados por su tsconfig. `npm run typecheck` ejecuta ese mismo `tsc -b`.

Por eso esta CI conserva **un único chequeo TypeScript dentro del build** por
ejecución del componente; no añade una segunda línea que repita `typecheck`.
Vite por sí solo no sustituye a TypeScript. Lint y Vitest se ejecutan aparte.

### Server

`npm run build` ejecuta los preparadores de políticas, Nest/TypeScript y la
generación de conocimiento/contexto. Nest usa el proyecto `tsconfig.build.json`:
comprueba tipos de producción y excluye `**/*spec.ts` y `test`.

El workflow prepara primero los assets source de conocimiento/contexto que un
checkout limpio no incluye, ejecuta lint y después el build completo. El build
se ejecuta una vez. Los lectores y pruebas Node que consumen `dist`
deben reutilizar ese resultado; no invocar por cada lector un wrapper npm que
vuelva a compilar. La comprobación de assets valida el artefacto final tras
el build completo. No demuestra por separado que Nest copiara originalmente
cada asset: el generador de contexto del propio build puede completar archivos.

**Límite explícito:** las pruebas runtime del Server no acreditan el tipado
estático completo de sus mocks/specs. Vitest transpila y ejecuta; su configuración
actual no habilita typecheck. Oxlint tampoco sustituye al compilador. No se
presenta el build de producción como prueba de tipos de todos los fixtures.
Añadir ese gate exige evaluar los errores reales y conservar sus garantías,
sin excluir tests para fabricar un resultado verde.

### Recursos y aislamiento

Las suites Vitest usan **dos workers como máximo**. Los dos builds Node fijan
`--max-old-space-size=4096` sólo en su etapa de compilación; ese valor es un
límite del heap del proceso, no una medición del consumo total del runner.
Limitar concurrencia no
quita tests, no cambia assertions ni autoriza ampliar timeouts para ocultar
fallos. No ejecutar una suite completa y otra compilación pesada simultáneamente
en el mismo runner. Jobs separados pueden usar runners independientes.

El entorno CI es sintético/offline para las fronteras externas. Un build verde,
un catálogo válido o un test con proveedor simulado no acreditan inferencia real,
login Google, disponibilidad productiva ni calificación de modalidades IA.

## Costos, caché y almacenamiento

El repositorio actual es público. Según la documentación consultada el
2026-11-12, los **standard GitHub-hosted runners de repositorios públicos son
gratuitos** y no reducen el included compute usage. Los larger runners tienen
facturación incluso en repositorios públicos; esta fase utiliza Linux estándar.
[Fuente oficial de facturación](https://docs.github.com/en/billing/concepts/product-billing/github-actions).

La primera CI no sube artefactos de build. La caché npm utiliza los lockfiles
para reutilizar descargas; pip utiliza `requirements.txt`. Native conserva
registry, dependencias Git y `target`, con clave ligada a Cargo.lock/toolchain.
No se cachean `.env`, credenciales, perfiles IA ni datos de la aplicación.
Caché y artefactos tienen controles de almacenamiento propios:
el costo del runner no permite asumir almacenamiento ilimitado.
[Almacenamiento de Actions](https://docs.github.com/en/billing/concepts/product-billing/github-actions#how-storage-billing-works).

No se afirma una bolsa fija de «2000 minutos» para cuentas privadas ni un saldo
disponible: los planes y el modelo de compute pueden cambiar. Esta sesión no
consultó el consumo privado de facturación mediante el conector. El titular
puede comprobar su cuenta en **Settings → Billing & Licensing → Usage** o la
pantalla equivalente disponible para su plan, y revisar sus presupuestos.
[Resumen de facturación personal](https://github.com/settings/billing).

## Cómo leer un resultado

Abrir la ejecución en la pestaña **Actions**, revisar el detector, los jobs
aplicables y finalmente **CI**. Un fallo de instalación, lint, build o tests
sigue siendo un fallo: no activar `continue-on-error`, quitar checks o consumir
servicios productivos para ocultarlo.

La primera ejecución auxiliar de GitHub comprobó herramientas, ambos builds y
los jobs Python/Rust. Terminó roja por expectativas históricas y de locale de
las pruebas, corregidas y verificadas localmente; no se presenta ese run como
verde. [Evidencia por alcance](../../docs/evidence/production-ci-20261112-r01.json).
El workflow corregido queda sin commit en development: su ejecución integral con
los cambios pendientes se confirmará al subir ese SHA. Las protecciones del
check requerido, CD, secretos de despliegue y publicación por componentes se
implementarán en otra fase.

## Preflight manual de Cloudflare Pages

El usuario reporta configurados en el entorno GitHub `production`:

| Tipo | Nombre |
| --- | --- |
| Secret | `CLOUDFLARE_API_TOKEN` |
| Variable | `CLOUDFLARE_ACCOUNT_ID` |
| Variable | `CLOUDFLARE_PAGES_PROJECT_NAME` = `nodia` |

El valor del token no es legible desde esta sesión ni se copió al repositorio.
El workflow `check-production-pages.yml` acepta únicamente una ejecución manual
desde master y referencia production. El entorno debe restringirse también a
la rama master. Los archivos siguen sin commit en development: **no está disponible
todavía para ejecutarlo** y no se cambia master para realizar esta prueba.

Cuando el usuario haya integrado los archivos correspondientes, el workflow debe
existir en la rama predeterminada de GitHub para mostrar Run workflow y estar
también en master. Abrir Actions → Check production Pages access → Run workflow,
seleccionar master y ejecutar. No seleccionar development ni relajar production.

El helper hace un solo GET HTTPS al endpoint oficial del proyecto, con timeout
de15s, sin seguir redirects ni reintentar. Requiere el proyecto registrado nodia,
subdominio nodia-1ge.pages.dev, producción master e integración GitHub con
autodeploy productivo desactivado y previews none. Datos ausentes/desconocidos
fallan; no se tratan como false. Si el proveedor cambia su contrato, revisar
el diagnóstico y la documentación antes de actualizar esas condiciones.

Imprime únicamente un resultado permitido con booleanos/códigos seguros. No
imprime la respuesta API, que puede contener env_vars, mensajes remotos, token
ni stacks. Tampoco publica artefactos de diagnóstico con esa respuesta.

`read_access_verified` acredita acceso de lectura y coincidencia de configuración.
**No acredita Pages Edit/escritura, upload ni despliegue exitoso**: Pages Read también
puede permitir ese GET. Un fallo tampoco cambia permisos, proyecto o publicación.
La prueba remota sigue pendiente, sin inferir éxito de los fixtures locales.

Checks locales: `node --test ops/ci/*.test.mjs` (incluye los siete casos del
comprobador) y actionlint sobre ambos workflows. El propio CI ahora valida todos
los YAML y conserva TypeScript sólo en el build de cada componente.

Antes de conectar CD también se necesitan variables públicas del build:
`VITE_API_URL=https://166.0.112.187/api/v1` y `VITE_GOOGLE_CLIENT_ID` idéntico al
cliente Google productivo existente. No se transfieren automáticamente desde
Pages a Actions. `NODIA_API_PROXY_TARGET` sólo configura el proxy de Vite en
desarrollo y no es necesario para publicar los assets. El backend CD requiere
todavía su identidad SSH, helper de actualización, lock, manifiesto y recuperación;
este preflight no sustituye esas piezas ni autoriza una publicación sólo frontend
si hay cambios backend pendientes.

Fuentes: [GET de Pages](https://developers.cloudflare.com/api/resources/pages/subresources/projects/methods/get/),
[ejecución manual](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).

## Preflight manual de SSH al VPS

El usuario reporta guardados en GitHub production el secret VPS_SSH_PRIVATE_KEY
y las variables VPS_HOST, VPS_PORT, VPS_USER y VPS_KNOWN_HOSTS. También confirma
las dos variables públicas Vite y production limitado a master. No se consultaron
los valores de GitHub; el éxito de su carga no demuestra conexión desde el runner.

El workflow check-production-vps.yml sólo acepta workflow_dispatch desde master
y usa production. Conserva checkout/setup-node fijados por SHA y contents:read;
no instala dependencias npm, construye, transfiere releases ni ejecuta migraciones.
No usa sudo y únicamente envía status al gateway existente. No se debe añadir
un comando configurable ni aceptar ref libre para saltar la restricción.

El helper check-vps-access.mjs exige destino166.0.112.187:22/nodia-deploy y verifica
la huella ED25519 ya obtenida por el SSH administrativo confiable. Rechaza host
alternativo, wildcard/múltiples entradas y claves de servidor distintas antes
de conectar. Usa -F null, -T, sin agente, IdentitiesOnly/BatchMode, host checking
estricto y un único known_hosts; no acepta automáticamente host keys nuevas.

Escribe la privada sin modificar sus bytes en un directorio temporal nuevo0700
y archivos0600. El proceso ssh sólo hereda un entorno mínimo, sin secrets del
workflow; en Windows conserva las variables de sistema/perfil necesarias para
OpenSSH. El archivo privado original quedó intacto. Timeout20s, conexión10s y
salida limitada a16KiB; los errores se traducen a códigos propios sin imprimir
stderr/stack remoto. Al terminar normalmente o con error capturable se eliminan
sólo los dos archivos y su directorio vacío, sin borrado recursivo. SIGKILL o
destrucción abrupta del proceso pueden impedir finally; no prometer limpieza en
ese caso ni subir esos temporales como artefactos.

El JSON de status debe coincidir con la identidad limitada instalada: no sirve
un JSON de otro usuario ni de un gateway ya habilitado para actualizaciones.
El resultado ssh_access_verified acredita acceso/pin/identidad, no salud de la
API, permisos sudoers, transferencia, migraciones, backup ni CD productivo.

Pruebas de esta entrega:4casos del nuevo helper en Windows y Linux Node24.22.2;
suite ops/ci31/31 Linux y30pass/1skip Windows; actionlint1.7.12 sobre tres YAML.
El helper CLI exacto conectó desde el PC al VPS, con credenciales en memoria y
salida segura, y limpió los temporales. Esa prueba no fue desde GitHub.
Los casos de timeout/maxBuffer comprueban configuración y manejo de fallo
simulado del ejecutor; no forzaron un timeout real ni salida remota excesiva.

Para ejecutar más adelante: el workflow debe estar en la rama predeterminada y
en master; Actions → Check production VPS access → Run workflow → master.
Ejecutar también el preflight Pages. Todo sigue sin commit en development, por
instrucción del usuario; no se crea un commit/merge para ejecutar estas pruebas.

Las credenciales ya están reportadas como completas para esta fase. El siguiente
trabajo técnico es producir artefactos del mismo build validado, transferirlos por
identidad y preparar el helper de actualización: versión desplegada por componente,
lock, backup previo, migración controlada, API/worker coordinados y readiness,
según plan99§5. El gateway sigue status-only; **el CD aún no está implementado**.
No volver a compilar TypeScript al publicar ni usar git pull/build en el VPS.

## Artefactos del SHA final: preparados en development, sin publicación

El flujo nuevo de `ci.yml` captura/empaqueta/sube artefactos **sólo en push a
master**, y sólo para Client o Server seleccionados. PR, development y ejecución
manual conservan sus validaciones sin instalar otra vez dependencias de
producción ni subir paquetes grandes. Un cambio exclusivo de Client no empaqueta
Server; un cambio compartido puede seleccionar ambos.

Orden por componente: captura del checkout limpio **antes** de npm/build → lint
→ único build/TypeScript → tests/contratos correspondientes → paquete → verificación
streaming → upload. Server añade una instalación Linux limpia de dependencias
productivas con scripts deshabilitados y verifica módulos nativos; no recompila
TypeScript. Client empaqueta el `dist` que ya contiene sus variables públicas de
producción. El hash de esa configuración también queda vinculado al paquete.

`artifact-release.mjs` expone capture, package y verify. Ejemplo Linux para Server
en el runner, situándose en la raíz (las fases intermedias siguen en ci.yml):

```bash
node ops/ci/artifact-release.mjs capture --root "$GITHUB_WORKSPACE" --source-sha "$GITHUB_SHA" --output "$RUNNER_TEMP/nodia-server-artifact" --component server
# Aquí se ejecutan instalación, lint, build y pruebas definidos en ci.yml.
node ops/ci/artifact-release.mjs package --root "$GITHUB_WORKSPACE" --source-sha "$GITHUB_SHA" --output "$RUNNER_TEMP/nodia-server-artifact" --component server
node ops/ci/artifact-release.mjs verify --root "$GITHUB_WORKSPACE" --source-sha "$GITHUB_SHA" --output "$RUNNER_TEMP/nodia-server-artifact" --component server
```

Cada artefacto `client|server-<SHA>-<run_id>-<run_attempt>` contiene exactamente:

| Archivo | Función |
| --- | --- |
| Release `.tar.gz` | Assets Client o runtime completo API/worker/CLI de recuperación |
| Release `.manifest.json` | Inventario y hashes; contrato v1 compatible con staging |
| `build-metadata.json` | Componente, commit, repositorio, evento, ref, run e intento |
| `artifact-result.json` | Nombres y hashes que enlazan los tres anteriores |

Retención del upload: **un día**; compresión exterior cero porque el tar ya está
comprimido. No es la retención de backups PostgreSQL/R2, que conserva su contrato
de siete días. Un paquete expirado necesita un nuevo run válido; no se amplía su
vigencia cambiando metadatos. No se suben capturas de source, secretos ni carpetas
temporales enteras. Las etiquetas de checks del paquete describen sólo las
comprobaciones del empaquetador, sin fingir lint/tests globales.

El upload de un job no acredita el resultado global: un consumidor debe exigir
**CI completo terminado en success** para el SHA/intento exactos. El updater de
operador comprueba además en la API oficial de GitHub la identidad y digest del
**ZIP original de Actions** antes de abrirlo, y exige master actual. Un tar con
hash coherente y metadatos autoafirmados no sustituye ese origen autenticado.

Preparación local verificada: 48 tests Node (CI y acción SQL) y 17 Python del
updater; actionlint para tres workflows. Empaquetado Linux real de f01 reutilizó
dist, verificó 24.491 archivos y conservó el tree SHA original, sin build/TS nuevo.
Ese ensayo utilizó contexto development sintético: production_eligible=false.
No se ha ejecutado esta versión en un runner GitHub ni completado CD.
Ver [evidencia R01](../../docs/evidence/production-ci-artifacts-updater-20261112-r01.json)
y [operador](../production/README.md#actualizador-de-backend-para-operador--preparado-no-instalado).


## Entrega de los artefactos a produccion

El circuito preparado es Nodia CI -> cd-dispatch.yml -> cd.yml en master.
workflow_run se ejecuta desde la rama por defecto development; por eso el primer
workflow no accede al environment ni a secretos productivos. Comprueba por API
el CI exitoso exacto de push/master, su ultimo attempt y que su SHA siga siendo
master. Solo entonces solicita workflow_dispatch de cd.yml con ref master.
El permiso actions:write se limita a ese job sin checkout. El receptor repite
el gate antes del checkout, usa contents:read y actions:read, environment
production y concurrencia sin cancelar la entrega anterior.

En master, production-baselines consulta el SHA canonico de Pages y la version
que el gateway verifica realmente en API/worker. cd-selection.mjs une el diff
del evento con Client-desplegado->HEAD y Server-desplegado->HEAD; solo amplia
la seleccion. Un backlog de entrega fallida o cambio de configuracion publica
selecciona sus artefactos en el siguiente CI. Si faltan refs, permisos o una
version confirmada, falla cerrado. El gateway antiguo de solo identidad no
acredita una version desplegada. Development/PR validan sin secretos productivos.

cd-release.mjs descarga el ZIP original de Actions por ID, comprueba su digest
oficial, repositorio/run/attempt y cuatro archivos permitidos. artifact-release
verify valida fuente, manifiesto y contenido; no repite build ni TypeScript.
Primero entrega el backend mediante nodia-deploy y su actualizador restringido;
este vuelve a autenticar el ZIP contra GitHub, controla backup/migracion y espera
API/worker activos. Un fallo impide publicar Client. No hay transaccion atomica
entre VPS y Pages ni rollback automatico de la base por fallar el frontend.

Client usa la API oficial Pages: assets estaticos, BLAKE3 y MIME con versiones
fijadas en pages-assets/package-lock.json. Solo envia dist y sus cabeceras o
redirecciones; rechaza Functions, _worker.js, _routes.json, configuracion Wrangler,
enlaces y archivos operativos. El marcador fija SHA, arbol, hash de las dos
variables publicas y CI run/attempt. Los secretos Cloudflare/SSH se inyectan en
pasos separados. El protocolo se contrasto con Wrangler 4.161.0 publicado;
se usa la API directamente para evitar sus reintentos internos de escrituras.

Para PWA-001, [pwa-assets.mjs](pwa-assets.mjs) comprueba el `dist` ya construido:
identidad/scope del manifiesto, enlaces HTML, PNG con dimensiones reales,
variantes `any`/`maskable`, icono Apple, favicon vectorial y archivos presentes.
El empaquetado exige este perfil cuando la fuente contiene el manifiesto; la
subida vuelve a validarlo. Los artefactos históricos sin manifiesto ni enlace
PWA siguen siendo conciliables, pero un perfil parcial se rechaza.

Tras confirmar Pages, CD hace GET sin credenciales, redirecciones o reintentos
del manifiesto, iconos y entrada `/` en `nodia-1ge.pages.dev`, comparando MIME,
tamaño y SHA-256 con el mismo artefacto. Un HTML de fallback, recurso ausente o
metadatos de otra versión fallan la verificación. El éxito actualiza
`pages-state.json` con el resultado PWA y la identidad del deployment. Si falla después de
publicar, `pages-state.json` conserva `published_assets_verification_failed`:
la publicación ya puede estar activa y no se vuelve a enviar automáticamente.
Estos checks no acreditan instalación, auth standalone o compatibilidad de un
dispositivo; esas pruebas siguen en [plan103](../../docs/mvp/103-pwa-progressive-implementation-plan.md).

El listado productivo de deployments usa per_page=25 y exige una página terminal
antes de escribir, hasta80páginas (2000filas). El valor100 fue rechazado por
Cloudflare con HTTP400/8000024 en el CD43536680525. Los errores identifican
operación y estado sin mostrar URLs/cuerpos/secretos: por ejemplo,
pages_read_failed_deployment_history_http_400 o pages_read_failed_upload_token_http_403.
El sufijo transport indica que no se recibió respuesta HTTP; en escrituras
se conserva outcome_unknown y se exige conciliación, sin reenvío automático.

No se reintenta un envio incierto. Backend consulta su operation ID determinista
antes de enviar. Pages registra el intento antes de su unico POST de creacion.
El receptor rechaza rerun CD run_attempt > 1 y consulta historial CD del mismo CI;
si existe, solo reconcilia efectos confirmados. Un marcador Pages previo pending
o unknown exige revision; un exito exacto solo se verifica. El control depende
del historial conservado y no garantiza exclusion ante borrado de historial o
publicaciones externas. Ante unknown, revisar GitHub/Cloudflare/VPS antes de
un nuevo CI; no suponer que fallo ni pulsar rerun para repetirlo.

El piloto automatico entrega solo Client estatico y Node API/worker. Cambios
reales de fuentes/dependencias/configuracion Python o del host nativo bloquean
CD con unmanaged_runtime_change_requires_coordinated_rollout; documentacion y
pruebas aisladas no activan runtimes. Los proveedores IA no se despliegan ni
habilitan por aprobar estos checks. El resumen muestra el ultimo estado
confirmado por componente y los runtimes que no se entregan.

Referencias: [eventos Actions](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows),
[environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments),
[Pages Direct Upload con CI](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/)
y [API create deployment](https://developers.cloudflare.com/api/resources/pages/subresources/projects/subresources/deployments/methods/create/).

## Primera integración en GitHub: PR3 — 2026-11-12

[PR3 a development](https://github.com/oscarvalenzuela25/Nodia/pull/3) contiene
el snapshot completo autorizado del proyecto. El primer run real detectó skip
transitivo: baseline productivo se omite correctamente en PR, pero las lanes
descendientes sin status check explícito se omitían incluso con changes exitoso.
Las lanes usan !cancelled() y comprueban changes.result=success, manteniendo
selección por outputs. El agregador CI conserva always() para reportar fallos.
No usar always() en builds largos: impediría su cancelación ante otro push.
La validación relevante es la ejecución en GitHub de esta condición; actionlint
comprueba sintaxis, no reproduce el planificador remoto. No se afirma todavía
CI integral verde ni se promueve master.
Fuente: [cancelación Actions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-cancellation).
