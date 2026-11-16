# Noticias — validación final de estados y continuidad UI, NEWS-06

Fecha2026-11-16. Candidato local de `codex/news-implementation`, servido mediante
`npm run preview` en127.0.0.1:5186: aplicación compilada, no Vite dev. Complementa
[NEWS-04](news-nodejs-integration-20261116.md) y el
[plan105](../mvp/105-on-demand-tech-news.md).

## Alcance y entorno

Chromium headless mediante Playwright CLI, sesión propia `nodia-news06-adverse`.
Viewport900×1000 CSS px, oscuro/ES para los estados adversos; dos artículos de
laboratorio, uno por fuente. Respuestas, actores y sesiones sintéticos en arnés
ignorado `.tmp/news06-ui/`; peticiones no previstas bloqueadas. Los enlaces
`example.invalid` identifican fixtures y no se abren. Sin RSS upstream, cuentas
Google, credenciales reales, DB configurada o despliegue.

Esta evidencia demuestra presentación/continuidad del cliente. La autorización
Server y los13gates JWT/SQL son otra comprobación, con `AuthGuard`, emisor JWT y
sesiones SQL de laboratorio: resultado consolidado por su propietario en
`.tmp/news06-verification/backend-auth-receipt.json`. No se presenta ese token o
la UI mockeada como login Google o sesión humana.

## Resultados observables

| Riesgo | Resultado comprobado |
| --- | --- |
| Dos fuentes sin artículos o fechas de consulta | Vacío explícito,0artículos y «Sin consulta correcta registrada» por web.dev y Node.js; no fecha de éxito inventada, control administrativo ausente para anónimo |
| HTTP200 con JSON incompatible | Error de lectura en lugar de vacío o tarjetas inventadas; un único GET inicial, sin retry automático; botón Reintentar recupera dos artículos al responder contrato válido |
| HTTP503 inicial | Mismo error recuperable; no confundir con vacío. Reintentar emite sólo GET y recupera dos artículos |
| Carga inicial | Controles de tema/fuente deshabilitados durante GET; la comprobación encontró el defecto de skeleton descrito debajo, comunicado para corrección |
| Selector administrativo por teclado | Enter abre; Tab entra en primera opción; ArrowDown alcanza Node.js; Enter selecciona y devuelve foco a `news-refresh-source`; Tab alcanza «Actualizar noticias» y Space ejecuta una sola intención explícita |
| Revalidación demorada con datos | Dos tarjetas permanecen montadas, sin skeleton inicial. Controles y enlaces dependientes bloqueados; una intención POST y carga suave mientras GET tarda3s |
| POST503 seguido de GET503 de conciliación | Ambas tarjetas y selección Node.js conservadas; error propio de fuente y error recuperable de lectura, con feedback toast observado. Sin replay del POST; el reintento de lectura recupera los datos |
| Cierre de sesión sincronizado desde otra pestaña durante POST | Cambio real de localStorage de laboratorio dispara evento storage; página `/news` y dos tarjetas conservadas, controles admin retirados. Respuesta tardía no publica toast de éxito en el contexto cerrado |
| Sesión ordinaria sintética | Menú de cuenta presente, dos tarjetas visibles, controles admin ausentes y cero POST |
| Transporte público con sesión o sin ella | Todos los GET de Noticias observados carecen de `Authorization`; selección, vacío, error y navegación no disparan fetch externo |

El recorrido de revalidación produjo dos POST explícitos a Node.js y cuatro GET:
lectura inicial, revalidación tras éxito, conciliación fallida y reintento correcto.
El caso de cierre añadió un tercer POST explícito antes de retirar la sesión;
no hubo POST automático posterior. Tras recargar con actor ordinario, el arnés
registró un GET público y cero POST.

## Hallazgo del primer candidato

La primera carga declaraba un `role=status` con Boneyard, pero su contenido y
canvas no se montaban:600ms dentro de un GET demorado3s, el bloque medía836×0px,
sin huesos visibles. Captura `output/playwright/news06-loading-inspect.png` y
métricas `.tmp/news06-ui/loading-inspect.log`. Se comunicó al propietario; éste
preparó `NewsInitialLoading` con `initialBones` y reserva de altura220px. La
revalidación de ese arreglo y el build final se registran como comprobación
posterior; no se convierte el primer candidato fallido en una prueba correcta.

**Corrección final verificada:** nuevo build con `NewsInitialLoading`, en preview
compilada. GET demorado3s y viewports320/900/1440: `role=status` visible de220px,
overlay Boneyard y cinco `data-boneyard-bone` con dimensiones reales, sin artículos
o controles interactivos dentro del placeholder. Sin overflow; al resolver la
lectura aparecen dos tarjetas y se desmonta el skeleton. Capturas
`output/playwright/news06-final-loading-{320,900,1440}.png` inspeccionadas.

Revalidación posterior con datos: un POST explícito Node y su GET demorado
conservan dos tarjetas, cero huesos/skeletons iniciales y siete enlaces bloqueados.
Tras terminar, controles recuperados. Reflow visual adicional464CSSpx, DPR1:
documento464/464, dos tarjetas de432px y una columna432px, selección Node y único
tema activo conservados. Captura estable `news06-final-reflow-464.png` inspeccionada;
se esperó la estabilización del layout antes de medir. Es un viewport CSS,
no una prueba o captura de zoom nativo200%.

Una primera aserción del arnés esperaba que `role=status` fuese visible y expuso
ese defecto; se separó de la comprobación de controles bloqueados. Otra aserción
de recuperación esperaba `aria-busy=false` inmediatamente después del clic,
antes del siguiente render: la lectura sí recuperó. Se corrigió el arnés para
esperar la desaparición del error; el log posterior confirma2tarjetas,4GET,
2POST Node, fuente conservada y `aria-busy=false`. No cambió producción ni se
repitió el POST para convertir esa observación en éxito.

## Capturas y límites

Capturas inspeccionadas: `output/playwright/news06-empty.png`,
`news06-initial-loading.png`, `news06-loading-inspect.png`,
`news06-refetch-failed-with-data.png` y `news06-cross-tab-signout.png`.
Los scripts/logs de laboratorio permanecen ignorados; los resultados duraderos
se condensan aquí, sin tokens reales o cuerpos del proveedor.

Estos recorridos no prueban teléfono/teclado físico, Safari, zoom nativo o
comprensión humana. La comprobación nativa de zoom de root es independiente y
no se adjudica a estas capturas. No se repiten suites globales o builds por esta
entrega de evidencia; no se modificaron fuentes de aplicación en este ámbito.
Sesión CLI propia cerrada al terminar; servidor preview5186 compartido conservado
bajo ownership de root, sin cerrar ventanas/procesos ajenos.
