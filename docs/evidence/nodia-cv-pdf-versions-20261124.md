# Nodia CV — PDF comprobado e historial de versiones

Fecha 2026-11-24, America/Santiago. Rama `codex/nodia-cv`, base `50bb9ec4`. [Plan 113, CV-05](../mvp/113-nodia-cv-implementation-plan.md#cv-05--pdf-historial-y-guardado-explícito). Los perfiles, ofertas, contactos y archivos son sintéticos.

## Nest compilado y PostgreSQL

La integración ejecutó 77 migraciones, incluida `179400`, en una base PostgreSQL 16.15 vacía y privada. El HTTP real de Nest usó autenticación, sesiones, acceso a módulo y operaciones de CV compilados. Los borradores validados se sembraron como fixtures terminales, con el transporte de IA inhabilitado. Se registraron cero intercambios y cero entradas de CV en el ledger.

| Escenario | Observación |
| --- | --- |
| Preparación y lectura | Dos solicitudes simultáneas de la misma plantilla y revisión devolvieron el mismo artefacto. Cada descarga incluyó `Content-Disposition`, `X-Content-SHA256` y `Cache-Control: private, no-store`. Se recalculó SHA-256, se comprobó A4 y se extrajo el texto con una invocación independiente de PDF.js. Coincidieron los caracteres y su orden al normalizar el espacio de maquetación. Se verificaron Ñ, tildes, C++, C#, el destino de un enlace, encabezados ES/EN y las competencias después de la experiencia |
| Guardado idempotente | Doble `POST` con la misma clave y clave distinta para el mismo artefacto devolvieron una versión. Una clave con otro contenido devolvió `409`. Un proxy de loopback cortó la respuesta después del `201` real. El reintento exacto recuperó la versión existente |
| Revisión, vencimiento y baja | Un cambio de revisión invalidó el PDF temporal anterior. Preparar o guardar la revisión anterior devolvió `409`. Un borrador vencido devolvió `410`. La versión y su recibo sobrevivieron al vencimiento y al borrado del perfil. Tras borrar una versión, el PDF y el recibo ya no devolvieron su contenido. El mismo cargo conservó versiones sucesivas 1, 2 y 3 pese al borrado de la 2 |
| Historial y autoridad | Páginas de dos filas con fechas ISO en UTC y proyección de resumen sin texto ni binario. Cuenta distinta con módulo obtuvo `404` para un recurso ajeno. Permiso de módulo revocado devolvió `403` y sesión revocada `401`. Tras borrar ambos perfiles se descargaron las versiones retenidas y sus bytes coincidieron exactamente con los que se prepararon |

### Inspección del archivo

PDFKit 0.21.0, PDF.js 6.4.299 y DejaVu Sans local. Poppler rasterizó las nueve páginas a 95 ppp. Se inspeccionaron la primera y última página de cada variante y los saltos intermedios. Las plantillas mantuvieron una columna, jerarquía y texto legible con la agrupación de competencias. Los datos originales del perfil conservaron su idioma y los encabezados usaron el idioma seleccionado para el CV.

| Idioma y plantilla | Páginas A4 | Bytes | SHA-256 de la descarga preparada |
| --- | ---: | ---: | --- |
| ES Clásica | 1 | 19 267 | `b3857401071eef3cc871a793859864772817f78fa02ec6f39d34c7e894c1a9f8` |
| ES Compacta | 1 | 19 268 | `f70999fa5e9386c615996a83a283884eaa2cd9921eac75b44040124e7208df9e` |
| EN Clásica | 4 | 24 699 | `304f9154e8fa716f28e47c4935a8d74517227b6c646fe8b69f827dea5eea36e3` |
| EN Compacta | 3 | 23 933 | `5e24cc8488f76bb0af567f3ed61f9195eea85f43ea66ce78e1a36a1488fa0f59` |

El corpus del renderizador se amplió por separado en Windows y WSL a ocho casos por entorno, con variantes cortas y largas de ambos idiomas y plantillas. El laboratorio Linux usó un espacio de red con sólo loopback. Se probaron un PDF sin capa de texto, un PDF inválido, formato Carta, contenido cambiado, Unicode sin glifo, límites de páginas y bytes, ocupación y terminación por timeout.

## Navegador

Edge Chromium ejecutó Client compilado con el Server local y otra base aislada con 77 migraciones. A 320 px en ES y tema claro, una intercepción `503` sólo en el GET del PDF conservó el borrador e impidió guardar. El reintento recuperó el artefacto ya preparado. La lectura del texto mantuvo C++ y C#, y el visor cargó por intención al pulsar «Ver PDF». El documento de la página mantuvo 320 px de ancho. El PDF de 19 861 bytes descargado desde el navegador coincidió con el SHA-256 `7b09c55b0fa58eedd933b2afdd9ee8872f5d0bc8537194a49dda79ba32a82917`. Las versiones 1 y 2 guardadas desde ambas plantillas conservaron el mismo cargo y los bytes de sus respectivas revisiones. Cero intercambios de IA.

En EN, tema oscuro y 1.440 px se abrió la página 2 de 4. En un contexto nuevo de Edge con Service Workers bloqueados, Playwright abortó sólo el primer GET a `PdfCanvasViewer-O6eD78BE.js`, que terminó con `net::ERR_FAILED`. La pantalla conservó la oferta y la descarga. Al pulsar reintentar se solicitó la misma URL por segunda vez y se pintó la página 2 en la misma pestaña. La falla inyectada correspondió al módulo del visor y el Worker procesó el PDF después del reintento.

En el historial, el listado cargó sólo resúmenes. Abrir una versión cargó su detalle. Los bytes se solicitaron al pulsar «Comprobar PDF guardado». Con la versión abierta, el ancho del documento coincidió con el ancho visible a 320, 390, 599, 600, 899, 900 y 1.440 px. A 320 px se inyectó un `503` únicamente al `DELETE` de la versión 2. La confirmación y el detalle siguieron abiertos. El reintento llegó a Nest y devolvió `204`, cerró ambos y preservó la versión 1. Después de borrar ambos perfiles mediante `204`, el historial permitió comprobar y pintar la versión 1 con el mismo SHA-256 de la descarga anterior. Hubo cero envíos de IA.

El chunk de la verificación final de visor y lectura fue `NodiaCv-ByXIYWXl.js`, SHA-256 `f39489e5c624fb1c8904fb197c526d08f0ad126619deb4cd6a7c00dc85b3ab07`. El visor `PdfCanvasViewer-O6eD78BE.js` tiene SHA-256 `3b7c38f6b291eda6e0d318e4da0c5f17ef6ffbd756f19e3bce808e9f9c463d08`.

## Reproducción y alcance

- Prueba HTTP [nodia-cv-pdf-versions.integration.mjs](../../nodia-server/test/nodia-cv-pdf-versions.integration.mjs). Ejecutar `npm run test:nodia-cv:pdf-versions` desde `nodia-server` con `NODIA_CV_TEST_DATABASE_URL` apuntando a una base PostgreSQL descartable y vacía `nodia_cv_test_*` en loopback. `NODIA_CV_RECORD_PDF_FIXTURES=1` guarda los cuatro PDF sintéticos en `.tmp/nodia-cv05-lab/pdfs/`.
- Capturas y guiones de Edge bajo `.tmp/nodia-cv05-lab/`, fuera de Git. `raster/contact-sheet.png` consolida las nueve páginas de la matriz. `cv05-mobile-es-light-text.png` y `cv05-mobile-es-light-pdf.png` muestran lectura y visor a 320 px. `cv05-desktop-en-dark-multipage.png` muestra la página 2 de 4. `cv05-mobile-es-light-delete-failure.png` muestra la confirmación retenida ante el error. `cv05-desktop-es-light-saved-without-profile.png` registra la reapertura sin perfiles. Las capturas limpias son `cv05-mobile-es-light-editor-clean.png` y `cv05-desktop-es-light-history-clean.png`.

Las comprobaciones cubren A4, Clásica y Compacta en el laboratorio, con lectura interna del PDF exacto. La importación comercial en ATS, la matriz completa de dispositivos físicos y la promoción al entorno de destino quedan pendientes de CV-06.
