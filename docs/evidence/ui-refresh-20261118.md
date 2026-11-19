# Retoque transversal de Client — 2026-11-18

Rama `codex/ui-refresh` desde `origin/development` en `398fa11d`. La entrega
aplica el [diseño de Client](../../nodia-client/DESIGN.md#11-retoque-transversal--2026-11-18)
con el tema MUI, las fuentes y las traducciones existentes. El alcance incluye
las pantallas públicas, Inicio, Negocios, Finanzas, Reservas, Administración,
Noticias, NodiaAI y Teacher. Los cambios de navegación de tarjetas de Negocios
usan el destino canónico y los mismos IDs.

## Comprobación en Chromium local

Se usaron datos sintéticos en rutas locales y en los fixtures manuales de
Client. Los perfiles alternaron español e inglés y el tema claro y oscuro.
Las capturas se guardaron en `output/playwright/`, fuera del índice Git.

| Superficie | Escenarios comprobados |
| --- | --- |
| Navegación e Inicio | Ocho perfiles de 320 a 1440 px, incluidos ambos lados de 600 y 900 px. Foco de teclado visible, retorno tras Escape, modo histórico sin identificador de paleta, dock visible bajo 600 px y enlaces canónicos. Un 503 del contexto muestra el error y permite reintentar. Una respuesta vacía muestra el estado previsto. |
| Acceso y sistema | Acceso, 404 y mantenimiento a 320 × 420 y 1440 × 900 px. Contenido y acciones en el viewport horizontal, con regreso a Inicio desde mantenimiento. |
| Controles compartidos | Cambio por teclado a Vintage Paper y Vercel, conservación de un borrador, persistencia de la paleta y cambio de modo nativo. La tabla de muestra conserva 650 px, scroll local y pista transparente. En la hoja móvil de accesos, Escape devuelve el foco al botón que la abrió. |
| Negocios, Finanzas y Reservas | 42 combinaciones de listado, resumen y POS de Negocios, resumen y movimientos de Finanzas, y agenda y caja de Reservas entre 320 y 1440 px. Selección de pestañas con subrayado, controles de 44/48 px y enlace a Negocios activable con Enter. Verificación puntual con colores forzados, movimiento reducido, listas vacías, indisponibilidad y configuración inválida. |
| Administración | 18 escenarios con datos cargados, incluyendo las cinco secciones a 320, 600 y 1440 px, Usuarios sin registros y con 503, y el detalle Agentic de Proveedores. Se verificó el ancho mínimo de 650 px para tablas desde 600 px. |
| Noticias | Lectura pública con respuesta vacía y recuperación tras una respuesta inválida o un 503. Foco de artículos a 390 y 1440 px. Lectura personal con portada válida, ausente y rota. Los paneles responden al teclado y conservan su independencia. El diálogo de conexión a 320 px mantiene el borrador ante un rechazo sintético y permite reintentar. |
| NodiaAI y Teacher | 21 perfiles del chat, listado de planes, alta y estudio entre 320 y 1440 px. Se comprobó foco visible, retorno desde el historial móvil, borrador del chat y ausencia de escrituras provocadas por los recorridos. |

Dos avisos de desarrollo observados en el fixture de NodiaAI se reprodujeron
en `398fa11d` con el mismo historial. La comprobación de navegadores cubre
Chromium en Windows y datos locales de prueba. El uso real de los proveedores,
los dispositivos físicos y la adopción por entorno tienen evidencia propia.

## Comprobaciones de código

- La suite general de Vitest pasó con 3345 pruebas en 413 archivos. La
  repetición final de componentes compartidos, navegación, Inicio, acceso
  y sistema pasó con 189 pruebas en 33 archivos.
- `npm run build` pasó con el chequeo de tipos de TypeScript y Vite. El
  compilador emitió avisos de tamaño de algunos chunks y tiempos de plugins.
- `npm run lint -- --ignore-pattern .tmp/` pasó. La ejecución sin exclusión
  alcanza fixtures temporales previos de `nodia-client/.tmp/` y reporta
  cinco errores en ese material local.
- `git diff --check` y la comprobación de UTF-8/LF pasaron para los archivos
  del retoque.
