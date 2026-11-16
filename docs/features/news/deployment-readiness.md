# News — preparación y entrega de la primera versión pública

Fecha2026-11-16. Complementa [plan105](../../mvp/105-on-demand-tech-news.md),
[contrato HTTP](http-contract.md) y [plan99](../../mvp/99-production-deployment-and-cicd-plan.md).
Esta guía concreta el recorrido de entrega; no autoriza ni acredita un despliegue,
un SHA promocionado, un recibo CI/CD o aceptación humana de News. El pedido actual
es validar y preparar la sección para desplegar.

## Candidato y alcance

La entrega comprende Server y Client juntos: módulo RSS, caché pública y dos
migraciones; ruta `/news` bajo Home, diseño editorial y selección administrativa
independiente. Fuentes habilitadas: web.dev y Node.js. GET público sólo lee caché;
POST actualiza exactamente una fuente con sesión y super_admin activo vigente.
daily.dev deshabilitada y GitHub candidata quedan fuera del alcance de esta entrega.

No hay credenciales nuevas del editor, variables `VITE_*` nuevas, cron, seed,
microservicio o llamada de inferencia para News. El primer GET puede devolver
`items:[]`, ambos estados y fechas null. No tratarlo como fallo ni ejecutar una
actualización automática para poblar la sección.

La [evidencia NEWS-04](../../evidence/news-nodejs-integration-20261116.md) conserva
la validación local previa: Client3103/375, Server6091/355 más una omisión Linux,
tipos/lint/build, SQL/HTTP descartable, lectura RSS real y QA visual sintética.
Los resultados no se convierten en pruebas productivas, CI de un SHA futuro,
sesión humana o dispositivo físico por enlazarlos aquí.

La [validación NEWS-06](../../evidence/news-final-validation-20261116.md) añade
JWT/SQL reales de laboratorio (13gates sin red y14opt-in con dos RSS reales),
UI adversa del build y corrección de carga inicial (41focales/5archivos). Chrome
nativo200% comprobado en geometría/teclado; captura visual fallida, teléfono y
Google/sesión humana no acreditados. El candidato técnico conserva esos límites.

## Revisión local de preparación

- [x] Módulo News registrado en AppModule; controlador público sólo en GET.
  La excepción de módulo exige método/ruta exactos del POST; el caso de uso
  revalida sesión/rol antes de reservar consumo y publicar resultado.
- [x] `/news` y `/news/` admiten recuperación pública; el layout conserva un
  único lifecycle de sesión. Un prefijo como `/news/private` no hereda la
  excepción. Las rutas privadas conservan sus guards; pruebas de frontera en
  [SessionRouteLayout](../../../nodia-client/src/test/routes/SessionRouteLayout.test.tsx).
- [x] GET usa transporte público sin credenciales y filtrar no dispara POST.
  Selector de actualización inicialmente vacío; fuente exacta y callbacks
  ligados a actor/fuente. No hay fallback ni actualización de todas las fuentes.
- [x] El DataSource compilado descubre entidades y migraciones mediante glob
  `.js`; las dos migraciones News están emitidas en `dist/migrations/`.
- [x] El Client compilado incluye `dist/legal/news-nodejs-notice.txt`. El
  empaquetador actual conserva todo `dist`, incluido el aviso y chunks News;
  no depende de copiar archivos manualmente al servidor.
- [x] Revisión independiente de contrato, autoridad, caché por fuente, dedupe y
  recuperación sin defecto bloqueante confirmado. Este punto no sustituye las
  verificaciones de ejecución o aceptación humana pendientes por su propio alcance.
- El candidato versionado y su CI se identifican en la PR de
  `codex/news-implementation` a development. Verificar el SHA exacto antes de
  promocionar: un workspace o un build local no son un paquete apto para CD.
- [ ] Completar los gates humanos/dispositivo declarados en plan105 o registrar
  una decisión explícita del usuario por alcance; no marcarlos como ejecutados
  basándose en fixtures o en esta revisión.

## Promoción y artefactos

1. Revisar el diff final y separar temporales ignorados, perfiles y secretos.
   Versionar el alcance autorizado con sus docs/fichas y ambas migraciones;
   conservar las migraciones históricas byte a byte.
2. Integrar por PR a `development` con CI, y sólo tras la decisión de promoción
   tramitar PR a `master`. El merge a master tiene efectos de publicación:
   [cd-dispatch.yml](../../../.github/workflows/cd-dispatch.yml) inicia CD desde
   CI `push/master` correcto; preparar no significa efectuar esa promoción.
3. Exigir CI correcto del SHA final y artefactos Linux originales de ese run y
   attempt. No reutilizar el verde local, el merge sintético de otra PR o un
   paquete construido desde el workspace como artefacto productivo.
4. Confirmar que selección por baselines reales requiere Server y Client; este
   cambio no admite entrega client-only o equivalencia de payload Server. La
   [selección CD](../../../ops/ci/cd-selection.mjs) compara contra versiones
   efectivamente desplegadas, además del diff del evento.
5. Revisar inventario/manifiesto del paquete: ambos JS de migración News,
   `dist/news/**`, dependencias de parsing del lockfile y assets de contexto
   existentes en Server; chunk News y aviso MIT en Client. Sin secretos en los
   artefactos. Los nombres/hash del paquete se obtienen del recibo de CI real.

No cambiar workflows, cuotas, pins o permisos por preparar News. El flujo actual
es [ci.yml](../../../.github/workflows/ci.yml) → `cd-dispatch.yml` →
[cd.yml](../../../.github/workflows/cd.yml), con validación de master/CI exactos,
transporte v2 y comprobación de Client previa a los efectos del backend.

## Migraciones y activación

| Orden News | Clase / archivo | Efecto | Reversión de laboratorio |
| --- | --- | --- | --- |
| 1 | `PublicNewsCache1793670000000` / `1793670000000-PublicNewsCache.js` | Crea `news_sources`, snapshots acotados y estado/reserva; inicialmente web.dev | Elimina la caché pública completa de News |
| 2 | `NewsNodeSource1793670001000` / `1793670001000-NewsNodeSource.js` | Amplía CHECK a web.dev/node-js, sin artículos precargados | Elimina sólo caché Node y restaura CHECK web.dev; conserva la fila web.dev |

El número total de migraciones pendientes depende del ledger y baseline reales;
no fijar «dos pendientes en producción» sin inspeccionarlos. El operador debe
validar prefijo histórico e inventario del paquete antes de aplicar las que falten.

Usar el actualizador existente de plan99: lock, baseline/current, backup con
escritores vigentes, mantenimiento/drenaje y contadores sin trabajo incierto,
parada comprobada y migración una vez desde el paquete inmutable. El
[operador SQL](../../../ops/production/update-backend-action.mjs) verifica TLS,
historial y esquema; ejecuta `runMigrations({transaction:'all'})`. No usar
`npm run migration:run` en el VPS: ese wrapper vuelve a construir. No `db:setup`,
seed, synchronize, SQL ad hoc o repetición de una operación cuyo resultado sea
incierto.

Activar API y Worker del mismo paquete y comprobar readiness antes de publicar
Client. El cliente nuevo exige el contrato con `provenances`: desplegarlo contra
el Server anterior no es un orden válido. Mantener historial/recibos del backend
si falla Pages; no presentar una publicación parcial como entrega completa.

## Recuperación y rollback

Las pruebas down/up acreditan reversibilidad de la caché en PostgreSQL
descartable, no una restauración productiva ni rollback automático de la app.
Ante fallo con efectos iniciados, el actualizador conserva mantenimiento y
evidencia, sin reiniciar, revertir o reenviar por su cuenta. Inspeccionar estado,
ledger, current y recibos antes de decidir recuperación.

Después de aplicar migraciones News, reenviar un paquete pre-News con menos
migraciones no es rollback admitido por el CD: el inventario debe ser append-only
y coincidir con el ledger. Preferir una corrección forward compatible que conserve
esquema/historial. Si se decide rollback explícito de código/esquema, debe tener
su procedimiento de plan99, compatibilidad y mantenimiento propios; coordinar
Client y Server, y sólo retirar la caché sabiendo qué datos se pierden. No
ejecutar `migration:revert`, restaurar DB o hacer replay de un deploy anterior
como reacción automática a un smoke fallido.

## Postchecks de la entrega autorizada

Registrar versión, HTTP, resultado y fecha reales, sin tokens o XML:

1. `/news` directo y recarga en Client publicado; enlace Home→Noticias,
   assets/chunk y aviso legal200, con MIT/copyright completo.
2. `GET /api/v1/news` sin cookies ni bearer:200 y esquema válido, dos fuentes,
   paginación y ausencia de datos internos. Filtros/paginado no generan consultas
   al editor. Un vacío inicial es válido y visible.
3. `POST /api/v1/news/refresh` con body permitido sin sesión:401; con sesión
   ordinaria actual:403, sin consumo externo en ambos casos. No fabricar cuentas
   productivas o probar revocaciones destructivas para este smoke.
4. Con la sesión super_admin autorizada, elegir una fuente y efectuar una única
   intención explícita. Confirmar fuente del recibo, updated/not_modified/cached
   reales, contenido y último éxito; después comprobar lectura anónima. Una
   segunda fuente sólo mediante otra intención explícita. No repetir POST por
   perder el ACK, ni probar fallos de red deliberados en producción.
5. Sesión expirada/no disponible mantiene lectura pública; destinos privados
   conservan recuperación. Logout/cambio de actor retiran controles y descartan
   feedback tardío, sin cerrar el feed público.
6. ES/EN, claro/oscuro, filtros/chips, paginado, atribuciones y foco; tamaños
   afectados y gates manuales de NEWS-06 según su matriz. Conservar evidencia de
   teléfono/zoom/sesión auténtica separada de fixtures de laboratorio.
7. Backend/Worker y Client correspondientes a sus manifiestos, migraciones
   aplicadas y0pendientes del inventario objetivo; timers/mantenimiento en su
   estado final correcto. Registrar recibo completo o estado parcial/fallo real.

La preparación no aprueba ADR105 o fichas NodiaAI; siguen sus estados previos.
Actualizar plan105/progreso/TODO con resultados de cada fase, sin extender un
check local a adopción o aceptación productiva.
