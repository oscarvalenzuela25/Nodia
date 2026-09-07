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
- `size`: Cantidad de registros por página (entero, ej: `10`, `25`, `50`).
- `all`: Booleano opcional (`true` / `false`). Si es `true`, ignora la paginación y retorna la totalidad de registros que cumplan con `q`.

### Inclusión de Relaciones (`includes`)
Los endpoints de tipo `GET` de listado aceptan el parámetro booleano opcional `includes` (default: `true`).
- `includes=true` (o no enviado): Retorna las entidades con sus relaciones o entidades asociadas cargadas (`eager loading` / joins). En Actions, incluye el objeto `module` asociado.
- `includes=false`: Omite las relaciones y retorna únicamente los campos propios de la entidad base (`module: null` o excluido).
- En caso de que el endpoint o entidad no disponga de relaciones, el parámetro es inocuo y no produce error.
- **Sustitución de endpoints de filtros:** Para poblar selectores, combos o autocompletados livianos, se consume directamente el endpoint principal de la entidad con `all=true&includes=false` (ej. `/api/v1/actions?all=true&includes=false`), habiendo quedado eliminados los endpoints dedicados `/api/v1/filters/*`.

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
  id: string; // ID de la acción
  module_id: string | null; // ID del módulo asociado o null
  key: string; // Clave / identificador único de la acción (ej. "users.create")
  description: string | null; // Descripción funcional de la acción
  is_active: boolean; // Estado de activación / borrado lógico
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
  module?: ModuleSummary | null; // Presente si includes=true; null/omitido si includes=false
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

export interface GetActionsParams {
  page?: number;
  size?: number;
  all?: boolean;
  includes?: boolean; // Default: true. Si es false, no incluye 'module'
  q?: Record<string, unknown>;
}
```

---

## 3. Especificación de Endpoints

### 3.1. Fetch Actions (Listado Principal)

Obtiene el listado paginado y filtrable de acciones. Si `includes=false`, omite la relación con el módulo asociado (`module`), devolviendo una respuesta más liviana apta para selectores o tablas planas.

- **Método:** `GET`
- **Ruta:** `/api/v1/actions`
- **Query Params:**
  - `page` *(opcional, number)*: Página actual.
  - `size` *(opcional, number)*: Elementos por página.
  - `all` *(opcional, boolean)*: Traer todos sin paginar.
  - `includes` *(opcional, boolean, default: `true`)*: Si es `false`, omite la relación `module` asociada en cada acción.
  - `q[campo_predicado]` *(opcional)*: Filtros Ransack (`q[key_cont]`, `q[module_id_eq]`, `q[is_active_eq]`, etc.).

#### Respuesta exitosa con relaciones (`includes=true` o por defecto, `200 OK`):
```json
{
  "data": [
    {
      "id": "1",
      "module_id": "10",
      "key": "users.create",
      "description": "Permite registrar nuevos usuarios en la plataforma y asignarles credenciales.",
      "is_active": true,
      "created_at": "2026-08-01T10:00:00.000Z",
      "updated_at": "2026-08-20T14:32:00.000Z",
      "module": {
        "id": "10",
        "key": "users",
        "is_active": true
      }
    },
    {
      "id": "2",
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

#### Respuesta exitosa sin relaciones (`includes=false`, `200 OK`):
```json
{
  "data": [
    {
      "id": "1",
      "module_id": "10",
      "key": "users.create",
      "description": "Permite registrar nuevos usuarios en la plataforma y asignarles credenciales.",
      "is_active": true,
      "created_at": "2026-08-01T10:00:00.000Z",
      "updated_at": "2026-08-20T14:32:00.000Z",
      "module": null
    },
    {
      "id": "2",
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

## 4. Obtención de Opciones para Selectores y Filtros (Sin Endpoints Dedicados)

Los endpoints anteriores `/api/v1/filters/*` han sido **eliminados**. Para poblar selectores, combos o autocompletados (como la lista de acciones o de módulos), se consumen directamente los endpoints principales con `all=true` e `includes=false`:

1. **Para obtener el catálogo de acciones (ej. para selectores o filtros):**  
   - **Ruta:** `GET /api/v1/actions?all=true&includes=false`
   - **Comportamiento:** Retorna todas las acciones activas con sus atributos propios sin resolver joins ni objetos anidados (`module: null` o excluido).

2. **Para obtener el catálogo de módulos asociados (ej. selector de módulo en ActionModal):**  
   - **Ruta:** `GET /api/v1/modules?all=true&includes=false`
   - **Comportamiento:** Retorna todos los módulos sin relaciones anidadas (`parent_module: null` o excluido).
