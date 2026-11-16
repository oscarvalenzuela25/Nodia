# Teacher: revisión del plan con lectura primero

Solicitud2026-11-16, [plan106§13](../../mvp/106-nodia-teacher-guided-ux-redesign.md#13-revisión-del-plan-legible-y-edición-progresiva--solicitud2026-11-16).
Implementación local en `codex/durable-backend-uploads`, HEAD
`0c30a767f3deab17d361fcf8db5fe5c86cfb027c` con cambios sin commit.
Entrega parcial de TUX-04; no acredita aceptación humana ni adopción por entorno.

## Capturas nativas

PNG obtenidos directamente de Chromium157.0.8103.52, sin generación ni retoque,
con fuentes cargadas. Español/oscuro; escritorio1280×900 y móvil390×900 CSS px.
Las capturas de escritorio abarcan el documento completo. La móvil usa scroll
normal hasta el título de revisión. Se conservan el padding/layout del producto.

- [Resumen y recorrido en escritorio](overview-desktop.png).
- [Detalle de una sección](section-desktop.png).
- [Resumen en móvil](overview-mobile.png).
- [Sección desplegada en móvil](section-mobile.png): captura adicional solicitada
  por el usuario,390×900, scroll normal al recorrido; sin overflow horizontal ni
  mutaciones al desplegar. Mismo Chromium, tema, idioma y fixtures.

URL local del harness: puerto5195,
`/src/test/manual/teacher/index.html?scenario=review&reviewSize=long&lang=es&theme=dark`.
Son componentes productivos con transporte en memoria y una propuesta QA de
cuatro secciones/doce unidades; usuario, modelos, textos y contadores son
sintéticos. No se conectaron proveedores, Server o base de datos reales.

| PNG | SHA-256 |
| --- | --- |
| overview-desktop.png | `857ab963c08fa77f71bd2dd952256d17dddab980619228bff2ef442c215ff5ab` |
| overview-mobile.png | `bf6f1aa8cc6737f3101ee750295c0e5d51946ddf2009230bba4aed8178dc089a` |
| section-desktop.png | `52f2a58b38d1c89ba7057bc9899abec5bfe549c3fc129f504dc204ab32a46d3c` |
| section-mobile.png | `0c63111229911b1b0d12987286ea293dd0fa609ccdd65791e43db52e0a0c0582` |

## Comportamiento comprobado

Primero se presenta el objetivo, organización y conteos del outline, con la
decisión «Usar este plan» y su consecuencia. El recorrido revela objetivos y
unidades bajo demanda. «Editar estructura» conserva todas las operaciones
existentes y «Pedir un ajuste» explica la generación de otra propuesta. El chat
de planificación queda después, plegable y siempre montado cuando corresponde;
sin propuesta sigue visible. No se prepara material automáticamente por aceptar.

Matriz de12perfiles Chromium:320/390/600/899/900/1280px, altura900px,
ES/oscuro y EN/claro; este último con organización por jornadas. Sin overflow
horizontal del documento, cero textboxes visibles al entrar, cero mutaciones
por leer y CTA de44px habilitada aunque la selección IA no esté disponible.

Recorrido integrado con las fixtures:

- El editor conserva valor y nodo del título, y el conteo inválido vacío, al
  plegar/reabrir y cruzar390/900/1280px. La vista de lectura muestra por qué no
  se puede continuar y ofrece regresar a los cambios pendientes.
- Rechazos503 y409 de PATCH conservan edición y bloquean aceptación. Tres
  intentos explícitos, dos rechazados y uno confirmado, producen una revisión2
  sintética. Una única aceptación explícita envía el ID y hash de esa revisión.
  Los hashes de fixtures son marcadores, no evidencia criptográfica de Server.
- Borradores de ajuste y conversación conservan los mismos nodos al plegar y
  reabrir. El autosave normal de la conversación sigue siendo el existente;
  no se envía un mensaje ni se solicita otra inferencia por esos controles.
- La revisión independiente identificó la posibilidad previa de pedir ajustes
  con conteos inválidos que aún no se propagaban al outline. Se cerró con
  `!policyValid`: también bloquea ajustes. Verificado con IA sintéticamente
  disponible: corregir el conteo habilita el botón, sin enviarlo automáticamente.
- En esa comprobación final, textarea de ajuste, foco, selección4:9 y valor
  sobrevivieron a1280→390→1280px; cero mutaciones. Cero eventos `window.error`
  y avisos ResizeObserver en la matriz y recorridos ejecutados.

El primer runner esperaba una pantalla de plan guardado, pero la fixture antigua
tenía una unidad/material seleccionados sin plan. Se corrigió exclusivamente el
cursor sintético para reflejar la etapa de revisión; la repetición completa pasó.

## Checks y alcance

- Suite general:365archivos/3039pruebas correctos en306.35s,8workers. Esta pasada
  comenzó antes del último bloqueo `!policyValid` de ajustes y su assertion.
- Después de ese cierre y del caso histórico adicional:26pruebas focales correctas
  en12.38s, cubriendo PlanReview, PlanStructureEditor y SetupConversation.
  No se afirma otra pasada global posterior.
- Tipado correcto; build final `tsc -b && vite build` y lint final correctos.
  Lint excluye sólo `.tmp/**` de experimentos ignorados. Vite mantiene los avisos
  previos de tamaño de chunks/timing; no se desactivaron reglas o pruebas.
- Regresiones de lectura sin mutación, aceptación sin IA, guardado manual,
  borrador inválido, ajuste retenido, IDs/relaciones al reordenar y sección nueva.
- Propuesta histórica con título ausente, duración desconocida y sin secciones:
  muestra vacío y datos disponibles, respeta la aceptación deshabilitada y no
  inventa jornadas; sólo cambia esa duración tras una edición explícita.

Scripts y logs intermedios en `.tmp/` y `output/` ignorados. No se cambian HTTP,
permisos, recibos, proveedor, modelo o aceptación por revisión/hash. Las capturas
de lectura no cambian por el último bloqueo del ajuste inválido. Sin despliegue,
publicación ni aprobación de fichas. Comprensión humana, sesión autenticada,
teléfono físico/teclado virtual y Safari real siguen pendientes por sus alcances.
