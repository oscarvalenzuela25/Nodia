# Progreso del MVP — Nodia

> Estado general: en desarrollo
> Última revisión: 2026-10-03

## Checklist

- [x] 01. Entrevista aprobada — `01-interview.md`
- [x] 02. PRD V1 aprobado — `02-prd-v1.md`
- [ ] 03. Modelo de dominio ERD aprobado — `03-domain-model-erd.md`
- [ ] 04. PRD V2 en revisión parcial de autorización por acceso global confirmado — `04-prd-v2.md`
- [ ] 05. Sitemap en revisión por ampliación IA — `05-sitemap.md`
- [ ] 06. Route Specs aprobados — `06-route-specs.md`
- [x] 07. Restricciones de diseño aprobadas — `07-design-constraints.md`
- [ ] 08. Stack frontend definido — `08-stack-frontend.md`
- [ ] 09. Stack backend definido — `09-stack-backend.md`
- [ ] 10. Stack DevOps definido — `10-stack-devops.md`
- [ ] 11. Arquitectura inicial aprobada — `11-architecture-overview.md`
- [ ] 12. Kanban revisado — `12-kanban.md`
- [ ] 13. Preparación para implementación aprobada — `13-readiness-review.md`

- [ ] 14. Guía de autenticación y operación — `14-authentication.md` (implementación completada; documento en revisión)

Las casillas reabiertas señalan documentos afectados por las ampliaciones de auth e IA; la autorización total para desarrollar continúa vigente. No se han aprobado automáticamente nuevos documentos.

## Estado operativo

| Paso | Estado | Bloqueo o siguiente acción |
|---:|---|---|
| 01 | aprobado | Revisión aprobada y terminología `Resources` confirmada el 2026-08-17 |
| 02 | aprobado | Aprobado tal como estaba en revisión el 2026-08-19 |
| 03 | en revisión | Ampliación auth implementada; revisión documental pendiente. Historial:  Aprobado el 2026-08-26; actualizado el 2026-09-05 con PKs bigint universales; actualizado el 2026-09-07 con tabla translations para i18n centralizado (ADR-002) |
| 04 | aprobado | Aprobado el 2026-08-26; reconciliado modelo de acciones dinámicas e i18n con flujos de negocio |
| 05 | en revisión | Aprobado históricamente el 2026-08-21; reabierto el 2026-09-25 para incorporar Ajustes Generales > IA y login remoto propuestos |
| 06 | en revisión | Ampliación auth implementada; revisión documental pendiente. Historial:  Aprobado el 2026-08-22; confirmada paginación server-side y acceso administrativo en Header |
| 07 | aprobado | Aprobado el 2026-08-22; incluye uso de MUI, Light/Dark theme y Full Responsive |
| 08 | en revisión | Ampliación auth implementada; revisión documental pendiente. Historial:  Aprobado el 2026-08-22; stack Vite+React+MUI confirmado, tokens y tema integrados en código |
| 09 | en revisión | Ampliación auth implementada; revisión documental pendiente. Historial:  Aprobado el 2026-08-22; stack NestJS + TypeORM + PostgreSQL + JWT propio |
| 10 | en revisión | Ampliación auth implementada; revisión documental pendiente. Historial:  Aprobado el 2026-08-22; Cloudflare Pages, Northflank, monorepo y pre-commit hooks |
| 11 | en revisión | Ampliación auth implementada; revisión documental pendiente. Historial:  Aprobado el 2026-08-22; consolidación técnica (diagrama general y flujo de auth) completada |
| 12 | en revisión | Ampliación auth implementada; revisión documental pendiente. Historial:  Aprobado el 2026-08-22; desglose en 7 épicas y tareas trazables |
| 13 | en revisión | Ampliación auth implementada; revisión documental pendiente. Historial:  Aprobado el 2026-08-24 por instrucción directa del usuario; control total de Nodia concedido |

## Bloqueos actuales

- Lanzamiento público pendiente de los P0 de autorización/aislamiento/consultas de Server y de la integridad de importaciones; ver [revisión técnica](19-prelaunch-review.md).
- Cierre de Client pendiente de contratos de agregados, confirmación transaccional/idempotente y capacidades dinámicas; operación agéntica/cuotas reales y validación en staging pendientes.

## Decisiones que invalidaron pasos posteriores

- El 2026-09-27 se modernizó y desacopló el subsistema de IA en backend, base de datos, microservicio y frontend:
  1. Se separó la tabla `ai_provider_catalog` (`id`, `key`, `name`, `is_active`) de las instancias operativas en `ai_providers` (`catalog_id`, `name`, `key` no única), permitiendo múltiples conexiones para un mismo proveedor (ej. plan web principal + API Key de contingencia).
  2. Sincronización dinámica de modelos bajo demanda (`POST /ai-providers/:id/sync-models`), eliminando filtros y listas de modelos hardcodeadas.
  3. Soporte para Razonamiento Extendido (Extended Thinking) detectado en modelos con capacidad `reasoning`, controlado por switch y validado en `AnalyzeInvoiceUseCase`.
  4. Switch de Foco OCR informativo (`ocr_focus_model`), manteniendo `selected_model` como el modelo estricto de ejecución.
  5. Limpieza de UI (remoción de Latencia Media y Test Ping) e implementación de skeletons con `boneyard-js` y soft loading sin parpadeos.
- El 2026-09-26 se simplificó el modelo de dominio de Proveedores de IA consolidando los campos operativos (`mode`, `fields`, `fields_version`, `auto_rotate_api_keys`, `is_active`) directamente en `ai_providers` (relación 1:1), eliminando la tabla puente `ai_provider_connections` para prevenir colisiones de unicidad y simplificar la persistencia. `ai_api_keys` se relaciona ahora directamente con `ai_providers.id`. Se integró el catálogo oficial de proveedores en servidor (`GET /ai-providers/catalog`) con autoselección de modelos por defecto (`available_models`, `selected_model`) y selector de modelos en frontend.
- El 2026-09-25 se confirmó una ampliación de IA previa a producción con nueva navegación en Ajustes Generales; se reabre `05-sitemap.md`. El despliegue de API cambia a VPS, por lo que `10-stack-devops.md` y `11-architecture-overview.md` permanecen en revisión; `06-route-specs.md`, `12-kanban.md` y `13-readiness-review.md` también requieren reconciliación. La Parte 1 histórica del PRD V2 conserva su aprobación; la ampliación se especifica aparte y aún no está aprobada.

- El 2026-08-17 se separaron `Modules` y `Resources` como submódulos de `Ajustes Generales`; el PRD V1 en revisión ya reconcilia este cambio.
- El 2026-08-21 se eliminaron `/auth/google`, `/auth/callback`, y las rutas de detalle/edición `/:id` en el Sitemap; las ediciones se harán con modales.
- El 2026-08-22 se decidió que la paginación será asíncrona (server-side) desde el principio para evitar deuda técnica.
- El 2026-08-26 se eliminó la entidad `Resources` en favor de acciones dinámicas (`actions`). Se agregaron campos `key` para soportar multiidioma y se removió `users.is_allowed`. Esto invalidó el PRD V2.
- El 2026-09-05 se actualizó el modelo de datos (`03-domain-model-erd.md`) adoptando `bigint` autoincremental de forma universal para todas las tablas (entidades principales y tablas pivote `user_roles`, `role_actions`) en lugar de UUIDs, optimizando el rendimiento de índices y almacenamiento en PostgreSQL.
- El 2026-09-07 se incorporó la tabla `translations` (ADR-002) para centralizar la gestión de traducciones multiidioma (i18n) en el backend y PostgreSQL, utilizando un catálogo indexado por `key` y `locale`.
- El 2026-09-08 se actualizó el modelo de dominio (`03-domain-model-erd.md`) con 8 tablas iniciales (aplanamiento de `modules`, desacoplamiento de `actions`, `user_modules` y `translations`). Posteriormente el mismo día, se aprobó la incorporación de la novena tabla `module_groups`, reemplazando el atributo string `group_by` en `modules` por una clave foránea normalizada `module_group_id` con índice dedicado `idx_modules_module_group_id`.

## Próxima acción recomendada

Revisar la [especificación de gestión de IA](16-ai-provider-management-handoff.md) y el [ADR-006 propuesto](../architecture/decisions/ADR-006-ai-provider-configuration.md). La implementación de esta ampliación comienza con una prueba de login remoto en VPS y la reconciliación de los documentos afectados, sin aprobarlos automáticamente.

El [plan de seguridad](17-security-hardening-plan.md) queda en revisión desde el 2026-09-28. Sus etapas 0 a 5 definen las puertas de salida para el despliegue público de NestJS y Gemini; no cambia el estado de aprobación de los documentos existentes.

El 2026-09-28 el usuario eligió [acceso interno exclusivo de Nodia Server al microservicio Gemini](../architecture/decisions/ADR-007-gemini-internal-access.md). Postman podrá consumir los endpoints autorizados de Nodia Server; FastAPI no se publicará directamente. Implementación y verificación en VPS pendientes.

La primera implementación local de seguridad añadió autenticación entre servicios, permisos por acción para administración de IA y análisis, límites/validación de archivos, cifrado sin clave fija y pruebas. El [plan](17-security-hardening-plan.md#avance-de-implementación--2026-09-28) distingue los controles locales de los pendientes de infraestructura y autorización por ámbito. No se ha declarado el sistema listo para producción.

Se retiró la llamada directa del cliente a `localhost:8000/auth/login`. El botón de Settings puede iniciar y consultar un trabajo de login local a través de Nodia Server, con sesión y acción `ai:manage`, solo en desarrollo con Gemini en loopback; Chrome se abre en el host Python. El visor gráfico remoto del VPS sigue pendiente. El [runbook de seguridad](18-security-deployment-runbook.md) detalla la migración, comprobaciones externas y reversión; no se ha ejecutado en VPS.

Para los próximos microservicios, el usuario confirmó el mismo acceso interno exclusivo mediante [ADR-008](../architecture/decisions/ADR-008-internal-microservices-only.md). La [guía de incorporación](../architecture/internal-microservice-security.md) fija los pasos de token propio, red privada, autorización en Nodia Server, pruebas y despliegue. Esta documentación no declara aprobado ni verificado el despliegue de Gemini.

## Seguimiento técnico

- 2026-10-03: normalizados a LF los 78 archivos de texto que contenían CRLF: Client (63), Gemini (9), Server (4) y documentación (2). Se incorporan `.gitattributes` y `.editorconfig` en la raíz para conservar LF en checkouts y ediciones; Prettier de Server ya exige LF. Verificación por bytes/hash: contenido preservado excepto los finales de línea y estas reglas/entrada; ningún CRLF restante en los textos incluidos. Dependencias, generados, perfiles, sesiones y binarios excluidos; sin iniciar servicios, modificar valores de configuración ni alterar el índice de Git.

- 2026-10-03: limpieza de configuración local: `.env` y `.env.example` quedan con las mismas variables, orden y posiciones de línea en Client (3), Server (39) y Gemini (10). Se conservaron todas las asignaciones vigentes y los valores de ejemplo; faltantes opcionales se completaron con vacío o defaults verificados del código. Se retiró únicamente el marcador obsoleto `ANTIGRAVITY_AGENT`, que el runtime ignora. Validación de parser dotenv y alineación correcta, sin imprimir credenciales, iniciar servicios ni modificar código.

- 2026-10-03: QA temporal con Quick Tunnel de Cloudflare: el usuario reprodujo login Google rechazado por `AuthOriginGuard` (`403 auth:invalid_origin`). Se añade proxy Vite para `/api/v1` conservando Origin/cookies/Bearer, puerto estricto y destino local configurable sin exponerlo al bundle. Cliente local y ejemplo usan `/api/v1`; Server local autoriza el hostname exacto recibido y activa cookie Secure/Lax. [Guía de autenticación](14-authentication.md#qa-remoto-temporal-con-cloudflare-quick-tunnel--2026-10-03) registra configuración, diagnóstico y renovación de hostnames. 458 pruebas/71 archivos, tipado, lint y build correctos; cuatro regresiones nuevas con Vite real/backend sintético, sin Google. Configuración auth validada con su lector real; túnel responde HTML 200 con COOP correcto y API 403 desde el proceso todavía sin reiniciar. Pendientes: reiniciar Server/recargar cliente, completar login, renovación y logout con cuenta real. No se desactiva el guard, no se publica Gemini ni se aprueban documentos automáticamente.

- 2026-10-03: Ransack reforzado en Server con políticas explícitas para 14 consultas, sufijos completos, operadores negativos/nulos, valores parametrizados, búsquedas literales y límites del objeto q antes de filtros de dominio. DTO de productos habilita predicados adicionales sin cambio de acceso global. S-03 corregido localmente; S-09 y PostgreSQL/staging siguen pendientes. [ADR-010 propuesto](../architecture/decisions/ADR-010-ransack-query-policies.md) registra el contrato; AGENTS actualizado. Build correcto, lint sin errores con 7 advertencias previas, 287 pruebas/74 archivos correctos (42 regresiones nuevas); 14 políticas/111 columnas comprobadas en ESM sin conexión. No se ejecutaron consultas reales, migraciones, despliegue ni se aprobaron documentos automáticamente. Ver seguimiento al final de `19-prelaunch-review.md`.

- 2026-10-03: aclaración del usuario: administración sin permisos por acción y acceso global a productos/facturas/archivos entre negocios son intencionales para el público específico. S-01/S-02 se reclasifican por alcance, no se declaran corregidos ni se implementan restricciones. S-03 SQL dinámico continúa abierto. Se reabre parcialmente PRD V2 por contradicción con permisos de endpoints y se mantiene pendiente reconciliar documentos posteriores ya en revisión. Autenticación y demás invariantes no se modifican. Ver aclaración al final de `19-prelaunch-review.md`.

- 2026-10-03: revisión actualizada de Nodia Server y plan secuencial registrados en [19-prelaunch-review.md](19-prelaunch-review.md#revisión-actualizada-de-nodia-server--2026-10-03). Continúan abiertos permisos administrativos, aislamiento entre negocios y SQL dinámico (P0), además de integridad, migraciones y configuración IA. Se confirmó offline aceptación de factura inválida, paginación sin máximo, metadata de query borrada y saneamiento JSON superficial. Build correcto, lint sin errores con 7 advertencias, 245 pruebas/74 archivos correctos; audit de producción con 2 paquetes de severidad alta en la cadena Nest/Express/Multer. Se amplió `backend-service-quality` y creó `nestjs-service-quality` en el repositorio de skills/backend; ambas instaladas en Server y obligatorias en su AGENTS, copia genérica de Gemini sincronizada. No se modificó código de producto, lockfile, infraestructura ni estados de aprobación; correcciones del plan pendientes.

- 2026-10-03: por instrucción del usuario, se crearon `backend-service-quality` y `python-microservice-quality` en `C:\Users\Oscar\Desktop\skills\backend\` y se instalaron copias completas en `nodia-gemini-microservice/skills/`. AGENTS exige leer y aplicar ambas en desarrollo/revisión de código, contratos, configuración, pruebas y despliegue, junto con las skills específicas existentes. Las guías reutilizables separan garantías generales de mecanismos Python y contienen referencias condicionales; las restricciones de proveedores, acceso privado y estado real de Antigravity permanecen locales. Se validan formato, metadata, enlaces y equivalencia de copias. Esta entrega modifica instrucciones, no código de producto ni estados de aprobación.

- 2026-10-03: mejoras locales de Gemini implementadas por autorización del usuario; ver [seguimiento](19-prelaunch-review.md#seguimiento-de-implementación-de-gemini--2026-10-03) y [ADR-009 propuesto](../architecture/decisions/ADR-009-truthful-gemini-engines.md). Inicialización por lifespan/inyección y runner aislado, motor agéntico sin disponibilidad/fallback/cuota ficticios, modelo explícito exacto, parser Pydantic único, errores seguros/propagados, admisión/cuerpo/cancelación acotados, cuotas con caché/consulta compartida y contenedor no root con un worker. Server conserva ceros/nulos y clasificación/plazo HTTP; Client actualiza el tipo nullable del total. Validación: 57 pruebas Python en Windows/Linux sin Google, imagen Linux sin privilegios y pip check correctos, auditoría del manifiesto sin vulnerabilidades conocidas; Server build y 245 pruebas, Client build y 43 pruebas de importación/selección correctos. El usuario confirmó Antigravity de escritorio; su instalación local no demuestra un adaptador de sesión. Continúan pendientes esa integración real, sesión/login privado en VPS, volúmenes/reinicio con cuenta real y verificación externa. No se modificaron secretos ni se desplegó; no se aprueban documentos automáticamente.

- 2026-10-03: secuencia de mejoras de Gemini concretada en [19-prelaunch-review.md](19-prelaunch-review.md#gemini-microservice): aislamiento de pruebas, identidad real de motores, modelos dinámicos exactos, parser/contratos, errores y recuperación, admisión de cargas, consultas/limpieza y operación privada en VPS. Se contrastaron los hallazgos con el código actual; no se ejecutó la suite con acceso a Google ni se modificó código del microservicio. La viabilidad de Antigravity sin API keys, los cambios coordinados en Server y las pruebas de VPS continúan pendientes. El plan conserva el estado de revisión y no crea otro documento temporal.

- 2026-10-02: por instrucción del usuario, se creó la skill reutilizable `frontend-quality` en su repositorio de skills y se instaló una copia en `nodia-client/skills/frontend-quality`. El AGENTS del cliente exige leerla y aplicarla en los cambios de código frontend junto con las skills locales correspondientes; incluye referencia condicional a escenarios de regresión y evidencia de cierre. Esta entrega modifica instrucciones, no código de producto ni estados de aprobación.

- 2026-10-02: mejoras de Client implementadas con los contratos actuales; seguimiento en [19-prelaunch-review.md](19-prelaunch-review.md#seguimiento-de-implementación-de-client--2026-10-02). Identidad IA por instancia/modo, sin controles de API keys ni disponibilidad/cuotas inventadas; errores deduplicados y reintento, formularios preservados, cancelación de login, paginación y selectores remotos, revisión estricta de borradores e indicadores parciales ocultos. Lint/build correctos, 454 pruebas en 70 archivos y npm audit sin vulnerabilidades. Portada/login verificados localmente; contratos de Server/Gemini y staging siguen pendientes. El plan temporal y sus referencias se retiraron por petición del usuario, sin aprobar documentos automáticamente.

- 2026-10-02: revisión previa al lanzamiento de Client, Server y Gemini documentada en [19-prelaunch-review.md](19-prelaunch-review.md), en revisión. Incluye huecos de autorización por acción/negocio, consultas dinámicas, importación sin atomicidad/idempotencia, conversión de datos en migraciones, métricas/paginación y discrepancias del motor agéntico con la política sin API keys. Últimos checks: Client build correcto, lint con 6 errores y 448 tests correctos; Server build/lint correctos y 236 tests; Python 27 tests correctos, pero parte de la suite conectó realmente a Google y debe aislarse. No se modificó código ni se ejecutaron migraciones/despliegues; verificaciones de VPS y navegador real siguen pendientes. No se aprueba automáticamente el lanzamiento ni los documentos.

- 2026-09-29: revisión interna de `nodia-gemini-microservice`: se añadió `AGENTS.md` con selección de skills locales y límites del adaptador privado; se auditó `.env`/`.env.example` por consumidores y no se encontraron variables sin uso. Se reforzó la persistencia atómica de cookies, el cierre de Playwright ante cancelación, la limpieza de clientes Gemini fallidos, los contratos de respuesta y los scripts de arranque. Docker monta `.env` de solo lectura y persiste rotaciones en `session_state/`. Esto no sustituye la prueba de login remoto ni la verificación en VPS.

- 2026-09-25: se abrió la [entrevista de operación de proveedores de IA](15-ai-providers-interview.md) como ampliación previa a producción. Se confirmó despliegue híbrido: NestJS y microservicio en VPS; frontend en Cloudflare Pages; R2 para archivos; PostgreSQL y Redis gestionados externamente. Gemini Web/Gemini API se alternan manualmente. El cambio de API en Northflank y el uso de Docker requieren reconciliar el stack y la arquitectura del MVP.
- 2026-09-25: entrevista cerrada como borrador en revisión; [especificación para agente](16-ai-provider-management-handoff.md) redactada y no aprobada. Se reabrió el sitemap afectado. Las decisiones confirmadas y propuestas técnicas están diferenciadas en la especificación.

- 2026-09-23: flujo Gemini Web para imágenes corregido según [ADR-005](../architecture/decisions/ADR-005-gemini-web-session.md) (en revisión documental). El microservicio persiste cookies rotadas, detecta nuevos logins y recupera autenticación con el perfil; NestJS dejó de recurrir a `GEMINI_API_KEY`. Prueba local con cuenta real e imagen de factura sintética: extracción correcta; reinicio posterior autenticado. Pendiente: observar la sesión tras varias horas de inactividad.

- 2026-09-12: opción A de [ADR-003 — Rate limiting distribuido](../architecture/decisions/ADR-003-api-rate-limiting.md) aprobada por el usuario e implementada con `@nestjs/throttler` y Redis. Compatibilidad con NestJS 12 resuelta mediante overrides acotados y verificada localmente. Incluye cuotas por IP, `429`/`Retry-After`, `503` ante fallo de Redis y feedback es/en del cliente. Pendientes de operación: confirmar Redis/proxy y ajustar cuotas con tráfico de staging. Login y cuotas por usuario se completan en la ampliación posterior a auth registrada abajo. No se realizó despliegue.

- 2026-09-12: autenticación solicitada e implementada en [ADR-004](../architecture/decisions/ADR-004-auth-sessions.md) y [guía operativa](14-authentication.md). Login Google, JWT propio, refresh rotativo HttpOnly, guard global, contexto real, persist, avatar/logout y migración. Pendientes externos: Google Cloud/cuenta real y despliegue. Autorización fina por acciones sigue en T3.4b. Se reabren las revisiones documentales afectadas por ampliar la estrategia de sesiones.
- 2026-09-12: requisito adicional de sesión activa implementado. Visitantes sin token no llaman a la API; la recuperación valida/renueva antes de habilitar datos. Consultas y transporte Axios bloqueados sin sesión activa. Guard global comprobado para rutas de negocio, con excepciones públicas por método. Se actualizan ADR-004 y documentos 08, 11 y 14 sin marcarlos aprobados.
- 2026-09-12: refactor solicitado de configuración HTTP: `axiosInstance.ts` queda dedicado al transporte, `authSession.ts` concentra la lógica de sesión y `api.ts` compone ambos con un gestor compartido. Se actualizan imports, pruebas y documentación, conservando el contrato de autenticación y el estado de revisión de los documentos.
- 2026-09-12: navegación separada en `GuardStrict` (sesión y módulo asignado en `/settings/*`), `Guard` (demo o sesión) y `NoGuard` (login). La carga de contexto precede a páginas estrictas, incluidos accesos directos por URL. Menú y tarjetas ocultan módulos sin sesión validada. Se actualizan las reglas documentales sin aprobar nuevas versiones.
- 2026-09-12: integración pendiente de rate limiting con auth completada. Login incorpora 10 intentos/minuto por IP; usuario verificado, 300 solicitudes/minuto y 30 escrituras/minuto compartidas entre sesiones/IPs. Registro global explícito IP → JWT/sesión → usuario; refresh/logout mantienen protección por IP. Backend: build/lint y 73 pruebas correctos, más comprobación HTTP de auth con dos procesos y Redis temporal real. Se actualizan ADR-003 y documentos dependientes conservando su estado de revisión. Continúan pendientes la validación de Redis/proxy y calibración en el despliegue.
