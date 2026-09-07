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

### Inclusión de Relaciones (`includes`)
Los endpoints de tipo `GET` de listado aceptan el parámetro booleano opcional `includes` (default: `true`).
- `includes=true` (o no enviado): Retorna las entidades con sus relaciones o entidades asociadas cargadas (`eager loading` / joins). En Modules, incluye el objeto `parent_module` asociado a los submódulos.
- `includes=false`: Omite las relaciones y retorna únicamente los campos propios de la entidad base (`parent_module: null` o excluido).
- En caso de que el endpoint o entidad no disponga de relaciones, el parámetro es inocuo y no produce error.
- **Sustitución de endpoints de filtros:** Para poblar selectores, combos o modales de jerarquía de módulos de forma liviana, se consume directamente el endpoint principal `GET /api/v1/modules?all=true&includes=false`, habiendo quedado eliminados los endpoints dedicados `/api/v1/filters/*`.

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
  id: string; // ID del módulo
  key: string; // Clave / identificador único del módulo (ej. "users", "roles")
  type: ModuleType; // 'module' o 'submodule'
  parent_id: string | null; // ID del módulo padre si es submódulo
  parent_module?: ParentModuleSummary | null; // Presente si includes=true; null/omitido si includes=false
  is_active: boolean; // Estado de activación / borrado lógico
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
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

export interface GetModulesParams {
  page?: number;
  limit?: number;
  size?: number;
  all?: boolean;
  includes?: boolean; // Default: true. Si es false, omite 'parent_module'
  q?: Record<string, unknown>;
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
  - `includes` *(opcional, boolean, default: `true`)*: Si es `false`, omite la relación `parent_module` asociada en cada submódulo.
  - `q[campo_predicado]` *(opcional)*: Filtros Ransack (`q[key_cont]`, `q[type_eq]`, `q[parent_id_eq]`, `q[is_active_eq]`, etc.).

#### Respuesta exitosa con relaciones (`includes=true` o por defecto, `200 OK`):
```json
{
  "data": [
    {
      "id": "1",
      "key": "general_settings",
      "type": "module",
      "parent_id": null,
      "parent_module": null,
      "is_active": true,
      "created_at": "2026-08-01T10:00:00.000Z",
      "updated_at": "2026-08-01T10:00:00.000Z"
    },
    {
      "id": "2",
      "key": "users",
      "type": "submodule",
      "parent_id": "1",
      "parent_module": {
        "id": "1",
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

#### Respuesta exitosa sin relaciones (`includes=false`, `200 OK`):
```json
{
  "data": [
    {
      "id": "1",
      "key": "general_settings",
      "type": "module",
      "parent_id": null,
      "parent_module": null,
      "is_active": true,
      "created_at": "2026-08-01T10:00:00.000Z",
      "updated_at": "2026-08-01T10:00:00.000Z"
    },
    {
      "id": "2",
      "key": "users",
      "type": "submodule",
      "parent_id": "1",
      "parent_module": null,
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

## 4. Obtención de Opciones para Selectores y Filtros (Sin Endpoints Dedicados)

Los endpoints anteriores `/api/v1/filters/*` han sido **eliminados**. Para poblar selectores jerárquicos o combos de módulos (ej. seleccionar el módulo padre en `ModuleModal` o en filtros de otros módulos), se consume directamente el endpoint principal:

- **Ruta:** `GET /api/v1/modules?all=true&includes=false`
- **Comportamiento:** Retorna la totalidad de módulos y submódulos sin relaciones anidadas (`parent_module: null` o excluido). Si se requiere filtrar por tipo, se pueden agregar predicados Ransack directamente (ej. `GET /api/v1/modules?all=true&includes=false&q[type_eq]=module` para obtener únicamente módulos raíz candidatos a padre).
