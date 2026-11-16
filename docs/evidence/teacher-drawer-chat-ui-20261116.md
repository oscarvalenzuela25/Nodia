# Teacher: cabecera, drawer y selector IA — verificación2026-11-16

Rama actual `codex/durable-backend-uploads`, conservada por solicitud del usuario.
Alcance canónico: [plan106§11](../mvp/106-nodia-teacher-guided-ux-redesign.md#11-cabecera-drawer-adaptativo-y-selector-ia--solicitud2026-11-16).
Los mockups aceptados autorizan la implementación; no constituyen aprobación de
fichas/documentos o aceptación productiva.

## Alcance implementado

Estado de sesión a la derecha del título en las etapas; navegación de regreso
contained y acciones/resultado confirmado en una barra sin recarga contigua para
el resultado ready. El trabajo conserva sus otros estados, sondeo, errores y
recuperación conforme al contrato actual.

Las categorías adaptativas pasan a Drawer derecho, máximo 760 px y ancho disponible
en móvil. Mis fuentes es la primera categoría y se selecciona al entrar. Se
retienen formularios visitados y sólo se muestra el contenido activo. Cerrar o
cambiar categoría/viewport mantiene borradores y nodos existentes; cerrado no
inicia lecturas por un cambio de ancho.

El chat abre la configuración horizontal de IA aplicada y cuatro selectores
redondeados desde el resumen compacto de modelo/modo, en Popover anclado encima.
No hay botón «+». Los modelos/esfuerzos son dinámicos; elegibilidad, dirty/ready,
selección persistida, confirmación y errores conservan sus contratos. No se
importan capacidades de adjuntos de NodiaAI a Teacher.

La revisión final identificó una recuperación incierta que quedaría fuera del
foco modal del Drawer. Se incorporó RequestRecovery dentro de éste, usando el
mismo comando propietario y suprimiendo el control de fondo mientras está abierto.
La regresión atómica añadida para este ajuste está comprobada en la ronda focal
posterior a la suite global.
No se cierra ni se reenvía implícitamente una escritura de resultado incierto.

## Pruebas de comportamiento

| Unidades | Resultado confirmado en este corte |
| --- | --- |
| Selector IA Teacher | 31 pruebas correctas |
| MessageComposer, JobPanel y SetupConversation | 42 pruebas correctas |
| AdaptiveWorkspace, foco retenido y RequestRecovery, tras el ajuste de recuperación | 11 pruebas correctas en tres suites (8+2+1), 7,58s |

La suite global `npm run test -- --maxWorkers=4` pasó **3027 pruebas/364 archivos**
en 442,05s, antes de incorporar la última regresión de recuperación incierta. La
ronda focal posterior de 11 casos verifica el código final de ese ajuste. El
inventario total sube a 3028; **no hubo una segunda suite global de 3028 casos** y
no se presenta esa cifra como una ejecución global final correcta.

Tipado, lint de código (`npm run lint -- --ignore-pattern '.tmp/**'`, con los
experimentos previos ignorados fuera del alcance) y build correctos tras el
ajuste de recuperación. El build conserva los avisos de chunk grande y tiempos
de plugins; no se presenta como libre de warnings. El último ajuste exclusivamente
CSS alinea el chip a la derecha de su línea envuelta en xs. Su lint focal y el
build del código final pasaron; este último terminó en 13,74s. La matriz de seis
perfiles se repitió correctamente: chip al borde derecho de 374 px a 390 px y 304 px
a 320 px, conservando el padding de 16 px.

## Navegador sintético

Página Teacher y componentes productivos con transporte/datos sintéticos; estas
comprobaciones no usan una sesión productiva ni un proveedor de IA real.

| Viewport CSS px | Idioma/tema | Etapa | Resultado de layout |
| --- | --- | --- | --- |
| 1440×1000 | ES/oscuro | Plan generado | Documento sin overflow horizontal |
| 900×900 | EN/claro | Revisión | Documento sin overflow horizontal |
| 899×900 | ES/oscuro | Lección | Documento sin overflow horizontal |
| 600×900 | EN/claro | Práctica | Documento sin overflow horizontal |
| 390×844 | ES/oscuro | Borrador pausado | Documento sin overflow horizontal |
| 320×568 | EN/claro | Final | Documento sin overflow horizontal |

En los seis perfiles, scrollWidth coincide con clientWidth del documento. La
arista derecha del estado difiere como máximo 1 px de la fila del título; el botón
de regreso es contained. Se comprobó la secuencia acción principal→Aprendizaje
adaptativo→Opciones/Archivar→Resultado guardado cuando existe. En xs los botones
conservan ancho completo; cuando el chip pasa a otra línea, queda alineado a la
derecha de ésta. El resultado ready
no muestra recarga contigua.

El Drawer abre Mis fuentes por defecto, sin overflow horizontal local y sin
mutaciones de entrada. Escape devuelve foco al disparador. Popover desktop de
640 × 153,97 px; móvil de 288 px entre x=16 y x=304, dentro del viewport de 320 px. El editor
no incorpora «+». Los borradores de fuentes y repaso, y el mismo nodo DOM de
fuente, se conservan al cerrar, cambiar categoría y redimensionar. Cambiar el
ancho con el Drawer cerrado no agregó lecturas.

### Fallos y datos incompletos

- Un 503 de enriquecimiento conserva la salida de reintento; una respuesta que
  no cumple el esquema también ofrece retry, sin presentarse como estado vacío.
- Selección histórica incompleta del ensayo, sin el esfuerzo requerido por ese
  modelo configurado: no se hace una consulta de elegibilidad para esa tupla y la generación permanece bloqueada, sin fallback.
- Título largo a 320 px: el documento no desborda horizontalmente.
- Guardado de selección con 503: Popover y selección local permanecen visibles.
  El reintento explícito produce dos PATCH observados en total, ambos con el
  esfuerzo exacto `low`; cero POST o inferencias. El fallo conocido no se trata
  como autorización para repetir una escritura incierta.

El ensayo de pérdida de respuesta al guardar fuente conserva el borrador y
muestra la recuperación dentro del Drawer. Se observan una intención original
`source_create` (un POST) y una consulta del recibo original (un GET), sin replay
ni inferencia. El bloqueo se libera tras el acuse. Es transporte sintético;
no demuestra una escritura productiva ni aceptación de otro entorno.

Sin contratos Server, permisos, capacidades, modelos estáticos, migraciones o
despliegue nuevos. Las medidas pertenecen al viewport y las fixtures indicados;
no acreditan teléfono/teclado virtual físicos, Safari, comprensión humana,
eficacia educativa o mejora de rendimiento.

## Aviso observado durante la QA

El log del servidor Vite de QA registra el aviso del navegador
`ResizeObserver loop completed with undelivered notifications.` durante
recorridos sintéticos con redimensionado y edición de textarea a las 11:09,
11:10 y 11:14 del 2026-11-16 (America/Santiago). Su origen no quedó aislado contra
un baseline; no se clasifica como previo ni se afirma una consola sin avisos.
Las comprobaciones de geometría, borrador, foco y recuperación pasaron; el aviso
no se presenta como evidencia de un fallo de UI o de proveedor/red no observado.

Este apartado conserva el corte inicial. La solicitud posterior de corregir el
aviso y su aislamiento se registran en la [continuación siguiente](#corrección-del-ciclo-de-medición--solicitud2026-11-16).

## Corrección del ciclo de medición — solicitud2026-11-16

El usuario pidió corregir el aviso en la misma rama, sin cambiar diseño ni perder
borradores. El alcance se limita al ciclo de vida de la medición de
[TeacherLoading](../../nodia-client/src/modules/teacher/components/TeacherLoading/TeacherLoading.tsx)
y a su regresión; no modifica proveedores, formularios o contratos remotos.

### Aislamiento y corrección candidata

El mismo recorrido de continuidad reprodujo **dos avisos nativos sin instrumentar**.
La instrumentación diagnóstica, que identifica propietario y nodo observado sin
aplazar callbacks ni interceptar los errores, reprodujo dos avisos. En los ciclos
afectados aparecen los observadores DIV de Boneyard del workspace y del historial,
junto con el observador del textarea MUI. El Skeleton mantenía esos observadores
de ancestros aunque `loading` ya era `false`, mientras el textarea ajustaba su
altura. No se atribuye el aviso a una inferencia, HTTP o dato operativo.

La corrección desmonta Skeleton al terminar la carga inicial. El contenido cargado
mantiene LoadingRegion y los dos contenedores neutros con la misma geometría; los
borradores y sus campos no cambian de instancia durante refetch, error o cambio
de ancho. Boneyard sigue proporcionando el skeleton inicial; no se cambia su
dependencia, el autosize MUI ni el diseño. No hay supresión global de errores,
parche de ResizeObserver o planificación artificial en producción.

El candidato instrumentado repitió el recorrido con **cero avisos**, conservando
los borradores de fuente/repaso, nodo de editor, foco y rutas de recuperación GET
y PATCH de selección. Esta comprobación local no afirma ausencia de avisos en
todos los navegadores o recorridos.

### Verificación de esta corrección

- TeacherLoading: **3 pruebas correctas**, incluidas las dos regresiones previas.
  La nueva usa Skeleton real y un ResizeObserver tipado de prueba para demostrar
  desconexión al terminar la carga, ausencia de nuevas mediciones de Skeleton con datos y
  conservación del textarea, texto, foco, caret y montaje entre refetch/error y
  cambios de `compact`. ESLint focal correcto.
- Suite global: **363/364 archivos y 3033/3034 casos correctos**, aproximadamente
  470s. El único fallo pertenece a un caso de NodiaAI modificado concurrentemente
  después de iniciar la ejecución: el worker había compilado una versión que
  intentaba clicar un control deshabilitado con `userEvent`. El archivo actual,
  corregido por ese trabajo concurrente, usa el evento adecuado para comprobar
  el guard de estado. Esta revisión ResizeObserver no modifica esos archivos.
  La revalidación focal del código actual pasó; no se afirma una segunda global
  completamente correcta ni se presenta el resultado global inicial como limpio.
- Código final: **60/60 pruebas en cinco suites**, 14,18s, de TeacherLoading,
  SetupConversation, JobPanel, AdaptiveWorkspace y ConversationHistory. Incluye
  los tres casos de carga/medición y los 16 del historial concurrente, sin editar
  sus archivos desde esta revisión. El caso que falló en la global pasa con la
  versión actual de ese test.
- Navegador nuevo independiente, sin parche de ResizeObserver y con un listener
  que sólo registra sus errores nativos: **tres recorridos de continuidad, cero
  avisos en cada uno**. Fuentes/repaso y el mismo nodo de fuente se conservan;
  reintento GET, selección rechazada503 y dos PATCH explícitos con la tupla exacta
  mantienen sus garantías, sin POST a proveedores.
- Matriz de seis perfiles repetida: cero avisos ResizeObserver nativos. Frente a
  la matriz anterior, coinciden exactamente el ancho/scroll del documento,
  coordenadas/tamaños de título, fila, chip y resultado, orden de acciones y
  dimensiones del Drawer en los seis casos. El diseño conserva su geometría.
- Comparación visual: cuatro capturas coinciden píxel a píxel (plan1440,
  práctica600, pausa390 y final320). Revisión900 y lección899 sólo difieren en
  regiones de controles de acción; no se afirma igualdad de píxeles en los seis
  estados ni se atribuye una causa a esas diferencias a partir de esta medición.
- MessageComposer productivo con borrador sintético: conserva el mismo textarea,
  texto, foco y selección 4…13 en 1280→320→600→1280px y al abrir/cerrar el Drawer.
  Su autoguardado sintético confirma una única PATCH de setup-draft con revisión 1;
  este recorrido registra cero avisos ResizeObserver. No equivale a persistencia
  en un entorno productivo.
- Tipado, lint de código completo (`npm run lint -- --ignore-pattern '.tmp/**'`,
  excluyendo los experimentos previos) y build del código final correctos. El
  build terminó en **18,91s**, conservando los avisos de chunk mayor de500kB y
  tiempos de plugins; no se presenta como libre de warnings.

El código final declara el contenedor relativo en `styles.ts` con MUI/Emotion,
manteniendo los dos DIV y su geometría. La matriz y la continuidad del compositor
se repitieron también sobre esa versión final sin avisos nativos y con los mismos
resultados de geometría y borrador.

Los reportes auxiliares están en `output/teacher-resize-repeated.log`,
`output/teacher-resize-matrix.log` y `output/teacher-resize-comparison.json`;
la continuidad del compositor está en `output/teacher-resize-message-draft.log`.
Los resultados anteriores quedan consolidados aquí sin depender de temporales.

**Impacto de conocimiento:** ajuste técnico de ciclo de vida que conserva la
presentación y las operaciones ya descritas. No cambia conceptos de Teacher,
interpretación de resultados, contexto enviado, herramientas, permisos o contratos;
las fichas candidatas existentes no necesitan una revisión semántica ni se aprueban
o publican por este arreglo. Sin despliegue, inferencia real o aceptación física.

**Cierre de esta corrección:** reproducción aislada y validación independiente
local completadas, con pruebas actuales, tipado, lint y build correctos por el
alcance anterior. Cinco documentos comprobados UTF-8/LF sin BOM, ocho enlaces/
anclas nuevos válidos y diff correcto. No se altera el cierre global histórico
ni se afirma aceptación de todos los dispositivos, navegadores o entornos.

## Comprobación documental

Los párrafos siguientes conservan el cierre de la entrega inicial de cabecera y
paneles; la corrección de medición tiene su cierre específico en el apartado superior.

Once documentos UTF-8/LF sin BOM y 25 enlaces/anclas locales pertinentes válidos;
`git diff --check` correcto en el corte inicial. `knowledge:check` y
`knowledge:build` correctos: 95 fuentes, 51 excluidas, 44 documentos/46 fragmentos;
release `9f7cb7e13becc051f1c90d6f2e0014eb18f78e4711a2a820971c38a2df4c77e8`
conservado. Producto41, sesión36 y experiencia guiada3 siguen draft/partial/
unregistered/approval:null. Los borradores están excluidos; los checks no
acreditan inferencia, publicación o aceptación productiva.

Cierre documental: once documentos UTF-8/LF sin BOM y 26 enlaces/anclas locales
pertinentes válidos; diff correcto. Check/build de conocimiento repetidos sobre
el texto final de las candidatas con los mismos conteos/release. No se publican
borradores ni se alteran fichas aprobadas.
