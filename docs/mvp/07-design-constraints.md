# Restricciones de Diseño — Nodia Parte 1

> Estado: aprobado (base histórica); aplicación y ampliación Finanzas en revisión
> Última actualización: 2026-10-09
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

Según [35](35-mobile-cards-shortcuts-plan.md), en `xs` (<600 px) los listados adaptados explícitamente pueden usar tarjetas verticales con campos principales y acciones del registro, compartiendo consulta, filtros y paginado del servidor. ReservationTable es el piloto implementado; Modules añade tarjetas para módulos y grupos, Users para usuarios, Actions para acciones generales/de negocio y Roles para roles, por solicitud del 2026-10-09. Nuevos CRUD de registros siguen [DESIGN.md 9.6](../../nodia-client/DESIGN.md), con campos elegidos desde su contrato. Las tablas sin adaptar y todas las vistas desde 600 px conservan el patrón de tabla, `minWidth: 650` y scroll transparente. No convertir columnas por heurística ni aplicar esta representación a calendarios/resúmenes sin selección específica.

BaseLayout autenticado incorpora barra inferior de borde a borde con cuatro accesos locales por persona e Inicio fijo más grande al centro. Candado flotante arriba a la derecha regula edición, sin alterar permisos. Reservar espacio debajo del contenido y de avisos; safe area dentro de barra y selector. Las tarjetas usan campos visibles, estado separado de archivo/inactividad, acción principal de ancho completo y menú secundario. La aprobación visual corresponde a la barra; no extiende aprobación automática a toda la ampliación documental.

## 5. Accesibilidad (a11y)

- **Nivel de exigencia:** No es prioridad para el MVP.
- **Enfoque práctico:** Se aprovechará únicamente la accesibilidad gratuita que ya traen los componentes de MUI out-of-the-box, sin realizar pruebas o ajustes específicos de contraste, screen readers o navegación estricta.

## Avisos de autorización bajo el topbar — 2026-10-09

Por solicitud del usuario, el fallo de lectura del contexto en rutas privadas se muestra como un Alert dentro del contenido, después del topbar. El drawer fijo no puede tapar su icono, texto ni acción. Se reutilizan colores y tipografía del tema, textos ES/EN y feedback sileo existente; padding único de PageContent (16/24/32 px), sin margen exterior adicional en el guard y 24 px hasta la vista conservada. La carga de contexto y sus reintentos mantienen el shell. El progreso de revalidación pertenece al contenido, sin barra fija sobre toda la pantalla.

En `xs`, el texto envuelve y «Reintentar» ocupa el ancho disponible en una fila propia, con altura mínima44px; desde `sm`, la acción queda a la derecha. Deshabilitar durante la petición. Con datos previos, conservar la página y bloquear sus controles hasta recuperar autorización; sin datos, no montar ni consultar la página. Son cambios solicitados, sin aprobación automática del resto del documento. Ver [contrato de guards](14-authentication.md#guards-de-navegación-y-modo-demo).

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


## Ajuste móvil de proveedores IA — 2026-10-09

Por solicitud del usuario, listado y detalle de AiProviders compactan paneles internos a12px en xs y conservan PageContent16px, separación entre paneles24px y theme existente. El detalle omite la cabecera duplicada del listado solo en móvil; mantiene Volver, conexión identificada y acciones. Modos apilados con orientación vertical/teclado, modelos e IDs largos con ajuste de línea, controles de razonamiento/OCR apilados y botones principales44px/ancho completo. API keys usa tarjetas en xs y tabla650px desde sm, misma consulta/página/handlers; máscara, selección exclusiva y papelera con confirmación preservadas. No reducir controles para lograr densidad. Referencia futura: DESIGN9.4/9.6. Sin cambios de proveedores, modelos asignados, cuentas, secretos ni BD; no se aprueba automáticamente este documento.


## Aplicación móvil de Negocios — 2026-10-09

Por solicitud del usuario, listado/detalle y cinco pestañas usan el theme y PageContent existentes sin padding exterior adicional. Cabecera, pestañas verticales reales, botones principales y acciones modales se apilan en xs; paneles internos12–16px. Proveedores/productos/facturas/colaboradores/contactos usan tarjetas específicas en xs y tablas650px desde sm, compartiendo estado y handlers. Se conservan mapeos de proveedor, historial del producto, enlaces de contacto y rutas largas. Paginado con controles44px, etiquetas traducidas y fuera del Skeleton; tarjetas y filtros no amplían el viewport. Las comparaciones de importación mantienen tabla/scroll local, con entorno de controles adaptado. Descripción de negocio con un input opcional; icono nativo de fechas currentColor y Activo de factura debajo de Ruta/Archivo. Ver [contrato vigente](../../nodia-client/src/modules/business/CONTRACT.md) y DESIGN9.6/9.7. Documento sin aprobación automática.


## Paginado móvil uniforme — 2026-10-09

Solicitud explícita: todos los listados paginados móviles usan primera fila con «Filas por página»/selector y segunda con rango/flechas juntas. Ambas filas se centran independientemente mediante justifyContent center; no compartir columnas que desplacen su contenido. La regla reside en MuiTablePagination del tema compartido, con botones44px y orden de foco conservado; desde sm permanece una fila. Eliminados los overrides móviles por recurso para evitar divergencia entre Modules, Actions, Users, Roles, Negocios, Reservas, Finanzas y API keys. Un tamaño fijo conserva rango/flechas sin inventar selector ni fila vacía. No altera consultas, página, tamaño ni contratos. Referencia futura DESIGN9.6; documento sin aprobación automática.

- Normalización solicitada el 2026-10-09: dentro de Filter, actividad mediante ActiveStatusSelect (SelectSingleInput) con Activo / Inactivo / Todos, Activo inicial y tras Limpiar. Todos incluye ambos sin predicado; reabrir refleja selección aplicada y aplicar/quitar reinicia página. Etiqueta Estado de actividad distingue actividad de estados comerciales. Regla estricta en AGENTS.md; no cambia estados comerciales ni switches de edición, ni aprueba automáticamente documentos.

## Finanzas personales móvil — 2026-10-09

Adaptación explícita de MC-07: tarjetas xs para los cuatro recursos, últimos movimientos y resúmenes General; tablas desde sm con scroll local. Campos monetarios exactos a ancho completo, pares compactos para otros datos; no comprimir cifras largas ni duplicar padding de panel. Selector de sección en xs ofrece todos los destinos y conserva estado/ruta; desktop mantiene tabs. Búsqueda/acciones ancho completo, modales con scroll interno y acciones44px; paginado global de dos filas centradas. Referencias FinanceTable/FinanceRecordCard/PersonalFinance y DESIGN9.6/9.7. Ampliación sin aprobación documental automática; aceptación física pendiente.