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

export const lightThemeOptions: ThemeOptions = {
  palette: {
    mode: 'light',
    primary: {
      main: '#19398d',
      contrastText: '#f3f5f9',
    },
    secondary: {
      main: '#0a0a0a',
      contrastText: '#f5f7fb',
    },
    error: {
      main: '#9b0033',
      contrastText: '#ffffff',
    },
    background: {
      default: '#f3f5fb',
      paper: '#ffffff', // Mapeado desde --card
    },
    text: {
      primary: '#010101',
      secondary: '#454545', // Mapeado desde --muted-foreground
    },
    divider: '#e3e3e3',
  },
  typography,
  shape,
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none', // Quita las mayúsculas por defecto de Material
          boxShadow: 'none',
        },
      },
    },
  },
};

export const darkThemeOptions: ThemeOptions = {
  palette: {
    mode: 'dark',
    primary: {
      main: '#6a8dd8',
      contrastText: '#0a0a0a',
    },
    secondary: {
      main: '#171717',
      contrastText: '#fafafa',
    },
    error: {
      main: '#cd6e7b',
      contrastText: '#fafafa',
    },
    background: {
      default: '#050505',
      paper: '#0a0a0a', // Mapeado desde --card dark
    },
    text: {
      primary: '#fafafa',
      secondary: '#a1a1a1', // Mapeado desde --muted-foreground dark
    },
    divider: '#282828',
  },
  typography,
  shape,
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          boxShadow: 'none',
        },
      },
    },
  },
};

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
