# Contrato de API — Módulo de Módulos (`Modules`)

> **Módulo:** `generalSettings/pages/Modules`  
> **Versión de API:** `v1` (`/api/v1`)  
> **Fecha de creación:** 2026-08-29  
> **Convención de filtrado:** Ransack (`q[campo_predicado]`)

---

## 1. Convenciones Generales

### Filtrado estilo Ransack
Todos los endpoints de tipo `GET` aceptan el parámetro `q` para aplicar predicados de búsqueda y filtrado dinámico.

Ejemplos comunes de predicados:
- `q[key_cont]`: Búsqueda parcial en el identificador o key del módulo.
- `q[type_eq]`: Coincidencia por tipo (`module` | `submodule`).
- `q[parent_id_eq]`: Coincidencia por ID del módulo padre.
- `q[parent_id_null]`: Filtrar módulos raíz / sin padre (`true` / `false`).
- `q[is_active_eq]`: Coincidencia exacta booleana (`true` / `false`).
- `q[s]`: Ordenamiento (ej. `created_at desc`, `key asc`).

### Paginación
Los endpoints que devuelven listados paginados admiten los siguientes `queryParams`:
- `page`: Número de página actual (entero `1`-indexed, default: `1`).
- `limit` / `size`: Cantidad de registros por página (entero, ej: `10`, `25`, `50`).
- `all`: Booleano opcional (`true` / `false`). Si es `true`, ignora la paginación y retorna la totalidad de registros que cumplan con `q`.

### Borrado Lógico
No existe el endpoint `DELETE`. La desactivación/eliminación lógica se realiza mediante `PUT /api/v1/module/:moduleId` estableciendo `is_active: false`.

---

## 2. Definición de Entidades y Tipos (TypeScript)

```typescript
export type ModuleType = "module" | "submodule";

export interface ParentModuleSummary {
  id: string; // UUID
  key: string; // Clave de traducción del módulo padre (ej. "general_settings")
  type: ModuleType;
  is_active: boolean;
}

export interface ModuleEntity {
  id: string; // UUID
  key: string; // Clave / identificador único del módulo (ej. "users", "roles")
  type: ModuleType; // 'module' o 'submodule'
  parent_id: string | null; // UUID del módulo padre si es submódulo
  parent_module: ParentModuleSummary | null; // Objeto con el módulo padre
  is_active: boolean; // Estado de activación / borrado lógico
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
}

export interface FilterModuleItem {
  id: string; // UUID
  key: string; // Clave del módulo
  type: ModuleType; // 'module' | 'submodule'
  parent_id: string | null; // UUID del módulo padre o null
  parent_key: string | null; // Clave del módulo padre o null
  is_active: boolean;
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

### 3.1. Fetch Modules (Listado Principal)

Obtiene el listado paginado y filtrable de módulos y submódulos junto con la información de su módulo padre.

- **Método:** `GET`
- **Ruta:** `/api/v1/modules`
- **Query Params:**
  - `page` *(opcional, number)*: Página actual.
  - `limit` o `size` *(opcional, number)*: Elementos por página.
  - `all` *(opcional, boolean)*: Traer todos sin paginar.
  - `q[campo_predicado]` *(opcional)*: Filtros Ransack (`q[key_cont]`, `q[type_eq]`, `q[parent_id_eq]`, `q[is_active_eq]`, etc.).

#### Respuesta exitosa (`200 OK`):
```json
{
  "data": [
    {
      "id": "m1114567-e89b-12d3-a456-426614174001",
      "key": "general_settings",
      "type": "module",
      "parent_id": null,
      "parent_module": null,
      "is_active": true,
      "created_at": "2026-08-01T10:00:00.000Z",
      "updated_at": "2026-08-01T10:00:00.000Z"
    },
    {
      "id": "m1114567-e89b-12d3-a456-426614174002",
      "key": "users",
      "type": "submodule",
      "parent_id": "m1114567-e89b-12d3-a456-426614174001",
      "parent_module": {
        "id": "m1114567-e89b-12d3-a456-426614174001",
        "key": "general_settings",
        "type": "module",
        "is_active": true
      },
      "is_active": true,
      "created_at": "2026-08-01T10:00:00.000Z",
      "updated_at": "2026-08-15T12:00:00.000Z"
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

### 3.2. Create Module

Crea un nuevo módulo o submódulo. Si `type` es `"submodule"`, `parent_id` es obligatorio.

- **Método:** `POST`
- **Ruta:** `/api/v1/module`
- **Headers:** `Content-Type: application/json`
- **Body (`JSON`):**

| Campo | Tipo | Requerido | Descripción |
| :--- | :--- | :--- | :--- |
| `key` | `string` | **Sí** | Identificador o clave única del módulo (ej: `"security"`). |
| `type` | `"module" \| "submodule"` | **Sí** | Tipo de elemento. |
| `parent_id` | `string \| null` | **Condicional** | UUID del módulo padre. **Requerido** si `type === "submodule"`. |
| `is_active` | `boolean` | No | Estado del módulo (Default: `true`). |

#### Ejemplo de Request Body:
```json
{
  "key": "audit",
  "type": "submodule",
  "parent_id": "m2224567-e89b-12d3-a456-426614174001",
  "is_active": true
}
```

#### Respuesta exitosa (`201 Created`):
```json
{
  "id": "m9994567-e89b-12d3-a456-426614174099",
  "key": "audit",
  "type": "submodule",
  "parent_id": "m2224567-e89b-12d3-a456-426614174001",
  "parent_module": {
    "id": "m2224567-e89b-12d3-a456-426614174001",
    "key": "security",
    "type": "module",
    "is_active": true
  },
  "is_active": true,
  "created_at": "2026-08-29T01:00:00.000Z",
  "updated_at": "2026-08-29T01:00:00.000Z"
}
```

---

### 3.3. Update Module

Actualiza los datos de un módulo existente o realiza su borrado lógico (`is_active: false`).

- **Método:** `PUT`
- **Ruta:** `/api/v1/module/:moduleId`
- **Path Params:** `moduleId` (string, UUID del módulo)
- **Headers:** `Content-Type: application/json`
- **Body (`JSON`):** *(campos opcionales)*

| Campo | Tipo | Requerido | Descripción |
| :--- | :--- | :--- | :--- |
| `key` | `string` | No | Identificador o clave única del módulo. |
| `type` | `"module" \| "submodule"` | No | Tipo de elemento. |
| `parent_id` | `string \| null` | No | ID del módulo padre (obligatorio si `type === "submodule"`). |
| `is_active` | `boolean` | No | Estado de activación/borrado lógico. |

#### Ejemplo de Request Body:
```json
{
  "key": "audit_logs",
  "type": "submodule",
  "parent_id": "m2224567-e89b-12d3-a456-426614174001",
  "is_active": true
}
```

#### Respuesta exitosa (`200 OK`):
```json
{
  "id": "m9994567-e89b-12d3-a456-426614174099",
  "key": "audit_logs",
  "type": "submodule",
  "parent_id": "m2224567-e89b-12d3-a456-426614174001",
  "parent_module": {
    "id": "m2224567-e89b-12d3-a456-426614174001",
    "key": "security",
    "type": "module",
    "is_active": true
  },
  "is_active": true,
  "created_at": "2026-08-29T01:00:00.000Z",
  "updated_at": "2026-08-29T01:10:00.000Z"
}
```

---

## 4. Endpoints de Opciones de Filtros (Filters)

### 4.1. Fetch Filter Modules
Obtiene el catálogo optimizado de módulos y submódulos para selectores y modales de filtros.

- **Método:** `GET`
- **Ruta:** `/api/v1/filters/modules`
- **Query Params:** `q[campo_predicado]` *(opcional)*

#### Respuesta exitosa (`200 OK`):
```json
[
  {
    "id": "m1114567-e89b-12d3-a456-426614174001",
    "key": "general_settings",
    "type": "module",
    "parent_id": null,
    "parent_key": null,
    "is_active": true
  },
  {
    "id": "m1114567-e89b-12d3-a456-426614174002",
    "key": "users",
    "type": "submodule",
    "parent_id": "m1114567-e89b-12d3-a456-426614174001",
    "parent_key": "general_settings",
    "is_active": true
  }
]
```
