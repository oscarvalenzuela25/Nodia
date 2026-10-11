---
name: responsive-design
description: "Diseñar, implementar o revisar interfaces web mobile-first: contenido, layouts, controles táctiles, formularios, navegación, tablas y medios adaptables. Usar al crear o modificar UI responsive, corregir desbordamientos o mejorar una experiencia móvil. Conserva el stack y las reglas del proyecto; no diseña aplicaciones nativas ni implica un rediseño global."
---

# Diseño responsive mobile-first

Permitir completar la misma tarea en una pantalla pequeña con contenido legible, acciones alcanzables y estado estable. Diseñar primero la experiencia estrecha y ampliar su composición cuando el contenido lo permita. La prioridad móvil expresada por el usuario orienta el diseño; no atribuir porcentajes de tráfico al proyecto sin analítica comprobada.

## Encajar con el proyecto

- Leer las instrucciones aplicables, el theme, el layout padre y los componentes próximos. Conservar tokens, tipografía, librerías, navegación y contratos; no instalar un framework para resolver responsive.
- En Nodia, leer primero [el perfil local](references/nodia-profile.md) y sus documentos dependientes. Sus reglas prevalecen sobre recomendaciones genéricas de esta skill. Aplicar también `frontend-quality` y `create-component` al editar código, conforme al AGENTS local.
- En otros proyectos, usar sus breakpoints y políticas. Las cifras de ejemplos son puntos de partida, no un nuevo sistema de diseño.
- Trabajar sobre las vistas solicitadas. Esta skill no autoriza transformar todos los listados, modificar backend, desplegar ni aprobar documentos de producto.

## Diseñar para la tarea móvil

1. Identificar qué necesita leer, decidir y ejecutar la persona. Inventariar título, datos esenciales, acción principal, filtros y acciones secundarias antes de mover bloques.
2. Establecer un orden de lectura y de foco coherente desde la pantalla más estrecha admitida, incluyendo traducciones extensas y valores ausentes. Mantener el orden DOM; evitar reordenamientos visuales que contradigan la navegación por teclado.
3. Mostrar el contexto y la acción principal sin una cabecera desproporcionada. Pasar detalles secundarios a expansión o al detalle existente cuando resulte útil; conservar acceso a funciones y datos relevantes. No truncar importes, errores ni consecuencias de una acción.
4. Usar una columna de base y añadir columnas al disponer de espacio real. El ancho del viewport no identifica el dispositivo, su potencia ni su método de entrada.
5. Elegir la representación por tarea: tarjetas para registros individuales, tabla para comparar columnas, calendario para relaciones temporales. No convertir tablas en tarjetas por heurística ni duplicar la lógica de negocio.

## Invariantes de implementación

- **CSS antes de JavaScript:** resolver distribución con Flex/Grid, media queries o container queries. Usar consultas JS solo si cambia el árbol o la interacción; conservar formulario, filtros, selección y paginado al cruzar el breakpoint. No detectar móviles por user agent.
- **Ancho disponible:** permitir contracción con `min-width: 0` y `minmax(0, 1fr)`, contener medios y envolver texto largo. El documento no debe desplazarse horizontalmente por un defecto de layout. Un scroll local intencional en una tabla o diagrama debe ser visible y operable. No ocultar el defecto con `overflow-x: hidden` global.
- **Breakpoints:** reutilizar tokens del proyecto para el layout; utilizar ancho del contenedor para componentes reutilizados en paneles de diferentes tamaños. Añadir un umbral solo si el contenido lo justifica. No trasladar breakpoints de Bootstrap/Tailwind a otro theme.
- **Lectura:** conservar la jerarquía tipográfica y favorecer cuerpo legible; 1rem y altura de línea cercana a 1.5 son referencias de diseño, no certificación. Usar límites en rem con `clamp()` si aporta valor, sin depender únicamente de vw. Permitir zoom y crecimiento de texto.
- **Entrada táctil:** como objetivo de ergonomía web, preferir áreas activas de al menos 44 × 44 CSS px y separación suficiente. Esto no equivale al mínimo WCAG AA ni a unidades pt/dp nativas. Mantener nombres accesibles, foco visible y alternativas a hover, swipe, arrastre o pulsación larga.
- **Formularios:** labels persistentes, tipo de input, `inputMode` y `autoComplete` según el dato; permitir pegar. Preservar valores y errores al rotar, redimensionar, revalidar o fallar la escritura. Evitar autofocus móvil que abra el teclado inesperadamente. No sustituir validación de negocio por teclado numérico.
- **Navegación y overlays:** conservar rutas, permisos, historial y retorno de foco. Reservar espacio para elementos fijos y safe areas; verificar el último control y los avisos. No asumir que `100dvh` resuelve el teclado virtual ni mantener dos overlays que compitan por el foco.
- **Un único estado:** presentación móvil y escritorio comparten datos, handlers y contratos. Ocultar un árbol con CSS no evita ejecutar sus hooks ni descargar recursos; no montar dos formularios activos o dos consultas de la misma vista.
- **Carga y fallos:** carga inicial, revalidación, vacío y error deben seguir siendo distinguibles. No perder datos visibles durante refetch ni cerrar un editor por error. Aplicar el feedback y bloqueo de controles definidos por el proyecto.
- **Medios y coste:** reservar dimensiones de imágenes, servir variantes reales adecuadas al tamaño y cargar de forma diferida el contenido fuera de pantalla. Mantener la imagen crítica inicial disponible. No agregar lecturas por fila ni descargar todo un catálogo para una representación móvil.

## Referencias según el cambio

- Para overflow, CSS fluido, container queries, imágenes o viewport/teclado: [patrones de implementación](references/implementation-patterns.md).
- Para listados, filtros, formularios, navegación y controles táctiles: [interacciones móviles](references/mobile-interactions.md).
- Antes de entregar UI: seleccionar los casos pertinentes de [verificación responsive](references/responsive-verification.md). No ejecutar toda la matriz para un ajuste pequeño.
- Para verificar procedencia, estrellas, commits y decisiones de adaptación: [fuentes investigadas](references/sources.md). No cargar esta referencia en cada implementación.

## Entrega

Explicar qué tarea móvil mejoró y qué comportamiento se conservó. Aportar medidas o capturas del flujo afectado, checks ejecutados y limitaciones. Distinguir viewport redimensionado, emulación táctil, motor de navegador y teléfono físico; una captura no demuestra gestos, teclado virtual ni performance real.
