# Renovación de fuentes para Noticias dev — 2026-11-18

En `codex/dev-news-sources` se probaron los feeds con HTTPS verificado, sin
credenciales y con el mismo tipo de petición HTTP que usa Nodia. Los tamaños y
fechas registran la observación puntual de cada feed. El objetivo de este corte
es sustituir web.dev y Node.js por fuentes con publicaciones recientes y
cobertura de programación e infraestructura.

| Fuente | Respuesta y formato | Entradas | Fecha de la primera entrada observada | Atribución |
| --- | --- | ---: | --- | --- |
| [The Go Blog](https://go.dev/blog/feed.atom) | 200, Atom, 362 800 bytes | 10 | 10 de noviembre | [CC BY 4.0 del sitio](https://go.dev/copyright) |
| [Rust Blog](https://blog.rust-lang.org/feed.xml) | 200, Atom, 170 448 bytes | 10 | 16 de noviembre | [MIT del blog oficial](https://github.com/rust-lang/blog.rust-lang.org/blob/5b42e9f522217dd60b9f2258b10c98f6601b7cc2/LICENSE-MIT) |
| [Kubernetes Blog](https://kubernetes.io/feed.xml) | 200, RSS, 1 111 814 bytes | 50 | 16 de noviembre | [CC BY 4.0 del sitio](https://github.com/kubernetes/website/blob/main/LICENSE) |

Go y Rust proporcionan `published` y `updated` por entrada. Nodia guarda la
fecha de `published`. Kubernetes publica `pubDate`; su feed necesita un límite
propio de 2 MiB para la respuesta observada. Se mantiene el plazo total de 10 s.
Las tres fuentes aportan título, URL original, publicación y procedencia. El
aviso MIT de Rust está disponible desde sus tarjetas. La revisión de los feeds
oficiales no identificó una asignación fija por período.

## Candidatas para ampliar la cobertura

- [GitHub Changelog](https://github.blog/changelog/feed/) devolvió 200 y diez
  entradas. Cubre lanzamientos y cambios de herramientas. Su licencia de
  publicación requiere revisión antes de incorporarlo al catálogo público.
- [DEV Community](https://dev.to/help/getting-started) ofrece un feed general y
  feeds por etiqueta. El general devolvió 200 y doce entradas. Sus
  [términos](https://dev.to/terms) limitan el permiso general de exhibición del
  contenido a la lectura personal. Hace falta resolver el uso previsto de sus
  metadatos públicos.
- [Hacker News](https://news.ycombinator.com/rss) devolvió 200 y treinta entradas.
  Sus enlaces y discusiones podrían ampliar la cobertura de tendencias. Queda
  por revisar el alcance de sus [condiciones](https://www.ycombinator.com/legal/#tou).
- El [feed de Hugging Face Blog](https://huggingface.co/blog/feed.xml) devolvió
  200 y 913 entradas. Es candidato para IA. El blog puede incluir creadores y
  organizaciones con condiciones distintas. Revisar el alcance de
  [sus términos](https://huggingface.co/terms-of-service) por contenido.

## Verificación de la rama

La [especificación actual](../mvp/105-on-demand-tech-news.md#16-renovación-del-catálogo-de-noticias-dev--2026-11-18)
describe el retiro de las fuentes anteriores, la actualización administrativa
y la compatibilidad de lectura durante la publicación de Server y Client.

- En PostgreSQL 16 desechable, la actualización completa de 58 a 59
  migraciones conservó los dos snapshots históricos y verificó las columnas
  físicas de 76 entidades. La reversión restauró el ledger anterior y una
  nueva aplicación volvió a 59 migraciones. La suite de instalación limpia
  y actualización de base de datos aprobó 47 comprobaciones.
- La integración HTTP aprobó 14 comprobaciones con transporte simulado y 15
  al habilitar las tres consultas reales. Con JWT de laboratorio y PostgreSQL
  aislado se guardaron 10 noticias de Go, 10 de Rust y 50 de Kubernetes. La
  lectura anónima las listó en dos páginas con cero consultas externas.
  El cliente anterior recibió una lista vacía válida. Filtros y POST con claves
  retiradas fueron rechazados.
- Pasaron 30 pruebas focalizadas del servidor y las 3 317 del cliente, incluidas
  44 de Noticias. También pasaron el tipado, los builds de Server y Client y
  la validación de los workflows. CI ejecutará la integración HTTP con
  transporte simulado.
