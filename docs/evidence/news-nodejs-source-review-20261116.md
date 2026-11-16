# Noticias — revisión de fuente Node.js para NEWS-04

Fecha2026-11-16. Revisión desde el equipo local, sin credenciales ni llamadas
desde una instancia Nodia. Complementa [NEWS-01](news-source-discovery-20261116.md)
y el [catálogo](../features/news/source-catalog.md). No acredita integración,
despliegue, migración o aceptación humana de News.

## Lectura real y contrato observado

GET directo con `curl.exe`, TLS verificado normalmente, sin `--insecure` ni
redirecciones: [RSS oficial](https://nodejs.org/en/feed/blog.xml), HTTP200.
Cabecera Date: `Mon, 16 Nov 2026 20:26:41 GMT`.

- `Content-Type: application/xml`; transferencia chunked, sin Content-Encoding.
- `Cache-Control: public, max-age=0, must-revalidate`, `Age: 267`.
- Sin ETag, Last-Modified, Retry-After o cabeceras de cuota identificadas en esta
  respuesta. Son observaciones puntuales, no promesa de comportamiento futuro.
- 328143bytes; SHA256 XML:
  `5281a4a6e0d37470977a883e3fac58d05ced526723b893e031905177809e3fff`.
- 1074entradas;1074URLs y1074GUIDs distintos. La unión de campos de las entradas
  contiene únicamente `title`, `link`, `guid` y `pubDate`. No entrega descripciones,
  autores o medios: la integración no debe rellenarlos desde otras páginas.
- Todas las URLs observadas empiezan por `https://nodejs.org/en/blog/`.
  Última publicación del feed: `Fri, 18 Mar 2011 03:17:12 GMT`.

El feed contiene historia completa, no sólo novedades. El límite anterior de
500entradas XML de web.dev rechaza esta respuesta válida de Node.js. NEWS-04 debe
resolverlo deliberadamente con un límite explícito del adaptador, conservando
cota de bytes, tiempo y snapshot persistido; no desactivar protecciones ni
prometer que el tamaño histórico permanecerá constante. La política local de
15minutos/100artículos/7días de Nodia no es un límite del editor.

La revisión de los documentos primarios no identificó una asignación fija de
llamadas diaria/mensual para este RSS. Es acceso público sin credenciales, no una
garantía de uso ilimitado. Se conservan enfriamiento, consulta administrativa
explícita y tratamiento de429/Retry-After.

## Trazabilidad del feed al contenido versionado

El árbol recursivo de `nodejs/nodejs.org` se consultó mediante API GitHub pública,
sin autenticación. Corte `48bd7b54a8fa902f2e8c158fca8ae610ec1fe2fc`, `truncated:false`.

- [Route de RSS](https://github.com/nodejs/nodejs.org/blob/48bd7b54a8fa902f2e8c158fca8ae610ec1fe2fc/apps/site/app/%5Blocale%5D/feed/%5Bfeed%5D/route.ts)
  llama `getFeeds` para el destino solicitado y devuelve XML.
- [Generador](https://github.com/nodejs/nodejs.org/blob/48bd7b54a8fa902f2e8c158fca8ae610ec1fe2fc/apps/site/util/feeds.ts)
  obtiene `getBlogPosts('all')` y construye título, fecha, enlace y GUID desde la
  metadata de los posts; el GUID de posts recientes incorpora el timestamp.
- Las1074URLs observadas corresponden a1074paths Markdown/MDX bajo
  `apps/site/pages/en/blog/` en ese árbol:1067`.md` y7`.mdx`. No se encontraron
  archivos separados LICENSE/COPYING/NOTICE bajo ese directorio en el árbol.
  Este chequeo de paths no equivale a auditar cada cuerpo histórico o sus activos.
- [Primer post fuente](https://github.com/nodejs/nodejs.org/blob/48bd7b54a8fa902f2e8c158fca8ae610ec1fe2fc/apps/site/pages/en/blog/release/v27.0.0-alpha.0.1.0.md):
  título/fecha/slug de su frontmatter coinciden con la primera entrada del RSS.
  No se conserva ni redistribuye el cuerpo en esta evidencia o en News.

## Licencia, atribución y alcance de habilitación

La [licencia del proyecto en el mismo corte](https://github.com/nodejs/nodejs.org/blob/48bd7b54a8fa902f2e8c158fca8ae610ec1fe2fc/LICENSE)
es MIT y abarca software y documentación asociada, con conservación de los avisos
de copyright y permiso. La descarga de LICENSE desde `main` en esta revisión
coincide con ese texto; SHA256 de sus bytes:
`521edd5b3dddc33947eb8c5e988eeca99c986ea0f70cd6817ab8e553895feaf3`.

Los [términos generales OpenJS](https://terms-of-use.openjsf.org/), apartados
Intellectual Property Rights y User Submissions, indican CC BY4.0 por defecto
salvo disposición específica; los acuerdos/licencias del proyecto prevalecen
en caso de conflicto. No se presenta la licencia de Node.js runtime como prueba
de la licencia del sitio: la fuente aquí es `nodejs/nodejs.org`.

**Inferencia de integración acotada:** la licencia expresa del sitio, la cadena
del generador y la metadata en su repositorio permiten habilitar título, URL y
fecha con procedencia y aviso MIT conservado. No se infiere de un HTTP200 aislado.
Esta revisión no habilita extractos, cuerpos completos, imágenes, logos o
contenido de terceros enlazado. Si cambian fuente/condiciones o aparece un aviso
específico incompatible, revisar antes de ampliar el alcance.

La [página de branding](https://nodejs.org/en/about/branding) separa las marcas y
remite a la [política OpenJS](https://trademark-policy.openjsf.org/): la licencia
copyright no concede derechos de marca. Usar `Node.js®` como identificación
factual de la fuente con enlace al original, reconocer OpenJS Foundation como
titular y no sugerir patrocinio o respaldo de Nodia. No usar logos en este alcance.

La entrega debe conservar un aviso MIT completo accesible desde la atribución
de la fuente; un enlace a la licencia original sigue siendo útil como procedencia.
Texto primario que debe conservarse:

```text
MIT License

Copyright Node.js Website WG contributors. All rights reserved.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to
deal in the Software without restriction, including without limitation the
rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
sell copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
IN THE SOFTWARE.
```

## Límites y temporales

XML, cabeceras, licencia y árbol completo se guardaron únicamente en
`.tmp/news04-source-review/`, ignorado. Los hashes identifican esa observación;
no son una promesa de descarga futura ni un snapshot de artículos versionado.
No se solicitaron cuentas, tokens o permisos adicionales, ni se modificó el sitio
del editor. El catálogo/contrato, las pruebas del adaptador y la evidencia de
integración de NEWS-04 deben registrar por separado qué se implementó realmente.
