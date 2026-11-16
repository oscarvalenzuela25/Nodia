# NodiaAI: historial móvil desde la cabecera

Solicitud2026-11-16, [plan107§15](../../mvp/107-nodia-ai-ux-ui-upgrade-plan.md#15-historial-móvil-desde-cabecera--solicitud2026-11-16).
Implementación local sobre `codex/durable-backend-uploads`, HEAD
`0c30a767f3deab17d361fcf8db5fe5c86cfb027c` con cambios sin commit.
Esta evidencia sucede únicamente la presentación móvil con barra lateral de las
[capturas anteriores](../visual-nodia-ai-teacher-20261116/README.md).

## Capturas nativas

Chromium157.0.8103.52, viewport390×844 CSS px, español y tema oscuro. Capturas
directas del navegador, sin generación ni retoque. Shell y transporte sintéticos
del harness `nodia-client/src/test/manual/nodia-ai-ux`, componentes productivos
del chat. URL local con `scenario=history-filters&lang=es&theme=dark`, puerto5194.
El contenido, usuario, modelo y borrador son fixtures QA, sin datos reales.

- [Chat móvil sin panel lateral](chat-mobile.png): botón de historial a la
  izquierda, «Nuevo chat» compacto a la derecha y chat con todo el ancho disponible.
- [Historial desplegado](history-drawer-mobile.png): Drawer existente con búsqueda
  y acciones de conversaciones, sin una segunda lista interactiva de fondo.

| PNG | SHA-256 |
| --- | --- |
| chat-mobile.png | `bd1a6e1b4130c3af99671855041ee9bc9bd72da078be1a80b68fe41a2e06965d` |
| history-drawer-mobile.png | `1fa09e6e1a0055ec26e9a4e3afd354ba3a57ba49131aa80f3d20a72dc1887db7` |

## Verificación observable

Matriz Chromium con altura844, ES/oscuro y EN/claro:320/390/599/600/899/900/1440px
y vuelta a390. Sin overflow horizontal del documento en los16 pasos. Sin rail
por debajo de900px y una sola barra lateral desde900px. El botón de historial
mide44×44px. En ES, «Nuevo chat» mide122.34×44px en xs y133.39×44px desde600px;
ambos controles comparten fila y extremos sin colisión. La representación de
escritorio conserva el panel colapsable.

El mismo textarea, su valor y la URL seleccionada se conservan al redimensionar,
abrir/cerrar el Drawer y recibir503 sintético de historial. La búsqueda permanece
al reabrir. Escape devuelve el foco al icono. La transición Drawer abierto→900px
mantiene un solo ID `nodia-ai-history`, incluso antes de terminar la animación.
Los recorridos sólo generaron GET sintéticos, sin crear chats ni enviar mensajes.

Sin avisos ResizeObserver en la matriz. Persisten los diagnósticos de desarrollo
preexistentes de React (`setState` durante render) y Emotion (`:first-child`);
esta entrega no afirma una consola global limpia ni modifica esos comportamientos.

## Checks y límites

- Suite focal de página, historial y ruta:84pruebas correctas.
- Nueva regresión móvil: ausencia de rail, apertura desde cabecera, identidad del
  Drawer, retorno de foco y conservación del textarea/borrador/selección.
  Espera la salida del Drawer antes de consultar el contenido accesible de fondo.
- Suite general final:364archivos y3035pruebas correctos,355.45s con8workers.
  La primera pasada detectó únicamente la espera prematura de la nueva regresión;
  se corrigió esa espera y se repitió la suite completa con resultado correcto.
- `npm run typecheck`, `npm run build` y lint finales correctos. Lint ejecutado
  con `--ignore-pattern '.tmp/**'`, excluyendo sólo experimentos temporales
  ignorados. Vite conserva el aviso previo de tamaño de chunks.
- `git diff --check` y verificación UTF-8/LF sin BOM de los archivos editados,
  correctos. Las capturas PNG no se normalizaron.

Logs/scripts intermedios en `output/` y `.tmp/` ignorados. No se consumieron
proveedores, cuotas ni backend real. No hubo despliegue, publicación o aprobación
documental. QA autenticada y teléfono físico, teclado virtual y Safari real no
se han comprobado con estas capturas.
