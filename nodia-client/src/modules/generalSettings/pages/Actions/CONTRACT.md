# Contrato de API — Módulo de Acciones (`Actions`)

> **Módulo:** `generalSettings/pages/Actions`  
> **Versión de API:** `v1` (`/api/v1`)  
> **Fecha de creación:** 2026-08-28  
> **Convención de filtrado:** Ransack (`q[campo_predicado]`)

---

## 1. Convenciones Generales

### Filtrado estilo Ransack
Todos los endpoints de tipo `GET` aceptan el parámetro `q` para aplicar predicados de búsqueda y filtrado dinámico.

Ejemplos comunes de predicados:
- `q[key_cont]`: Búsqueda parcial / `ILIKE` en el identificador o key del accionable.
- `q[description_cont]`: Búsqueda parcial en la descripción.
- `q[module_id_eq]`: Coincidencia por ID del módulo asociado.
- `q[module_id_null]`: Filtrado de accionables sin módulo asociado (`true` / `false`).
- `q[is_active_eq]`: Coincidencia exacta booleana (`true` / `false`).
- `q[s]`: Ordenamiento (ej. `created_at desc`, `key asc`).

### Paginación
Los endpoints que devuelven listados paginados admiten los siguientes `queryParams`:
- `page`: Número de página actual (entero `1`-indexed, default: `1`).
- `limit` / `size`: Cantidad de registros por página (entero, ej: `10`, `25`, `50`).
- `all`: Booleano opcional (`true` / `false`). Si es `true`, ignora la paginación y retorna la totalidad de registros que cumplan con `q`.

### Borrado Lógico
No existe el endpoint `DELETE`. La desactivación/eliminación lógica se realiza mediante `PUT /api/v1/action/:actionId` estableciendo `is_active: false`.

---

## 2. Definición de Entidades y Tipos (TypeScript)

```typescript
export interface ModuleSummary {
  id: string; // UUID
  key: string; // Clave de traducción del módulo (ej. "users", "roles")
  is_active: boolean;
}

export interface Action {
  id: string; // UUID
  module_id: string | null; // UUID del módulo asociado o null
  key: string; // Clave / identificador único de la acción (ej. "users.create")
  description: string | null; // Descripción funcional de la acción
  is_active: boolean; // Estado de activación / borrado lógico
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
  module?: ModuleSummary | null; // Datos resumidos del módulo asociado
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

### 3.1. Fetch Actions (Listado Principal)

Obtiene el listado paginado y filtrable de acciones con sus módulos asociados.

- **Método:** `GET`
- **Ruta:** `/api/v1/actions`
- **Query Params:**
  - `page` *(opcional, number)*: Página actual.
  - `limit` o `size` *(opcional, number)*: Elementos por página.
  - `all` *(opcional, boolean)*: Traer todos sin paginar.
  - `q[campo_predicado]` *(opcional)*: Filtros Ransack (`q[key_cont]`, `q[module_id_eq]`, `q[is_active_eq]`, etc.).

#### Respuesta exitosa (`200 OK`):
```json
{
  "data": [
    {
      "id": "a1114567-e89b-12d3-a456-426614174001",
      "module_id": "m1114567-e89b-12d3-a456-426614174001",
      "key": "users.create",
      "description": "Permite registrar nuevos usuarios en la plataforma y asignarles credenciales.",
      "is_active": true,
      "created_at": "2026-08-01T10:00:00.000Z",
      "updated_at": "2026-08-20T14:32:00.000Z",
      "module": {
        "id": "m1114567-e89b-12d3-a456-426614174001",
        "key": "users",
        "is_active": true
      }
    },
    {
      "id": "a5554567-e89b-12d3-a456-426614174001",
      "module_id": null,
      "key": "audit.logs",
      "description": "Permite consultar el registro histórico de eventos y cambios de seguridad.",
      "is_active": true,
      "created_at": "2026-08-01T10:00:00.000Z",
      "updated_at": "2026-08-01T10:00:00.000Z",
      "module": null
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total_items": 2,
    "total_pages": 1
  }
}
```

---

### 3.2. Create Action

Crea un nuevo accionable en el sistema.

- **Método:** `POST`
- **Ruta:** `/api/v1/action`
- **Headers:** `Content-Type: application/json`
- **Body (`JSON`):**

| Campo | Tipo | Requerido | Descripción |
| :--- | :--- | :--- | :--- |
| `key` | `string` | **Sí** | Identificador o clave única de la acción (ej: `"users.create"`). |
| `module_id` | `string \| null` | No | ID (UUID) del módulo al que pertenece o `null`. |
| `description` | `string \| null` | No | Descripción funcional o técnica. |
| `is_active` | `boolean` | No | Estado del accionable (Default: `true`). |

#### Ejemplo de Request Body:
```json
{
  "key": "roles.delete",
  "module_id": "m2224567-e89b-12d3-a456-426614174002",
  "description": "Permite dar de baja roles en el sistema",
  "is_active": true
}
```

#### Respuesta exitosa (`201 Created`):
```json
{
  "id": "a9994567-e89b-12d3-a456-426614174099",
  "module_id": "m2224567-e89b-12d3-a456-426614174002",
  "key": "roles.delete",
  "description": "Permite dar de baja roles en el sistema",
  "is_active": true,
  "created_at": "2026-08-28T01:00:00.000Z",
  "updated_at": "2026-08-28T01:00:00.000Z",
  "module": {
    "id": "m2224567-e89b-12d3-a456-426614174002",
    "key": "roles",
    "is_active": true
  }
}
```

---

### 3.3. Update Action

Actualiza los datos de un accionable existente o realiza su borrado lógico (`is_active: false`).

- **Método:** `PUT`
- **Ruta:** `/api/v1/action/:actionId`
- **Path Params:** `actionId` (string, UUID de la acción)
- **Headers:** `Content-Type: application/json`
- **Body (`JSON`):** *(todos los campos son opcionales)*

| Campo | Tipo | Requerido | Descripción |
| :--- | :--- | :--- | :--- |
| `key` | `string` | No | Identificador o clave única de la acción. |
| `module_id` | `string \| null` | No | ID del módulo asociado o `null`. |
| `description` | `string \| null` | No | Descripción funcional. |
| `is_active` | `boolean` | No | Estado de activación/borrado lógico. |

#### Ejemplo de Request Body:
```json
{
  "description": "Descripción actualizada del accionable",
  "is_active": true
}
```

#### Respuesta exitosa (`200 OK`):
```json
{
  "id": "a9994567-e89b-12d3-a456-426614174099",
  "module_id": "m2224567-e89b-12d3-a456-426614174002",
  "key": "roles.delete",
  "description": "Descripción actualizada del accionable",
  "is_active": true,
  "created_at": "2026-08-28T01:00:00.000Z",
  "updated_at": "2026-08-28T01:10:00.000Z",
  "module": {
    "id": "m2224567-e89b-12d3-a456-426614174002",
    "key": "roles",
    "is_active": true
  }
}
```

---

## 4. Endpoints de Opciones de Filtros (Filters)

Estos endpoints proveen datos optimizados para selectores y modales de filtros.

### 4.1. Fetch Filter Actions
Obtiene el listado ligero de acciones para autocompletados y selectores.

- **Método:** `GET`
- **Ruta:** `/api/v1/filters/actions`
- **Query Params:** `q[campo_predicado]` *(opcional)*

#### Respuesta exitosa (`200 OK`):
```json
[
  {
    "id": "a1114567-e89b-12d3-a456-426614174001",
    "module_id": "m1114567-e89b-12d3-a456-426614174001",
    "key": "users.create",
    "description": "Permite registrar nuevos usuarios en la plataforma y asignarles credenciales.",
    "is_active": true
  },
  {
    "id": "a2224567-e89b-12d3-a456-426614174001",
    "module_id": "m2224567-e89b-12d3-a456-426614174002",
    "key": "roles.manage",
    "description": "Permite crear, editar identificadores y asignar acciones permitidas a roles.",
    "is_active": true
  }
]
```

---

### 4.2. Fetch Filter Modules
Obtiene el catálogo de módulos del sistema para asociar a los accionables.

- **Método:** `GET`
- **Ruta:** `/api/v1/filters/modules`
- **Query Params:** `q[campo_predicado]` *(opcional)*

#### Respuesta exitosa (`200 OK`):
```json
[
  {
    "id": "m1114567-e89b-12d3-a456-426614174001",
    "key": "users",
    "is_active": true
  },
  {
    "id": "m2224567-e89b-12d3-a456-426614174002",
    "key": "roles",
    "is_active": true
  },
  {
    "id": "m3334567-e89b-12d3-a456-426614174003",
    "key": "settings",
    "is_active": true
  }
]
```
