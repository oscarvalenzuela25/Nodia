# Noticias — propuesta de diseño editorial

> Borrador del 2026-11-15. Dependencia: [propuesta105](../../mvp/105-on-demand-tech-news.md).
> Solicitud confirmada: conservar sidenav y topbar y explorar un diseño más
> cuidado con inspiración en Freesets. La composición siguiente es recomendada;
> sin aprobación documental ni implementación productiva.

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
componentes y el catálogo autorizado; Noticias no inventa otro shell ni lista
estática de módulos. Wireframes esquemáticos, no rediseños de esos componentes:

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
- La primera tarjeta recibe más espacio cuando el ancho lo permite; mantiene la
  misma semántica y orden que el feed. No significa recomendación ni patrocinio.
  Al ordenar/filtrar cambia según el resultado; sin etiqueta de importancia falsa.
- Grid con separación vertical24px/horizontal16px, sin tarjetas dentro de paneles
  decorativos adicionales. Dos o tres columnas sólo si el ancho real después del
  sidenav admite tarjetas legibles; una columna en xs. Resolver por CSS y ancho
  del contenedor, sin duplicar consultas o árboles de UI por breakpoint.
- Titular como enlace principal con foco visible y acción original inequívoca;
  sin enlaces/botones anidados ni tarjeta entera que capture todos los clics.
- Fuente y autor diferenciados, publicación legible, extracto corto si está
  permitido y pocas etiquetas relevantes. Tiempo de lectura sólo cuando venga
  del proveedor. Ocultar métricas sociales que no resuelvan la tarea de lectura.
- Fuente seleccionable: Todas / daily.dev / DEV / Oficiales / Hacker News según
  catálogo habilitado real. Fuente de lectura y selección para obtener novedades
  requieren labels y estados distintos; no implicar conexión por mostrar un nombre.

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
| Sin consultas previas | Explicación breve y Obtener noticias; no tarjetas ficticias |
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
