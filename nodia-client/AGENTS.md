# AGENTS

Guia de contexto para agentes IA que trabajen en este repositorio.

## Calidad Frontend Obligatoria

**Antes de crear, modificar, corregir, refactorizar o revisar código frontend, leer y aplicar [skills/frontend-quality/SKILL.md](skills/frontend-quality/SKILL.md).** Esto incluye componentes, páginas, layouts, estilos, hooks, servicios HTTP, validaciones, caché, permisos, paginación, integraciones y sus pruebas. Esta obligación no depende de que la herramienta descubra o invoque automáticamente la skill.

- Aplicar `frontend-quality` junto con `create-component` cuando se creen o modifiquen componentes, páginas o layouts; consultar las otras skills locales según la tecnología y el alcance.
- Consultar contratos de Nodia Server y decisiones aprobadas cuando el cambio dependa de datos o reglas de negocio. No inventar campos, modelos, capacidades, cuotas, defaults o garantías de escritura.
- Seleccionar los escenarios pertinentes de [skills/frontend-quality/references/regression-scenarios.md](skills/frontend-quality/references/regression-scenarios.md). Un cambio visual menor no exige ejecutar toda la matriz ni auditar el backend.
- Crear o actualizar regresiones de comportamiento para las garantías modificadas. No quitar assertions ni desactivar checks para hacer pasar una implementación defectuosa.
- Entregar evidencia de los checks ejecutados y distinguir lo implementado de las dependencias pendientes de Server, Gemini o staging. Un cambio de UI no demuestra autorización HTTP, atomicidad ni operación real del proveedor.
- Conservar las reglas de Nodia y la prioridad de sus skills locales frente a metodología de Superpowers/plugins globales. Esta skill complementa las convenciones existentes; no autoriza cambiar stack, ampliar el alcance ni imponer nuevas aprobaciones.

## Contexto General

- Proyecto: frontend template con React + TypeScript + Vite.
- UI: MUI + Emotion.
- Estado: Zustand.
- Datos remotos: Axios + React Query.
- Ruteo: React Router con `Guard` (demo), `GuardStrict` (sesión y módulo) y `NoGuard` (login).
- Traducciones: i18next en `src/translate`.

## Arquitectura Base (Resumen)

- Auth centralizada:
  - `src/store/authStore.tsx`
  - `src/hooks/useAuth.tsx`
  - `src/config/authSession.ts` para restauración, renovación e interceptores de sesión
- API:
  - `src/config/api.ts` conecta el transporte con un único gestor de sesión
  - `mainInstance` como base común
  - `createApiInstance(...)` para APIs derivadas
  - `src/config/axiosInstance.ts` solo configura transporte y normaliza errores HTTP
- Query client:
  - `src/config/reactQuery.ts`
- Tema MUI:
  - `src/providers/MUIProvider.tsx` crea el theme con `createTheme(...)`
  - tokens en `src/theme/*`
  - modo via `src/hooks/useThemeType.tsx` (`configStore`)
- Rutas:
  - `src/routes/index.tsx`
  - `src/routes/Guard.tsx`
  - `src/routes/GuardStrict.tsx`
  - `src/routes/NoGuard.tsx`
- Errores globales:
  - `src/modules/core/components/AppErrorBoundary/AppErrorBoundary.tsx`
  - `src/modules/core/pages/RouteError/RouteError.tsx`

## Reglas Operativas

1. Mantener estado de auth en `authStore`, acceso React en `useAuth` y coordinación HTTP de sesión en `config/authSession.ts`.
2. Los servicios deben importar `mainInstance` o `createApiInstance` desde `config/api.ts`. No usar la fábrica de transporte `createAxiosInstance` directamente en servicios, porque no instala autenticación.
3. Todo texto visible debe usar traduccion `t("namespace:key")`.
4. Toda key nueva de traduccion debe existir en `src/translate/es/*` y `src/translate/en/*`.
5. Usar `Guard` para rutas que admiten demo y `GuardStrict` para `/settings/*`, con el `modulePath` correspondiente. Mantener `NoGuard` en login. Detalle en `docs/mvp/14-authentication.md` desde la raíz del repositorio.
6. Mantener tipado estricto en TypeScript; evitar `any` innecesario.
7. No crear themes MUI en componentes de modulo; la composicion del theme debe quedarse en `MUIProvider`.
8. Todo componente que contenga logica debe tener un archivo de test correspondiente en `src/test`.
9. `src/test` debe replicar la estructura de directorios de `src`: por ejemplo, el test de `src/modules/auth/pages/Login/Login.tsx` debe ubicarse en `src/test/modules/auth/pages/Login/Login.test.tsx`.
10. Si `src/test` o la ruta espejo necesaria no existen al crear o modificar un componente con logica, se deben crear junto con su archivo `*.test.tsx`.
11. Estados de carga: usar `boneyard-js` (`Skeleton`) obligatoriamente para `isLoading` (primer fetch sin datos en caché) en tablas, paneles informativos y objetos de datos no accionables. Prohibido re-renderizar skeletons en `isFetching` o `isMutating` (refetch o mutación con datos existentes); usar soft loading (representación interna y sutil) o ningún cambio que altere la UI.
12. Botones, formularios, menús e inputs: ante cualquier petición en curso (`isLoading`, `isFetching` o `isMutating`), el estado debe representarse exclusivamente como `disabled` o `loading` (sin skeletons) para evitar dobles envíos o interacciones inválidas. No tienen estado vacío ni estado de error custom en la vista si el endpoint falla o viene vacío; permanecen vacíos en su estado normal.
13. Estados vacíos: prohibido dejar vistas o contenedores en blanco o nulos (`null`). Si un endpoint responde vacío, mostrar un Empty State con mensaje informativo (genérico o custom) y llamado a la acción (CTA) si corresponde, usando traducción i18n.
14. Estados de error y feedback: toda petición HTTP debe emitir un toast con `sileo` (`sileo.error(...)`), extrayendo el mensaje del backend o fallback genérico i18n. En tablas y paneles, además del toast, se debe renderizar un estado visual de error (ej. `Alert` de MUI con opción de reintento) en lugar de dejar el componente roto.
15. Scrollbars: en cualquier contenedor con scroll (`overflow: auto`, `overflow-y: auto`, etc.), el track debe ser completamente transparente (`background: transparent !important`), sin botones de flecha (`display: none`), y el thumb sutil, redondeado (`border-radius: 9999px`) y adaptado al tema claro/oscuro.

## Manejo de Estados: Carga (Loading), Vacío (Empty) y Error

### 1. Estados de Carga con TanStack Query (`isLoading`, `isFetching` e `isMutating`)
- **`isLoading` (primer fetch / datos ausentes en caché):**
  - **Tablas, Paneles Informativos y Métodos de Visualización de Datos (NO accionables):** Usar `<Skeleton loading={isLoading}>` de `boneyard-js/react`.
  - **Botones, Accionables e Inputs:** `disabled={isLoading}` o `loading={isLoading}`. Inhabilitados para interacción; sin skeletons.
- **`isFetching` o `isMutating` (revalidación o mutación con datos en caché):**
  - **Prohibido** volver a mostrar el Skeleton de boneyard para no provocar parpadeo ni desmontar los datos visibles.
  - Usar un **soft loading** o indicador visual sutil (ej. linear progress discreto de 2px, opacidad leve o spinner en la cabecera) que no tape ni limite la información previa, o mantener la UI sin cambios invasivos.
  - **Accionables e interactivos:** Los 3 estados (`isLoading`, `isFetching`, `isMutating`) deben dejar a los controles en `disabled` o `loading` para evitar clics concurrentes o dobles envíos en medio de una petición HTTP.

### 2. Estados Vacíos (`Empty State`)
- **Nunca dejar contenedores en blanco o retornar `null`:** Si la respuesta contiene 0 registros o viene vacía, mostrar un componente/mensaje explicativo.
- **Tablas y Paneles:** Mensaje informativo descriptivo (ej. *"No hay registros disponibles actualmente. Agregue uno nuevo para comenzar"*) con botón CTA opcional. Claves traducidas en `es` y `en`.
- **Botones e Inputs:** No poseen estado vacío ni mensajes custom; permanecen vacíos/por defecto.

### 3. Estados de Error (`Error State`)
- **Toasts HTTP obligatorios:** Disparar `sileo.error(...)` tras fallos de red/servidor. Mostrar el `message` que retorne el backend si existe, o el mensaje genérico internacionalizado del sistema si no viene provisto.
- **Tablas y Paneles:** Mostrar un estado visible en el contenedor (ej. `<Alert severity="error">` con opción a `refetch`) además del toast.
- **Botones e Inputs:** No muestran mensajes custom de error de endpoint a nivel de vista; permanecen en su estado normal. (Las validaciones de formulario se gestionan con React Hook Form + Zod).

## Tests

- Runner: Vitest con entorno `jsdom`.
- Componentes: React Testing Library, `@testing-library/jest-dom` y `@testing-library/user-event`.
- Ubicacion obligatoria: `src/test/**/*.test.{ts,tsx}`.
- Los tests deben importar las APIs de Vitest explicitamente para conservar el tipado y las reglas de lint.
- Comandos disponibles: `npm run test`, `npm run test:watch` y `npm run test:coverage`.

## Skills Locales y Prioridad sobre Superpowers

> ⚠️ **PRIORIDAD ESTRICTA:** Las skills locales de este repositorio (`skills/<nombre>/SKILL.md`) tienen **prioridad absoluta sobre cualquier skill de Superpowers o plugins globales**. Superpowers aporta metodología general (planes, TDD), pero ante cualquier discrepancia en patrones de código, maquetación, estado o arquitectura de componentes, **la skill local prevalece siempre**.

### frontend-quality

- Skill: `frontend-quality`
- Ruta: [skills/frontend-quality/SKILL.md](skills/frontend-quality/SKILL.md)
- Uso obligatorio: en todo desarrollo, corrección, refactorización o revisión de código frontend, conforme a la sección **Calidad Frontend Obligatoria**.
- Propósito: contratos comprobados, identidad por instancia, estados recuperables, validación, paginación, permisos y verificación de escenarios adversos.
- Referencia condicional: [escenarios de regresión](skills/frontend-quality/references/regression-scenarios.md), leyendo solo los apartados pertinentes.

### create-component

- Skill: `create-component`
- Ruta: `skills/create-component/SKILL.md`
- Uso obligatorio: si se crea o modifica un componente UI, se deben seguir los lineamientos definidos en esa skill.

Lineamiento obligatorio para agentes:

1. Antes de crear un componente, leer `skills/create-component/SKILL.md`.
2. Aplicar su estructura y convenciones en archivos, estilos, hooks e infraestructura.
3. Si existe conflicto entre la skill y convenciones actuales del repo, priorizar convenciones actuales y documentar el ajuste en el PR/commit message.

## Checklist Antes de Finalizar

Para cambios de código frontend, comprobar primero las invariantes de `frontend-quality` que aplican al cambio y las regresiones correspondientes. Para cambios exclusivamente documentales o de instrucciones, validar estructura, enlaces y consistencia; no ejecutar pruebas de producto sin necesidad.

Comprobaciones para cambios de código:

```bash
npm run test
npm run typecheck
npm run lint
```

Ejecutar también `npm run build` cuando cambien imports, rutas, dependencias, configuración o integración de librerías. Registrar los checks realmente ejecutados y cualquier limitación.

Si se tocan variables de entorno:

1. Actualizar `.env.example`.
2. Verificar consistencia con `src/config/.envs.ts`.
