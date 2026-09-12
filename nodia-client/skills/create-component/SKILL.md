---
name: create-component
description: Crear o modificar componentes UI del template con React, TypeScript, MUI, Emotion, traducciones, hooks, rutas y acceso a datos mediante Axios y TanStack Query. Usar siempre que se cree o cambie un componente, pagina, layout, provider o sus estilos e infraestructura asociada dentro de este repositorio.
---

# Create Component

## Fuente de verdad

Antes de editar:

1. Leer `AGENTS.md`, `package.json` y los componentes cercanos al destino.
2. Tomar `package.json` como fuente de verdad si alguna version difiere de esta skill.
3. Mantener la arquitectura existente; no introducir una segunda solucion para auth, API, rutas, estado, traducciones o theme.
4. Consultar la documentacion de la version instalada cuando una prop o comportamiento de MUI, React Router o TanStack Query no sea evidente.

## Stack validado

| Area | Version |
| --- | --- |
| Node.js | `>=24.20.0` (`.nvmrc`: `24.20.0`) |
| React / React DOM | `19.2.8` |
| TypeScript | `6.0.3` |
| Vite | `8.2.1` |
| MUI Material / Icons | `9.3.1` |
| Emotion React / Styled | `11.14.x` |
| React Router | `8.3.0` |
| React Hook Form | `7.86.0` (`@hookform/resolvers`: `5.9.1`) |
| Zod | `4.4.3` |
| Sileo (Snackbars) | `0.1.5` |
| Boneyard (Skeletons) | `1.9.0` |
| TanStack React Query | `5.101.4` |
| Axios | `1.19.0` |
| i18next / react-i18next | `26.3.6` / `17.0.11` |
| Zustand | `5.0.15` |
| Babel | `8.0.1` |
| ESLint | `10.8.1` |
| Tests | Vitest `4.1.11` + Testing Library `16.3.2` |

No subir TypeScript a v7 mientras `typescript-eslint` declare soporte `<6.1.0`. Verificar nuevamente su peer dependency antes de cambiar esta restriccion.

## Flujo obligatorio

1. Determinar si el cambio es UI, logica local, datos remotos, rutas o una combinacion.
2. Reutilizar componentes, tokens, hooks y patrones existentes antes de crear abstracciones nuevas.
3. Crear solo los archivos necesarios; no dejar carpetas o archivos placeholder. Los `.gitkeep` que conservan el arbol espejo de `src/test` son la unica excepcion y deben eliminarse cuando la carpeta reciba un test real.
4. Tipar props, respuestas HTTP, errores, callbacks y estado sin `any` innecesario.
5. Agregar todo texto visible en `src/translate/es/*` y `src/translate/en/*`.
6. Crear o actualizar el test espejo de todo componente con logica.
7. Ejecutar `npm run test`, `npm run typecheck` y `npm run lint` al finalizar. Ejecutar `npm run build` cuando cambien imports, configuracion, rutas o integraciones de librerias.

## Estructura

Usar una carpeta PascalCase y mantener el barrel `index.ts`:

```text
XComponent/
|-- XComponent.tsx
|-- styles.ts
|-- index.ts
|-- types.ts                 # opcional
|-- hooks/                   # opcional: uno o mas hooks useX
`-- infrastructure/          # opcional: services.ts + useServices.ts
```

- `XComponent.tsx`, `styles.ts` e `index.ts` son obligatorios para componentes, paginas y layouts con carpeta propia.
- Nombrar componentes y carpetas en PascalCase.
- Nombrar hooks en camelCase con prefijo `use`.
- Mantener la UI en `XComponent.tsx` y extraer logica no trivial a hooks.
- Crear `hooks/` solo cuando exista logica local extraible. No crear un hook que se limite a renombrar props o valores.
- Crear `infrastructure/` solo cuando el componente consuma datos remotos. La carpeta debe contener `services.ts` para transporte y `useServices.ts` para React Query; no crear uno sin el otro.
- Colocar tipos compartidos por varios archivos del folder en `types.ts`; dejar tipos locales pequenos junto a su uso.
- No crear un theme dentro del componente. La composicion pertenece a `src/providers/MUIProvider.tsx` y los tokens a `src/theme/*`.

## Componente y traducciones

Usar imports de tipo con `verbatimModuleSyntax` y mantener las claves con namespace:

```tsx
import type { FC } from "react";
import { useTranslation } from "react-i18next";
import { Wrapper, Title } from "./styles";

type Props = {
  titleKey: string;
};

const XComponent: FC<Props> = ({ titleKey }) => {
  const { t } = useTranslation();

  return (
    <Wrapper>
      <Title>{t(titleKey)}</Title>
    </Wrapper>
  );
};

export default XComponent;
```

- Usar `t("namespace:key")` para todo texto visible.
- Crear la misma key en `src/translate/es/<namespace>.json` y `src/translate/en/<namespace>.json`.
- No usar `defaultValue` para ocultar keys faltantes.
- Usar `Trans` cuando el copy necesite componentes interpolados; no concatenar fragmentos traducidos.

## Estilos MUI y Emotion

Usar el `styled` de MUI para obtener el theme tipado. No importar `styled-components`: esa libreria no pertenece al proyecto.

```tsx
import { styled } from "@mui/material/styles";

export const Wrapper = styled("section")(({ theme }) => ({
  display: "flex",
  gap: theme.spacing(1.5),
  color: theme.palette.primary.main,
}));

export const Title = styled("h2")(({ theme }) => ({
  ...theme.typography.h6,
  margin: 0,
}));
```

- Usar tokens del theme (`palette`, `spacing`, `typography`, `breakpoints`, `zIndex`, `transitions`).
- Usar `theme.palette.primary.main`; no inventar `primaryApp` ni colores hardcodeados cuando exista un token equivalente.
- Usar `sx` para ajustes puntuales de una instancia y `styled` para estilos reusables.
- Mantener accesibilidad: label asociado, nombre accesible, orden de foco, estados disabled/loading y navegacion por teclado.

## Tests de componentes

Todo componente con logica debe tener un test en `src/test` que replique su ruta relativa dentro de `src`:

```text
src/modules/auth/pages/Login/Login.tsx
src/test/modules/auth/pages/Login/Login.test.tsx
```

Se considera logica cualquier estado local, handler con efectos, navegacion, acceso a stores o contexto, transformacion condicional relevante, error boundary o consumo de hooks/servicios. Usar solo traducciones o renderizar props sin decisiones no obliga por si solo a crear un test, salvo que el `AGENTS.md` local sea mas estricto.

- Usar Vitest y React Testing Library; importar `describe`, `it`, `expect`, `vi` y demas APIs explicitamente desde `vitest`.
- Probar comportamiento observable y accesibilidad, no detalles internos del componente.
- Usar `user-event` para interacciones de usuario y `jest-dom` para assertions del DOM.
- Mantener la misma base de nombre con sufijo `.test.tsx`; usar `.test.ts` para hooks o utilidades sin JSX.
- Al mover o renombrar un componente, mover tambien su test y eliminar el `.gitkeep` de la carpeta que deje de estar vacia.

## MUI 9: breaking changes relevantes

Aplicar estas reglas al crear o migrar componentes:

- Usar `slots` y `slotProps`; no usar APIs deprecadas como `components`, `componentsProps`, `*Props`, `inputProps`, `inputRef` o `TransitionComponent` cuando el componente tenga reemplazo por slots.
- Usar `Grid` de `@mui/material/Grid`; `GridLegacy` fue eliminado. No usar `item`, `xs`, `sm`, `md`, `lg` o `xl` directamente:

```tsx
<Grid container spacing={2}>
  <Grid size={{ xs: 12, sm: 6 }}>{children}</Grid>
</Grid>
```

- Mover system props a `sx` en `Box`, `Grid`, `Stack`, `Typography`, `Link` y `DialogContentText`:

```tsx
<Stack sx={{ mt: 2, alignItems: "center" }} />
```

- No usar `disableEscapeKeyDown` en `Dialog` o `Modal`; filtrar `reason === "escapeKeyDown"` dentro de `onClose` cuando se necesite bloquear Escape.
- Usar iconos con sufijo `Outlined`; los aliases antiguos terminados en `Outline` fueron eliminados.
- Revisar visualmente componentes existentes al migrarlos: `ListItemIcon` redujo su ancho minimo y Tabs, MenuList y Stepper cambiaron comportamiento de foco/teclado.
- Considerar el soporte minimo de MUI 9: Chrome 117, Edge 121, Firefox 121 y Safari 17.

## React 19: guardrails

- Usar el JSX transform moderno configurado por Vite; no importar `React` solo para escribir JSX.
- Pasar un valor inicial a `useRef`, por ejemplo `useRef<HTMLDivElement | null>(null)`.
- Evitar retornos implicitos en callbacks de ref porque React 19 interpreta un retorno como cleanup:

```tsx
<div
  ref={(node) => {
    elementRef.current = node;
  }}
/>
```

- Aceptar `ref` como prop en componentes funcionales nuevos cuando sea necesario. No agregar `forwardRef` automaticamente; conservarlo solo cuando una API existente lo requiera.
- Usar keys primitivas, estables y unicas en listas. No usar objetos ni indices salvo listas estaticas sin reordenamiento.

## React Router 8

- Importar APIs generales (`Link`, `Navigate`, `useNavigate`, hooks) desde `react-router`.
- Importar `RouterProvider` desde `react-router/dom`.
- No agregar `react-router-dom`; el paquete de reexport fue eliminado en v8.
- Usar `loaderData`, no el campo deprecado `data`, al consumir resultados de `useMatches` o argumentos de rutas.
- Registrar rutas en `src/routes/index.tsx` y respetar `Guard`/`NoGuard`.
- No duplicar auth en loaders o componentes; consumir `authStore` mediante `useAuth` según la arquitectura existente.

## Axios y TanStack Query 5

No crear instancias Axios aisladas. Usar `mainInstance` o `createApiInstance` desde `src/config/api.ts`, que instala y comparte la configuración de sesión de `authSession.ts`. La fábrica de transporte en `axiosInstance.ts` no debe usarse directamente desde servicios.

Separar transporte y cache:

```ts
// infrastructure/services.ts
// Ajustar la ruta relativa segun la ubicacion del componente.
import { mainInstance } from "../../../../config/api";
import type { Item, NewItem } from "../types";

export const getItems = async (): Promise<Item[]> => {
  const { data } = await mainInstance.get<Item[]>("/items");
  return data;
};

export const createItem = async (payload: NewItem): Promise<Item> => {
  const { data } = await mainInstance.post<Item>("/items", payload);
  return data;
};
```

```ts
// infrastructure/useServices.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createItem, getItems } from "./services";

export const itemKeys = {
  all: ["items"] as const,
};

export const useItems = () =>
  useQuery({
    queryKey: itemKeys.all,
    queryFn: getItems,
  });

export const useCreateItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createItem,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: itemKeys.all });
    },
  });
};
```

Aplicar las reglas de TanStack Query v5:

- Usar siempre la firma de objeto: `useQuery({ ... })`, `useMutation({ ... })` e `invalidateQueries({ ... })`.
- No usar `onSuccess`, `onError` ni `onSettled` en `useQuery`; fueron eliminados. Esos callbacks siguen disponibles para mutations.
- Usar `queryClient.removeQueries(...)`; no usar `query.remove()`.
- Usar `placeholderData: keepPreviousData`; no usar la opcion eliminada `keepPreviousData: true`.
- Definir query keys estables y reutilizables. Incluir en la key toda variable consumida por `queryFn`.
- Favorecer optimistic updates solo cuando exista rollback tipado y manejo coherente de errores.

Nombrar handlers HTTP por metodo:

- `GET`: `get...`
- `PUT`: `update...`
- `DELETE`: `delete...`
- `POST` y `PATCH`: usar el verbo de negocio, por ejemplo `create...`, `send...`, `toggle...` o `rollback...`.

### Notificaciones y Feedback HTTP con Sileo

Después de **cualquier petición HTTP** (creación, edición, actualización, borrado lógico o fallo de API) es obligatorio emitir un toast/snackbar con `sileo` utilizando claves de traducción i18n:

```ts
import { sileo } from "sileo";
import i18n from "../../../../translate";

export const useCreateItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createItem,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: itemKeys.all });
      sileo.success({
        title: i18n.t("common:notifications.success_title"),
        description: i18n.t("items:created_successfully"),
      });
    },
    onError: (error: any) => {
      const serverMessage = error?.response?.data?.message;
      sileo.error({
        title: i18n.t("common:notifications.error_title"),
        description: serverMessage || i18n.t("core:server_error_toast"),
      });
    },
  });
};
```

### Manejo de Estados: Carga (Loading), Vacío (Empty) y Error

Al consumir datos remotos y diseñar vistas, es **obligatorio** cumplir con las siguientes reglas según la naturaleza del componente:

#### 1. Estados de Carga con TanStack Query (`isLoading`, `isFetching` e `isMutating`)

Al crear un nuevo componente o modificar uno existente que utilice TanStack Query, la gestión del estado de carga se rige estrictamente por la naturaleza del elemento (informativo vs accionable):

- **Paneles informativos y objetos que representan datos (NO accionables / al hacer clic no pasa nada):**
  - Aplica a tablas, paneles informativos, cards de datos, listas y contenedores de información.
  - **`isLoading` (primer fetch inicial sin datos en caché):**
    - Debe mostrar un estado de carga completo o skeleton. En este proyecto se utiliza obligatoriamente la librería **`boneyard-js`** (`boneyard-js/react`), envolviendo la sección con `<Skeleton loading={isLoading}>...children...</Skeleton>`.
  - **`isFetching` o `isMutating` (revalidación con datos ya presentes o mutación en vuelo):**
    - **PROHIBIDO** volver a mostrar el Skeleton de Boneyard o desmontar el contenido visible. Reemplazar datos ya visibles con skeletons estropea la UI y genera parpadeos bruscos.
    - Se debe utilizar un **soft loading** o un pequeño representador sutil del estado de carga (ejemplo: un `LinearProgress` discreto de 2px en el borde superior, un spinner pequeño en la barra de herramientas/cabecera, o una leve opacidad) que **no limite ni oculte la información anterior ni altere la UI**. También es perfectamente válido que **no se tenga ningún cambio en la UI** si no aporta valor.

- **Elementos accionables e interactivos (Accionables / al interactuar generan una acción o evento):**
  - Aplica a botones, inputs, menús de fila/acciones, selectores, switches, checkboxes y controles de formulario.
  - **`isLoading`, `isFetching` o `isMutating` (cualquier petición HTTP en proceso):**
    - **Cualquiera de estos 3 estados debe dejar al componente en estado de carga (`loading`) o en estado deshabilitado (`disabled`)** (ejemplo: `disabled={isLoading || isFetching || isMutating}` o `disabled={isPending}`).
    - **Regla estricta:** Esto garantiza que no ocurran errores, dobles envíos o condiciones de carrera al interactuar en medio de una petición HTTP.
    - Los accionables e inputs **no** utilizan skeletons bajo ninguna circunstancia.

#### 2. Estados Vacíos (`Empty State`)

- **Prohibido dejar vistas en blanco o retornar `null`:** Si el backend responde sin datos (ej. `data.length === 0`), siempre se debe proporcionar feedback al usuario.
- **Tablas, Paneles y Contenedores:** Renderizar un componente o mensaje de estado vacío (genérico o custom de la sección) informando que no hay registros y guiando la acción siguiente (ej. *"No hay elementos para mostrar actualmente. Agregue un nuevo registro para comenzar"* con un botón CTA si aplica). Textos siempre internacionalizados (`t("namespace:key")`).
- **Botones e Inputs:** No tienen estado vacío con mensajes custom. Si la respuesta viene vacía, simplemente permanecen vacíos en su estado por defecto.

#### 3. Estados de Error (`Error State`)

- **Toast de error obligatorio (`sileo.error(...)`):** Ante cualquier fallo de petición HTTP, emitir notificación Sileo mostrando el mensaje del backend (`error.response?.data?.message`) o el mensaje genérico internacionalizado (`t("core:server_error_toast")`).
- **Tablas, Paneles y Contenedores:** Además del toast, es obligatorio/recomendado mostrar un componente visible de error en la propia vista (ej. `<Alert severity="error">` de MUI con botón de reintento `refetch()`), evitando pantallas rotas o contenedores vacíos sin explicación.
- **Botones e Inputs:** No tienen estado de error custom por fallo de endpoint; permanecen vacíos/en su estado inicial.

#### Ejemplo de integración en un componente de listado / tabla:

```tsx
import type { FC } from "react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "boneyard-js/react";
import {
  Alert,
  Box,
  Button,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useIsMutating } from "@tanstack/react-query";
import { useItems } from "./infrastructure/useServices";

export const ItemsTable: FC = () => {
  const { t } = useTranslation();
  const { data: items, isLoading, isFetching, isError, refetch } = useItems();
  const isMutating = useIsMutating() > 0;
  const isBusy = isLoading || isFetching || isMutating;

  // 1. Estado de Error visual en el contenedor
  if (isError) {
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" disabled={isBusy} onClick={() => refetch()}>
            {t("core:retry")}
          </Button>
        }
      >
        {t("core:server_error_alert")}
      </Alert>
    );
  }

  // 2. Estado de Carga inicial: Skeleton automático con Boneyard
  // 3. Revalidación o mutación (isFetching / isMutating): Soft loading sutil sin desmontar datos
  return (
    <Box sx={{ position: "relative" }}>
      {(isFetching || isMutating) && !isLoading && (
        <LinearProgress
          sx={{ position: "absolute", top: 0, left: 0, right: 0, height: 2 }}
        />
      )}

      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
        {/* Accionables inhabilitados ante cualquier estado de carga o mutación */}
        <Button variant="contained" disabled={isBusy} onClick={() => {}}>
          {t("items:new_item")}
        </Button>
      </Box>

      <Skeleton loading={isLoading}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{t("items:name")}</TableCell>
              <TableCell align="right">{t("core:actions")}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {/* 4. Estado Vacío: Feedback visual cuando no hay registros */}
            {!isLoading && items?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} align="center" sx={{ py: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    {t("core:empty_state_description")}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              items?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.name}</TableCell>
                  <TableCell align="right">
                    <Button size="small" disabled={isBusy} onClick={() => {}}>
                      {t("core:edit")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Skeleton>
    </Box>
  );
};
```

## Formularios con React Hook Form y Zod

Para el manejo y validación de formularios:

1. **Definir el esquema con Zod** e inferir el tipo TypeScript:
```ts
import { z } from "zod";

export const exampleSchema = z.object({
  name: z.string().min(1, "validations:required"),
  email: z.string().email("validations:invalid_email"),
});

export type ExampleFormData = z.infer<typeof exampleSchema>;
```

2. **Integrar con `useForm` y `zodResolver`**:
```tsx
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { TextField, Button } from "@mui/material";
import { useTranslation } from "react-i18next";
import { exampleSchema, type ExampleFormData } from "./schema";

export const ExampleForm = ({ onSubmit }: { onSubmit: (data: ExampleFormData) => void }) => {
  const { t } = useTranslation();
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ExampleFormData>({
    resolver: zodResolver(exampleSchema),
    defaultValues: {
      name: "",
      email: "",
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Controller
        name="name"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            label={t("common:name")}
            error={!!errors.name}
            helperText={errors.name?.message ? t(errors.name.message) : undefined}
            fullWidth
            margin="normal"
          />
        )}
      />
      <Controller
        name="email"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            label={t("common:email")}
            type="email"
            error={!!errors.email}
            helperText={errors.email?.message ? t(errors.email.message) : undefined}
            fullWidth
            margin="normal"
          />
        )}
      />
      <Button type="submit" variant="contained" disabled={isSubmitting} sx={{ mt: 2 }}>
        {t("common:save")}
      </Button>
    </form>
  );
};
```

- Utilizar `Controller` de `react-hook-form` para integrar componentes controlados de MUI (`TextField`, `Select`, `Checkbox`, `Switch`, etc.).
- Las claves de error en los schemas deben referenciar claves de traducción i18n (`t(errors.field.message)`).
- Evitar re-renders innecesarios y mantener los schemas desacoplados de la vista.

## Tooling: Babel 8, ESLint 10 y TypeScript 6

- Mantener archivos de configuracion y scripts en ESM; Babel 8 es ESM-only.
- No agregar `.eslintrc*`; ESLint 10 solo admite flat config mediante `eslint.config.js`.
- Escapar `{`, `}`, `<` y `>` cuando sean texto JSX literal. No usar expresiones de secuencia sin parentesis dentro de atributos JSX.
- Mantener `strict`, evitar `any` y usar `import type` para imports exclusivamente de tipos.
- No silenciar nuevas reglas de ESLint sin justificar por que el codigo no puede corregirse.

## Checklist final

- [ ] El componente sigue la estructura y nombres del modulo.
- [ ] No se duplicaron auth, Axios, QueryClient, router ni theme.
- [ ] MUI usa APIs v9 (`slots`, `slotProps`, `sx`, Grid actual).
- [ ] Los estilos usan MUI/Emotion y tokens del theme.
- [ ] Todo texto visible existe en español e ingles bajo `src/translate`.
- [ ] Props, handlers, respuestas y callbacks estan tipados sin `any` innecesario.
- [ ] Estados loading, empty, error, disabled y accesibilidad estan cubiertos cuando aplican.
- [ ] Todo componente con logica tiene su archivo espejo `src/test/**/*.test.tsx`.
- [ ] `npm run test` pasa.
- [ ] `npm run typecheck` pasa.
- [ ] `npm run lint` pasa.
- [ ] `npm run build` pasa cuando el alcance lo requiere.

## Referencias oficiales

- React 19: <https://react.dev/blog/2024/04/25/react-19-upgrade-guide>
- MUI 9: <https://mui.com/material-ui/migration/upgrade-to-v9/>
- React Router 8: <https://reactrouter.com/upgrading/v7>
- TanStack Query 5: <https://tanstack.com/query/v5/docs/framework/react/guides/migrating-to-v5>
- Babel 8: <https://babeljs.io/docs/v8-migration>
- ESLint 10: <https://eslint.org/docs/latest/use/migrate-to-10.0.0>
- Compatibilidad TypeScript ESLint: <https://typescript-eslint.io/users/dependency-versions/>
