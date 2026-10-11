# Instalación de base de datos e inventario de migraciones

> Estado: implementado y verificado localmente; en revisión documental
> Fecha: 2026-10-10
> Decisión: [ADR-027](../architecture/decisions/ADR-027-reusable-core-and-database-bootstrap.md)

## Identidad del administrador por instalación

En `nodia-server/.env` se configuró `BOOTSTRAP_SUPER_ADMIN_EMAIL=oavr.18@gmail.com`. En `.env.example` se documentó la misma variable con `admin@example.com` como ejemplo reemplazable. Ambos incluyen comentario de uso inicial. La variable se consume por el bootstrap privado, no por una migración ni por el arranque habitual.

El correo se valida/normaliza, el usuario queda activo y recibe `super_admin` mediante `user_roles` y cuatro módulos mediante `user_modules`. Los módulos pertenecen a `module_groups` con key `general_settings`; los IDs se resuelven por claves, sin IDs ni correo personal fijos en el código. Repetir con la misma identidad no duplica filas; otro correo o accesos desactivados requieren administración explícita.

## Instalar en PostgreSQL vacío

Desde `nodia-server`, después de configurar PostgreSQL/Redis y el correo:

```sh
npm run db:setup
```

Compila, ejecuta las 18 migraciones y realiza el bootstrap. Valida el correo antes de conectar. Solo se permite en BD vacía o al repetir una instalación cuyo historial completo está aplicado. No ejecutar como reparación de la BD local actual: tiene siete migraciones registradas y pasos anteriores sin reconciliar; el comando rechaza migraciones pendientes sobre un esquema existente.

Si el esquema ya está completamente migrado y solo falta crear/verificar el administrador:

```sh
npm run seed:core
```

Son comandos explícitos; no se crean administradores automáticamente al iniciar Server. El seed HTTP previo sigue disponible con su `SECRET_SEED` y DTO; el comando privado no necesita ese secreto. Inicializar antes de abrir el API al público. No guardar claves/sesiones IA en el seed. `synchronize` permanece desactivado.

## Inventario completo

Se añadieron **tres archivos**; las 15 migraciones previas conservan contenido/nombre. «Registrada local» significa fila comprobada mediante consulta de solo lectura a `migrations`; no certifica todos los efectos previos ni implica que las demás tablas no existan. No se aplicaron las nuevas migraciones en la BD local.

| Archivo en `nodia-server/src/migrations/` | Función | Cambio de esta entrega | Registrada local |
|---|---|---|---|
| `1789257400000-InitialCoreSchema.ts` | Nueve tablas Core, FKs/índices; rol, grupo, cuatro módulos y traducciones ES/EN. Sin usuarios. | Nuevo | No |
| `1789257500000-InitialBusinessAiSchema.ts` | Diez tablas base de Negocios/IA requeridas por la cadena histórica; sin datos de negocio/credenciales. | Nuevo | No |
| `1789257600000-AuthSessions.ts` | Vinculación Google y sesiones/refresh con índices. | Conservado | No |
| `1789257700000-AddIconToModulesAndModuleGroups.ts` | Iconos de módulos y grupos. | Conservado | No |
| `1789257800000-CreateAiProviderCatalogAndRefactorAiProviders.ts` | Catálogo con 16 proveedores y enlace desde conexiones IA. | Conservado | No |
| `1790553500000-SeedSecurityActions.ts` | Acciones `ai:manage`/`invoice:analyze`, traducciones e índices de asociaciones activas. No impone nuevos guards. | Conservado | No |
| `1790553600000-HardenAiApiKeyEncryption.ts` | Conversión del cifrado/fingerprint de claves existentes; en BD vacía no hay secretos que convertir. | Conservado | No |
| `1790553700000-AddTokenPlanFlagsToCatalogAndProviders.ts` | Flags API/Web/Agentic y default_mode; retira columnas IA históricas. | Conservado | No |
| `1790553800000-AddIsDefaultToAiProviders.ts` | Conexión predeterminada; conserva conversión histórica de la primera activa cuando falta una principal. | Conservado | No |
| `1791085000000-CreatePersonalFinance.ts` | Cinco tablas de finanzas personales con pertenencia, exactitud e índices. | Conservado | No |
| `1791146000000-CreateRentalReservations.ts` | Once tablas de alojamiento/reservas/preparación/caja/operaciones/auditoría. | Conservado | Sí |
| `1791220000000-CreateProviderContacts.ts` | Contactos del proveedor, teléfonos, validaciones, versión e idempotencia de creación. | Conservado | Sí |
| `1791320000000-RestoreAiApiCatalog.ts` | Configuración de modos permitidos de Gemini/OpenAI. | Conservado | Sí |
| `1791330000000-SelectSoleAiApiKey.ts` | Selección de única clave activa en pools históricos de una fila, con lock de conexión. | Conservado | Sí |
| `1791450000000-EnableCodexAgenticCatalog.ts` | Habilita configuración Agentic OpenAI, preservando flags previos para reversión. No autentica Codex. | Conservado | Sí |
| `1791540000000-OptionalRentalPropertyTimes.ts` | Horarios legacy opcionales en casa; el contrato reserva conserva sus horarios propios. | Conservado | Sí |
| `1791630000000-CreateInvoiceUploads.ts` | Diario de recuperación archivo/factura e índice de objetos asociados; rollback bloqueado con pendientes. | Conservado | Sí |
| `1791640000000-CompleteAiProviderCatalog.ts` | Moonshot/Kimi y defaults API seguros, sin habilitar integración ni modificar filas existentes. | Nuevo | No |

## Core reutilizable

`InitialCoreSchema` agrupa `users`, `roles`, `actions`, `module_groups`, `modules`, `user_roles`, `role_actions`, `user_modules` y `translations`. No contiene referencias a Negocios, Finanzas, Reservas o IA. El seed Core inserta datos estables por claves únicas; no sobreescribe registros previos. `AuthSessions` añade las sesiones necesarias para utilizar el login de Nodia. Los dos baselines tienen SQL congelado: cambiar una entidad no cambia retrospectivamente el esquema que crean.

Negocios/IA queda en `InitialBusinessAiSchema`: `businesses`, `business_collaborators`, `business_actions`, `providers`, `products`, `product_logs`, `invoices`, `ai_providers`, `ai_api_keys`, `ai_provider_events`. Sus transformaciones posteriores siguen en el historial. Finanzas y Reservas crean sus tablas en sus migraciones existentes. Los baselines rechazan esquemas parciales, y su `down` requiere reversión por respaldo verificado.

No fusionar archivos ya aplicados. Sí agrupar cambios pequeños de una misma entrega/dominio antes de aplicarlos. Una futura distribución con historial compacto necesita un baseline y protocolo de transición propios, conservando los historiales de instalaciones existentes. El número de archivos no afecta de forma relevante al uso habitual del API; importa que la cadena sea reproducible y conserve datos.

## Catálogo IA y acceso a funciones adicionales

El catálogo tiene 17 identidades tras instalación: Gemini, OpenAI, Anthropic Claude, Mistral AI, DeepSeek, Groq, Perplexity AI, Cohere, xAI, Meta Llama, Together AI, Azure OpenAI, AWS Bedrock, Hugging Face, Ollama, Alibaba Qwen y Moonshot AI (Kimi). Kimi entra con todos los canales deshabilitados; no hay adaptador configurado. El selector conserva su filtro de proveedores compatibles. Los modelos se descubren/configuran dinámicamente, y las claves/sesiones se gestionan por instalación.

Los cuatro módulos Core no incluyen Proveedores IA, Negocios, Finanzas ni Reservas. `seed:finance` y `seed:rental` registran navegación por separado; asignar cada módulo al usuario de forma explícita. El bootstrap no amplía permisos de esos módulos.

## Verificación reproducible

```sh
npm run test:database-setup:integration
```

Usa PostgreSQL 16 desechable y credenciales/identidades sintéticas. Comprueba instalación completa sin sincronización, presencia de las 39 tablas/columnas de entidades, repetición, Core aislado, conservación de esquema existente con historial completo previo, rechazo de esquema parcial, atomicidad de traducciones/asignaciones, carreras entre identidades y consumo real del entorno por el CLI. No utiliza la BD configurada, Redis operativo, R2 ni cuentas IA.

Comprobaciones del VPS, TLS/proxy/OAuth, restauración externa y S-05 continúan en [la revisión de lanzamiento](19-prelaunch-review.md).

Entrega verificada: build correcto, lint sin errores (dos avisos previos ajenos), **863 pruebas de casos de uso/114 archivos y 35 comprobaciones de integración**. El CLI se probó como proceso real con entorno sintético. No se ejecutó el comando de instalación contra la BD local ni se creó/modificó su administrador. La introspección de tablas de TypeORM emite un aviso de deprecación del driver pg por consultas concurrentes internas; no falla la comprobación, y no se modificaron dependencias para ocultarlo.
