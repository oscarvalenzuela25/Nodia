# Stack Frontend — Nodia Parte 1

> Estado: en revisión
> Última actualización: 2026-08-22
> Dependencias: 07-design-constraints.md aprobado

## Objetivo

Definir las dependencias base del frontend, la estructura del proyecto y los Design Tokens (Tema de MUI) derivados del diseño provisto, para asegurar una implementación estándar y consistente.

## 1. Dependencias Base (existentes en `nodia-client`)

- **Core:** React 19, Vite, TypeScript
- **UI & Estilos:** Material UI (MUI v9), Emotion
- **Enrutamiento:** React Router (v8)
- **Estado Global:** Zustand
- **Manejo de Datos Asíncronos:** TanStack React Query (v5), Axios
- **Internacionalización:** i18next (configurado base)
- **Autenticación (Nueva):** `@react-oauth/google` (se deberá agregar para resolver el login con Google en el frontend).

## 2. Configuración del Tema MUI (Design Tokens)

Se adaptaron los tokens de Tailwind provistos por el usuario para integrarse nativamente al sistema de temas de Material UI (`createTheme`), soportando modo claro y oscuro, e incorporando la fuente `Inter`.

### Código Base del Tema (`src/theme/theme.ts`)

```typescript
import { createTheme, ThemeOptions } from '@mui/material/styles';

const typography = {
  fontFamily: '"Inter", "ui-sans-serif", "sans-serif", system-ui',
};

const shape = {
  borderRadius: 8, // Basado en --radius: 0.5rem (1rem = 16px)
};

### Código Base del Tema (Design Tokens Extendidos)

Para no perder los tokens propios de Tailwind (`--popover`, `--muted`, `--ring`, `--chart-*`), extendimos las definiciones de TypeScript de Material UI en `src/theme/palette.tsx`:

```typescript
declare module "@mui/material/styles" {
  interface Palette {
    popover: Palette["primary"];
    muted: Palette["primary"];
    accent: Palette["primary"];
    destructive: Palette["primary"];
    input: string;
    ring: string;
    chart: { 1: string; 2: string; 3: string; 4: string; 5: string; };
  }
  interface PaletteOptions {
    popover?: PaletteOptions["primary"];
    muted?: PaletteOptions["primary"];
    accent?: PaletteOptions["primary"];
    destructive?: PaletteOptions["primary"];
    input?: string;
    ring?: string;
    chart?: { 1: string; 2: string; 3: string; 4: string; 5: string; };
  }
}
```

Estos tokens fueron inyectados directamente tanto a `lightPalette` como `darkPalette` con los códigos de color exactos suministrados.

export const lightTheme = createTheme(lightThemeOptions);
export const darkTheme = createTheme(darkThemeOptions);
```

### Notas sobre la Tipografía
Para que la fuente seleccionada se aplique en el proyecto, será necesario reemplazar `@fontsource/roboto` por **Inter** en el `package.json` (`npm uninstall @fontsource/roboto && npm install @fontsource/inter`) y actualizar los imports globales en React.

## 3. Estructura de Carpetas Propuesta

Se propone seguir una arquitectura orientada a características (*Feature-based architecture*) para `nodia-client/src`:

```
src/
├── assets/         # Imágenes, iconos
├── components/     # Componentes compartidos (Button, Modales genéricos, Layouts)
├── features/       # Dominios de la app (ej: general-settings, auth)
│   ├── auth/
│   │   ├── api/
│   │   └── components/
│   └── general-settings/
│       ├── api/
│       ├── components/
│       └── views/
├── hooks/          # Hooks globales de React
├── router/         # Rutas y guards (React Router)
├── store/          # Zustand stores globales (AuthStore, ThemeStore)
├── theme/          # Configuración del tema (theme.ts)
└── utils/          # Utilidades comunes (formatters, axios interceptors)
```

## Hechos confirmados
- Se utilizará la fuente `Inter`.
- Se mapearon exitosamente los colores (Tailwind) a las paletas de MUI.
- El proyecto adoptará una arquitectura de carpetas por módulos funcionales (*features*).

## Preguntas abiertas
- Ninguna. Documento listo para revisión.
