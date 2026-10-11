# Fuentes y decisiones de adaptación

Consulta realizada en esta sesión, con fecha de cliente **2026-10-09**. Recuentos observados mediante `GET https://api.github.com/repos/{owner}/{repo}` (`stargazers_count`); commits mediante `/commits/{default_branch}`. Son una fotografía de consulta, no cifras actualizadas automáticamente. Las estrellas sirven para seleccionar repositorios; no prueban la corrección de sus recomendaciones.

Umbral pedido: más de 1.000 estrellas; aclaración posterior del usuario: aproximadamente 1.000 también sirve. Por ello se incluye Web Interface Guidelines con 950. Los enlaces a archivos usan commits concretos para recuperar el contenido consultado.

La skill es una síntesis escrita para este uso. Los ejemplos locales se redactaron para sus invariantes; la tabla distingue las ideas aprovechadas de las decisiones propias. La columna de licencia informa el SPDX de la licencia raíz según GitHub; revisar licencias específicas de documentación/archivos si se reutiliza material literalmente.

## Repositorios seleccionados

| Repositorio | Estrellas observadas | Licencia raíz | Aporte utilizado |
| --- | ---: | --- | --- |
| [wshobson/agents](https://github.com/wshobson/agents) | 40.307 | MIT | CSS intrínseco, container queries, tipografía fluida y medios responsive |
| [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | 78.886 | Apache-2.0 | Adaptar la tarea/contenido al contexto móvil; diferenciar viewport, entrada táctil y hardware |
| [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | 134.133 | MIT | Jerarquía, lectura, interacción, formularios, estados y casos de overflow |
| [vercel-labs/web-interface-guidelines](https://github.com/vercel-labs/web-interface-guidelines) | 950 | MIT | Semántica, foco, formularios, medios y safe areas; excepción aproximada autorizada |
| [mui/material-ui](https://github.com/mui/material-ui) | 99.155 | MIT | Breakpoints del theme y queries de contenedor coherentes con el stack de Nodia |
| [twbs/bootstrap](https://github.com/twbs/bootstrap) | 174.796 | MIT | Capas CSS mobile-first y límites explícitos de rangos responsive |
| [microsoft/playwright](https://github.com/microsoft/playwright) | 97.358 | Apache-2.0 | Separar emulación de viewport, parámetros táctiles y motor de navegador |

También se inspeccionó [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills), 32.117 estrellas, commit `063bee94c3f4df8453406c830b0a7df0f2860278`. Su [web-design-guidelines/SKILL.md](https://github.com/vercel-labs/agent-skills/blob/063bee94c3f4df8453406c830b0a7df0f2860278/skills/web-design-guidelines/SKILL.md) enruta al repositorio Web Interface Guidelines; se utilizó esa fuente directa para no atribuir el mismo contenido a dos fuentes independientes. GitHub no devolvió SPDX de licencia raíz para agent-skills en la consulta.

## Archivos consultados y adaptación

### wshobson/agents — referencia proporcionada por el usuario

Commit: `46891e7e60da0e52baf1050b7b6391b64e84c6d9`.

- [Skill responsive-design](https://github.com/wshobson/agents/blob/46891e7e60da0e52baf1050b7b6391b64e84c6d9/plugins/ui-design/skills/responsive-design/SKILL.md).
- [Patrones detallados](https://github.com/wshobson/agents/blob/46891e7e60da0e52baf1050b7b6391b64e84c6d9/plugins/ui-design/skills/responsive-design/references/details.md).

Se aprovecharon criterios de layout intrínseco y ancho de contenedor. La guía local usa el theme del destino, queries sobre descendientes, estado compartido y ejemplos nuevos. Las escalas Tailwind y helpers de tipografía de la fuente no se trasladaron a Nodia. La elección de unidad de altura incluye la limitación de teclado visual verificada en MDN.

### pbakaus/impeccable

Commit: `d631a8827f99414d2b6daba4ef08b7f8701751d7`.

- [Adaptación web y referencia responsive](https://github.com/pbakaus/impeccable/blob/d631a8827f99414d2b6daba4ef08b7f8701751d7/skill/reference/adapt.md).

Se adoptó adaptación de contenido por tarea, preservación de funciones y distinción entre screenshot/gesto/hardware. En la skill local, navegación inferior, tablet con dos columnas y conversión a tarjetas son opciones dependientes del producto; el perfil Nodia reutiliza decisiones ya existentes. No se impone un rediseño ni la compra/disponibilidad de teléfonos para entregar.

### nextlevelbuilder/ui-ux-pro-max-skill

Commit: `50d8a7de0900119855614541f15a1a616691eb33`.

- [Catálogo UX](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/50d8a7de0900119855614541f15a1a616691eb33/.claude/skills/ui-ux-pro-max/data/ux-guidelines.csv), grupos Layout, Touch, Forms, Responsive, Typography, Feedback y Content.

Se utilizaron criterios de lectura, targets, labels, recuperación y layout estable. Se contextualizaron cifras de tamaño/espaciado como recomendaciones web y se mantuvo la política local de estados. La sugerencia del catálogo de ocultar overflow no se usa para encubrir desbordamientos. Duraciones de toast, escalas tipográficas y datos demostrativos no se convierten en defaults de producto.

### vercel-labs/web-interface-guidelines

Commit: `434b7f91364665f2f733b310ec54809bf8f37937`.

- [Reglas de interfaces web](https://github.com/vercel-labs/web-interface-guidelines/blob/434b7f91364665f2f733b310ec54809bf8f37937/command.md).

Se utilizaron semántica, foco no cubierto, entrada apropiada y dimensiones de medios. La guía local conserva autofill según el campo, no impone desactivarlo; evita listeners de teclado redundantes en controles nativos. CSS precede medición JS, y virtualización se decide por evidencia/contexto en lugar de un umbral universal de filas. Tampoco se impone persistir cada estado local en URL.

### mui/material-ui

Commit: `41c9cb4030274f3bde585d136949f447674e728b`.

- [Breakpoints](https://github.com/mui/material-ui/blob/41c9cb4030274f3bde585d136949f447674e728b/docs/data/material/customization/breakpoints/breakpoints.md).
- [Container queries](https://github.com/mui/material-ui/blob/41c9cb4030274f3bde585d136949f447674e728b/docs/data/material/customization/container-queries/container-queries.md).
- [Documentación publicada de breakpoints](https://mui.com/material-ui/customization/breakpoints/) y [container queries](https://mui.com/material-ui/customization/container-queries/).

Se conserva el theme del checkout como fuente de valores/APIs. La documentación externa no autoriza actualizar MUI ni adoptar un comportamiento de una versión distinta. El perfil verifica `down("sm")`, evita padding duplicado y conserva la reserva compartida de navegación.

### twbs/bootstrap

Commit: `7771f16bec8462e5cb2b4d375352682f15fe94b2`.

- [Breakpoints en el repositorio](https://github.com/twbs/bootstrap/blob/7771f16bec8462e5cb2b4d375352682f15fe94b2/site/src/content/docs/layout/breakpoints.mdx).
- [Documentación publicada](https://getbootstrap.com/docs/5.3/layout/breakpoints/).

Se utiliza el criterio de CSS base estrecho y mejoras por rango. Los breakpoints, Sass y clases Bootstrap no forman parte de esta skill ni se incorporan al cliente MUI.

### microsoft/playwright

Commit: `b28411b105a25fcd97014111764a1cf76f0c6bb0`.

- [Emulación en el repositorio](https://github.com/microsoft/playwright/blob/b28411b105a25fcd97014111764a1cf76f0c6bb0/docs/src/emulation.md).
- [Documentación publicada](https://playwright.dev/docs/emulation).

La verificación separa viewport, contexto táctil, motor y teléfono físico. No instala Playwright ni configura CI como efecto de activar la skill; usa herramientas existentes y declara huecos de evidencia.

## Fuentes primarias de verificación técnica

- [W3C: Reflow 1.4.10](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html): 320 CSS px equivalentes y excepciones bidimensionales.
- [W3C: Resize Text 1.4.4](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html): crecimiento de texto al 200%, distinto de reflow.
- [W3C: Target Size Minimum 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html): 24 × 24 CSS px o condiciones de separación/excepciones AA. El objetivo ergonómico local de 44 × 44 no se presenta como ese mínimo normativo.
- [MDN: unidades length](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/length): diferencias entre svh/dvh/lvh y unidades relativas.
- [MDN: VisualViewport](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport): teclado y zoom pueden reducir la región visible manteniendo el layout viewport.
- [web.dev: imágenes responsive](https://web.dev/learn/design/responsive-images): dimensiones, srcset, sizes y medios según contexto.

Los valores de padding, gaps, tabla650px, estados Sileo/Boneyard y barra de cinco accesos provienen de reglas/documentos/código de **Nodia**, no de los repositorios investigados. La matriz de QA es una decisión contextual basada en los breakpoints y evidencia local, no una norma de estos repositorios.
