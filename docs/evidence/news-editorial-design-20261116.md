# Noticias — NEWS-05 editorial y chips

Fecha2026-11-16, rama `codex/news-implementation`, continuación del primer RSS
local. [Plan105§10](../mvp/105-on-demand-tech-news.md#10-news-05-composición-editorial-y-chips-de-temas--2026-11-16),
[dirección editorial](../features/news/editorial-design.md) y
[contrato conservado](../features/news/http-contract.md).

## Resultado

Chips visibles de selección única y barra editorial; cabecera contextual y
«Para explorar» con total real del contrato. Grid por ancho útil del contenedor,
primera noticia mayor y sin repetición, gaps24/16px y títulos íntegros. Fuente/fecha
se agrupan junto al titular; tema y autor sólo desde metadatos reales. Se elimina
el espaciado automático que alejaba metadatos de una noticia corta.

Se completa la variante tipográfica sin imágenes prevista en el diseño. El
contrato actual no entrega medios autorizados; no se inventan portadas para
imitar los fixtures de la maqueta. Sidenav/topbar/theme, reserva móvil y padding
de PageContent conservados. Lectura pública y fetch exclusivo super_admin intactos.

## Comprobaciones

- 24pruebas focales/4archivos News correctas, incluidas9del componente de chips.
  Selección única/no desmarcado, repetición sin evento, controles deshabilitados,
  teclado y nombres ES/EN. Regresiones de retorno de foco, ausencia de robo de
  foco al navegar, rerender ajeno y desmontaje.
- Tipado y build de Client correctos, ESLint correcto excluyendo `.tmp/**`
  experimental. Build conserva aviso previo de chunks>500kB; no se afirma ahorro
  o mejora de rendimiento por este rediseño. La primera ronda de tipos rechazó
  dividir `theme.shape.borderRadius` porque MUI admite string; se corrigió usando
  directamente el token del theme.
- Suite global Client final3087casos/375archivos correcta,462.70s, después del
  último cambio de código. Una primera ejecución se interrumpió para corregir
  foco al limpiar filtros; no se presenta como fallo o como suite final aprobada.
- Sin cambios backend/dependencias/migración o inferencias. No se repiten las
  pruebas SQL/RSS reales de §9 como si fueran una nueva verificación Server.

### QA Chromium con fixtures aisladas

Ruta auténtica `/news` y shell real; respuestas sintéticas desde arnés ignorado,
sin llamadas a proveedores o cuentas.320/600/900/1200/1440px × oscuro ES/claro EN,
6tarjetas con titulares extensos, metadatos ausentes y sin imágenes:

| Viewport | Contenedor útil, sidenav abierto cuando aplica | Columnas |
| --- | --- | --- |
|320px |288px |1 |
|600px |552px |1 |
|900px |836px |2 |
|1200px |864px |2 |
|1440px |1104px |3 |

Sin overflow horizontal, una sola selección, chips≥44px, gaps24px/16px. Primera
noticia span2 sólo al existir2/3columnas; seis títulos únicos en el mismo orden.
A1200px con sidenav colapsado:1048px útiles y3columnas, sin cambiar estado/consulta.
Selección conservada al redimensionar; Tab/Space activan el siguiente chip y el
foco vuelve tras su bloqueo temporal. Hover seleccionado mantiene el par de
tokens primary.main/contrastText, también en oscuro; no reutiliza el texto de
ese par sobre primary.dark sin comprobar contraste.

Fixture de paginado21artículos: página2 muestra el21º y contador21, no1. Pulsar AI
envía GETcon topic=ai&page=1; resultado vacío0y opción de limpiar. Resize a320px
conserva AI. Limpiar devuelve All/página1 y foco en H2 «To explore». Registro de red
de ese recorrido sólo contiene GET; no se consulta la fuente al pulsar chips.

Fixture super_admin en320px: botón de actualización288×44px sobre contenedor
288px, sin overflow. POST503inyectado conserva20tarjetas, All seleccionado y
error inline/toast; la reconciliación sólo vuelve a leer GET. Son sesiones y
respuestas sintéticas, sin consumo externo ni autenticación de una cuenta real.

Reflow adicional a720px CSS:672px útiles,2columnas,6tarjetas sin overflow.
Es el ancho disponible de una ventana1440px al200%; **no se comprobó zoom nativo
del navegador**. Emulación de viewport, CSSzoom o pinch no equivalen por sí solos
a toda la prueba de zoom de escritorio. Ese caso manual sigue en NEWS-06.

Capturas locales en `output/playwright/news05-*.png`, arneses/logs en
`.tmp/news05-qa/` y `.tmp/news05-verification/`, ignorados. Este informe conserva
la evidencia duradera, sin depender de esos temporales como runtime de producto.

Captura de revisión1440×1000 en claro/español con seis fixtures:
`output/playwright/news05-editorial-preview.png`. No muestra noticias reales o
una sesión productiva. Corpus comprobado:96fuentes/52excluidas y44documentos/
46fragmentos publicados conservados; sólo se revisionaron candidatas de Noticias.

## Límites

QA sintética local, sin aceptación humana/UI autenticada real/teléfono físico,
adopción o despliegue nuevos. No se certifica WCAG global ni se califican otros
navegadores o todas las paletas personales. Sin cambios de contexto del dominio,
autoridad, datos o herramientas IA; fichas candidatas revisionadas para evaluación
visual, sin heredar aprobación ni publicar cuerpos nuevos.

Cierre documental: UTF-8/LF de65archivos editados/nuevos del workspace y1035
destinos de enlaces locales comprobados sin errores; `git diff --check` correcto.
Navegador dedicado de QA y Vite5186 cerrados, sin detener el dev server del usuario.
