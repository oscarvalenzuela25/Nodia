# PRD V2 — Nodia Parte 1

> Estado: aprobado
> Última actualización: 2026-08-19
> Dependencias: 02-prd-v1.md aprobado, 03-domain-model-erd.md aprobado

## 1. Resumen del producto

Nodia es una aplicación web pública con comportamiento de backoffice que sirve como base experimental para estandarizar módulos, usuarios y autorización.

La aplicación tiene dos modos aislados:

- **Visitante:** utiliza futuros módulos públicos con persistencia en IndexedDB y sin acceso a la base de datos remota.
- **Usuario autenticado:** inicia sesión con Google, requiere un registro previo permitido y activo, y utiliza datos persistidos por el backend según sus permisos.

La Parte 1 implementa la base de autenticación y autorización y el módulo privado `Ajustes Generales` (`generalSettings`). No incluye todavía un módulo funcional público que consuma la infraestructura local.

## 2. Objetivo del MVP

Construir una base funcional y reutilizable que permita:

1. Autenticar exclusivamente con Google a usuarios creados previamente.
2. Bloquear el acceso cuando el usuario no exista, no esté permitido o esté inactivo.
3. Administrar usuarios, módulos, recursos y roles desde `Ajustes Generales`.
4. Derivar permisos efectivos desde los roles de un usuario.
5. Aplicar los mismos permisos en navegación, rutas, controles y endpoints.
6. Preparar IndexedDB y una interfaz asíncrona con latencia simulada para futuros módulos públicos.
7. Mantener completamente separados los datos locales y los datos remotos.

### Criterios funcionales de éxito

- El super admin sembrado puede iniciar sesión y acceder a `Ajustes Generales`.
- Un correo inexistente, no permitido o inactivo no obtiene una sesión de Nodia.
- El super admin puede crear usuarios por correo y administrar sus estados y roles.
- El super admin puede administrar módulos, submódulos y recursos.
- El super admin puede crear roles y asignar acciones fijas a recursos.
- El contexto de autorización permite renderizar y proteger la aplicación sin consultar permisos individualmente desde cada vista.
- Ninguna operación puede dejar a Nodia sin al menos un super admin operativo.
- El modo visitante dispone de la infraestructura local sin realizar llamadas a la base de datos remota.

## 3. Usuarios y roles

### Visitante no autenticado

- **Propósito:** explorar y utilizar futuros módulos públicos como demostración local.
- **Acciones principales:** entrar a `Home` y, cuando existan, ejecutar operaciones completas en módulos públicos.
- **Persistencia:** IndexedDB del navegador.
- **Restricciones:** no ve ni accede a `Ajustes Generales`; no utiliza la base de datos remota.

### Usuario autenticado

- **Propósito:** utilizar módulos habilitados con persistencia remota.
- **Condiciones de ingreso:** correo preexistente, `is_allowed = true` y `is_active = true`.
- **Acciones principales:** dependen de la unión de acciones otorgadas por sus roles.
- **Persistencia:** backend y base de datos interna.

### Super admin

- **Propósito:** inicializar y gobernar el sistema de acceso.
- **Acciones principales:** administrar usuarios, módulos, recursos, roles y asociaciones de permisos.
- **Nivel de interacción:** acceso completo a `Ajustes Generales`.
- **Restricción especial:** el rol `super admin` solo es visible y gestionable por usuarios que ya lo poseen.

No existe un rol `admin` predefinido en esta parte. El super admin podrá crear posteriormente los roles que necesite.

## 4. Alcance funcional actualizado

### 4.1 Home

**Propósito:** ser el punto de entrada universal.

- Está disponible con o sin sesión.
- Muestra únicamente módulos funcionales utilizables por la persona.
- No muestra módulos futuros, bloqueados ni administrativos.
- Si no existen módulos funcionales disponibles, muestra un estado sin contenido.
- `Ajustes Generales` queda fuera de Home incluso para el super admin y tendrá una entrada administrativa separada.
- **Implementación:** `Home` es exclusivamente frontend (hardcodeado); no es una fila en `modules`.

### 4.2 Autenticación con Google

**Propósito:** identificar al usuario sin mantener credenciales propias.

- No existen registro público, contraseña ni recuperación de contraseña.
- El super admin crea previamente un usuario utilizando su correo.
- El backend valida el correo de Google contra el usuario preexistente (comparación case-insensitive tras normalización a minúsculas).
- El acceso requiere simultáneamente `is_allowed = true` y `is_active = true`.
- Un rechazo no crea una sesión ni un usuario; redirige a Home y muestra un toast genérico de acceso no permitido.
- Después del primer acceso válido, Google puede completar nombre, imagen y otros datos de identidad que continúen vacíos.

### 4.3 Contexto de sesión y autorización

**Propósito:** entregar al frontend toda la información necesaria para construir la experiencia autorizada.

- Es la primera carga protegida después de autenticar.
- Incluye los roles y permisos efectivos del usuario y la estructura necesaria de módulos, submódulos, recursos y acciones.
- Las acciones duplicadas producidas por varios roles se eliminan con semántica de conjunto (unión).
- El contexto podrá cachearse; Redis, TTL e invalidación se definirán en el stack/backend.
- **Contrato pendiente:** estructura exacta del JSON de respuesta, derivación de claves semánticas (`module:resource:action` / `module:submodule:resource:action`), e invalidación ante cambios de usuario/rol/recurso.

### 4.4 Ajustes Generales — Users

**Propósito:** controlar quién puede iniciar sesión y qué roles posee.

- Listar usuarios en tabla con búsqueda, filtros y paginación.
- Crear manualmente un usuario; solo el correo es obligatorio.
- Consultar información del usuario.
- Cambiar `is_allowed`.
- Activar o desactivar mediante borrado lógico (`is_active`).
- Asignar y quitar múltiples roles.
- Rechazar cambios que dejen al sistema sin un super admin operativo.

### 4.5 Ajustes Generales — Modules

**Propósito:** administrar la estructura funcional de Nodia.

- Mantener el catálogo de módulos y submódulos en una sola entidad `modules`.
- Cada elemento tiene `id`, `label`, `key` (único), `type` (`module` | `submodule`) y `parent_id` (auto-referencia, nulo para módulos raíz).
- Un submódulo mantiene una relación explícita con su módulo padre mediante `parent_id`; la jerarquía no depende de analizar la key con `split`.
- Borrado lógico mediante `is_active`.
- **Ciclo de vida:** creación, edición de label/key/type, activación/desactivación. La mutabilidad de `key` tras tener recursos o rutas asociadas se define en este MVP como no permitida (la key es inmutable tras creación) salvo decisión explícita futura.

### 4.6 Ajustes Generales — Resources

**Propósito:** administrar las secciones o capacidades funcionales protegidas.

- Crear y modificar recursos.
- Asociar cada recurso directamente con un módulo o con un submódulo mediante `resources.module_id` (FK a `modules`; el `type` del destino determina si es módulo o submódulo).
- Un recurso no define acciones personalizadas; utiliza el catálogo fijo de `actions`.
- Borrado lógico mediante `is_active`.
- **Unicidad de `key`:** global por ahora (MVP catálogo pequeño). Pendiente validar si debe ser global o por módulo/submódulo en PRD V2.
- **Ciclo de vida:** creación, edición de name/key/comment, activación/desactivación. `key` inmutable tras creación en este MVP.

### 4.7 Ajustes Generales — Roles

**Propósito:** agrupar permisos y asignarlos a usuarios.

- Listar y buscar roles.
- Crear y editar roles.
- Activar o desactivar roles mediante borrado lógico (`is_active`).
- Seleccionar recursos existentes.
- Asignar a cada recurso un subconjunto de `view`, `create`, `update` y `delete`.
- No incluye duplicación de roles en esta parte.
- El rol `super admin` no aparece para usuarios que no lo posean.
- No se puede quitar la última asignación operativa de `super admin`.

### 4.8 Autorización en frontend y backend

**Propósito:** evitar que ocultar la interfaz sea el único control de seguridad.

- El frontend controla navegación, rutas y acciones visibles.
- El backend valida cada operación protegida.
- Una ruta existente pero no autorizada muestra la experiencia `404` en frontend.
- Intentar invocar directamente un endpoint sin permiso debe ser rechazado por el backend.

### 4.9 Infraestructura del modo visitante

**Propósito:** preparar una interfaz de datos compatible con futuros módulos públicos.

- IndexedDB será la persistencia local.
- Las operaciones serán asíncronas mediante promesas.
- Se simulará latencia con `setTimeout`.
- En esta parte no existe todavía un módulo funcional público que escriba datos.
- Cuando se agregue uno, el visitante tendrá sus operaciones funcionales completas aisladas en su navegador.

### 4.10 Vistas transversales

- Vista global de mantenimiento.
- Experiencia `404` para rutas inexistentes o no autorizadas.
- No se incluye `Settings` personal.
- Navegación administrativa separada de Home (por definir en Sitemap/Route Specs).

## 5. Entidades principales del sistema

| Entidad | Qué representa | Relación funcional clave |
|---|---|---|
| `users` | Persona preautorizada para iniciar sesión con Google. | Muchos roles vía `user_roles`; `is_allowed` e `is_active` gobiernan el acceso. |
| `roles` | Agrupación reutilizable de permisos; incluye `super admin`. | Muchos permisos vía `role_resource_actions`; asignado a usuarios vía `user_roles`. |
| `modules` | Módulo o submódulo según `type`; jerarquía explícita con `parent_id`. | Padre de submódulos; asociado a recursos vía `resources.module_id`. |
| `resources` | Sección o capacidad funcional protegida; pertenece a un módulo o submódulo. | Vinculado a acciones vía `role_resource_actions`; `key` estable para claves semánticas. |
| `actions` | Catálogo fijo de 4 operaciones: `view`, `create`, `update`, `delete`. | Referenciado por `role_resource_actions`. |
| `user_roles` | Asignación de un rol a un usuario (pivote). | Único por par (user_id, role_id); `is_active` para borrado lógico. |
| `role_resource_actions` | Permiso de un rol sobre un recurso con una acción (pivote). | Único por terna (role_id, resource_id, action_id); `is_active` para borrado lógico. |

*Nota:* `ExternalIdentity` no existe como tabla; la identidad de Google se resuelve embebiendo `name` e `image_url` en `users` (completados tras primer acceso válido). `AuthorizationContext` es una proyección derivada en memoria, no entidad persistida.

## 6. Reglas de negocio actualizadas

1. **Acceso autenticado:** solo se crea sesión cuando existe el correo y el usuario tiene `is_allowed = true` e `is_active = true`.
2. **Alta controlada:** un intento con Google nunca crea automáticamente un usuario.
3. **Datos iniciales:** el correo es obligatorio, único y se persiste normalizado en minúsculas; Google solo puede completar campos de identidad vacíos tras un acceso válido.
4. **Persistencia separada:** IndexedDB y la base de datos remota nunca se sincronizan en esta parte.
5. **Visitante aislado:** un visitante nunca ejecuta operaciones contra la base de datos remota.
6. **Acciones fijas:** todo recurso utiliza únicamente `view`, `create`, `update` y `delete`.
7. **Recurso directo:** si pertenece a un módulo (`type = 'module'`), la clave de permiso sigue `module:resource:action`.
8. **Recurso anidado:** si pertenece a un submódulo (`type = 'submodule'`), la clave sigue `module:submodule:resource:action`.
9. **Relaciones explícitas:** las claves identifican permisos, pero la jerarquía se conserva mediante `modules.parent_id` y `resources.module_id`; no se depende de `split` de claves.
10. **Permisos acumulativos:** los roles suman acciones; los duplicados se eliminan (unión de conjuntos); no existen denegaciones explícitas.
11. **Seguridad doble:** frontend y backend aplican autorización sobre el mismo significado funcional.
12. **Super admin reservado:** solo quien posee `super admin` puede verlo o gestionarlo.
13. **Continuidad administrativa:** siempre debe existir al menos un usuario con `is_active = true`, `is_allowed = true` y rol `super admin`.
14. **Protección de continuidad:** se rechaza cualquier operación que deje cero super admins operativos.
15. **Ocultación administrativa:** los submódulos administrativos (`Users`, `Modules`, `Roles`, `Resources`) no aparecen en Home.
16. **Home sin persistencia:** `Home` no existe en `modules`; es una vista hardcodeada en frontend.
17. **Unicidad de asignaciones:** un usuario no puede tener el mismo rol dos veces; un rol no puede tener el mismo permiso (recurso+acción) dos veces.
18. **Mutabilidad de keys:** `modules.key` y `resources.key` son inmutables tras creación en este MVP.

## 7. Flujos funcionales principales

| Actor | Acción | Resultado esperado |
|---|---|---|
| Visitante | Abre Nodia sin sesión | Ve Home; no ve `Ajustes Generales`; no se consulta BD remota. |
| Usuario precreado | Completa Google Auth | Backend confirma correo (normalizado), `is_allowed` e `is_active`; crea sesión; completa `name`/`image_url` vacíos; devuelve contexto de autorización. |
| Persona no autorizada | Usa Google con correo inexistente/no permitido/inactivo | No se crea usuario ni sesión; vuelve a Home con toast genérico. |
| Super admin | Registra un correo en Users | Existe usuario preautorizable con `email` único, `name`/`image_url` vacíos, `is_allowed=true`, `is_active=true`. |
| Super admin | Administra Modules o Resources | Módulos, submódulos y recursos quedan relacionados explícitamente y disponibles para configurar permisos. |
| Super admin | Crea o edita un rol | El rol conserva recursos y acciones permitidas seleccionadas del catálogo fijo. |
| Super admin | Modifica roles de un usuario | Permisos efectivos reflejan la unión deduplicada de acciones. |
| Super admin | Intenta desactivar/retirar allowed/quitar rol al último super admin | Operación rechazada; se conserva al menos un super admin operativo. |
| Usuario sin permiso | Intenta abrir ruta o invocar operación protegida | Frontend muestra `404`; backend rechaza la operación. |

## 8. Ajustes detectados entre PRD y modelo

### Lo que el PRD V1 decía y la BD no soportaba bien

- **ExternalIdentity como entidad separada:** el PRD V1 la sugería ("su separación queda por validar en el ERD"); el ERD decidió omitirla y embebió `name`/`image_url` en `users` para simplificar el MVP (un solo proveedor).
- **Ciclo de vida de Module/Resource/Role:** el PRD V1 lo dejaba "por definir con el modelo de dominio"; el ERD añadió `is_active` en todas las entidades y pivotes como borrado lógico consistente.
- **Mutabilidad de `key`:** no estaba definida; el ERD la fija como inmutable tras creación para evitar romper claves semánticas y rutas.

### Lo que la BD tiene y el PRD V1 no reflejaba

- **`Home` solo frontend:** el PRD V1 describía Home como "módulo universal" sin clarificar su persistencia; el ERD explicitó que es hardcodeado y no es fila de `modules`.
- **Unicidad global de `resources.key`:** el PRD V1 no la mencionaba; el ERD la puso como única global y la marcó como duda a validar.
- **Unicidad compuesta en pivotes:** `role_resource_actions` y `user_roles` usan índices únicos compuestos, no por columna; el PRD V1 solo describía la regla semántica.
- **Nombres de campos `is_allowed`/`is_active`:** el PRD V1 usaba `allowed`/`active`; el ERD usa prefijo `is_` por convención booleana; el PRD V2 unifica a la convención del modelo.

### Lo corregido o aterrizado en esta versión

- Entidad `modules` única con `type` y `parent_id` (confirmando la suposición del PRD V1 §10).
- `resources.module_id` `not null` resuelve la exclusividad módulo XOR submódulo con un solo FK.
- Correos normalizados a minúsculas + `unique` (confirmando suposición PRD V1 §10).
- `actions` como tabla sembrada (catálogo fijo, no administrable).
- `AuthorizationContext` confirmado como proyección no persistida.
- `google_id` y multi-proveedor explícitamente fuera del MVP.

## 9. Vacíos o dudas pendientes

- **Unicidad de `resources.key`**: ¿global (actual) o por módulo/submódulo? Afecta claves semánticas y capacidad de reutilizar nombres de recurso en dominios distintos.
- **Contrato exacto del contexto de autorización**: estructura JSON, derivación de claves semánticas, TTL e invalidación (pendiente Route Specs / stack backend).
- **Navegación administrativa separada de Home**: cómo accede el super admin a `Ajustes Generales` (menú, header, ruta dedicada). Se resuelve en Sitemap.
- **Mutabilidad de `modules.key` y `resources.key`**: fijada como inmutable en MVP; si se permite editar, requiere migración de claves semánticas y rutas.
- **Estados de desactivación granulares**: ¿`is_active = false` en un módulo oculta también sus submódulos/recursos? Pendiente definir cascada o reglas de consistencia.
- **Comparación de correo con Google**: normalización a minúsculas confirmada; confirmar que el correo de Google se normaliza igual antes de buscar en BD (Route Specs).

## 10. Recomendaciones para el sitemap

- **Rutas públicas:** `/` (Home), `/auth/google` (inicio Google), `/auth/callback` (callback OAuth), `/404`, `/maintenance`.
- **Rutas autenticadas (requieren sesión válida):**
  - `/settings` → entrada a `Ajustes Generales` (solo super admin).
  - `/settings/users` → listado, alta, detalle, edición de usuarios.
  - `/settings/modules` → catálogo módulos/submódulos.
  - `/settings/resources` → catálogo recursos.
  - `/settings/roles` → listado, creación, edición de roles y permisos.
- **Estructura:** `Home` como raíz; `Ajustes Generales` como sección aparte (no en Home), accesible solo si el contexto de autorización incluye permisos de super admin.
- **Dependencias:** las rutas de `/settings/*` dependen de `modules` (para navegación), `resources` (para permisos), `roles`, `users` y `actions` (para UI de asignación).
- **Zonas que dependen de definiciones pendientes:** navegación administrativa exacta, contrato de contexto de autorización para guards de ruta, y unicidad de `resources.key` (afecta generación de claves de permiso en frontend).