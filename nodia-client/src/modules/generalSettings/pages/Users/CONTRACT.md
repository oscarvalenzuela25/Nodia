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

### Inclusión de Relaciones (`includes`)
Los endpoints de tipo `GET` de listado aceptan el parámetro booleano opcional `includes` (default: `true`).
- `includes=true` (o no enviado): Retorna las entidades con sus relaciones cargadas (`eager loading` / joins). En Users, incluye el arreglo de roles asociados (`roles: RoleSummary[]`).
- `includes=false`: Omite las relaciones y retorna únicamente los campos propios de la entidad base (`roles` omitido o vacío `[]`).
- En caso de que el endpoint o entidad no disponga de relaciones, el parámetro es inocuo y no produce error.
- **Sustitución de endpoints de filtros:** Para poblar selectores, combos o autocompletados de usuarios o roles de forma liviana, se consumen directamente los endpoints principales con `all=true&includes=false` (ej. `/api/v1/users?all=true&includes=false` o `/api/v1/roles?all=true&includes=false`), habiendo quedado eliminados los endpoints dedicados `/api/v1/filters/*`.

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
  id: string; // ID del usuario
  name: string | null;
  email: string;
  image_url: string | null;
  is_active: boolean;
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
  roles?: RoleSummary[]; // Presente si includes=true; omitido o vacío [] si includes=false
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

export interface GetUsersParams {
  page?: number;
  size?: number;
  all?: boolean;
  includes?: boolean; // Default: true. Si es false, omite el listado de 'roles'
  q?: Record<string, unknown>;
}
```

---

## 3. Especificación de Endpoints

### 3.1. Fetch Users (Listado Principal)

Obtiene el listado paginado y filtrable de usuarios. Si `includes=false`, omite la inclusión del arreglo de `roles` asociados, reduciendo el tamaño del payload cuando se consumen usuarios para selectores o listados simples.

- **Método:** `GET`
- **Ruta:** `/api/v1/users`
- **Query Params:**
  - `page` _(opcional, number)_: Página actual.
  - `size` _(opcional, number)_: Elementos por página.
  - `all` _(opcional, boolean)_: Traer todos sin paginar.
  - `includes` _(opcional, boolean, default: `true`)_: Si es `false`, omite el array `roles` asociado a cada usuario.
  - `q[campo_predicado]` _(opcional)_: Filtros Ransack (`q[name_cont]`, `q[email_cont]`, `q[is_active_eq]`, etc.).

#### Respuesta exitosa con relaciones (`includes=true` o por defecto, `200 OK`):

```json
{
  "data": [
    {
      "id": "1",
      "name": "Juan Pérez",
      "email": "juan.perez@example.com",
      "image_url": "https://lh3.googleusercontent.com/a/mock-img",
      "is_active": true,
      "created_at": "2026-08-20T14:32:00.000Z",
      "updated_at": "2026-08-26T18:15:00.000Z",
      "roles": [
        {
          "id": "10",
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

#### Respuesta exitosa sin relaciones (`includes=false`, `200 OK`):

```json
{
  "data": [
    {
      "id": "1",
      "name": "Juan Pérez",
      "email": "juan.perez@example.com",
      "image_url": "https://lh3.googleusercontent.com/a/mock-img",
      "is_active": true,
      "created_at": "2026-08-20T14:32:00.000Z",
      "updated_at": "2026-08-26T18:15:00.000Z",
      "roles": []
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

## 4. Obtención de Opciones para Selectores y Filtros (Sin Endpoints Dedicados)

Los endpoints anteriores `/api/v1/filters/*` han sido **eliminados**. Para poblar selectores, filtros o combos de usuarios o de roles asociados (ej. en el modal de asignación de roles a usuarios o filtros de auditoría), se consumen directamente los endpoints principales con `all=true` e `includes=false`:

1. **Para obtener el catálogo de usuarios (ej. selectores o combos):**  
   - **Ruta:** `GET /api/v1/users?all=true&includes=false`
   - **Comportamiento:** Retorna todos los usuarios activos sin resolver el arreglo anidado de roles (`roles: []` o excluido).

2. **Para obtener el catálogo de roles disponibles para asignar a un usuario:**  
   - **Ruta:** `GET /api/v1/roles?all=true&includes=false`
   - **Comportamiento:** Retorna todos los roles del sistema de forma liviana para poblar el selector múltiple de roles en `UserModal`.
