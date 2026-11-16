# NodiaAI UX/UI — implementación y verificación local

Fecha: 2026-11-15. Alcance: [plan107 R02](../mvp/107-nodia-ai-ux-ui-upgrade-plan.md#11-implementación-local-solicitada-en-la-misma-rama--2026-11-15).
Rama `codex/nodia-ai-ux-ui-upgrade`, base
`d2baa8f16f7ca352437cbed0890ac4e7b4e53f2e` de `origin/development`.
Implementación autorizada por el usuario después de la planificación. Este
recibo no aprueba documentos ni acredita adopción operativa o uso humano real.
La adopción operativa posterior del16nov se registra al final, por su propio
recibo; no amplía el alcance sintético de esta verificación local.

## Cambio comprobado

Workspace flex optativo de conversación, respetando PageContent/GuardStrict,
topbar/sidenav y reserva de MobileBottomNav. Historial plegable, columna de
lectura, asistente editorial y usuario diferenciado; un propietario del ritmo
entre artículos dentro de Boneyard. El scroll conserva fondo/ancla al cambiar
historial o breakpoint y al cambiar el espacio del compositor.

Un compositor de dos niveles: texto a ancho completo y herramientas/selección/
dictado/Enviar o Stop. `layout=stacked` es optativo; Teacher conserva inline y
su captura/estado. El editor IA se abre por intención en Popover MUI accesible,
con tamaño independiente del botón, scroll local y montaje conservado. Cambios
sin aplicar y fallos siguen visibles a ancho completo al plegar, sin ocultar el
selector detrás del textarea. Aplicar con éxito devuelve foco al nuevo resumen
confirmado; un refetch posterior no lo roba.

Copiar respuesta escribe sólo el texto mostrado y emite feedback ES/EN. El
renderer Markdown mantiene sus límites: HTML inerte, enlaces admitidos y scroll
local, sin recursos remotos o formatos nuevos. Adjuntos, revisión, propuestas,
recibos, confirmaciones, permisos, CAS e incertidumbre reutilizan sus contratos.
No se cambiaron Server, modelos, credenciales, dependencias o base de datos.

## Laboratorio y comparación geométrica

Chrome157.0.8103.52, Chromium headless, mismo canal instalado antes/después.
Harness conservado en [manual QA](../../nodia-client/src/test/manual/nodia-ai-ux/README.md):
componentes reales de NodiaAI, GuardStrict real, wrappers reales de layout,
contenido de sidenav/topbar/dock sintético y adapter Axios en origen aislado
`127.0.0.1:5194`. No es una sesión autenticada de una persona ni autorización
de backend real. Fuentes cargadas y cero fallos de recursos en las medidas.

Baseline desde snapshot `git archive HEAD:nodia-client` anterior al cambio.
Mismas fixtures, wrappers, tamaños/idiomas/temas; la configuración pública de
ambos builds se alineó por `envDir`/`loadEnv` sin copiar o imprimir valores.

| Perfil | Lectura antes→después, px | Compositor antes→después, px | Documento antes→después, px |
| --- | --- | --- | --- |
| 320×740 ES oscuro | 315→316 | 195→120 | 870→740 |
| 390×844 EN claro | 357→420 | 189→120 | 906→844 |
| 600×900 EN oscuro | 493→616 | 197→128 | 900→900 |
| 900×760 ES claro | 369→476 | 197→128 | 760→760 |
| 1440×900 ES oscuro | 565→616 | 141→128 | 900→900 |
| 320×568 ES oscuro | 315→144 | 195→120 | 870→568 |

En320×568, la región antigua de315px pertenecía a un documento de870px: el
compositor terminaba en689px, fuera del viewport y en conflicto con la reserva.
Ahora termina en396px, sobre la navegación inferior. No comparar esos315px como
lectura íntegramente visible frente a144px nuevos. Las primeras variantes de
tres filas restaban lectura; se descartaron y se verificó la de dos niveles.

Matriz final:28 perfiles (320/390/599/600/899/900/1440px × ES/EN × claro/oscuro),
sin overflow horizontal global, excepciones o peticiones HTTP reales a APIs.
Acciones nuevas de NodiaAI con objetivos≥44px. Aumento de texto de laboratorio
al200% (`documentElement` a32px) a899px sin overflow, con selector operable;
no equivale a zoom del navegador ni teclado físico.

## Recorridos y límites funcionales

| Recorrido | Resultado observado |
| --- | --- |
| Selector dirty→cerrar→resize320×568→reabrir | Texto/selección/aviso conservados, Enviar bloqueado; botón alcanzable |
| Aplicar selección con503 sintético | Popup abierto, valores/texto intactos, error visible y reintento explícito |
| Aplicar selección con éxito | Selección API key exacta, mismo borrador y foco en el resumen nuevo |
| Revalidación/error503/recuperación de GuardStrict | Mismo textarea y borrador; inert durante lectura/error, aviso visible |
| Historial plegado en fondo/leyendo y cruce899/900 | Fondo o mismo messageId/offset preservados; ritmo real24px |
| PNG original y revisión con503 sintético | Editor, original y texto del mensaje conservados; sin mensaje IA nuevo |
| Dictado simulado y adjuntos | Texto conservado, sin autoenvío; no reconocimiento/micrófono físico acreditados |
| Sólo lectura / unknown / turno activo | Sin compositor en read-only; envío/captura bloqueados en unknown; Stop44px sustituye Enviar activo |
| Bienvenida sin chat | CTA explícito y sin compositor previo a crear; no creación por montar la página |

Abrir `chat-redesign` conserva **siete GET idénticos**: autorización y seis
lecturas NodiaAI, cero mutaciones. Selección y upload/revisión en otros recorridos
emitieron PATCH/POST/PUT exclusivamente al adapter sintético. No hubo inferencias,
creación de chats, cancelación remota o efectos comerciales reales; controles
de Stop/creación se observaron sin pulsarlos en navegador. Sus reglas se cubren
además con regresiones unitarias/integradas existentes.

No se capturó carga inicial deliberadamente demorada para Boneyard; no se afirma
validación visual específica de ese estado. Sí se comprobó retención durante
revalidación. El baseline nuevo no reprodujo el desborde61px histórico de93;
el candidato tampoco lo presenta en el estado simulado. No se reescribe la
evidencia histórica ni se certifican todos los dispositivos.

## Checks de código y resultado de las rondas

- Suite global final: **3013/3013 pruebas,363/363 archivos**, comando
  `npm run test -- --reporter=dot --maxWorkers=4`,448s, sin build/lint concurrentes.
- Antes de ese cierre:127 regresiones en10unidades afectadas,76 de selector/
  página y revisión independiente; los conteos se solapan con la suite global.
  Incluyen núcleo/dictado compartidos y Teacher, foco y recuperación.
- `npm run typecheck` y build final correctos; el build ejecuta `tsc -b` y Vite.
  Salida aislada `output/nodia-ai-ux-build`, vaciada sólo tras verificar su path.
- `npm run lint -- --ignore-pattern '.tmp/**'` correcto para código y harness.
  El comando sin exclusión encontró cuatro errores previos en experimentos
  ignorados bajo `.tmp` de POS/productos/Teacher; no se alteraron sus archivos ni
  reglas para silenciarlos. El error inicial del harness nuevo sí se corrigió.
- Una ronda global con carga concurrente tuvo3012 correctos y un timeout RTL al
  esperar el badge OCR. Ese caso pasó aislado1/1 y la página60/60 sin cambios.
  RTL concede1s a `findByText`, independiente del timeout general15s. AutoUpload
  e import dinámico/render de adjuntos son etapas diferentes; el DOM truncado no
  identificó cuál quedó pendiente. Contención es una explicación compatible,
  no una causa probada. La ronda final4workers pasó sin cambiar código,
  assertions ni timeouts. La salida fallida se conservó en output.
- Warnings previos conservados: React setState durante render/Emotion
  `:first-child` en navegador de desarrollo, y chunk>500kB en build. No se
  presentan como fallos nuevos corregidos o evidencia de disponibilidad IA.
- Knowledge check/build:95fuentes,51excluidas,44documentos/46fragmentos;
  release publicable conservada
  `9f7cb7e13becc051f1c90d6f2e0014eb18f78e4711a2a820971c38a2df4c77e8`.
  Los drafts no se publican. Producto/ficha siguen con approval:null.

## Bytes y coste de la entrega

Node24.20.0, `node:zlib.gzipSync(buffer)` por archivo sin opciones; equivalencia
con nivel6 comprobada sobre259JS/CSS de ambos builds. Estos valores difieren
del estimador gzip de consola de Vite; el método de comparación es el mismo.

| Medida | Antes | Después | Delta |
| --- | --- | --- | --- |
| JS total bruto | 4151500 | 4160292 | +8792bytes |
| JS total gzip | 1282641 | 1284486 | +1845bytes |
| Archivos JS | 127 | 128 | +1 |
| CSS bruto/gzip,2archivos | 39261/7740 | 39261/7740 | 0 |
| Entry NodiaAI bruto/gzip | 143812/46818 | 150121/47906 | +6309/+1088bytes |
| Cierre estático ruta bruto/gzip | 2150418/686757 | 2159691/689020 | +9273/+2263bytes |
| JS en cierre estático | 60 | 62 | +2 |

El cierre estático sigue imports, excluye lazy/cache y no es latencia medida.
No se afirma ahorro de descarga, render, memoria o coste de inferencia; la
ganancia acreditada es geometría/ergonomía con sus regresiones. No se añadió una
dependencia. El coste de scroll con un historial masivo no se midió.

Pin de19archivos de producción (path/hash SHA256 ordenados, JSON ASCII compacto,
sin tests/docs): `4a99ba53367b2b25f716f1fe762da871166db1489d763f273d2d2b307ebfc028`.
Los reportes extensos/experimentos permanecen en output; el harness documentado
permite repetir el recorrido sin depender del snapshot temporal de baseline.

## Vistas finales y continuación

[Escritorio sintético](nodia-ai-ux-desktop-20261115.png) ·
[Móvil320×568 sintético](nodia-ai-ux-mobile-20261115.png).

El servidor QA5194 se cerró y no quedó listener; otros servidores no se tocaron.
No hay despliegue/DB/proveedor real ni aceptación humana/operativa nuevos.
Continuar NAIUX-07 en [TODO](../mvp/TODO.md): comprensión/UI real, teléfono/
teclado virtual/Safari y adopción mediante el procedimiento del entorno. No
repetir la construcción/baseline ni inferencias históricas para esa continuación.

## Continuación: publicación productiva — 2026-11-16 America/Santiago

[CI43798403214](https://github.com/oscarvalenzuela25/Nodia/actions/runs/43798403214)
y [CD43799433169](https://github.com/oscarvalenzuela25/Nodia/actions/runs/43799433169)
correctos, después de integrar PR36 en development y promover PR37 a master
`6ba2afb7d258548ca68c245fb8282759a30d0ce4`.
Client`client-6ba2afb7d258-bbb5c0a0fa85`, Pages
`bcf7cb3c-3bfd-4efd-93fb-fac3a3afbe8a`, quedó complete. Árbol
`bbb5c0a0fa85a0c219516946378022d03cc7f33e86b9f941c16f0a9ecf509c47`, igual al
candidato538 fallido, con una intención y artefacto nuevos. No hubo replay del
CI/CD anterior. Backend6ba/c01 complete, postcheck SSH/HTTPS correcto y10recursos
PWA verificados en1intento.

[Recibo oficial14196161759](https://github.com/oscarvalenzuela25/Nodia/actions/runs/43799433169/artifacts/14196161759),
[evidencia de entrega](deploy-upload-reconciliation-20261115.md) y
[JSON durable](deploy-upload-reconciliation-20261115.json) separan el fallo previo,
archivo/gateway y despliegue nuevo. Sólo el mantenimiento gateway conservó PIDs;
el deploy posterior normal sí reinició servicios conforme al protocolo. Sudo
invalidado y tmux administrativo cerrado al finalizar.

Esto cierra la adopción operativa productiva de NAIUX-07, sin convertir las
medidas anteriores en datos de campo. Comprensión/UI autenticada real,
teléfono/teclado virtual/Safari continúan pendientes. Sin inferencias o aceptación
humana nuevas, aprobación documental o publicación de fichas. Continuar esa
revisión sin repetir el despliegue, baseline o construcción ya completados.
