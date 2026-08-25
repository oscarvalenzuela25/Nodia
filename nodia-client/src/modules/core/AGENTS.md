# AGENTS - Core Module

Contexto operativo para agentes IA que trabajen dentro de `src/modules/core`.

## Objetivo del modulo

Este modulo concentra piezas transversales de la app:

- Manejo global de errores
- Pantallas de sistema (404, maintenance)
- Fallbacks de UX para fallos en rutas/render

## Archivos clave

- `src/modules/core/components/AppErrorBoundary/AppErrorBoundary.tsx`
- `src/modules/core/pages/RouteError/RouteError.tsx`
- `src/modules/core/pages/NotFound/NotFound.tsx`
- `src/modules/core/pages/Maintenance/Maintenance.tsx`
- `src/routes/index.tsx`

## Reglas del modulo

1. Todo texto visible debe usar `t("core:key")`.
2. Si agregas nuevas claves, mapear en:
   - `src/translate/es/core.json`
   - `src/translate/en/core.json`
3. No mostrar datos sensibles del error al usuario final.
4. Logs detallados solo en entorno de desarrollo (`import.meta.env.DEV`).
5. Mantener acciones de recuperacion en fallbacks (reintentar, volver al inicio).
6. Si agregas una nueva pantalla core, actualizar rutas en `src/routes/index.tsx`.

## Skill obligatoria para componentes

- Skill: `create-component`
- Ruta: `skills/create-component/SKILL.md` (relativa a la base del proyecto)

Si se crea o modifica un componente en este modulo, se deben seguir los lineamientos de esa skill.
