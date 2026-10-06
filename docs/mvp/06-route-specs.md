# Route Specs — Nodia Parte 1

> Estado: en revisión — ampliaciones auth, Finanzas personales y Reservas; aprobación histórica del MVP conservada
> Última actualización: 2026-10-05
> Dependencias: 03-domain-model-erd.md, 04-prd-v2.md y 05-sitemap.md aprobados

## Objetivo

Especificar el comportamiento, los requerimientos de datos y los controles de acceso de cada ruta definida en el Sitemap para que pueda implementarse de manera estandarizada y sin ambigüedades.

## Ampliación: contactos en detalle de negocio — 2026-10-05

En la ruta existente de detalle de negocio, tab Proveedores, cada proveedor ofrece **Contactos**. Abre el listado bajo demanda dentro del tab; **Volver a proveedores** conserva búsqueda y paginación previas. No agrega rutas públicas ni otro módulo de navegación. Incluye búsqueda por nombre, paginación, teléfono con copiar/WhatsApp Web, email con copiar/mailto, resumen semanal por contacto, editar y activar/desactivar con ConfirmDialog.

Alta/edición en BaseModal amplio: nombre requerido; teléfonos repetibles con país Chile por defecto; email/comentario opcionales; horario de los siete días inicialmente colapsado, propio del contacto; activo. Un scroll en el cuerpo y acciones fijas. Validación, límites y recuperación ante resultados inciertos en [31](31-provider-contacts-proposal.md). Skeleton inicial informativo, refetch suave, vacío/error/reintento, controles bloqueados durante solicitudes y feedback Sileo ES/EN. Carga de código diferida sin consultas por cada fila de proveedor.

API autenticada vigente: `GET/POST /api/v1/providers/:providerId/contacts`, `PUT /api/v1/providers/:providerId/contacts/:id` y `PATCH /api/v1/providers/:providerId/contacts/:id/status`. Alcance global existente, con validación de asociación contacto/proveedor. Implementado y probado localmente; migración aplicada en la BD local configurada con respaldo previo. Sesión real, otros entornos y aprobación documental pendientes.

## Regla de navegación confirmada — 2026-09-12

La implementación separa `GuardStrict` (sesión validada y módulo asignado para cada ruta `/settings/*`) y `Guard` (permite la vista demo sin sesión para `/` y futuros módulos públicos). `NoGuard` conserva el comportamiento de login. La navegación no agrega un chequeo por nombre de rol; las reglas administrativas de operaciones continúan en la autorización fina del backend.

El acceso directo por URL tiene los mismos requisitos que el menú: se carga el contexto antes de montar la página; sin sesión se dirige a `/login`, sin módulo a `/404`, y si el contexto falla se permite reintentar sin cargar datos administrativos. Los enlaces y tarjetas solo muestran módulos asignados a una sesión validada. Detalle: [14-authentication.md](14-authentication.md).

## Especificaciones de Rutas

### Carga de código por ruta — 2026-10-05

Las páginas mantienen `lazyWithRetry` y code splitting. `RouteContent` identifica su límite Suspense por `pathname` para mostrar el fallback al navegar a una pantalla cuyo código aún no se descargó, incluso bajo las transiciones de React Router. En páginas internas se conserva el menú/cabecera y aparece un `CircularProgress` centrado con `core:loading_route` (ES/EN); en páginas públicas se usa la variante de pantalla completa.

Cambiar solo query/hash conserva la instancia de página y sus borradores. Los módulos ya descargados no tienen espera artificial. Los fallos de importación siguen llegando al error de ruta existente con reintento, y la recuperación de chunks obsoletos no cambia. Este indicador cubre la carga de código; consultas de datos y recuperación de sesión conservan sus estados específicos.

Comprobado localmente: regresión del router real Negocios → Usuarios con importación diferida (fallaba antes de la corrección), acceso inicial público/interno, código cacheado, borrador conservado al navegar con teclado por query/hash y fallo de importación. Suite Client: 847 pruebas en 149 archivos; build/tipado/lint correctos. Navegador con fixture local de demora controlada, escritorio claro ES y móvil 390 px oscuro EN; sin API ni sesión real.

### Ampliación: `/finances/personal`

- Acceso: sesión activa y módulo personal_finance asignado; GuardStrict usa mismo modulePath que modules.link. Backend exige identidad autenticada y propietario en todas las consultas/mutaciones. El acceso global de negocios no se extiende a Finanzas.
- Página: BaseLayout, lazyWithRetry y General inicial. Tabs Movimientos, Préstamos y deudas, Categorías, Grupos de categorías; tab en query string opcional, sin rutas CRUD.
- General: indicadores de ingresos/gastos/neto del filtro, conteos y pendientes; últimas operaciones y tablas de resumen por categoría/grupo. Agregados completos de Server; grupos pueden solaparse.
- Cada tabla: InputSearch arriba izquierda, Crear arriba derecha; Actions última columna con menú tres puntos Actualizar y Activar/Desactivar. Create/update en BaseModal; cambio de activo en ConfirmDialog.
- Cada sección reutiliza Filter, empieza en active y Limpiar devuelve active. Inactivos/todos requieren elección explícita; draft cancelado no modifica filtros aplicados. Búsqueda/filtros cambian página a primera.
- Formularios: inputs existentes y RHF/Zod basados en DTOs Server; switch Core UserModal. Categoría obligatoria; obligación opcional en movimiento; creación de obligación incluye categoría inicial y se envía en una operación atómica.
- Loading/empty/error y toast i18n conforme a AGENTS: contenido inicial Boneyard, revalidación suave, controles bloqueados, vacío visible, error con reintento y modal preservado al fallar.
- active controla visibilidad; status controla validez. Saldo de obligación usa todos los pagos confirmados, aunque esté oculto/inactivo o fuera de la fecha filtrada.
- Datos personales sin user_id editable. Montos enteros como strings exactos; timestamps existentes, sin occurred_on. API nueva bajo /api/v1/finance según [contrato 22](22-personal-finance-contracts.md).
- Client implementado y verificado localmente: [tareas FC-01..FC-25](24-personal-finance-client-plan.md), con FC-24 integración completa pendiente. Backend [FB-01..FB-26](23-personal-finance-backend-plan.md) verificado previamente sobre PostgreSQL aislado. No se aprueba de nuevo todo este documento.

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
- **API (Backend):** `POST /api/v1/auth/login` con `{provider: "google", credential}`. Retorna `{token, expiresAt, user}` y cookie HttpOnly. Después se carga `/api/v1/authorization/context` con el JWT propio.
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

## Negocios: descripción opcional — 2026-10-06

Confirmado por el usuario mediante el formulario «Nuevo Negocio»: el nombre sigue siendo obligatorio; la descripción es opcional. Crear sin descripción envía `translates: []`; se admite texto solo en español o solo en inglés. Al editar, vaciar ambos idiomas envía explícitamente la traducción vacía para borrar el contenido anterior. `has_description` refleja texto no vacío en `description` o su clave histórica `comment`.

Server aplica un DTO de traducciones específico de negocios; mantiene las validaciones de tipo y las traducciones obligatorias de otros recursos. Regresiones: 13 casos desde los casos de uso reales y tres del modal. Smoke HTTP compilado en ambos aliases `/business` y `/businesses`: creación sin descripción, idioma parcial, edición que borra contenido persistido y rechazo de nombre/tipos inválidos. Repositorios e identidad sintéticos; sin cambios en la BD configurada. Client: 850 pruebas en 150 archivos, tipado/build/lint correctos.

## Hechos confirmados

- Se usa React OAuth2 Google en `/login`, eliminando rutas específicas de callback en frontend.
- Todas las operaciones CRUD de Ajustes Generales se resuelven en modales in-place, eliminando rutas dedicadas como `/:id` o `/new`.
- La clave semántica (`key`) de los módulos y recursos es inmutable una vez creada.
- El acceso administrativo (`/settings`) se provee mediante un enlace en el Header de `Home` exclusivo para usuarios con rol `super admin`.
- Las tablas administrativas (Usuarios, Módulos, Recursos, Roles) implementarán paginación asíncrona desde el servidor (server-side) desde el inicio.

## Preguntas abiertas
- Ninguna.

## Actualización de sesión — 2026-09-12

Login exitoso redirige a `/`. Topbar utiliza el avatar de la sesión y muestra nombre/correo y logout. El cierre revoca la sesión remota y elimina los datos locales persistidos, el contexto y la caché. `/login` redirige al Home si ya existe sesión; `/settings/*` exige autenticación. Renovación y rutas técnicas: [14-authentication.md](14-authentication.md).

## Tools → Reservas — ruta implementada localmente 2026-10-04

`/tools/reservations` exige sesión validada y módulo asignado. Server deriva el actor de sesión y limita cada recurso a la casa accesible; sin privilegio automático de superadministrador sobre casas ajenas. Selector de casa accesible; estado vacío con crear casa si procede. Cambio de casa cancela lecturas y separa caché por usuario/casa.

| Sección | Comportamiento |
|---|---|
| General | Próximas entradas/salidas, preparación y pendientes; caja por fechas efectivas, sin llamarla utilidad contable |
| Calendario | Ventana acotada, reservas y bloqueos; intervalos y transiciones del mismo día validados por Server |
| Reservas | Tabla paginada, búsqueda/filtros; modales de ficha y comandos de confirmación, pago, devolución y cancelación |
| Preparación | Ropa de cama disponible/no disponible/por confirmar, limpieza, hora planificada y preparación realizada |
| Gastos | Pendiente/pagado/anulado y fecha efectiva de pago; reserva asociada opcional de la misma casa |
| Colaboradores | Propietario agrega usuarios existentes o reactiva pertenencia; retiro conserva autoría |
| Configuración | Propietario configura casa, horarios, capacidad y políticas por tramos; snapshots preservan acuerdos previos |

Archivar reserva conserva su ocupación/dinero. Cancelar libera disponibilidad y aprueba devolución, sin simular transferencia. Pagos reales y devolución pendiente se muestran separados. Cada intención de escritura conserva su clave idempotente hasta conocer el resultado; ante timeout no habilitar reenvío con clave nueva que pudiera duplicar dinero. Revalidar tras conflictos y conservar formularios al fallar.

Inputs reutilizables, i18n ES/EN, toast sileo, ConfirmDialog y modales existentes. Skeleton solo primera carga informativa, refetch suave, controles disabled/loading, estados vacío/error/reintento. Sincronización automática Airbnb/WhatsApp/Facebook y portal público fuera de esta versión. Payloads/errores están en [28](28-rental-reservations-contracts.md); [29](29-rental-reservations-backend-plan.md) organiza Server. [Plan Client30](30-rental-reservations-client-plan.md) implementado y en revisión documental; ruta con GuardStrict/BaseLayout/lazy, caché e intenciones por actor/casa. 822 pruebas/144 archivos y flujo HTTP/PostgreSQL temporal correctos; RC-38 conserva sesión/BD objetivo pendientes. Pagos accesibles en ficha/General, bloqueos desde Calendario y auditoría en modal paginado de casa; se conservan los siete tabs y una sola ruta.
