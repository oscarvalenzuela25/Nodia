# Temas personales — verificación local2026-11-16

Alcance: [plan108](../mvp/108-user-theme-presets.md). Implementación local del
selector en el topbar compartido y catálogo MUI; sin despliegue, cambios DB,
inferencia IA ni publicación de capacidades. La solicitud autoriza desarrollo,
sin aprobar por extensión la especificación o las fichas candidatas.

## Resultado y procedencia

44 opciones: Nodia más43 temas incorporados de
[tweakcn](https://tweakcn.com/editor/theme). Fuente oficial fijada en
[`a3b47b37cba97dd637de517aab52c45ec0f83456`](https://github.com/jnsahaj/tweakcn/tree/a3b47b37cba97dd637de517aab52c45ec0f83456):
42 presets con nombre y Default implícito. Cada tema tiene archivo propio,
exportación por defecto y paletas claras/oscuras; los archivos finales llevan
colores precalculados. [Procedencia, mapeo y límites](../../nodia-client/src/themes/README.md).

El [importador mantenido](../../nodia-client/scripts/import-tweakcn-themes.mjs)
descarga exclusivamente la revisión fija, valida tres SHA-256 y genera los
archivos. La licencia Apache-2.0 adaptada se incluye en
`public/licenses/tweakcn.txt`; se comprobó igualdad SHA-256 con
`dist/licenses/tweakcn.txt`. El navegador no descarga temas de tweakcn.
Hash de ambos avisos:
`0415e1ebc274a29eb9ab17d4b8c738df10160bcdbe0142177cefe6dbb46a501d`.

Nodia sigue siendo el predeterminado, con sus paletas originales y modo oscuro
si no hay preferencia previa. Las configuraciones históricas claras conservan
su modo. `themeId` y `themeType` se guardan en este navegador, independientemente
de identidad/rol; no son una preferencia de cuenta sincronizada por Server.

## Comprobaciones de código

| Comprobación | Resultado real |
| --- | --- |
| `npm run test`, global posterior al catálogo estático |3059 pruebas/370 archivos correctos |
| Focales posteriores al último ajuste del feedback |27 pruebas/7 archivos correctos |
| `npm run typecheck` | Correcto |
| `npm run lint -- --ignore-pattern .tmp` | Correcto |
| `npm run build` | Correcto; aviso de chunks mayores de500kB conservado |
| Corpus `knowledge:check` / `knowledge:build` | Correctos; detalle final en plan108 |

La global precede únicamente al ajuste final del texto/estilo de los avisos del
selector; las27 focales posteriores incluyen selector, topbar, store, provider y
temas. No se afirma una tercera global posterior. El lint estándar también
inspeccionó experimentos locales ignorados preexistentes y detectó cuatro errores
en `.tmp/pos-registration-auto-add-qa`, `.tmp/product-alias-qa` y
`.tmp/teacher-upgrade-browser`. Se corrigió el único error de la nueva fixture;
el comando indicado valida código mantenido sin modificar esos experimentos.

Las regresiones verifican selección y modo independientes, recarga, preferencias
ausentes/históricas/obsoletas/JSON inválido, lectura bloqueada, escritura rechazada
con rollback y reintento, búsqueda/vacío, teclado/Escape/retorno de foco y
conservación del nodo/input/borrador al cambiar la paleta del provider. Se
persisten sólo los dos campos de preferencia; los métodos no se restauran desde
JSON no confiable.

## Contraste y arranque

Las86 paletas importadas verifican razón mínima4.5:1 para texto principal y
secundario sobre `default/paper/surface`, colores de acciones/estados sobre esas
superficies, hover de texto/outlined y `contrastText` sobre main/light/dark,
incluido hover contained. La tipografía, shape, spacing, breakpoints y overrides
compartidos permanecen en el provider único. Las utilidades prueban luminancia
sRGB, el caso límite4.478089:1, corrección y rechazo de superficies incompatibles.

El tema Nodia original conserva excepciones históricas en claro: blanco sobre
secondary2.49:1, error3.76:1 y success2.28:1; primary6.29:1. Las garantías nuevas
corresponden a los43 temas importados; no certifican toda combinación CSS,
gráfico, gradiente, estado disabled o contenido externo de la aplicación.

La variante que calculaba correcciones al importar se descartó tras medirla.
Comparación acotada del bundle sin minificar en Node24,12 evaluaciones/MUI
precargado: runtime47.0KB/8.15KB gzip, mediana68.1ms; estático elegido145.99KB/
15.88KB gzip, mediana12.1ms. Hay mayor transferencia y menos cálculo inicial.
Son medidas de laboratorio del módulo, sin afirmar tiempos de ruta, rendimiento
de un teléfono o aceptación productiva del plan37.

## Chromium y continuidad

[Fixture sintética mantenida](../../nodia-client/src/test/manual/theme-presets/README.md),
Vite en modo/puerto propio y Playwright CLI. No se usaron credenciales reales;
Axios responde sólo salud sintética y rechaza operaciones no previstas.

| Ancho | Actor sintético | Tema comprobado | Idiomas/modos |
| --- | --- | --- | --- |
|320 | Visitante | Notebook | ES claro / EN oscuro |
|390 | Miembro sin módulos | Bubblegum | ES claro / EN oscuro |
|599 | super_admin | Vercel | ES claro / EN oscuro |
|600 | Visitante | Cyberpunk | ES claro / EN oscuro |
|900 | Miembro sin módulos | Mocha Mousse | ES claro / EN oscuro |
|1280 | super_admin | Nodia | ES claro / EN oscuro |

Los12 perfiles conservan ancho del documento igual al viewport, popup y controles
dentro de pantalla. Búsqueda sin resultados, Escape y retorno de foco correctos.
Antes de la matriz se verificó Cyberpunk desde teclado, búsqueda conservada al
redimensionar, mismo nodo/borrador de formulario, cambio de modo independiente y
persistencia tras recarga. La tabla650px mantiene scroll local.

Se inyectó `QuotaExceededError` en `Storage.setItem`: tema previo restaurado,
selector/búsqueda conservados y error visible; restaurar almacenamiento permite
reintentar. Con el navegador sin conexión, la selección de Vercel siguió
funcionando sin una petición de catálogo. [Recibo JSON](user-theme-presets-20261116/qa.json).

El QA visual detectó recorte de la descripción del nuevo toast en320px: se
conserva feedback con título breve, conforme al patrón local de navegación.
Sus títulos usan `text.inverse` para contrastar con el fondo inverso de Sileo;
se conservan iconos semánticos. No se cambió el Toaster global ni su reserva móvil.
Las primeras capturas a mitad de transición se sustituyeron por capturas finales.
Durante desarrollo hubo invalidaciones HMR de archivos en regeneración y una
fixture que llamaba al hook Zustand sin prefijo `use`; se corrigió la fixture y
se reinició el servidor antes del recorrido final. No son fallos de producción.

Capturas finales inspeccionadas:

- [320px, Notebook claro/ES](https://github.com/oscarvalenzuela25/Nodia/blob/8886e42f43c1dc93e4a67cfb643b9aac7d9c9f17/docs/evidence/user-theme-presets-20261116/themes-320-es.png).
- [900px, Mocha Mousse claro/ES](https://github.com/oscarvalenzuela25/Nodia/blob/8886e42f43c1dc93e4a67cfb643b9aac7d9c9f17/docs/evidence/user-theme-presets-20261116/themes-900-es.png).
- [600px, Cyberpunk oscuro/EN](https://github.com/oscarvalenzuela25/Nodia/blob/8886e42f43c1dc93e4a67cfb643b9aac7d9c9f17/docs/evidence/user-theme-presets-20261116/themes-600-en.png).
- [320px, error de almacenamiento y búsqueda conservada](https://github.com/oscarvalenzuela25/Nodia/blob/8886e42f43c1dc93e4a67cfb643b9aac7d9c9f17/docs/evidence/user-theme-presets-20261116/themes-storage-error-320.png).

## Límites y continuidad

Validación local sintética Chromium, no UI con cuenta real, teléfono físico,
teclado virtual, lector de pantalla ni otros motores. No certifica la aplicación
completa. La aceptación visual humana y adopción por entorno siguen en
[TODO](../mvp/TODO.md); documentos/fichas conservan revisión y aprobación propias.
