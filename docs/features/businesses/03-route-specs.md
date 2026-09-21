# Route Specs — Módulo Businesses

> Estado: borrador preliminar para contraste con base de datos
> Fecha de creación: 2026-09-15
> Estándares aplicados: MUI 6, TanStack Query v5, Boneyard Skeleton, Sileo Toasts, i18n `businesses:*`

---

## 1. Mapa de Rutas Frontend

| Ruta | Nombre de Pantalla | Acceso / Guard | Descripción |
|---|---|---|---|
| `/businesses` | Mantenedor de Negocios | `GuardStrict` (Sesión activa) | Grid de tarjetas de negocios propios e invitados |
| `/businesses/:id` | Detalle del Negocio | `GuardStrict` + `BusinessGuard` | Header con acciones, Analítica y Tabla de Productos |

---

## 2. Especificación de Vistas Frontend

### 2.1 Vista `/businesses` (Mantenedor de Negocios)

* **Layout:** Grid responsivo de tarjetas (`Cards`) con cabecera de página que incluye título y botón principal *"Nuevo Negocio"*.
* **Estados de Datos:**
  * `isLoading`: Skeleton de tarjetas mediante `boneyard-js/react`.
  * `isFetching`: Soft loading (leve `LinearProgress` en el tope).
  * `Empty State`: Ilustración/Icono de negocio con texto: *"No tienes ningún negocio registrado todavía. Crea tu primer negocio para empezar a gestionar tus productos y costos."* + Botón CTA *"Crear Negocio"*.
* **Componente BusinessCard:**
  * Título / Nombre del negocio.
  * Chip indicador: `Owner` (color primario) o `Colaborador` (color secundario).
  * Contador de productos activos y colaboradores.
  * Chip de estado: `Activo` (verde) / `Inactivo` (gris/neutro).
  * Menú de opciones (`IconButton` con icono `MoreVert`):
    * *Editar negocio*: Abre `BusinessEditModal`.
    * *Colaboradores*: Abre `BusinessCollaboratorsModal` (solo visible para Owner o con `collaborators:manage`).
    * *Entrar*: Redirige a `/businesses/:id`.
* **Modales Asociados:**
  * `BusinessCreateModal`: Formulario con campo `name` (validado con Zod, 3-255 caracteres) y `description`.
  * `BusinessEditModal`: Permite editar nombre y descripción.
  * `BusinessCollaboratorsModal`:
    * Listado de colaboradores actuales con sus permisos activos (chips o checkboxes).
    * Formulario para invitar: `Autocomplete` o Input de correo de usuario de Nodia + Matriz de checkboxes con las `business_actions` disponibles.

---

### 2.2 Vista `/businesses/:id` (Detalle de Negocio)

* **Cabecera del Negocio:**
  * Botón volver (`ArrowBack`) hacia `/businesses`.
  * Nombre del negocio editable (clic en icono de lápiz o inline-edit si tiene permiso `business:edit`).
  * Switch de activación/inactivación del negocio (con diálogo de confirmación `ConfirmDialog`).
  * Pestañas de navegación interna: **Productos** (activa por defecto) y **Analítica**.

#### Pestaña 1: Productos (Core)
* **Barra de Herramientas (Action Bar):**
  * Buscador por texto (busca por SKU, nombre y proveedor con debounce).
  * Filtros por categoría y rango de stock.
  * Grupo de botones de acción:
    * *"Nuevo Producto"* (abre `ProductFormModal`).
    * *"Importar CSV"* (abre `ProductCsvImportDrawer`).
    * *"Escanear Factura (IA)"* (abre `InvoiceOcrDrawer`).
    * *"Exportar CSV"* (descarga inmediata con los filtros aplicados).
* **Tabla de Productos:**
  * Columnas:
    1. **Código / SKU:** `sku` en tipografía monospace.
    2. **Producto:** `name` + `category` en subtítulo.
    3. **Costo Actual:** `cost_price` formateado en moneda.
    4. **Variación:** Chip comparando `cost_price` vs `last_cost_price` (verde con flecha abajo si bajó, rojo con flecha arriba si subió, gris si se mantuvo).
    5. **Precio Venta:** `sale_price` (y margen calculado estimado en %).
    6. **Stock / Unidad:** `current_stock` + `unit`.
    7. **Proveedor:** `supplier_name`.
    8. **Acciones:** Editar, Ver Historial de Precios, Inactivar.
* **Estados de la Tabla:**
  * `isLoading`: Filas en Skeleton con Boneyard.
  * `Empty State`: *"No hay productos registrados en este negocio. Agrega uno manualmente, importa un CSV o escanea una factura para comenzar."*
  * `Error State`: Alert con botón de reintentar + toast de error `sileo.error(...)`.

#### Pestaña 2: Analítica Comercial
* Tarjetas de KPI:
  * Valor de inventario a precio de costo.
  * Margen comercial promedio ponderado.
  * Productos con alerta de alza de precio en el último mes.
* Histórico de facturas procesadas recientemente.

---

## 3. Contratos de API Backend (NestJS)

Todos los endpoints siguen el estándar de controladores delgados delegando a casos de uso (`use-case/`). Las respuestas devuelven la estructura estandarizada de Nodia con códigos HTTP semánticos.

### 3.1 Negocios y Colaboradores

| Método | Endpoint | Permiso Requerido | Descripción |
|---|---|---|---|
| `GET` | `/api/v1/businesses` | Autenticado | Lista todos los negocios donde el usuario es Owner o Colaborador |
| `POST` | `/api/v1/businesses` | Autenticado | Crea un nuevo negocio (el creador queda como Owner) |
| `GET` | `/api/v1/businesses/:id` | `business:view` o Owner | Obtiene el detalle de un negocio y los permisos del usuario |
| `PATCH` | `/api/v1/businesses/:id` | `business:edit` o Owner | Actualiza datos generales o estado activo del negocio |
| `GET` | `/api/v1/businesses/:id/collaborators` | `collaborators:view` o Owner | Lista los colaboradores del negocio y sus acciones |
| `POST` | `/api/v1/businesses/:id/collaborators` | `collaborators:manage` o Owner | Invita un usuario existente por email y le asigna acciones |
| `PATCH` | `/api/v1/businesses/:id/collaborators/:collaboratorId` | `collaborators:manage` o Owner | Actualiza las acciones asignadas a un colaborador |
| `DELETE` | `/api/v1/businesses/:id/collaborators/:collaboratorId` | `collaborators:manage` o Owner | Da de baja lógica a un colaborador del negocio |
| `GET` | `/api/v1/business-actions` | Autenticado | Catálogo de acciones disponibles para asignar |

### 3.2 Proveedores y Mapeo de Facturas (`providers` e `invoice_fields`)

| Método | Endpoint | Permiso Requerido | Descripción |
|---|---|---|---|
| `GET` | `/api/v1/businesses/:id/providers` | `products:view` o Owner | Listado de proveedores del negocio con sus costos de delivery |
| `POST` | `/api/v1/businesses/:id/providers` | `products:create` o Owner | Crea un nuevo proveedor (nombre, costo delivery, flag de inclusión) |
| `PATCH` | `/api/v1/businesses/:id/providers/:providerId` | `products:update` o Owner | Actualiza datos del proveedor |
| `DELETE` | `/api/v1/businesses/:id/providers/:providerId` | `products:delete` o Owner | Borrado lógico del proveedor |
| `GET` | `/api/v1/businesses/:id/providers/:providerId/invoice-fields` | `products:view` o Owner | Obtiene el diccionario JSON de mapeo de factura del proveedor |
| `PUT` | `/api/v1/businesses/:id/providers/:providerId/invoice-fields` | `products:update` o Owner | Guarda o actualiza el mapeo JSON de campos para ese proveedor |

### 3.3 Productos

| Método | Endpoint | Permiso Requerido | Descripción |
|---|---|---|---|
| `GET` | `/api/v1/businesses/:id/products` | `products:view` o Owner | Listado paginado con búsqueda, orden y filtros |
| `POST` | `/api/v1/businesses/:id/products` | `products:create` o Owner | Alta manual de un producto |
| `PATCH` | `/api/v1/businesses/:id/products/:productId` | `products:update` o Owner | Modificación de un producto y registro de precio |
| `DELETE` | `/api/v1/businesses/:id/products/:productId` | `products:delete` o Owner | Borrado lógico (`is_active = false`) de un producto |
| `POST` | `/api/v1/businesses/:id/products/import-csv` | `products:create` o Owner | Carga masiva de productos vía CSV |
| `GET` | `/api/v1/businesses/:id/products/export-csv` | `products:view` o Owner | Descarga del catálogo en formato CSV |
| `GET` | `/api/v1/businesses/:id/products/:productId/price-history` | `products:view` o Owner | Historial cronológico de variaciones de costo |

### 3.4 Facturas y Procesamiento IA (OCR)

| Método | Endpoint | Permiso Requerido | Descripción |
|---|---|---|---|
| `POST` | `/api/v1/businesses/:id/invoices/analyze` | `invoices:upload` o Owner | Recibe imagen + `provider_id`. Obtiene plantilla `invoice_fields` del proveedor, almacena archivo en R2, ejecuta Gemini y devuelve items conciliados con deltas de precio y delivery |
| `POST` | `/api/v1/businesses/:id/invoices/reconcile` | `invoices:reconcile` o Owner | Aplica los precios de la factura a los productos, prorratea delivery si corresponde y guarda `product_logs` |
| `GET` | `/api/v1/businesses/:id/invoices/:invoiceId/export-csv` | `invoices:upload` o Owner | Descarga los datos extraídos de la factura en CSV |
| `PATCH` | `/api/v1/businesses/:id/ai-settings` | Owner | Guarda o remueve la API Key personal de Gemini Pro para el negocio |
