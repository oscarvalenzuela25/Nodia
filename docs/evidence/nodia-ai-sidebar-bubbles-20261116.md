# NodiaAI: historial compacto y burbujas — verificación local2026-11-16

Rama de trabajo: `codex/durable-backend-uploads`, conservada por solicitud del
usuario. Alcance canónico: [plan107§13](../mvp/107-nodia-ai-ux-ui-upgrade-plan.md#13-historial-compacto-y-burbujas--solicitud2026-11-16).
Los mockups fueron aceptados como dirección visual; esta evidencia distingue esa
aceptación del resultado local y de cualquier adopción productiva posterior.

## Comportamiento implementado

- Marca Karmatic Arcade a34px con degradado primary→tertiary, igual que Teacher.
- Historial expandido244px y barra colapsada64px. El icono de menú de su cabecera
  sustituye el botón exterior. La barra conserva expansión y un icono por
  conversación, con tooltip de título/modelo; las opciones sólo se usan expandido.
- En anchos inferiores a900px la barra permanece visible y expandir abre el
  historial en Drawer. El estado del propietario conserva filtros y borrador;
  no se duplican consultas por cambiar de representación.
- Compositor con radio16px y resumen IA según su contenido. Cuando el compositor
  tiene como máximo20rem de ancho, una container query local pasa el selector a
  la siguiente fila de herramientas para conservar controles de44px.
- Respuestas dentro de panel con superficie/borde sutiles y esquina de globo
  hacia la entidad; metadata encima y copia por icono dentro, con tooltip y nombre
  accesible, sin texto «Copiar» permanente. Markdown y contenido permitido para
  copiar conservan sus reglas.

## Pruebas de comportamiento

Comprobaciones focales confirmadas antes de la ronda global final:

| Unidades | Resultado confirmado |
| --- | --- |
| ChatMessage, RunActivity y MessageMarkdown | 41 pruebas correctas |
| ConversationHistory y ComposerSelection | 26 pruebas correctas en la primera focal; ConversationHistory11 final incluye foco y menú tras cambio responsive |
| Página NodiaAI, sobre la integración final | 60/60 correctas,73,14s |
| NodiaAIRoute y ConversationHistory, después de corregir expectativas de título | 18/18 correctas:7de ruta y11de historial,9,16s |
| NodiaAIRoute, ConversationHistory y ComposerSelection sobre la separación final del menú | 34/34 correctas:7de ruta,11de historial y16de selección,10,30s |

La cabecera expandida/colapsada comparte el mismo nodo de control para conservar
foco de teclado en escritorio. Al terminar de cerrar el Drawer móvil, `onExited`
restaura el foco en el control de la barra. El estado del menú pertenece al
contenido expandido y se descarta al colapsar; no requiere leer nodos DOM durante
render. Las regresiones atómicas de foco y menú quedaron comprobadas en
ConversationHistory11 sobre la separación final del menú. Una comprobación posterior en
navegador confirmó foco conservado tanto al colapsar como al expandir en escritorio.

`npm run test -- --maxWorkers=4` terminó en451,85s:362/363archivos y3015/3017
pruebas correctos. Los únicos fallos fueron las dos expectativas del título
anterior en NodiaAIRoute. La corrección y sus18casos focales posteriores cubren
los archivos afectados; **no hubo una segunda corrida global limpia**. El conjunto
de pruebas queda verificado por la corrida global y la revalidación focal,
sin sumar los casos repetidos como garantías nuevas.

La primera integración de lint informó52errores. Se corrigió el acceso de refs:
`toggleRef` se desestructura en el límite y el contenido expandido es dueño del
menú, que se desmonta al colapsar. El toggle conserva su nodo exterior. Lint
focal correcto tras la corrección, sin silenciar reglas. El tipado anterior a
lint pasó. Las34pruebas focales de ruta/historial/selección y la página60 finales
pasaron. `npm run typecheck` final correcto. Lint de código completo correcto con
`npm run lint -- --ignore-pattern '.tmp/**'`: los experimentos locales ignorados
se excluyen, sin desactivar reglas. `npm run build` final correcto (tsc-b+Vite,
exit0). Conserva el warning previo de bundle>500kB y avisos de tiempos de plugins;
no se presenta como build sin warnings.

La primera ronda global detectó dos expectativas de ruta con el título anterior
«Nodia AI». Se actualizaron al título vigente «NodiaAI» y se conservó el resto de
assertions; el verificador manual se ajustó de la misma manera. No se omitieron
pruebas ni se amplió el timeout para este cambio.

## Navegador sintético

Chromium mediante el harness local `src/test/manual/nodia-ai-ux/index.html`,
escenario `chat-redesign`, con respuestas sintéticas y sin llamadas reales a un
proveedor. Se usó la página y sus componentes actuales; no son inferencias,
autenticación productiva ni un teléfono físico.

| Viewport CSS px | Idioma/tema | Documento/scroll px | Radio compositor | Alto formulario con borrador | Selector IA |
| --- | --- | --- | --- | --- | --- |
| 1440×1000 | ES/oscuro | 1440/1440 | 16px | 128px | 157,11×44px |
| 900×900 | EN/claro | 900/900 | 16px | 128px | 157,11×44px |
| 899×900 | ES/oscuro | 899/899 | 16px | 128px | 157,11×44px |
| 600×900 | EN/claro | 600/600 | 16px | 128px | 157,11×44px |
| 390×844 | ES/oscuro | 390/390 | 16px | 172px | 157,11×44px |
| 320×568 | EN/claro | 320/320 | 16px | 172px | 157,11×44px |

En los seis perfiles se comprobaron título34px, texto visible vacío en el botón
de copia, tooltip de conversación e inexistencia de botones de opciones en la
barra colapsada. Colapsar/expandir conservó el borrador. Los controles del
compositor medidos quedaron dentro del viewport; Escape cerró el Drawer y
devolvió el foco al icono de expansión en móvil. La barra colapsada midió64px;
la tabla conserva la medida del panel tras reexpandir en escritorio.

Una misma instancia recorrió1440→320→1440px: conservó el texto del compositor
y la búsqueda «QA», con la barra64px al colapsar. Hubo7GET iniciales y8al
terminar porque la búsqueda explícita provocó una lectura adicional. Redimensionar
no agregó mutaciones. Se pulsó el icono de copia; no hubo solicitudes distintas
de GET ni inferencias. El resultado HTTP aquí pertenece al adapter sintético.

Los seis perfiles y el recorrido de continuidad se volvieron a ejecutar sobre
la separación final del menú; conservaron exactamente las medidas, borrador,
búsqueda y7→8GET anteriores, sin mutaciones.

Se observan los avisos previos de React por setState durante render y de Emotion
por el selector first-child. No se afirma una consola libre de errores. Las
capturas/logs auxiliares quedan en `output/` ignorado; esta tabla y los resultados
consolidados conservan la evidencia útil sin depender de esos temporales.

## Documentación y límites

`knowledge:check` y `knowledge:build` correctos:95fuentes,51excluidas,
44documentos/46fragmentos; release sin cambios
`9f7cb7e13becc051f1c90d6f2e0014eb18f78e4711a2a820971c38a2df4c77e8`.
Nueve documentos comprobados UTF-8/LF sin BOM, referencias locales nuevas válidas
y `git diff --check` correcto. Producto80 y ficha16 permanecen
draft/unregistered/approval:null; no se publicaron borradores ni se alteraron
fichas aprobadas.

El formulario móvil172px corresponde a la adaptación que reserva espacio para
la barra y controles; no es una mejora de rendimiento ni una reducción frente
al baseline anterior. No hay medición de latencia, red real, memoria, Safari,
teclado virtual, micrófono, dispositivo físico o eficacia humana. Contratos
Server, permisos, Agentic/API key, selección exacta, adjuntos, Stop, propuestas,
confirmación y recuperación permanecen fuera de cualquier nueva autoridad de
esta presentación. Sin despliegue ni aceptación operativa de este nuevo alcance.
