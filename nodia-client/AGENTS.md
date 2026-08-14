# AGENTS

Guia de contexto para agentes IA que trabajen en este repositorio.

## Contexto General

- Proyecto: frontend template con React + TypeScript + Vite.
- UI: MUI + Emotion.
- Estado: Zustand.
- Datos remotos: Axios + React Query.
- Ruteo: React Router con `Guard`/`NoGuard`.
- Traducciones: i18next en `src/translate`.

## Arquitectura Base (Resumen)

- Auth centralizada:
  - `src/store/authStore.tsx`
  - `src/hooks/useAuth.tsx`
- API:
  - `src/config/axiosInstance.ts`
  - `mainInstance` como base común
  - `createApiInstance(...)` para APIs derivadas
- Query client:
  - `src/config/reactQuery.ts`
- Tema MUI:
  - `src/providers/MUIProvider.tsx` crea el theme con `createTheme(...)`
  - tokens en `src/theme/*`
  - modo via `src/hooks/useThemeType.tsx` (`configStore`)
- Rutas:
  - `src/routes/index.tsx`
  - `src/routes/Guard.tsx`
  - `src/routes/NoGuard.tsx`
- Errores globales:
  - `src/modules/core/components/AppErrorBoundary.tsx`
  - `src/modules/core/pages/RouteError/RouteError.tsx`

## Reglas Operativas

1. No duplicar auth fuera de `authStore` + `useAuth`.
2. No crear instancias Axios aisladas; usar `mainInstance` o `createApiInstance`.
3. Todo texto visible debe usar traduccion `t("namespace:key")`.
4. Toda key nueva de traduccion debe existir en `src/translate/es/*` y `src/translate/en/*`.
5. Respetar `Guard`/`NoGuard` al agregar rutas nuevas.
6. Mantener tipado estricto en TypeScript; evitar `any` innecesario.
7. No crear themes MUI en componentes de modulo; la composicion del theme debe quedarse en `MUIProvider`.

## Skills

### create-component

- Skill: `create-component`
- Ruta: `skills/create-component/SKILL.md`
- Uso obligatorio: si se crea o modifica un componente UI, se deben seguir los lineamientos definidos en esa skill.

Lineamiento obligatorio para agentes:

1. Antes de crear un componente, leer `skills/create-component/SKILL.md`.
2. Aplicar su estructura y convenciones en archivos, estilos, hooks e infraestructura.
3. Si existe conflicto entre la skill y convenciones actuales del repo, priorizar convenciones actuales y documentar el ajuste en el PR/commit message.

## Checklist Antes de Finalizar

```bash
npm run typecheck
npm run lint
```

Si se tocan variables de entorno:

1. Actualizar `.env.example`.
2. Verificar consistencia con `src/config/.envs.ts`.
