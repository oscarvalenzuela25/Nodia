# Temas personales desde el topbar — Nodia

> Estado documental: en revisión; implementación solicitada explícitamente el
> 2026-11-16. La autorización de desarrollo no aprueba esta especificación ni
> las fichas NodiaAI. THEME-001 cerrado por alcance con aceptación humana de QA
> el2026-11-16 (§9); verificación técnica conservada en§8. Este cierre no registra
> una adopción nueva ni amplía la compatibilidad a dispositivos no identificados.

## 1. Solicitud y fuentes

Permitir que cualquier persona elija la apariencia de Nodia desde el topbar,
conservando el tema Nodia actual como predeterminado. Incorporar los temas
predefinidos del [editor tweakcn](https://tweakcn.com/editor/theme), adaptados a
MUI con contraste legible y un archivo por tema con `export default`.

Fuentes internas: [diseño07](07-design-constraints.md),
[stack08](08-stack-frontend.md), [DESIGN](../../nodia-client/DESIGN.md),
[paletas actuales](../../nodia-client/src/theme/palette.tsx),
[provider único](../../nodia-client/src/providers/MUIProvider.tsx) y
[preferencia local](../../nodia-client/src/store/configStore.tsx).
El [repositorio oficial de tweakcn](https://github.com/jnsahaj/tweakcn) es la
fuente del catálogo incorporado; el editor de shadcn no se instala como otra
librería de componentes.

## 2. Contrato de apariencia y persistencia

- `themeId` identifica la paleta y `themeType` conserva `light`/`dark`.
  Cambiar uno preserva el otro. La preferencia se aplica al provider compartido,
  sin remontar el árbol de rutas, formularios o consultas.
- `nodia` es el tema inicial y reutiliza las paletas existentes. Se conserva
  el inicio oscuro solicitado el 2026-10-11; no se adopta el modo del sistema.
  Una preferencia histórica clara sigue siendo clara al añadir `themeId`.
- La elección persiste en este navegador mediante `configStore`; no representa
  una preferencia de cuenta sincronizada con Server. Las cuentas que comparten
  el mismo almacenamiento del navegador comparten esta elección de apariencia.
- La selección está disponible en el topbar para todos los roles y para el
  visitante cuando se renderiza ese layout. No requiere asignación de módulo
  ni concede acceso a otro destino. No se introduce un endpoint de preferencias.
- Ausencia, identificador retirado o configuración inválida se recuperan con el
  tema Nodia. La persistencia no confiable se valida antes de resolver la paleta.
  Si no se puede leer el almacenamiento al iniciar, se usan los valores
  iniciales. Si falla guardar una nueva paleta, se restaura la selección previa,
  el selector conserva búsqueda/apertura y muestra error traducido para
  reintentar. No se anuncia persistencia exitosa antes de la escritura local.
  La comprobación de estas garantías forma parte del checklist de esta entrega.

## 3. Catálogo y adaptación MUI

`src/themes/` contiene un archivo por tema, con nombre estable y exportación por
defecto de su definición clara/oscura. Un catálogo tipado resuelve IDs; añadir
un tema no exige alterar controles de cada módulo. `MUIProvider` conserva la
composición única mediante `createTheme`.

Los tokens de tweakcn se adaptan al contrato existente: `primary`, `secondary`,
`tertiary`, estados semánticos, `background.default/paper/surface`,
`text.primary/secondary/inverse`, `border`, `divider` y acciones. Se conserva
tipografía, espaciado, breakpoints, radios y overrides compartidos de Nodia;
las fuentes y geometrías particulares de cada preset upstream no se importan.
Los colores se convierten a formatos compatibles con las utilidades MUI.

El catálogo es una instantánea versionada de presets integrados de tweakcn,
disponible con los estáticos de Nodia. No consulta tweakcn al abrir el selector
ni depende de su disponibilidad. Los temas comunitarios, la generación IA y la
edición libre no forman parte de esta entrega. La procedencia, revisión,
licencia y cantidad final se concilian en la documentación de `src/themes/` y
la [evidencia](../evidence/user-theme-presets-20261116.md). La revisión oficial
incorporada es `a3b47b37cba97dd637de517aab52c45ec0f83456`: 42 presets con nombre
y Default implícito, 43 importados más Nodia, 44 opciones. La atribución y la
licencia Apache-2.0 originales se distribuyen en
[`public/licenses/tweakcn.txt`](../../nodia-client/public/licenses/tweakcn.txt).
El [importador mantenido](../../nodia-client/scripts/import-tweakcn-themes.mjs)
fija los tres archivos oficiales y sus SHA-256; genera colores sRGB corregidos
en cada archivo, sin búsquedas de contraste durante el arranque de la app.
La [procedencia y adaptación detalladas](../../nodia-client/src/themes/README.md)
registran los límites de la conversión y las mediciones de laboratorio.

## 4. Contraste y compatibilidad

La petición explícita de contraste del 2026-11-16 amplía, para este alcance,
el enfoque histórico de07§5 que no exigía pruebas específicas. Las nuevas
paletas deben verificar una razón mínima 4.5:1 para textos normales principales
y secundarios sobre fondos de página/tarjeta y para `contrastText` sobre los
colores de acciones y estados. El adaptador puede ajustar el color de texto o
el tono de una acción para mantener esa legibilidad; no basta copiar variables
CSS de shadcn.

Nodia conserva su identidad predeterminada existente. Tres pares históricos
claros de `main`/`contrastText` quedan por debajo de 4.5:1: secondary
`#14b8a6`/blanco 2.49:1, error `#ef4444`/blanco 3.76:1 y success
`#22c55e`/blanco 2.28:1, calculados desde la paleta sRGB existente. No se presentan
como nuevas paletas certificadas ni se cambian silenciosamente al introducir el
catálogo. La comprobación de tokens no certifica todas las combinaciones CSS,
gráficos, textos deshabilitados, screen readers o contenidos de terceros en
toda la aplicación.

## 5. Selector y experiencia responsive

El topbar mantiene el control claro/oscuro y añade un selector de paleta con
nombre actual, muestras de color y búsqueda. En móvil, el acceso compacto
con nombre accesible mantiene espacio para idioma, sesión y navegación. El
popover debe quedar dentro del viewport, admitir teclado/Escape y devolver el
foco al disparador. La búsqueda y selección tienen una sola fuente de estado
al redimensionar; cambiar apariencia no borra formularios o borradores.

La confirmación de selección usa feedback `sileo` ES/EN con título breve y
`text.inverse`, manteniendo legibilidad sobre su fondo y evitando recorte en
320px. Volver a elegir la opción actual no realiza una nueva acción. No se hace
una mutación HTTP ni se simula una sincronización remota.

## 6. Contexto NodiaAI

La [ficha candidata de temas](../nodia-ai/knowledge/general-settings/features/interface-theme-presets.md)
y su [producto](../nodia-ai/knowledge/general-settings/README.md) explican la
preferencia local y el acceso manual. La ampliación introduce un concepto de
apariencia seleccionable, por lo que se documenta como ficha propia; no cambia
contratos comerciales, autoridad ni interpretación de datos de negocio.
No existe herramienta de chat que cambie el tema ni se habilita al crear
Markdown. Ficha draft/unregistered y `approval:null`; path explícito para
validación del corpus, sin binding ni publicación nuevos.

## 7. Entrega y primer pendiente

- [x] Solicitud y contrato local documentados, sin aprobación documental heredada.
- [x] Conciliar catálogo upstream, cantidad, revisión, licencia y adaptación real.
- [x] Verificar contraste, IDs inválidos y preferencias históricas/recarga.
- [x] Verificar selección, búsqueda, teclado, retorno de foco y continuidad.
- [x] Verificar topbar a 320px/escritorio, ES/EN y modos claro/oscuro.
- [x] Ejecutar pruebas Client, tipos, lint y build; validar corpus NodiaAI.
- [x] Consolidar [evidencia](../evidence/user-theme-presets-20261116.md) y actualizar
  este checklist desde resultados reales.
- [x] Registrar aceptación humana de QA y cerrar THEME-001 por el alcance
  entregado (§9). La confirmación no detalla sesión, dispositivo o entorno.

No quedan pendientes funcionales en THEME-001 tras la aceptación de§9. Una
adopción adicional por entorno, si se solicita, se gestiona por el flujo de
entrega existente; no se deduce del cierre ni exige repetir catálogo,
construcción o QA ya comprobados. El [TODO central](TODO.md) conserva el cierre.
No hubo migración DB, inferencia IA ni despliegue por esta conciliación.

## 8. Cierre local verificado — 2026-11-16

[Evidencia consolidada](../evidence/user-theme-presets-20261116.md): global
Client 3059 pruebas/370 archivos correcta; después del último ajuste de título
y color del feedback, 27 focales/7 archivos, tipos, lint y build correctos.
No se afirma una tercera global posterior a ese ajuste.

El lint mantenido se ejecutó con `npm run lint -- --ignore-pattern .tmp`:
el estándar también inspeccionó experimentos históricos ignorados y encontró
cuatro errores ajenos en `.tmp`; el único error de la fixture nueva quedó
corregido. Build conserva el aviso de chunks mayores de 500kB. No se alteraron
experimentos históricos ni se presentan estos límites como checks inexistentes.

Las 86 paletas importadas cumplen los pares mínimos definidos en§4, incluidos
colores de texto/outlined y hover contained. Nodia conserva sus excepciones
históricas. Regresiones de preferencia comprueban ausencia, datos históricos,
IDs/JSON inválidos, lectura denegada, rollback de escritura y reintento; sólo
se persisten los dos campos de preferencia, sin restaurar métodos del JSON.

Chromium sintético: 12 perfiles a 320/390/599/600/900/1280px, ES/EN y claro/oscuro,
visitante/miembro/super_admin y seis presets. Sin desbordamiento del documento o
popover; búsqueda/vacío/Escape/foco y nodo/borrador conservados al cambiar
tema/ancho, con modo y recarga independientes. Error `Storage.setItem` inyectado
en navegador conserva búsqueda/apertura y revierte el tema; reintento correcto.
Selección sin conexión comprobada sin petición de catálogo. Capturas finales
inspeccionadas y [recibo JSON](../evidence/user-theme-presets-20261116/qa.json)
conservados.

Los comandos finales `knowledge:check` y `knowledge:build` validaron 96 fuentes,
52 excluidas, 44 documentos y 46 fragmentos publicados existentes, con release
`ccf1f4fc86cc3436b237bb911b4c3240d3a1e34b75333c29cfee172889ad199f` y catálogo
`nodia-ai-business-pos/4`. La ficha candidata está excluida; añadir su path no
publica un binding ni altera las aprobaciones de otros documentos. Build sólo
emitió archivos ignorados de `dist/nodia-ai/knowledge`, sin nuevo artefacto
versionado. Enlaces del plan/ficha y UTF-8/LF de los once archivos mantenidos
verificados. Cuenta real, teléfono/teclado virtual, lector de pantalla y otros
motores pendientes; este cierre local no acredita disponibilidad productiva o
aceptación de UX.

## 9. Cierre por aceptación humana — 2026-11-16

El usuario confirmó «theme 001 ya paso QA, toca cerrarlo». Se registra la
aceptación humana del alcance entregado y **THEME-001 queda cerrado por alcance**:
catálogo y selector de paleta, modo independiente y preferencia del navegador.
Esta confirmación sucede el pendiente de aceptación humana de§7–8; no se
repite la construcción ni la QA técnica documentada.

La confirmación no identifica dispositivo, navegador, sesión o entorno. Los
límites técnicos de la evidencia permanecen; no se convierte una prueba
sintética en prueba física ni se acredita otro despliegue. Se conserva el
estado documental en revisión y la ficha draft/unregistered/approval:null:
aceptar el funcionamiento no aprueba ni publica la documentación NodiaAI.
