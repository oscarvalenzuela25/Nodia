# Noticias — investigación NEWS-01 y lecturas reales

Fecha2026-11-16. Rama `codex/news-implementation`; comprobaciones desde el equipo
local, sin credenciales, escrituras externas ni llamadas desde Nodia. Evidencia
de viabilidad de fuentes; no acredita adaptadores productivos, UI o concurrencia.

## RSS oficiales

| URL comprobada | HTTP / bytes recibidos / entradas XML | Campos observados y validadores |
| --- | --- | --- |
| `https://web.dev/feed.xml` → `https://web.dev/static/blog/feed.xml` | 200 /5157bytes /10 | Primera entrada: title, link, pubDate, guid, description. Last-Modified presente, ETag ausente |
| `https://nodejs.org/en/feed/blog.xml` | 200 /328143bytes /1074 | Primera entrada: title, link, pubDate, guid. Sin ETag/Last-Modified en esta respuesta |
| `https://github.blog/changelog/feed/` | 200 /34389bytes /10 | Título/enlace/publicación/GUID, categorías, creador, descripción y cuerpo HTML. ETag/Last-Modified presentes; Cache-Control max-age=300, must-revalidate |

Las respuestas no incluían cabeceras de cuota identificadas. No se encontró
asignación fija diaria/mensual en las páginas revisadas de estos feeds. Eso no
prueba ausencia absoluta de restricciones ni disponibilidad ilimitada; repetir
evaluación ante cambios de condiciones. Cantidades y validadores son de estas
respuestas puntuales, no límites ni contratos del editor.

La validación Python de GitHub rechazó el certificado como expirado; la lectura
posterior con `curl.exe` de Windows verificó TLS y devolvió200, sin `--insecure`.
No se modificaron almacenes de confianza ni se atribuye la diferencia al Server
de Nodia. No se conservaron artículos completos como evidencia.

Fuentes primarias de exhibición y atribución:

- [web.dev: migración y continuidad de licencia](https://web.dev/blog/webdev-migration)
  y [políticas Google Developers](https://developers.google.com/terms/site-policies):
  CC BY4.0 salvo excepciones, atribución/enlace y señalización de modificaciones;
  marcas y medios pueden tener condiciones distintas.
- [Licencia del sitio Node.js](https://github.com/nodejs/nodejs.org/blob/main/LICENSE):
  MIT para software/documentación asociada, con conservación de avisos. Alcance
  particular de activos/contenidos por completar antes de activar esa candidata.
- [GitHub Changelog](https://github.blog/changelog/) y
  [términos GitHub](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service):
  RSS publicado no acredita licencia general para reutilizar cuerpo/medios del blog.

## daily.dev

[API](https://docs.daily.dev/public-api/): beta, Free200peticiones/30días,
60/min por cuenta y300/min por IP; Plus elimina la asignación mensual, no los
límites por minuto. Presupuesto compartido entre tokens/OAuth/MCP. Son cifras
documentales, sin cuenta, saldo o respuesta autenticada comprobados.

GET directo de [términos](https://daily.dev/tos/) respondió200 y permitió leer §18;
el lector web no recuperó inicialmente el texto completo. SHA256 del HTML:
`eb224215ab044d1fdddee6d30078a67d643d2269e0609d8b38b6c99802850b02`.
SHA256 del texto §18 normalizado por el arnés de lectura:
`ba67a016a3eee8c12c078b1546b79282e7256e58044e5d4796145ea084e6e5af`.
Los hashes identifican esa lectura, no un archivo duradero descargable.

§18.2 exige credenciales propias en herramientas distribuidas. §18.3 restringe
servir datos a terceros, compartir tokens y productos competidores de agregación
de noticias técnicas; permite metadatos con atribución bajo el resto de condiciones.
La caché debe ser limitada y retirarse en los supuestos de §18.7. Inferencia para
Nodia: aclarar compatibilidad/permiso del proveedor antes de habilitar News con
daily.dev; ni login Nodia ni OAuth individual resuelven esa cláusula por sí solos.

[OAuth](https://docs.daily.dev/oauth-apps/) documenta PKCE e intercambio en Server;
`read` para lecturas, `offline_access` sólo si se requiere renovación. Cuenta/app,
custodia cifrada, revocación y política concreta de caché siguen pendientes.
[Precios actuales](https://daily.dev/pricing/) ya presentan mayores límites API
como beneficio Plus; la discrepancia histórica de acceso sólo Plus no se mantiene
en esas páginas, sin acreditar disponibilidad de una cuenta real.

Resultado: [catálogo](../features/news/source-catalog.md) propone web.dev primero;
Node/GitHub siguen candidatas y daily.dev autenticada/deshabilitada por condiciones.
No se contactó al proveedor, registró OAuth, compró un plan ni solicitó credenciales.
