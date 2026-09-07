# Contrato de API — Módulo de Roles (`Roles`)

> **Módulo:** `generalSettings/pages/Roles`  
> **Versión de API:** `v1` (`/api/v1`)  
> **Fecha de creación:** 2026-08-28  
> **Convención de filtrado:** Ransack (`q[campo_predicado]`)

---

## 1. Convenciones Generales

### Filtrado estilo Ransack

Todos los endpoints de tipo `GET` aceptan el parámetro `q` para aplicar predicados de búsqueda y filtrado dinámico.

Ejemplos comunes de predicados:

- `q[key_cont]`: Búsqueda parcial / `ILIKE` en el identificador o key del rol.
- `q[is_active_eq]`: Coincidencia exacta booleana (`true` / `false`).
- `q[actions_id_in][]` o `q[actions_id_eq]`: Filtrado por IDs de acciones asociadas.
- `q[actions_key_cont]`: Búsqueda por identificador de acciones.
- `q[s]`: Ordenamiento (ej. `created_at desc`, `key asc`).

### Paginación

Los endpoints que devuelven listados paginados admiten los siguientes `queryParams`:

- `page`: Número de página actual (entero `1`-indexed, default: `1`).
- `size`: Cantidad de registros por página (entero, ej: `10`, `25`, `50`).
- `all`: Booleano opcional (`true` / `false`). Si es `true`, ignora la paginación y retorna la totalidad de registros que cumplan con `q`.

### Inclusión de Relaciones (`includes`)
Los endpoints de tipo `GET` de listado aceptan el parámetro booleano opcional `includes` (default: `true`).
- `includes=true` (o no enviado): Retorna las entidades con sus relaciones cargadas (`eager loading` / joins). En Roles, incluye el arreglo de acciones asociadas (`actions: Action[]`).
- `includes=false`: Omite las relaciones y retorna únicamente los campos propios de la entidad base (`actions` omitido o vacío `[]`).
- En caso de que el endpoint o entidad no disponga de relaciones, el parámetro es inocuo y no produce error.
- **Sustitución de endpoints de filtros:** Para poblar selectores, combos o autocompletados de roles o acciones de forma liviana, se consumen directamente los endpoints principales con `all=true&includes=false` (ej. `/api/v1/roles?all=true&includes=false` o `/api/v1/actions?all=true&includes=false`), habiendo quedado eliminados los endpoints dedicados `/api/v1/filters/*`.

### Borrado Lógico

No existe el endpoint `DELETE`. La desactivación/eliminación lógica se realiza mediante `PUT /api/v1/role/:roleId` estableciendo `is_active: false`.

---

## 2. Definición de Entidades y Tipos (TypeScript)

```typescript
export interface Action {
  id: string; // UUID
  module_id: string; // UUID del módulo al que pertenece
  key: string; // Identificador único de la acción (ej. "users.create", "roles.manage")
  description: string | null; // Descripción funcional o técnica de la acción
  is_active: boolean; // Estado de la acción
  created_at?: string; // ISO 8601
  updated_at?: string; // ISO 8601
}

export interface Role {
  id: string; // ID del rol
  key: string; // Clave de traducción / identificador único del rol (ej. "admin", "manager")
  is_active: boolean; // Estado de activación / borrado lógico
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
  actions?: Action[]; // Arreglo de objetos Action asociados si includes=true; omitido o vacío si includes=false
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

export interface GetRolesParams {
  page?: number;
  size?: number;
  all?: boolean;
  includes?: boolean; // Default: true. Si es false, omite las acciones asociadas
  q?: Record<string, unknown>;
}
```

---

## 3. Especificación de Endpoints

### 3.1. Fetch Roles (Listado Principal)

Obtiene el listado paginado y filtrable de roles. Si `includes=false`, omite la inclusión del arreglo completo de `actions`, acelerando la carga para selectores o tablas que no requieran listar los permisos asociados.

- **Método:** `GET`
- **Ruta:** `/api/v1/roles`
- **Query Params:**
  - `page` _(opcional, number)_: Página actual.
  - `size` _(opcional, number)_: Elementos por página.
  - `all` _(opcional, boolean)_: Traer todos sin paginar.
  - `includes` _(opcional, boolean, default: `true`)_: Si es `false`, omite el array `actions` asociado a cada rol.
  - `q[campo_predicado]` _(opcional)_: Filtros Ransack (`q[key_cont]`, `q[is_active_eq]`, `q[actions_id_in][]`, etc.).

#### Respuesta exitosa con relaciones (`includes=true` o por defecto, `200 OK`):

```json
{
  "data": [
    {
      "id": "1",
      "key": "admin",
      "is_active": true,
      "created_at": "2026-08-01T10:00:00.000Z",
      "updated_at": "2026-08-20T14:32:00.000Z",
      "actions": [
        {
          "id": "10",
          "module_id": "1",
          "key": "users.create",
          "description": "Permite registrar nuevos usuarios en la plataforma",
          "is_active": true,
          "created_at": "2026-08-01T10:00:00.000Z",
          "updated_at": "2026-08-01T10:00:00.000Z"
        },
        {
          "id": "11",
          "module_id": "1",
          "key": "users.read",
          "description": "Permite visualizar el listado y detalle de usuarios",
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
      "key": "admin",
      "is_active": true,
      "created_at": "2026-08-01T10:00:00.000Z",
      "updated_at": "2026-08-20T14:32:00.000Z",
      "actions": []
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

### 3.2. Create Role

Crea un nuevo rol en el sistema y le asocia las acciones indicadas.

- **Método:** `POST`
- **Ruta:** `/api/v1/role`
- **Headers:** `Content-Type: application/json`
- **Body (`JSON`):**

| Campo       | Tipo       | Requerido | Descripción                                                            |
| :---------- | :--------- | :-------- | :--------------------------------------------------------------------- |
| `key`       | `string`   | **Sí**    | Identificador o clave única del rol (ej: `"super_admin"`, `"editor"`). |
| `actions`   | `string[]` | No        | Arreglo de IDs (UUIDs) de acciones asignadas (o `[]`).                 |
| `is_active` | `boolean`  | No        | Estado del rol (Default: `true`).                                      |

#### Ejemplo de Request Body:

```json
{
  "key": "supervisor",
  "is_active": true,
  "actions": [
    "a1114567-e89b-12d3-a456-426614174002",
    "a2224567-e89b-12d3-a456-426614174001"
  ]
}
```

#### Respuesta exitosa (`201 Created`):

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174099",
  "key": "supervisor",
  "is_active": true,
  "created_at": "2026-08-28T01:00:00.000Z",
  "updated_at": "2026-08-28T01:00:00.000Z",
  "actions": [
    {
      "id": "a1114567-e89b-12d3-a456-426614174002",
      "module_id": "m1114567-e89b-12d3-a456-426614174001",
      "key": "users.read",
      "description": "Permite visualizar el listado y detalle de usuarios",
      "is_active": true,
      "created_at": "2026-08-01T10:00:00.000Z",
      "updated_at": "2026-08-01T10:00:00.000Z"
    },
    {
      "id": "a2224567-e89b-12d3-a456-426614174001",
      "module_id": "m2224567-e89b-12d3-a456-426614174002",
      "key": "roles.manage",
      "description": "Permite crear y editar roles de acceso",
      "is_active": true,
      "created_at": "2026-08-01T10:00:00.000Z",
      "updated_at": "2026-08-01T10:00:00.000Z"
    }
  ]
}
```

---

### 3.3. Update Role

Actualiza los datos, identificador o acciones de un rol existente. También se utiliza para la desactivación lógica (`is_active: false`).

- **Método:** `PUT`
- **Ruta:** `/api/v1/role/:roleId`
- **Path Params:** `roleId` (string, UUID del rol)
- **Headers:** `Content-Type: application/json`
- **Body (`JSON`):** _(todos los campos son opcionales)_

| Campo       | Tipo       | Requerido | Descripción                                   |
| :---------- | :--------- | :-------- | :-------------------------------------------- |
| `key`       | `string`   | No        | Identificador o clave única del rol.          |
| `actions`   | `string[]` | No        | Arreglo de IDs (UUIDs) de acciones asignadas. |
| `is_active` | `boolean`  | No        | Estado de activación/borrado lógico.          |

#### Ejemplo de Request Body:

```json
{
  "key": "supervisor_editado",
  "is_active": true,
  "actions": [
    "a1114567-e89b-12d3-a456-426614174001",
    "a1114567-e89b-12d3-a456-426614174002"
  ]
}
```

#### Respuesta exitosa (`200 OK`):

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174099",
  "key": "supervisor_editado",
  "is_active": true,
  "created_at": "2026-08-28T01:00:00.000Z",
  "updated_at": "2026-08-28T01:10:00.000Z",
  "actions": [
    {
      "id": "a1114567-e89b-12d3-a456-426614174001",
      "module_id": "m1114567-e89b-12d3-a456-426614174001",
      "key": "users.create",
      "description": "Permite registrar nuevos usuarios en la plataforma",
      "is_active": true,
      "created_at": "2026-08-01T10:00:00.000Z",
      "updated_at": "2026-08-01T10:00:00.000Z"
    },
    {
      "id": "a1114567-e89b-12d3-a456-426614174002",
      "module_id": "m1114567-e89b-12d3-a456-426614174001",
      "key": "users.read",
      "description": "Permite visualizar el listado y detalle de usuarios",
      "is_active": true,
      "created_at": "2026-08-01T10:00:00.000Z",
      "updated_at": "2026-08-01T10:00:00.000Z"
    }
  ]
}
```

---

## 4. Obtención de Opciones para Selectores y Filtros (Sin Endpoints Dedicados)

Los endpoints anteriores `/api/v1/filters/*` han sido **eliminados**. Para poblar selectores, filtros o combos de roles o de acciones asociadas (ej. en el modal de asignación de permisos de roles o en filtros de usuarios), se consumen directamente los endpoints principales con `all=true` e `includes=false`:

1. **Para obtener el catálogo de roles (ej. selectores o filtros):**  
   - **Ruta:** `GET /api/v1/roles?all=true&includes=false`
   - **Comportamiento:** Retorna todos los roles activos sin resolver el arreglo de acciones asociadas (`actions: []` o excluido).

2. **Para obtener el catálogo de acciones disponibles para asignar a un rol:**  
   - **Ruta:** `GET /api/v1/actions?all=true&includes=false`
   - **Comportamiento:** Retorna todas las acciones del sistema sin relaciones complejas para ser seleccionadas en el formulario de roles (`RoleModal`).
