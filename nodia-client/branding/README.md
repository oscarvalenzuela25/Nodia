# Icono de instalación y favicon de Nodia

La opción **1, N esencial**, fue seleccionada por el usuario el 2026-11-13.
La fuente editable es [public/favicon.svg](../public/favicon.svg): geometría
vectorial propia, sin imagen raster incrustada, tipografía o recursos externos.
Conserva la N de trazos gruesos con esquinas suaves y transición turquesa, azul
y violeta de la propuesta elegida. Los colores del gradiente son `#00b8b5`,
`#0758ed` y `#6500ed`; no cambian la paleta del theme de la aplicación.

## Archivos exportados

| Archivo en public/ | Tamaño y tratamiento |
| --- | --- |
| favicon.svg | Fuente vectorial, viewBox 512 × 512, fondo transparente |
| favicon-32x32.png | 32 × 32, transparente |
| favicon.ico | Entradas PNG de 16 × 16, 32 × 32 y 48 × 48, con alfa |
| icons/icon-192.png | 192 × 192, transparente, purpose any |
| icons/icon-512.png | 512 × 512, transparente, purpose any |
| icons/icon-maskable-192.png | 192 × 192, fondo opaco, purpose maskable |
| icons/icon-maskable-512.png | 512 × 512, fondo opaco, purpose maskable |
| apple-touch-icon.png | 180 × 180, fondo opaco |

## Regeneración

Exportar directamente el SVG a cada tamaño, sin ampliar el PNG del logo antiguo
ni reutilizar la imagen generada como fuente de producción. Las exportaciones
iniciales se rasterizaron con SVG/Canvas nativo de Chromium mediante Playwright
1.62.1, con device scale 1. No hay dependencia nueva de runtime o build: los
archivos exportados forman parte del repositorio.

Para los iconos maskable, aplicar al path del SVG la transformación
`translate(256 256) scale(0.74) translate(-256 -256)`; dibujar debajo un fondo
opaco `#f7f9f3` que cubra todo el lienzo. La N completa queda dentro del círculo
central de radio 40% del ancho, incluso al recortar las esquinas. El icono de
Apple usa ese fondo opaco con la geometría original. Los iconos any y favicon
conservan transparencia. Exportar cada tamaño desde el SVG, con antialiasing.

El ICO contiene las tres exportaciones independientes, no un bitmap de 16 px
ampliado. Tras cambiar la fuente, comprobar visualmente 16/32 px sobre fondos
claro y oscuro, además de recortes circular y cuadrado de maskable. Comprobar
dimensiones, alfa y contenido antes de actualizar el manifiesto.

Contrato y aceptación por plataforma: [PWA103](../../docs/mvp/103-pwa-progressive-implementation-plan.md).
