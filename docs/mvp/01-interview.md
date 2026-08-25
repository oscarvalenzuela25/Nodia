# Entrevista inicial

> Estado: aprobado
> Última actualización: 2026-08-17
> Dependencias: Ninguna

## 1. Contexto de la necesidad

Nodia será inicialmente una herramienta de uso propio, pero quedará disponible para otras personas interesadas. Tendrá una experiencia similar a un backoffice y podrá abrirse públicamente sin exigir autenticación para entrar a la aplicación.

El repositorio ya contiene el cliente web base. El servidor y la base de datos todavía no están incorporados; el propietario definirá y entregará posteriormente la base de datos.

La primera parte del MVP busca construir la base de identidad y autorización sobre la cual se regirán los módulos futuros de Nodia.

## 2. Problema principal

Nodia necesita una base de acceso suficientemente estructurada para que cada módulo, submódulo, recurso y acción futura pueda habilitarse u ocultarse según los permisos efectivos de cada usuario.

También necesita ofrecer dos modalidades de uso claramente separadas:

- Uso público sin autenticación, con datos guardados únicamente en el navegador.
- Uso autenticado y autorizado, con datos persistidos en el backend y la base de datos de Nodia.

## 3. Usuarios y participantes

### Visitante no autenticado

- Puede entrar a la aplicación y siempre puede acceder a `Home`, que actúa como módulo inicial y universal.
- `Home` presenta los módulos que la persona puede utilizar. Cuando no tenga módulos funcionales disponibles, mostrará un estado sin contenido.
- Sus datos se guardan exclusivamente en IndexedDB, dentro de su navegador.
- Las operaciones locales simularán llamadas HTTP mediante promesas y `setTimeout`.
- No puede acceder a `Ajustes Generales` ni administrar usuarios o permisos.
- Si posteriormente inicia sesión, sus datos locales no se migran, mezclan ni sincronizan con la cuenta autenticada.

### Usuario autenticado

- Se autentica exclusivamente con Google.
- Solo puede ingresar si su usuario está permitido mediante whitelist y cumple las condiciones de estado definidas por administración.
- Sus datos se obtienen y persisten mediante el backend y la base de datos interna.
- Su navegación y sus operaciones quedan limitadas por los módulos, submódulos, recursos y acciones resultantes de sus roles.

### Super admin

- Es el usuario inicial del propietario de Nodia.
- Es el único actor autorizado a acceder al módulo `Ajustes Generales` durante este MVP.
- Administra usuarios, whitelist, estados, módulos, submódulos, roles, recursos y sus permisos.

## 4. Proceso propuesto

### Uso sin autenticación

1. La persona entra a Nodia sin iniciar sesión.
2. La aplicación muestra `Home`, que siempre está disponible y presenta los módulos funcionales a los que la persona puede acceder.
3. Si todavía no existen módulos públicos disponibles, `Home` muestra un estado sin contenido.
4. `Ajustes Generales` queda excluido del modo público.
5. Las lecturas y escrituras de los módulos públicos usan IndexedDB.
6. La capa de acceso a datos simula latencia de red con promesas y `setTimeout`.
7. Los datos permanecen asociados al navegador y no se migran si la persona inicia sesión más adelante.

### Home y navegación general

- `Home` solo muestra módulos funcionales que la persona puede utilizar en ese momento.
- No muestra módulos futuros, bloqueados o sin permiso.
- Los módulos reservados para el super admin, incluidos `Users`, `Modules`, `Roles` y `Resources`, quedan fuera de `Home` aunque este pueda acceder a ellos por la navegación administrativa que se defina posteriormente.

### Inicio de sesión y carga de permisos

1. La persona inicia sesión con Google.
2. El backend busca por correo un usuario creado previamente por el super admin y valida `allowed` y `active`.
3. Si el correo no existe o alguna condición falla, Nodia no crea una sesión, vuelve a `Home` y muestra un toast indicando que la cuenta no está permitida para acceder.
4. Un intento rechazado no crea automáticamente un usuario en la base de datos.
5. Si el acceso es válido, la aplicación crea la sesión y obtiene el contexto de autorización del usuario.
6. La respuesta incluye la información necesaria para determinar roles, módulos, submódulos, recursos y acciones permitidas.
7. El frontend construye la navegación y habilita vistas y controles según los permisos recibidos.
8. El backend vuelve a validar la autorización en cada operación protegida; la ocultación de interfaz no se considera una medida de seguridad suficiente.
9. Si se intenta abrir una ruta sin el módulo o permiso requerido, el frontend presenta la experiencia de ruta no encontrada (`404`).

### Administración de usuarios

1. El super admin entra a `Ajustes Generales > Users`.
2. Consulta una tabla de usuarios con búsqueda, filtros y paginación.
3. Registra manualmente el correo de una persona antes de que esta pueda iniciar sesión con Google.
4. Consulta la información de un usuario.
5. Puede cambiar su condición `allowed`/`not allowed`.
6. Puede activar o desactivar un usuario.
7. Asigna o quita múltiples roles.
8. La desactivación funciona como borrado lógico; el registro no se elimina físicamente.
9. El sistema rechaza cambios de `active` o `allowed` que dejen a Nodia sin al menos un super admin operativo.

### Administración de módulos

1. El super admin entra a `Ajustes Generales > Modules`.
2. Administra el catálogo de módulos y submódulos que estructura la aplicación.
3. Los módulos y submódulos conservan relaciones explícitas por identificador y claves semánticas para navegación y autorización.

### Administración de recursos

1. El super admin entra a `Ajustes Generales > Resources`.
2. Crea y modifica recursos.
3. Asocia cada recurso directamente con un módulo o con un submódulo funcional.
4. Las acciones no se administran como catálogo variable: siempre son `view`, `create`, `update` y `delete`.

### Administración de roles y permisos

1. El super admin entra a `Ajustes Generales > Roles`.
2. Consulta y busca roles existentes.
3. Crea o modifica roles.
4. Activa o desactiva roles mediante borrado lógico.
5. Asocia recursos existentes a cada rol.
6. Al seleccionar un recurso para un rol, asigna un subconjunto de las acciones fijas `view`, `create`, `update` y `delete`.
7. Asigna uno o varios roles a cada usuario desde la administración de usuarios.
8. Los permisos efectivos resultan de la relación entre usuario, roles, recursos y acciones.
9. Cuando varios roles otorgan una misma acción, la aplicación calcula la unión y elimina duplicados mediante semántica de conjunto.
10. El rol `super admin` solo es visible y gestionable por una persona que ya posee ese rol.
11. Los demás roles se crearán posteriormente desde la aplicación.
12. El sistema rechaza la eliminación de una asignación si dejaría a Nodia sin al menos un usuario operativo con el rol `super admin`.
13. Duplicar roles queda fuera de esta primera entrega.

### Bootstrap del super admin

1. Un seed del backend crea `Ajustes Generales` (`generalSettings`) y sus submódulos `Users`, `Modules`, `Roles` y `Resources`.
2. El seed crea el rol inicial, los recursos necesarios y las cuatro acciones fijas.
3. El seed relaciona esos registros para producir un rol con acceso administrativo completo.
4. El seed asigna ese rol al usuario inicial del propietario.

## 5. Dolores y riesgos conocidos

- Un control aplicado solo en frontend permitiría ejecutar operaciones protegidas directamente contra la API; por ello la autorización debe validarse también en backend.
- Consultar la base de datos para reconstruir los permisos en cada petición puede generar carga innecesaria. Se evaluará Redis para almacenar temporalmente el contexto de autorización de cada usuario.
- El caché de permisos puede quedar obsoleto después de modificar un usuario o rol; se deberá definir su TTL y estrategia de invalidación.
- La semántica de claves compuestas debe contemplar recursos ligados directamente a módulos y recursos ligados a submódulos sin generar colisiones.
- Los datos locales y remotos representan espacios separados. La interfaz deberá evitar que el cambio de modo haga creer al usuario que sus datos se perdieron o sincronizaron.

## 6. Resultado esperado

La primera parte del MVP debe entregar una base funcional de autenticación y autorización que permita:

- Entrar públicamente a Nodia sin una cuenta.
- Mantener datos públicos de demostración o uso personal en IndexedDB.
- Iniciar sesión únicamente mediante Google.
- Restringir el acceso autenticado mediante whitelist y estado del usuario.
- Mantener totalmente separados los datos locales y los datos de una cuenta autenticada.
- Administrar usuarios y permisos desde un módulo exclusivo para el super admin.
- Renderizar navegación, rutas y acciones a partir de permisos entregados por el backend.
- Proteger las mismas operaciones en el backend.
- Servir como fundamento para agregar módulos funcionales posteriores sin rediseñar el sistema de autorización.
- Mantener `Home` como punto de entrada visible para todas las personas, incluso cuando todavía no tengan otro módulo disponible.
- Probar y refinar un estándar reutilizable para modelar módulos, usuarios, roles, recursos y acciones en futuras soluciones.

## 7. Alcance inicial

### Incluido

- Autenticación con Google como único proveedor.
- Alta manual de usuarios por correo antes de su primer inicio de sesión.
- Módulo universal `Home` con estado vacío cuando no existan otros módulos disponibles.
- Whitelist administrable desde `Ajustes Generales > Users`.
- Estados `allowed`/`not allowed` y activo/inactivo para usuarios.
- Borrado lógico mediante desactivación.
- Módulo privado `Ajustes Generales`.
- Módulo `Ajustes Generales` con key `generalSettings`.
- Submódulo `Users` con key `users`.
- Submódulo `Modules` con key preliminar `modules`.
- Submódulo `Roles` con key `roles`.
- Submódulo `Resources` con key `resources`.
- Tabla de usuarios con búsqueda, filtros, paginación y vista de información.
- Asignación y revocación de múltiples roles por usuario.
- Listado y búsqueda de roles.
- Creación, edición y desactivación lógica de roles.
- Administración de módulos y submódulos desde `Modules`.
- Creación y edición de recursos desde `Resources`.
- Relación de muchos roles por usuario.
- Relación de muchos recursos por rol.
- Acciones fijas `view`, `create`, `update` y `delete` por recurso.
- Selección de acciones fijas al asociar un recurso con un rol.
- Catálogo jerárquico de módulos y submódulos con `id`, `label`, `key` y `type`.
- Relaciones explícitas mediante identificadores entre módulos, submódulos y recursos.
- Claves semánticas `modulo:recurso:accion` para recursos ligados directamente a módulos.
- Claves semánticas `modulo:submodulo:recurso:accion` para recursos ligados a submódulos.
- Endpoint inicial de sesión y contexto de autorización.
- Protección de navegación y rutas en frontend.
- Autorización de operaciones en backend.
- Evaluación de Redis para cachear el contexto de autorización por un tiempo limitado.
- Persistencia local mediante IndexedDB para el modo público.
- Simulación de latencia HTTP en la implementación local.
- Infraestructura local preparada en esta parte, aunque ningún módulo funcional público la consuma todavía.
- Visitantes con acceso completo a las operaciones de futuros módulos públicos, aisladas en su navegador y sin acceso a la base de datos remota.
- Persistencia remota para usuarios autenticados.
- Vista global de mantenimiento.

### Fuera de alcance

- Migrar o sincronizar datos de IndexedDB al iniciar sesión.
- Mezclar los datos locales con los datos de una cuenta.
- Proveedores de autenticación distintos de Google.
- Registro público o auto-registro de usuarios después de un intento con Google.
- Rutas de registro y recuperación de contraseña.
- Habilitar `Ajustes Generales` como demostración pública.
- Acciones de permisos personalizadas; el catálogo se limita a cuatro acciones fijas.
- Eliminación física de usuarios desde la interfaz.
- Duplicación de roles.
- Vista o ruta de ajustes personales (`Settings`).
- Módulos funcionales posteriores a la base de administración y autorización.

## 8. Reglas y restricciones conocidas

### Autenticación y usuarios

- Google será el único mecanismo de autenticación.
- No existirán registro público ni recuperación de contraseña; el acceso comienza directamente con Google.
- El super admin debe crear manualmente el correo del usuario antes de su primer inicio de sesión.
- El correo es el único dato obligatorio al crear manualmente un usuario; nombre, imagen y otros datos de identidad comienzan vacíos.
- Después de un primer acceso válido, si esos campos siguen vacíos, el backend puede completarlos con la información entregada por Google.
- El correo devuelto por Google debe corresponder a un usuario existente en Nodia.
- Un intento de Google con un correo inexistente no crea un registro.
- La autenticación de Google por sí sola no concede acceso autenticado a Nodia.
- Para iniciar una sesión válida deben cumplirse simultáneamente `allowed = true` y `active = true`.
- Un rechazo no crea una sesión de Nodia: redirige a `Home` y muestra un toast informativo.
- La whitelist se administra desde el submódulo `Users`.
- `allowed` y `active` representan condiciones distintas.
- Desactivar un usuario equivale a un borrado lógico.
- El super admin inicial se crea mediante un seed del backend que genera y relaciona el catálogo mínimo de autorización y asigna acceso total al usuario propietario.

### Autorización

- Un usuario puede tener muchos roles.
- Un rol puede tener muchos recursos.
- Un recurso expone siempre las acciones `view`, `create`, `update` y `delete`.
- Cada rol puede recibir un subconjunto de esas acciones para cada recurso.
- El rol `super admin` solo puede ser visto y gestionado por usuarios que ya posean ese rol.
- Nodia debe conservar siempre al menos un usuario con `active = true`, `allowed = true` y rol `super admin`.
- Toda operación que rompa esa condición debe rechazarse, incluyendo desactivar al último super admin, retirar su `allowed` o quitarle el último rol `super admin`.
- Los permisos deben determinar tanto lo que se renderiza como lo que el backend permite ejecutar.
- Cada ruta protegida del frontend tendrá una clave o requisito que se validará contra el contexto de autorización.
- Una ruta no autorizada se tratará como `404` en la experiencia del frontend para no exponer su existencia.
- Los permisos de múltiples roles se combinan por unión de acciones.
- Las acciones duplicadas se eliminan con semántica de conjunto; no existen denegaciones explícitas en este MVP.

### Módulos y claves semánticas

- El label canónico del módulo administrativo es `Ajustes Generales` y su key es `generalSettings`.
- Sus submódulos iniciales son `Users` (`users`), `Modules` (key preliminar `modules`), `Roles` (`roles`) y `Resources` (`resources`).
- Cada módulo y submódulo tendrá `id`, `label`, `key` y `type`.
- El `type` distinguirá módulos de submódulos.
- Cada submódulo tendrá una relación explícita con el identificador de su módulo padre.
- Cada recurso tendrá una relación explícita con un módulo o submódulo correspondiente.
- La integridad de la jerarquía no dependerá de ejecutar `split` sobre una clave.
- Las claves semánticas se usarán para autorización y para relacionar navegación y rutas. Se admiten `modulo:recurso:accion` y `modulo:submodulo:recurso:accion`; un ejemplo del segundo formato es `generalSettings:users:user:view`.

### Datos

- IndexedDB es la fuente persistente del modo público no autenticado.
- La base de datos interna es la fuente persistente del modo autenticado.
- No habrá convalidación, migración ni sincronización entre ambas fuentes en este MVP.
- La infraestructura IndexedDB y la simulación de latencia se prepararán en esta parte, aunque su primer consumidor funcional llegue en una parte posterior.
- Redis es una alternativa por validar para el caché temporal de sesión y autorización; todavía no constituye una decisión aprobada de stack.
- El uso definitivo de Redis, su TTL y su estrategia de invalidación se definirán en la etapa de stack/backend.

### Vistas transversales

- `Home` solo presenta módulos funcionales utilizables.
- Los módulos administrativos quedan fuera de `Home` y tendrán una entrada de navegación separada por definir.
- No habrá `Settings` personales en esta primera parte; la información de usuarios será administrada de forma autoritaria desde `Ajustes Generales > Users`.
- Se conservará una vista global de mantenimiento.
- Las rutas inexistentes y las rutas protegidas sin autorización se resolverán con la experiencia `404`.

## 9. Hechos confirmados

- El proyecto definitivo es `C:\Users\Oscar\Desktop\Nodia`.
- La especificación consolidada se llamará `MVP-SPEC-PART-1.md` y estará en la raíz.
- La documentación reanudable se mantendrá en `docs/mvp/`.
- Nodia será públicamente accesible, pero el inicio de sesión estará restringido.
- La autenticación será exclusivamente con Google.
- El modo público usará IndexedDB y latencia HTTP simulada.
- El modo autenticado usará backend y base de datos.
- Los datos locales no se migrarán al iniciar sesión.
- El primer módulo tendrá el label `Ajustes Generales` y la key `generalSettings`.
- Sus submódulos iniciales serán `Users`, `Modules`, `Roles` y `Resources`.
- `Ajustes Generales` será exclusivo del super admin inicial.
- La whitelist se administrará desde `Users`.
- Los usuarios tendrán condiciones de permitido y activo.
- Los usuarios se desactivarán mediante borrado lógico.
- Un usuario tendrá muchos roles, un rol muchos recursos y un recurso un subconjunto de cuatro acciones fijas.
- El endpoint inicial entregará el contexto necesario para renderizar la interfaz autorizada.
- Frontend y backend aplicarán autorización.
- Las rutas no autorizadas mostrarán `404` en frontend.
- `Home` será un módulo inicial visible para todas las personas.
- Cuando una persona no tenga módulos funcionales disponibles, `Home` mostrará un estado sin contenido.
- Las relaciones jerárquicas se almacenarán explícitamente mediante identificadores; no dependerán únicamente del análisis de claves.
- Una clave de acción seguirá `modulo:recurso:accion` o `modulo:submodulo:recurso:accion`, según el recurso dependa de un módulo o submódulo.
- Los permisos de varios roles se combinarán por unión de acciones y se deduplicarán como conjunto.
- No existirán permisos explícitos de denegación en esta primera parte.
- Una sesión válida exigirá simultáneamente `allowed = true` y `active = true`.
- El super admin y su autorización inicial se crearán mediante un seed del backend.
- El seed creará `Ajustes Generales`, `Users`, `Modules`, `Roles`, `Resources`, el rol `super admin`, sus recursos, las acciones fijas y sus relaciones.
- Los usuarios serán creados manualmente por el super admin antes de que intenten autenticarse.
- Un intento de autenticación no registrará automáticamente el correo en Nodia.
- Si el correo no existe, no está permitido o está inactivo, Nodia no crea una sesión, redirige a `Home` y muestra un toast de acceso no permitido.
- No existirán rutas de registro ni recuperación de contraseña.
- `Users` incluirá búsqueda, filtros, paginación, detalle, alta manual, estados y asignación de múltiples roles.
- `Modules` administrará el catálogo de módulos y submódulos.
- `Resources` administrará recursos y su relación con módulos o submódulos.
- `Roles` incluirá listado, búsqueda, creación, edición, desactivación lógica y selección de acciones fijas sobre recursos existentes.
- El rol `super admin` solo será visible y gestionable por personas que ya posean ese rol.
- Siempre deberá existir al menos un super admin operativo; el sistema bloqueará cualquier cambio que deje el total en cero.
- La duplicación de roles queda fuera de esta primera parte.
- `Home` mostrará únicamente módulos funcionales utilizables; no mostrará módulos futuros, bloqueados ni administrativos.
- `Settings` queda fuera de esta primera parte.
- El super admin actualizará la información de los usuarios desde `Users`.
- Se conservará una vista global de mantenimiento.
- Nodia Parte 1 es un experimento para establecer y refinar un estándar reutilizable de módulos, usuarios, roles, recursos y acciones; no reemplaza un proceso operativo existente.
- Redis, su TTL y su invalidación se decidirán posteriormente en la especificación de backend.
- La infraestructura IndexedDB y la latencia simulada se implementarán en esta parte, aunque todavía no exista un módulo funcional público que las consuma.
- Los visitantes tendrán acceso funcional completo a los futuros módulos públicos, pero sus operaciones permanecerán aisladas en IndexedDB y nunca accederán a la base de datos remota.
- Al crear un usuario solo será obligatorio el correo; Google podrá completar los campos de identidad vacíos tras el primer acceso válido.

## 10. Inferencias por validar

- Se interpreta que la comparación del correo de Google será normalizada y no distinguirá mayúsculas de minúsculas; esta regla deberá confirmarse al definir el dominio.
- Se interpreta que Redis almacenaría un contexto de autorización derivado, no la fuente de verdad de roles y permisos.
- Se interpreta que cambiar usuarios, roles o permisos deberá invalidar el caché afectado inmediatamente, además de tener un TTL defensivo.

## 11. Preguntas abiertas

- La estructura revisada y la terminología `Resources` fueron aprobadas el 2026-08-17.
- No quedan preguntas funcionales bloqueantes para la entrevista.
- La normalización de correo y la estrategia de caché se resolverán en las etapas de dominio y backend.

## Resumen previo a aprobación

- **Problema:** construir una base extensible y segura de autenticación, persistencia dual y permisos para los módulos futuros de Nodia.
- **Actor principal:** el super admin inicial, que administra usuarios y autorización; también existirán visitantes locales y usuarios autenticados permitidos.
- **Resultado del MVP:** Google Auth restringido por whitelist, infraestructura local separada y un módulo privado con `Users`, `Modules`, `Roles` y `Resources`, protegido en frontend y backend.
- **Mayor incertidumbre:** el modelo de datos definitivo y la estrategia de caché, que corresponden a etapas posteriores.
