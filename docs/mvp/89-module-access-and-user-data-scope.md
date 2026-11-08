# Acceso por módulos y privacidad de datos

## URLs estables y Teacher — implementación local, 2026-11-01

La navegación actual usa `/users`, `/roles`, `/actions`, `/modules`, `/ai-providers`, `/business` (detalle `/business/:id`), `/finances-personal`, `/reservations`, `/nodia-ai` y `/nodia-teacher` (detalle `/nodia-teacher/:sessionId`). El grupo del menú no forma parte de la identidad de la ruta ni del filesystem. Los aliases anteriores sólo redirigen al destino canónico, que vuelve a comprobar su guard. APIs de dominio conservadas.

[ADR092](../architecture/decisions/ADR-092-stable-module-navigation-routes.md) y [evidencia de migración](../evidence/canonical-module-routes-20261101-r01.json) documentan el mapa explícito, respaldo/ensayo y aplicación **local** de diez enlaces preservando IDs, relaciones y permisos. La duplicidad NodiaAI anterior no se fusionó ni concedió acceso: sigue denegada por ambigüedad. Las URLs con prefijos de los cortes fechados inferiores son históricas, no destinos nuevos ejecutables.

Teacher tiene dominio propio Client/Server, módulo `/nodia-teacher`, sesiones privadas y autoridad89; no requiere módulos de chat o administración IA. El mantenedor ofrece su URL para asignación individual. [97](97-nodia-teacher-technical-contracts.md) describe los contratos; [96](96-nodia-teacher-implementation-plan.md#21-implementación-local-y-evidencia) mantiene la verificación local y los pendientes de calificación/adopción. Implementación no aprueba ni publica documentos.

> Estado documental: en revisión. Reglas confirmadas expresamente por el usuario el2026-10-25. PostgreSQL real validado y Server/Client desplegados en el entorno actual el2026-10-26, sin migraciones ni escrituras de negocio. Las revisiones de conocimiento de esta política conservan su revisión documental pendiente.

## Regla confirmada

1. Una sesión válida es obligatoria en toda operación privada.
2. Un usuario ordinario con un módulo asignado puede usar sus funcionalidades sin que roles o acciones añadan bloqueos. Cada módulo administrativo sigue siendo independiente.
3. No tener el módulo impide montar su página y redirige a Inicio; una petición HTTP directa se rechaza antes del caso de uso.
4. super_admin activo tiene bypass de permisos/asignaciones y acceso global a los datos. El bypass no inventa recursos, habilita proveedores caídos, elimina invariantes ni sustituye una confirmación humana.
5. El módulo no concede datos de otros usuarios. Ana ve sus datos y Pedro los suyos; se mantienen accesos compartidos explícitamente, como colaboradores de un negocio o propiedad. super_admin puede consultar ambos ámbitos.

NodiaAI no otorga acceso a todos los productos por tener únicamente el chat: un usuario ordinario necesita además los módulos de destino. Si tiene los módulos necesarios, las acciones de sus roles no bloquean las herramientas. Ver [ADR081](../architecture/decisions/ADR-081-module-access-and-business-data-scope.md).

## Contratos y barreras

- `GET /authorization/context` entrega roles, acciones y módulos para navegación. super_admin recibe el catálogo activo completo sin crear asignaciones. No es una concesión para ejecutar peticiones posteriores.
- [GuardStrict](../../nodia-client/src/routes/GuardStrict.tsx) valida el contexto antes de montar una sección. Sin sesión vuelve a Login; sin módulo vuelve a `/`, con reemplazo de historial. El superadministrador no necesita una asignación individual.
- [ModuleAccessGuard](../../nodia-server/src/authorization/module-access.guard.ts) aplica [política HTTP explícita](../../nodia-server/src/authorization/http-module-policy.ts), con aliases y denegación de familias sin política. No usa un prefijo enviado por el cliente para decidir autoridad.
- [CheckModuleAccessUseCase](../../nodia-server/src/authorization/use-case/check-module-access.use-case.ts) consulta la BD actual, actividad y asignación. Las listas auxiliares exactas que alimentan Usuarios/Roles pueden autorizar cualquiera de sus módulos consumidores; detalle y escritura exigen su propio destino.
- [Ámbito de negocios](../../nodia-server/src/business-access/business-access.ts) resuelve actor/sesión reales y añade propietario/colaborador en SQL antes del paginado. Escrituras comprueban todos los negocios de origen/destino bajo locks compartidos con los escritores de autoridad.
- [Política NodiaAI](../../nodia-server/src/nodia-ai/use-case/authorize-nodia-ai.use-case.ts) conserva módulos/destinos, propiedad conversacional, revalidación y atribución. actionKeys sigue siendo metadata histórica de contratos; no decide autoridad vigente.

## Privacidad y archivos

Se aplica a listados, detalle por ID, búsqueda, CSV, alta, edición, importación, bulk, logs, contactos y recuperación de resultados históricos. Cambiar un filtro, un ID o el negocio de destino no concede acceso. Rechazar un recurso ajeno utiliza el mismo resultado público que un recurso ausente.

Las facturas comprueban acceso antes de subir archivos y antes de firmar su descarga; el archivo debe pertenecer al namespace del negocio. R2 permanece fuera de la transacción SQL y conserva el registro de recuperación. La escritura vuelve a comprobar acceso en su transacción. No se promete revocar una URL firmada que ya se entregó antes de perder acceso.

## Continuidad y publicación

Esta regla sustituye las excepciones históricas por ai:manage y el acceso global a hijos de Negocios descritos en19/53/54. No elimina roles/acciones, ni el rol reservado, ni la protección del último superadministrador. Tampoco habilita secretos en el chat.

[Ficha candidata de autorización](../nodia-ai/knowledge/nodia-ai/features/module-authorization.md) y [producto Ajustes](../nodia-ai/knowledge/general-settings/README.md) registran la regla actual. Las fichas aprobadas/publicadas históricas se conservan con sus hashes originales: no se falsifica su aprobación. Reconciliar y aprobar las revisiones afectadas antes de publicar un corpus que describa esta política; los documentos en borrador no se publican por modificar este índice.

## Checklist de entrega

- [x] Trazada la diferencia entre módulos, acciones y propiedad de datos.
- [x] Usuario confirma bypass de super_admin y aislamiento de datos.
- [x] Navegación a Inicio y guard HTTP por módulos implementados localmente.
- [x] Gate de acciones retirado en HTTP y autorización interna IA.
- [x] Aislamiento de hijos de Negocios integrado y comprobado localmente y en el alcance PostgreSQL descrito abajo.
- [x] Regresiones, tipado, lints, builds y contratos finales consolidados.
- [x] PostgreSQL real aislado para autoridad, ámbito de datos, contactos/CSV, transacciones y concurrencia de las suites seleccionadas.
- [x] Server y Client adoptados; HTTP autenticado y navegador con super_admin verificados.
- [ ] Revisar/aprobar las fichas que describen la política y publicar sus revisiones. El pin técnico desplegado conserva los textos aprobados históricos.

La adopción cambió tres descriptores de API/worker/backup y la raíz/fallback estático de nginx. Se ejecutó invalidación exclusiva de `auth:context:*` (cero entradas existentes). No se crearon usuarios, sesiones o registros de negocio de prueba en la BD configurada. Se conservaron datos, esquema y la imagen nativa instalada por el otro chat.

## Adopción y comprobación del entorno

[Recibo consolidado y límites](../evidence/module-access-and-user-data-deployment-r01.json): tres suites en PostgreSQL16 desechable real correctas contra el dist Server2029 exacto, con 115 dependencias compiladas verificadas. Cubren autoridad actual de módulos, propiedad/colaboración, privacidad de proveedores/contactos, CSV de ida y vuelta, rechazo de bulk mixto, rollback y concurrencia. No equivalen a probar todas las combinaciones HTTP de productos, logs, facturas o R2.

Server2029 y Clienteada quedaron activos con respaldo cifrado nuevo, retención de siete días y timers restaurados. Se comprobaron seis GET autenticados200, seis GET anónimos401, 448 archivos estáticos actuales/históricos por hash/MIME/caché/COOP y dos assets ausentes404. Las 61 tablas comparadas —sin auth_sessions— mantuvieron filas/hashes y el esquema permaneció idéntico; cero migraciones, restauraciones SQL o escrituras de negocio de esta entrega.

En el navegador se verificaron Inicio y entrada directa por URL a Reservas con la sesión super_admin existente: el módulo está activo y tiene cero asignaciones explícitas para ese actor. No hay otro usuario configurado para una aceptación ordinaria en vivo; sus casos de permitir/denegar, retorno a Inicio y privacidad se comprobaron en PostgreSQL desechable y regresiones locales. No se atribuye inferencia de proveedor ni cualificación de modalidades nativas a esta entrega.

La primera comprobación previa rechazó un cambio concurrente de imagen/PIDs sin activar permisos. Se concilió con la adopción OCR documentada por «NodiaAI — continuidad C03 y cierre AI-36/38», el usuario autorizó coordinación y se obtuvo/liberó una ventana exclusiva. Se entregaron los pins y archivos congelados para que la integración OCR posterior conserve esta política. El recibo acredita ese corte; una adopción posterior pertenece a su propia evidencia.

## Verificación local consolidada

[Recibo de alcance y límites](../evidence/module-access-and-user-data-validation-r01.json): Client 2027 pruebas/249 archivos y Server 5225/279, suites completas correctas. Tipado, ambos builds, lints sin errores (tres avisos históricos Server), 22 checks HTTP de módulos e integración HTTP de facturas correctos. Contratos comunes: 148 definiciones/504 fixtures; candidato conserva 151 capacidades y 42 fragmentos. No acredita PostgreSQL real, proveedor, navegador autenticado o adopción.
