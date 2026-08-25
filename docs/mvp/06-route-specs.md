# Route Specs — Nodia Parte 1

> Estado: aprobado
> Última actualización: 2026-08-22
> Dependencias: 03-domain-model-erd.md, 04-prd-v2.md y 05-sitemap.md aprobados

## Objetivo

Especificar el comportamiento, los requerimientos de datos y los controles de acceso de cada ruta definida en el Sitemap para que pueda implementarse de manera estandarizada y sin ambigüedades.

## Especificaciones de Rutas

### 1. `/` (Home)
- **Roles:** Visitante, Usuario autenticado.
- **Acceso:** Público (siempre accesible).
- **Componentes UI:** Header principal (con botón de login si es visitante, o perfil/menú si está autenticado), grilla de módulos funcionales disponibles.
- **Data (Frontend):** Lee los módulos funcionales del contexto de autorización o IndexedDB. (Nota: en la Parte 1 no hay módulos funcionales).
- **API (Backend):** Ninguna llamada directa a base de datos para cargar vistas funcionales (salvo validación de sesión pasiva).
- **Acciones:**
  - Hacer clic en iniciar sesión redirige a `/login` (solo visitantes).
  - Mostrar un enlace a `/settings` en el Header si el usuario tiene rol de `super admin`.

### 2. `/login`
- **Roles:** Visitante.
- **Acceso:** Solo visitantes. Si un usuario ya autenticado entra, se redirige a `/`.
- **Componentes UI:** Pantalla de inicio de sesión minimalista. Botón "Iniciar sesión con Google".
- **Data (Frontend):** Implementa librería React OAuth2 Google para obtener token/credencial de Google.
- **API (Backend):** `POST /api/auth/login` enviando el token de Google. El backend valida, establece la sesión y retorna el Contexto de Autorización.
- **Acciones:**
  - Éxito: Redirigir a `/` (o URL intentada) con sesión activa.
  - Rechazo (correo no existe, no permitido o inactivo): Mostrar Toast de error genérico.

### 3. `/404` (Not Found)
- **Roles:** Todos.
- **Acceso:** Público.
- **Componentes UI:** Pantalla de error indicando ruta no encontrada o que no posee permisos para ver la página.
- **Acciones:** Botón para "Volver al inicio" (`/`).

### 4. `/maintenance`
- **Roles:** Todos.
- **Acceso:** Público.
- **Componentes UI:** Pantalla bloqueante que indica que el sistema está en mantenimiento.
- **Acciones:** El sistema podría redirigir aquí globalmente por una flag en la respuesta de las APIs.

### 5. `/settings` (Dashboard Ajustes Generales)
- **Roles:** Super admin.
- **Acceso:** Requiere sesión activa y permiso de acceso al módulo de Ajustes Generales.
- **Componentes UI:** Layout administrativo con menú lateral (Users, Modules, Resources, Roles) y una vista principal tipo dashboard de bienvenida.

### 6. `/settings/users`
- **Roles:** Super admin.
- **Acceso:** Requiere permiso `view` sobre el recurso `Users`.
- **Componentes UI:**
  - Tabla de usuarios con columnas: Email, Name, Allowed, Active, Roles.
  - Búsqueda/Filtro por correo o estado.
  - Paginación conectada al servidor (server-side).
  - Botón "Nuevo Usuario" que abre un modal de creación.
  - Por cada fila: botón Editar (abre modal), Activar/Desactivar.
- **API (Backend):**
  - `GET /api/users` (lista paginada).
  - `POST /api/users` (crear, requiere permiso `create`).
  - `PUT /api/users/:id` (actualizar, requiere permiso `update`).
- **Acciones:** Impedir desactivar o quitar rol al último super admin operativo.

### 7. `/settings/modules`
- **Roles:** Super admin.
- **Acceso:** Requiere permiso `view` sobre el recurso `Modules`.
- **Componentes UI:**
  - Tabla o lista anidada (Módulos > Submódulos).
  - Paginación conectada al servidor (server-side).
  - Botón "Nuevo" (modal de creación).
  - Acciones: Editar (modal), Activar/Desactivar.
- **API (Backend):**
  - `GET /api/modules` (lista paginada).
  - `POST /api/modules` (crear).
  - `PUT /api/modules/:id` (actualizar label, estado). NOTA: `key` es inmutable tras creación.

### 8. `/settings/resources`
- **Roles:** Super admin.
- **Acceso:** Requiere permiso `view` sobre el recurso `Resources`.
- **Componentes UI:**
  - Tabla de recursos indicando a qué Módulo/Submódulo pertenece.
  - Paginación conectada al servidor (server-side).
  - Botón "Nuevo" (modal de creación).
  - Acciones: Editar (modal), Activar/Desactivar.
- **API (Backend):**
  - `GET /api/resources` (lista paginada).
  - `POST /api/resources` (crear).
  - `PUT /api/resources/:id` (actualizar nombre, comentario, estado).

### 9. `/settings/roles`
- **Roles:** Super admin.
- **Acceso:** Requiere permiso `view` sobre el recurso `Roles`.
- **Componentes UI:**
  - Tabla de roles.
  - Paginación conectada al servidor (server-side).
  - Botón "Nuevo" (modal de creación).
  - El modal de creación/edición incluye una matriz o formulario de permisos (Recursos vs Acciones: view, create, update, delete) para vincular al rol.
- **API (Backend):**
  - `GET /api/roles` (lista paginada).
  - `GET /api/roles/:id` (detalles y permisos asignados para el modal).
  - `POST /api/roles` (crear).
  - `PUT /api/roles/:id` (actualizar y asignar/desasignar permisos).

## Hechos confirmados
- Se usa React OAuth2 Google en `/login`, eliminando rutas específicas de callback en frontend.
- Todas las operaciones CRUD de Ajustes Generales se resuelven en modales in-place, eliminando rutas dedicadas como `/:id` o `/new`.
- La clave semántica (`key`) de los módulos y recursos es inmutable una vez creada.
- El acceso administrativo (`/settings`) se provee mediante un enlace en el Header de `Home` exclusivo para usuarios con rol `super admin`.
- Las tablas administrativas (Usuarios, Módulos, Recursos, Roles) implementarán paginación asíncrona desde el servidor (server-side) desde el inicio.

## Preguntas abiertas
- Ninguna.
