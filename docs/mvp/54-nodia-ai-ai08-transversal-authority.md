# NodiaAI — AI-08: autoridad transversal e invariantes compartidas

> Estado: implementado y verificado localmente; revisión documental pendiente, sin aprobación automática
> Fecha: 2026-10-15
> Fuentes: [plan45](45-nodia-ai-implementation-plan.md), [contratos41](41-nodia-ai-v1-contracts.md), [arquitectura43](43-nodia-ai-execution-architecture.md), [AI-07/53](53-nodia-ai-ai07-module-authorization.md), [ADR-039](../architecture/decisions/ADR-039-shared-authority-transactions.md).

## Resultado y alcance

Separa identidad autenticada y destinatario en los casos de uso de Finanzas y Reservas, REST y Client. Resuelve NI-13 en los escritores administrativos y prepara una frontera transaccional interna de NodiaAI. No añade tablas, migraciones, permisos, herramientas MCP, controladores del chat ni cambios en la BD configurada. Los siete handlers masivos siguen excluidos de v1.

Las reglas nuevas viven en casos de uso; los servicios conservan persistencia y consultas. Create/Update administrativos delegan en Save*UseCase para compartir exactamente las mismas invariantes, incluyendo los upsert existentes. No modifica el acceso global autenticado de los endpoints Core ni lo sustituye por un nuevo esquema de permisos. NodiaAI mantiene su propia intersección de módulos de AI-07.

## Identidad, destinatario y propiedad

`ActorReference` contiene userId y sessionId derivados de request.auth; nunca se acepta un actor del cuerpo. La autoridad se relee en PostgreSQL, sin confiar en roles del JWT, Redis o Client. Usuario activo, sesión vinculada, no revocada y no vencida son obligatorios; super_admin procede de una relación y rol activos actuales.

Finanzas acepta `owner_id` opcional en query, validado como bigint positivo. Ausencia significa el propio actor incluso para super_admin. Destinatario distinto exige super_admin y usuario existente; permite consultar historia de un destinatario inactivo. POST conserva user_id del destinatario; PUT/DELETE y asociaciones se restringen al mismo dueño. El cuerpo no transfiere propiedad. Importes exactos, ledger, estados, categorías, pagos y restricciones de eliminación conservan sus validaciones nativas. No inventa columnas de auditoría financiera ausentes en el modelo actual.

Reservas permite super_admin sobre cualquier alojamiento sin crearle una membresía artificial. Listado, capacidades, lecturas, configuración, colaboradores y escrituras comparten la decisión. La respuesta distingue membership.type=super_admin cuando corresponde; owner_id permanece real. Crear alojamiento admite owner_id opcional sólo con autoridad transversal, y exige destinatario activo. created_by/updated_by y journal conservan el actor real. Update no transfiere propiedad. Se conservan locks del alojamiento, disponibilidad, ocupación, dinero, estados, políticas y request keys. Recuperar una operación por su clave sigue exigiendo al actor original: visibilidad administrativa no autoriza suplantarlo.

Client ofrece un selector común de usuario basado en GET /users real, búsqueda paginada por correo y resolución del seleccionado. Finanzas incluye usuarios inactivos para consultar su historia y los identifica; crear alojamiento limita el catálogo a activos. Finanzas añade destinatario a transporte y claves de caché, descarta datos anteriores al cambiar de dueño y reinicia la vista. Bloquea el cambio durante formularios, confirmaciones, mutaciones o resultado incierto. Al perder el rol retorna al ámbito propio; backend vuelve a validar de todas formas. Crear alojamiento muestra destinatario sólo para super_admin; editar no lo modifica. La navegación sigue requiriendo asignación conforme al contrato14, también para super_admin.

## NI-13 y atomicidad

- Usuarios: guardar campos y reemplazar roles/módulos constituye una sola transacción. IDs inexistentes o inválidos rechazan todo el cambio, incluyendo el nombre. Se deduplican asociaciones y se acota su cantidad. La normalización de correo conserva el upsert previo.
- No se permite pasar de al menos un super_admin activo a cero por desactivación, reemplazo de roles o upsert. El conteo incluye usuario, relación y rol activos. Cambios concurrentes se serializan. No crea administradores ni repara silenciosamente una instalación que ya estuviera sin ellos.
- El rol reservado super_admin no puede renombrarse, desactivarse ni eliminarse. La identidad key de módulos es inmutable, incluidos alias PUT/PATCH. Client bloquea su edición y conserva edición de traducciones.
- Catálogos, traducciones y asociaciones se guardan atómicamente. Acciones desconocidas de un rol generan error en lugar de descartarse silenciosamente. Omitir is_active en un DTO parcial conserva su estado; se retiraron inicializadores de DTO que reactivaban entradas accidentalmente. Las entidades siguen definiendo el valor inicial de una creación.

## Barrera entre autorización y efecto

Antes del primer SELECT, la transacción adquiere `LOCK TABLE actions, auth_sessions, module_groups, modules, role_actions, roles, user_modules, user_roles, users` en ese orden. Lecturas/efectos de dominio usan SHARE; escritores de autoridad usan SHARE ROW EXCLUSIVE. Login/refresh/revocación y bootstrap comparten el orden. Se adquiere antes de locks particulares de Reservas y antes del snapshot de resúmenes REPEATABLE READ. Espera máxima de lock2s y de statement5s, sin reintentos automáticos de efectos inciertos.

Una revocación espera al efecto ya admitido; una vez confirmada impide el siguiente. Un lector que espera detrás de un escritor obtiene el estado posterior, incluso en REPEATABLE READ. El lock se mantiene hasta commit/rollback. No se mantiene durante inferencia, espera humana, uploads ni otras llamadas al proveedor. Los cambios de colaboradores conservan además su exclusión nativa por alojamiento.

`ExecuteAuthorizedNodiaAiUseCase` toma la barrera, aplica la política AI-07 con el mismo EntityManager y entrega identidad y transacción al puerto registrado. Finanzas y Reservas reutilizan ese manager; no abren un commit independiente. Los resúmenes exigen REPEATABLE READ también en el manager heredado: una transacción más débil se rechaza antes de leer datos. El callback es una composición interna, nunca código o HTTP recibido del modelo. Se probó rollback exterior de un movimiento financiero y revocación del módulo antes de invocar el puerto.

Los escritores Core toman su barrera exclusiva como operación raíz. No se anidan bajo el ejecutor SHARE de dominio: los puertos administrativos de AI-27 deberán componer autorización y escritura en su frontera exclusiva y devolver proyecciones dentro de ella. Esta etapa implementa sus invariantes REST compartidas; no publica ni declara integrado un puerto MCP administrativo. Los consumidores de lecturas/contexto y el worker siguen las etapas AI-12/14 y los puertos por familia. Antes de publicar el bridge de Reservas, AI-24 debe preservar y comprobar en la transacción heredada su deadline total y mapeo de errores nativos; esta etapa verifica sus garantías REST y no declara ese bridge listo.

La barrera es deliberadamente gruesa: efectos concurrentes de dominio pueden convivir, pero un cambio de autoridad o sesión espera globalmente, también entre usuarios distintos. Puede competir con mantenimiento/autovacuum. Es un costo explícito de esta etapa, no una garantía de throughput productivo; medir antes de despliegue y evolucionar sólo con evidencia. Detalle y alternativas en ADR-039.

## Verificación y límites

[Integración PostgreSQL](../evidence/nodia-ai-ai08-postgres-integration.json): 39 comprobaciones sobre Nest compilado y PostgreSQL16 desechable, migraciones reales e identidades sintéticas. Comprueba destinatarios/propiedad/auditoría, asociaciones inválidas con rollback, restricciones de catálogos, exclusión real de revocación con pg_locks, snapshot posterior a revocación, composición/rollback del puerto, dos desactivaciones administrativas concurrentes y sesión revocada. El guard del harness inyecta identidades sintéticas: prueba la validación interna de sesiones reales de esa BD, no un login JWT de usuario real.

Los ensayos anteriores de Finanzas, Reservas, módulos, roles y acciones también se adaptaron a sesiones válidas sintéticas y pasaron completos: incluyen pagos/ocupación concurrentes, rollback, restauración de backup y ambas carreras de FK en catálogos. El harness AI-08 agrega rechazo de aislamiento heredado insuficiente y aceptación del snapshot correcto.

Las suites completas verificadas contienen 912 pruebas/118 archivos Server y 1.205/192 Client. La revisión de pantalla usa página/routing/componentes reales con HTTP sintético; no sustituye aceptación de permisos contra una cuenta desplegada. [QA visual](../evidence/nodia-ai-ai08-browser-qa.json) y [entrega](../evidence/nodia-ai-ai08-authority-validation.json) registran comandos, resultados y límites definitivos.

Inventario39 conserva 34 controladores/177 handlers/296 rutas y38 módulos Nest; se reconcilian firmas, referencias y hashes con procedencia, sin habilitar candidatos. Fichas draft/unregistered y manifiesto vacío; la nueva ficha de autoridad amplía el corpus a39 documentos, sin aprobar ni publicar conocimiento. No nuevas inferencias, configuraciones de proveedor o cambios en la BD de uso. No se afirma carga, despliegue, teléfonos físicos, puertos MCP de familias ni aceptación integral del chat.

## Continuidad

AI-08 queda cerrado en este alcance. **Siguiente AI-09**: persistencia inicial y módulos verticales de conversación según M1, materializando juntos wire/ERD de routing y contadores conforme AI-04. Permanecen pendientes worker, API/chat, propuestas/confirmación, idempotencia de puertos y todas las verificaciones de publicación. Esta entrega no aprueba automáticamente documentos o ADR.
