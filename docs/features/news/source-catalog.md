# Noticias — catálogo y política de fuentes

> La [renovación del catálogo](../../mvp/105-on-demand-tech-news.md#16-renovación-del-catálogo-de-noticias-dev--2026-11-18)
> retira web.dev y Node.js de la rama y prepara Go, Rust y Kubernetes para
> lectura pública y actualización administrativa explícita. El historial
> NEWS-01–06 explica el catálogo que se publicó inicialmente.

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

## Catálogo actualizado

| Fuente / destino real | Clase de acceso prevista | Decisión y condiciones |
| --- | --- | --- |
| [The Go Blog](https://go.dev/blog/feed.atom) | Lectura pública, actualización exclusiva de super_admin | Programación. Atom oficial sobre Go, paquetes y herramientas. El sitio publica licencia CC BY 4.0 salvo excepciones. [Licencia](https://go.dev/copyright) |
| [Rust Blog](https://blog.rust-lang.org/feed.xml) | Lectura pública, actualización exclusiva de super_admin | Programación. Atom oficial sobre lanzamientos y proyectos del ecosistema Rust. El repositorio del blog ofrece MIT o Apache 2.0. Se conserva el aviso MIT. [Repositorio oficial](https://github.com/rust-lang/blog.rust-lang.org) |
| [Kubernetes Blog](https://kubernetes.io/feed.xml) | Lectura pública, actualización exclusiva de super_admin | Tecnología. RSS oficial sobre infraestructura y operación cloud-native. Se atribuye al blog y se enlaza la licencia CC BY 4.0 del sitio. [Licencia](https://github.com/kubernetes/website/blob/main/LICENSE) |
| web.dev RSS y Node.js RSS | Retiradas del catálogo de la rama | Sus claves dejan de admitirse para actualización y filtro. Se conservan los snapshots históricos fuera de lectura pública para reversión. |
| [GitHub Changelog RSS](https://github.blog/changelog/feed/) | Candidata pública en evaluación | Feed real comprobado, pero las condiciones de redistribución del blog no se deducen de su disponibilidad. No habilitar extractos/cuerpo/imágenes ni declarar cerrados los derechos de tarjeta hasta resolverlos |
| [daily.dev REST](https://docs.daily.dev/public-api/) | Sólo autenticados, además de autorización del proveedor; deshabilitada inicialmente | Tiene cupo Free periódico. No usar token compartido. Aclarar compatibilidad de News con §18 de sus términos antes de construir la conexión; OAuth individual es la vía técnica candidata si se autoriza |
| [DEV Community](https://dev.to/help/getting-started) y [Hacker News](https://news.ycombinator.com/rss) | Candidatas de comunidad en evaluación | Feeds activos. Las condiciones de DEV para exhibición pública y las de [Hacker News](https://www.ycombinator.com/legal/#tou) requieren revisión antes de habilitarlos. |
| [Hugging Face Blog](https://huggingface.co/blog) | Candidata de IA en evaluación | El feed incluye publicaciones de distinta titularidad. Revisar alcance de exhibición antes de incorporar la fuente. [Términos del sitio](https://huggingface.co/terms-of-service) |

Las tres fuentes seleccionadas respondieron sin cuenta ni token. La revisión
documental de sus feeds no identificó una asignación fija periódica. El orden
de atribución sólo determina la procedencia primaria al deduplicar un enlace;
cada actualización consulta la fuente elegida. El catálogo se prepara en la
rama para entregar Client y Server juntos.

## Campos, atribución y retención de feeds públicos

Límites locales de Nodia por fuente:

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
- Mostrar título, fecha de publicación cuando el feed la proporciona, fuente,
  enlace original y enlace de licencia. El aviso MIT se muestra en cada tarjeta
  con procedencia Rust. Los campos de extracto y autor quedan en `null`.
- Separar fecha de publicación, recepción y último intento. Go y Rust cubren
  Programación. Kubernetes cubre Tecnología. IA queda como filtro de catálogo
  para fuentes futuras que cumplan las reglas de acceso.

Go y Rust conservan un máximo de 1 MiB por respuesta. El RSS de Kubernetes
superó ese límite en la revisión y tiene un máximo propio de 2 MiB. Todos
conservan 10 s de plazo total y un máximo de 100 artículos normalizados por
fuente. La revisión incluye el tamaño y la fecha observados en cada feed.
[Evidencia de la renovación](../../evidence/news-dev-source-refresh-20261118.md)

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
