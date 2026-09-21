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

| Nivel | Tamaño | Peso | Line-Height | Uso |
| :--- | :--- | :--- | :--- | :--- |
| `h1` | 48px - 96px | 300 / 400 | 1.16 | Titulares de aterrizaje y bienvenida |
| `h3` | 48px (3rem) | 700 | 1.2 | Bienvenida en Home con gradiente |
| `h4` | 34px (2.125rem) | 600 | 1.25 | Título de secciones principales (`Negocios`, `Usuarios`) |
| `h5` | 24px (1.5rem) | 600 | 1.3 | Títulos de grupos de módulos o secciones internas |
| `h6` | 20px (1.25rem) | 600 | 1.4 | Título de tarjetas (`BusinessCard`, `SettingsCard`) |
| `subtitle1` | 16px (1rem) | 400 | 1.5 | Subtítulos de cabecera que explican la pantalla |
| `body1` | 16px (1rem) | 400 | 1.5 | Texto general de lectura |
| `body2` | 14px (0.875rem) | 400 | 1.43 | Textos en tablas, chips, descripciones cortas |
| `button` | 14px (0.875rem) | 500 | 1.75 | Botones (con `textTransform: none` siempre) |
| `caption` | 12px (0.75rem) | 400 | 1.66 | Fechas, metadatos, contadores y badges |

---

## 4. Spacing, Bordes y Elevación

- **Base de Spacing**: Sistema modular basado en `8px` (`theme.spacing(n)`):
  - `spacing(1)` = `8px`
  - `spacing(2)` = `16px` (gap estándar de barras de herramientas)
  - `spacing(3)` = `24px` (padding interno de tarjetas y modales)
  - `spacing(4)` = `32px` (padding estándar de la vista / contenedor de pantalla)
  - `spacing(6)` = `48px` (separación entre secciones principales)
- **Border Radius**:
  - Inputs, botones y chips: `8px` a `10px`
  - Tarjetas (`BusinessCard`, `SettingsCard`): `12px` a `16px`
  - Modales: `16px`
  - Contenedor de ícono en tarjetas (`CardIconWrapper`): `12px`
- **Elevación / Sombras**:
  - `Shadow 1`: `0 2px 8px rgba(0, 0, 0, 0.4)` (cards estáticas dark)
  - `Shadow Hover`: `0 8px 24px -4px rgba(129, 140, 248, 0.35)` + `translateY(-4px)`
  - `Borders`: `1px solid rgba(255, 255, 255, 0.12)` (dark) o `rgba(0, 0, 0, 0.10)` (light)

---

## 5. Arquitectura del Shell / Layout Principal

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

1. **Sidenav**:
   - Ancho expandido: `272px` | Colapsado: `88px`.
   - Logotipo centrado arriba con `Karmatic Arcade` a 48px y gradiente de marca.
   - Ítems de navegación con íconos Outlined (24px) alineados a la izquierda.
   - Grupos colapsables con flecha rotatoria `KeyboardArrowDownIcon`.
   - Estado seleccionado: Fondo translúcido `rgba(129, 140, 248, 0.16)` con texto en `primary.main`.
2. **Topbar**:
   - Altura: `64px`, alineado a la derecha, sin sombras pesadas.
   - Selectores: Selector de idioma (`ES / EN`), Selector de tema (`Sol / Luna`), Avatar circular con menú de usuario y cierre de sesión.
3. **Área Principal**:
   - `padding: 32px` constante.
   - Cabecera con título principal y botón CTA alineado a la derecha (`+ Nuevo ...`).
   - Barra de filtros: Buscador con debounce (`InputSearch`) + Botón de filtro modal (`Filter`) con badge contador + Switcher/Toggle de estados (`Activos / Inactivos / Todos`).

---

## 6. Especificación de Componentes Core

### 6.1 Tarjeta de Módulo / Dashboard (`SettingsCard`)
- **Uso**: Pantalla Home / Lanzador de aplicaciones.
- **Estructura**:
  - `CardIconWrapper`: Cuadro de `44x44px`, border-radius de `12px`, fondo translúcido `rgba(129, 140, 248, 0.14)` y color de ícono `#818cf8`.
  - `CardTitle`: Título en `1.25rem` (h6), font-weight 600, color `#818cf8`.
  - `CardDescription`: Texto en `0.875rem` (body2), color `#cccccc`, línea de altura 1.5 (se omite limpiamente si no hay descripción).
- **Hover**: Eleva `-4px`, genera borde `#818cf8` y el contenedor del ícono se convierte en `#818cf8` sólido con el ícono en blanco.

### 6.2 Tarjeta de Negocio (`BusinessCard`)
- **Uso**: Listado de negocios en `/business`.
- **Estructura**:
  - **Header**: Nombre del negocio truncado (`text-overflow: ellipsis`) + Punto de estado (verde neón glowing para activo, rojo para inactivo) + Menú de 3 puntos (`MoreVertIcon`, visible para el propietario).
  - **Body**: Descripción en 1 sola línea con elipsis y tooltip al posar el mouse + Chips temáticos (categorías / tags con colores sutiles).
  - **Footer**: Identificador / Fecha o conteo de colaboradores + Botón sutil de visualización/acceso.

### 6.3 Tablas y Vistas en Perspectiva (Perspective Switcher)
- **Uso**: Módulos administrativos (`/settings/actions`, `/settings/modules`).
- **Selector de Perspectiva**: `ToggleButtonGroup` moderno con 3 opciones:
  - *Split View*: Dos tablas divididas en 50/50 en pantallas de escritorio.
  - *Solo Primario*: Ocupa el 100% de la pantalla para el recurso principal.
  - *Solo Secundario*: Ocupa el 100% para grupos o acciones de negocio.
- **Filas de Tabla**:
  - Fila con hover sutil (`rgba(255, 255, 255, 0.04)`).
  - Columna de Estado con Chip de color (`Activo` en verde, `Inactivo` en rojo).
  - Columna de Acciones con botón `Copiar ID` (icono clipboard con toast Sileo) y menú contextual de 3 puntos.

### 6.4 Estados de Carga, Vacío y Error
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

---

## 8. Master Prompts para Stitch AI

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
*Documento generado y mantenido para sincronización de diseño y generación asistida por IA en Nodia Client.*
