# ADR-081 — Acceso por módulos y ámbito de datos del usuario

> Estado documental: propuesto; regla funcional confirmada expresamente por el usuario en el chat del 2026-10-25. Implementación local y validación en curso; sin aprobación automática de fichas ni despliegue.
> Fecha: 2026-10-25

## Contexto

El acceso a una funcionalidad y el acceso a sus datos son decisiones independientes. La navegación ya verificaba módulos, pero enviaba a404 y conservaba excepciones por acciones en IA. Los endpoints REST de hijos de Negocios mantenían acceso global histórico aunque el listado del negocio filtraba propietario/colaborador. El usuario confirmó que un módulo habilita las funcionalidades y no los datos ajenos; super_admin mantiene acceso global.

## Opciones consideradas

### Opción A — Sólo ocultar navegación

- Menor cambio, pero una petición HTTP directa o un ID manipulado conservarían accesos indebidos.
- No permite cumplir la privacidad ni propagar revocaciones en servidor.

### Opción B — Módulos en HTTP y autorización de datos en cada recurso

- Guard de módulos después de autenticación, política explícita de familias y denegación de familias desconocidas.
- Ámbito SQL del propietario/colaborador antes de paginar, exportar o escribir; comprobación transaccional del origen y destino.
- Añade consultas actuales de autoridad, sin confiar en roles enviados por el navegador ni en la caché del menú.

## Decisión

Aplicar B. Usuarios ordinarios requieren el módulo correspondiente; roles y acciones se conservan como catálogo sin denegación por acciones. super_admin activo tiene bypass de permisos/asignaciones y acceso global, conservando sesión vigente, existencia e integridad de recursos, cifrado, atribución del actor y confirmaciones humanas. Un permiso global no permite suplantar al autor de una confirmación conversacional.

El guard de navegación vuelve a Inicio cuando falta el módulo. El guard HTTP relee la autoridad real; NodiaAI conserva su módulo y los destinos necesarios para operaciones sobre otros productos. Las lecturas auxiliares de catálogos se admiten únicamente en los formularios que las consumen; no conceden detalle o escrituras administrativas adicionales.

Negocios conserva propietario y colaborador explícitamente asignado. Productos, logs, proveedores, contactos, facturas y archivos heredan ese ámbito. Finanzas y Reservas conservan sus reglas de propiedad/compartición. Los resultados conversacionales almacenados se revalidan antes de recuperarse: retirar un colaborador no deja autorizada una respuesta histórica.

## Consecuencias

- La protección se aplica también a URL directa, APIs, exportaciones, bulk, descargas y herramientas internas.
- Bulk comprueba todos los orígenes/destinos antes de producir efectos; la transacción revierte ante fallo.
- La caché de navegación no constituye una concesión HTTP. Al adoptar, invalidar auth:context:*; no existe propagación push inmediata de la revocación al shell de otras sesiones.
- Los registros de publicación y sus hashes deben corresponder a las fuentes candidatas verificadas. Compilar no publica ni modifica el pin del entorno operativo.
- Las reglas históricas de acceso global entre negocios y de ai:manage quedan sustituidas por esta decisión funcional; la publicación de nuevas revisiones del conocimiento requiere su flujo explícito de aprobación.

## Referencias

- [Especificación y verificación89](../../mvp/89-module-access-and-user-data-scope.md).
- [Autenticación14](../../mvp/14-authentication.md).
- [Autorización NodiaAI53](../../mvp/53-nodia-ai-ai07-module-authorization.md).
- [Autoridad transaccional54](../../mvp/54-nodia-ai-ai08-transversal-authority.md).
