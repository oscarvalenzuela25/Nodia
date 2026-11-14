# Instalación de base de datos e inventario de migraciones

## Arranque local y reconciliación — 2026-10-28

[Recibo local](../evidence/nodia-ai-local-backend-startup-20261028-r01.json): la BD Docker existente pasó de42tablas/7registros a66tablas/32migraciones, sin pendientes. Antes se verificó copia DPAPI por descifrado/TOC; después se conservó otra. Catálogo ya refactorizado, claves v2/HMAC válidas y Finanzas semánticamente comparada contra su `up` aislado se adoptaron documentalmente como tres estados existentes; no se simula que fueron ejecutados históricamente. Finanzas sólo necesitó dos índices no únicos, sin cambios de filas. Las otras22migraciones versionadas se aplicaron en transacción. Claves cifradas y35tablas previas de dominio permanecieron byte/lógicamente idénticas por sus huellas. La retirada Web conserva su respaldo y deja null el antiguo predeterminado Web, sin sustituir modo.

API3000/worker separado y weblocalhost5174 iniciados, RedisPONG y Native127.0.0.1:8000 con status autenticado200. No hubo inferencia, impersonación, seed/reset o despliegue VM; Codex Agentic conserva su límite Windows. El paquete de recuperación local y sus launchers están catalogados en `ops/lab/artifacts/local-backend-startup-20261028-r01/`; DPAPI exige la misma cuenta Windows y no acredita restauración completa/retención externa. Los estados locales anteriores siguientes son históricos.

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

`InitialCoreSchema` agrupa `users`, `roles`, `actions`, `module_groups`, `modules`, `user_roles`, `role_actions`, `user_modules` y `translations`. No contiene referencias a Negocios, Finanzas, Reservas o IA. El baseline Core inserta datos estables por claves únicas sin sobrescribir configuraciones existentes. El bootstrap inicial crea o reutiliza la identidad configurada y asegura rol, grupo y cuatro módulos activos; antes de existir una asignación de superadministrador puede actualizar enlaces, pertenencia y actividad de esos registros. Una repetición con administrador ya asignado verifica la identidad y los accesos; si cambiaron o se desactivaron, devuelve conflicto sin restaurarlos. `AuthSessions` añade las sesiones necesarias para utilizar el login de Nodia. Los dos baselines tienen SQL congelado: cambiar una entidad no cambia retrospectivamente el esquema que crean.

Negocios/IA queda en `InitialBusinessAiSchema`: `businesses`, `business_collaborators`, `business_actions`, `providers`, `products`, `product_logs`, `invoices`, `ai_providers`, `ai_api_keys`, `ai_provider_events`. Sus transformaciones posteriores siguen en el historial. Finanzas y Reservas crean sus tablas en sus migraciones existentes. Los baselines rechazan esquemas parciales, y su `down` requiere reversión por respaldo verificado.

No fusionar archivos ya aplicados. Sí agrupar cambios pequeños de una misma entrega/dominio antes de aplicarlos. Una futura distribución con historial compacto necesita un baseline y protocolo de transición propios, conservando los historiales de instalaciones existentes. El número de archivos no afecta de forma relevante al uso habitual del API; importa que la cadena sea reproducible y conserve datos.

## Catálogo IA y acceso a funciones adicionales

El catálogo tiene 17 identidades tras instalación: Gemini, OpenAI, Anthropic Claude, Mistral AI, DeepSeek, Groq, Perplexity AI, Cohere, xAI, Meta Llama, Together AI, Azure OpenAI, AWS Bedrock, Hugging Face, Ollama, Alibaba Qwen y Moonshot AI (Kimi). Kimi entra con todos los canales deshabilitados; no hay adaptador configurado. El selector conserva su filtro de proveedores compatibles. Los modelos se descubren/configuran dinámicamente, y las claves/sesiones se gestionan por instalación.

El bootstrap crea exactamente cuatro asignaciones Core; no registra módulos ni datos de Proveedores IA, Negocios, Finanzas o Reservas. Su navegación se instala por separado y los usuarios ordinarios requieren asignación explícita. Según la [política vigente89](89-module-access-and-user-data-scope.md), el `super_admin` activo tiene bypass de asignaciones y recibe el catálogo activo completo, sin que se creen asociaciones adicionales.

### Configuración inicial del superadministrador — consulta de código, 2026-11-14

El rol técnico es `super_admin`, no `super_user`. El primer usuario que inicia
sesión no se convierte automáticamente en administrador: la operación de
bootstrap debe ejecutarse explícitamente con el correo previsto.

| Elemento | Configuración del bootstrap |
| --- | --- |
| Correo | `BOOTSTRAP_SUPER_ADMIN_EMAIL` en CLI; `super_admin_email` y `SECRET_SEED` en HTTP. Se valida, recorta y convierte a minúsculas. |
| Usuario nuevo | Nombre `Super Admin`, `is_active: true`. Reutiliza el usuario del mismo correo si existe; no reemplaza su nombre. |
| Rol y asociación | `super_admin` activo y `user_roles.is_active: true`. |
| Grupo | `general_settings`, activo; traducciones Administrador General / General Administration. |
| Módulos/asignaciones | `users`→`/users`, `roles`→`/roles`, `actions`→`/actions`, `modules`→`/modules`; módulos y cuatro `user_modules` activos, con traducciones ES/EN. IDs dinámicos; orden siguiente disponible para registros nuevos. |
| Perfil y autenticación | Sin contraseña, vínculo Google, foto o sesión iniciales. El primer login Google válido vincula `google_sub` y completa la foto ausente; conserva un nombre existente como `Super Admin`. |
| Efectos adicionales | Transacción y locks Core/PostgreSQL; tras commit invalida `auth:context:*`. |

No crea acciones o `role_actions`, conexiones/keys/modelos/sesiones IA ni datos
comerciales. Las migraciones invocadas por `db:setup` son una operación distinta
y sí pueden insertar catálogos/acciones. El CLI admite repetir la misma
identidad con accesos intactos; otro correo o accesos modificados producen
conflicto. HTTP rechaza una asignación de superadministrador ya existente.

Fuentes contrastadas: [caso de uso](../../nodia-server/src/auth/use-case/seed-auth.use-case.ts),
[CLI](../../nodia-server/scripts/seed-core.mjs),
[login](../../nodia-server/src/auth/use-case/login.use-case.ts),
[contexto](../../nodia-server/src/authorization/authorization.service.ts) y
[acceso HTTP](../../nodia-server/src/authorization/use-case/check-module-access.use-case.ts).
Esta consulta no ejecuta seeds/migraciones, no inspecciona secretos ni comprueba
el valor configurado de un entorno operativo. No modifica contratos o estados
de aprobación documental; aclara la distinción entre baseline y bootstrap y el
bypass vigente frente al texto histórico de instalación.

## Verificación reproducible

```sh
npm run test:database-setup:integration
```

Usa PostgreSQL 16 desechable y credenciales/identidades sintéticas. Comprueba instalación completa sin sincronización, presencia de las 39 tablas/columnas de entidades, repetición, Core aislado, conservación de esquema existente con historial completo previo, rechazo de esquema parcial, atomicidad de traducciones/asignaciones, carreras entre identidades y consumo real del entorno por el CLI. No utiliza la BD configurada, Redis operativo, R2 ni cuentas IA.

Comprobaciones del VPS, TLS/proxy/OAuth, restauración externa y S-05 continúan en [la revisión de lanzamiento](19-prelaunch-review.md).

Entrega verificada: build correcto, lint sin errores (dos avisos previos ajenos), **863 pruebas de casos de uso/114 archivos y 35 comprobaciones de integración**. El CLI se probó como proceso real con entorno sintético. No se ejecutó el comando de instalación contra la BD local ni se creó/modificó su administrador. La introspección de tablas de TypeORM emite un aviso de deprecación del driver pg por consultas concurrentes internas; no falla la comprobación, y no se modificaron dependencias para ocultarlo.

## Continuidad M4 AI-33 — 2026-10-18

El inventario y cifras de instalación anteriores conservan su fecha original. [AI-33/79](79-nodia-ai-ai33-accepted-preferences.md) incorpora `1792900000000-CreateNodiaAiPreferences.ts`: una tabla/12 columnas, unicidad personal por scope/clave, dos índices parciales de origen y referencias SET NULL para sobrevivir a la purga del chat. No añade snapshots de AI-34. En el laboratorio con historial reconciliado se aplicó únicamente esa migración tras backup privado:26→27 entradas del ledger;20 tablas NodiaAI/279 columnas. Ver [evidencia de activación](../evidence/nodia-ai-ai33-activation.json). No usar bootstrap como reparación de una base existente. Revertir código conserva la tabla; down bloquea datos aceptados hasta conciliación explícita.


## Incremento AI-34 — snapshots de contexto

La migración28, `1793000000000-CreateNodiaAiContextSnapshots`, añade una tabla de nueve columnas y runs.context_snapshot_id. Se requiere aplicar antes de ejecutar el nuevo API/worker porque las cuotas consultan snapshots. Mantener synchronize:false, respaldo y orden explícito de despliegue. Down rechaza snapshots o referencias poblados; no borrar datos del chat para facilitar rollback. [Entrega80](80-nodia-ai-ai34-long-context-compaction.md) registra la activación de laboratorio: respaldo privado, historial27→28 conservado y21 tablas NodiaAI/289 columnas verificadas. Compactación/continuidad con cuenta Web/Agentic y callback MCP sintético se verifican por separado; no se deducen de la migración ni acreditan un efecto SQL de negocio con cuenta.

## Incremento AI-35 — índice de búsqueda literal

La migración29, `1793100000000-AddNodiaAiTextSearchIndex`, añade pg_trgm en public y un índice GIN parcial sobre las partes textuales; no modifica las21 tablas/289 columnas de NodiaAI. Instalar sólo con migrador autorizado, backup y ventana de mantenimiento: el CREATE INDEX transaccional bloquea escrituras mientras se construye. Si la extensión existe fuera de public, la migración aborta sin moverla. Down elimina sólo su índice, preservando la extensión compartida; revertir código no requiere borrar tablas o chats. [ADR-060](../architecture/decisions/ADR-060-nodia-ai-authorized-text-search.md), [SQL47](../evidence/nodia-ai-ai35-sql-validation.json) y [activación exacta28→29](../evidence/nodia-ai-ai35-runtime-activation.json) distinguen ensayo desechable y BD configurada. Instalar el índice no autoriza herramientas ni amplía la búsqueda a archivos/transcripciones.
