# Evidencias visuales — NodiaAI y Nodia Teacher

Fecha: 2026-11-16. Rama `codex/durable-backend-uploads`, HEAD `0c30a767f3deab17d361fcf8db5fe5c86cfb027c` más cambios locales sin confirmar.

Capturas nativas del código local de la rama actual, con datos sintéticos. No son mockups ni imágenes generadas. Haz clic para abrir cada PNG original.

[Abrir galería](index.html) · [Manifiesto y SHA-256](manifest.json)

## Contexto

Chromium 157.0.8103.52; español y tema oscuro. Se usan los componentes productivos de Client mediante los harness locales, con transporte y datos sintéticos. No hubo mutaciones ni inferencias al capturar.

NodiaAI: viewport desktop 1440×1000, captura nativa del área de trabajo (1104×904). Los móviles usan viewport completo390×844 e incluyen navegación exterior sintética. Teacher: viewport completo1280×900 o390×844. La captura del selector Teacher móvil usa scroll normal74px para mostrar el editor completo.

## Matriz

| Vista | Viewport | PNG |
| --- | --- | --- |
| NodiaAI: historial expandido y burbujas | 1440×1000 | [Abrir](https://github.com/oscarvalenzuela25/Nodia/blob/8886e42f43c1dc93e4a67cfb643b9aac7d9c9f17/docs/evidence/visual-nodia-ai-teacher-20261116/nodia-ai-escritorio-expandido.png) |
| NodiaAI: historial en iconos con tooltip | 1440×1000 | [Abrir](https://github.com/oscarvalenzuela25/Nodia/blob/8886e42f43c1dc93e4a67cfb643b9aac7d9c9f17/docs/evidence/visual-nodia-ai-teacher-20261116/nodia-ai-escritorio-colapsado.png) |
| NodiaAI: configuración de IA abierta | 1440×1000 | [Abrir](https://github.com/oscarvalenzuela25/Nodia/blob/8886e42f43c1dc93e4a67cfb643b9aac7d9c9f17/docs/evidence/visual-nodia-ai-teacher-20261116/nodia-ai-selector-ia.png) |
| NodiaAI: filtros activos y estado sin coincidencias | 1440×1000 | [Abrir](https://github.com/oscarvalenzuela25/Nodia/blob/8886e42f43c1dc93e4a67cfb643b9aac7d9c9f17/docs/evidence/visual-nodia-ai-teacher-20261116/nodia-ai-filtros-aplicados.png) |
| NodiaAI: chat y barra colapsada en móvil | 390×844 | [Abrir](https://github.com/oscarvalenzuela25/Nodia/blob/8886e42f43c1dc93e4a67cfb643b9aac7d9c9f17/docs/evidence/visual-nodia-ai-teacher-20261116/nodia-ai-movil.png) |
| NodiaAI: historial móvil abierto | 390×844 | [Abrir](https://github.com/oscarvalenzuela25/Nodia/blob/8886e42f43c1dc93e4a67cfb643b9aac7d9c9f17/docs/evidence/visual-nodia-ai-teacher-20261116/nodia-ai-movil-historial.png) |
| Teacher: plan generado y acciones de sesión | 1280×900 | [Abrir](https://github.com/oscarvalenzuela25/Nodia/blob/8886e42f43c1dc93e4a67cfb643b9aac7d9c9f17/docs/evidence/visual-nodia-ai-teacher-20261116/teacher-plan-desktop.png) |
| Teacher: sesión pausada y conversación | 1280×900 | [Abrir](https://github.com/oscarvalenzuela25/Nodia/blob/8886e42f43c1dc93e4a67cfb643b9aac7d9c9f17/docs/evidence/visual-nodia-ai-teacher-20261116/teacher-paused-chat-desktop.png) |
| Teacher: selector horizontal de IA | 1280×900 | [Abrir](https://github.com/oscarvalenzuela25/Nodia/blob/8886e42f43c1dc93e4a67cfb643b9aac7d9c9f17/docs/evidence/visual-nodia-ai-teacher-20261116/teacher-ai-selector-desktop.png) |
| Teacher: drawer con Mis fuentes inicial | 1280×900 | [Abrir](https://github.com/oscarvalenzuela25/Nodia/blob/8886e42f43c1dc93e4a67cfb643b9aac7d9c9f17/docs/evidence/visual-nodia-ai-teacher-20261116/teacher-sources-drawer-desktop.png) |
| Teacher: drawer adaptativo en móvil | 390×844 | [Abrir](https://github.com/oscarvalenzuela25/Nodia/blob/8886e42f43c1dc93e4a67cfb643b9aac7d9c9f17/docs/evidence/visual-nodia-ai-teacher-20261116/teacher-sources-drawer-mobile.png) |
| Teacher: selector de IA en móvil | 390×844 | [Abrir](https://github.com/oscarvalenzuela25/Nodia/blob/8886e42f43c1dc93e4a67cfb643b9aac7d9c9f17/docs/evidence/visual-nodia-ai-teacher-20261116/teacher-ai-selector-mobile.png) |

## Alcance de la evidencia

Los doce estados capturados no presentan overflow horizontal del documento ni avisos nativos ResizeObserver en sus recorridos. Se inspeccionaron las imágenes y se comprobó el selector Teacher de cuatro opciones, Mis fuentes inicial, el historial NodiaAI colapsado/expandido y la ausencia del botón + en el compositor Teacher.

NodiaAI conserva avisos de desarrollo React/Emotion en consola; estas capturas no afirman una consola globalmente libre de errores. Las fixtures no demuestran disponibilidad de modelos, permisos HTTP reales, persistencia productiva ni uso en un teléfono físico.

La selección de nombres, mensajes, cuotas y estados pertenece a las fixtures. El manifiesto conserva escenario, URL local, viewport, encuadre, dimensiones del PNG y hashes de imágenes y fuentes relevantes.

Referencias: [NodiaAI: historial y burbujas](../nodia-ai-sidebar-bubbles-20261116.md), [historial y filtros](../nodia-ai-history-filters-20261116.md), [Teacher y corrección de medición](../teacher-drawer-chat-ui-20261116.md).

Este paquete documenta el resultado visual local; no modifica el código funcional, no publica fichas ni despliega la aplicación.
