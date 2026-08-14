---
name: create-component
description: Guia operativa para crear componentes React/MUI con la estructura y convenciones del proyecto; cargarla antes de crear o modificar un componente.
---

## When to Use

Use this skill when:

- Creas un componente nuevo (carpeta propia o dentro de otro módulo).
- Añades lógica dedicada (custom hooks o servicios) a un componente existente.
- Incorporas MUI en un componente y necesitas confirmar patrones o props (consulta la doc vía MCP de MUI).

---

## Context

- Proyecto React 19.2.4 con Vite 8 y styled-components(emotion).
- Color de marca: usa `theme.palette.primary.main` como color principal.
- Todo texto se traduce via `useTranslate`/`useTranslation` y se agrega en `src/translations/*`.
- Axios: usa `mainInstance` desde `src/config/axiosInstance.ts`.
- Prefiere React Query para datos; componentes base con MUI cuando aplique.

## Critical Patterns

### Pattern 1: Estructura del componente

```
XComponent/
├── XComponent.tsx       # UI (arrow function)
├── styles.ts            # styled components usando theme
├── index.ts             # export default XComponent
├── types.ts             # tipos compartidos del folder (opcional)
├── hooks/               # lógica reusable (useXComponent, etc.)
├── infrastructure/      # HTTP + React Query (services.ts, useServices.ts)
```

- Nombra el componente y carpeta en PascalCase. Hooks en camelCase con prefijo `use`.
- Si no hay lógica adicional, omite carpetas vacías.

### Pattern 2: Firma y traducciones

```tsx
import { FC } from "react";
import { useTranslation } from "react-i18next";

type Props = {
  // tus props
};

const XComponent: FC<Props> = (props) => {
  const { t } = useTranslation("namespace"); // aliaséalo como useTranslate si existe wrapper local
  return <Wrapper>{t("namespace.key")}</Wrapper>;
};
```

- Usa `FC<Props>` y arrow function.
- Todo copy va en traducciones; crea/actualiza el JSON correspondiente y usa el hook de traducción del proyecto (`useTranslate`/`useTranslation`).
- Si usas MUI, consulta props/comportamiento con el MCP de MUI (elige la versión según `package.json`).

### Pattern 3: Estilos y datos

```tsx
// styles.ts
export const Wrapper = styled.div(({ theme }) => ({
  display: "flex",
  color: theme.palette.primaryApp,
}));
```

- Siempre Styled Components con theme (colores desde `palette`, no primario default de MUI).
- Para datos/HTTP:
  - `infrastructure/services.ts`: handlers con el axios instance correcto.
  - `infrastructure/useServices.ts`: React Query (`useQuery`/`useMutation`) usando esos handlers; favorece optimistic updates.
  - Custom hooks en `hooks/` para separar lógica de la UI.

### Pattern 4: Nomenclatura en `services.ts`

- `GET` (fetch): el handler debe comenzar con `get`.
  - Ejemplo: `getNotificationTemplateDetails`.
- `PUT`: el handler debe comenzar con `update`.
  - Ejemplo: `updateNotificationTemplateSubject`.
- `POST`: el handler puede comenzar directamente con el nombre de la acción (sin prefijo obligatorio).
  - Ejemplo: `sendNotificationTemplateTestEmail`, `rollbackHeaderContent`.
- `PATCH`: misma regla que `POST` (sin prefijo obligatorio).
  - Ejemplo: `toggleNotificationStatus`.
- `DELETE`: el handler debe comenzar con `delete`.
  - Ejemplo: `deleteNotificationTemplate`.

### Pattern 5: Guardrails Anti-Warnings (React)

- Keys de listas:
  - Nunca uses objetos como `key` (`key={item}` cuando `item` es objeto termina en `[object Object]`).
  - Usa una key primitiva y estable (`id`, `slug`, `employee_id`, etc.).
  - Evita `index` como `key` salvo casos controlados de skeletons estáticos.

---

## Decision Tree

```
¿Solo UI? → Crea carpeta XComponent con XComponent.tsx + styles.ts + index.ts.
¿Hay tipos compartidos? → Agrega types.ts y tipa Props/handlers.
¿Lógica reusable? → Crea hooks/useXComponent.ts (y más hooks específicos si se necesitan).
¿HTTP o datos remotos? → infrastructure/services.ts + infrastructure/useServices.ts con React Query y axios instances.
¿Usas MUI? → Apóyate en MCP MUI para props/slots y ajusta estilos con Styled Components + theme.
¿Texto nuevo? → Añade clave en `src/translations` y úsala con `useTranslate`/`useTranslation`.
```

---

## Code Examples

### Example 1: Componente básico

```tsx
// XComponent/XComponent.tsx
import { FC } from "react";
import { useTranslation } from "react-i18next";
import { Wrapper, Title } from "./styles";
import type { Props } from "./types";

const XComponent: FC<Props> = ({ titleKey }) => {
  const { t } = useTranslation("namespace");
  return (
    <Wrapper>
      <Title>{t(titleKey)}</Title>
    </Wrapper>
  );
};

export default XComponent;
```

```tsx
// XComponent/styles.ts
import styled from "styled-components";

export const Wrapper = styled.section(({ theme }) => ({
  display: "flex",
  gap: "12px",
  color: theme.palette.primary.main,
}));

export const Title = styled.h3(() => ({
  fontSize: "18px",
  fontWeight: "bold",
}));
```

```ts
// XComponent/types.ts
export type Props = {
  titleKey: string;
};
```

### Example 2: React Query + servicios

```ts
// XComponent/infrastructure/services.ts
import { mainInstance } from "src/config/axiosInstance";

export const getItems = (id: number) => mainInstance.get(`/items/${id}`);
export const createItem = (payload: Payload) =>
  mainInstance.post("/items", payload);
export const getItemsFromPy = () => mainInstance.get("/items");
export const deleteItemInNineBox = (id: number) =>
  mainInstance.delete(`/items/${id}`);
```

```ts
// XComponent/infrastructure/useServices.ts
// Los mensajes casi siempre van con ese formato, pero en su totalidad siempre van en un objeto httpRequest dentro de las traducciones, con una clave específica para cada acción (ej: handleCreateItemSuccess o handleCreateItemError).
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getItems, createItem } from "./services";

export const useItems = ({ id, enabled }) =>
  useQuery({
    queryKey: ["items", id],
    queryFn: () => getItems(id),
    enabled,
  });

export const useCreateItem = () => {
  const client = useQueryClient();
  const { t } = useTranslation();

  type Args = {
    payload: Payload;
    callback?: (data: any) => void;
  };

  return useMutation({
    mutationFn: ({ payload }: Args) => createItem(payload),
    onSuccess: (data, { callback }) => {
      client.invalidateQueries({ queryKey: ["items"] });
      <!-- Falta implementar sonner para los toast -->
      if (callback) callback(data);
    },
    onError: (error) =>
      <!-- Toca implementarlo mas adelante -->
      <!-- handleQueryError({
        error,
        errorMessage: t("common:items.httpRequest.handleCreateItemError"),
        t,
      }), -->
  });
};
```

---

## Resources

- Plantilla: usa este SKILL.md como guía base para nuevos componentes.
