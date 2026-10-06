# Sitemap — Nodia Parte 1

> Estado: en revisión — ampliaciones IA, Finanzas personales y Reservas; aprobación histórica 2026-08-21 conservada
> Última actualización: 2026-10-04
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
| `/finances/personal` | Sesión validada y módulo asignado | personal_finance (grupo finances) | General y tabs personales de movimientos, préstamos/deudas, categorías y grupos | Ampliación Finanzas |

## Finanzas personales — planificación 2026-10-04

Ruta propuesta única `/finances/personal`, protegida por GuardStrict y BaseLayout, con constante PERSONAL_FINANCE_ROUTE en `nodia-client/src/modules/finances/constants/routes.ts`. Se utiliza el mismo valor en router y APP_AVAILABLE_ROUTES de Modules; módulo asignado mediante la administración existente.

General es el tab inicial/centro de mando. Tabs de Movimientos, Préstamos y deudas, Categorías y Grupos de categorías en la misma página. Create/update por modales; no rutas /new, /edit ni detalle CRUD separado. Sin acceso demo a datos financieros remotos ni asignación automática del módulo a todos.

Contrato y desglose: [22](22-personal-finance-contracts.md), [plan Server](23-personal-finance-backend-plan.md), [plan Client](24-personal-finance-client-plan.md). Este añadido no reconcilia automáticamente las rutas históricas de Resources/IA y conserva el estado de revisión. La ruta financiera está implementada en Client; pruebas locales correctas, integración con la BD objetivo pendiente.

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

## Tools → Reservas — ampliación 2026-10-04

| Ruta propuesta | Acceso | Módulo | Objetivo | Estado |
|---|---|---|---|---|
| `/tools/reservations` | Sesión validada y módulo asignado; datos según pertenencia a casa | `rental_reservations`, grupo Tools | Disponibilidad, reservas, dinero y preparación de casa completa | Implementada y verificada localmente; aplicación objetivo pendiente |

Una sola página con selector de casa y tabs General, Calendario, Reservas, Preparación, Gastos, Colaboradores y Configuración. Edición y detalle en modales; colaborador opera la casa y propietario administra miembros/configuración. GuardStrict y ocultación de pestañas no sustituyen validación de Server. Sin demo de datos remotos ni asignación automática a todos los usuarios. El [plan Client30](30-rental-reservations-client-plan.md) implementa la constante única RENTAL_RESERVATIONS_ROUTE para router y catálogo. QA local y navegador contra PostgreSQL temporal verificados; RC-38 objetivo pendiente.

[Especificación26](26-rental-reservations-spec.md), [ERD 27 aceptado](27-rental-reservations-erd.md), [contratos 28](28-rental-reservations-contracts.md), [plan Backend 29](29-rental-reservations-backend-plan.md) y [plan Client30](30-rental-reservations-client-plan.md). Contratos, navegación y planes en revisión; aceptación del ERD no aprueba toda esta ampliación.
