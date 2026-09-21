# Panel Kanban — Módulo Businesses

> Estado: borrador preliminar para contraste con base de datos
> Fecha de creación: 2026-09-15
> Dependencias: Documentos 01 al 04 de `docs/features/businesses/`

---

## Épica 1: Modelo de Datos y Migraciones
* [ ] **[TB1.1] Migraciones de Base de Datos:** Crear migraciones TypeORM para las tablas `businesses`, `business_actions`, `business_collaborators`, `business_collaborator_actions`, `providers`, `invoice_fields`, `products`, `product_logs`, `invoices` e `invoice_items` (con PKs `bigint` autoincrementales, índices optimizados y borrados lógicos).
* [ ] **[TB1.2] Entidades TypeORM:** Implementar clases de entidades en `nodia-server/src/businesses/` utilizando `Relation<T>` para relaciones bidireccionales.
* [ ] **[TB1.3] Seeder de Acciones de Negocio:** Sembrar el catálogo de `business_actions` (`products:view`, `invoices:upload`, `collaborators:manage`, etc.).

---

## Épica 2: Backend Core — Negocios, Colaboración y Proveedores
* [ ] **[TB2.1] Casos de Uso de Negocios:** Crear, editar, listar y obtener detalle de negocios verificando pertenencia como Owner o Colaborador.
* [ ] **[TB2.2] Guard de Contexto (`BusinessContextGuard`):** Implementar guard en NestJS que verifique la pertenencia al negocio e intercepte permisos contextuales de `business_actions` (con bypass automático para el Owner).
* [ ] **[TB2.3] Gestión de Colaboradores:** Endpoints para invitar usuarios registrados por email, asignar/modificar acciones y desvincular colaboradores.
* [ ] **[TB2.4] Catálogo de Acciones:** Endpoint para listar las `business_actions` disponibles en el sistema.
* [ ] **[TB2.5] CRUD de Proveedores y Mapeo:** Endpoints para gestionar proveedores (costo delivery, inclusión en costo final) y su plantilla `invoice_fields`.

---

## Épica 3: Backend — Productos y Control de Precios
* [ ] **[TB3.1] CRUD de Productos:** Endpoints paginados con búsqueda y filtros por categoría y proveedor.
* [ ] **[TB3.2] Registro de Historial de Precios (`product_logs`):** Lógica de negocio para registrar automáticamente snapshots y variaciones en `product_logs` cada vez que se actualice un producto.
* [ ] **[TB3.3] Cálculo de Costo con Delivery:** Lógica para incorporar y prorratear el `delivery_cost` del proveedor en el costo final del producto antes de calcular el margen de venta.
* [ ] **[TB3.4] Importación Masiva CSV:** Procesamiento de archivos CSV para alta y actualización masiva de productos.
* [ ] **[TB3.5] Exportación CSV:** Endpoint que genera la exportación en streaming de los productos del negocio.

---

## Épica 4: Backend — Almacenamiento e IA de Facturas
* [ ] **[TB4.1] Servicio de Storage (`StorageService`):** Adaptador para Cloudflare R2 / S3 con soporte para subida de imágenes y generación de URLs seguras.
* [ ] **[TB4.2] Extracción con Gemini Vision:** Integración con `@google/genai` enviando la imagen de la factura con esquema estructurado estricto.
* [ ] **[TB4.3] Motor de Matching y Reconciliación:** Lógica para comparar ítems de la factura contra productos existentes del negocio por SKU y texto, calculando deltas de variación de costo.
* [ ] **[TB4.4] Aplicación de Factura:** Endpoint para consolidar la reconciliación y actualizar el inventario.

---

## Épica 5: Frontend — Mantenedor de Negocios (`/businesses`)
* [ ] **[TB5.1] Layout y Grid de Tarjetas:** Vista principal con tarjetas de negocio diferenciando `Owner` vs `Colaborador`, Skeleton de carga y Empty State.
* [ ] **[TB5.2] Modales de Negocio:** Modales para creación y edición de negocios con feedback mediante `sileo`.
* [ ] **[TB5.3] Modal de Colaboradores:** Interfaz para listar, invitar y asignar permisos mediante la lista de `business_actions`.

---

## Épica 6: Frontend — Detalle del Negocio y Productos (`/businesses/:id`)
* [ ] **[TB6.1] Cabecera y Navegación:** Título editable in-situ, switch de inactivación y pestañas (Productos / Analítica).
* [ ] **[TB6.2] Tabla de Productos Paginada:** Columnas completas, chips de variación de precio (+/- %), filtros y buscador con debounce.
* [ ] **[TB6.3] Formularios de Producto:** Modal para alta/edición individual e importador/exportador CSV con preview.
* [ ] **[TB6.4] Tab de Analítica Comercial:** Métricas de valor de inventario, márgenes y alertas de alzas de precios.

---

## Épica 7: Frontend — Experiencia de Conciliación de Facturas
* [ ] **[TB7.1] Drawer de Carga de Factura:** Drag-and-drop de imagen/PDF y feedback de progreso de análisis con IA.
* [ ] **[TB7.2] Tabla de Comparación y Reconciliación:** Interfaz visual donde se aprecian los productos detectados, comparación de costo anterior vs nuevo y opciones de confirmación con 1 clic.
* [ ] **[TB7.3] Descarga de Datos de Factura en CSV:** Botón para exportar la data estructurada de la factura.
