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
