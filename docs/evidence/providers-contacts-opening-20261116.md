# Apertura de Contactos de proveedores — 2026-11-16

## Reporte, fuentes y alcance

El usuario reporta Crear proveedor→Contactos→error/404 y confirma **producción**.
Regla vigente y continuidad en
[plan31](../mvp/31-provider-contacts-proposal.md#apertura-recuperable-de-contactos--incidencia-de-producción2026-11-16).
Corrección local en `codex/fixes-invoice-ocr`, misma rama del lote de fixes OCR.
El recorrido autenticado original de producción sigue sin causa aislada;
lectura autenticada fiable no obtenida por timeout de captura. No se acredita
resolución productiva, despliegue ni cambio de Server/DB por esta evidencia.

Contrato contrastado en
[controlador](../../nodia-server/src/provider-contact/provider-contact.controller.ts)
y [caso de uso](../../nodia-server/src/provider-contact/use-case/get-provider-contacts.use-case.ts):
`GET /api/v1/providers/:providerId/contacts`; proveedor autorizado sin contactos
responde200 vacío, proveedor inexistente/fuera de alcance responde404. Un error
no debe convertirse en una lista vacía. Contratos/IDs/ownership permanecen iguales.

## Confirmación posterior del usuario — 2026-11-16

A la pregunta de si el error persiste después de recargar y volver a abrir el
proveedor, el usuario responde: **«Se corrige al recargar»**. Se registra como
recuperación humana del síntoma en producción, sin observación nueva del agente
ni cambio de datos o despliegue. Es compatible con carga transitoria o una
versión anterior abierta; no demuestra caché, service worker ni petición exacta
como causa. El fix local sigue sin adoptar y no se acredita solución permanente.

## Assets observados en producción, sólo lectura y sin sesión

Origen [Nodia en Pages](https://nodia-1ge.pages.dev/). Reporte local ignorado:
`.tmp/production-contacts-assets-20261116/asset-audit.json`; análisis del grafo
`contacts-static-graph.json`.133URLs totales: las132iniciales (índice HTML y
131assets JavaScript) más CSS de preload `index-DLMTkNwc.css`, todasHTTP200.
123respuestas `text/javascript`,8 `application/javascript`, un índiceHTML y
un `text/css`; ninguna respuesta HTML usada como JavaScript. Son observaciones del instante
consultado, sin afirmar el estado de caché/peticiones del incidente anterior.

| Archivo | Bytes / SHA256 |
| --- | --- |
| Índice `/` | 3640 / `73b3ff6d819d7dbc7add8ff637f258268b8e60baeb1a6f16e5d7620ff3cc9ce3` |
| [ProviderContacts-ORme97nj.js](https://nodia-1ge.pages.dev/assets/ProviderContacts-ORme97nj.js) | 22135 / `a10748998e22d225fe817ef020c5348b58f0007800759555d4dc3ae8cc0f19fc` |

La respuesta del chunk registró Date `2026-11-17 00:05:32 GMT`, equivalente a
2026-11-16 21:05:32 America/Santiago; `text/javascript; charset=utf-8` y200.
Grafo observado:34imports directos/58alcanzables, sin componentes fuertemente
conexas de más de un nodo detectadas por ese análisis estático. Evaluación Chromium anónima del módulo de producción exacto:
`typeof default === "function"`, cero errores JavaScript. No prueba montaje del
panel bajo sesión, GET autenticado, permiso o funcionamiento comercial.

También se montó localmente una copia byteidéntica del grafo publicado con su
React/QueryProvider/queryClient. Únicamente el renderer local
react-dom-client.production19.2.8 se empaquetó para la raíz sintética, usando la
misma instancia React publicada. ProviderId sintético999999999, sesión inactiva
y GET de contactos deshabilitado: panel y modal Agregar contacto renderizan,
cero errores/warnings, sin guardar. La redirección /fixture.html→/404 en la raíz
del bootstrap original es esperada por una ruta local inexistente; la raíz
sintética continuó funcionando. Ese404 de fixture no reproduce el reporte del
usuario. Resultado en `browser-checks.json`; no acredita sesión/datos reales,
caché histórico o service worker. El evaluador y servidor propio5198 se cerraron.

La evidencia actual no respalda atribuir el incidente a un asset hoy ausente:
ese chunk y dependencias observados están accesibles. Tampoco descarta una
petición histórica distinta o identifica otra causa. No se fuerza una causa
para declarar resuelto el reporte del usuario.

## Reproducción local y candidato

Con ProvidersTab real y proveedor sintético QA100, simular404 de importación al
abrir Contactos después del alta llevó la versión anterior al `RouteError`
global. Es un defecto de contención reproducido localmente; no es reproducción
del fallo original autenticado de producción ni una escritura HTTP real.

Candidato: loader por intención, importación satisfactoria compartida y promesa
rechazada liberada para reintento local. Mantiene listado/búsqueda/página y
borradores durante descarga/fallo; Alert/toast traducidos, foco recuperable y
sin recarga global. La apertura captura actor/sessionVersion/negocio/proveedor;
cambios de contexto y resoluciones tardías no abren el panel anterior. El código
cargado se puede reutilizar, la autorización y las consultas conservan su ámbito.

Focal final:67casos/9archivos correctos, incluidos12atómicos del hook/loader y
dos integraciones nuevas del padre (crear→Contactos y reject/retry). No se suman
subconjuntos como pruebas diferentes. Global final del árbol de código congelado:
3139pruebas/380archivos correctos en283,97s, iniciada a21:09:20 America/Santiago.
Tipos y lint finales correctos; build final39,45s (`.tmp/providers-build-final.log`),
con advertencia de chunks mayores de500KB, sin error. La comprobación incluye
el ajuste de foco final; no se heredan resultados del corte defectuoso.

Primera QA posterior1440px: crear proveedor100, fallo de importación404 simulado
queda en Alert local con tabla conservada; retry sin recarga abre el vacío del
mismo proveedor. Se detectó fallo de foco: se intentaba devolver antes de que el
botón estuviese habilitado. Se corrigió con restauración tras el commit de estado
(useLayoutEffect) y regresión que falla antes/pasa después. ReQA posterior1440
confirmó foco `provider-contacts-100`, antes null; no se hereda un resultado del
corte defectuoso.

QA final Chromium fresh, sin HMR, ES/oscuro:3anchos320/600/1440 por2estados
(fallo y panel saludable). Crear100→import404 simulado conserva Alert y tabla,
con foco devuelto al botón. Búsqueda «recién» permanece al redimensionar, reintentar
sin recarga, abrir vacío del mismo proveedor y Volver. A320, fallo: documento310
frente a viewport320; Alert278×128,08px en x16, accesible. A600/1440, documento
igual al viewport. Reintentar a320 abre encabezado exacto y Empty State del mismo
proveedor; panel saludable conserva estado y documento igual al viewport al
pasar320/600/1440, sin overflow. Inspección visual de ambos estados a320 correcta.
Capturas `provider-failure-*.png`/`provider-contacts-*.png` en `output/playwright/`,
ignoradas. Consola fresh:0excepcionesJavaScript;2errores esperados de recursos,
favicon404 y script404inyectado. No prueba teléfono físico ni sesión humana real.
Capturas y reportes de pruebas se conservan en `output/`/`.tmp/` ignorados.

## Contexto NodiaAI y siguiente paso

Cambio de presentación/recuperación, sin conceptos, contratos HTTP, herramientas,
permisos o persistencia nuevos. La ficha aprobada `businesses.supplier-contacts`
conserva sus bytes/aprobación; modificar su fuente plan31 cambia procedencia
compilada, no una autorización. El candidato tiene check/build y pins propios
al cerrar las fuentes; el recibo exacto del último check se registra abajo. No
constituye publicación operativa ni autorización de despliegue.

Aclaración posterior recibida: recargar corrige el fallo observado, según el
usuario. Primer pendiente: revisión/integración/adopción del fix local, sin
nueva autorización de despliegue. Si reaparece, capturar petición/error y versión
afectados para aislar la causa. Los assets públicos, fixtures, tests y la
recuperación por recarga no acreditan una solución permanente ni adopción del fix.

## Conocimiento y pins del candidato

Plan31 es fuente de ocho documentos publicados: businesses-and-collaborators,
confirmed-business-effects, invoice-analysis, invoices-and-files, product-logs,
products, supplier-contacts y suppliers. Cambian sus referencias de procedencia;
los44archivos aprobados, sus cuerpos y el registro de capacidades se conservan.
El build local actualiza manifest y pins de src/dist mediante scripts soportados,
con96fuentes/52excluidas,44documentos/46fragmentos y153capacidades. El resultado
final y release exacto se añaden aquí, sin insertarlos en plan31 para evitar
una dependencia circular de hashes. No es adopción/publicación de conocimiento.

Check/build de conocimiento y58regresiones del compilador/pin correctos; verificador
final96/52/44/46/153 y2118enlaces locales, pins src/dist exactos. Release local:
`80b3530b784e2b6783758daf477ef4159f2b048d1220ae4892f8487756c01368`;
catálogo `nodia-ai-business-pos/4`, schema
`cc93ecb978c5e74f6a3492661da8bcd4b4bdce0afc0da57efdc678ea21b1d23c`.
Los44archivos aprobados completos permanecen byte-intactos respecto de HEAD.
Sin cambio del registro, publicación operativa o adopción. El release anterior
OCR conserva su recibo; este candidato añade sólo nueva procedencia de plan31.

### Revalidación documental tras la respuesta del usuario

Después de registrar la recuperación por recarga en plan31 e índices, check/build
locales y las58regresiones de conocimiento pasan; verificador2118enlaces y pins
src/dist correctos. Release del candidato documental:
`5dd6e76f3a29d90dab84224c12334e9455828549077c885dcb4a8ded86703d20`.
Conserva96fuentes/52excluidas,44documentos/46fragmentos/153capacidades y los bytes
de las fichas aprobadas. El cambio es documental: no se repiten pruebas de UI,
no se modifica código y no se despliega. El recibo del corte anterior permanece
como antecedente, sin reescribir sus resultados.
