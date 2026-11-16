# Noticias — catálogo inicial y política de fuentes

> NEWS-01, revisión2026-11-16. Fuente de alcance: [plan105§8](../../mvp/105-on-demand-tech-news.md#8-news-01-acceso-público-y-catálogo-inicial--2026-11-16).
> Reglas de acceso confirmadas por el usuario; selección técnica propuesta para
> implementación. Corte inicial de investigación; la continuación de NEWS-02/03
> implementa web.dev localmente según la [evidencia nueva](../../evidence/news-public-rss-implementation-20261116.md),
> sin adopción en un entorno o cuenta daily.dev.

> Revisión posterior de la misma fecha: [plan105§9](../../mvp/105-on-demand-tech-news.md#9-obtención-exclusiva-super_admin-y-primera-integración-rss--2026-11-16)
> restringe **toda obtención externa a super_admin activo**. La lectura pública
> sigue disponible; [contratos NEWS-02/03](http-contract.md) implementados para
> primera fuente RSS con verificación local por alcance.
>
> NEWS-04: Node.js se incorpora como segunda fuente local de metadata por
> [revisión primaria y avisos](../../evidence/news-nodejs-source-review-20261116.md).
> Web.dev y Node.js comparten lectura pública; sus actualizaciones siguen siendo
> explícitas y exclusivas de super_admin, con estado/caché independientes.

## Acceso y criterio de selección

- `/news` se podrá leer sin sesión, con enlace fijo inmediatamente debajo de
  Home en sidenav/drawer, antes de los grupos privados. No exige asignación de
  módulo ni rol. No se añade otro acceso fijo a MobileBottomNav por esta petición.
- Anónimos: sólo fuentes gratuitas que no tengan una asignación fija de llamadas
  por día/mes u otro período de consumo. Una API gratuita con cupo mensual también
  queda fuera de esta capa. La ausencia de una cuota publicada se registra como
  tal; no como garantía de llamadas ilimitadas o disponibilidad permanente.
- Toda actualización externa, incluso RSS gratuito, exige sesión Nodia válida y
  rol `super_admin` activo en BD actual. Resto de usuarios/anónimos sólo leen
  resultados conservados; no necesitan módulo ni pueden disparar consumo.
- Lectura de fuentes con cuota: reservada a sesiones válidas y condiciones del
  proveedor. Esta regla no las habilita: daily.dev sigue deshabilitada y su feed
  personal no puede redistribuirse por decidir que el fetch es administrativo.
- Una fuente de cuota desconocida no se habilita automáticamente como gratuita.
  La revisión de RSS oficiales sin plan/cuota identificados permite proponerlos
  con esa limitación explícita; un 200 aislado no acredita términos o capacidad.
- Leer caché no evita la clasificación: metadatos de una fuente limitada tampoco
  se vuelven públicos por guardarlos, agrupar URLs o consultarlos desde Server.

## Catálogo de esta entrega

| Fuente / destino real | Clase de acceso prevista | Decisión y condiciones |
| --- | --- | --- |
| [web.dev RSS](https://web.dev/static/blog/feed.xml) | Lectura pública; fetch exclusivo super_admin, sin asignación fija identificada en la revisión | Primera fuente local implementada en NEWS-03. Gratis y accesible sin credenciales; contenido CC BY4.0 salvo excepciones. Título/URL/publicación y procedencia, descripción saneada y atribución/licencia; sin imágenes en esta integración |
| [Node.js RSS](https://nodejs.org/en/feed/blog.xml) | Lectura pública; fetch exclusivo super_admin, sin asignación fija identificada | Segunda fuente local NEWS-04: título/URL/publicación; extracto/autor null y sin medios. Generador y metadata trazados a nodejs/nodejs.org; MIT del sitio y aviso completo conservados en `/legal/news-nodejs-notice.txt`, con licencia original y reconocimiento de marca. [Evidencia y límites](../../evidence/news-nodejs-source-review-20261116.md) |
| [GitHub Changelog RSS](https://github.blog/changelog/feed/) | Candidata pública en evaluación | Feed real comprobado, pero las condiciones de redistribución del blog no se deducen de su disponibilidad. No habilitar extractos/cuerpo/imágenes ni declarar cerrados los derechos de tarjeta hasta resolverlos |
| [daily.dev REST](https://docs.daily.dev/public-api/) | Sólo autenticados, además de autorización del proveedor; deshabilitada inicialmente | Tiene cupo Free periódico. No usar token compartido. Aclarar compatibilidad de News con §18 de sus términos antes de construir la conexión; OAuth individual es la vía técnica candidata si se autoriza |
| DEV / Hacker News | Sin clasificación ejecutable en esta entrega | Fuera del primer catálogo habilitable; investigación histórica no equivale a adopción. Revisar condiciones/cuota antes de asignar capa de acceso |

Ninguna fila activa una fuente en producción. La primera entrega se reordena
expresamente hacia RSS público, atendiendo al nuevo alcance y al impedimento
documentado de daily.dev. No hay fallback automático entre fuentes.

## Campos, atribución y retención para RSS público

Política local implementada para web.dev y Node.js, no cuota del editor:

- Retener metadatos normalizados durante7días desde su última aparición en una
  consulta correcta. Snapshot acotado a100artículos por fuente según NEWS-02,
  antes de persistir; sin descargar automáticamente detalles por artículo.
  No almacenar XML crudo, HTML completo, artículos ni imágenes en el runtime.
- Frescura compartida de15minutos por fuente: un botón dentro de esa ventana
  reutiliza el resultado y comunica que no hubo nueva consulta externa. Al vencer,
  el siguiente clic del super_admin puede actualizar; entrar o filtrar nunca
  consulta al editor y un usuario ordinario no puede forzar la actualización.
  No se añade un cron para obtener noticias.
- Un fallo mantiene resultados conservados mientras estén dentro de retención;
  no renueva su última aparición ni inventa una fecha de éxito. Pasados7días,
  se excluyen de lectura; la siguiente reserva/finalización de actualización
  poda el snapshot persistido. Esta entrega no programa purga física independiente:
  sin nuevas actualizaciones pueden quedar metadatos vencidos en la fila, siempre
  excluidos de lectura y acotados al máximo100. No prometer borrado físico exacto
  al séptimo día; una política temporal física necesita mantenimiento separado.
- Mostrar fuente, autor si existe, enlace original y enlace de licencia cuando
  corresponda. Descripción abreviada/saneada identificada como tal; omitir campos
  ausentes. No aplicar la licencia del texto a marcas o medios de terceros.
- Separar fecha de publicación, recepción, última consulta e indicador de caché.
  Taxonomía inicial de producto: Tecnología / Programación / IA; clasificación
  mediante mapeo explícito de categorías verificadas. Para web.dev usar Programación
  como ámbito del catálogo, igual que Node.js, sin etiquetar IA por coincidencias
  de título inventadas.

Node.js entrega historia completa: se permiten como máximo2000entradas XML
frente a500de web.dev, manteniendo1MiB/10s de transporte y100normalizadas por
fuente. El GET real de revisión contenía1074entradas/328143bytes; no se presupone
que el editor mantenga ese tamaño. No se consultan cuerpos para completar campos.
El aviso MIT completo se sirve con Client y se enlaza en toda tarjeta con
procedencia Node.js, incluso si web.dev es la primaria. Logos y medios siguen
fuera del alcance; la atribución no implica patrocinio.

En el feed combinado se agrupan URLs normalizadas idénticas en una tarjeta,
con todas las procedencias vigentes y sus licencias. Filtrar por fuente cambia
la metadata primaria a esa fuente, sin copiar extractos entre editores. Fallo,
enfriamiento, validadores HTTP y reserva de una fuente no alteran la otra.

Los valores7días/15minutos son decisiones de Nodia implementadas en este alcance
local. No equivalen al `Cache-Control` del proveedor ni a un permiso para
persistir cualquier fuente; daily.dev necesita otra política tras aclarar términos.

## Integración prevista

Server consulta únicamente un catálogo administrado con destinos/redirecciones
permitidos, límites de bytes/elementos/tiempo y XML sin entidades externas. Consulta
compartida y exclusión mutua por fuente pública, con enfriamiento local, validadores
HTTP cuando existan y respeto de `Retry-After`; no hacer un GET upstream por lector.
Los umbrales de protección local se muestran como controles de Nodia, sin inventar
una cuota del editor. Resolver SSRF y DNS/redirecciones antes de habilitar feeds.

Lectura pública y lectura/actualización de fuentes limitadas tendrán contratos
separados. El Server determina la capa y no acepta que el body, query o cabecera
del cliente declare una fuente como pública. Caché compartida sólo para datos
públicos autorizados; caché de fuentes limitadas por actor/cuenta. Logout, cambio
de cuenta y revocación retiran los datos privados sin cerrar el feed público.
Deduplicar por URL no permite filtrar procedencias privadas hacia el resultado anónimo.

## Evidencia y dependencias

[Comprobación de fuentes](../../evidence/news-source-discovery-20261116.md):
GET reales de tres RSS, límites de la revisión y fuentes de licencia/términos.
[ADR105 propuesto](../../architecture/decisions/ADR-105-public-news-and-source-access-tiers.md)
delimita la excepción pública; [diseño editorial](editorial-design.md) mantiene el
shell auténtico. Cuenta/app daily.dev, términos específicos y sus pruebas siguen
pendientes. No se solicitan secretos ni se crean cuentas por este corte.
