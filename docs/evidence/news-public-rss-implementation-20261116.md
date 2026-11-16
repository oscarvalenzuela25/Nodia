# Noticias públicas — primera integración RSS local

Fecha2026-11-16, rama `codex/news-implementation`, base development `2585b767`.
[Plan105§9](../mvp/105-on-demand-tech-news.md#9-obtención-exclusiva-super_admin-y-primera-integración-rss--2026-11-16)
y [contratos](../features/news/http-contract.md). Implementación local, sin
adopción en BD configurada, VM o producción, ni aprobación/publicación de fichas.

## Resultado implementado

- Ruta pública `/news` bajo el shell auténtico, enlace fijo inmediatamente después
  de Home en sidenav/drawer. Filtros/paginación de datos conservados; no módulo,
  rol o sesión para leer. El lifecycle de sesión sigue único; recuperación inválida
  no bloquea esta ruta y los destinos privados mantienen su comportamiento.
- `GET /api/v1/news` público sin consumo externo. `POST /api/v1/news/refresh`
  con fuente explícita, sesión real y super_admin activo actual antes de reservar
  y publicar. La UI oculta el botón a otros actores; Server es la barrera efectiva.
- Primer catálogo habilitado en código: web.dev RSS. Tarjetas de texto, metadatos
  opcionales reales, atribución/licencia y enlace original. daily.dev sigue
  deshabilitada; Node/GitHub son candidatas, sin fallback automático.
- Migración1793670000000 añade sólo snapshot público acotado a100artículos/fuente.
  Reserva durable, fencing, lease30s y enfriamiento15min compartidos; descarga
  fuera de transacción SQL. Caducidad lógica7días, poda física al siguiente refresh,
  sin janitor temporal ni promesa de borrado físico exacto al séptimo día.
- HTTPS fijo con DNS público fijado, TLS normal y rechazo de redirecciones;
  deadline10s, cuerpo máximo1MiB, máximo500entradas XML y100artículos normalizados.
  DTD/entidades externas rechazadas, XML/HTML con parsers, salida de texto plano.
  Respuestas304/error cierran cuerpos innecesarios; sin replay automático.

## Pruebas y comprobaciones

| Comprobación | Resultado / alcance |
| --- | --- |
| Client completo | 3078casos/374archivos correctos, `npm run test -- --maxWorkers=4`;453.45s. Avisos históricos jsdom de navegación/canvas/media, sin fallo |
| Server completo |6088correctos,1omitido/355archivos, `npm run test -- --maxWorkers=4`;218.72s. Omisión histórica condicionada a Linux en api-nodia-ai-runtime-owner.spec.ts; ningún caso nuevo omitido |
| Focales Client |44casos/7archivos correctos; hook6casos revalidado tras último ajuste de sesión |
| Server focal |43casos correctos, incluidos política HTTP, normalización, transporte y casos de uso; última regresión identidad previa al agrupado URL correcta |
| PostgreSQL/HTTP aislado |9gates correctos con Nest compilado, PostgreSQL16 Docker propio y eliminación final comprobada. Sin BD configurada ni proveedor real; upstream y parser de tokens con fixtures |
| RSS real |Una llamada desde `NewsFeedClient` compilado, status updated,10artículos, títulos/enlaces válidos, validador HTTP presente. Sin credenciales ni llamadas a BD |
| Tipos/build |Client `tsc -b` y build correctos; Server build completo correcto, incluidos corpus/políticas/contexto. No se inició la aplicación con configuración real |
| Lint |Client correcto excluyendo `.tmp/**` experimental; Server correcto con aviso histórico `no-unsafe-finally` en fixture ajena |
| Dependencias Server |14nodos añadidos, ninguna versión existente cambiada ni vulnerabilidad identificada en el grafo añadido; auditoría global19avisos previos, sin actualización masiva |

Suites globales Client/Server correctas, ejecutadas sin builds pesados concurrentes.
La suite de Server conserva logs de errores/fallos sintéticos esperados; no son
incidencias de proveedores reales. No se alteraron timeouts o assertions para pasar.

El build Client conserva aviso de chunks>500kB. El chunk News mide18.07kB,
7.03kB gzip en este artefacto; no es una comparación de rendimiento ni ahorro
de red acreditado. Corpus44documentos/46fragmentos publicados conservados,
96fuentes/52excluidas; Noticias permanece excluida de publicación NodiaAI.

### Gates de PostgreSQL y HTTP compilado

1. Migración `up/down/up` exclusivamente sobre caché descartable.
2. GET sin red, rol actual/asignación inactiva y enfriamiento.
3. Dos instancias de caso de uso y una sola reserva/consulta simulada.
4. GUID cambiado/misma URL, ID canónico y304 que renueva sólo el último feed.
5. Fallo conserva contenido/último éxito y respeta Retry-After.
6. Revocación del rol durante la red impide publicar.
7. Resultado y limpieza de lease obsoleto no pisan otra reserva.
8. Caducidad lógica excluye vencidos; refresh poda snapshot físico.
9. Nest real: GET público, POST protegido, validación, rol/sesión y paginación.

Los guards y SQL son reales; la identificación inicial por token del arnés es
sintética. No se acredita login Google/JWT real de una cuenta, disponibilidad
daily.dev o aceptación en otro entorno.

## QA Chromium sintética

Se ejercitó la ruta auténtica con fixtures sólo del arnés local, no tarjetas
ficticias de producción.320/600/900/1440px × oscuro ES/claro EN: sin overflow
horizontal,3tarjetas únicas, medios ausentes y recepción diferenciada de publicación.
Tras estabilizar transiciones del shell, alturas máximas observadas1827px en
320oscuro y1627px en320claro; sin crecimiento residual del documento.

Tema IA sin resultados, selección/foco conservados al cambiar a320px y Quitar
filtros correcto. Drawer móvil mantiene Home→Noticias, Escape cierra y devuelve
foco. Visitante sin botón ni POST; fixtures de super_admin permiten un POST
explícito503 y mantienen3tarjetas con error/toast. Sesión histórica cuyo `auth/me`
devuelve503 mantiene lectura y retira el botón. Pruebas de doble envío/cambio de
actor y barreras privadas complementadas por unidades/integración.

El primer arnés autenticado omitía el GET de health del topbar y recibió502 del
proxy local; se corrigió el fixture y se repitió sin cambiar producto ni proveedores.
Los503 de auth/refresh son fallos inyectados, no incidencias del servicio real.
Capturas y logs de trabajo en `output/playwright/` y `.tmp/news-verification/`,
ignorados; este informe conserva la evidencia duradera y no depende de esos logs.

## Límites y continuidad

No se aplicó la migración a la BD de trabajo ni se desplegó. Pendientes revisión
humana con sesión auténtica/teléfono, adopción por entorno solicitada por separado,
segunda fuente y condiciones daily.dev. La prueba RSS real sólo califica esa
lectura desde este equipo; no promete disponibilidad permanente o llamadas ilimitadas.
No cambia herramientas/grants IA, APIs históricas o contenido aprobado firmado.

Cierre: contenedor PostgreSQL descartable eliminado, navegador Chromium de QA
cerrado y servidor Vite5186 detenido. `git diff --check`, UTF-8/LF de60archivos
editados/nuevos y1022destinos de enlaces locales comprobados sin errores. Temporales
de pruebas fuera del código productivo; sin migraciones/adopciones adicionales.
