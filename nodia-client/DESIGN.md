# Nodia UI Design System & Mockup Guidelines (`DESIGN.md`)

> **Guía y especificación de diseño para herramientas de generación de interfaces y mockups con IA (Stitch AI, Galileo, v0, etc.).**
> Este documento define con precisión quirúrgica la identidad visual, los tokens de diseño, la estructura de layouts, los componentes y las micro-interacciones de la plataforma web **Nodia**.

---

## 1. Identidad Visual y Filosofía de Diseño

- **Plataforma**: Nodia — SaaS B2B empresarial y modular para gestión de negocios, colaboradores, productos y configuraciones generales.
- **Tono Visual**: Moderno, minimalista, de alta precisión técnica ("High-density Developer & Enterprise Tooling"). Sin estética genérica ("No AI slop"), tipografía cuidada, contrastes calibrados y micro-interacciones sutiles con retroalimentación visual inmediata.
- **Enfoque de Tema**: **Dual (Modo Oscuro dominante / Modo Claro accesible)**. Diseñado con prioridad estética para el modo oscuro con superficies profundas (`#000000` base, `#1a212b` superficies/tarjetas) y acentos en índigo/lavanda y verde/teal.

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
| HORIZONTAL SCROLL DATA TABLE (minWidth: 650px)              |
|   <--- Scrollable Table Area (overflowX: auto) --->         |
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
- **Uso**: Listado de negocios en `/business`.
- **Grilla Responsive**: `gridTemplateColumns: "repeat(1, 1fr)"` en `xs`, `repeat(2, 1fr)` en `sm`, `repeat(3, 1fr)` en `md`.
- **Estructura**:
  - **Header**: Nombre del negocio truncado (`text-overflow: ellipsis`) + Punto de estado (verde neón glowing para activo, rojo para inactivo) + Menú de 3 puntos (`MoreVertIcon`, touch target mínimo 44px).
  - **Body**: Descripción en 1 sola línea con elipsis y tooltip al posar el mouse + Chips temáticos (categorías / tags con colores sutiles).
  - **Footer**: Identificador / Fecha o conteo de colaboradores + Botón sutil de visualización/acceso.

### 6.3 Tablas de Datos (`Data Table`) y Reglas de Horizontal Scroll
- **Uso**: Módulos administrativos (`/settings/users`, `/settings/roles`, `/settings/actions`, `/settings/modules`, `/business/:id`).
- **Comportamiento Móvil Obligatorio**:
  - Las tablas **NUNCA deben aplastarse** ni reducir el ancho de sus columnas por debajo de su tamaño legible.
  - Toda tabla MUI (`Table`) debe tener forzado un `minWidth: 650px` (definido globalmente en `theme.components.MuiTable`).
  - El contenedor `TableContainer` debe tener `overflowX: "auto"` con scrollbar delgado y pista 100% transparente.
  - La fila dispone de hover sutil (`rgba(255, 255, 255, 0.04)`).
  - Columna de Estado con Chip de color (`Activo` en verde, `Inactivo` en rojo).
  - Columna de Acciones con botón `Copiar ID` y menú contextual de 3 puntos.

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
- **Gaps Verticales y Horizontales en Móvil**:
  - Vertical: `16px` a `24px` (`gap: 2` a `3`).
  - Horizontal: `12px` a `16px` (`gap: 1.5` a `2`).

---

### 9.5 Formularios e Inputs Móviles

- **Espaciado Vertical**: Entre campos de formulario contiguos se debe mantener una separación estándar de `16px` a `20px` (`gap: 2` a `2.5`).
- **Ancho Completo**: Todos los inputs (`TextInput`, `SelectSingleInput`, `SelectMultipleInput`, `TranslationInput`) deben configurarse con `fullWidth` dentro de sus contenedores móviles.
- **Teclado Virtual y Auto-Scroll**:
  - Los modales deben implementar `overflowY: "auto"` con scrollbar sutil sobre el cuerpo del modal para permitir desplazamiento fluido cuando el teclado virtual de iOS o Android cubra la mitad inferior de la pantalla.
  - El modal debe mantener márgenes de seguridad de al menos `16px` con los bordes de la pantalla (`calc(100vw - 32px)`).

---

### 9.6 Tablas de Datos en Mobile: Horizontal Scroll Obligatorio

- **Regla Inquebrantable**: Las tablas de datos administrativas de Nodia con múltiples columnas (ID, Nombre, Rol, Módulo, Acciones) **bajo ninguna circunstancia deben colapsar sus columnas ni truncar textos críticos** por falta de espacio horizontal.
- **Implementación Técnica**:
  - Toda tabla MUI (`Table`) debe declarar un ancho mínimo de al menos `650px` (`minWidth: 650`, configurado por defecto en `theme.components.MuiTable`).
  - El contenedor `TableContainer` debe disponer de `maxWidth: "100%"` y `overflowX: "auto"`.
  - Las barras de scroll horizontal deben aplicar la regla oficial de diseño: pista 100% transparente y thumb sutil redondeado de 6px.
- **Paginación Adaptable**: En móviles, la paginación (`TablePagination`) debe permitir salto de línea (`flexWrap: "wrap"`) sin romper la UI.

---

### 9.7 Modales, Filtros y Acciones en Pantallas Pequeñas

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

