# PRD V1 — Nodia Parte 1

> Estado: aprobado
> Última actualización: 2026-08-19
> Dependencias: 01-interview.md aprobado

## 1. Resumen del producto

Nodia es una aplicación web pública con comportamiento de backoffice que servirá como base experimental para estandarizar módulos, usuarios y autorización.

La aplicación tendrá dos modos aislados:

- **Visitante:** utiliza futuros módulos públicos con persistencia en IndexedDB y sin acceso a la base de datos remota.
- **Usuario autenticado:** inicia sesión con Google, requiere un registro previo permitido y activo, y utiliza datos persistidos por el backend según sus permisos.

La Parte 1 implementará la base de autenticación y autorización y el módulo privado `Ajustes Generales` (`generalSettings`). Todavía no incluirá un módulo funcional público que consuma la infraestructura local.

## 2. Problema principal

Nodia necesita un estándar verificable para decidir:

- qué módulos y submódulos puede descubrir una persona;
- qué recursos funcionales puede utilizar;
- qué acciones puede ejecutar sobre cada recurso;
- dónde persisten los datos según exista o no una sesión autorizada.

Sin este estándar, cada módulo futuro tendría que inventar su propia estructura de navegación, permisos y acceso a datos, aumentando el riesgo de inconsistencias entre frontend y backend.

## 3. Objetivo del MVP

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

## 4. Usuarios y roles

### Visitante no autenticado

- **Propósito:** explorar y utilizar futuros módulos públicos como demostración local.
- **Acciones principales:** entrar a `Home` y, cuando existan, ejecutar operaciones completas en módulos públicos.
- **Persistencia:** IndexedDB del navegador.
- **Restricciones:** no ve ni accede a `Ajustes Generales`; no utiliza la base de datos remota.

### Usuario autenticado

- **Propósito:** utilizar módulos habilitados con persistencia remota.
- **Condiciones de ingreso:** correo preexistente, `allowed = true` y `active = true`.
- **Acciones principales:** dependen de la unión de acciones otorgadas por sus roles.
- **Persistencia:** backend y base de datos interna.

### Super admin

- **Propósito:** inicializar y gobernar el sistema de acceso.
- **Acciones principales:** administrar usuarios, módulos, recursos, roles y asociaciones de permisos.
- **Nivel de interacción:** acceso completo a `Ajustes Generales`.
- **Restricción especial:** el rol `super admin` solo es visible y gestionable por usuarios que ya lo poseen.

No existe un rol `admin` predefinido en esta parte. El super admin podrá crear posteriormente los roles que necesite.

## 5. Alcance funcional del MVP

### 5.1 Home

**Propósito:** ser el punto de entrada universal.

- Está disponible con o sin sesión.
- Muestra únicamente módulos funcionales utilizables por la persona.
- No muestra módulos futuros, bloqueados ni administrativos.
- Si no existen módulos funcionales disponibles, muestra un estado sin contenido.
- `Ajustes Generales` queda fuera de Home incluso para el super admin y tendrá una entrada administrativa separada.

### 5.2 Autenticación con Google

**Propósito:** identificar al usuario sin mantener credenciales propias.

- No existen registro público, contraseña ni recuperación de contraseña.
- El super admin crea previamente un usuario utilizando su correo.
- El backend valida el correo de Google contra el usuario preexistente.
- El acceso requiere simultáneamente `allowed = true` y `active = true`.
- Un rechazo no crea una sesión ni un usuario; redirige a Home y muestra un toast genérico de acceso no permitido.
- Después del primer acceso válido, Google puede completar nombre, imagen y otros datos de identidad que continúen vacíos.

### 5.3 Contexto de sesión y autorización

**Propósito:** entregar al frontend toda la información necesaria para construir la experiencia autorizada.

- Es la primera carga protegida después de autenticar.
- Incluye los roles y permisos efectivos del usuario y la estructura necesaria de módulos, submódulos, recursos y acciones.
- Las acciones duplicadas producidas por varios roles se eliminan con semántica de conjunto.
- El contexto podrá cachearse; Redis, TTL e invalidación se definirán en el stack/backend.

### 5.4 Ajustes Generales — Users

**Propósito:** controlar quién puede iniciar sesión y qué roles posee.

- Listar usuarios en tabla.
- Buscar, filtrar y paginar.
- Crear manualmente un usuario; solo el correo es obligatorio.
- Consultar información del usuario.
- Cambiar `allowed`.
- Activar o desactivar mediante borrado lógico.
- Asignar y quitar múltiples roles.
- Rechazar cambios que dejen al sistema sin un super admin operativo.

### 5.5 Ajustes Generales — Modules

**Propósito:** administrar la estructura funcional de Nodia.

- Mantener el catálogo de módulos y submódulos.
- Cada elemento tiene `id`, `label`, `key` y `type`.
- Un submódulo mantiene una relación explícita con su módulo padre.
- Las relaciones jerárquicas no dependen de analizar la key con `split`.
- El ciclo de vida exacto de módulos y submódulos se definirá con el modelo de dominio.

### 5.6 Ajustes Generales — Resources

**Propósito:** administrar las secciones o capacidades funcionales protegidas.

- Crear y modificar recursos.
- Asociar cada recurso directamente con un módulo o con un submódulo.
- Ejemplos conceptuales: CRUD individual de usuarios y operaciones masivas de usuarios pueden ser recursos distintos.
- Un recurso no define acciones personalizadas; utiliza el catálogo fijo.
- El ciclo de vida exacto de recursos se definirá con el modelo de dominio.

### 5.7 Ajustes Generales — Roles

**Propósito:** agrupar permisos y asignarlos a usuarios.

- Listar y buscar roles.
- Crear y editar roles.
- Activar o desactivar roles mediante borrado lógico.
- Seleccionar recursos existentes.
- Asignar a cada recurso un subconjunto de `view`, `create`, `update` y `delete`.
- No incluye duplicación de roles en esta parte.
- El rol `super admin` no aparece para usuarios que no lo posean.
- No se puede quitar la última asignación operativa de `super admin`.

### 5.8 Autorización en frontend y backend

**Propósito:** evitar que ocultar la interfaz sea el único control de seguridad.

- El frontend controla navegación, rutas y acciones visibles.
- El backend valida cada operación protegida.
- Una ruta existente pero no autorizada muestra la experiencia `404` en frontend.
- Intentar invocar directamente un endpoint sin permiso debe ser rechazado por el backend.

### 5.9 Infraestructura del modo visitante

**Propósito:** preparar una interfaz de datos compatible con futuros módulos públicos.

- IndexedDB será la persistencia local.
- Las operaciones serán asíncronas mediante promesas.
- Se simulará latencia con `setTimeout`.
- En esta parte no existe todavía un módulo funcional público que escriba datos.
- Cuando se agregue uno, el visitante tendrá sus operaciones funcionales completas aisladas en su navegador.

### 5.10 Vistas transversales

- Vista global de mantenimiento.
- Experiencia `404` para rutas inexistentes o no autorizadas.
- No se incluye `Settings` personal.

## 6. Fuera de alcance por ahora

- Módulos funcionales públicos posteriores a la infraestructura base.
- Migración, sincronización o combinación de datos locales y remotos.
- Registro público o auto-registro después de intentar usar Google.
- Proveedores de identidad distintos de Google.
- Autenticación mediante contraseña y recuperación de contraseña.
- Ajustes personales administrados por el propio usuario.
- Acciones diferentes de `view`, `create`, `update` y `delete`.
- Submódulo para administrar acciones.
- Permisos explícitos de denegación.
- Duplicación de roles.
- Eliminación física de usuarios desde la interfaz.
- Exponer `Ajustes Generales` como demostración pública.
- Dashboards, analytics, reportes o integraciones no descritas.

## 7. Reglas de negocio iniciales

1. **Acceso autenticado:** solo se crea una sesión cuando existe el correo y el usuario está permitido y activo.
2. **Alta controlada:** un intento con Google nunca crea automáticamente un usuario.
3. **Datos iniciales:** el correo es obligatorio; Google solo puede completar campos de identidad vacíos después de un acceso válido.
4. **Persistencia separada:** IndexedDB y la base de datos remota nunca se sincronizan en esta parte.
5. **Visitante aislado:** un visitante nunca ejecuta operaciones contra la base de datos remota.
6. **Acciones fijas:** todo recurso utiliza únicamente `view`, `create`, `update` y `delete`.
7. **Recurso directo:** si pertenece a un módulo, la clave de permiso sigue `module:resource:action`.
8. **Recurso anidado:** si pertenece a un submódulo, la clave sigue `module:submodule:resource:action`.
9. **Relaciones explícitas:** las claves identifican permisos, pero la jerarquía se conserva mediante relaciones por identificador.
10. **Permisos acumulativos:** los roles suman acciones; los duplicados se eliminan y no existen denegaciones explícitas.
11. **Seguridad doble:** frontend y backend aplican autorización sobre el mismo significado funcional.
12. **Super admin reservado:** solo quien posee `super admin` puede verlo o gestionarlo.
13. **Continuidad administrativa:** siempre debe existir al menos un usuario con `active = true`, `allowed = true` y rol `super admin`.
14. **Protección de continuidad:** se rechaza cualquier operación que deje cero super admins operativos.
15. **Ocultación administrativa:** los submódulos administrativos no aparecen en Home.

## 8. Entidades funcionales sugeridas

Estas entidades son insumos preliminares para el ERD; todavía no definen tablas ni columnas definitivas.

### User

Representa una persona preautorizada para iniciar sesión. Se relaciona con múltiples roles y conserva correo, datos de identidad, `allowed` y `active`.

### ExternalIdentity

Representa la identidad verificada por Google y su asociación con un `User`. Su separación queda por validar en el ERD.

### Role

Agrupa permisos reutilizables y se asigna a múltiples usuarios. Incluye el rol reservado `super admin`.

### UserRole

Representa la asignación muchos-a-muchos entre usuarios y roles.

### Module

Representa un módulo o submódulo según su `type`. Un submódulo referencia explícitamente a su módulo padre.

### Resource

Representa una sección o capacidad funcional protegida. Pertenece directamente a un módulo o a un submódulo.

### Action

Representa una de las cuatro operaciones fijas: `view`, `create`, `update` o `delete`.

### RolePermission

Relaciona un rol, un recurso y una acción permitida. Es la base para calcular permisos efectivos.

### AuthorizationContext

Representa una proyección derivada para la sesión con roles, navegación y permisos efectivos. No es la fuente de verdad y podría almacenarse temporalmente en caché.

## 9. Flujos principales esperados

### Entrada como visitante

- **Actor:** visitante.
- **Disparador:** abre Nodia sin sesión.
- **Resultado:** ve Home; no ve `Ajustes Generales`; no se consulta la base de datos remota.

### Inicio de sesión válido

- **Actor:** usuario precreado.
- **Disparador:** completa Google Auth.
- **Resultado:** el backend confirma correo, `allowed` y `active`, crea la sesión, completa datos de identidad vacíos y devuelve el contexto de autorización.

### Inicio de sesión rechazado

- **Actor:** persona no autorizada.
- **Disparador:** usa Google con correo inexistente, no permitido o inactivo.
- **Resultado:** no se crea usuario ni sesión; vuelve a Home con un toast genérico.

### Alta de usuario

- **Actor:** super admin.
- **Disparador:** registra un correo en Users.
- **Resultado:** existe un usuario preautorizable con datos de identidad inicialmente vacíos y roles configurables.

### Configuración de estructura funcional

- **Actor:** super admin.
- **Disparador:** administra Modules o Resources.
- **Resultado:** módulos, submódulos y recursos quedan relacionados de forma explícita y disponibles para configurar permisos.

### Configuración de un rol

- **Actor:** super admin.
- **Disparador:** crea o edita un rol.
- **Resultado:** el rol conserva recursos y acciones permitidas seleccionadas del catálogo fijo.

### Asignación de roles

- **Actor:** super admin.
- **Disparador:** modifica los roles de un usuario.
- **Resultado:** los permisos efectivos del usuario reflejan la unión deduplicada de acciones.

### Protección del último super admin

- **Actor:** super admin.
- **Disparador:** intenta desactivar, retirar `allowed` o quitar el rol al último super admin operativo.
- **Resultado:** la operación se rechaza y el sistema conserva al menos un super admin operativo.

### Acceso no autorizado a una ruta u operación

- **Actor:** usuario autenticado sin permiso.
- **Disparador:** intenta abrir una ruta o invocar una operación protegida.
- **Resultado:** el frontend muestra `404` para la ruta y el backend rechaza la operación.

## 10. Supuestos operativos detectados

- El correo se comparará de forma normalizada y sin distinguir mayúsculas de minúsculas; se confirmará en el ERD.
- Google completará campos vacíos, pero no sobrescribirá datos ya administrados; se confirmará en Route Specs.
- Módulos y submódulos podrían compartir una entidad `Module` con `type` y relación padre; se validará en el ERD.
- Las keys serán identificadores estables; su mutabilidad se definirá con el dominio.
- Redis, si se adopta, almacenará una proyección derivada y nunca será la fuente de verdad.

## 11. Riesgos funcionales o zonas ambiguas

- Un caché obsoleto puede mantener permisos revocados hasta su invalidación.
- Cambiar una key utilizada por rutas puede romper autorización y navegación.
- Un recurso asociado simultáneamente a módulo y submódulo produciría una jerarquía ambigua.
- La autorización podría divergir si frontend y backend interpretan las claves de manera distinta.
- La separación entre modo local y remoto debe comunicarse claramente para evitar una falsa expectativa de sincronización.
- Las cuatro acciones fijas pueden ser insuficientes para módulos futuros; ampliar el catálogo queda fuera de esta parte.

## 12. Dudas y vacíos no bloqueantes

- Definir normalización, unicidad y almacenamiento del correo y del identificador de Google.
- Definir si `ExternalIdentity` será una entidad separada de `User`.
- Definir estados y reglas de desactivación para módulos, submódulos y recursos.
- Definir si las keys pueden editarse después de tener permisos o rutas asociadas.
- Definir el contrato exacto del contexto de autorización.
- Definir mecanismo de sesión, caché, TTL e invalidación de permisos.
- Definir el contrato de la capa IndexedDB y el rango de latencia simulada.
- Definir la navegación administrativa separada de Home.

## 13. Hechos confirmados e inferencias

### Hechos confirmados

- Los requisitos funcionales y reglas marcados como alcance provienen de la entrevista aprobada.
- `Resources` sustituye definitivamente a `Entities`.
- Se admiten recursos asociados a módulos y recursos asociados a submódulos.

### Inferencias pendientes

- Los puntos de la sección 10 no son decisiones aprobadas y deberán validarse en ERD, Route Specs o stack.

### Insumos recomendados para PRD V2

- Validar las entidades y relaciones propuestas contra el ERD.
- Resolver si módulo y submódulo comparten estructura persistente.
- Precisar la cardinalidad y exclusividad de `Resource` respecto de módulo o submódulo.
- Definir los ciclos de vida de Module, Resource, Role y sus asignaciones.
- Formalizar la derivación e invalidación del contexto de autorización.
- Revisar que rutas, keys y permisos representen los mismos recursos.
