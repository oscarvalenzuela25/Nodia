# PRD V2 — Nodia Parte 1

> Estado: aprobado
> Última actualización: 2026-08-26
> Dependencias: 02-prd-v1.md aprobado, 03-domain-model-erd.md aprobado

## 1. Resumen del producto

Nodia es una aplicación web pública con comportamiento de backoffice que sirve como base experimental para estandarizar módulos, usuarios y autorización.

La aplicación tiene dos modos aislados:

- **Visitante:** utiliza futuros módulos públicos con persistencia en IndexedDB y sin acceso a la base de datos remota.
- **Usuario autenticado:** inicia sesión con Google, requiere un registro previo activo, y utiliza datos persistidos por el backend según sus permisos.

La Parte 1 implementa la base de autenticación y autorización y el módulo privado `Ajustes Generales` (`generalSettings`). No incluye todavía un módulo funcional público que consuma la infraestructura local.

## 2. Objetivo del MVP

Construir una base funcional y reutilizable que permita:

1. Autenticar exclusivamente con Google a usuarios creados previamente.
2. Bloquear el acceso cuando el usuario no exista o esté inactivo.
3. Administrar usuarios, módulos, roles y acciones dinámicas desde `Ajustes Generales`.
4. Derivar permisos efectivos desde los roles de un usuario.
5. Aplicar los mismos permisos en navegación, rutas, controles y endpoints mediante identificadores semánticos (keys).
6. Preparar IndexedDB y una interfaz asíncrona con latencia simulada para futuros módulos públicos.
7. Mantener completamente separados los datos locales y los datos remotos.

### Criterios funcionales de éxito

- El super admin sembrado puede iniciar sesión y acceder a `Ajustes Generales`.
- Un correo inexistente o inactivo no obtiene una sesión de Nodia.
- El super admin puede crear usuarios por correo y administrar sus estados y roles.
- El super admin puede administrar módulos y submódulos (usando keys para i18n).
- El super admin puede administrar el catálogo dinámico de acciones y asignarlas a los roles.
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
- **Condiciones de ingreso:** correo preexistente y `is_active = true`.
- **Acciones principales:** dependen de la unión de acciones otorgadas por sus roles.
- **Persistencia:** backend y base de datos interna.

### Super admin

- **Propósito:** inicializar y gobernar el sistema de acceso.
- **Acciones principales:** administrar usuarios, módulos, roles y el catálogo de acciones.
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
- El acceso requiere `is_active = true`.
- Un rechazo no crea una sesión ni un usuario; redirige a Home y muestra un toast genérico de acceso denegado.
- Después del primer acceso válido, Google puede completar nombre, imagen y otros datos de identidad que continúen vacíos.

### 4.3 Contexto de sesión y autorización

**Propósito:** entregar al frontend toda la información necesaria para construir la experiencia autorizada.

- Es la primera carga protegida después de autenticar.
- Incluye los roles y acciones (permisos) efectivos del usuario y la estructura de módulos.
- Las acciones duplicadas producidas por varios roles se eliminan con semántica de conjunto (unión).
- El contexto podrá cachearse; Redis, TTL e invalidación se definirán en el stack/backend.
- **Contrato pendiente:** estructura exacta del JSON de respuesta e invalidación ante cambios de usuario/rol/acción.

### 4.4 Ajustes Generales — Users

**Propósito:** controlar quién puede iniciar sesión y qué roles posee.

- Listar usuarios en tabla con búsqueda, filtros y paginación.
- Crear manualmente un usuario; solo el correo es obligatorio.
- Consultar información del usuario.
- Activar o desactivar mediante borrado lógico (`is_active`).
- Asignar y quitar múltiples roles.
- Rechazar cambios que dejen al sistema sin un super admin operativo.

### 4.5 Ajustes Generales — Modules

**Propósito:** administrar la estructura funcional de Nodia.

- Mantener el catálogo de módulos y submódulos en una sola entidad `modules`.
- Cada elemento tiene `id`, `key` (único, para multiidioma), `type` (`module` | `submodule`) y `parent_id` (auto-referencia, nulo para módulos raíz).
- Un submódulo mantiene una relación explícita con su módulo padre mediante `parent_id`; la jerarquía no depende de analizar la key.
- Borrado lógico mediante `is_active`.
- **Ciclo de vida:** creación, edición de key/type, activación/desactivación. La mutabilidad de `key` tras tener acciones o rutas asociadas no está permitida en este MVP para no quebrar traducciones ni jerarquías.

### 4.6 Ajustes Generales — Actions

**Propósito:** administrar el catálogo de permisos o acciones dinámicas.

- Crear y modificar acciones.
- Asociar cada acción opcionalmente con un módulo o submódulo mediante `actions.module_id` (agrupación visual/semántica).
- Las acciones definen capacidades específicas de negocio (ej. `viewUserPage`), abandonando el modelo CRUD fijo estático.
- Borrado lógico mediante `is_active`.
- **Unicidad de `key`:** global, actuando como identificador semántico para validaciones en el backend y para traducción (i18n) en el frontend.
- **Ciclo de vida:** creación, edición de key/description/module_id, activación/desactivación. La mutabilidad del `key` tras creación está bloqueada en el MVP.

### 4.7 Ajustes Generales — Roles

**Propósito:** agrupar permisos y asignarlos a usuarios.

- Listar y buscar roles.
- Crear y editar roles, asignando una `key` para multiidioma.
- Activar o desactivar roles mediante borrado lógico (`is_active`).
- Asignar un conjunto de acciones dinámicas a cada rol.
- No incluye duplicación de roles en esta parte.
- El rol `super admin` (identificado por key `super_admin`) no aparece para usuarios que no lo posean.
- No se puede quitar la última asignación operativa de `super admin`.

### 4.8 Autorización en frontend y backend

**Propósito:** evitar que ocultar la interfaz sea el único control de seguridad.

- El frontend controla navegación, rutas y acciones visibles basado en los `keys` de las acciones permitidas.
- El backend valida cada operación protegida utilizando el `key` de la acción.
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
| `users` | Persona preautorizada para iniciar sesión con Google. | Muchos roles vía `user_roles`; `is_active` gobierna el acceso. |
| `roles` | Agrupación reutilizable de permisos (acciones); multiidioma mediante `key`. | Muchas acciones vía `role_actions`; asignado a usuarios vía `user_roles`. |
| `modules` | Módulo o submódulo según `type`; jerarquía explícita. | Padre de submódulos; agrupa acciones vía `actions.module_id`. |
| `actions` | Catálogo de permisos o acciones dinámicas; multiidioma mediante `key`. | Referenciado por `role_actions`. |
| `user_roles` | Asignación de un rol a un usuario (pivote). | Único por par (user_id, role_id); `is_active` para borrado lógico. |
| `role_actions` | Permiso de un rol sobre una acción (pivote). | Único por par (role_id, action_id); `is_active` para borrado lógico. |

*Nota:* `ExternalIdentity` no existe como tabla; la identidad de Google se resuelve embebiendo `name` e `image_url` en `users` (completados tras primer acceso válido). `AuthorizationContext` es una proyección derivada en memoria, no entidad persistida.

## 6. Reglas de negocio actualizadas

1. **Acceso autenticado:** solo se crea sesión cuando existe el correo y el usuario tiene `is_active = true`.
2. **Alta controlada:** un intento con Google nunca crea automáticamente un usuario.
3. **Datos iniciales:** el correo es obligatorio, único y se persiste normalizado en minúsculas; Google solo puede completar campos de identidad vacíos tras un acceso válido.
4. **Persistencia separada:** IndexedDB y la base de datos remota nunca se sincronizan en esta parte.
5. **Visitante aislado:** un visitante nunca ejecuta operaciones contra la base de datos remota.
6. **Acciones dinámicas:** el sistema utiliza permisos descriptivos definidos en `actions`, abandonando las acciones fijas (CRUD) vinculadas a un "recurso".
7. **Relaciones explícitas:** las `keys` identifican permisos y elementos, y la jerarquía de agrupación (opcional) se conserva mediante `modules.parent_id` y `actions.module_id`.
8. **Permisos acumulativos:** los roles suman acciones; los duplicados se eliminan (unión de conjuntos); no existen denegaciones explícitas.
9. **Seguridad doble:** frontend y backend aplican autorización sobre el mismo significado funcional (el `key` de la acción).
10. **Super admin reservado:** solo quien posee la key `super_admin` puede verlo o gestionarlo.
11. **Continuidad administrativa:** siempre debe existir al menos un usuario con `is_active = true` y rol `super_admin`.
12. **Protección de continuidad:** se rechaza cualquier operación que deje cero super admins operativos.
13. **Ocultación administrativa:** los submódulos administrativos (`Users`, `Modules`, `Roles`, `Actions`) no aparecen en Home.
14. **Home sin persistencia:** `Home` no existe en `modules`; es una vista hardcodeada en frontend.
15. **Unicidad de asignaciones:** un usuario no puede tener el mismo rol dos veces; un rol no puede tener la misma acción dos veces.
16. **Mutabilidad de keys:** `modules.key`, `actions.key` y `roles.key` son inmutables tras su creación.
17. **Soporte Multiidioma (i18n):** Todo nombre mostrado al usuario para módulos, roles y acciones proviene de la traducción de sus respectivos `keys` en el frontend, en lugar de persistirse en la base de datos.

## 7. Flujos funcionales principales

| Actor | Acción | Resultado esperado |
|---|---|---|
| Visitante | Abre Nodia sin sesión | Ve Home; no ve `Ajustes Generales`; no se consulta BD remota. |
| Usuario precreado | Completa Google Auth | Backend confirma correo (normalizado) e `is_active`; crea sesión; completa `name`/`image_url` vacíos; devuelve contexto de autorización. |
| Persona no autorizada | Usa Google con correo inexistente o inactivo | No se crea usuario ni sesión; vuelve a Home con toast genérico. |
| Super admin | Registra un correo en Users | Existe usuario preautorizable con `email` único, `name`/`image_url` vacíos, `is_active=true`. |
| Super admin | Administra Modules o Actions | Módulos, submódulos y acciones quedan disponibles y estructurados para asignar permisos. |
| Super admin | Crea o edita un rol | El rol conserva las acciones dinámicas permitidas, seleccionadas del catálogo. |
| Super admin | Modifica roles de un usuario | Permisos efectivos reflejan la unión deduplicada de acciones. |
| Super admin | Intenta desactivar o quitar rol al último super admin | Operación rechazada; se conserva al menos un super admin operativo. |
| Usuario sin permiso | Intenta abrir ruta o invocar operación protegida | Frontend muestra `404`; backend rechaza la operación. |

## 8. Ajustes detectados entre PRD y modelo

### Lo modificado en esta iteración (2026-08-26)

- **Eliminación de `Resources` y acciones fijas**: se migró de un modelo rígido de CRUD por recurso a un sistema de Acciones Dinámicas que representa capacidades de negocio concretas.
- **Uso de `key` para multiidioma (i18n)**: se eliminaron los campos descriptivos de texto (`name`, `label`) de las tablas estructurales (`roles`, `modules`, `actions`) para manejar la presentación mediante traducciones desde el frontend.
- **Autorización simplificada**: se removió el campo `users.is_allowed`. El acceso ahora dependerá íntegramente de la existencia del correo y de que `is_active = true`.
- **Estructura relacional adaptada**: `role_resource_actions` se simplificó a `role_actions`, y los índices únicos fueron ajustados para soportar asignación de múltiples acciones sin repetición.

### Decisiones heredadas confirmadas

- `Home` es solo frontend y está hardcodeado.
- La identidad externa de Google se asimila en la tabla `users` al hacer login exitoso.
- Entidad `modules` única maneja jerarquía mediante `parent_id`.

## 9. Vacíos o dudas pendientes

- **Cascada de `is_active`**: si se desactiva un módulo, ¿se desactivan lógicamente las acciones agrupadas en él, o el frontend debe evaluar el estado del módulo padre antes de habilitar la acción?
- **Navegación administrativa separada de Home**: cómo accede el super admin a `Ajustes Generales` (menú, header, ruta dedicada). Se resuelve en Sitemap / Route Specs.
- **Diccionario de claves (Keys)**: definir si se usará notación específica para las keys (ej. `moduleName.actionName` o `camelCase`) para estandarizar el i18n.

## 10. Recomendaciones para el sitemap

- **Rutas públicas:** `/` (Home), `/auth/google` (inicio Google), `/auth/callback` (callback OAuth), `/404`, `/maintenance`.
- **Rutas autenticadas (requieren sesión válida):**
  - `/settings` → entrada a `Ajustes Generales` (solo super admin).
  - `/settings/users` → listado, alta, detalle, edición de usuarios.
  - `/settings/modules` → catálogo módulos/submódulos.
  - `/settings/actions` → catálogo de acciones dinámicas (permisos).
  - `/settings/roles` → listado, creación, edición de roles y permisos.
- **Estructura:** `Home` como raíz; `Ajustes Generales` como sección aparte (no en Home), accesible solo si el contexto de autorización incluye acciones de super admin.
- **Dependencias:** las rutas de `/settings/*` dependen de `modules` (para navegación) y del catálogo de `actions` (para UI de asignación de permisos).
- **Zonas que dependen de definiciones pendientes:** navegación administrativa exacta, y formato del diccionario i18n en el frontend.