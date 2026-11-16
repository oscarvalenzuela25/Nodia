# Noticias — propuesta de diseño editorial

> Dirección editorial del2026-11-15, implementación local NEWS-05 solicitada
> el2026-11-16. Dependencia: [plan105§10](../../mvp/105-on-demand-tech-news.md#10-news-05-composición-editorial-y-chips-de-temas--2026-11-16).
> Solicitud confirmada: conservar sidenav y topbar y explorar un diseño más
> cuidado con inspiración en Freesets. La composición siguiente guía la entrega
> local; sin aprobación documental o aceptación/adopción productiva implícitas.

> Continuación2026-11-16: [plan105§8](../../mvp/105-on-demand-tech-news.md#8-news-01-acceso-público-y-catálogo-inicial--2026-11-16)
> confirma Noticias pública inmediatamente debajo de Home en sidenav/drawer.
> Fuentes públicas/limitadas según [catálogo](source-catalog.md); sesión Nodia
> válida para las limitadas sin rol/módulo, además de condiciones del proveedor.
> NEWS-02/03 implementaron ruta y primer RSS; NEWS-05 completa la composición
> local sin rediseñar el shell ni abrir otros destinos.

> La solicitud posterior de [§9](../../mvp/105-on-demand-tech-news.md#9-obtención-exclusiva-super_admin-y-primera-integración-rss--2026-11-16)
> reserva el botón y POST de obtención externa a super_admin activo. La lectura,
> filtros, paginado y reintento de GET siguen siendo públicos; no mostrar un CTA
> de obtener noticias a quien sólo tiene permiso de leer resultados conservados.

## Referencias y selección

[Freesets Blogs](https://freesets.dev/blogs) reúne publicaciones para inspiración.
Se revisaron estas cuatro; la evaluación es de diseño, no una certificación de
accesibilidad o una comparación de rendimiento.

| Referencia | Patrón observado | Adaptación propuesta |
| --- | --- | --- |
| [Codrops](https://tympanus.net/codrops/) — base elegida | Imágenes protagonistas, títulos debajo y composición editorial con poco marco de panel | Medios amplios, jerarquía de titulares y superficies limpias; grid regular con lectura en orden |
| [web.dev Blog](https://web.dev/blog) | Tarjetas ordenadas, proporciones estables y cabecera amplia | Consistencia de tarjetas y espacio de medios; cabecera interna mucho más compacta |
| [Smashing Magazine](https://www.smashingmagazine.com/articles/) | Flujo de lectura con títulos fuertes, autor, fecha y extractos | Metadatos claros y legibilidad sin trasladar rojo, identidad o navegación del sitio |
| [DEV](https://dev.to/) | Feed, etiquetas, orden reciente/popular y columnas laterales | Filtros locales y semántica del orden; mantener únicamente el sidenav de Nodia |

Las cuatro referencias se inspeccionaron visualmente en navegador de escritorio.
No se realizó una auditoría móvil, de accesibilidad o de rendimiento de esos sitios.

Se toman patrones de composición, sin copiar activos, código, textos o identidad.
Se descartan bloques de publicidad, columnas sociales, masonry que rompa el orden
de lectura, carruseles, WebGL, autoplay y cabeceras de marketing dentro del producto.

## Composición recomendada

El contenido se integra en `BaseLayout`/`PageContent`. La navegación conserva sus
componentes y el catálogo autorizado de módulos privados. Noticias será un acceso
público fijo Home→Noticias antes de esos grupos; no inventa otro shell ni duplica
el catálogo privado. Wireframes esquemáticos, no rediseños de esos componentes:

```text
Sidenav existente │ Topbar existente: idioma / tema / usuario
                 │ Noticias                         Actualizar noticias
                 │ Tecnología, programación e IA · última consulta real
                 │ [Todos] [Tecnología] [Programación] [IA]
                 │ [Fuente: todas]                [Orden: recientes]
                 │ ──────────────────────────────────────────────────
                 │ Primera noticia del orden   │ Siguiente noticia
                 │ Medio opcional amplio       │ Medio opcional
                 │ Título con jerarquía        │ Título
                 │ Procedencia · publicación   │ Procedencia · publicación
                 │ Extracto permitido          │ Extracto permitido
                 │ ──────────────────────────────────────────────────
                 │ Artículo        Artículo       Artículo
                 │ ...grid regular; sin repetir la primera noticia...
```

```text
Topbar móvil existente / acceso al drawer
Noticias
Tecnología, programación e IA
[        Actualizar noticias        ]
Temas con wrap / fuente / orden
Última consulta o estado por fuente
─────────────────────────────────────
Medio opcional
Título / procedencia / publicación
Extracto permitido / enlace original
─────────────────────────────────────
Siguiente artículo...
Reserva de MobileBottomNav y safe area existentes
```

- Cabecera contenida: un `h1`, contexto breve y una acción principal. Sin hero
  promocional que retrase la lectura. En xs el botón ocupa todo el ancho.
  Actualizar sólo aparece para super_admin válido; el visitante recibe un estado
  vacío informativo si no se han obtenido noticias, sin sugerir que puede hacer fetch.
- Temas visibles en chips de selección única: Todos / Tecnología / Programación /
  IA, con `aria-pressed`, objetivos44px y wrap. Repetir el tema activo no lo
  desmarca ni consulta otra vez. Fuente/orden siguen en selects reutilizables;
  separadores sutiles delimitan la barra. «Para explorar» y el total del servidor
  introducen los artículos, sin llamar al contador novedades o recomendaciones.
- La primera tarjeta recibe más espacio cuando el ancho lo permite; mantiene la
  misma semántica y orden que el feed. No significa recomendación ni patrocinio.
  Al ordenar/filtrar cambia según el resultado; sin etiqueta de importancia falsa.
- Grid con separación vertical24px/horizontal16px, sin tarjetas dentro de paneles
  decorativos adicionales. Dos o tres columnas sólo si el ancho real después del
  sidenav admite tarjetas legibles; una columna en xs. Resolver por CSS y ancho
  del contenedor, sin duplicar consultas o árboles de UI por breakpoint.
  Patrón implementado: container `news-editorial`,1columna bajo580px útiles,
  2desde580px y3desde1020px. La primera ocupa2columnas sólo cuando existen;
  con864px útiles de1200px/sidenav abierto quedan2, con1048px al colapsarlo quedan3.
- Titular como enlace principal con foco visible y acción original inequívoca;
  sin enlaces/botones anidados ni tarjeta entera que capture todos los clics.
- Fuente y autor diferenciados, publicación legible, extracto corto si está
  permitido y pocas etiquetas relevantes. Tiempo de lectura sólo cuando venga
  del proveedor. Ocultar métricas sociales que no resuelvan la tarea de lectura.
  Fuente y fecha se sitúan junto al titular, sin empujarlas al extremo inferior
  de una tarjeta corta. Tema y autor opcional conservan su procedencia real.
- Fuente seleccionable de lectura: Todas / web.dev / Node.js por catálogo
  habilitado real. Selector administrativo «Fuente a actualizar» separado,
  inicialmente vacío, disponible sólo para super_admin. Elegir una fuente no
  ejecuta el POST y el filtro de lectura no elige el destino de actualización.
- En anónimo sólo fuentes públicas habilitadas. Las limitadas pueden explicarse
  mediante acceso a iniciar sesión, pero no devolver sus noticias, procedencias
  o contadores. Estar autenticado tampoco habilita una fuente pendiente de términos
  o configuración; daily.dev permanece deshabilitada en el catálogo inicial.
- Cambiar cuenta/cerrar sesión elimina resultados limitados y conserva la lectura
  pública. Un fallo al restaurar sesión no bloquea Noticias pública; verificar esa
  continuidad sin alterar recuperación/guards de los demás destinos.

## Identidad y medios

Reutilizar `src/theme/palette.tsx` y `typography.tsx`: DM Sans, fondos y superficies
light/dark, `text.primary/secondary`, `primary.main`, divider y escalas MUI.
Mejorar jerarquía mediante tamaño, peso y composición; sin cambiar la tipografía
global ni añadir fuentes remotas. Titulares con tamaño responsivo contenido,
cuerpo legible y metadatos secundarios con contraste suficiente.

Portadas opcionales con proporción estable y dimensiones reservadas. Validar
derechos, procedencia y URL; no usar imágenes de Freesets como portadas de noticias.
Si falta imagen o falla, variante tipográfica cuidada con el mismo título y
metadatos, sin imagen inventada atribuida al editor ni icono gigante de reemplazo.
Evitar huecos amplios de portadas vacías. Lazy load fuera de la primera pantalla;
no incorporar una librería de animación sólo para revelar tarjetas.

Sutil cambio de borde/color al hover y foco equivalente, sin depender del hover
para acciones. Respetar reduced motion, sin desplazamientos que muevan la lectura.
Track de scrollbar transparente, thumb fino adaptado a tema, sin flechas.

`PageContent` ya aplica padding vertical16px y laterales16/24/32px en xs/sm/md.
La página no añade otro padding exterior. Se mantienen reserva inferior y safe
area de la navegación móvil; ningún botón fijo nuevo compite con ella.

## Estados y accesibilidad

| Estado | Presentación requerida |
| --- | --- |
| Sin consultas previas | Explicación breve; sólo super_admin dispone de Actualizar noticias. Sin tarjetas ficticias ni CTA de fetch para lectores |
| Primera lectura local en vuelo | Boneyard sólo en contenido informativo, controles loading/disabled |
| Actualizando con noticias | Tarjetas conservadas, indicador discreto y controles dependientes bloqueados |
| Sin novedades | Informar resultado real; no sustituir resultados previos por vacío |
| Filtro sin resultados | Vacío de esa selección y opción de quitar filtros, sin consulta externa implícita |
| Fallo parcial | Aviso por fuente, último éxito conservado, reintento y toast único conforme a Client |
| Sin fecha/imagen/extracto | Omitir dato o informar ausencia según su significado, sin cifras o texto inventados |
| Fuente sin conexión/cuota desconocida | Estado explícito; no mostrar disponibilidad o saldo ficticios |

Teclado y DOM en el mismo orden, controles táctiles44px, labels persistentes y
selección accesible. Temas de selección única usan grupo de botones/toggles con
estado anunciado, no roles de tabs si no hay paneles asociados. Fuente/orden con
inputs reutilizables. Actualización anuncia resultado mediante estado accesible
sin mover el foco ni añadir una segunda notificación audible redundante.

Durante una consulta los chips quedan deshabilitados. El chip activado recupera
foco al terminar sólo si lo perdió por ese bloqueo y no hubo nueva intención de
teclado/puntero/foco/ventana. Limpiar el vacío filtrado devuelve Todos y página1,
y lleva el foco al encabezado persistente de resultados, sin depender del botón
que desaparece. No se aplican focos automáticos en revalidaciones ajenas.

ES/EN para todo texto del producto. Los títulos externos permanecen en idioma
original; traducción/resumen con IA son otra ampliación, no una operación implícita.

## Verificación y límites

Maqueta local con fixtures separados en `output/news-design/`, excluida de código
productivo. El shell en esa maqueta es esquemático: en la implementación se montan
los componentes existentes. La especificación no depende de conservar el output.
No usar una captura de maqueta como aceptación del shell auténtico o de un proveedor.

Para la implementación comprobar320/600/900/1440px, sidenav expandido/colapsado,
ambos temas, ES/EN, zoom200%, teclado/foco, títulos largos, medios ausentes/rotos,
filtros sin resultados y errores parciales. Medir sin overflow del documento y
sin doble padding; conservar selección/lectura al redimensionar o revalidar.
Los checks de la maqueta tienen su alcance propio en plan105 al completarse.

NEWS-05 local: [evidencia propia](../../evidence/news-editorial-design-20261116.md).
La variante tipográfica completa la composición con el contrato actual sin
imágenes; no añadir portadas decorativas atribuidas al editor o campos inventados
para parecerse a fixtures. Reflow de ancho720px CSS comprobado por separado;
zoom nativo200%, sesión humana y teléfono físico permanecen en aceptación NEWS-06.

NEWS-04 mantiene esta composición e incorpora dos estados de fuente con error
identificado, sin retirar artículos de la otra fuente. Tarjeta de URL compartida
conserva todas las procedencias/licencias; el aviso MIT Node accesible se muestra
también para procedencia secundaria. [Evidencia de integración](../../evidence/news-nodejs-integration-20261116.md)
separa UI sintética, SQL/HTTP y adaptador RSS real; no reabre NEWS-05.
