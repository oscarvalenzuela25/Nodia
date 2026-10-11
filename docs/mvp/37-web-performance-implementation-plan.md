# 37 — Plan de acción de rendimiento móvil y escritorio

> Estado: plan aprobado explícitamente por el usuario el2026-10-10; implementación por etapas en curso.
> Primera entrega: Google limitado a Login y correcciones de semántica verificadas localmente. Aceptación autenticada y objetivos móviles pendientes.
> Cada entrega conserva funcionalidades y actualiza DESIGN/AGENTS con evidencia; la aprobación de este plan no aprueba otros documentos pendientes.

## Evidencia y resultado

Los informes corresponden a **Inicio autenticado**, `http://localhost:5174/`, en build productivo, Lighthouse13.4.1/Chrome154. En ambos, `/api/v1/auth/me` y `/api/v1/authorization/context` responden200; la URL final permanece en Inicio. `disableStorageReset=true` conserva la sesión. No son informes de Reservas, Negocios o IA.

Resumen versionado con hashes de los originales, métricas y atribución por origen: [auditorías autenticadas](../evidence/web-performance/authenticated-home-2026-10-10.json). Los originales permanecen en los adjuntos de esta conversación; no se incorporan sus capturas, cookies o datos completos al repositorio.

| Métrica | Móvil, una ejecución | Escritorio, una ejecución |
|---|---:|---:|
| Performance | **64** | **97** |
| FCP | 3,81 s | 0,74 s |
| LCP | **5,56 s** | **1,20 s** |
| TBT | **277 ms** | 0 ms |
| CLS | 0,0615 | 0,0096 |
| Accesibilidad | 100 | 96 |
| Buenas prácticas | 73 | 73 |
| SEO | 82 | 82 |
| Transferencia total del informe | 605.139 bytes | 662.420 bytes |

Ambos informes advierten interferencia de extensiones. Son útiles para localizar problemas y preparar cambios, pero **no constituyen una mediana limpia de aceptación**. El perfil móvil simula CPU×4/red móvil; no acredita teléfono físico. ScreenEmulation está deshabilitada en DevTools; las capturas observadas tienen ancho412px y1373px respectivamente, no se atribuye viewport412 al desktop por el valor residual de configuración. No hay runtimeError.

## Qué pertenece a Nodia y qué requiere aislar el entorno

| Hallazgo | Evidencia | Decisión |
|---|---|---|
| JS sin usar, móvil | 1.144.077 bytes estimados: **939.079 de extensiones**, 119.660 de Nodia y85.338 de Google | Aproximadamente82% corresponde a extensiones; no atribuir1,1MiB a la app |
| JS sin usar, desktop | 1.141.671 bytes estimados: 938.830 extensiones, 117.503 Nodia y85.338 Google | Mismo patrón; separar cobertura de app y extensiones |
| Falta de minificación | Todos los recursos señalados son `chrome-extension://`; ahorro estimado44.753 bytes | No cambiar minificador de Vite por esta advertencia |
| Cookies de terceros |35 entradas del audit, todas de `accounts.google.com` | GIS global es un candidato real;35 entradas no demuestra que Nodia haya creado35 cookies |
| Errores de consola |6/7 excepciones de canal/listener asíncrono; aviso de extensiones en ambos informes | Origen compatible con extensiones, aún por confirmar en perfil limpio; no silenciar errores globalmente |
| LCP | Encabezado de bienvenida `h1` | Reducir carga/render inicial; no optimizar imágenes como solución principal |
| CLS móvil | Contenedor principal0,0570 y avisos Sileo adicionales | Localizar qué transición mueve el contenido; reservar espacio y preservar feedback |
| CLS desktop | Contenido Boneyard0,00910 y avisos menores | Mantener estructura estable entre carga inicial/datos |
| Accesibilidad desktop | `ul.MuiList-root` con hijos directos `div` del Sidenav | Corregir semántica de listas conservando apariencia/teclado |
| Nombre accesible ES/EN | `aria-label="Cambiar idioma"` no contiene texto visible ES | Corregir ambos idiomas; audit de peso cero no implica ausencia de defecto |
| Fuentes |3 DM Sans:43.974 bytes móvil; desktop añade Karmatic TTF57.280 bytes | Revisar uso real; conservar identidad/tipografía, no sumar todo el directorio dist como descarga |
| SEO | Meta description ausente; robots devuelve HTML | Resolver según superficie pública; no hacer indexables módulos privados |
| `agentic-browsing` |66/67 puntos, con audit `llms.txt` | No es condición de Core Web Vitals ni autorización para publicar datos; fuera del alcance principal |

Los ahorros de cobertura son estimaciones de una navegación, no eliminación garantizada ni tiempos sumables. La transferencia total no incluye necesariamente el tamaño de scripts inyectados que aparecen en cobertura: no sumar ambas magnitudes como si fueran la misma métrica.

El backend no muestra un cuello de botella de red local en estas peticiones: auth/me tarda15,7/22,9ms, contexto13,7/37,6ms y health34,9/40,4ms en las trazas. El intervalo entre respuestas/peticiones incluye trabajo del navegador y dependencias reales. Estos tiempos no prueban capacidad del VPS ni autorizan saltar validación de sesión.

Código contrastado antes de esta entrega: GoogleOAuthProvider se montaba en App y el SDK insertaba GIS al montarse, mientras GoogleLogin se usaba en Login. Home/Sidenav comparten helpers/iconos; BaseModal/api/index están precargados. RentalWorkspace importa estáticamente numerosos paneles/modales; la ruta ya es lazy. El nombre de un chunk no permite identificar todos sus módulos sin grafo/sourcemaps; la entrega siguiente registra el grafo y cambios realmente conservados.

## Objetivos y condiciones de aceptación

- Mediana de tres ejecuciones comparables por ruta/perfil: **Performance móvil≥90 y desktop≥95**, LCP≤2,5s, FCP≤1,8s, TBT≤200ms y CLS≤0,1. Preservar el buen resultado de escritorio; investigar cualquier empeoramiento sostenido aunque alcance95.
- Corregir los defectos observados y obtener100 en checks automáticos de accesibilidad de las vistas auditadas, más teclado/foco manual. No equivale a certificación WCAG.
- Buenas prácticas≥95 en perfil limpio, con fallos de Nodia corregidos; distinguir incidencias de Google/entorno. Login conserva las peticiones necesarias de Google aunque esa ruta tenga diferencias de terceros.
- Presupuesto inicial propuesto para **scripts de Inicio autenticado:≤400KiB transferidos**, excluyendo extensiones, medido bajo el mismo protocolo. Hoy son544.374bytes (~532KiB) en ambos informes. Es una meta de diseño, no un ahorro asegurado ni presupuesto universal para Reservas/Login; los demás se fijan desde su baseline.
- SEO solo sobre páginas públicas apropiadas. Ni SEO ni agentic-browsing permiten abrir rutas/datos privados.
- Core Web Vitals de campo pendiente: LCP≤2,5s, INP≤200ms y CLS≤0,1 en percentil75 por móvil/desktop. TBT no reemplaza INP y un Lighthouse alto no acredita tráfico real. Fuentes: [Lighthouse y variabilidad](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring), [Web Vitals](https://web.dev/articles/vitals).

## Etapas, cambios y comprobaciones

### WP-01 — Baseline comparable y pruebas que protejan los flujos

Prioridad P0. Ya recibido Inicio autenticado, móvil/desktop; falta aislar ruido y completar rutas.

- Repetir en perfil de auditoría sin extensiones, con sesión legítima y build productivo. Conservar storage de auth, sin borrar credenciales del usuario. Registrar versión, commit/estado local, ruta, ancho, perfil, dataset y estado de caché. [Lighthouse autenticado](https://github.com/GoogleChrome/lighthouse/blob/main/docs/authenticated-pages.md).
- Tres ejecuciones secuenciales por perfil/ruta: Inicio, Login, Reservas con propiedad, Negocios/listado-detalle, IA y Finanzas como control de inputs compartidos. Separar carga inicial/restauración de navegación posterior; no confundir una redirección o error con la vista objetivo.
- Registrar LCP/FCP/TBT/CLS, bytes por origen, long tasks y peticiones. Si una ruta no tiene permisos/tablas/datos, declarar alcance; fixtures aislados son regresión, no prueba de BD real.
- Identificar tests existentes de auth/rutas/permiso, Sidenav, idioma, modales, calendario y mutaciones. Añadir casos de comportamiento afectados con cada etapa, sin reescribir toda la suite.
- No hacer obligatoria otra ronda de auditoría para corregir semántica ya demostrada o GIS global; sí exigir baseline de cada ruta antes de declarar ahorro o cierre de la etapa.

Salida: medición reproducible y matriz de funcionalidades protegidas. No declarar WP-01 completo por dos informes con extensiones ni cerrar RC-38.

### WP-02 — Google y dependencias de entrada

Prioridad P1. Primera optimización de carga, con dos entregas separadas.

**WP-02A — Google únicamente en Login.** Reubicar provider/SDK en el flujo de acceso y mantener locale, error traducido y provider antes de GoogleLogin. Inicio autenticado no debe solicitar GIS. Auth/me, refresh y permisos conservan validación/cookies/rotación. Si se vuelve a Login, el SDK debe estar disponible y fallar de forma recuperable si Google no carga.

Archivos: `src/App.tsx`, `src/modules/auth/pages/Login/` y tests espejo de auth/rutas. Probar acceso directo, restauración, logout→Login, cambio ES/EN, Google caído, login exitoso/fallido y token vencido. No incorporar otra librería de auth.

**WP-02B — Paquetes compartidos.** Analizar qué imports del shell/health/helpers arrastran BaseModal, schemas e iconos. Separar límites reales de UI e infraestructura mediante imports tipados y rutas lazy existentes. No sustituir todos los barrels por regla ciega ni elevar chunkSizeWarningLimit.

Archivos: `src/layouts/`, `src/store/generalSettings/`, `src/modules/generalSettings/pages/AiProviders/infrastructure/`, `src/config/`. Mantener permisos/caché health por instancia, datos por usuario y feedback. Salida: menor JS inicial propio medido, sin doble petición o coste peor en el flujo de acceso. Revertir el cambio si solo redistribuye nombres de chunks.

### WP-03 — Semántica y estabilidad visual

Prioridad P1; entrega de bajo alcance antes de refactorizar el módulo de Reservas.

- Sidenav: resolver `ul→div` usando agrupación y elementos semánticos correctos. No eliminar semántica global de listas para esconder axe; conservar sublistas, colapsado, navegación directa, permisos y retorno de foco.
- LanguageSelector: nombre accesible incluye ES/EN y la acción traducida. Conservar menú/selección/teclado en claro/oscuro.
- Home/BaseLayout/Topbar/Sileo: seguir la traza de CLS y ubicar la transición que mueve el contenedor. Reservar el espacio pertinente y alinear skeleton/contenido inicial con el layout. No cambiar alturas arbitrariamente, bloquear scroll/zoom, esconder datos o suprimir avisos obligatorios.
- Refetch conserva la vista; Boneyard solo en carga informativa inicial. Evitar montar dos árboles/consultas al pasar móvil↔desktop. No quitar botones ni indicadores para reducir DOM.

Archivos: `src/layouts/components/Sidenav/`, `src/components/LanguageSelector/`, `src/layouts/BaseLayout/`, `src/layouts/components/Topbar/`, `src/modules/home/pages/Home/` y providers de feedback según causa demostrada.

Salida: axe no reproduce los dos defectos, CLS permanece≤0,1 y mejora sostenida en transición inicial; mismo contenido/acciones y foco correcto al abrir/cerrar overlays.

### WP-04 — Reservas por intención, con estado intacto

Prioridad P1/P2; depende de baseline de Reservas, no se atribuye su costo al informe de Inicio.

- Cargar modales al abrir y configuración/colaboradores/caja al seleccionar tab. Conservar agenda/calendario como primera vista aprobada.
- Utilizar lazy/error/retry existentes; precarga por intención solo si reduce espera medida sin penalizar red móvil. Medir primera apertura del modal y primer cambio de tab, además de navegación inicial.
- Evaluar teléfono/inputs/schemas vía grafo para no descargarlos antes de necesitarlos. Provider temporal único y FullCalendar/MUI X se mantienen, conforme a [ADR-025](../architecture/decisions/ADR-025-reservation-calendar-date-inputs.md).
- Mantener URL/deep links, selección, fechas civiles/instantes, zona America/Santiago, validación y dinero. Chunk fallido ofrece reintento sin borrar borrador. No desmontar formularios por refetch ni perder recuperación de una escritura incierta.

Archivos: `src/modules/rentals/components/RentalWorkspace/`, modales/paneles y `src/modules/rentals/pages/RentalReservations/`. Verificar disponibilidad, filtros, reserva/bloqueo, pagos, políticas y permisos con tests de contratos/fixtures aislados. Smoke real de escritura solo en entorno de QA, no crear reservas de prueba en la BD del usuario.

Salida: reducción comprobada de paquetes iniciales ajenos a Agenda; tabs y formularios siguen accesibles y sus primeras aperturas no empeoran. Retener estado al redimensionar320→1440 y ante fallos HTTP.

### WP-05 — Recursos secundarios y perfil de ejecución

Prioridad P2; aplicar por hallazgo medido, en cambios independientes.

- Fuentes: revisar pesos/subsets y font-display reales; conservar DM Sans/Inter y logo Karmatic. WOFF2 del logo solo si licencia/herramienta y comparación visual permiten conversión fiel; sin sustituir identidad por una fuente genérica. No precargar todas las familias.
- Reducir lecturas forzadas de layout solo después de mapear source locations del reflow: agrupar lecturas/escrituras o corregir ciclo probado. React Profiler decide memoización/selectores; no aplicar useMemo/memo por todas partes.
- Traductor: carga de14 namespaces ES/EN detectada, pero el alcance de [ADR-002 aprobado](../architecture/decisions/ADR-002-i18n-translations-catalog.md) y JSON UI actuales debe reconciliarse antes de cambiarlo. Mantener errores globales y traducciones de negocio dinámicas. Este pendiente no bloquea Google/a11y/Reservas.
- Meta description/robots: respuesta real para la superficie pública, sin HTML de fallback en robots. No publicar llms.txt o contenido de módulos privados para mejorar una categoría del informe.

**Propuesta de alcance i18n para reconciliar ADR-002 — pendiente de decisión explícita (2026-10-10).** Textos de interfaz versionados con Client (botones, navegación, validaciones, errores y sileo) conservarían JSON locales ES/EN, con namespaces secundarios cargados por ruta e idioma. Traducciones editables de entidades (modules/roles/actions y otros contratos de negocio) conservarían Server/BD como fuente. Core/layout y recuperación de errores disponibles antes de pedir datos; sin claves crudas, defaults inventados, cambio de idioma incompleto o borradores desmontados por descarga. Conservar fallback lingüístico definido y recuperación local ante diccionario caído. Verificar grafo/transferencia con sesión, ES/EN, acceso directo, cambio de idioma, fallo/reintento y formulario abierto.

Alternativa: aplicar ADR-002 literal y llevar también UI al backend, lo que requiere contrato de bootstrap, versionado, caché y recuperación ante indisponibilidad; no resolverlo añadiendo una petición improvisada. El grafo actual identifica business/rental/ai_providers ES/EN en api compartido; renderedLength no es transferencia ni ahorro garantizado. Esta propuesta no está implementada ni aprobada. Resolver el alcance antes de revisar ADR-002 y documentos dependientes; conservar su decisión/estado actuales hasta entonces.

Salida: ahorro medido con ES/EN, acentos, temas, logo y feedback íntegros; no quitar CSS del breakpoint opuesto porque esta navegación lo marca sin usar.

### WP-06 — Entrega HTTPS, regresión final y pautas vivas

Prioridad P2/P3; cierre de implementación.

- Verificar gzip/Brotli, caché larga de assets con hash y revalidación de HTML en Pages/Nginx de la [guía VPS](vps-first-test-deployment.md). Comprobar actualización con cliente antiguo/chunk cambiado. No cachear API privada o datos de usuarios de forma compartida.
- Repetir matriz limpia móvil/desktop y comparaciones antes/después. API/BD se optimizan solo ante evidencia de latencia o consultas innecesarias, sin omitir auth ni ampliar caché de permisos.
- Tests focalizados por etapa; typecheck/lint/build y suite Client completa para entrega. Si cambia backend, tests de casos de uso conforme a sus reglas. No ejecutar inferencias IA para medir UI.
- Conservar CSV/JSON de métricas agregadas por ruta, build y entorno sin credenciales. INP/interacciones y evidencia de campo son una verificación posterior; telemetría persistente necesita definición de privacidad/destino.

**Pautas solicitadas:** [DESIGN.md, sección10](../../nodia-client/DESIGN.md) contiene el criterio móvil/desktop y [AGENTS Client](../../nodia-client/AGENTS.md) obliga a verificar/documentar cada etapa; [AGENTS raíz](../../AGENTS.md) enlaza estas reglas como índice. Hoy se registra el proceso, no cumplimiento de optimizaciones. Cada entrega debe actualizar las pautas con patrón final, archivos de referencia, tests/evidencia y límites. No documentar una propuesta como implementación ni dar aprobado un documento por pasar un build.

## Matriz mínima contra regresiones

| Cambio | Comportamiento protegido | Evidencia de cierre |
|---|---|---|
| Google/límites del shell | Login/refresh/logout,401/403, cambio de usuario, GIS caído, permisos y health | Tests de auth/rutas, smoke con sesión y comparación de recursos |
| Sidenav/idioma | Links autorizados, colapsado, drawer móvil, ES/EN y foco | Tests de comportamiento, axe/DOM y teclado |
| Layout/carga | Carga inicial, refetch, vacío/error, toast/safe area, zoom y barra móvil | Tests afectados, traza CLS y QA responsive |
| Modales/tabs lazy | Deep link, chunk caído/reintento, borrador, selección y tab | Tests de importación fallida/estado y primera interacción medida |
| Mutaciones de Reservas | Fallo conserva formulario, feedback sileo, sin doble envío/replay incierto | Tests de contrato/UI; smoke solo en QA aislado |
| Fuentes/caché/despliegue | Acentos/logo, actualización y chunks antiguos, datos privados | Comparación visual y pruebas de entrega HTTPS |

Tamaños:320/390/599/600/900/1200/1440px; ES/EN, claro/oscuro y teclado según el componente afectado.320 y390 no equivalen a teléfono físico. Mantener tokens, padding único, targets44px, filtros verticales, tablas650px/tarjetas autorizadas y scrollbar transparente.

Cada etapa debe ser reversible de forma independiente: registrar punto de partida y cambios, no mezclar actualización de dependencias/rediseño/contratos; ante regresión no corregible en el alcance, revertir esa optimización preservando cambios ajenos. No eliminar tests, callbacks, permisos o errores para ganar puntuación.

## Primera entrega verificada — 2026-10-10

**WP-02A implementado.** App conserva Query/MUI/AuthSession/Router y deja de montar GoogleOAuthProvider. Login, que ya era una ruta lazy, monta el provider solo con client ID configurado. Su key contiene idioma/intento porque el SDK instalado lee el locale al montarse; cambiar ES/EN o reintentar renueva solo esa frontera, sin reiniciar la mutación. Fallo de script muestra mensaje y toast traducidos, con Reintentar accesible/ancho completo en xs/44px. Al volver a Inicio se elimina el script. `googleLogout` continúa compartido: se retiró la petición externa global, no se afirma que todo el paquete npm sea exclusivo de Login.

**Semántica de WP-03 implementada; CLS autenticado pendiente.** Grupos Sidenav usan ListItem/li alrededor de sus sublistas conservando estilos, colapsado y navegación. LanguageSelector muestra ES/EN también en el nombre accesible traducido y expone aria-expanded; menú, teclado y retorno de foco verificados. El encabezado del vacío de Home usa h2 con el mismo estilo h6. No se modifican alturas, skeletons, avisos, calendario ni formularios de Reservas.

**Comparación limpia de Inicio sin sesión:** Lighthouse13.5.0/Chrome154, build productivo en4174, tres ejecuciones secuenciales por perfil/fase; sin warnings ni runtimeError. [Evidencia agregada con hashes, fases y límites](../evidence/web-performance/stages-google-accessibility-2026-10-10.json). Los24 informes completos y grafos permanecen fuera del repositorio, en la ruta indicada en la evidencia.

| Mediana | Antes móvil | Final móvil | Antes desktop | Final desktop |
|---|---:|---:|---:|---:|
| Performance |70|77|96|98|
| LCP |5,335s|4,103s|1,215s|0,900s|
| FCP |4,073s|4,069s|0,877s|0,875s|
| TBT |44,7ms|51,8ms|0ms|0ms|
| CLS |0,000170|0,000170|0,000381|0,000381|
| Accesibilidad |98|100|98|100|
| Scripts transferidos |545.155B|442.300B|545.173B|442.300B|

Google pasa de una petición por ejecución a cero en Inicio; ahorro de scripts aproximadamente103KB/19%. Buenas prácticas conserva100 y SEO82. FCP móvil prácticamente igual y TBT fluctúa: no afirmar que todas las métricas mejoraron. Mobile77/LCP4,103s/FCP4,069s **aún no cumple** las metas; presupuesto de400KiB tampoco alcanzado (~432KiB). No comparar estos scores anónimos con64/97 autenticados del usuario.

Smoke de sesión real en5174: Inicio conserva cuenta, permisos, accesos e indicadores, con cero scripts GIS; drawer móvil y escritorio con cero hijos de lista inválidos. QA a320/1440px, ES/EN y claro/oscuro, sin overflow; preferencias/tamaño originales restaurados. Esto no constituye Lighthouse autenticado posterior, teléfono físico ni comprobación de inferencia IA.

**WP-02B, experimento descartado.** Se aisló temporalmente transporte/query de health y se difirió su esquema Codex, manteniendo validación estricta antes de publicar datos y caché única.70 pruebas focalizadas pasaron. Comparando con la variante final que conserva la misma semántica, el ahorro inicial es irrelevante:442.263B frente a442.300B, solo37B; móvil75/LCP4,243s/TBT115,4ms frente a77/4,103s/51,8ms tras revertir. La fase Google solo precede a las correcciones de semántica y no se usa como único control de esta separación. El grafo demuestra que Zod sigue requerido por mobileNavigationStore. Se retiraron esa separación y sus archivos/tests temporales; build final recupera los mismos hashes JS de la variante con semántica previa al experimento. No conservar una optimización por el nombre nuevo de sus chunks ni eliminar validación para obtener un ahorro. BaseModal/editor de accesos y otros límites de carga siguen pendientes.

Regresiones:39 pruebas de auth previas; suite Client1142/182 archivos y238 focalizadas finales/29 archivos, typecheck/lint/build correctos. Pruebas nuevas usan provider real para lifecycle del script y transporte sintético para credenciales; cubren client ID ausente, fallo/reintento, idioma con mutación en vuelo, retorno/reentrada, login exitoso/403/error de transporte. La suite existente cubre expiración/restauración, refresh, permisos, logout y aislamiento de caché. No se ejecutó otro login OAuth real ni logout de la sesión del usuario. Build mantiene warning de chunk>500kB; no se subió el umbral.

**Continuación:** primero completar WP-02B con un límite de UI que demuestre ahorro y recuperación local sin borrar estado. Completar baseline limpio autenticado de Inicio y Reservas antes de aceptar métricas privadas o atribuir ahorro al calendario. WP-03 continúa con la traza de CLS autenticado; WP-04/05/06 mantienen sus dependencias de medición, reconciliación i18n y VPS/HTTPS. La conexión Lighthouse al IAB no está disponible; usar DevTools con sesión legítima/storage conservado para esa aceptación, sin extraer tokens.

## Segunda entrega verificada — editor de accesos por intención (2026-10-10)

**Límite de UI de WP-02B implementado.** MobileBottomNav deja de importar estáticamente MobileShortcutDialog. Al pulsar un espacio, loadShortcutDialog descarga el componente y sus dependencias; props viven en un archivo de tipos sin import de runtime. La navegación permanece disponible. Durante la descarga, controles de edición muestran loading/disabled y texto de estado; fallo muestra alert/toast ES/EN y permite reintentar pulsando el acceso. No se recarga la página ni se monta un modal vacío. Importación satisfactoria compartida; rechazo libera la promesa.

useShortcutDialog cancela la apertura lógica tras cambio de persona/sesión, navegación o desmontaje; la petición de red puede terminar pero su resultado obsoleto no abre ni notifica. Se comprueba sesión actual antes de abrir; persistencia/permisos, validación Zod y fallo de escritura que conserva selección siguen en el flujo existente. Al cerrar/fallar vuelve el foco al iniciador. BaseModal, theme, proveedores temporales y formularios de negocio conservan sus contratos.

Comparación de18 informes (baseline, editor y versión final con protección del foco durante navegación) Lighthouse13.5.0/Chrome154, build productivo4174, tres navegaciones frías secuenciales por perfil/fase, sin extensiones/warnings/runtimeError ni tests/build en paralelo. [Evidencia agregada y hashes](../evidence/web-performance/stage-shortcut-editor-2026-10-10.json); informes completos/grafo fuera del repositorio.

| Mediana | Antes móvil | Final móvil | Antes desktop | Final desktop |
|---|---:|---:|---:|---:|
| Performance |77|78|98|98|
| FCP |4,005s|3,929s|0,880s|0,845s|
| LCP |4,099s|3,942s|0,909s|0,864s|
| TBT |44,5ms|54,1ms|0ms|0ms|
| CLS |0,000170|0,000170|0,000381|0,000381|
| Accesibilidad |100|100|100|100|
| Scripts transferidos |442.300B|427.280B|442.300B|427.280B|

El ahorro inicial de15.020B/3,4% justifica conservar este cambio reversible; grafo confirma editor/BaseModal fuera de imports estáticos. No se obtiene90 móvil ni presupuesto400KiB: quedan~417KiB. TBT móvil aumenta unos10ms en esta repetición y desktop conserva0ms; no afirmar que todas las métricas mejoran. Score desktop estable. **Estos scores corresponden a Inicio sin sesión**, no a la pantalla privada ni a Reservas.

Regresión: suite1153/184 archivos, focal252/36, typecheck/lint/build correctos. Tests nuevos cubren importación solo por intención, bloqueo de duplicados, componente reutilizado, error/retry ES/EN, borrador de página intacto, foco y cancelación ante cambios de contexto. Smoke real5174 conserva cuenta/módulos/indicadores y GIS ausente; assets actuales del editor/BaseModal ausentes antes de abrir y observados después. Inventario acumulado no mide transferencia. Primera apertura observada317ms incluye automatización/AX y no tiene control previo ni throttling: no acredita INP ni ausencia de coste de primera interacción. Selección/búsqueda conservadas390→320px; barra solo<600 y sin overflow en320/390/599/600/900/1200/1440. ES oscuro/EN claro, preferencias/URL originales restauradas; sin guardar accesos, reservas ni otros datos de negocio. Teléfono físico pendiente.

Una repetición de la suite completa concurrente con el build agotó la espera de importación del panel de contactos de ProvidersTab (1152 pasan/1 falla, indicador de carga aún visible). Contención de CPU es una inferencia, no un diagnóstico definitivo. Sin modificar test ni timeout, la prueba aislada13/13 y la suite completa ejecutada sola1153/1153 pasan. Tras añadir la protección de foco durante navegación,27 pruebas focales/6 archivos y typecheck/lint/build finales correctos; se repiten seis auditorías para ese código final. La evidencia distingue las tres fases, sus hashes y este incidente.

DESIGN10.4/10.6 y AGENTS Client/raíz registran patrón, pruebas y límites. Más reducción del shell, baseline Lighthouse autenticado y primera apertura bajo red móvil siguen pendientes; el plan completo no se declara terminado. Traductor sigue condicionado a reconciliar ADR-002, y los otros paquetes compartidos no se eliminan sin evidencia/contratos.

## Tercera entrega — metadatos de iconos administrativos (2026-10-10)

**WP-02B, separación conservada con ahorro.** moduleIcons mantiene el registro y los resolutores originales; IconSelect importa las 91 definiciones desde iconCatalog. Las etiquetas/categorías/keywords dejan el entry y quedan en la ruta lazy de Módulos, sin reexport del catálogo por el barrel generalSettings. No se agregan descargas por icono, loaders, fallback visual ni copias de SVG. La comparación AST confirma claves/orden/metadatos/componentes equivalentes y registro/resolutores idénticos.

Grafo estático inicial: raw1.281.694→1.268.698B y gzip Node406.461→402.991B, ahorro12.996/3.470B (gzip~0,85%). Es una estimación del build, no transferencia HTTP; incluye imports estáticos transitivos y excluye rutas dinámicas. Inicio real autenticado observa index-BqVCewJv sin Modules antes de navegar a esa ruta. Selector administrativo: búsqueda proveedores de ia, selección SmartToyOutlined/PeopleOutlined y limpieza a automático conservadas; escritorio/320px, cancelación sin guardar; sesión/URL/viewport restaurados.72 pruebas/10 archivos, typecheck/lint correctos. Suite completa1153/184 archivos y build final correctos; hashes de assets iniciales coinciden con el grafo analizado.

Referencia privada del usuario, anterior a esta separación: Lighthouse13.4.1, 2026-10-10T23:34:53.281Z, Mobile Navigation y storage conservado; auth/me y authorization/context200. Móvil69, A11y100, buenas prácticas96, SEO82, FCP3,527s, LCP4,387s, TBT341ms, CLS0,06114; scripts427.280B/23 solicitudes. Entry index-BEAcFkBM/api-BW9A_oXG coincide con la segunda entrega. Una corrida con advertencia de extensiones; varias tareas largas y el ahorro de minificación pertenecen a extensiones. No comparar causalmente contra el78 público de Lighthouse13.5.0 ni atribuir todo el JS sin usar a Nodia. No se guarda hash de un original completo de este mensaje; el resumen transcrito identifica esa limitación. [Evidencia agregada y hashes del build nuevo](../evidence/web-performance/stage-shared-icons-2026-10-10.json).

DESIGN10.7/AGENTS documentan el límite de catálogo. Medición posterior privada, tres ejecuciones limpias comparables, móvil90/presupuesto400KiB, otros límites compartidos y aceptación VPS siguen pendientes. No declarar rendimiento privado mejorado por la reducción estática.

## Histórico y checklist

Baseline público anterior: [resumen](../evidence/web-performance/baseline-2026-10-10.json), Lighthouse13.5.0, móvil70/70/71 (mediana LCP5,33s/TBT44,5ms), desktop96 en una ejecución. Es otra versión/sesión/entorno; no usar64 frente a70 como prueba causal de deterioro por autenticación.

Browser Use verificó adicionalmente Reservas con propiedad ID1/agenda real y período vacío; su inventario acumulado de34 scripts incluye phoneNumbers antes de abrir formulario. No es auditoría Lighthouse del módulo ni timing. La conexión automática al IAB sigue sin exponerse; los informes del usuario permiten analizar Inicio sin extraer tokens o modificar sesiones.

- [x] Build y baseline público históricos.
- [x] Informes autenticados de Inicio recibidos, analizados y resumidos sin secretos.
- [x] Plan y proceso documental en DESIGN/AGENTS.
- [x] Plan aprobado por mensaje explícito del usuario; implementación por etapas autorizada.
- [ ] WP-01: baseline limpio, repetición y matriz de rutas completas.
- [x] WP-02A: Google limitado a Login, pruebas y comparación pública verificadas; aceptación Lighthouse autenticada pendiente.
- [x] WP-02B: editor de accesos/BaseModal por intención, recuperación local y ahorro inicial verificados; aceptación Lighthouse privada/primera interacción con throttling pendientes.
- [x] WP-02B: metadatos de iconos administrativos fuera de Inicio; equivalencia y ahorro estático verificados, medición privada posterior pendiente.
- [ ] WP-02B: otros límites de entrada compartida y presupuesto inicial; experimento health descartado.
- [x] WP-03: correcciones de listas, nombre accesible ES/EN y encabezado del vacío verificadas.
- [ ] WP-03: causa/corrección de CLS autenticado y revalidación visual completa.
- [ ] WP-04: división interna de Reservas.
- [ ] WP-05: recursos/perfil; i18n condicionado.
- [ ] WP-06: HTTPS/regresión/evidencia y actualización de pautas por etapa.
- [ ] Core Web Vitals de campo y aceptación física móvil.
