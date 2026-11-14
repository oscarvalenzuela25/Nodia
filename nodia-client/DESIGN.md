# Nodia UI Design System & Mockup Guidelines (`DESIGN.md`)

> **Guía y especificación de diseño para herramientas de generación de interfaces y mockups con IA (Stitch AI, Galileo, v0, etc.).**
> Este documento define con precisión quirúrgica la identidad visual, los tokens de diseño, la estructura de layouts, los componentes y las micro-interacciones de la plataforma web **Nodia**.

---

## 1. Identidad Visual y Filosofía de Diseño

- **Plataforma**: Nodia — SaaS B2B empresarial y modular para gestión de negocios, colaboradores, productos y configuraciones generales.
- **Tono Visual**: Moderno, minimalista, de alta precisión técnica ("High-density Developer & Enterprise Tooling"). Sin estética genérica ("No AI slop"), tipografía cuidada, contrastes calibrados y micro-interacciones sutiles con retroalimentación visual inmediata.
- **Enfoque de Tema**: **Dual (Modo Oscuro dominante / Modo Claro accesible)**. Diseñado con prioridad estética para el modo oscuro con superficies profundas (`#000000` base, `#1a212b` superficies/tarjetas) y acentos en índigo/lavanda y verde/teal.
- **Tema inicial** (solicitud del 2026-10-11): oscuro/negro cuando no hay preferencia guardada, independientemente del tema del sistema. El selector existente alterna a claro y viceversa; la elección persiste en el navegador y se respeta al recargar, incluidas preferencias claras anteriores.

---

## 2. Tokens de Color (Palette)

### 2.1 Modo Oscuro (Dark Theme - Dominante)

| Token | HEX / Valor | Rol de UI |
| :--- | :--- | :--- |
| `background.default` | `#000000` | Fondo general de la aplicación |
| `background.paper` | `#1a212b` | Fondo de tarjetas, modales, sidenav y drawers |
| `background.surface` | `#1a212b` | Superficies elevadas |
| `primary.main` | `#818cf8` | Acento principal (Lavanda / Índigo luminoso), títulos de módulos, estados activos |
| `primary.light` | `#a5b4fc` | Hover de primarios y detalles luminosos |
| `primary.dark` | `#4f46e5` | Bordes activos y estados presionados |
| `secondary.main` | `#2dd4bf` | Acento secundario (Teal brillante), tags y contadores |
| `tertiary.main` | `#fcd34d` | Acento cálido (Ámbar), acentos en gradientes de logotipo |
| `text.primary` | `#ffffff` | Texto principal, títulos de pantalla, nombres de negocio |
| `text.secondary` | `#cccccc` | Texto secundario, subtítulos, descripciones y placeholders |
| `text.disabled` | `rgba(255, 255, 255, 0.5)` | Elementos y textos inhabilitados |
| `divider` | `rgba(255, 255, 255, 0.12)` | Líneas divisorias de tablas, bordes sutiles de cards |
| `border.default` | `#545454` | Bordes definidos de inputs |
| `success.main` | `#4ade80` | Estado Activo (badge/dot verde neón suave) |
| `error.main` | `#f87171` | Estado Inactivo / Error / Acciones destructivas |
| `warning.main` | `#fcd34d` | Alertas preventivas |

### 2.2 Modo Claro (Light Theme)

| Token | HEX / Valor | Rol de UI |
| :--- | :--- | :--- |
| `background.default` | `#f7f9f3` | Fondo general de la aplicación (blanco cálido/marfil sutil) |
| `background.paper` | `#ffffff` | Fondo de tarjetas, tablas, modales y sidenav |
| `primary.main` | `#4f46e5` | Índigo profundo y elegante para botones y encabezados |
| `primary.light` | `#818cf8` | Hover y selección sutil |
| `primary.dark` | `#3730a3` | Enfoque y botones presionados |
| `secondary.main` | `#14b8a6` | Teal esmeralda |
| `tertiary.main` | `#f59e0b` | Ámbar dorado |
| `text.primary` | `#000000` | Texto principal de alto contraste |
| `text.secondary` | `#333333` | Subtítulos y descripciones |
| `divider` | `rgba(0, 0, 0, 0.10)` | Líneas separadoras |
| `border.default` | `rgba(0, 0, 0, 0.15)` | Bordes de inputs y componentes |
| `success.main` | `#22c55e` | Estado activo |
| `error.main` | `#ef4444` | Estado inactivo / error |

### 2.3 Gradientes y Efectos de Luz

- **Brand Logo Gradient**: `linear-gradient(135deg, #818cf8 0%, #fcd34d 100%)` (o hacia `#2dd4bf` en variantes secundarias).
- **Heading Gradient**: `linear-gradient(90deg, #818cf8, #fcd34d)` con `WebkitBackgroundClip: text`.
- **Glow Activo**: `box-shadow: 0 0 8px rgba(74, 222, 128, 0.5)` (alrededor de puntos de estado activo).
- **Card Hover Glow**: `box-shadow: 0 8px 24px -4px rgba(129, 140, 248, 0.35)` en dark mode.

---

## 3. Tipografía

- **Familia tipográfica principal**: `"DM Sans", "Inter", -apple-system, sans-serif`.
- **Logotipo Nodia**: `"Karmatic Arcade", monospace, sans-serif` (48px, aspecto retro-arcade futurista estilizado).

### Escala Tipográfica

| Nivel | Desktop (md+) | Móvil (xs < 600px) | Peso | Line-Height | Uso |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `h1` | 48px - 96px | 32px - 40px (2rem - 2.5rem) | 300 / 400 | 1.16 | Titulares de aterrizaje y bienvenida |
| `h3` | 48px (3rem) | 28px - 32px (1.75rem - 2rem) | 700 | 1.2 | Bienvenida en Home con gradiente |
| `h4` | 34px (2.125rem) | 24px (1.5rem) | 600 | 1.25 | Título de secciones principales (`Negocios`, `Usuarios`) |
| `h5` | 24px (1.5rem) | 20px (1.25rem) | 600 | 1.3 | Títulos de grupos de módulos o secciones internas |
| `h6` | 20px (1.25rem) | 18px (1.125rem) | 600 | 1.4 | Título de tarjetas (`BusinessCard`, `SettingsCard`) |
| `subtitle1` | 16px (1rem) | 15px (0.9375rem) | 400 | 1.5 | Subtítulos de cabecera que explican la pantalla |
| `body1` | 16px (1rem) | 15px (0.9375rem) | 400 | 1.5 | Texto general de lectura |
| `body2` | 14px (0.875rem) | 14px (0.875rem) | 400 | 1.43 | Textos en tablas, chips, descripciones cortas |
| `button` | 14px (0.875rem) | 14px (0.875rem) | 500 | 1.75 | Botones (con `textTransform: none` siempre) |
| `caption` | 12px (0.75rem) | 12px (0.75rem) | 400 | 1.66 | Fechas, metadatos, contadores y badges |

---

## 4. Spacing, Bordes y Elevación

- **Base de Spacing**: Sistema modular basado en `8px` (`theme.spacing(n)`):
  - `spacing(1)` = `8px` (gap mínimo entre chips, iconos y metadatos)
  - `spacing(1.5)` = `12px` (gap compacto en barras móviles)
  - `spacing(2)` = `16px` (**padding estándar de contenedor de pantalla en Mobile `xs`**, gap estándar en toolbars)
  - `spacing(3)` = `24px` (padding en Tablet `sm`, padding interno de modales/tarjetas en desktop, separación vertical entre paneles)
  - `spacing(4)` = `32px` (**padding estándar de contenedor de pantalla en Desktop `md`+**)
  - `spacing(6)` = `48px` (separación entre secciones principales en desktop)
- **Border Radius**:
  - Inputs, botones y chips: `8px` a `10px`
  - Tarjetas (`BusinessCard`, `SettingsCard`): `12px` a `16px`
  - Modales: `16px` (desktop) / `14px` a `16px` (móvil)
  - Contenedor de ícono en tarjetas (`CardIconWrapper`): `12px`
- **Elevación / Sombras**:
  - `Shadow 1`: `0 2px 8px rgba(0, 0, 0, 0.4)` (cards estáticas dark)
  - `Shadow Hover`: `0 8px 24px -4px rgba(129, 140, 248, 0.35)` + `translateY(-4px)`
  - `Borders`: `1px solid rgba(255, 255, 255, 0.12)` (dark) o `rgba(0, 0, 0, 0.10)` (light)

---

## 5. Arquitectura del Shell / Layout Principal

### 5.1 Layout de Escritorio (Desktop Layout - `lg`+)

```text
+-------------------------------------------------------------------------------+
| SIDENAV (272px)   | MAIN CONTENT AREA                                         |
|                   | +-------------------------------------------------------+ |
| [Logo "Nodia"]    | | TOPBAR (h: 64px)       [Lang ES/EN] [Theme] [Avatar]  | |
|                   | +-------------------------------------------------------+ |
| > Inicio          | | PAGE HEADER (Padding: 32px)                           | |
|                   | |   Title (h4, 600)                 [+ Botón Principal] | |
| v Ajustes         | |   Subtitle (body2, secondary)                         | |
|   - Usuarios      | |-------------------------------------------------------| |
|   - Roles         | | FILTER TOOLBAR                                        | |
|   - Accionables   | |   [InputSearch (Search...)] [Filtro Avanzado] [Act/All] | |
|   - Módulos       | |-------------------------------------------------------| |
|                   | | GRID / DATA VIEW                                      | |
| > Negocios        | |   [Card 1]     [Card 2]     [Card 3]     [Card 4]     | |
|                   | |   [Card 5]     [Card 6]     ...                       | |
+-------------------------------------------------------------------------------+
```

1. **Sidenav (Desktop)**:
   - Ancho expandido: `272px` | Colapsado: `88px`.
   - En modo colapsado, Inicio y cada módulo conservan nombre accesible y Tooltip MUI a la derecha con su etiqueta traducida. Disponible con mouse y foco de teclado; Escape lo cierra sin mover el foco. Al expandir o abrir el drawer móvil, los nombres siguen visibles y no se duplica el tooltip. Referencia: `docs/evidence/sidenav-collapsed-tooltips-20261031-r25.json`.
   - Logotipo centrado arriba con `Karmatic Arcade` a 48px y gradiente de marca.
   - Ítems de navegación con íconos Outlined (24px) alineados a la izquierda.
   - Grupos colapsables con flecha rotatoria `KeyboardArrowDownIcon`.
   - Estado seleccionado: Fondo con gradiente índigo y texto en alto contraste.
2. **Topbar (Desktop)**:
   - Altura: `64px`, `padding: 16px 32px`, alineado a la derecha, sin sombras pesadas.
   - Botón de colapso a la izquierda (`ArrowCircleLeftOutlinedIcon`).
   - Selectores a la derecha: Idioma (`ES / EN`), Tema (`Sol / Luna`), Avatar circular con menú de usuario.
3. **Área Principal (`PageContent`)**:
   - `padding: theme.spacing(4)` (32px constante).
   - Cabecera con título principal y botón CTA alineado a la derecha (`+ Nuevo ...`).
   - Barra de filtros: Buscador con debounce (`InputSearch`) + Botón de filtro modal (`Filter`) con badge contador + Switcher/Toggle de estados (`Activos / Inactivos / Todos`).

---

### 5.2 Layout Móvil (Mobile Shell Layout - `xs` / `<600px`)

```text
+-------------------------------------------------------------+
| TOPBAR (h: 56px, padding: 12px 16px)                        |
| [=] Hamburger                               [ES] [Sun] [Av] |
+-------------------------------------------------------------+
| DRAWER TEMPORAL (al abrir hamburger, w: 272px, backdrop)    |
| [Nodia Logo] (auto-cierre obligatorio tras navegación)      |
+-------------------------------------------------------------+
| MAIN CONTENT AREA (Padding: 16px / theme.spacing(2))        |
| PAGE HEADER (gap: 8px)                                      |
|   Title (h4: 24px)                                          |
|   Subtitle (body1: 15px)                                    |
|   [+ Botón Principal CTA: width: 100%]                      |
|-------------------------------------------------------------|
| FILTER TOOLBAR (Vertical Stack en xs)                       |
|   [InputSearch (w: 100%)]                                   |
|   [Filter Trigger] [Toggle Buttons: w: 100%, flex: 1]       |
|-------------------------------------------------------------|
| RECORD CARDS (xs) / LEGACY TABLE (minWidth: 650px)          |
|   Title + status + labeled fields + actions                 |
+-------------------------------------------------------------+
```

1. **Sidenav (Mobile Drawer)**:
   - Drawer temporal (`variant="temporary"`) con backdrop desenfocado (`backdropFilter: "blur(4px)"`).
   - **Regla de auto-cierre**: Al pulsar cualquier enlace de navegación (`Inicio`, sub-módulos, negocios), el drawer **debe cerrarse automáticamente** (`onDrawerToggle()`).
   - Ancho: `272px` (ocupa máximo `85vw` en pantallas muy reducidas).
2. **Topbar (Mobile)**:
   - Altura: `56px`, `padding: theme.spacing(1.5, 2)` (12px vertical, 16px horizontal).
   - Icono de menú hamburguesa (`MenuOutlinedIcon`, touch target `44x44px`) a la izquierda para desplegar el drawer.
   - Controles compactos a la derecha con gap reducido (`spacing={1}`).
3. **Área Principal (`PageContent`) en Móvil**:
   - `padding: theme.spacing(2)` (16px lateral y vertical).
   - `minWidth: 0` y `overflowX: "hidden"` en `MainContainer` para evitar scroll horizontal de toda la página.

---

## 6. Especificación de Componentes Core

### 6.1 Tarjeta de Módulo / Dashboard (`SettingsCard`)
- **Uso**: Pantalla Home / Lanzador de aplicaciones.
- **Grilla Responsive**: `Grid size={{ xs: 12, sm: 6, md: 3 }}` (1 columna en móvil, 2 en tablet, 4 en desktop).
- **Estructura**:
  - `CardIconWrapper`: Cuadro de `44x44px`, border-radius de `12px`, fondo translúcido `rgba(129, 140, 248, 0.14)` y color de ícono `#818cf8`.
  - `CardTitle`: Título en `1.25rem` (h6), font-weight 600, color `#818cf8`.
  - `CardDescription`: Texto en `0.875rem` (body2), color `#cccccc`, línea de altura 1.5 (se omite limpiamente si no hay descripción).
- **Interacción**: Hover en desktop eleva `-4px` y activa glow; en mobile el tap activa retroalimentación visual inmediata.

### 6.2 Tarjeta de Negocio (`BusinessCard`)
- **Uso**: Listado de negocios en `/tools/business`.
- **Grilla Responsive**: `gridTemplateColumns: "repeat(1, 1fr)"` en `xs`, `repeat(2, 1fr)` en `sm`, `repeat(3, 1fr)` en `md`.
- **Estructura**:
  - **Header**: Nombre del negocio truncado (`text-overflow: ellipsis`) + Punto de estado (verde neón glowing para activo, rojo para inactivo) + Menú de 3 puntos (`MoreVertIcon`, touch target mínimo 44px).
  - **Body**: Descripción en 1 sola línea con elipsis y tooltip al posar el mouse + Chips temáticos (categorías / tags con colores sutiles).
  - **Footer**: Identificador / Fecha o conteo de colaboradores + Botón sutil de visualización/acceso.

### 6.3 Tablas de Datos (`Data Table`) y Reglas de Horizontal Scroll
- **Radio del contenedor estándar:** `TABLE_PANEL_RADIUS = "8px"`, de `src/theme/tablePanel.ts`, por solicitud del 2026-10-30. Aplicarlo a wrappers de tabla de Negocios, administración, Finanzas y Reservas, incluido su skeleton; conservar los radios propios de tarjetas, modales y comparaciones específicas.
- **Uso**: Módulos administrativos (`/settings/users`, `/settings/roles`, `/settings/actions`, `/settings/modules`, `/tools/business/:id`).
- **Comportamiento de tablas y alternativa móvil**:
  - En nuevos listados CRUD orientados a registros, usar tarjetas en `xs` y tablas desde `sm`, conforme a 9.6. Las tablas existentes sin adaptar conservan su scroll horizontal.
  - Las tablas **NUNCA deben aplastarse** ni reducir el ancho de sus columnas por debajo de su tamaño legible.
  - Toda tabla MUI (`Table`) debe tener forzado un `minWidth: 650px` (definido globalmente en `theme.components.MuiTable`).
  - El contenedor `TableContainer` debe tener `overflowX: "auto"` con scrollbar delgado y pista 100% transparente.
  - La fila dispone de hover sutil (`rgba(255, 255, 255, 0.04)`).
  - Columna de Estado con Chip de color (`Activo` en verde, `Inactivo` en rojo).
  - Columna de Acciones con botón `Copiar ID` y menú contextual de 3 puntos.
  - Cada opción del menú usa `ListItemIcon` y `ListItemText`: actualizar con lápiz/primary, desactivar con bloqueo/error, activar con check/success y acciones específicas con un icono acorde. Conservar etiquetas traducidas, permisos y bloqueo durante peticiones; iconos decorativos sin duplicar el nombre accesible.

### 6.4 Selector de Perspectiva (Perspective Switcher)
- **Uso**: Módulos administrativos (`/settings/actions`, `/settings/modules`).
- **Selector de Perspectiva**: `ToggleButtonGroup` moderno con 3 opciones (`Split View`, `Solo Primario`, `Solo Secundario`).
- **Comportamiento Responsive**:
  - **Desktop (`sm`+)**: Muestra icono + texto completo (ej. `[Icon] Vista Dividida`, `[Icon] Acciones del Sistema`, `[Icon] Acciones de Negocio`).
  - **Móvil (`xs`)**: Muestra **únicamente los iconos** con tooltip y `aria-label` accesible (`sx={{ display: { xs: "none", sm: "inline" } }}` para el texto). Esto evita que el grupo de botones desborde los 360px de la pantalla móvil.

### 6.5 Modales y Diálogos (`BaseModal`, `ConfirmDialog`)
- **Márgenes Externos**: Mínimo `16px` respecto a los bordes de la pantalla (`maxWidth: min(${targetWidth}px, calc(100vw - 32px))`).
- **Paddings Internos**:
  - `ModalHeader`: `16px` en móvil (`theme.spacing(2, 2, 1.5, 2)`), `24px` en desktop (`theme.spacing(2.5, 3, 1.5, 3)`).
  - `ModalContent`: `16px` en móvil (`theme.spacing(2, 2)`), `24px` en desktop (`theme.spacing(2, 3)`).
  - `ModalActions`: `16px` en móvil (`theme.spacing(2, 2)`), `24px` en desktop (`theme.spacing(2, 3, 2.5, 3)`).
- **Acciones en Móvil**:
  - `ConfirmDialog`: Botones de acción apilados verticalmente en `xs` (`flexDirection: "column-reverse"`), ambos con `width: "100%"` (el botón de confirmación arriba para fácil alcance del pulgar, cancelar abajo).
  - Formularios en modales: En pantallas pequeñas, `ModalContent` mantiene auto-scroll con scrollbar transparente, evitando desbordar el viewport cuando se abre el teclado táctil virtual.

### 6.6 Componente Filtro (`Filter`)
- **Inputs en vertical** (solicitud del 2026-10-10): cada input de filtros ocupa una fila completa, en una sola columna en todos los breakpoints. No emparejar inputs en una misma fila. Referencia implementada: RentalFilters para todos los recursos de Reservas y período de Caja. Las barras de acciones/chips mantienen sus reglas propias.
- **Estado de actividad normalizado**: usar `ActiveStatusSelect` basado en `SelectSingleInput`, con exactamente Activo / Inactivo / Todos (ES/EN). Activo desde la primera consulta y tras Limpiar; Todos elimina el criterio de actividad. Prohibido switch/checkbox/select local para actividad dentro de Filter. Estados comerciales y switches de edición conservan sus contratos. Reabrir refleja estado aplicado; aplicar/quitar reinicia página, sin perder búsqueda; controles bloqueados durante su petición. Ver AGENTS.md.

- **Trigger**: Botón redondeado con icono `TuneOutlinedIcon`, texto "Filtro" y badge contador de filtros activos.
- **Acciones del Modal de Filtros en Móvil**:
  - En desktop: "Limpiar filtros" a la izquierda, "Cancelar" y "Filtrar" a la derecha.
  - En móvil (`xs`): Contenedor apilado (`flexDirection: "column-reverse"`):
    - Botón "Limpiar filtros": Ancho `100%` en la parte inferior.
    - Botones "Cancelar" y "Filtrar": Fila horizontal superior, cada uno ocupando `flex: 1` (50% de ancho).
    - Esto previene cualquier corte, desbordamiento o texto quebrado en pantallas angostas.

### 6.7 Barras de Herramientas (`TableTopBar`, `FilterBar`)
- **Desktop (`sm`+)**: Disposición horizontal `justifyContent: "space-between"`, buscador a la izquierda (320px) y botón CTA a la derecha.
- **Móvil (`xs`)**:
  - Disposición vertical apilada (`flexDirection: "column"`, `alignItems: "stretch"`).
  - Buscador `InputSearch`: Ocupa el `100%` del ancho.
  - Botón CTA principal ("+ Nuevo ..."): Ocupa el `100%` del ancho (`width: "100%"`), ofreciendo un área táctil amplia y accesible para el pulgar.
  - Grupos de botones (`ToggleButtonGroup` de Activos/Inactivos): Ocupan el `100%` de ancho con `flex: 1` para cada botón.

### 6.8 Estados de Carga, Vacío y Error
- **Carga inicial**: Skeleton con `boneyard-js` replicando la geometría exacta de las cards o tablas.
- **Revalidación en background**: Barra delgada `LinearProgress` de `2px` en el tope superior sin parpadeos ni desmontaje de la vista.
- **Estado Vacío**: Contenedor con borde discontinuo `1px dashed rgba(255, 255, 255, 0.15)`, ícono temático a 48px, título informativo, descripción orientadora y botón de llamada a la acción ("Crear primer negocio").
- **Toasts y Notificaciones**: Librería `sileo` con diseño dark/light contrastado en esquina inferior derecha.

### 6.9 Padding único en TextInput multilínea — 2026-11-06

TextInput conserva un solo propietario del espacio interior. En una línea, el input mantiene10px verticales y14px horizontales. En multilínea, MUI OutlinedInput ya aplica padding a su raíz; el textarea interior debe tener padding0. La regla reusable se define en TextInput/styles.ts bajo `.MuiInputBase-multiline .MuiOutlinedInput-input`, sin modificar inputs de una línea, adornos, fuente, bordes o dimensiones por breakpoint. No corregir este defecto con parches por módulo ni sumar padding al textarea en un consumidor nuevo. Un editor especializado puede adaptar el padding de la raíz manteniendo el textarea sin otro inset.

La regresión atómica comprueba el DOM/estilos calculados de un TextInput real con multiline/minRows y control final: raíz espaciada, textarea0, valor con salto de línea y singleline10px/14px conservados. Falló con10px/14px en el textarea antes del arreglo. Esta comprobación de cascada en JSDOM no mide geometría o autosize de un navegador real; la validación visual del formulario que motivó el cambio se registra por separado. No cambian props, validación, eventos, persistencia o selección IA.

### 6.10 Controles y carga inicial de Teacher — 2026-11-06

PlanReview usa título22px/700 y botones contained. En los otros propietarios Teacher, declarar outlined cuando el Button no sea contained; no depender de la variante text implícita. Mantener variantes condicionales contained/outlined y paginación outlined, sin alterar selección/handlers o targets existentes. El reintento de QueryErrorAlert recibe retryVariant="outlined" sólo por opción del consumidor Teacher; su default text preserva los demás módulos.

TeacherLoading usa Boneyard e initialBones para contenido inicial sin datos: representan geometría, nunca porcentaje o resultado. Con datos previos, isFetching no reactiva skeleton ni desmonta el formulario; mantener texto/foco/edición y deshabilitar las acciones que correspondan. Las alertas, vacío, recuperación y borrador conservan su contrato. No aplicar skeleton a un input o botón interactivo. El padding multiline se resuelve una vez en TextInput según6.9, sin duplicarlo en PlanReview ni añadir breakpoints.

ClientR25 adoptado:83pruebas únicas/12suites, tipos/lint/build y OPS5 correctos. CUA comprobó19botones visibles sin text, documento1078/scroll1078 en1088px y310/scroll310 en320px. En nueva sesión, textarea0 con raíz10px/14px y singleline10px/14px. Con latencia4s, skeleton inicial visible32px/160px; en refetch2s, progreso1/skeleton0 y material conservado. PlanReview22px/700 y contained se verifican por fuente/unidades, sin reabrir el plan personal aceptado. Red/viewport restaurados, pestaña QA cerrada y curso pausado/conteo7 intacto, sin mutaciones. [96§39](../docs/mvp/96-nodia-teacher-implementation-plan.md#39-controles-padding-multilínea-y-carga-inicial-teacher--2026-11-06) y [evidencia](../docs/evidence/teacher-ui-controls-20261106-r01.json) distinguen esas capas. No cambia DTOs, permisos, persistencia, runtime IA o disponibilidad de un proveedor; el cambio visual no acredita ahorro de rendimiento o cierre V1.

### 6.11 Recorrido Teacher y estado de generación en las tarjetas — 2026-11-06

StudyJourney conserva el acordeón exterior móvil y permanece abierto en escritorio. Título22px/700, secciones numeradas reales y encabezados h2/h3; objetivos en details secundario y unidades con icono/ordinal del plan. Selección contained y aria-current=step, resto/final outlined; nada representa progreso o completitud sin datos. Una selección externa sigue su sección, sin sobrescribir una expansión manual mientras la unidad permanezca igual. Desde md900, Workspace limita navegación a minmax(240px,320px) junto a contenido minmax(0,1fr), panel autoaltura y sin breakpoint nuevo.

Actualizar disponibilidad de material usa contained, ancho ajustado y alineación centrada incluso en xs, por petición expresa que exceptúa fullwidth sólo en ese control. Solicitar nueva generación es contained sin nuevos guards/efectos. Targets, wrapping, foco, estado y callbacks existentes se conservan.

Mis planes muestra state de sesión y latest_job como chips distintos; el chip del trabajo envuelve su etiqueta a altura automática/maxWidth100% en320px. Ready no es curso completed; unknown/blocked_paused no son preparación activa. GET de listado cada5s sólo para queued/running visibles, con caché actor/versión/parámetros. Error conserva datos con caption de último estado confirmado y reintento GET; refetch no muestra skeleton o desmonta tarjetas. Navegar manualmente por Mis planes detiene observación, no el Worker ni su intención original.

ClientR26/ServerR09 adoptados, con50pruebas Client/8suites y2Server/1suite, tipos/lint/build y SQL aisladoR03(5checks) correctos en [96§40](../docs/mvp/96-nodia-teacher-implementation-plan.md#40-recorrido-compacto-y-generación-visible-en-mis-planes--2026-11-06) y [evidencia](../docs/evidence/teacher-study-journey-20261106-r01.json). No inferir aprobación, calidad pedagógica, ahorro de rendimiento o cierre V1 de esta composición.

### 6.12 Código de lecciones Teacher: espacio literal y copia — 2026-11-06

LessonMarkdown compone bloques fenced/indentados con marco, cabecera y pre monoespaciado. Extensión sólo desde el lenguaje declarado y sus aliases; desconocido conserva etiqueta real, ausente muestra Código traducido. No detectar lenguaje, colorear sintaxis o ejecutar contenido. Inline code permanece inline y sin control de copia. Conservar skipHtml e img prohibidas de ReactMarkdown; no alterar el renderer NodiaAI para resolver esta presentación Teacher.

El bloque usa minWidth0/maxWidth100%, whiteSpace:pre/overflowWrap:normal y scroll horizontal local: conservar indentación y líneas largas sin desbordar el documento o esconder texto. Pista transparente, thumb6px redondeado y botones de scrollbar ocultos, con soporte estándar; región enfocada por teclado y outline visible. Cabecera admite etiqueta larga sin desplazar el IconButton44px. No se requieren nuevos breakpoints.

Copiar escribe sólo el texto del bloque renderizado, incluidos espacios/newline, sin etiqueta/cabecera. Mientras la promesa está pendiente, disabled más inFlight preservan una intención. Sileo success sólo tras fulfilled; ausencia/rechazo de Clipboard API conserva texto seleccionable y emite error/guía manual, sin readback ni falsa confirmación. La copia depende del navegador/permiso, no de la inferencia o autenticación del proveedor.

ClientR27 activo con6pruebas/1suite, tipos/lint/build y adopción correctos en [96§41](../docs/mvp/96-nodia-teacher-implementation-plan.md#41-bloques-de-código-copiables-en-lecciones-teacher--2026-11-06) y [evidencia](../docs/evidence/teacher-code-blocks-20261106-r01.json). CUA1088: documento1078/1078 y pre626/626; móvil320: documento310/310 y pre242/312, ArrowRight desplazó40px. Botón44×44, cinco etiquetas .css/.js y texto CSS179caracteres conservado. Toast observado tras writeTextfulfilled; clipboardread0/pastevirtual vacío no verifican bytes del portapapeles OS. Exactitud/newline/ausencia/rechazo permanecen pruebas sintéticas, no copia física comprobada. No cambia contenido persistido, Server, dependencias, modelos o herramientas; sin afirmar ahorro de rendimiento o cierreV1.

---

## 7. Iconografía Oficial (Material Outlined)

| Concepto | Ícono MUI Outlined |
| :--- | :--- |
| Inicio / Home | `HomeOutlinedIcon` |
| Negocios / Tienda | `StorefrontOutlinedIcon` |
| Usuarios | `AddReactionOutlinedIcon` |
| Roles y Permisos | `SecurityOutlinedIcon` |
| Accionables / Acciones | `BoltOutlinedIcon` |
| Módulos del Sistema | `ViewModuleOutlinedIcon` |
| Ajustes Generales | `SettingsOutlinedIcon` |
| Búsqueda | `SearchOutlinedIcon` |
| Filtros | `TuneOutlinedIcon` |
| Agregar / Nuevo | `AddCircleOutlinedIcon` |
| Colaboradores / Equipo | `PeopleOutlinedIcon` / `PersonAddOutlinedIcon` |
| Menú contextual | `MoreVertIcon` |
| Copiar al portapapeles | `ContentCopyIcon` |
| Estado Activo | `CheckCircleOutlineOutlinedIcon` |
| Estado Inactivo / Bloquear | `BlockOutlinedIcon` |
| Menú Móvil / Hamburguesa | `MenuOutlinedIcon` |
| Colapsar Drawer (Desktop) | `ArrowCircleLeftOutlinedIcon` |
| Cerrar / Cancelar | `CloseIcon` |

---

## 8. Master Prompts para Stitch AI (Desktop)

Para generar mockups idénticos a Nodia en Stitch AI, utiliza las siguientes instrucciones maestras:

### Prompt Base para Vistas Generales de Nodia

```text
Design an enterprise B2B SaaS web application screen named "Nodia" in ultra-refined Dark Mode.
Background: pure black (#000000). Surface/cards: deep dark slate (#1a212b) with 1px border (#2a3441) and 12px border radius.
Color accents: Electric lavender/indigo (#818cf8) as primary, bright teal (#2dd4bf) as secondary, soft warm amber (#fcd34d) for highlights. Active indicators use neon emerald dots with subtle 8px glow (#4ade80).
Typography: "DM Sans" or clean geometric sans-serif with crisp hierarchy, buttons with textTransform: none.
Layout:
- Left persistent sidebar (272px width) featuring a glowing retro-arcade styled logo "Nodia", collapsible group navigation with outlined icons (Storefront, Security, Bolt, ViewModule, Settings), and highlighted active route.
- Top bar with language switcher (ES/EN), dark/light toggle, and clean circular user avatar.
- Main area with 32px padding, top header bar with title, subtitle, and primary "+ New" pill-shaped button.
- Clean filter toolbar: rounded search bar with search icon, advanced filter button with counter chip, and segmented toggle button group (Active / Inactive / All).
- Content presentation: high aesthetic grid of rounded cards or structured minimalist data table with 3-dot context actions.
Avoid clutter, maintain high contrast, generous whitespace, and luxury enterprise SaaS finishing.
```

### Prompt Específico: "Detalle de Negocio" (Business Detail View)

```text
Design a Business Detail view inside the Nodia SaaS design system in Dark Mode (#000000 background, #1a212b cards).
Include:
1. Breadcrumb navigation: "Negocios > Cafetería Central".
2. Header hero card: Large business title, glowing green "Activo" badge, address, creation date, and action buttons ("Editar", "Agregar Colaborador").
3. Metric KPIs row (3 cards): "Colaboradores Activos: 4", "Módulos Asignados: 6", "Facturación Mensual: $12,450".
4. Two-column split layout:
   - Left column: General business information and assigned system modules with category chips.
   - Right column: Collaborators list card with member avatars, roles (Admin, Editor, Staff), status pills, and individual permission actions.
Strictly adhere to DM Sans typography, 12px card border radius, subtle dividers, and lavander/indigo (#818cf8) highlights.
```

---

## 9. Lineamientos y Reglas Estrictas para Dispositivos Móviles (Mobile-First Guidelines)

### 9.1 Breakpoints Oficiales del Sistema

Nodia se rige bajo la escala estándar de breakpoints de Material UI, adaptada para tooling empresarial:

| Breakpoint | Rango (px) | Dispositivos Destino | Comportamiento del Shell y Layout |
| :--- | :--- | :--- | :--- |
| `xs` | `0px - 599px` | Smartphones en orientación vertical (iPhone, Android) | Topbar 56px, Drawer temporal con auto-cierre, padding 16px, 1 columna, botones al 100% |
| `sm` | `600px - 899px` | Tablets en vertical, móviles grandes en horizontal | Topbar 64px, Drawer temporal, padding 24px, 2 columnas en grilla |
| `md` | `900px - 1199px` | Tablets en horizontal, Laptops compactas | Topbar 64px, Sidenav persistente o colapsado, padding 32px, 3 columnas |
| `lg` | `1200px - 1535px` | Monitores de escritorio estándar y laptops corporativas | Sidenav persistente 272px (o 88px colapsado), padding 32px, 4 columnas |
| `xl` | `1536px+` | Pantallas anchas (QHD, 4K, Ultra-wide) | Layout contenido o max-width con márgenes amplios |

---

### 9.2 Touch Targets y Ergonomía Táctil (Regla de Oro: Mínimo 44x44px)

- **Touch Targets Mínimos**: Siguiendo las directrices WCAG 2.2 (Criterio 2.5.8), todo elemento interactivo táctil (botones, íconos de acción, menús de 3 puntos, checkboxes, switches, selectores) debe tener un área táctil mínima de **44x44px** (o al menos `40x40px` con padding de aislamiento).
- **Prohibido requerir `:hover`**: En mobile no existe el cursor. Toda funcionalidad crítica (copiar ID, editar, abrir menú contextual, ver estados) debe ser accesible por **tap/click directo**. El `:hover` solo debe usarse para micro-interacciones cosméticas en dispositivos con cursor real (`@media (hover: hover)`).
- **Accesibilidad del pulgar**: Los botones de acción principal (CTA) en cabeceras y modales deben ubicarse en zonas de alcance natural del pulgar (parte inferior o ancho completo).

---

### 9.3 Tipografía Fluida y Jerarquía Móvil

- **Reducción Proporcional de Encabezados**:
  - `h1`: 32px a 40px en móvil (en lugar de los 64-96px de desktop) para evitar desbordes.
  - `h3` (Bienvenida Home): `1.75rem` (28px) en móvil, escalando a `3rem` (48px) en desktop.
  - `h4` (Títulos de página): `1.5rem` (24px) en móvil, escalando a `2.125rem` (34px) en desktop.
  - `h5` / `h6` (Títulos de tarjetas y secciones): `1.125rem` a `1.25rem` (18-20px).
- **Control de Saltos de Línea**: Títulos largos deben utilizar `word-break: break-word` o truncado con elipsis (`overflow: hidden; text-overflow: ellipsis; white-space: nowrap`) según el contexto visual.

---

### 9.4 Espaciado Dinámico y Prohibición de Doble Padding

- **Regla Estricta de Contenedor de Pantalla (`PageContent`)**:
  - `padding: theme.spacing(2)` (16px) en `xs`.
  - `padding: theme.spacing(3)` (24px) en `sm`.
  - `padding: theme.spacing(4)` (32px) en `md`+.
- **Prohibición de Doble Padding**: Las páginas hijas (`src/modules/*/pages/*`) **nunca deben declarar su propio padding exterior** sobre `ContainerPage` o el nodo raíz, ya que esto duplicaría el padding (llegando a 64px de espacio desperdiciado en móviles). Toda página hereda el padding responsivo provisto por `PageContent` en `BaseLayout`.
- **Paneles anidados compactos**: el padding exterior de `PageContent` no define el padding de cada tarjeta. En `xs`, usar `12px` a `16px` internos según densidad; evitar acumular varios marcos con padding de `24px`/`32px`. Conservar separación legible y controles táctiles de `44px`; compactar espacios, no los objetivos de interacción. Referencia: listado/detalle de AiProviders.
- **Detalle móvil**: evitar repetir la cabecera completa del listado; conservar nombre, Volver y las acciones de la instancia. Si las pestañas se apilan, usar orientación vertical real para semántica y teclado, conservando selección y configuración al redimensionar.
- **Gaps Verticales y Horizontales en Móvil**:
  - Vertical: `16px` a `24px` (`gap: 2` a `3`).
  - Horizontal: `12px` a `16px` (`gap: 1.5` a `2`).

---

### 9.5 Formularios e Inputs Móviles

- **Espaciado Vertical**: Entre campos de formulario contiguos se debe mantener una separación estándar de `16px` a `20px` (`gap: 2` a `2.5`).
- **Ancho Completo**: Todos los inputs (`TextInput`, `SelectSingleInput`, `SelectMultipleInput`, `TranslationInput`) deben configurarse con `fullWidth` dentro de sus contenedores móviles.
- **Acciones junto a texto**: TextInput admite `endAdornment` y una descripción externa enlazada mediante `aria-describedby`. En una fila con botón de envío, ubicar etiqueta/ayuda fuera de la fila para centrar botón y campo, sin offsets; en xs apilar y ocupar todo el ancho. Ojito accesible con etiqueta ES/EN/aria-pressed y mouseDown preventDefault conserva borrador/foco al alternar tipo. Referencia verificada: GeminiLoginViewer,44px,600/1280px centrados y320/390px sin overflow.
- **Fechas nativas**: el indicador de calendario debe usar el mismo color del texto del input en ambos temas, preservando el selector nativo y su accesibilidad. Referencia: TextInput con currentColor y colorScheme.
- **Teclado Virtual y Auto-Scroll**:
  - Los modales deben implementar `overflowY: "auto"` con scrollbar sutil sobre el cuerpo del modal para permitir desplazamiento fluido cuando el teclado virtual de iOS o Android cubra la mitad inferior de la pantalla.
  - El modal debe mantener márgenes de seguridad de al menos `16px` con los bordes de la pantalla (`calc(100vw - 32px)`).

---

### 9.6 Listados de registros: tarjetas móviles y tablas desde `sm`

Regla para nuevos desarrollos, solicitada el 2026-10-09: los listados CRUD orientados a registros deben ofrecer tarjetas en `xs` (<600 px). Elegir los campos y acciones según el contrato del recurso; no transformar columnas automáticamente ni convertir calendarios, matrices comparativas o resúmenes sin evaluar su propósito. Referencias implementadas: ReservationTable, los dos listados de Modules, Users, los dos listados de Actions, Roles, API keys de AiProviders, los listados de Negocios y Finanzas personales (mantenedores, movimientos recientes y resúmenes por categoría/grupo). Las claves usan tarjetas específicas que conservan el switch de selección y la papelera directa exigidos por el contrato IA.

- Reutilizar `MobileRecordCard`: nombre legible, estado con texto, campos esenciales como pares etiqueta/valor, acción principal de ancho completo cuando corresponda y menú secundario accesible. Identificadores, rutas y nombres largos deben envolver sin ampliar el viewport. Conservar ceros reales y representar datos ausentes sin inventar estados.
- Aplicar filtros sobre el conjunto en el servidor antes de paginar; no filtrar solo la página descargada. Si se filtra por asociaciones, conservar la lista completa de asociaciones que el contrato incluye en cada registro.
- Compartir consultas, búsqueda, filtros, página y handlers con la tabla. Montar una sola representación según breakpoint; cambiar de tamaño no reinicia filtros ni consulta registros por tarjeta.
- Desde `sm` (600 px), conservar la tabla con `minWidth: 650`, scroll horizontal limitado a `TableContainer` y scrollbar transparente. Las tablas existentes sin adaptación explícita conservan ese comportamiento también en `xs`.
- Paginación del servidor fuera del área de scroll y del Skeleton: etiquetas ES/EN y objetivos táctiles de al menos44px. En xs, dos filas estables: primera «Filas por página» y selector; segunda rango y flechas juntos. Centrar cada fila independientemente con justifyContent: center, sin compartir columnas que desplacen uno de los grupos. Desde sm conservar una fila. Definido globalmente en theme.components.MuiTablePagination; no duplicar overrides por recurso ni depender del flex-wrap accidental. Si el recurso fija un único tamaño, conservar la ausencia de selector y mostrar rango/flechas juntos sin fila vacía. Redimensionar conserva página/tamaño; borrar el único registro de una página posterior regresa a la anterior.
- Carga inicial: Boneyard solo sobre contenido informativo. Refetch/mutación: preservar registros, progreso suave y controles deshabilitados, incluido un menú ya abierto. Error y vacío son estados diferentes; error con Alert/reintento y toast, vacío con mensaje y CTA apropiado.
- Registros protegidos: comprobar la clave/ID canónica en backend dentro de la transacción, omitir la acción prohibida en UI y evitar renombrados que eludan la protección. Un identificador reservado puede estar en solo lectura sin deshabilitar sus traducciones (`TranslationInput.keyReadOnly`).
- Menús destructivos: acción Eliminar con icono `DeleteOutlined` y `theme.palette.error.main`, confirmación traducida que identifique el registro y sus consecuencias. No ejecutar antes de confirmar. Ante error, conservar modal y selección para reintentar; éxito cierra y revalida datos y autorización afectados.
- Para recursos con activo/inactivo, iniciar mostrando activos cuando sea el contrato de producto. Filtro segmentado exclusivo Activos/Inactivos/Todos: selección persistente, Todos omite el predicado, cambio de estado reinicia página y conserva búsqueda. Los catálogos de opciones no se limitan silenciosamente al filtro de la vista.
- Negocios: conservar mapeos/instrucciones del proveedor, historial y variación del producto, archivo de factura y canales/horarios de contacto al pasar a tarjetas. Las comparaciones densas de importación pueden conservar tabla con scroll local en xs; adaptar sus paneles y barras de acciones. No generar consultas por tarjeta.
- Finanzas: elegir explícitamente los campos de cada recurso/resumen. Importes y saldos exactos usan campos de ancho completo (`fullWidth`) en tarjetas; no dividir una cifra larga entre columnas ni convertir strings bigint a Number. Los campos compactos pueden compartir fila. Tarjetas sin panel exterior duplicado; indicadores y formularios conservan su propio padding.
- QA de cada adaptación: 320/390 px, frontera 599/600 px y escritorio, ES/EN y claro/oscuro; nombres largos, filtros/paginado, cancelación, error/reintento y estado pendiente. Registrar evidencia sin atribuir a fixtures disponibilidad real ni aceptación en teléfono físico.

---

### 9.7 Modales, Filtros y Acciones en Pantallas Pequeñas

- **Navegación de secciones extensas**: si los tabs no dejan visibles las secciones a320px, ofrecer un `SelectSingleInput` compacto en xs con etiqueta traducida, todas las opciones y selección obligatoria. Conservar tabs desde sm, misma selección/ruta/filtros y un único panel montado. Referencia: PersonalFinance; no añadir padding exterior a la página hija.
- **ConfirmDialog**:
  - En móviles (`xs`), los botones de acción se ordenan en columna invertida (`flexDirection: "column-reverse"`): el botón de confirmación o acción destructiva se coloca arriba en ancho 100%, y el botón "Cancelar" abajo en ancho 100%, permitiendo interacción táctil inequívoca.
- **Filter**:
  - En `xs`, la barra de acciones del modal de filtros apila el botón "Limpiar filtros" abajo al 100%, y sitúa "Cancelar" y "Filtrar" arriba en una fila compartida (50% de ancho cada uno con `flex: 1`).
- **Barras de Herramientas (`TableTopBar`, `FilterBar`)**:
  - En `xs`, el buscador `InputSearch` ocupa el 100% del ancho superior.
  - El botón primario de acción ("+ Nuevo Usuario", "+ Nuevo Rol", etc.) se sitúa en la línea inferior ocupando el 100% del ancho (`width: "100%"`), sirviendo como un CTA prominente y fácil de presionar.
  - Los grupos de filtros segmentados (`ToggleButtonGroup`) se expanden al 100% con `flex: 1` para cada botón.

---

### 9.8 Master Prompt de Stitch AI para Pantallas Móviles (Mobile View)

Para generar vistas móviles de Nodia en Stitch AI, v0 o Galileo, utiliza el siguiente prompt especializado:

```text
Design a responsive MOBILE web application screen for the B2B SaaS platform "Nodia" in ultra-refined Dark Mode (Viewport width: 390px, iPhone / Android).
Background: pure black (#000000). Cards & surfaces: deep dark slate (#1a212b) with 1px border (#2a3441) and 12px border radius.
Color accents: Electric lavender/indigo (#818cf8) as primary, bright teal (#2dd4bf) as secondary, neon emerald (#4ade80) for active indicators.
Typography: "DM Sans", crisp hierarchy, mobile-scaled headings (H4 at 24px, body at 15px), buttons with textTransform: none.
Mobile Layout:
- Top bar (56px height, 16px horizontal padding): Outlined hamburger menu icon on the far left, compact language selector (ES/EN), theme toggle, and small circular user avatar on the far right. No persistent sidebar visible (it opens as a sliding modal drawer with dark backdrop blur).
- Screen content with 16px lateral padding.
- Page Header: Screen title (24px, font-weight 700), subtitle (15px, text.secondary), followed by a prominent full-width primary button ("+ New User" / "+ New Business") with rounded pill shape.
- Mobile filter bar: Full-width rounded search input with search icon, advanced filter trigger pill with badge, and equal-width segmented control pills (Active / Inactive / All).
- Content presentation: Single-column high-aesthetic stacked cards (each with status dot, title, metadata chips, 3-dot context menu) OR horizontal scrolling minimalist data table with transparent scrollbar and min-width 650px.
- Bottom actions: Large touch targets (minimum 44x44px), thumb-friendly layout, zero horizontal viewport overflow.
Maintain luxury enterprise SaaS finishing, generous readable spacing, high contrast, and zero clutter.
```

---
*Documento generado y mantenido para sincronización de diseño y generación asistida por IA en Nodia Client.*



### 9.9 Calendarios y campos temporales compartidos

- Fechas civiles: DateInput (YYYY-MM-DD o vacío según contrato), con ref, error/helperText y labels. Migrar explícitamente, no introducir nuevos TextInput type=date ni convertir a UTC una fecha civil.
- Horas locales de reservas: TimeInput (HH:mm), siempre explícitas por acuerdo. Instantes: DateTimeInput con timezone del recurso y conversión única/DST; no usar la zona del navegador como respaldo ni esconder borradores inválidos.
- LocalizationProvider y CSS variables pertenecen al MUIProvider único. No crear providers/themes por input. Calendario de estadías usa FullCalendar Standard/MUI; no añadir dependencia Pro/Premium incidentalmente.
- Fechas de entrada/salida son dos campos coordinados Community; checkout exclusivo. Crear cotización conserva borradores y no garantiza ocupación. El servidor/confirmación conserva disponibilidad, recambio y concurrencia.
- Mobile usa agenda y ficha inmediata, con período/selección preservados al redimensionar. Administración secundaria no elimina CRUD ni permisos. Usar los estados inicial/refetch/vacío/error establecidos.
- Decisión y evidencia: [ADR-025](../docs/architecture/decisions/ADR-025-reservation-calendar-date-inputs.md), [36](../docs/mvp/36-reservations-redesign-proposal.md).

### 9.10 País y prefijo telefónico compartidos

PhoneCountryInput reutiliza SelectSingleInput con búsqueda, nombres Intl.DisplayNames localizados y prefijos de libphonenumber-js, sin duplicar el catálogo entre Business y Reservas. Business conserva su colección y validación de teléfonos; normalizedPhone se comparte desde src/utils/phoneNumbers.ts. PhoneInput compone el selector con un campo tel, ref de RHF, error/helperText y bloqueo conjunto; dos columnas desde sm y una en xs.

En Reservas, Chile es la selección inicial igual que en Contactos de Business. Un teléfono internacional completo reconoce país y muestra número nacional; solo al modificarlo se normaliza a E.164. Borradores numéricos modificados inválidos impiden avanzar/enviar. El contrato guest_contact sigue siendo texto: datos históricos sin editar conservan su representación y contactos no telefónicos permanecen editables. País y borrador persisten entre pasos y rechazos, sin campos adicionales en HTTP ni cambios de Server/BD.

#### Alineación de fechas compuestas y formularios de reservas

DateTimeInput muestra una etiqueta común y controles con etiquetas visuales Fecha/Hora; los nombres accesibles completos y nombres de los pickers conservan el contexto. DateInput/TimeInput admiten displayLabel únicamente para separar presentación de ese nombre accesible. Fecha y hora comparten fila desde sm y se apilan en xs. En el acuerdo de Reserva, cada vencimiento y las notas ocupan todo el ancho; tarifa/limpieza y descuento/comisión forman pares, abono ocupa su propia fila. Evitar ubicar un control compuesto dentro de media columna junto a un input simple.

El DateCalendar de DateInput declara explícitamente views year/month/day y openTo day: año → mes → día, sin cerrar antes de la selección final. La configuración predeterminada MUI year/day no cumple esta navegación. El diálogo móvil lleva el nombre del campo en su paper con role=dialog.

### 9.11 Configuración y registros móviles de Reservas

Panel de casa elegido el2026-10-10: datos y sugerencias en paneles de lectura con editores por grupo, políticas de cancelación en tarjetas y archivo/reactivación separado al final. Una columna base y dos desde md. Política predeterminada identificada por ID, tramos ordenados sin modificar datos, importes exactos y ausencia explícita. Conservar selección fuera de la página actual, búsqueda/paginación del servidor, filtro vertical y permisos de propietario.

Preparación, Colaboradores, Bloqueos, Pagos, Gastos e Historial se incorporan a MobileRecordCard en xs; tablas650px desde sm. Campos definidos por recurso, sin generar tarjetas a partir de columnas. La extensión renderMobileRow de RentalTable entrega también las acciones del registro para compartir handlers. renderCardRow es optativa para políticas en ambos tamaños. Búsqueda, filtros y página tienen un solo estado; revalidaciones no desmontan editores ni información. Cabeceras/listados y acciones móviles de los formularios de Reservas usan controles de44px y acciones principales a ancho completo. Detalle y QA en36; teléfono físico pendiente.

### 9.12 Presentación del listado Teacher — 2026-11-04

La marca Nodia Teacher reutiliza Karmatic Arcade, ya cargada para el logo y NodiaAI: 34px desde sm y 24px en xs, tras el ajuste de tamaño solicitado. Comparte el degradado135deg primary→tertiary (secondary si el tema no tiene tertiary), recortado al texto y limitado al ancho de la marca. El título «Mis planes de estudio» conserva la tipografía del tema con peso700. Son estilos locales de Teacher, sin cambiar los títulos globales. [Verificación del tamaño](../docs/evidence/teacher-brand-size-20261104-r01.json).

El buscador ocupa100% en xs y50% desde sm600px; el ancho se calcula respecto del contenido disponible de la página, sin padding adicional ni breakpoint nuevo. Mostrar archivados se alinea a la derecha de esa misma fila desde sm y conserva su propia fila en xs, con body2 (14px) y área activa mínima44px. Un solo árbol CSS conserva búsqueda, archivo y paginado al redimensionar.

Abrir plan usa contained. Los chips usan peso700 y mantienen la etiqueta del estado real y el contraste de la paleta MUI: completed→success, active→info, paused→warning, archived→error y draft→default. El color no añade estados ni cambia el resultado académico. [Corte inicial del listado](../docs/evidence/teacher-list-ui-20261104-r01.json) y [ajuste de marca y filtro](../docs/evidence/teacher-brand-ui-20261104-r01.json).

El detalle usa SessionPage con gap8px tanto entre el enlace de retorno y el contenido como entre los grupos principales de la sesión. El listado conserva gap24px y el interior de los paneles mantiene sus espaciados. El título del plan usa peso700 y conserva24px en xs/34px desde sm. Marca y chips reutilizan las mismas definiciones del listado; Pausar y guardar usa contained y Actualizar estado incorpora RefreshOutlined mediante startIcon, conservando sus acciones existentes.

Anotación del2026-11-05: Actualizar estado también usa contained en JobPanel. Hereda los tokens MUI y Actions existentes (mínimo44px, ancho completo bajo sm600), sin otro breakpoint. R17 mostró177,47×44px en escritorio y244×44px a320px, documento310px sin desbordamiento; se restauró el viewport. El clic mantuvo Resultado guardado y contador2 sin solicitar generación. [Alcance visual33](../docs/mvp/96-nodia-teacher-implementation-plan.md#33-actualizar-estado-contained-y-explicación-del-flujo--2026-11-05).

Workspace alinea sus columnas al inicio con CSS Grid: Tu recorrido ocupa la altura de su contenido, sin copiar la altura de la evaluación. Conserva una columna hasta899px y las dos columnas existentes desde md900px; no usa alturas fijas ni observadores JavaScript. [Evidencia del detalle](../docs/evidence/teacher-detail-ui-20261104-r01.json).

Teacher precarga sólo la selección predeterminada explícita del Server para sesiones sin selección, conservando siempre la ya guardada. El panel de IA se colapsa tras confirmación y elegibilidad exacta; muestra un resumen envolvente y se abre ante cambios pendientes o fallos. Usa un solo acordeón/estado para todos los anchos y dos columnas de campos desde sm600px. Guardar selección y Enviar a Teacher usan contained. Si Archivar es la única opción, aparece directamente con confirmación; un error conserva el diálogo. En SessionForm, el padding de los campos multiline pertenece únicamente al contenedor InputBase y el textarea usa padding0, sin alterar TextInput global. [Reglas y QA](../docs/evidence/teacher-selection-qa-20261104-r01.json).

La alta Teacher usa /nodia-teacher/new con los mismos campos/validación de la edición, un solo formulario responsive y autoridad del módulo canónico. Crear plan envía creación+cola como intención única; Guardar borrador sigue disponible sin proveedor calificado. Los mensajes de definición usan borrador Server revisionado, guardado visible tras1500ms y pausa atómica. Un acuse tardío no reemplaza texto nuevo; error/conflicto conserva edición y bloquea sobrescritura automática. Una recarga pendiente recibe aviso nativo; no se guarda contenido en browserstorage. El PATCH de borrador revalida sólo la sesión para conservar foco y evitar N+1 de consultas. [Contrato del alcance](../docs/mvp/97-nodia-teacher-technical-contracts.md#borrador-de-definición-y-alta-desde-página--solicitud-del-2026-11-04).

Una renovación de sesión conserva el mismo árbol previamente validado para actor/sessionVersion, con `inert` y nuevas mutaciones bloqueadas. La restauración inicial no monta contenido privado; retirar la credencial, cambiar identidad/versión, logout o perder acceso al módulo descarta la vista anterior. No sustituir la vista por otro árbol durante `restoring` del mismo actor: se pierde el propietario de la operación en vuelo y el formulario. No conservar credenciales o payloads en una segunda capa para resolver esta continuidad.

Generar otra versión del material Teacher reutiliza el comando/CAS y ConfirmDialog. La apertura captura sesión/plan/unidad/material/revisión; un cambio de contexto descarta la apertura anterior, y el CAS no se rebasea antes del envío. Error mantiene el diálogo y recuperación GET; UNKNOWN bloquea confirmar sin mostrarse como loading permanente. Cancelar explícitamente conserva el owner/recibo original. El control usa44px mínimos en escritorio y ancho completo con48px mínimos en xs (<600px), conservando la composición de acciones; las versiones e intentos anteriores mantienen su identidad.

El panel de trabajo Teacher conserva una barra indeterminada por estado queued/running y un espacio de4px, sin montarla/desmontarla por cada GET del sondeo. Los datos previos y su estado permanecen ante error de revalidación, con aviso de última lectura y consulta manual; la carga inicial informativa utiliza Boneyard. Los errores muestran sólo textos traducidos de códigos conocidos y un genérico seguro para otros códigos, sin porcentajes, tiempos estimados o cuerpos de excepciones inventados.

Corte histórico R15: Definir tu plan explicó Guardar/Enviar/Proponer mediante una lista semántica: una columna de base y tres desde md900px. Conserva un formulario y el mismo borrador durante resize/refetch. Guardar mensaje usa contained; las tres acciones reutilizan ancho completo en xs y targets44px existentes. Un borrador guardado sin enviar muestra aviso y bloquea Proponer, sin autoenvío ni pérdida de texto. En320px se observó documento310px sin desbordamiento y botones244×44px; no equivale a prueba en teléfono físico. [Alcance y comprobación](../docs/mvp/96-nodia-teacher-implementation-plan.md#31-definición-clara-y-estado-de-preparación-estable--2026-11-05).

### 9.13 Tabla provisional de factura: menú y columnas opcionales — 2026-11-07

El importador manual agrupa vincular, editar y quitar fila en `InvoiceRowActions`, con un disparador de44×44px y nombre accesible por fila, `aria-haspopup`, estado expandido y relación con el menú. Reutiliza Menu/MenuItem de MUI, iconos y traducciones ES/EN; conserva navegación por teclado, cierre y retorno de foco del componente. Menú y acciones quedan deshabilitados durante análisis, reconsultas o guardado; el handler comprueba de nuevo el bloqueo antes de delegar. No se sustituyen los handlers ni se crean acciones de negocio nuevas. El menú puede envolver textos extensos y limita su ancho al viewport.

El icono +/− de44×44px junto a Precio Venta controla conjuntamente Cantidad de la factura y Disponibilidad, con etiqueta/tooltip traducidos y estado expandido. Las columnas comienzan ocultas y la publicación de una extracción las muestra si un producto nuevo requiere disponibilidad aún no asignada. Se ocultan sólo las celdas de presentación: valores, errores, identidad/version del destino y validación permanecen en el mismo estado local. Las celdas históricas aplican la misma condición; ocultar un requisito no hace válida la fila. No se introduce persistencia de esta preferencia ni un segundo formulario o consulta. Se retiran columna/control del candado; la propiedad histórica `isLocked` no habilita una nueva interacción.

La comparación permanece como tabla con scroll horizontal dentro de TableContainer también en móvil; no se transforma automáticamente en tarjetas. Ancho mínimo1000px con columnas esenciales y1200px con las adicionales, justificados por su contenido; no son breakpoints nuevos. Importes sin saltos y códigos/nombres con envoltura acotada. La región tiene nombre accesible y foco para operar el scroll; hereda del theme pista transparente, indicador sutil y flechas ocultas. El documento no debe desplazarse horizontalmente ni utilizar overflow oculto global para esconder un defecto.

Implementación local en seis entradas de producción:52regresiones/2archivos (33,52s), tipos y lint correctos. Build aislado R33→R34 y sucesor R34→R35 de una cabecera, con adopciones verificadas:185outputs actuales y assets de17versiones históricas porHTTP+SHA, miss404; dos activaciones/recargas Nginx (R34 y R35), sin reiniciar Server/Native. CUA escritorio/320/600 verifica geometría, menú, toggle y borrador en harness aislado con el componente R35 exacto y fixtures rotuladas sin red. La nueva QA real Gemini no produjo tabla:409health_status previo y otra intención504/240s; sin replay. No equivale a teléfono físico ni demuestra mejora de rendimiento. Ver [plan94§35](../docs/mvp/94-business-point-of-sale-and-product-refactor.md#tabla-provisional-compacta-y-acciones-por-fila--2026-11-07) y [evidencia](../docs/evidence/invoice-provisional-table-ui-20261107-r01.json). Cambio de presentación/interacción manual, sin modificar backend, proveedor/modelo, payload, validación, SQL o autenticación.

### 9.14 Calculadora local de precio compacta — 2026-11-07

ClientR36 activo en VM: calculadora compacta a la derecha del costo con impuestos desde sm600, porcentaje88px con%, importe visible e icono44px con tooltip «Usar precio sugerido». Un container query local de280px permite tres columnas (88+132+44+16); por debajo usa dos filas y conserva el importe entero. En xs el bloque va debajo del costo; no cambia el breakpoint global. Enter en el porcentaje evita enviar el formulario. Cambiar porcentaje/costo sólo actualiza la sugerencia; aplicar sólo cambia la venta del borrador.104pruebas/4archivos, tipos/lint/build aislado correctos. CUA autenticada1088/320px:30%→350,40%→377 con venta350 hasta aplicar, costos226/269 intactos y Cancelar/reabrir tras recarga recupera350/30%. Input/costo alineados, tooltip y targets44px comprobados; móvil sin overflow. Vista aislada600/320 verificó un importe1300000000 completo. No Guardar, mutaciones HTTP o inferencias; Server/Native/SQL/contratos/autoridad conservados. Una activación/recarga Nginx y185outputs actuales/18versiones históricas verificados. Sin publicación ni aprobación nueva. [Evidencia](../docs/evidence/product-price-suggestion-ui-20261107-r01.json). Verificación de componente/VM acotada; no equivale a teléfono físico ni a persistencia comercial.

La composición presenta porcentaje de88px con sufijo `%`, importe sugerido central e IconButton de44×44px para aplicar. El icono tiene nombre accesible y tooltip internacionalizado «Usar precio sugerido», también accesible por foco. Las traducciones ES/EN incluyen la etiqueta abreviada del incremento. El precio conserva su precisión y la distinción entre cero y ausencia; los textos y el importe deben ser legibles sin desbordar el contenedor. El editor de una fila de factura reutiliza el componente compacto en su ubicación existente, sin otra copia de lógica o estado.

El porcentaje permanece local y comienza en30%. Editar porcentaje o costo sólo recalcula la sugerencia; aplicar explícitamente cambia la venta del borrador y emite el toast existente. Enter en el input evita enviar el formulario y no aplica el importe. Los guards de costo/porcentaje inválidos, valores ausentes, cero, overflow y editor ocupado se conservan tanto en el input como en la acción. No se persiste el porcentaje ni se añade una petición, cálculo de utilidad o efecto automático sobre venta/costos.

ClientR37 activo en VM: etiquetas del porcentaje y precio sugerido alineadas, importe sin sufijo CLP y centrado en una fila mínima de40px. El importe sigue siendo un estado informativo, no un input editable. Conserva porcentaje88px, icono44px, container query280px y dos filas en móvil estrecho. Siete pruebas atómicas, tipos/lint globales y build aislado correctos (1400entradas,185outputs);185assets actuales y181anteriores verificados. CUA autenticada1088px: diferencia vertical de etiquetas0,125px y de centros del input/importe0,0625px. A320×892px, documento320/320px sin desbordamiento y modal288px; composición de dos filas intencional. Cambiar40→30% conservó venta350; después se canceló el modal sin Aplicar ni Guardar y el producto mantuvo350. Ajuste visual de dos fuentes: la operación estática no reinició Server/Native ni accedió directamente aDB/SQL. La QA visual usó lecturas autenticadas del backend, sin realizar inferencias. La etiqueta conserva la misma tipografía que TextInput y el importe ocupa la segunda fila del grid con alineación central; no se imita un campo editable. [Evidencia R37](../docs/evidence/product-price-result-alignment-20261107-r01.json). No certifica teléfono físico ni persistencia comercial.

## 10. Rendimiento y estabilidad en móvil y escritorio

Pautas de proceso solicitadas el2026-10-10 tras informes autenticados de Inicio. [Plan37](../docs/mvp/37-web-performance-implementation-plan.md) aprobado explícitamente e implementación por etapas en curso;10.5–10.7 registran los patrones ya verificados. Conservar theme, contratos y decisiones aprobadas; una mejora local no certifica aceptación productiva de todo el plan.

### 10.1 Medición comparable por ruta

- Medir build productivo, perfil sin extensiones y sesión válida cuando corresponda. Registrar versión, build/estado del checkout, ruta final, viewport, perfil, dataset y caché; tres ejecuciones secuenciales por móvil/desktop, con mediana. No mezclar navegación fría, restauración de sesión y navegación posterior.
- Verificar que se mide la pantalla objetivo, no Login, un fallo HTTP o un vacío ajeno al escenario. Una captura redimensionada no prueba teléfono físico, teclado virtual o INP real.
- Separar código de Nodia, terceros y extensiones. Una oportunidad de minificación/CSS/cobertura en una extensión no autoriza cambiar Vite o borrar estilos. Estimación de ahorro, peso emitido y bytes transferidos son datos distintos.
- Adoptar las metas por ruta del plan37 durante su implementación; verificar LCP/FCP/TBT/CLS y experiencia de interacción, no únicamente el score. TBT no reemplaza INP y laboratorio no acredita Core Web Vitals de campo.

### 10.2 Carga necesaria y composición del producto

- La tarea principal visible debe cargar primero; en Reservas es la agenda/calendario aprobada. Formularios y paneles secundarios pueden cargarse por intención con error/reintento accesible, sin duplicar providers o retrasar la primera interacción injustificadamente.
- Cargar SDKs de terceros en los flujos que los utilizan. GoogleOAuthProvider pertenece a Login y se monta antes de GoogleLogin, solo con client ID configurado; App no lo monta. Conservar login/refresh/logout, locale y recuperación del SDK. Referencia verificada en10.5.
- Compartir contratos/datos entre móvil y escritorio y montar una representación pertinente; ocultar dos árboles por CSS no evita sus hooks ni descargas. No montar dos formularios activos o consultas por tarjeta/fila.
- Refactorizar imports/barrels únicamente con evidencia del grafo de paquetes. Mantener React/Vite/MUI/Emotion y los wrappers existentes; no reemplazar el calendario, instalar otro framework o subir el umbral de warnings como arreglo de rendimiento.
- Precarga selectiva por intención y fuentes críticas solo cuando la medición demuestra beneficio. Conservar fuentes/acentos/logo; no cargar todos los pesos/familias ni introducir fuentes ficticias.

### 10.3 Estabilidad y accesibilidad durante la carga

- Reservar dimensiones del contenido y medios que las trazas señalen como causa de saltos. Skeleton inicial debe aproximar su contenido; refetch conserva vista y estado, con carga suave. No fijar alturas que corten traducciones ni ocultar desbordes globalmente.
- Avisos, cabeceras y navegación fija deben convivir con safe area y último control. Corregir posición/composición si causan CLS; no quitar Sileo, controles, feedback o datos para elevar la puntuación.
- Semántica independiente del aspecto: listas con hijos válidos, jerarquía de encabezados coherente, nombre accesible que incluya el texto visible, foco visible y retorno de foco. Mantener ES/EN, teclado, zoom y targets44px.
- Cambiar breakpoint no borra filtros, selección, paginado, borrador o errores. Un refetch/chunk fallido no desmonta el editor; un fallo de mutación conserva modal y datos conforme a las reglas actuales.

### 10.4 Verificar, documentar y preservar funcionalidad

- Cada optimización: baseline→cambio acotado→pruebas de comportamiento→medición comparable→decisión de conservar/revertir. Evitar memoización/virtualización o cambios de caché por intuición; ubicar primero long tasks/renders/consultas.
- En una misma máquina, separar auditorías y suites completas de compilaciones pesadas. Si una espera de importación falla bajo carga, registrar el fallo y repetir aislado antes de atribuirlo a una regresión; conservar tests y límites de espera mientras se investiga.
- Nunca omitir validación de sesión/permisos, mantener autorización obsoleta, eliminar validaciones, reintentar escrituras inciertas o suprimir errores para ganar métricas. La caché productiva distingue assets con hash, HTML y datos privados.
- QA según alcance:320/390/599/600/900/1200/1440px, ambos temas/idiomas, teclado, carga/refetch/vacío/error, chunk fallido y primera interacción. Conservar tablas/tarjetas, filtros verticales y espaciados ya definidos.
- Al cerrar cada etapa, actualizar esta pauta con solución final, componentes de referencia, tests/evidencia y límites móvil/desktop; AGENTS conserva el índice y las obligaciones. Registrar también resultados sin mejora y pendientes, sin marcar propuestas como implementadas o aprobadas.

### 10.5 Patrones verificados — Google y semántica (2026-10-10)

- **Botón GIS y tema (2026-10-11):** [Login](src/modules/auth/pages/Login/Login.tsx) usa variante oficial `filled_black` en oscuro y `outline` en claro. [GoogleSignInContainer](src/modules/auth/pages/Login/styles.ts) aplica `color-scheme: light` solo al iframe GIS: evita el canvas blanco que Chromium pinta cuando el esquema heredado oscuro difiere del documento transparente externo. No modificar el contenido del iframe, recortarlo ni ocultar su foco. Cambio de tema no remonta el provider ni pierde el intercambio pendiente. Padding de página16/24/32px y tarjeta24px en xs/40px desde sm conserva espacio para el botón. SDK/iframe reales ES/EN, claro/oscuro y320/599/600/1280px comprobados;58 regresiones de auth/guards/sesión, build/tipado/lint correctos. No se ejecutó login ni se intercambiaron credenciales durante este QA; otros motores/cuenta personalizada siguen pendientes. [Opciones oficiales](https://developers.google.com/identity/gsi/web/reference/js-reference#theme).

- **SDK acotado:** referencia [Login](src/modules/auth/pages/Login/Login.tsx) y [App](src/App.tsx). Key del provider por idioma/intento para el SDK instalado; el estado de intercambio de credencial queda fuera de esa frontera. Error traducido + toast único + reintento,44px y ancho completo en xs. Sin client ID no solicitar GIS; al volver a Inicio limpiar el script. `googleLogout` sigue disponible en infraestructura compartida: no confundir su pequeño módulo con una descarga externa GIS.
- **Pruebas del acceso:** [Login.test](src/test/modules/auth/pages/Login/Login.test.tsx) usa el provider real y credenciales/transporte sintéticos; [App.test](src/test/App.test.tsx) recorre Inicio→Login→Inicio→Login y comprueba la frontera del script. Conservar tests existentes de auth/session/guards/Topbar, sin eximir restauración o permisos por rendimiento.
- **Listas semánticas:** [Sidenav](src/layouts/components/Sidenav/Sidenav.tsx) agrupa con ListItem/li y mantiene sublistas ul/li; verificar hijos válidos con módulos asignados, drawer móvil y navegación/colapsado. No cambiar ul por div para esconder el audit. [Pruebas](src/test/layouts/components/Sidenav/Sidenav.test.tsx).
- **Nombre accesible incluye texto visible:** [LanguageSelector](src/components/LanguageSelector/LanguageSelector.tsx) usa `layout:toggle_language_label` interpolando ES/EN y aria-expanded. [Pruebas con traducciones reales](src/test/components/LanguageSelector/LanguageSelector.test.tsx): ambos idiomas, menú/selección, Enter/Escape y retorno de foco. Mantener aspecto/tokens.
- **Jerarquía sin rediseño:** vacío de [Home](src/modules/home/pages/Home/Home.tsx) usa `component="h2"`/`variant="h6"`, conservando estilo y contenido. No saltar niveles por elegir un tamaño tipográfico.
- **Revertir por evidencia:** el experimento de separar health IA mantuvo contratos y pasó pruebas, pero no redujo transferencia y empeoró el perfil móvil; retirado. Zod también valida preferencias móviles. Compartir una dependencia con otra función puede impedir el ahorro; revisar todo el grafo antes de diferir o retirar una validación.
- **Alcance comprobado:** [evidencia](../docs/evidence/web-performance/stages-google-accessibility-2026-10-10.json), tres ejecuciones limpias por móvil/desktop/fase. Inicio sin sesión:70→77 móvil,96→98 desktop, A11y98→100 y ~103KB menos scripts. Inicio con sesión real conserva accesos/GIS ausente, QA320/1440px ES/EN claro/oscuro sin overflow. Lighthouse autenticado posterior, metas móviles, CLS de restauración, otras rutas, teléfono físico e INP/campo siguen pendientes; no sustituirlos por estos scores públicos.

### 10.6 Patrón verificado — editor secundario por intención (2026-10-10)

- **Descarga al pulsar:** [MobileBottomNav](src/layouts/components/MobileBottomNav/MobileBottomNav.tsx) mantiene la navegación disponible y carga MobileShortcutDialog mediante [loadShortcutDialog](src/layouts/components/MobileBottomNav/loadShortcutDialog.ts) al solicitar edición. Imports de props son exclusivamente tipados; BaseModal y el editor quedan fuera del grafo estático inicial. No precargar al montar ni sustituir BaseModal por otro modal.
- **Recuperación local:** [useShortcutDialog](src/layouts/components/MobileBottomNav/hooks/useShortcutDialog.ts) muestra estado traducido y loading/disabled en controles de edición durante la descarga, sin skeletons ni un diálogo vacío. Fallo: alert y un toast traducidos, botones habilitados y reintento al pulsar el acceso. Compartir importación satisfactoria; liberar la promesa rechazada. No usar la recarga automática de lazyRoute para este editor: borradores de la página deben permanecer intactos. Reintentar no garantiza recuperar un asset eliminado del servidor; conservar assets con hash durante despliegues según10.4/WP-06.
- **Solicitud vinculada al contexto:** ignorar resolución tardía tras cambiar identidad, versión de sesión, navegación o desmontar la barra. Revalidar sesión antes de abrir y conservar autorización/persistencia estrictas al guardar. El componente cargado puede reutilizarse; selección/búsqueda pertenecen a la instancia del formulario, con key por persona/sesión/espacio.
- **Foco y formulario:** conservar foco dentro de BaseModal y devolverlo al botón iniciador al cerrar o fallar la carga. Una descarga pendiente no bloquea ni borra otros inputs de la página. Error de escritura mantiene editor y selección, conforme al flujo existente.
- **Pruebas:** [ShortcutLoading](src/test/layouts/components/MobileBottomNav/ShortcutLoading.test.tsx) verifica ES/EN, fallo/reintento, borrador ajeno intacto, loading y Escape/Enter/foco; [useShortcutDialog.test](src/test/layouts/components/MobileBottomNav/useShortcutDialog.test.tsx) cubre concurrencia, reutilización y resoluciones tardías. Tests existentes mantienen preferencias, permisos, duplicados, error de almacenamiento y teclado virtual. Suite1153/184 archivos, focal252/36, typecheck/lint/build correctos.
- **Resultado y límites:** [evidencia con hashes](../docs/evidence/web-performance/stage-shortcut-editor-2026-10-10.json),18 auditorías limpias de Inicio **sin sesión**: móvil77→78, desktop98→98, scripts442.300→427.280B (−15.020B/3,4%), A11y100. Sesión real en5174: editor ausente de inventario inicial y observado tras intención, búsqueda/selección390→320px y foco conservados; QA320/390/599/600/900/1200/1440, ES oscuro/EN claro, sin overflow. Inventario de recursos no equivale a transferencia ni timing. La observación de primera apertura local incluye automatización; falta comparación bajo throttling. Meta90 móvil, presupuesto400KiB, Lighthouse privado posterior, teléfono físico e INP siguen pendientes. No extrapolar la mejora de Inicio a Reservas ni cambiar i18n antes de reconciliar ADR-002.


### 10.7 Patrón verificado — catálogo administrativo separado del runtime (2026-10-10)

- **Límite comprobado:** [moduleIcons](src/store/generalSettings/moduleIcons.tsx) conserva el registro completo y los resolutores usados por Inicio/Sidenav/barra móvil. [iconCatalog](src/store/generalSettings/iconCatalog.ts) contiene las etiquetas, categorías y palabras de búsqueda de las 91 opciones de IconSelect. El selector lo importa directamente; no reexportar ese catálogo por el barrel compartido de generalSettings ni importarlo desde navegación. La ruta de Módulos ya es lazy: no agregar otro loader o estado asíncrono al selector.
- **Compatibilidad:** conservar claves persistidas, orden, componentes MUI originales, iconos configurados y resolución histórica/automática. No copiar SVGs del paquete, reducir opciones ni sustituir iconos por un fallback para ganar puntuación. Comparación AST de las 91 definiciones y código de registro/resolutores confirma equivalencia; pruebas existentes cubren búsqueda, selección, limpieza, teclado y formularios de módulos/grupos.
- **Ahorro comprobado de build:** grafo estático inicial de 1.281.694 a 1.268.698 B; gzip calculado con Node de 406.461 a 402.991 B (−12.996 B raw / −3.470 B gzip). El catálogo queda en Modules, fuera del grafo inicial. Sumar todos los imports estáticos transitivos, no solo el entry; ese gzip calculado excluye rutas dinámicas y cabeceras HTTP y no equivale a transferencia medida.
- **Sesión real y límites:** Inicio autenticado carga el entry nuevo sin el asset Modules; selector administrativo y búsqueda IA/Usuarios/automático verificados en escritorio y 320 px, cancelando sin guardar. Viewport y URL de Reservas restaurados. Tipado/lint y 72 pruebas focalizadas/10 archivos correctos; suite completa1153/184 archivos y build final correctos; hashes de assets iniciales coinciden con el grafo analizado. Referencia autenticada recibida: móvil69, LCP4,387s, TBT341ms, A11y100, scripts427.280B, una ejecución Lighthouse13.4.1 con interferencia de extensiones. Medición posterior autenticada, mediana limpia, móvil90/400KiB y aceptación productiva pendientes; no atribuir un score al cambio por el ahorro de build. [Evidencia agregada](../docs/evidence/web-performance/stage-shared-icons-2026-10-10.json).


### 10.8 Contención del compositor de NodiaAI (2026-10-18)

En un chat de altura limitada, el formulario debe admitir contracción y minHeight0, con un scroll propio y acciones alcanzables; la cabecera no se comprime. El panel secundario de adjuntos comparte ese scroll en lugar de introducir otro anidado. En xs el workspace crece con el contenido, sin maxHeight heredado. No ocultar desbordamientos con overflowhidden ni remontar borradores al cambiar anchos. [R05](../docs/mvp/78-nodia-ai-ai32-attachments-voice.md#revalidación-ai-32-r05--r2-micrófono-y-contención-del-compositor) verifica tres borradores en320/599/600/900/1440px y Enviar alcanzable; geometría de navegador, sin afirmar teléfono/teclado virtual o mejora de performance. Cargar historial se bloquea durante grabación para evitar descartar la captura por un refetch iniciado por ese control.

### 10.9 Organización y paneles persistentes de NodiaAI (2026-10-18)

Los filtros de historial y la operación de metadatos pertenecen a la página, por encima del sidebar/drawer responsive. Un cambio de breakpoint no remonta el formulario ni pierde búsqueda/borrador. Los editores secundarios se montan tras intención y permanecen ocultos al colapsar; sus queries/polling se suspenden y revalidan al abrir. No desmontar un editor con mutación en vuelo o resultado incierto. Usar keys con prefijo por tipo de panel: preferencias y configuración son hermanos y no pueden compartir sólo el chatId.

Un rechazo explícito401/403/404/410 retira contenido privado y cancela lectores; un500 conserva contenido previo/borrador y error visible. El reintento recupera detalle e historial juntos. Al anteponer historia, restaurar scrollTop por diferencia de scrollHeight y desactivar overflow-anchor para evitar doble salto; no mover al final a quien lee mensajes antiguos. [AI-35](../docs/mvp/81-nodia-ai-ai35-conversation-organization.md) y [QA](../docs/evidence/nodia-ai-ai35-browser-qa.json) verifican320/390/599/600/900/1440, ES/EN claro/oscuro con datos sintéticos; no acreditan teléfono físico, teclado virtual ni métricas de campo.


### 10.10 Chat conversacional y compositor compacto (2026-10-28)

- Un único compositor y borrador por chat; archivos elegidos/pegados y voz reutilizan validación, upload, revisión y recuperación existentes. El editor de adjuntos sigue cargándose por intención, con reintento local sin recarga. Política de adjuntos se consulta al montar el compositor; no consume inferencia.
- Micrófono y envío tienen áreas de 44px. En xs, acciones de cabecera por icono con nombre accesible, selección en dos columnas y sin duplicar el árbol; Contexto no muestra tokens/porcentajes sin datos. Los márgenes de mensajes conservan usuario a la derecha y asistente a la izquierda también dentro del wrapper de Boneyard.
- Selección temporal aislada por conversación y aplicada explícitamente; el historial conserva su run original. Cambios de ancho/contexto y errores no sustituyen el borrador. Nuevas conversaciones toman sólo el predeterminado real de Server.
- [Evidencia](../docs/evidence/nodia-ai-chat-redesign-verification-20261028-r01.json): Chromium sintético, diez anchos 320–1440, ES/EN y claro/oscuro; sin overflow, conservación al redimensionar y controles medidos. No acredita teléfono físico/teclado virtual, micrófono real, Safari, inferencia ni mejora de rendimiento; no hay comparación de performance por este rediseño.


#### Ajuste del compositor R02 (2026-10-28)

Contexto y el acceso duplicado a configuración se retiran; preferencias guardadas pasan al menú dentro de la tarjeta de conversación (botones hermanos). Elegir/pegar/grabar adjunta automáticamente en cola serial, sin reintentos inciertos ni inferencia. Miniaturas con blob URL liberada, papelera44px y revisión de contenido plegada bajo intención; un borrador sucio conserva el editor. El compositor limita altura y la revisión desplaza localmente para no sacar envío/selectores del viewport móvil. [Verificación R02](../docs/evidence/nodia-ai-chat-refinement-verification-20261028-r02.json) sustituye esas decisiones visuales de R01; no afirma performance/aceptación física.

#### Estabilidad y actividad R03 (2026-10-29)

La revalidación periódica no debe añadir altura a la cabecera: el indicador se superpone al borde y el turno activo usa un globo temporal con pasos públicos. `RunActivity` conserva la lista al actualizar eventos y se retira al finalizar; los resultados y propuestas de `ExecutionObservation` permanecen, junto con las guardas de error/recuperación. No presentar razonamiento interno o un inicio de herramienta que el servidor no publica.

El avatar propio comparte `image_url` y fallback de inicial con Topbar. `ChatComposer` usa44px para micrófono/envío y8px entre ambos, sin padding duplicado en textarea. Enter envía, Shift+Enter agrega línea y composición IME/repetición no disparan envío; una admisión incierta se recupera sólo con acción explícita. El menú `+` conserva foco/Escape y ofrece adjuntar archivos sin abrir el selector antes de elegir la opción.

[Verificación R03](../docs/evidence/nodia-ai-chat-feedback-20261029-r01.json): Edge/Chromium sintético320/390/599/600/900/1569px, temas e idiomas alternados, gap8px y cabecera97px antes/durante/después de refetch; borrador conservado al redimensionar y control Detener alcanzable en390px. Son comprobaciones de geometría/interacción, no mediciones de rendimiento, proveedor real o teclado virtual físico.

#### Título editable R04 (2026-10-29)

`ConversationTitle` conserva revisión al abrir y borrador durante refetch/error/resize. La rebase exige revisión explícita de la misma conversación, sin perder texto; readonly revocado retira el editor y descarta resultados tardíos. Aceptar/cancelar son IconButtons44px; Enter/Escape respetan IME/repetición y el foco vuelve al lápiz al cerrar. El título largo usa elipsis y tooltip sin desplazar el control. [Verificación](../docs/evidence/nodia-ai-chat-title-20261029-r01.json): Edge sintético320/390/600/1088/1569px y ocho unidades; no acredita teléfono/teclado virtual ni actualización real de datos en VM.


#### Dictado y reproducción R07 (2026-10-29)

El micrófono principal dicta texto revisable mediante la API del navegador elegida expresamente, que puede procesar voz remotamente. Esta decisión sustituye la salida a archivo del micrófono descrita en R02/R03: no crea adjunto ni autoenvía. El texto base y el último resultado aceptado se conservan; no se repiten hipótesis, se respeta el límite UTF-8 y cada inicio exige intención. Stop libera los tracks propios, espera el resultado final hasta5s locales y vuelve al editor; navegación/error descarta callbacks tardíos sin atribuir cancelación remota.

`VoiceActivity` usa muestras reales de un AnalyserNode, sin salida a altavoces, con canvas44px, máximo32barras/512muestras,30fps (8fps con movimiento reducido), DPR≤2 y ancho interno≤2048px. No inventar actividad ni confianza/progreso; cleanup desconecta nodos, RAF, observers y AudioContext. El stream pertenece al hook y sus tracks se liberan allí. AudioPreview reproduce sólo blobs disponibles/autorizados, sin autoplay ni fetch propio; pausar/retirar fuente/revocar URL al cambiar de blob o ámbito.

[Verificación R07](../docs/evidence/nodia-ai-voice-dictation-20261029-r01.json):2166pruebas/263archivos y tipos/lint/build correctos; geometría320/390/600/1088/1569px ES/EN oscuro/claro con señal Web Audio y reconocimiento simulado, sin overflow horizontal, targets44px y gap8px. Client estático adoptado en VM con runtime protegido conservado. Los ensayos reales del reconocedor no produjeron texto (Edge network, Chrome no-speech); no acreditan habla/micrófono físicos, Safari o disponibilidad de ASR. No se presenta como optimización de rendimiento ni aceptación física.


Observación responsive R07: con320px y un borrador de225caracteres, durante la escucha los selectores deshabilitados pueden extenderse61px fuera del formulario/52px fuera de la tarjeta. Micrófono/Stop, texto y envío permanecen visibles; al terminar recuperan su disposición, con0px de recorte medido en idle/afterStop. Este detalle visual sigue pendiente de refinamiento; no se presenta la QA como aceptación de todo dispositivo.


#### Presentación Markdown y recarga R08 (2026-10-29)

Patrón implementado, comprobado en navegador sintético y adoptado estáticamente en VM R08: sólo `kind: text` visible del asistente usa MessageMarkdown (`react-markdown`10.1.0 + `remark-gfm`4.0.1) y agrupa partes consecutivas compatibles; usuario, revisión textual de adjuntos y restringidos siguen literales. HTML permanece texto escapado/literal sin DOM ejecutable, sin `rehypeRaw` y sin perder la respuesta tras un bloque HTML. No cargar imágenes remotas de Markdown/HTML. Enlaces sólo absolutos http/https/mailto por intención, con noopener/noreferrer; no rutas privadas/relativas o protocolos arbitrarios.

Tablas y bloques de código anchos usan regiones con scroll local, nombre traducido, foco/teclado y scrollbars transparentes conforme al theme; el documento no debe desbordarse horizontalmente. El icono de recarga de la alerta ocupa44px en action a la derecha/alineado arriba, con Tooltip y aria-label existentes, texto envolvente y mismo handler/bloqueos. No añade altura periódica, desmonta contenido ni inicia inferencia. [Recibo R08](../docs/evidence/nodia-ai-chat-markdown-20261029-r01.json): Client2187/264, tipos/lint/build y diez muestras320/390/600/1088/1569px ESoscuro/ENclaro verifican geometría, teclado, contenido/DOM conservados y cero recursos remotos/POST/captura. Historial autenticado confirma presentación de una propuesta existente sin ejecutarla. El recibo distingue los avisos de consola dev, incremento de bytes del chat y dispositivo físico no comprobado. No atribuir performance o aceptación física a pruebas unitarias.

#### Propuestas compactas y etiquetas históricas R38 — 2026-11-07

Client R38 está adoptado en la VM: cabecera compacta de propuesta con icono, estado, revisión y fechas; control outlined de 44 px y detalles técnicos plegables con identidad/hash/catálogo exactos. Antes/Después usa dos columnas desde un contenedor de 560 px y se apila por debajo; la ausencia ocupa menos espacio sin perder el valor presente ni confundir null, cero, false, strings o IDs. Confirmar/guardar es contained y editar/cerrar outlined. Se conserva el borrador visitado al plegar y se bloquea el plegado durante fetch de propuesta/revisión o incertidumbre humana. El estado de propuesta confirmada acredita admisión, no efecto aplicado; otros resultados de herramientas/ejecuciones conservan su presentación. Las cinco preparaciones históricas de ventas sólo reciben etiquetas de lectura, sin registro, preparación o ejecución nuevos.

La comparación responde al ancho real del contenedor mediante container query de 560 px; no agrega un breakpoint global. La ausencia compacta conserva cada lado presente. La cabecera y el icono de expansión tienen nombre/estado accesibles y objetivo mínimo de 44 px; el control ocupa el ancho disponible en móvil. Detalles técnicos nativos se pueden abrir por teclado, sin truncar el hash completo. Los paneles visitados permanecen montados y ocultos al plegar; una lectura de propuesta/revisión o mutación/resultado humano incierto bloquea el plegado. Es una representación de la proyección autorizada existente, sin nuevas consultas por etiqueta o permisos derivados de la apariencia.

Pasaron 218 regresiones en 4 archivos (los 9 casos del helper están incluidos), tipos/lint globales y build aislado de 1401 entradas/185 outputs. Los últimos ajustes sólo visuales posteriores a esa corrida se revisaron sin cambio de lógica; tipos/lint finales cubren los pins finales, sin afirmar otro rerun de las 218 pruebas. QA sintética ES/EN y claro/oscuro verificó comparación, borrador, teclado y valores; QA autenticada de una propuesta expirada verificó sólo lectura, hash completo y plegado. A 320 px, documento de 310 px, región de 212 px sin desbordamiento y control de 212×44 px. La operación estática hizo una activación/recarga Nginx, verificó 185 outputs y assets de 20 versiones anteriores, miss404 y API200/401; no reinició Server/Native ni emitió SQL o solicitudes de proveedor. Las lecturas autenticadas del navegador son un alcance separado. No hubo mensajes IA, confirmaciones o mutaciones comerciales en esa QA; pestaña/borrador originales intactos. El arnés aislado se cerró y su PID/listener se comprobaron ausentes. Las muestras no equivalen a teléfono físico o mejora medida de rendimiento, ni prueban confirmación comercial. [Manual visual](../docs/features/nodia-ai/proposal-review-presentation.md) y [evidencia](../docs/evidence/nodia-ai-proposal-ui-20261107-r01.json).

### 10.11 Catálogo y controles del punto de venta (2026-10-29)

Los apartados base y R13 conservan sus cortes históricos. La composición vigente desde R14 se describe al final: sólo partidas seleccionadas y búsqueda desplegable, sin listado exterior del catálogo.

El POS comparte una consulta infinita entre el selector con imágenes y el listado. Solicita páginas de 24 productos con filtros del servidor, orden estable y búsqueda con debounce; deduplica por ID, descarta contextos anteriores y conserva los datos durante una nueva petición. El listado y el menú tienen scroll local y `overflow-anchor: none`: en Edge, una sola llegada al fondo cargaba todas las páginas con el anclaje predeterminado; la variante final conserva `scrollTop` y carga una página adicional. El botón Cargar más ofrece una alternativa al observador. No descargar todo el catálogo para simular búsqueda o scroll.

Catálogo y carrito conservan un único estado al cambiar de panel móvil, redimensionar o colapsar la cabecera del negocio. El foco del lector se solicita al entrar, agregar/leer un producto e iniciar otra venta; las consultas del catálogo no deshabilitan ese lector independiente. Los controles de pago llevan icono y texto, estado seleccionado accesible y altura mínima de 84px. Nueva venta y Confirmar venta usan 56px; las reglas de acciones móviles sólo aplican el mínimo de 44px a botones que no sean `sizeLarge`, para no reducir las acciones principales. Confirmar ocupa todo el ancho.

Ver [plan94 R12](../docs/mvp/94-business-point-of-sale-and-product-refactor.md#21-ajustes-del-pos-y-checkout-atómico-r12--2026-10-29) y [evidencia](../docs/evidence/business-pos-accessibility-20261029-r01.json). Comprobaciones de geometría y estado en navegador de escritorio a 320/390/600/1569px con datos sintéticos; no acreditan lector/teléfono físico ni rendimiento productivo. La atomicidad del checkout requiere su prueba SQL separada.

#### Varias ventas locales y geometría R13

Un único motor de workspace/useSyncExternalStore conserva los carritos por ID estable y comparte catálogo/consulta; cambiar pestaña no monta otro POS. El snapshot sessionStorage versionado por actor/negocio guarda todos los carritos e identidades pendientes con una escritura antes del transporte. Un storage inválido o fallido bloquea el envío. Migración legacy write-before-remove, cleanup de identidad y respuestas ligadas al carrito originario conservan recuperación sin replay. La numeración visible no es identidad comercial; cerrar el último carrito repone Venta1/siguiente2. Cero partidas permite X directa aunque queden datos residuales; una intención pendiente sigue bloqueada.

Para que flex produzca scroll local, acotar el panel contenedor: `height: clamp(620px, calc(100dvh - 220px), 1040px)` y catálogo interior `flex: 1 1 auto`/`min-height: 0`. Con viewport de1000px de alto se observó panel780px y lista local392–431px. Conservar overflow-anchor none y scrollbars transparentes. El sentinela del observador usa `height: "1px"`, evitando una altura porcentual que deja una cola vacía; la QA320/600px comprobó HTML/body de1815/2170px con diferencia0 tras corregirlo. Los controles de cantidad tienen contenedor `position: relative`, +/−56×56px e input56px; se verificó hit-test real de las acciones, además de sus rectángulos.

Fotos80px y precio por flag con normal debajo, sin code/barcode en catálogo/carrito principales ni comparación de importes. El indicador de oferta tiene contraste observado5.29:1 claro/13.01:1 oscuro; no comunica rebaja calculada. Total usa label24/28px e importe36/48px, preservando enteros CLP exactos sin overflow. Nueva selección manual muestra cuatro medios84px; other histórico/backend/recuperación sigue válido. La leyenda informativa se retira visualmente conservando su semántica, y New/Confirm mantienen56px.

[Plan94 R13](../docs/mvp/94-business-point-of-sale-and-product-refactor.md#22-varias-ventas-locales-y-presentación-del-pos-r13--2026-10-29) y [recibo](../docs/evidence/business-pos-multi-sale-20261029-r01.json): suite Client2305/277 y, tras los dos últimos ajustes visuales,80focales/10archivos, lint global y build R02 con TypeScript correctos. QA sintética8perfiles320/390/600/1569px ESoscuro/ENclaro,0overflow, recarga/aislamiento/cantidades y recuperación503 por1GET sin replay; tres POST sólomock. R01 quedó privado sin activar por el hallazgo de cola; R02 activo/verificado, inspección autenticada final R02 verificada. UI autenticada real R02 verifica autofocus y dos GETbarcode/cantidad2, dos ventas locales con medio/barcode aislados/restaurados y pestañas2400/1200, Total28px/Confirm56px, cuatro medios/códigos ocultos/imagen cargada. Sin pulsar Confirmar venta o HTTP comercial/inferencia; trabajo del usuario intacto. No es evidencia de pago, lector/teléfono físico, velocidad o rendimiento productivo. R12 no entiende el snapshot multicarrito: después del uso, revisar carritos/pendientes y recuperar sus identidades antes de volver a una UI vieja; el kit de rollback se comprobó sólo antes del uso.

#### Lista de compra, popup y editor manual R14 — 2026-10-30

La izquierda tiene sólo SaleLineList con partidas seleccionadas/imagen/precio/cantidad; el selector y barcode agregan productos sin catálogo/listado exterior o filas a0. La derecha contiene Total→cuatro medios84px→Confirmar56px, sin duplicar líneas. Los dos paneles comparten `clamp(620px, calc(100dvh - 220px), 1040px)`, observados780px con viewport1000px de alto. Cabecera inicialmente colapsada, tabs y motor/snapshot montados; móvil conserva un estado. CSS de paneles queda acotado al POS, sin aplicar alturas o min-height globales a listas de opciones, slots o controles.

El popup infinito conserva el mismo UL durante append: guardar scrollTop/contexto/conteo, restaurar en layout y una RAF, cancelar al cerrar/deshabilitar/desmontar o cambiar actor/sesión/negocio/modo/búsqueda cruda. Query/page locks separan búsquedas y descartan callbacks obsoletos. Mientras responde, input readonly y opciones/indicadores bloqueados conservan foco/popup; no deshabilitar el input ya enfocado al iniciar nueva búsqueda. QA verificó24→48, scrollTop2187→2187 y mismo UL, sin tercera página o warnings. No usar sólo overflow-anchor como prueba de retención MUI.

useSaleLineImages trata imágenes como metadatos, sin repriciar carritos: cache30s por actor/sessionVersion/negocio/producto, seeds de productos ya consultados y sólo IDs seleccionados faltantes en lotes100 (hasta2 para200partidas). La fixture de recarga recuperó19IDs con1GET y los seeds evitaron GET extra. No serializar URLs firmadas como precio/snapshot ni transformar una imagen ausente en permiso para vender.

Listado de productos: miniatura50px abre el visor existente, fallback accesible y nombre sin barcode añadido. La oferta habilitada/real se muestra antes del normal con error.main,20px/700;0 válido y alternativo mayor no implican descuento. Contraste observado sobre blanco3.763:1: válido para texto grande3:1, sin afirmar4.5:1 para ese color. El coste inverso es asistencia UI de alta/edición explícita y preserva margen/tasa; validación de overflow bloquea Guardar. Default disponible sólo en alta manual, null/false históricos y CSV/OCR intactos; no normalizar ejemplos CSV de impuesto como si ya fueran coste con IVA.

[Plan94 R14](../docs/mvp/94-business-point-of-sale-and-product-refactor.md#23-lista-de-compra-y-edición-manual-r14--2026-10-30) y [recibo](../docs/evidence/business-pos-purchase-list-20261030-r01.json): suite2354/282 en234.37s, tipos/lint/build final correctos,14focales posteriores al último ajuste de oferta/props. QA8perfiles320/390/600/1569 ESoscuro/ENclaro:20partidas izquierda/0derecha, cinco botones de resumen, Total primero,0overflow o cola HTML/body, miniatura/visor, oferta0/mayor/apagada/ausente y formulario directo/inverso/Cancelar0writes. Dos carritos/recarga,400 conserva modal y503mock→1GETreceipt cierra sólo originario sin replay; dos POST sólomock. Entrega estática activa/verificada b67a244a… y runtime protegido intacto; UI autenticada real verificada a1270×720:header colapsado/lector enfocado,2GETbarcode→una partida/cantidad2/3032CLP,imagen80,paneles620/620,derecha sin inputs/nombre de producto y5botones,Total28/48,0overflow. Qty0+X vacío reiniciaVenta1;thumbreal50/visor sin cambios/formularioDisponible/1516→1166/980 yCancelar sin Save. Sin mutación comercial o inferencia; oferta roja activa sólofixture. Carrito propio retirado/pestaña12 cerrada/usuario intacto. El primer build/captura anterior a fixes no produjo paquete/VM. Son pruebas de geometría/estado, no velocidad, rendimiento productivo, hardware o pago.


#### Filtros, tablas y entrada de productos R15 — 2026-10-30

[Plan94, sección24](../docs/mvp/94-business-point-of-sale-and-product-refactor.md#24-filtros-tablas-y-entrada-de-productos--r15-2026-10-30): Ventas usa el Filter común con estado comercial/período en columna, chips aplicados debajo y búsqueda InputSearch en TableTopBar fuera del contenedor de tabla. Tabla/paginado comparten un panel8px; sólo TableContainer desplaza horizontalmente y xs conserva MobileRecordCard. Aplicar/cancelar/limpiar y buscar conservan sus contratos con consulta paginada del servidor; estado omitido no significa Todos. No hay título repetido ni crear venta en ese tab.

Reportes agrupa período/orden en Filter; cards independientes preservan moneda y aproximación del ratio («Promedio por venta»). El título/hint del ranking queda fuera del panel8px, cuya primera fila visible es la cabecera primary. Mantener top10 explícito, sin paginación ficticia. Esquema y medidas siguen en Server; fechas civiles inclusivas en Santiago, sin truncar dinero o inventar cero para desconocido.

Barcode va primero y recibe foco una vez por apertura del producto, incluso si debe esperar un bloqueo inicial. La espera no re-enfoca tras refetch. Enter conserva la edición sin guardar; el foco/resto del formulario no depende del ancho. El vacío de las partidas usa flex en el espacio restante, título20px/ayuda16px centrados y wrapping sin desbordamiento. El breadcrumb/colapso de Negocios no agrega marginBottom.

[Recibo R15](../docs/evidence/business-sales-reports-ui-20261030-r01.json): suite2386/288 en210.80s,12Reportes finales6.30s tras correcciones de props MUI y3vacío finales3.80s. Tipos/lint/build0, build12.25s con warning previo del chunk api>500kB; no afirmar build sin warnings ni mejora de rendimiento. QA8perfiles320/390/600/1569 ESoscuro/ENclaro,24vistas,0overflow, radio8px, centro≤0.008 y título20/ayuda16. Ventas usa páginas25+19 del servidor; Reportes conserva cuatro MUIcards y top10 sin paginación o total inventados. Aplicar/cancelar/limpiar, errores y barcode verificados en fixtures. La tabla histórica de Productos mantiene13columnas/oferta estrecha: no se observó nueva quiebra ni se acepta su legibilidad global por este cambio.

Entrega activa70914765…ddf3,173estáticos/169assets actuales/47previos,42paths/1251inputs/FPR74316213…a171 y runtime protegido idéntico,sinSQLdirecto/Serverrestart/migración/inferencia. UI autenticada real IAB1280×720 ESoscuro:Ventas2filas/6064CLP;Reportes2ventas/4unidades/promedio≈3032/ranking1,4cards221.5px/tabla8px/0overflow y breadcrumb marginBottom0. Vacío centradoY0/X0.0078 en región285.44px/título20/ayuda16. TablaProductos8filas/radio8;barcode primero582px/autofocus/0000123456789+Enter conserva modal sin errores oSave,Cancelar deja8productos. Filtros reales abiertos/cancelados sinApply. Sin Save/Confirm/imagen/inferencia;pestaña propia4cerrada y tres pestañas del usuario intactas. No acredita checkout comercial, hardware, performance, aprobación documental o publicación nueva.


#### Negocios móvil R16 — 2026-10-30

Patrón verificado por [Plan94 §25](../docs/mvp/94-business-point-of-sale-and-product-refactor.md#25-adaptación-móvil-de-negocios--r16-2026-10-30): xs usa tarjetas/selector de sección, tablas desde600 conservan scroll local y paginado externo. Mantener una sola consulta/estado y revisar las transiciones tras asentarse las media queries; screenshots de carga/HMR no acreditan el layout final. Nombres largos envuelven, moneda conserva tokens y etiquetas de oferta pueden envolver antes del importe.

BaseModal/ConfirmDialog en xs: margen16px, max-height100dvh−32px, X44px y acciones44px; información extensa del producto/factura va en el contenido desplazable para conservar las acciones en paisaje y texto200%. Filter/chips/paginado xs comparten blancos44px. Conservar las reglas propias del calendario; sus días históricos no se acreditan44px.

El POS compacto retira clamp/minHeight de escritorio sólo en xs y paisaje corto. Pago y Productos mantienen ambos paneles en el mismo workspace; volver a Productos enfoca y centra el lector, sin nuevos listeners o reservas de dock. El popup acota su altura a min(400px,(100svh−88px)/2), medido dentro390×430. Cantidades56, pagos84 y Confirm56; desktop conserva624px a600×844 y780px a1569×1000.

[ReciboR16](../docs/evidence/business-mobile-20261030-r01.json):2389/288, tipos/lint/build correctos;40vistas Negocios,24Sales/Reports y10perfilesPOS; UI autenticada390×844 verificada sin mutación. Conserva estado/consultas/contratos, no afirma rendimiento o aceptación física.

#### Escala de lista y ticket80mm R20 — 2026-10-30

La escala80–200 del listado POS afecta texto e imágenes, sin modificar datos o comandos. Imagen y placeholder comparten80px al100% y160px al200%, con object-fit contain. La fila se redistribuye según el espacio real para no superponer nombre, precio o controles. El contador usa un ancho visual próximo a5ch, sin maxlength ni reducción del rango/tres decimales. Error rojo y aria-invalid se conservan al retirar la ayuda larga; review y −/+ tienen hover, foco2px y área44px. Mantener el mismo input al redimensionar.

El ticket usa una vista previa local y un documento de impresión aislado, sin estilos globales de la app. Papel80mm con padding4mm, blanco/negro, fuentes locales y texto escapado. @page size:auto deja el tamaño físico al controlador; no usar la declaración inválida80mm auto. Confirmar e imprimir espera la Sale confirmada y utiliza snapshots, mientras reimprimir revalida por GET el estado/negocio/ID. Un fallo de impresión conserva la venta y no repite checkout. afterprint también puede significar cierre de vista previa; no mostrar éxito físico.

ConfirmDialog permite acciones adicionales opcionales. Sólo la variante con esas acciones amplía X y botones a44px en todos los anchos; en xs las tres acciones usan ancho completo. QA sintética320/390/600/1569 ESoscuro/ENclaro al200% sin overflow/colisiones y con el mismo input; diálogo de confirmación en cuatro anchos, PDF real de su HTML80.09×89.24mm de una página inspeccionado. [EvidenciaR20](../docs/evidence/business-pos-ticket-20261030-r01.json):2450pruebas/293archivos, tipos/lint correctos. No afirma mejora de rendimiento, diálogo nativo aceptado o impresión física.

#### Filas de ventas abiertas y acciones guardadas R21 — 2026-10-30

OpenSaleTabs usa flex-wrap con orden DOM y claves estables, sin convertir la lista en un scroll horizontal. Se conserva la navegación Home/End/Left/Right y el roving tabIndex al cruzar filas; el resize no reconstruye los carritos. QA de14ventas en320/390/600/1569 mantiene14nodos/IDs, importes y selección, con14/7/7/3filas y sin overflow de documento/tablist. El número de filas refleja el ancho disponible, no un límite de ventas.

Anular e Imprimir del panel guardado comparten altura44px y ancho equivalente; en xs cada uno ocupa su fila. Acotar la regla padre a button:not(.MuiButton-sizeLarge): un minHeight44 en el padre sobre todos los botones tiene mayor especificidad que el sx minHeight56 de Confirmar y lo reduce indebidamente. QA final confirma Cancel/Print44 y Confirmar56. Se retira la consulta redundante de ese panel y el estado/modal sin caller; el detalle sigue en Ventas. No cambian datos, bloqueo ocupado, anulación humana o impresión. Ver [R21](../docs/evidence/business-pos-followup-20261030-r21.json); emulación no acredita hardware ni performance.


#### Vale y detalle opcional R22 — 2026-10-31

Un formato resumido reutiliza el mismo modelo validado y la misma plantilla de ticket; omite únicamente lines, sin recalcular importes ni ocultar texto con CSS. La elección local se captura por llamada antes de esperar checkout o GET. Mostrar detalle iniciaOFF en cada apertura; el error de checkout conserva la elección. Acciones guardadas: Anular+Vale equivalentes y Ticket de ancho completo debajo; en xs cada acción44px usa toda su fila. Mantener la excepción sizeLarge para Confirmar56 y no duplicar último recibo si ya es la venta mostrada.

Un grid que contiene papel80mm puede desbordar por min-content aun con overflow documental0. Declarar gridTemplateColumns:minmax(0,1fr) y minWidth0 en ese contenedor. Verificar límites de contenido, descendientes y rangos de texto visibles, además de scrollWidth; no usar overflow:hidden para esconder un recorte. El input transparente interno de MUI Switch puede exceder su raíz58px si ésta lo recorta intencionalmente, sin afectar texto o interacción visibles. QA final320/390ON/OFF: papel256px a320 y302.36px a390, dentro del contenido; mismo nodo, foco de teclado y filaSwitch48px. ESoscuro/ENclaro320/390/600/1569 correctos. [R22](../docs/evidence/business-pos-receipt-detail-20261030-r22.json) conserva el hallazgo inicial y la corrección; no afirma performance, teléfono o impresora físicos.

#### Acciones del último recibo R23 — 2026-10-31

En un aviso con dos acciones de impresión relacionadas, usar dos columnas minmax(0,1fr) desde sm y una columna en xs. Mantener gap8px, ancho completo y targets44px; el mensaje del Alert puede envolver sin invadir las acciones. Conservar los mismos botones y handlers al redimensionar. [R23](../docs/evidence/business-pos-receipt-actions-row-20261031-r23.json) registra geometría/teclado y los checks por alcance; no cambia el panel de venta guardada ni el transporte de impresión.

### 10.12 Sesión Codex consultada por intención — 2026-11-01

Al mostrar el detalle Agentic de una conexión OpenAI, consultar la sesión actual sin abrir ni iniciar login. Cabecera y panel comparten `useCodexSessionObservation` y la clave por conexión; API key y detalles ocultos no activan esa lectura. La consulta propaga AbortSignal, no hace polling, reintentos automáticos ni refetch por foco/reconexión; conserva la frontera de caché de 30 segundos del Server y retira la caché sin observadores. Un cambio de conexión cancela la lectura anterior y su resultado tardío no sustituye el detalle nuevo.

La autenticación y el descubrimiento de modelos comparten el lease exclusivo del perfil Native: terminar la lectura de cuenta antes de habilitar modelos, e invalidar modelos sin refetch antes de refrescar sesión. No lanzar ambas observaciones en paralelo ni convertir la contención propia en una cuenta desconectada. `codexSessionState` distingue conectado, desconectado, ocupado, desconocido y no disponible; una observación explícita prevalece sobre health sin fecha, y sólo un health fechado posterior puede reemplazarla. Auth positiva no acredita inferencia ni elimina una cuota observada. Verificar relee sesión; conectar/desconectar siguen siendo acciones explícitas. Un fallo de revalidación conserva los datos y muestra error con retry local; usar carga suave y mantener controles bloqueados durante la petición. Las acciones del error envuelven y ocupan todo el ancho en xs.

Verificación local: 64 pruebas focales en cuatro archivos, tipos y lint correctos, con transporte sintético. Cubren caché compartida, ausencia de consultas ocultas, cancelación, precedencia temporal, errores y orden de acceso al perfil. El Client R02 adoptado se comprobó visualmente en la VM con la sesión Nodia existente: cuenta conectada, consulta fechada, Desconectar y Actualizar modelos habilitados, selección persistida conservada y estado de inferencia «Sin verificar». El aviso agregado obsoleto ya no aparece. La inspección no inició login ni inferencia adicional; no acredita rendimiento, geometría móvil ni todos los estados de error en VM. [Evaluación de impacto y límites](../docs/mvp/ai-provider-feature-contract.md#sesión-codex-en-el-detalle-agentic--corrección-de-implementación-2026-11-01).

### 10.13 Invalidación por recurso durante el estudio en Teacher — 2026-11-03

Una mutación frecuente debe revalidar las autoridades que modifica: guardar el cursor refresca la sesión; guardar un borrador, el intento y sus preguntas; enviar una respuesta o recibir su feedback, la sesión, el intento y sus preguntas. No invalidar todo Teacher para esas acciones: los observadores montados también pueden pertenecer al material oculto, mensajes o un trabajo terminal. Conservar la frontera de usuario/sesión autenticada, la lectura explícita para recuperar un resultado incierto, el error visible y los reintentos manuales. Otros comandos, incluidos pausa y reanudación, mantienen su invalidación completa. Un resultado del mismo intento conserva la pregunta seleccionada; un intento nuevo puede abrir su primera pregunta.

Comparación de la ruta autenticada en la VM, Client R03→R04: antes se observaron HTTP 429 en material, trabajo READY, pregunta e intento tras responder y avanzar. Con R04, cuatro transiciones Q5→Q2→Q3→Q4→Q5 emitieron cada una un GET de la pregunta nueva, un PATCH del cursor y un GET de la sesión, todos HTTP 200; no consultaron material, trabajo READY ni intento. Se conservaron Q5, su feedback 6/6 y la práctica 14/14. Es una muestra de interacción de escritorio; no garantiza ausencia universal de HTTP 429 ni acredita rendimiento móvil. No se alteraron límites del Server, autenticación, modelos ni reintentos.

Verificación local: 33 pruebas Teacher en diez archivos, tipos/lint y build aislado correctos. Los observadores reales de TanStack Query con transporte sintético verifican uno/dos/tres GET activos para cursor/borrador/envío o feedback y el aislamiento de otros recursos/actores. Las pruebas atómicas cubren conservar la pregunta del mismo intento y abrir un intento distinto; la llegada de nuevo feedback con esa pregunta enfocada requiere su comprobación integrada específica. [Evidencia del recorrido y sus límites](../docs/evidence/teacher-v1-vm-process-20261103-r01.json).

### 10.14 Refuerzo focal y destino confirmado en Teacher — 2026-11-03

Los objetivos y unidades recomendados proceden de la evaluación corregida y su plan congelado. Mostrar puntos por recuperar sin inventar un umbral de dominio por objetivo. Consultar el material real y confirmar el cursor antes de abandonar el resultado; abrir una unidad sin material sólo muestra su disponibilidad. Prepararlo requiere otra acción explícita. Los destinos históricos son descriptivos y los fallos o cambios de contexto conservan el resultado; una escritura incierta usa la recuperación existente sin replay.

Verificación autenticada R05: la final mantuvo 20/40 y recomendó únicamente Registros, con 0/20, hacia la unidad 2. Abrirla emitió GET unidad → PATCH cursor → GET sesión → GET unidad, todos HTTP 200; la última lectura fue revalidación del lector. Mostró material sin preparar, contador 8 y cero inferencias nuevas. Pausar y recargar conservaron ese destino, sin volver a la pregunta final. En viewport 390×844, botón y contenedor midieron 314 px y el documento 380 px, sin desbordamiento horizontal; después se restauró escritorio. Las 46 pruebas Teacher cubren además errores, históricos y contexto con datos sintéticos; esta muestra no acredita todos esos fallos en VM ni un teléfono físico. [Recibo de la comprobación focal](../ops/lab/artifacts/teacher-gemini-journey-20261103-r01/refuerzo-browser-verification.json).

### 10.15 Definición Teacher durante trabajos prolongados — 2026-11-05

Separar la petición HTTP de la preparación remota: active_jobs queued/running bloquea Enviar/Proponer/ajustar sin bloquear el borrador privado o Pausar. No usar unknown como bloqueo genérico: hay históricos cerrados. El terminal de JobPanel refresca la sesión una vez por job, sin otra inferencia ni desmontar el formulario. Los guards de handler acompañan al disabled; no sustituyen la deduplicación, autoridad y presupuesto del backend.

R16 se comprobó con un ajuste Codex real: durante la cola, input y Guardar disponibles, Enviar/Proponer bloqueados y Pausar disponible; texto confirmado conservado al terminar y recargar. A320×892, documento310px sin overflow y tres acciones244×44px, usando el mismo árbol y estilos responsive existentes, sin nuevos breakpoints. Las49regresiones Client consolidadas y37Server se distinguen de esta muestra VM; límites y recuperación HTTP en [96§32](../docs/mvp/96-nodia-teacher-implementation-plan.md#32-qa-final-solicitado-y-prevención-de-intenciones-superpuestas--2026-11-05).


### 10.16 Editor compartido y conversación de definición Teacher — 2026-11-05

Patrón adoptado en ClientR19/R20 y comprobado por CUA en escritorio1088×892 y ancho320px; evidencia en96§34. La captura real de audio no se probó. MessageComposer presenta el texto controlado por su propietario y comparte Enter/Shift+Enter/IME, micrófono, actividad y estilos de editor/botones. Sus slots antes del campo, al inicio de la barra y en el pie pertenecen al recurso. NodiaAI conserva en su wrapper las capacidades, adjuntos, validación/revisión de archivos y recuperación; Teacher usa el núcleo sin adjuntos ni dependencia del módulo NodiaAI. El dictado compartido mantiene dueño de captura/scope/generación, cleanup y rechazo de callbacks tardíos; no carga archivos ni consulta al proveedor.

Teacher reúne historial, editor y selección exacta en una composición. Teacher aparece a la izquierda con birrete y la persona a la derecha; la secuencia DOM sigue el orden cronológico. El historial tiene scroll local limitado, pista transparente, thumb6px y texto envolvente; el seguimiento automático del final se detiene cuando la persona lee mensajes anteriores. El editor reutiliza el InputBase con textarea padding0 y controles44px. La adaptación usa sm600px y tokens existentes; en xs la cabecera se envuelve y Proponer ocupa el ancho disponible. No se montan dos editores ni se pierde el borrador al cambiar de ancho. La selección del pie se envuelve y comunica ready/dirty al propietario, sin otro panel independiente en definición ni valores de proveedor inventados.

Guardar mensaje se sustituye como acción habitual por autoguardado1500ms y estado confirmado, con reintento local tras error. Se mantienen los límites Server4000UTF-16/8192UTF-8, el texto íntegro al corregir, el CAS y los errores/recuperación. El gate del borrador aplaza sus escrituras durante recording para no cancelar la captura por un autoguardado; al terminar vuelve a guardar el texto. El propietario no retroalimenta recording como disabled del editor: el núcleo bloquea campo/envío y mantiene Stop/Cancel por su estado propio; el footer y otras acciones sí reciben la restricción correspondiente. El soporte de voz real es explícito, y escribir sigue disponible si el navegador no lo ofrece.

Proponer está en la cabecera junto a información accesible sobre el flujo. Abre ConfirmDialog con snapshot de contexto y guard de confirmación; un cambio exige reabrir, y un fallo no descarta la intención. Confirmar propone, no acepta ni clausura la conversación: revisar/conversar/ajustar precede a aceptar el plan y las revisiones posteriores conservan historia. La prevención de intenciones durante queued/running y la consulta explícita de unknown mantienen10.15. Las suites atómicas del editor, hook de dictado, actividad y wrapper verifican teclado, límites, contexto y cleanup sintéticos; las medidas visuales del Client final, la adopción y el micrófono real requieren evidencia separada. [Contrato UI](../docs/mvp/97-nodia-teacher-technical-contracts.md#conversación-de-definición-y-editor-compartido--2026-11-05).

Verificación final10.16: textarea padding0; a320px documento310/scroll310, editor260 y Proponer244×44. Los colores propios usan getContrastText sobre el fondo elegido, igual que NodiaAI: en dark se observó blanco sobre rgb79,70,229 y6,288:1, corrigiendo el3,340:1 de R19. El deltaR20 es una propiedad, sin otra fuente NodiaAI cambiada.105regresiones focales previas, build/tipos/lint y comprobación visual separados; la reducción de un archivo NodiaAI y el totalJS+12256bytes de R19 no acreditan ahorro de ruta o latencia.

### 10.17 Estado del trabajo y persistencia dentro de la conversación Teacher — 2026-11-05

La definición compone el estado existente del trabajo bajo su cabecera, mediante chip y actualización GET compacta; retira en ese contexto el panel exterior «Trabajo de Teacher». No duplicar consulta/polling ni propietarios de READY/terminal. El chip deriva del Job confirmado y la barra indeterminada de queued/running; isFetching expresa sólo la consulta. Errores, último estado conocido, unknown y recuperación conservan acciones/guards, sin convertir Actualizar en generación o resetear el editor. Otros lectores del estudio conservan su panel.

«Define tu plan con Nodia Teacher» mantiene22px/700 y texto en capitalización normal, sin textTransform uppercase. «Implementar plan» es la etiqueta de la propuesta confirmada, no una aceptación automática. Continúan snapshot de contexto, confirmación, revisión/ajustes y aceptación separados. La cabecera conserva wrap en xs y el CTA usa ancho disponible; chip/control se envuelven con los tokens y sm600px existentes, sin un breakpoint nuevo ni padding de página adicional. Controles interactivos conservan44px y el estado no sustituye historial por skeleton durante refetch.

Cada burbuja role=user proveniente del GET de historial muestra un check success a la derecha de «Tú», con tooltip/nombre accesible «Mensaje guardado». Representa persistencia del mensaje propio: no leído, entrega al proveedor o respuesta. Nunca se añade por draft.status=saved ni a una respuesta Teacher. Se retira el caption normal de éxito bajo el editor, manteniendo pendiente/guardando y feedback de errores, reintento/conflicto. Autoguardado, límites, CAS, continuidad/foco y guard de recarga conservan10.16; no duplicar texto en browserstorage ni esconder una escritura incierta.

ClientR21 adoptado y verificado según la [evidencia](../docs/evidence/teacher-inline-status-20261105-r01.json):73pruebas focales, tipos/lint/build y CUA escritorio/320px. Las métricas y pruebas de10.16 mantienen su corte anterior; la comprobación actual se registra en96§35. No se afirma mejora de rendimiento, captura real de audio, nueva inferencia o cierre de V1. [Contrato UI vigente](../docs/mvp/97-nodia-teacher-technical-contracts.md#estado-integrado-y-mensajes-propios-guardados--2026-11-05).

Verificación10.17: ClientR21 conserva un único observador al alternar chat/estudio/revisión, probado mediante mountcount en la unidad compuesta mínima. El título22px/700 no fuerza mayúsculas; Refresh44px consulta sin generar; check success sólo user GET, con tooltip accesible, nunca por autoguardado o job ready. A320px documento310/scroll310 y CTA244×44. El estado/refresco mantiene el Chip durante revalidación; la captura con controles temporalmente disabled se distingue de la comprobación posterior enabled. Ver96§35 y la evidencia teacher-inline-status-20261105-r01.

Separación local de mensajes Teacher — 2026-11-05: el historial conserva el wrapper de Skeleton. Su gap exterior no separa los article interiores; usar el selector local article + article con marginTop theme.spacing(2), por la preferencia posterior vigente de16px, sin clases generadas/atributos de preview ni nuevos breakpoints. La preferencia de8px y su medición R22 se conservan como corte histórico. Sólo afecta el espacio entre filas adyacentes, manteniendo los gaps generales de paneles y el mismo árbol/estado. La comprobación de geometría en VM se registra en96§36 y teacher-message-gap-20261105-r01.

Comprobación del espaciado Teacher R22: hueco real entre filas y burbujas0→8px, marginTop8px en1088×892 y320×892. Documento móvil310/scroll310; viewport restaurado, borrador/contador conservados. Una fuente CSS, sin nuevo árbol/consulta/estado o breakpoint;17regresiones existentes, tipos/lint/build y geometría CUA correctos. Ver96§36 y teacher-message-gap-20261105-r01.

Preferencia vigente R23 — 2026-11-05:16px mediante theme.spacing(2), verificados por geometría de filas/burbujas en escritorio1088 y ancho320; los8px R22 anteriores son históricos. Sin cambios de DOM, estado, consultas, foco o breakpoints; documento móvil310/scroll310.17regresiones existentes, tipos/lint/build correctos; sin nuevas inferencias. Ver96§37 y teacher-message-gap16-20261105-r01.

Modelo/intensidad Teacher — 2026-11-05: el SelectionPanel presenta una opción agrupada sólo en gemini/agentic con provider_key real y al menos dos variantes observadas inequívocas. `modelOptions.ts` exige concordancia léxica entre etiqueta, sufijo del ID y preferencias existentes, sin interpretar esa organización como soporte/familia interna del proveedor. El valor de UI sigue siendo un ID real y la intensidad explícita resuelve a su variante real+esfuerzo; no se inventa ID base ni se modifica una selección al leerla. Históricos cruzados, datos ausentes o colisiones permanecen planos, igual que API/Codex. dirty/no-ready, elegibilidad y Aplicar/guardar conservan el gate de la combinación exacta; no se copia una prueba entre variantes. Reutiliza los selectores/tokens responsive existentes, sin nuevos breakpoints o catálogos estáticos. ClientR24 adoptado:28pruebas focales/2suites, tipos/lint/build y CUA escritorio/320px correctos en [96§38](../docs/mvp/96-nodia-teacher-implementation-plan.md#38-modelo-gemini-e-intensidad-separados-en-teacher--2026-11-05) y [evidencia](../docs/evidence/teacher-model-effort-20261105-r01.json). No cambia runtime/Server/SDK/DB/defaults ni acredita inferencia o ahorro de rendimiento.

CUA del selector R24 mostró una opción Gemini3.8Flash y tres intensidades. Low explícito quedó no calificado, sin aplicar, con Guardar/Implementar bloqueados; Cancelar restauró high y no se generó inferencia. Documento móvil310/scroll310 a320px y escritorio1078/scroll1078 a1088px, gap16px y borrador/contador conservados; viewport restaurado. Esta comprobación de presentación no califica otras variantes ni sustituye una prueba de inferencia.

Continuación local2026-11-14: compositor y configuración NodiaAI comparten con Teacher `src/utils/modelVariantOptions.ts`, con wrapper compatible en Teacher. La sincronización de proveedores agrupa también catálogo, contadores y roles; conserva todas las variantes activadas y el ID/esfuerzo efectivo independiente de OCR. Nuevos roles agrupados exigen esfuerzo explícito; la elegibilidad sigue ligada a la tupla exacta. Modal verificado con catálogo sintético en Chromium320/600/1280 sin overflow, selectores44px y borrador Medium/High conservado al redimensionar. No se modifican theme, breakpoints ni runtime; no acredita inferencia o ahorro. [Auditoría y regresiones](../docs/evidence/model-selector-residual-audit-20261114.md).

Alta Teacher2026-11-14: título primero y copy/ayudas base/contexto/objetivo en ES/EN; marca alta/listado usa ProductBrand dentro de Box, evitando estirar el gradiente en un Stack. Mis planes/Guardar borrador contained. Modelos observados por conexión preceden a elegibilidad; ésta permite editar razonamiento, mientras Crear espera la tupla final. Errores y selección incompleta no simulan carga perpetua. Comandos Teacher no revalidan masivamente el proveedor y el panel pausa observaciones/refresh durante generación o guardado. Menú lateral/móvil reutiliza activeNavigationItem por segmento/destino visible más específico, sin cambiar autoridad. Chromium sintético320/600/1280 comprobó campos/48px, acciones44px, marca y borrador sin overflow; doble clic creó un solo job sintético exacto. [96§43 y límites](../docs/mvp/96-nodia-teacher-implementation-plan.md#43-alta-de-estudio-razonamiento-recuperable-y-menú-persistente--2026-11-14). No implica inferencia real o ahorro de rendimiento.

### 10.18 Historial del lector y paneles adaptativos Teacher — 2026-11-11

El material entrega sus últimas40 interacciones de la versión actual en la misma lectura, mediante una consulta acotada. Los bloques filtran ese historial por versión/bloque y no abren una segunda cascada de evidencia ni sustituyen su contenido por Skeleton al revalidar. Un contrato histórico sin ese campo se presenta como desconocido. Los borradores y las intenciones diferidas se identifican por sesión/versión/bloque; volver al contexto recupera su borrador y una importación antigua no puede abrir otro contexto.

Los paneles secundarios conservan el editor al ocultarse. Ocultar devuelve el foco al disparador; reabrir conserva texto y selección. Si la consulta mantiene el input temporalmente deshabilitado, la restauración espera su habilitación y se cancela ante un contexto/foco nuevo. Pausa y archivo bloquean las escrituras, conservando la lectura de fuentes, hilos e inspecciones históricas. Los tipos/versiones desconocidos de actividades y gráficos conservan consigna/título y aviso accesible, sin ejecutar el payload ni ofrecer corrección.

Comparación de laboratorio del lector contra `ba8ebfa00b55f103465d0ab533a802152944d224`, mismo HTTP/JWT/SQL aislados y tres rondas alternadas por perfil: se descartó una variante con CLS0.1037 móvil/0.1269 escritorio causado por la cascada/Skeleton de bloques. El patrón final midió CLS0.0131/0.0058 frente a baseline0.0185/0.0088. Las funciones añadidas cuestan17,453bytes comprimidos adicionales; LCP4.236s/840ms frente a4.196s/812ms. No acredita mejora global de velocidad, cumplimiento del objetivo móvil de2.5s ni métricas productivas. La medición precede el último ajuste de caret y textos, que no intervienen en la ruta inicial colapsada. Véase [evidencia consolidada](../docs/evidence/teacher-upgrade-ui-qa-20261111-r02.json): perfiles,12muestras, método reproducible, límites, teclado/árbol accesible y comprobaciones320px ES/dark y1280px EN/light.
