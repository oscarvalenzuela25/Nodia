# CI del monorepo: validar antes de automatizar despliegues

Primera fase: **CI**, es decir, comprobar el código y construirlo. **CD queda
para después**. Este circuito no conecta al VPS, no publica en Cloudflare Pages,
no ejecuta migraciones productivas y no utiliza secretos de PostgreSQL, R2,
Google, SSH o proveedores IA. No cambia la versión que ya está desplegada.

El diseño y los pendientes del despliegue se mantienen en
[plan99](../../docs/mvp/99-production-deployment-and-cicd-plan.md). Esta guía no
aprueba el ADR097 ni da por aceptadas todas las funcionalidades del producto.

## Cuándo se ejecuta

La configuración ejecutable está en [ci.yml](../../.github/workflows/ci.yml):

- PR dirigidas a `development`, `develop` o `master`.
- Push a `master`, para comprobar el commit final integrado.
- Ejecución manual mediante `workflow_dispatch`.

`development` es el nombre de la rama de trabajo actual; `develop` se admite
como nombre previsto en el diseño. Aceptar ambos destinos no crea ni renombra
ramas. Un push a una rama de trabajo no lanza además otro circuito de push:
su PR realiza esa validación. El push final a master sí se comprueba, porque
el SHA integrado puede diferir del evaluado en la PR.

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

Todos los jobs utilizan **Ubuntu 24.04 estándar hospedado por GitHub**. Hay seis
jobs: `changes`, `client`, `server`, `python`, `native` y `ci`. `contracts` es una
salida del detector que selecciona Server, no otro job. Tampoco hay un job `docs`:
un cambio realmente docs-only pasa por los checks ligeros y el agregador final.
Modificar `.github` u `ops/ci`, incluida esta guía, selecciona todos los checks.

| Job | Instalación | Comandos efectivos de validación |
| --- | --- | --- |
| `changes` | Node 24.22.2; actionlint 1.7.12 descargado y comprobado por SHA-256 | `node --test ops/ci/*.test.mjs`, actionlint, detector sobre el diff completo y `git diff --check` |
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

La presencia de estos archivos no demuestra que GitHub ya haya ejecutado el
circuito. Registrar por separado la verificación local, la primera ejecución
remota y la configuración posterior del check requerido en las ramas. CD,
secrets de despliegue y publicación por componentes se implementarán en otra fase.
