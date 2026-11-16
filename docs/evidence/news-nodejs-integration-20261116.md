# Noticias — segunda fuente RSS Node.js, NEWS-04

Fecha2026-11-16. Rama `codex/news-implementation`. Fuente funcional:
[plan105§12](../mvp/105-on-demand-tech-news.md#12-news-04-segunda-fuente-rss-nodejs--solicitud2026-11-16),
[contrato HTTP](../features/news/http-contract.md) y
[revisión primaria de fuente/licencia](news-nodejs-source-review-20261116.md).
Implementación local; no despliegue ni migración de DB configurada/VM/producción.

## Comportamiento y pruebas atómicas

- Catálogo fijo `web-dev`/`node-js`, GET público sólo caché y POST una fuente
  explícita para super_admin vigente. Validadores de query/body rechazan claves
  desconocidas; el cliente comprueba respuesta/source contra la intención.
- Dedupe por URL con procedencias, primaria por filtro sin copiar contenido de
  otro editor y caducidad por fuente antes de agrupar. Estado/cooldown/lease y
  HTTP304 aislados. Node sólo título/URL/fecha; extracto/autor null.
- Node raw máximo2000, web.dev500; ambos1MiB/deadline10s,100normalizados y7días
  de retención lógica. SSRF/DNS/TLS y XML seguro conservados, sin redirecciones
  arbitrarias. El caso del adaptador Node comprueba que el catálogo correcto
  llega al parser; no desactiva la cota para aceptar el histórico.
- Backend:27focales en2archivos News, correctos. Tipado
  `tsc --noEmit -p tsconfig.build.json`, build completo y lint correctos;
  lint conserva aviso histórico `unsafe-finally` en fixture ajena. Un intento de
  `tsc --noEmit` sin proyecto de build incluyó errores históricos de fixtures:
  no se atribuye a ese comando un resultado correcto ni se modificaron fixtures
  ajenas para ocultarlos.
- Cliente:40pruebas News/4archivos, typecheck/lint/build correctos. Cobertura de
  comportamiento: fuente POST exacta/independiente del filtro; source/actor
  obsoletos y rol revocado; ausencia y contradicción de procedencias; fuentes
  duplicadas; Node sin opcionales; atribución/licencias y aviso accesible.
  Lint excluye `.tmp/**` histórico; build conserva aviso previo de chunks>500kB.

## PostgreSQL descartable y HTTP compilado

`nodia-server/test/news.integration.mjs` ejecutó11gates correctos, con16dispatches
al transporte sintético. Creó exclusivamente su Docker PostgreSQL16 temporal,
sin leer `.env` o DB de la app; contenedor retirado al finalizar.

- Migración inicial up/down/up y nueva `NewsNodeSource1793670001000` down/up.
  La nueva amplía CHECK para Node, sin reescribir la original ni precargar feed.
  Rollback quita sólo caché Node y preserva bytes/metadata de web.dev.
- Nest compilado y guards reales, autenticación de prueba aislada. GET anónimo,
  POST401/403 sin consumo; rol actual, revocación y DTOs exactos comprobados.
  No se presenta el emisor sintético como login Google/JWT real.
- Reserva/concurrencia entre instancias, lease obsoleto, retención y conservación
  ante fallo; identidad GUID/URL y304. Dos fuentes visibles aun vacías; una
  actualiza mientras la otra está en vuelo; cooldown/error/validadores no se
  cruzan. Dedupe y filtro conservan atribución y metadata primaria propias.

## Adaptador Node.js real

Una llamada del `NewsFeedClient` compilado al RSS oficial, sin credenciales,
2026-11-16T20:25:26.692Z: `updated`,100artículos normalizados, todos con título y
URL Node válidos; extracto/autor null. Sin ETag o Last-Modified en esa respuesta.
Deadline10s,1MiB y2000raw/100normalizados aplicados. Sin persistencia ni DB.
Recibo de laboratorio ignorado: `.tmp/news04-verification/backend-node-live.json`.
El GET de investigación1074entradas/328143bytes es una observación separada;
su SHA y la trazabilidad MIT constan en la evidencia de fuente enlazada arriba.

## UI real con fixtures sintéticas

Chromium mediante Playwright CLI sobre ruta/shell reales, con APIs interceptadas
y peticiones no previstas bloqueadas. No consulta editores desde el navegador.

- Público oscuro ES:320/600/900/1440px, seis tarjetas únicas sin overflow,
  procedencia múltiple y cuatro enlaces de aviso Node visibles; sin controles de
  fetch administrativo. Estado de error Node conserva tarjetas de ambas fuentes.
- Super_admin sintético: selección inicial de actualización vacía y botón
  deshabilitado. Elegir Node no produce POST. Filtrar lectura web.dev muestra
  tres tarjetas y conserva Node como fuente a actualizar. Un clic produce
  exactamente `{source_key:'node-js'}`;503 conserva tres tarjetas, filtros,
  selección, mensaje inline y toast, sin repetir POST.
- Admin claro EN:320/600/900/1440px conserva ambas selecciones y un único POST,
  sin overflow; botón44px y ancho288px en viewport320. Cambio idioma/tema y
  resize no reinician selección. Aviso legal real servido por Vite HTTP200,
  con copyright, permiso MIT completo y reconocimiento OpenJS.

Capturas inspeccionadas en `output/playwright/news04-*`; arnés y logs en
`.tmp/news04-qa/` y `.tmp/news04-verification/`, ignorados. Una aserción inicial
del arnés esperaba otro texto de error; se corrigió al mensaje internacionalizado
real sin cambiar código o volver a ejecutar el POST. El primer envío inline del
script al CLI falló por parsing; se usó `run-code --filename` para conservar bytes.

No acredita teléfono/teclado físico, sesión humana, otros motores o zoom nativo.
NEWS-06 conserva esos alcances y adopción por entorno. Revisión independiente de
código/contratos sin hallazgos bloqueantes; no sustituye los resultados ejecutados.

## Verificación global común

- Client: `npm run test -- --maxWorkers=4`,375archivos/3103pruebas correctos,
 542.08s. Se conservan avisos jsdom de canvas/navegación/media ya presentes; no
  se instalaron motores o dependencias para ocultarlos.
- Server: mismo comando,355archivos/6091correctas y1omitida,297.05s. Omisión
  histórica `api-nodia-ai-runtime-owner.spec.ts`, que requiere Linux para la
  identidad de nacimiento del proceso. No se añadieron skips o retries.
- `knowledge:check`:96fuentes/52excluidas/44documentos/46fragmentos;
  release `a4a9bb20fb899e6573f64e21dbf676bd93de0ce7a06e18f16e78cd50fb352f87`,
  conservado. Fichas Noticias candidatas no se publican por cambiar de revisión.

El ajuste final exclusivamente CSS del selector administrativo sustituye
`:first-child` por selector directo del wrapper `div`, para evitar el aviso SSR
de Emotion sin alterar240px desde sm, botón auto o ancho completo xs. Las pruebas
globales verifican comportamiento; la geometría y ausencia de ese aviso requieren
su revalidación visual específica, no se deducen de Vitest. No se modificaron
assertions, timeouts o dependencias para obtener estos resultados.

Revalidación CSS final correcta en Chromium visible con fixtures:320px, selector
y botón278px de ancho útil (scrollbar reservó10px), botón44px;900px, selector240px
y botón184.64×44px automático. Seis tarjetas, Node seleccionado y cero POST
conservados, sin overflow o aviso `first-child`. No se atribuye el ancho288px del
primer recorrido sin esa reserva al navegador visible de esta revalidación.
Typecheck, lint focal y build posteriores correctos; build14.94s conserva aviso
histórico de chunks. Un502 inicial antes de instalar mocks queda separado del
tramo verificado: no hubo errores/warnings durante su medición con fixtures.
Capturas finales `output/playwright/news04-css-final-{320,900}.png` inspeccionadas;
sesiones de navegador y Vite dedicados cerradas, puerto5186 sin listener.

## Conocimiento y operación

Fichas de Noticias revisión7, draft/unregistered/approval:null. Cambio de fuentes
y procedencias dentro de la función existente; no crea herramienta conversacional,
inferencia o escritura externa. Se conserva el diseño NEWS-05 sin imágenes.
daily.dev deshabilitada y GitHub candidata, sin fallback entre fuentes.
No commit, push, aplicación de migraciones o despliegue por esta entrega local.
