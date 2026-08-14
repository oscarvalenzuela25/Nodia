# Client Template

Template base para aplicaciones frontend con React + TypeScript + Vite, listo para escalar con auth, rutas protegidas, i18n, React Query, Axios y MUI.

## Stack

- React 19
- Vite 8
- TypeScript 5
- React Router 7
- Zustand
- React Query
- Axios
- i18next + react-i18next
- MUI 7 + Emotion

## Requisitos

- Node `22.12.0` o superior
- NPM 9+

Este repo incluye `.nvmrc` con la version recomendada.

```bash
nvm install
nvm use
node -v
```

## Variables de entorno

Archivo local:

```bash
.env
```

Archivo de ejemplo:

```bash
.env.example
```

Variables:

- `VITE_API_URL`: URL base de la API

## Scripts

```bash
npm run dev
npm run typecheck
npm run lint
npm run build
npm run preview
```

## Estructura base

```text
src/
  config/
    .envs.ts
    axiosInstance.ts
    reactQuery.ts
  hooks/
    useAuth.tsx
    useThemeType.tsx
  modules/
    auth/pages/
    core/pages/
    home/pages/
  providers/
    MUIProvider.tsx
  routes/
    Guard.tsx
    NoGuard.tsx
    index.tsx
  store/
    authStore.tsx
    configStore.tsx
  theme/
    *.tsx
  translate/
    es/
    en/
    index.ts
```

## Arquitectura

### Auth centralizada

- Estado auth en `src/store/authStore.tsx`
- Hook de acceso en `src/hooks/useAuth.tsx`
- Guards consumen `useAuth`:
  - `Guard`: requiere sesion
  - `NoGuard`: bloquea rutas publicas si hay sesion

### Ruteo

Definido en `src/routes/index.tsx`:

- `/` (protegida)
- `/login` (publica)
- `/register` (publica)
- `/maintenance`
- `/404`
- `* -> /404`

### Manejo de errores global

- `src/modules/core/components/AppErrorBoundary.tsx`
- `src/modules/core/pages/RouteError/RouteError.tsx` como `errorElement` del router

### API (Axios)

`src/config/axiosInstance.ts` expone:

- `mainInstance`: instancia base comun
- `createApiInstance(...)`: crea nuevas instancias derivadas de la base

Incluye:

- `baseURL` desde `envs.API_URL`
- timeout por defecto
- headers base JSON
- interceptor request con `Authorization` si hay token
- interceptor response que limpia sesion al recibir `401`

### React Query

Configuracion global en `src/config/reactQuery.ts`:

- `refetchOnMount: false`
- `refetchOnWindowFocus: false`
- `retry: false`
- `retryOnMount: true`

### Tema MUI

- `src/providers/MUIProvider.tsx` crea el theme con `createTheme(...)`.
- Los tokens viven en `src/theme/*`.
- El modo (`light`/`dark`) se resuelve con `useThemeType` (`src/hooks/useThemeType.tsx`) desde `configStore`.

### i18n

Configuracion en `src/translate/index.ts` con namespaces:

- `auth`
- `core`
- `home`
- `translate`

Regla del proyecto:

- Todo texto visible debe usar `t("namespace:key")`
- No hardcodear textos en JSX
- Al agregar una clave, mapearla en `es` y `en`

## Estado del tema MUI

`src/theme/*` incluye tokens base por defecto (palette, typography, breakpoints, spacing, transitions y zIndex) siguiendo los valores iniciales de MUI.
La composicion final del theme se hace en `src/providers/MUIProvider.tsx` (no existe `src/theme/index.tsx`).

Recomendacion antes de producir:

1. Ajustar `components` overrides segun el sistema de diseno del cliente.
2. Extender `palette` con tokens de marca propios si aplica.
3. Si agregas tokens nuevos, mantener consistencia entre `lightPalette` y `darkPalette`.

## Spec para IA (Agent Spec)

Estas reglas aplican para cualquier agente o automatizacion que modifique este repo.

1. No duplicar logica de auth fuera de `authStore` y `useAuth`.
2. No crear clientes Axios aislados sin pasar por `mainInstance` o `createApiInstance`.
3. No hardcodear textos UI; siempre usar `t("namespace:key")`.
4. Toda clave nueva debe existir en `src/translate/es/*` y `src/translate/en/*`.
5. Mantener rutas nuevas bajo `src/routes/index.tsx` y respetar `Guard`/`NoGuard`.
6. Si una ruta puede fallar, debe tener fallback de error coherente.
7. Mantener tipado estricto TypeScript; no introducir `any` innecesario.
8. Antes de cerrar cambios, ejecutar:

```bash
npm run typecheck
npm run lint
```

9. Si cambian variables de entorno, actualizar `.env.example`.
10. Si cambian convenciones o arquitectura, actualizar este README.
