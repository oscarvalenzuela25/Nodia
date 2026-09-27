# Sitemap — Nodia Parte 1

> Estado: en revisión — ampliación IA previa a producción; aprobación histórica 2026-08-21 conservada
> Última actualización: 2026-09-25
> Dependencias: 04-prd-v2.md aprobado, 03-domain-model-erd.md aprobado

## Sitemap MVP

| Ruta | Roles | Módulo | Objetivo | Prioridad |
|---|---|---|---|---|
| `/` | Visitante, Usuario autenticado | Home | Punto de entrada universal; muestra módulos funcionales disponibles | MVP |
| `/login` | Visitante | Autenticación | Pantalla de inicio de sesión utilizando React OAuth2 Google | MVP |
| `/404` | Todos | Transversal | Experiencia de ruta no encontrada o no autorizada | MVP |
| `/maintenance` | Todos | Transversal | Vista global de mantenimiento | MVP |
| `/settings` | Super admin | Ajustes Generales | Entrada administrativa; dashboard/menú de submódulos | MVP |
| `/settings/users` | Super admin | Users | Gestión de usuarios (listar, crear, editar, roles) mediante tabla y modales | MVP |
| `/settings/modules` | Super admin | Modules | Gestión de módulos y submódulos mediante tabla y modales | MVP |
| `/settings/resources` | Super admin | Resources | Gestión de recursos mediante tabla y modales | MVP |
| `/settings/roles` | Super admin | Roles | Gestión de roles y permisos mediante tabla y modales | MVP |

## Rutas dudosas o futuras

### Ampliación IA propuesta el 2026-09-25 (sin aprobación documental)

- `/settings/ai`: dashboard de proveedores IA, disponibilidad y avisos para roles autorizados.
- `/settings/ai/:providerKey`: configuración tipada, keys y sesión del proveedor; acciones según permisos.
- `/settings/ai/gemini/login`: pestaña temporal de login remoto a la sesión de navegador del VPS, protegida por permiso específico.
- El comportamiento detallado y las rutas finales se fijarán con [la especificación de entrega](16-ai-provider-management-handoff.md) y la revisión de `06-route-specs.md`.

- **Rutas de módulos públicos funcionales** (`/modules/:moduleKey/...`): fuera del alcance de la Parte 1; se agregarán cuando exista el primer módulo público que consuma la infraestructura IndexedDB.
- **Acciones CRUD (Creación, edición y detalle) como rutas separadas**: Las acciones de crear o editar usuarios, módulos, recursos y roles (ej. `/new`, `/:id`) se resuelven en modales o en la misma vista de tabla (ej. `/settings/users`); no justifican rutas propias.
- **Ruta de ajustes personales (`/settings/profile` o `/account`)**: explícitamente fuera de alcance en PRD V2; la información de usuarios se administra desde `Ajustes Generales > Users`. Quedan para más adelante.
- **Rutas de onboarding / registro / recuperación de contraseña**: fuera de alcance; autenticación solo Google, alta manual por super admin.
- **Navegación administrativa exacta**: la entrada a `/settings` (header, menú lateral, botón en Home para super admin) depende de definición de UI en Route Specs; marcada como provisional.
- **Rutas anidadas de submódulos futuros**: si un módulo funcional público tiene submódulos, su estructura de rutas se definirá en su propio PRD/ERD posterior.
