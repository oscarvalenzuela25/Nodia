# Contrato de API — Módulo de Usuarios (`Users`)

> **Módulo:** `generalSettings/pages/Users`  
> **Versión de API:** `v1` (`/api/v1`)  
> **Fecha de creación:** 2026-08-28  
> **Convención de filtrado:** Ransack (`q[campo_predicado]`)

---

## 1. Convenciones Generales

### Filtrado estilo Ransack

Todos los endpoints de tipo `GET` aceptan el parámetro `q` para aplicar predicados de búsqueda y filtrado dinámico.

Ejemplos comunes de predicados:

- `q[name_cont]`: Búsqueda parcial / `ILIKE` en el nombre.
- `q[email_cont]`: Búsqueda parcial en el correo.
- `q[is_active_eq]`: Coincidencia exacta booleana (`true` / `false`).
- `q[roles_id_in][]` o `q[roles_id_eq]`: Filtrado por roles asociados.
- `q[s]`: Ordenamiento (ej. `created_at desc`, `name asc`).

### Paginación

Los endpoints que devuelven listados paginados admiten los siguientes `queryParams`:

- `page`: Número de página actual (entero `1`-indexed, default: `1`).
- `size`: Cantidad de registros por página (entero, ej: `10`, `25`, `50`).
- `all`: Booleano opcional (`true` / `false`). Si es `true`, ignora la paginación y retorna la totalidad de registros que cumplan con `q`.

### Borrado Lógico

No existe el endpoint `DELETE`. La desactivación/eliminación lógica se realiza mediante `PUT /api/v1/user/:userId` estableciendo `is_active: false`.

---

## 2. Definición de Entidades y Tipos (TypeScript)

```typescript
export interface RoleSummary {
  id: string; // UUID
  key: string; // Clave de traducción / identificador
  is_active: boolean;
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
}

export interface User {
  id: string; // UUID
  name: string | null;
  email: string;
  image_url: string | null;
  is_active: boolean;
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
  roles: RoleSummary[];
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total_items: number;
  total_pages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}
```

---

## 3. Especificación de Endpoints

### 3.1. Fetch Users (Listado Principal)

Obtiene el listado paginado y filtrable de usuarios con sus roles asociados.

- **Método:** `GET`
- **Ruta:** `/api/v1/users`
- **Query Params:**
  - `page` _(opcional, number)_: Página actual.
  - `size` _(opcional, number)_: Elementos por página.
  - `all` _(opcional, boolean)_: Traer todos sin paginar.
  - `q[campo_predicado]` _(opcional)_: Filtros Ransack (`q[name_cont]`, `q[email_cont]`, `q[is_active_eq]`, etc.).

#### Respuesta exitosa (`200 OK`):

```json
{
  "data": [
    {
      "id": "7b8f9e60-4e2a-4a6c-9c71-3fa910e52b21",
      "name": "Juan Pérez",
      "email": "juan.perez@example.com",
      "image_url": "https://lh3.googleusercontent.com/a/mock-img",
      "is_active": true,
      "created_at": "2026-08-20T14:32:00.000Z",
      "updated_at": "2026-08-26T18:15:00.000Z",
      "roles": [
        {
          "id": "111e4567-e89b-12d3-a456-426614174001",
          "key": "admin",
          "is_active": true,
          "created_at": "2026-08-01T10:00:00.000Z",
          "updated_at": "2026-08-01T10:00:00.000Z"
        }
      ]
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total_items": 1,
    "total_pages": 1
  }
}
```

---

### 3.2. Create User

Crea un nuevo usuario en el sistema.

- **Método:** `POST`
- **Ruta:** `/api/v1/user`
- **Headers:** `Content-Type: application/json`
- **Body (`JSON`):**

| Campo       | Tipo             | Requerido | Descripción                                         |
| :---------- | :--------------- | :-------- | :-------------------------------------------------- |
| `email`     | `string`         | **Sí**    | Correo electrónico único válido.                    |
| `name`      | `string \| null` | No        | Nombre del usuario.                                 |
| `image_url` | `string \| null` | No        | URL de avatar.                                      |
| `is_active` | `boolean`        | No        | Estado del usuario (Default: `true`).               |
| `roles`     | `string[]`       | No        | Arreglo de IDs (UUIDs) de roles asignados (o `[]`). |

#### Ejemplo de Request Body:

```json
{
  "email": "nuevo.usuario@example.com",
  "name": "Carlos Santana",
  "image_url": null,
  "is_active": true,
  "roles": ["111e4567-e89b-12d3-a456-426614174001"]
}
```

#### Respuesta exitosa (`201 Created`):

```json
{
  "id": "9c8e1234-5678-4a6c-9c71-3fa910e52b99",
  "name": "Carlos Santana",
  "email": "nuevo.usuario@example.com",
  "image_url": null,
  "is_active": true,
  "created_at": "2026-08-28T01:00:00.000Z",
  "updated_at": "2026-08-28T01:00:00.000Z",
  "roles": [
    {
      "id": "111e4567-e89b-12d3-a456-426614174001",
      "key": "admin",
      "is_active": true,
      "created_at": "2026-08-01T10:00:00.000Z",
      "updated_at": "2026-08-01T10:00:00.000Z"
    }
  ]
}
```

---

### 3.3. Update User

Actualiza los datos o roles de un usuario existente. También se utiliza para la desactivación lógica (`is_active: false`).

- **Método:** `PUT`
- **Ruta:** `/api/v1/user/:userId`
- **Path Params:** `userId` (string, UUID del usuario)
- **Headers:** `Content-Type: application/json`
- **Body (`JSON`):** _(todos los campos son opcionales)_

| Campo       | Tipo             | Requerido | Descripción                                |
| :---------- | :--------------- | :-------- | :----------------------------------------- |
| `name`      | `string \| null` | No        | Nombre del usuario.                        |
| `email`     | `string`         | No        | Correo electrónico del usuario.            |
| `image_url` | `string \| null` | No        | URL de avatar.                             |
| `is_active` | `boolean`        | No        | Estado de activación/borrado lógico.       |
| `roles`     | `string[]`       | No        | Arreglo de IDs (UUIDs) de roles asignados. |

#### Ejemplo de Request Body:

```json
{
  "name": "Carlos Santana Editado",
  "is_active": true,
  "roles": [
    "111e4567-e89b-12d3-a456-426614174001",
    "222e4567-e89b-12d3-a456-426614174002"
  ]
}
```

#### Respuesta exitosa (`200 OK`):

```json
{
  "id": "9c8e1234-5678-4a6c-9c71-3fa910e52b99",
  "name": "Carlos Santana Editado",
  "email": "nuevo.usuario@example.com",
  "image_url": null,
  "is_active": true,
  "created_at": "2026-08-28T01:00:00.000Z",
  "updated_at": "2026-08-28T01:10:00.000Z",
  "roles": [
    {
      "id": "111e4567-e89b-12d3-a456-426614174001",
      "key": "admin",
      "is_active": true,
      "created_at": "2026-08-01T10:00:00.000Z",
      "updated_at": "2026-08-01T10:00:00.000Z"
    },
    {
      "id": "222e4567-e89b-12d3-a456-426614174002",
      "key": "supervisor",
      "is_active": true,
      "created_at": "2026-08-01T10:00:00.000Z",
      "updated_at": "2026-08-01T10:00:00.000Z"
    }
  ]
}
```

---

## 4. Endpoints de Opciones de Filtros (Filters)

Estos endpoints proveen datos optimizados y livianos para poblar los selectores, auto-completados y modales de filtros.

### 4.1. Fetch Filter Users

Obtiene la lista de usuarios (ej. para selectores de usuarios).

- **Método:** `GET`
- **Ruta:** `/api/v1/filters/users`
- **Query Params:** `q[campo_predicado]` _(opcional)_

#### Respuesta exitosa (`200 OK`):

```json
[
  {
    "id": "7b8f9e60-4e2a-4a6c-9c71-3fa910e52b21",
    "name": "Juan Pérez",
    "email": "juan.perez@example.com"
  },
  {
    "id": "9c8e1234-5678-4a6c-9c71-3fa910e52b99",
    "name": "Carlos Santana",
    "email": "nuevo.usuario@example.com"
  }
]
```

---

### 4.2. Fetch Filter Roles

Obtiene los roles disponibles para filtros y asignaciones en formularios.

- **Método:** `GET`
- **Ruta:** `/api/v1/filters/roles`
- **Query Params:** `q[campo_predicado]` _(opcional)_

#### Respuesta exitosa (`200 OK`):

```json
[
  {
    "id": "111e4567-e89b-12d3-a456-426614174001",
    "key": "admin",
    "is_active": true
  },
  {
    "id": "222e4567-e89b-12d3-a456-426614174002",
    "key": "supervisor",
    "is_active": true
  },
  {
    "id": "333e4567-e89b-12d3-a456-426614174003",
    "key": "user",
    "is_active": true
  }
]
```
