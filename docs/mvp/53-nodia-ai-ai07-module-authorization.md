# NodiaAI — AI-07: módulo y autorización compartida

> Regla vigente2026-10-25: [política89](89-module-access-and-user-data-scope.md) y [ADR081](../architecture/decisions/ADR-081-module-access-and-business-data-scope.md) sustituyen las restricciones históricas por acciones y la asignación de navegación de super_admin. Las acciones ya no bloquean; los módulos habilitan funcionalidades y no datos ajenos. Las comprobaciones históricas siguientes describen su cohorte original, no una aprobación de la revisión actual. La implementación local conserva sesión, propiedad/colaboración y confirmaciones humanas; la publicación/adopción de la nueva política se valida por separado.

> Continuidad: AI-08 implementó las barreras y la transversalidad previstas, con evidencia independiente en[54](54-nodia-ai-ai08-transversal-authority.md). Esta entrega AI-07 conserva sus resultados históricos.

> Estado: implementación local y verificación aislada; documentación en revisión, sin publicación de chat/herramientas
> Fecha: 2026-10-15
> Base: [plan45](45-nodia-ai-implementation-plan.md), [autoridad41](41-nodia-ai-v1-contracts.md), [arquitectura43](43-nodia-ai-execution-architecture.md), [publicación52](52-nodia-ai-ai06-knowledge-publication-contract.md) y [navegación14](14-authentication.md).
> Contexto: [ficha funcional](../nodia-ai/knowledge/nodia-ai/features/module-authorization.md).

## Resultado

Se incorpora [NodiaAiModule](../../nodia-server/src/nodia-ai/nodia-ai.module.ts) a AppModule, sin controlador, endpoint, worker ni tabla nueva. Exporta dos casos de uso que compartirán descubrimiento, contexto, herramientas y recuperación; sus consumidores se conectarán al implementar esas etapas. No existen todavía esas rutas/runtime y no se presentan como protegidas o disponibles por registrar una clase.

El catálogo usa key `nodia_ai`, ruta `/tools/nodia-ai`, grupo `tools` e icono ya soportado `AutoAwesomeOutlined`. Los IDs bigint se resuelven desde BD, nunca por un número supuesto. [Migración incremental congelada](../../nodia-server/src/migrations/1792100000000-RegisterNodiaAiNavigation.ts) y [seed explícito](../../nodia-server/scripts/seed-nodia-ai.mjs) registran grupo, módulo y ES/EN en transacción. No asignan usuarios, no reactivan grupos/módulos existentes ni sobrescriben traducciones editadas. El `down` conserva identidades/asignaciones: una reversión de código requiere desactivar el acceso explícitamente; no pretende borrar el catálogo con seguridad.

La [página](../../nodia-client/src/modules/nodiaAi/pages/NodiaAI/NodiaAI.tsx) se carga por ruta y usa GuardStrict/BaseLayout existentes. Informa que el chat aún no está disponible; no tiene composer, conversaciones ficticias, llamadas de inferencia o acceso a datos de negocio. La ruta aparece en el selector administrativo ES/EN para poder asignar el módulo. Navegación sigue requiriendo asignación incluso para super_admin conforme14; el bypass del backend no cambia ese contrato ni concede asignaciones. Menú/Home reciben la nueva entrada a través del contexto existente una vez instalada y asignada.

## Política reutilizable

[AuthorizeNodiaAiUseCase](../../nodia-server/src/nodia-ai/use-case/authorize-nodia-ai.use-case.ts) recibe una referencia interna `{userId, sessionId}` y requisitos `{moduleRoutes?, actionKeys?}` procedentes del registro/caso de uso del backend. Ninguno es un DTO público ni argumento de herramienta. HTTP debe derivar identidad de `request.auth`; un worker futuro debe resolverla desde una concesión validada, no desde el texto del modelo. El resultado es una decisión del instante, no un token, concesión persistida o caché.

La [consulta de persistencia](../../nodia-server/src/nodia-ai/nodia-ai-authorization.service.ts) usa un único statement PostgreSQL parametrizado: usuario activo, sesión exacta del usuario no revocada/no vencida, roles/asociaciones/acciones activos, módulos/grupos/asignaciones activos. No consume el contexto Redis de navegación de una hora ni confía en roles/asignaciones del JWT o navegador. Una caída de BD propaga fallo; no crea permiso ni catálogo vacío exitoso.

| Comprobación | Ordinario | super_admin activo |
|---|---|---|
| Usuario/sesión vigentes y vinculados | Obligatorio | Obligatorio |
| Módulo NodiaAI activo, grupo activo, ruta inequívoca y key correcta | Obligatorio | Obligatorio |
| Asignación de NodiaAI | Obligatoria | Bypass en backend |
| Cada módulo destino activo/inequívoco | Obligatorio | Obligatorio |
| Asignación de cada destino solicitado | Obligatoria, todos | Bypass en backend |
| Acciones existentes requeridas por el contrato, p. ej. ai:manage | Se conservan | Bypass existente de super_admin |
| Reglas y pertenencia del recurso de negocio | Las aplica su familia | Transversalidad real de Finanzas/Reservas pendiente AI-08 |

El caso de uso devuelve actor/sesión, indicador de super_admin y proyección `{id,key,route}` de destinos permitidos. Una ruta activa duplicada se excluye del descubrimiento y se rechaza al exigirla; si la duplicada es NodiaAI se deniega todo el acceso. Requisitos múltiples usan intersección: un informe o fragmento que necesita dos destinos no se autoriza por tener uno. No se añaden permisos granulares por operación.

[AuthorizeNodiaAiResourceUseCase](../../nodia-server/src/nodia-ai/use-case/authorize-nodia-ai-resource.use-case.ts) añade la propiedad de recursos conversacionales persistidos. El llamador debe cargar dueño y requisitos desde repositorio/registro, antes de devolver contenido y sin tomar el owner del cliente. Ordinario ajeno recibe404; super_admin puede inspeccionar sin convertirse en dueño. Acceso `author` representa actuar como autor, incluidas propuestas/confirmación, y requiere dueño real incluso para super_admin: para operar datos ajenos debe preparar una propuesta atribuida a sí mismo, con destinatario explícito y reglas de dominio. Esto no define una API administrativa de edición de chats ajenos.

Sesión/usuario ausentes o inválidos producen401, falta de autoridad403, recurso ajeno ordinario404, dependencia fallida error de infraestructura. Las excepciones usan claves seguras; no incluyen emails, tokens o SQL. El formato HTTP común de41 se conectará al implementar endpoints, no se declara realizado por estas excepciones Nest internas.

## Límites de esta comprobación

Cada invocación relee autoridad actual. Esto demuestra revocación entre comprobaciones; **no** elimina la carrera entre lectura de permisos y commit de un efecto. AI-08 debe implementar barreras/orden de locks con escritores REST/worker; AI-09/10/12/14/17..20 deben revalidar antes de cada efecto, configurar concesiones y conservar confirmación/idempotencia. No almacenar esta proyección para dar autoridad a pasos posteriores.

No modifica el alcance nativo de Finanzas/Reservas ni corrige NI-13. No firma concesiones, no hace lookup/expiración de conversaciones inexistentes todavía, no produce410, no autoriza automáticamente una familia por tener módulo y no activa MCP. El filtro de contexto y los gates de publicación/startup permanecen en AI-12/36..38.

## Instalación y verificación

Comandos desde `nodia-server`:

```text
npm run seed:nodia-ai
npm run test:nodia-ai:authorization
```

El primero es una operación explícita contra la BD configurada, sólo tras comprobar entorno y migraciones del Core. El segundo hace build y prueba **otra BD desechable** en contenedor local PostgreSQL16, con nombre `template_nodia_ai_authorization_*`, puerto sólo loopback y limpieza al terminar. No arranca la API, Redis, Gemini ni modifica sesiones/datos del entorno configurado. No ejecutar migration:run indiscriminadamente sobre instalaciones con historial pendiente.

La entrega valida migración/seed repetibles, preservación de actividad/traducciones y cero asignaciones, composición Nest compilada, sesión vinculada/expirada/revocada, usuario inactivo, asignaciones/destinos/grupos, acción activa/revocada, super_admin/destinatario y recuperación con nueva sesión. Pruebas unitarias se mantienen en casos de uso; el harness de integración no crea suites de controller/service.

La instalación/asignación en la BD de uso y el smoke con sesión real quedan como operación de despliegue separada. No se modificó esa BD para cerrar las pruebas. El chat continúa indisponible. La [evidencia de entrega](../evidence/nodia-ai-ai07-authorization-validation.json) distingue unitarias, PostgreSQL aislado, checks estáticos y QA del navegador.

Resultado local: 907 pruebas/117 archivos de Server, 23 casos específicos de autorización, [28 comprobaciones PostgreSQL](../evidence/nodia-ai-ai07-postgres-integration.json) incluyendo concurrencia/rollback del seed, 1.196 pruebas/190 archivos de Client, typecheck y ambos builds correctos. Lint de archivos nuevos sin warnings; lint global Server conserva dos imports sin uso anteriores de ai-provider, sin errores. Vite conserva su aviso de chunks grandes, sin modificar presupuestos o esconderlo. Tras el último ajuste de validación interna de keys se repitieron los 23 casos y el harness PostgreSQL; las suites completas anteriores se distinguen en la evidencia.

[QA de presentación](../evidence/nodia-ai-ai07-browser-qa.json): Chrome instalado, 16 combinaciones de 320/600/900/1440 px, ES/EN y claro/oscuro, sin overflow, con padding del PageContent real y cero peticiones API/errores de página. [Móvil](../evidence/nodia-ai-ai07-320-dark-es.png) y [escritorio](../evidence/nodia-ai-ai07-1440-light-en.png) inspeccionados visualmente. El [harness](../../nodia-client/src/test/manual/nodia-ai/README.md) aísla página/theme/PageContent: no verifica shell completo, teléfono físico o sesión real. El primer intento con el headless shell ausente se sustituyó explícitamente por Chrome instalado, sin descargar navegadores.

El [snapshot39](nodia-ai-current-endpoints.json) registra la reconciliación de AppModule/router/catálogo Client y el nuevo módulo: 38 módulos Nest/176 fuentes, sin alterar los 177 handlers/296 rutas de los productos existentes. La comprobación AST y las regresiones de catálogo/fichas conservan esa cobertura; no se borraron checks de integridad para aceptar la nueva ruta.

## Continuidad

Siguiente: **AI-08**, transversalidad e invariantes compartidas. Esta entrega conserva aprobaciones documentales pendientes. La ficha añade contexto explicativo al corpus en borrador; no registra una capacidad ejecutable ni publica herramientas por describir autorización.
