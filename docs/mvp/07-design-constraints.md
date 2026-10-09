# Restricciones de Diseño — Nodia Parte 1

> Estado: aprobado (base histórica); aplicación y ampliación Finanzas en revisión
> Última actualización: 2026-10-08
> Dependencias: 05-sitemap.md y 06-route-specs.md aprobados

## Objetivo

Definir sistema visual, accesibilidad y restricciones de interacción aplicables para el frontend del MVP, asegurando coherencia visual y técnica antes de definir la arquitectura y stacks definitivos.

## 1. Librería de Componentes y Sistema Visual

- **Framework de UI:** Se utilizará la estructura existente en `nodia-client`, la cual se basa en **Material UI (MUI)**.
- **Componentes base:** Se utilizarán los componentes nativos de MUI para la interfaz del backoffice (Tablas, Modales, Botones, Inputs, etc.).

## 2. Tematización (Theming)

- **Modos soportados:** El sistema soportará explícitamente tanto **Modo Claro (Light Theme)** como **Modo Oscuro (Dark Theme)**.
- **Design Tokens:** Los colores exactos para MUI se extraerán y generarán a partir de un tema proporcionado posteriormente.

## 3. Tipografía

- **Requisitos:** Elegante, agradable a la vista, y sin problemas con los pesos *normal* y *bold*.
- **Opciones recomendadas:** Dado que MUI trae *Roboto* por defecto, podríamos cambiar a **Inter** (súper limpia, excelente para interfaces y backoffices), **Poppins** (un poco más geométrica y amigable), o **Nunito Sans**. Dejaremos pendiente la elección exacta para el momento de inyectar el tema.

## 4. Responsividad (Layout)

- **Enfoque:** Full Responsive.
- **Justificación:** Aunque la Parte 1 es de carácter administrativo, los usuarios accederán desde celulares. Las vistas, especialmente las tablas de listados y modales de Ajustes Generales, deben adaptarse correctamente a dispositivos móviles.

### Ajuste móvil solicitado e implementado — 2026-10-08

Según [35](35-mobile-cards-shortcuts-plan.md), en `xs` (<600 px) los listados adaptados explícitamente pueden usar tarjetas verticales con campos principales y acciones del registro, compartiendo consulta, filtros y paginado del servidor. ReservationTable es el piloto implementado. Las tablas sin adaptar y todas las vistas desde 600 px conservan el patrón de tabla, `minWidth: 650` y scroll transparente. No convertir columnas por heurística ni aplicar esta representación a calendarios/resúmenes sin selección específica.

BaseLayout autenticado incorpora barra inferior de borde a borde con cuatro accesos locales por persona e Inicio fijo más grande al centro. Candado flotante arriba a la derecha regula edición, sin alterar permisos. Reservar espacio debajo del contenido y de avisos; safe area dentro de barra y selector. Las tarjetas usan campos visibles, estado separado de archivo/inactividad, acción principal de ancho completo y menú secundario. La aprobación visual corresponde a la barra; no extiende aprobación automática a toda la ampliación documental.

## 5. Accesibilidad (a11y)

- **Nivel de exigencia:** No es prioridad para el MVP.
- **Enfoque práctico:** Se aprovechará únicamente la accesibilidad gratuita que ya traen los componentes de MUI out-of-the-box, sin realizar pruebas o ajustes específicos de contraste, screen readers o navegación estricta.

## Hechos confirmados
- Se reutiliza la base tecnológica de UI de `nodia-client` (MUI).
- Soporte para Light y Dark theme.
- Diseño totalmente responsivo.
- Accesibilidad no es prioridad de desarrollo para el MVP.

## Preguntas abiertas
- Recepción del Theme para generar los tokens de MUI.

## Patrón de tablas paginadas — confirmado el 2026-10-04

Referencia visual solicitada por el usuario: tabla de Modules en Ajustes Generales. Este patrón se aplica a Finanzas y a las nuevas tablas paginadas de Nodia, adaptando las columnas y los textos al recurso.

- Orden vertical: botón Filter, chips aplicados, barra de búsqueda/creación y contenedor de tabla con paginado. Separación de 24 px entre filtros y barra; 20 px entre barra y tabla. Sin tarjeta adicional alrededor del buscador ni padding exterior duplicado.
- Barra superior: InputSearch con variante standard, icono de búsqueda y línea inferior; ancho de 360 px desde sm y 100% en xs. Botón de creación a la derecha, contained/primary, texto contrastText, icono AddCircleOutlined y radio de 2 × theme.shape.borderRadius (16 px en el tema actual). En xs, controles apilados y botón de ancho completo.
- Contenedor único para cabecera, filas y paginado: fondo background.paper, borde de 1 px con palette.border.default (fallback divider), radio de 2 × theme.shape.borderRadius y sombra theme.shadows[2]. Recortar las esquinas con overflow hidden; no separar el paginado en otra tarjeta.
- Cabecera con primary.main, texto primary.contrastText y fontWeight700, mediante los overrides globales de MuiTableHead/MuiTableCell. Celdas de tamaño normal con padding MUI estándar; sin cabeceras neutras ni colores locales hardcodeados. Importes y conteos alineados a la derecha cuando corresponda.
- Nombre principal en body2/fontWeight600. Estado de activo con Chip pequeño filled, success para activos y default para inactivos, con etiqueta traducida; no confundir esta visibilidad con el estado financiero del movimiento.
- Acciones como última columna, centrada, con IconButton pequeño primary y MoreVertOutlined pequeño. Crear/Actualizar usan modales; los cambios de activo usan ConfirmDialog.
- Paginado MUI TablePagination dentro del contenedor, después del área de scroll, alineado a la derecha en escritorio y con el mismo fondo que las filas. Selector «Filas por página», rango «desde–hasta de total» y flechas anterior/siguiente; todos los textos y nombres accesibles traducidos. Toolbar con altura/padding estándar de MUI en escritorio; en móvil puede envolver sus controles sin desbordar ni ocultarlos.
- El scroll horizontal pertenece únicamente al TableContainer, con minWidth650 y scrollbars transparentes. El paginado permanece visible sin desplazar horizontalmente la tabla. Mantener paginación del servidor y adaptar su índice al control MUI; no reemplazarla por paginación de datos descargados.
- Primer fetch: Skeleton Boneyard para el contenido. Refetch: conservar filas y mostrar LinearProgress discreto; deshabilitar buscador, creación, acciones y paginado mientras estén ocupados. Vacío y error deben distinguirse, con mensaje vacío o Alert/reintento según corresponda.

Implementación de referencia para Finanzas: [FinanceTable](../../nodia-client/src/modules/finances/components/FinanceTable/FinanceTable.tsx), [estilos](../../nodia-client/src/modules/finances/components/FinanceTable/styles.ts) y [tema compartido](../../nodia-client/src/theme/components.tsx). Las cuatro tablas de mantenimiento, los últimos movimientos y los resúmenes de General reutilizan el mismo componente.

Verificación local con filas sintéticas: buscador de 360 px, cabecera primary/contrastText, paginado de 52 px a la derecha en escritorio, navegación entre tres páginas, cambio de tamaño de página, textos es/en y tema claro/oscuro. En un ancho móvil de 390 px se comprobaron controles superiores de ancho completo, tabla con scroll horizontal y paginado visible dentro de su contenedor. Las regresiones mantienen el bloqueo de selector/flechas durante refetch y la adaptación del índice de página del servidor.

## Aplicación a Finanzas personales — 2026-10-04

Reglas operativas vigentes de AGENTS y solicitud actual; no crear una estética distinta de Settings ni aprobar automáticamente todo el añadido.

- PageContent de BaseLayout ya aporta padding xs16px/sm24px/md32px; ninguna página hija añade otro padding exterior. Paneles con rowGap24px y columnGap16px.
- General y tabs siguen MUI/Emotion/tokens del tema existente, Light/Dark. Información en tablas y bloques de indicadores; sin librería visual nueva.
- TableTopBar: InputSearch izquierda, Crear derecha; acciones principales ancho100% en xs, incluidas barras de herramientas y acciones de modal.
- TableContainer con overflowX auto y Table minWidth650. No aplastar columnas en móvil.
- Scrollbars: track transparente !important; flechas ocultas/0 px; thumb6px, border-radius9999px, sin borde sólido, alpha blanco/negro0.2 según tema y hover0.35. scrollbar-width thin y scrollbar-color thumb transparent junto a pseudo-clases WebKit.
- Actions última columna: IconButton MoreVert con nombre accesible, Menu Update/Activate/Deactivate según estado y ConfirmDialog. Modales BaseModal para toda creación/edición.
- TextInput, SelectSingleInput, SelectMultipleInput e InputSearch reutilizados. TranslationInput solo para campos realmente traducibles de Core; nombres financieros personales no exigen traducciones dinámicas.
- Switch activo visual UserModal: SwitchWrapper, borde divider/fondo tenue, labelPlacement start/600 y verde success cuando activo.
- Filter obligatorio y activos aplicados desde primera consulta; Limpiar restablece activos. No confundir archivado y anulación financiera.
- Presentación de Filter igual a Modules: botón «Filtro» con contador arriba y chips de FilterChips en una fila debajo, fondo secondary/turquesa, separación de 16 px entre filas y 12 px entre chips. Cada chip permite quitar solo ese filtro y reinicia la página; quitar «Solo activos» muestra todos. El contador corresponde a los chips aplicados, incluyendo cada categoría/grupo seleccionado. En móvil los chips se ajustan al ancho y el botón ocupa el 100%; las acciones quedan deshabilitadas durante peticiones.
- Skeleton Boneyard solo primer fetch de contenido; inputs/acciones disabled/loading. Soft loading sin desmontar en refetch/mutación; Empty State, Alert/reintento y feedback sileo es/en. Fallo de escritura conserva modal e inputs.

Ver [plan Client](24-personal-finance-client-plan.md) para tareas y evidencia local. El filtro se comprobó con datos sintéticos en navegador: escritorio, ancho móvil de 390 px, temas claro/oscuro, eliminación de chips, contador y limpieza. La integración completa con sesión real sobre la BD objetivo sigue pendiente.

## Aplicación a Reservas de alojamiento — 2026-10-04

La ampliación conserva el sistema visual y reglas locales: MUI/Emotion, temas claro/oscuro, inputs/modales reutilizables, i18n ES/EN, toast sileo y formulario conservado ante error. Sin padding exterior duplicado; paneles con separación vertical24px/horizontal16px, acciones principales ancho completo en móvil, tablas minWidth650 y scroll transparente.

Calendario navegable con teclado y alternativa en listado; etiquetas de fechas/estado y leyenda, sin depender solo de colores. Mostrar horas en la zona de la casa y distinguir noches, cobros, devolución pendiente y preparación planificada/real. Confirmaciones explican consecuencias comerciales; no pedir decisiones sobre locks o detalles internos. [26](26-rental-reservations-spec.md) y [28](28-rental-reservations-contracts.md) definen el flujo; [plan Client30](30-rental-reservations-client-plan.md) registra diseño implementado y QA: 390/768/1440 px, claro/oscuro, ES/EN, tabla650px con paginación externa, teclado/foco y preservación de formularios. Navegador→API→PostgreSQL temporal verificado; smoke real pendiente RC-38. No se declara auditoría WCAG completa. Esta aplicación está en revisión.
