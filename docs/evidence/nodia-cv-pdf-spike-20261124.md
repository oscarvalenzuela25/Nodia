# Nodia CV — Prueba de render y lectura del PDF

Fecha 2026-11-24, America/Santiago. Evidencia del spike de [Plan113 §6](../mvp/113-nodia-cv-implementation-plan.md#6-pdf-ats-y-reutilización) en el worktree `codex/nodia-cv`, base `50bb9ec4`. Todos los perfiles, textos, contactos y destinos de prueba son sintéticos. El alcance cubre render y lectura interna, previo a la integración con Server y Client.

## Resultado y decisión propuesta

Adoptar **PDFKit 0.21.0** como candidato de Server, **PDF.js 6.4.299** como lector y **DejaVu Sans** Regular y Bold como fuente local embebida. Empezar con A4 y una sola columna. Conservar el aviso de licencia junto a las fuentes distribuidas y fijar versión y huella de los archivos. Chromium queda como referencia de QA. Ambos candidatos produjeron PDF íntegros y PDFKit redujo el tiempo mediano de render en cada plataforma del ensayo. PDFKit requiere implementar la paginación y la política de enlaces dentro de Nodia CV. [PDFKit](https://pdfkit.org/docs/getting_started.html) · [Texto y paginación](https://pdfkit.org/docs/text.html) · [Release 0.21.0](https://github.com/foliojs/pdfkit/releases/tag/v0.21.0) · [Licencia DejaVu](https://dejavu-fonts.github.io/License.html) · [Playwright](https://playwright.dev/docs/api/class-page#page-pdf)

- Extraer en un proceso aislado reutilizando PDF.js y los patrones de límites y cierre del [extractor de Teacher](../../nodia-server/src/teacher/policies/teacher-enrichment-sources.ts). Conservar página, texto y orden de los fragmentos donde CV los necesite. Teacher conserva sus errores, límites y contrato propios.
- Vincular el diagnóstico a revisión, plantilla, idioma, papel, renderer y SHA-256. Parsear y servir el mismo buffer. Comprobar identidad antes de publicar o guardar. Un render nuevo puede cambiar los bytes aun si el texto y los píxeles coinciden.
- Los cuatro artefactos PDFKit ocuparon 21–29 KiB aproximadamente. Este tamaño favorece evaluar `bytea` privado y acotado, con metadatos y listado independientes del binario. El spike PDF mide el buffer y la coincidencia con su lectura local. El ensayo de persistencia, consulta sin bytes, purga y restauración corresponde a PostgreSQL aislado.

## Método

| Elemento | Configuración |
| --- | --- |
| Windows | Node 24.20.0, PDF.js 6.4.299 instalado en Server, PDFKit 0.21.0 aislado en `.tmp` |
| Linux | Ubuntu 24.04.1 WSL2 x64, Node 24.22.2 como en CI y CD, distribución oficial verificada con SHA-256, PDF.js 6.4.299 y PDFKit 0.21.0 aislados |
| Chromium | Playwright 1.65.1, Chrome Headless Shell 159.0.8154.6 en ambos sistemas. Contexto nuevo por documento, JavaScript desactivado, offline, service workers bloqueados, CSP, fuentes embebidas y ruta que aborta solicitudes |
| Fuente | DejaVu Sans de Ubuntu. SHA-256 Regular `ae7b7855e115a5966d8b1b3f80f254ccc117ec86f9965e202ee2940453837280`, Bold `5c1247acef7f2b8522a31742c76d6adcb5569bacc0be7ceaa4dc39dd252ce895` |
| Página | A4 vertical, márgenes 48 puntos, texto de 10 puntos, jerarquía de títulos, separadores literales y conservación de encabezado con su primer contenido |
| Perfiles | ES y EN, corto con un cargo, largo con diez cargos y treinta viñetas. Ñ y tildes en encabezado y cuerpo, C++, C#, comas, rangos con guion ASCII, texto con signos HTML, correo literal, teléfono en largos, educación ausente en EN corto y URL larga multilínea |
| Lectura | Se calcula SHA-256 de los bytes producidos, se verifica antes de parsear y se vuelve a comparar con el archivo escrito. Se comprueba texto completo y orden tras NFC y normalización de espacios, URL visible completa al unir su salto de línea, destino exacto de anotación, páginas A4 y cajas de texto dentro de márgenes |
| Visual | Poppler 26.11.0, 95 ppp, revisión de las páginas de los cuatro perfiles por renderer y plataforma. El [rasterizador Nodia](../../nodia-server/scripts/render-codex-pdf.mjs) también convirtió a PNG las tres páginas de los dos PDF largos ES de Windows |
| Red y cierre | Linux ejecutó los dos candidatos como usuario local dentro de `unshare -n`, con `lo` como única interfaz. Chromium reportó 0 solicitudes externas observadas en las ejecuciones de ambos sistemas. Se cerraron contexto, navegador, página y tarea de lectura al finalizar |

## Mediciones

Ocho ejecuciones secuenciales por perfil, renderer y plataforma. Las 128 ejecuciones de la comparación cumplieron texto, orden, enlaces y geometría. Se descartó la primera ejecución de cada perfil para p50/p95, con 28 muestras restantes por fila y percentiles por rango más próximo. El render Chromium incluye contexto nuevo y fuentes listas, con el navegador arrancado. El tiempo de lectura incluye escritura de la primera muestra cuando corresponde. Tiempos locales de laboratorio.

| SO | Renderer | Renders válidos | Bytes ES corto / EN corto / ES largo / EN largo | Render p50/p95, ms | Lectura p50/p95, ms |
| --- | --- | ---: | --- | ---: | ---: |
| Windows | PDFKit | 32 | 21 570 / 21 004 / 29 290 / 29 018 | 33 / 39 | 13 / 19 |
| Windows | Chromium | 32 | 23 210 / 22 804 / 32 310 / 32 066 | 331 / 378 | 14 / 25 |
| Linux | PDFKit | 32 | 21 570 / 21 004 / 29 290 / 29 018 | 29 / 44 | 12 / 18 |
| Linux | Chromium | 32 | 22 637 / 22 288 / 30 546 / 30 374 | 184 / 202 | 9 / 24 |

- Ambos caminos produjeron una página en cortos y tres en largos. Se conservaron glifos, contacto visible, fechas, orden y enlaces. Los huecos de la última página del perfil largo corresponden al contenido restante. Se observó una viñeta completa al inicio de la segunda página sin separar ningún título de su primer contenido. Los ocho pares de páginas PDFKit Windows/Linux coincidieron píxel a píxel después de rasterizar con el mismo Poppler. Las ocho parejas de Chromium difirieron en píxeles y mantuvieron el texto y la geometría aceptados.
- Primera muestra ES corta PDFKit, render/lectura: Windows 71/95 ms y Linux 111/100 ms. Chromium tardó 142 ms en iniciar y 29 ms en cerrar en Windows, y 343 ms en iniciar y 19 ms en cerrar en Linux. La primera muestra Chromium ES corta, con navegador en marcha, tardó 348/12 ms en Windows y 425/17 ms en Linux.
- El pico RSS del proceso Node que recorrió ambos candidatos fue 387 MiB en Windows y 469 MiB en Linux. En una pasada separada de 32 PDFKit con lectura aislada en Linux fue 277 MiB. Estos picos excluyen procesos del navegador y reflejan toda la vida del driver. Las cifras sirven para un dimensionamiento inicial y requieren una prueba de concurrencia del worker antes de fijar un presupuesto RSS o un SLO.
- Cada plataforma rechazó siete controles: PDF alterado con el hash original, PDF corrupto, más de 256 KiB, PDF de una imagen sin capa de texto, PDF cifrado sin contraseña, cinco páginas y texto fuente de más de 24 000 unidades UTF-16. La comparación exige texto completo y ordenado y fallaría al omitir cualquiera de sus campos presentes.
- Dos huellas representativas del mismo perfil ES largo con PDFKit. Windows `59d846cf8e45429d645e85dc454ea6eb6e2bf50ff2593f3fba89c3b3680912`. Linux `6a490cd397c549400e0f473a7063d19aac16495a0ec480896382c8e107c36ff0`. Ambas coinciden con los bytes escritos por su ejecución. Su lectura y su rasterización coinciden aunque sus SHA-256 difieren.

## Límites de partida

1. A4, máximo cuatro páginas y 256 KiB por artefacto, 128 bloques y 24 000 unidades UTF-16 en el modelo de render. El prototipo impone estos topes y aplica los controles negativos de tamaño, páginas y texto. Comprobar también el límite de bloques y el presupuesto de bytes durante la generación productiva. No truncar contenido para cumplirlos.
2. Aislar render y lectura fuera del hilo HTTP. Empezar con una ejecución simultánea por worker y un deadline propuesto de 5 s por fase, con cancelación que termine el ejecutor y pruebas de liberación, timeout y concurrencia. El laboratorio limitó operaciones de Chromium y midió el cierre normal. El deadline y la cancelación efectiva de PDFKit y PDF.js requieren verificación en la integración.
3. Mantener el fallo de datos o render separado del fallo de lectura, página o tamaño, pérdida de campos y hash obsoleto. Conservar el borrador tras un fallo. Generar la variante Compacta y calificar Carta en sus cortes con la misma matriz.

## Reproducción y alcance

El laboratorio local conserva el script, JSON, imágenes y PDFs sintéticos bajo `.tmp/nodia-cv-pdf-spike/`, ignorado por Git. La receta es instalar PDFKit y Playwright con versiones fijadas en ese directorio, copiar las dos fuentes de Ubuntu y verificar sus huellas, usar PDF.js 6.4.299 y ejecutar:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location).Path '.tmp/nodia-cv-pdf-spike/browsers'
node .tmp/nodia-cv-pdf-spike/spike.mjs both 8 baseline
wsl.exe -d Ubuntu -u root -- unshare -n -- setpriv --reuid=1000 --regid=1000 --clear-groups bash /mnt/c/Users/Oscar/Desktop/Nodia/.tmp/worktrees/nodia-cv/.tmp/nodia-cv-pdf-spike/run-linux.sh both 8 baseline
```

La segunda línea de ejecución depende del usuario y ruta del laboratorio. El script Linux fija el Node verificado, PDF.js, Playwright y las librerías extraídas de paquetes de Ubuntu en el área temporal. Sin los archivos locales, se puede repetir con los cuatro perfiles y comprobaciones de la tabla de método. Para inspección visual se usó `pdftoppm -r 95 -png <entrada.pdf> <prefijo>`.

Quedan por verificar el renderer compilado de Nodia CV en el entorno de despliegue, la memoria de sus procesos bajo concurrencia, la descarga HTTP autorizada con los mismos bytes, Compacta y Carta. La importación de campos en un ATS comercial está pendiente de acceso autorizado. Este ensayo acredita lectura interna del artefacto por PDF.js en la matriz indicada.
