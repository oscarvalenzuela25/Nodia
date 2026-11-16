# NodiaAI UX — QA sintético del plan107

Ejecutar desde Client:

```bash
npm run dev -- --host 127.0.0.1 --port 5194 --mode nodia-ai-qa
```

Abrir `http://127.0.0.1:5194/src/test/manual/nodia-ai-ux/index.html?lang=es&theme=dark&scenario=chat-redesign`.
El harness rechaza otro origen/puerto. Reutiliza los componentes productivos de
NodiaAI, `GuardStrict`, `LayoutWrapper`, `MainContainer`, `PageContent`, el estilo
real del topbar y las piezas visuales de la barra inferior. El sidenav y contenido
del topbar/dock son representaciones sintéticas, sin sus consultas o acciones.
Esto comprueba integración geométrica de wrappers y guard; no equivale a sesión
autenticada, autorización backend o navegación completa de una persona real.

`lang=es|en`, `theme=dark|light`, `scenario=chat-redesign|chat-markdown|chat-running|empty|proposal|unknown|read-only`.
`chat=none` permite examinar la bienvenida previa a crear conversación.
Las conversaciones, selección, modelos, propuestas y archivos son fixtures
de `../nodia-ai/fixtures.ts`. No hay proveedor, base de datos o cloud conectado.
El adaptador rechaza rutas no reconocidas. La respuesta de autorización asigna
únicamente el módulo sintético con identidad canónica `nodia_ai`.

`window.__nodiaAiQa.requests` enumera método/path sintéticos.
`failNext("selection"|"attachment-upload"|"attachment-review"|"proposal-edit")`
inyecta el siguiente error del adaptador. `refetch(kind)` invalida la consulta
de la fixture. No admite inferencias POST o efectos comerciales.

Para probar `GuardStrict` manteniendo contenido previo:

- `window.__nodiaAiUxQa.holdAuthorization()` mantiene el GET de revalidación
  pendiente; `releaseAuthorization()` permite completarlo. La vista conserva
  su borrador y pasa a `inert` durante la consulta.
- `await window.__nodiaAiUxQa.failAuthorization()` produce503 sintético y aviso
  local; `await window.__nodiaAiUxQa.recoverAuthorization()` recupera la lectura.
  Ningún error elimina el textarea ni su contenido.

Recorridos de valor: selección aplicada plegada→editar modo→plegar dirty→envío
bloqueado→redimensionar→Aplicar con503 (editor abierto y borrador conservado);
Cancelar local; revalidación/error/recuperación de autorización; archivo PNG
local y revisión; Stop de turno; lectura de Markdown seguro; panel de historial
y retorno de foco. Verificar320/390/600/900/1440px y alturas cortas, ES/EN y ambos
temas, teclado/foco y ausencia de overflow horizontal global.

El dictado puede simularse exclusivamente en el runner de QA con un constructor
SpeechRecognition falso y MediaStream de Web Audio sintético. No sustituir la
implementación productiva ni interpretar esa prueba como reconocimiento real,
permiso de micrófono físico, teclado virtual o aceptación en teléfono.

Capturas y reportes intermedios se guardan en `output/playwright/nodia-ai-ux/`.
El baseline se obtiene desde un snapshot de código anterior, con las mismas
fixtures/wrappers, fuentes cargadas y viewport. Comparar conteos de requests y
bytes de builds equivalentes; no afirmar un ahorro de ruta a partir de la suma
de todos los chunks ni de recursos servidos por el servidor de desarrollo.

## Historial y filtros — continuación2026-11-16

`scenario=history-filters` reutiliza las fixtures de conversación del rediseño
y añade filtrado sintético optativo de búsqueda/archivo/fijadas para verificar
vacíos y restablecimiento con el chat abierto. No implementa búsqueda productiva.
`failNext("conversations")` junto con `refetch("conversations")` permite comprobar
error de revalidación con filas previas y reintento sin perder el borrador.
El filtro por ámbito se comprueba en pruebas de componente con permisos sintéticos.

## Historial desde cabecera en móvil — continuación2026-11-16

Por debajo de900px ya no se muestra una barra lateral. La fila bajo la marca
presenta el icono de historial a la izquierda y «Nuevo chat» compacto a la derecha;
el icono abre el Drawer existente. Desde900px se conserva el panel colapsable.
Comprobar retorno de foco con Escape, búsqueda retenida al reabrir y mismo
textarea/borrador/URL al cruzar899/900px, también con el Drawer abierto y con503
de historial. No debe haber IDs duplicados durante la transición ni mutaciones
por abrir/cerrar el historial. [Evidencia local](../../../../../docs/evidence/nodia-ai-mobile-history-20261116/README.md).
