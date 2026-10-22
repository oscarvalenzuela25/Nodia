# NodiaAI AI-26 — dinero, bloqueos y preparación de Reservas

> Estado documental: en revisión; sin aprobación automática.
> Fecha: 2026-10-17.
> Estado técnico: implementado y verificado en laboratorio privado; escrituras MCP sin publicar y aceptación Gemini pendiente.
> Dependencias: [plan45](45-nodia-ai-implementation-plan.md), [contratos28](28-rental-reservations-contracts.md), [contratos41](41-nodia-ai-v1-contracts.md), [autoridad54](54-nodia-ai-ai08-transversal-authority.md), [confirmación64](64-nodia-ai-ai18-human-confirmation.md), [recuperación66](66-nodia-ai-ai20-execution-recovery.md), [conjuntos69](69-nodia-ai-ai23-dependent-workflows.md), [configuración70](70-nodia-ai-ai24-rental-configuration.md) y [ciclo comercial71](71-nodia-ai-ai25-rental-reservation-lifecycle.md).

## Alcance

Diez preparadores internos amplían el mecanismo existente de propuesta/revisión, botón humano exacto y ejecución nativa con recibo atómico:

| Recurso | Operaciones | Escritores nativos |
|---|---|---|
| rental_payments | create, void | CreateRentalPaymentUseCase, VoidRentalPaymentUseCase |
| rental_expenses | create, update, pay, void | Create/Update/Pay/VoidRentalExpenseUseCase |
| rental_blocks | create, update | Create/UpdateRentalBlockUseCase |
| rental_turnovers | update, approve_same_day | UpdateRentalTurnoverUseCase, ApproveSameDayRentalTurnoverUseCase |

Los nombres son nodia_<recurso>_prepare_<operación>. No añade rutas HTTP nativas, tablas, columnas ni migraciones de chat. No se publica una herramienta porque exista un writer o una ficha. MCP/Gemini de escritura conservan su aceptación independiente.

## Dinero y reglas nativas

Cobros/devoluciones registran dinero ya recibido/devuelto; no ejecutan transferencias ni movimientos de Finanzas personales. Create distingue type payment/refund. Void anula un registro completo y conserva historial; no crea refund. Montos enteros positivos CLP se mantienen como strings bigint. Cobros no exceden el neto esperado y respetan anticipo/política; el primer cobro captura el acuerdo de cancelación. Airbnb exige condiciones externas explícitas conforme flujo nativo, sin consulta externa.

Refund exige reserva cancelada, aprobación pendiente suficiente e importe recibido suficiente; fecha efectiva no anterior al día local de cancelación ni futura. Anular un cobro preserva las restricciones de anticipo y fase. No hay edición monetaria libre ni anulación parcial.

Gasto create exige nombre, importe, día y estado explícito pending/paid. Paid requiere paid_on válido; pending no admite fecha de pago. Pay registra el pago completo del mismo gasto pending, sin crear otro. Update en pagados restringe importe/día del gasto; voided no se edita. Notas/categoría/asociación son opcionales/nulas según DTO. Días civiles usan zona de casa; la pregunta ambigua requiere aclaración.

Fuentes: [pagos DTO](../../nodia-server/src/rental-payment/dto/rental-payment.dto.ts), [writers pagos](../../nodia-server/src/rental-payment/use-case/), [gastos DTO](../../nodia-server/src/rental-expense/dto/rental-expense.dto.ts) y [writers gastos](../../nodia-server/src/rental-expense/use-case/).

## Bloqueos y preparación

Bloqueos requieren inicio/fin instantes explícitos con final posterior y motivo. Actividad usa default nativo visible. Activos revalidan conflictos y planes; desactivar libera disponibilidad conservando historia. Casa archivada no admite nuevos bloqueos ni activar/cambiar intervalo activo.

Preparación edita un registro existente: ropa true/false/null, limpieza pending/in_progress/completed, hora prevista/real nullable y notas nullable. Null no equivale a false. Ready_at exige ropa true, limpieza completada, hora no futura ni anterior a salida previa. Hora prevista no prueba preparación real. Cambios de ropa/plan/vecino pueden invalidar aprobación.

Approve_same_day usa comando vacío para un plan concreto vigente; exige misma fecha local entre estadías, ropa true y ventana válida según minutos mínimos. No confirma reserva ni inicia estadía. Las fechas se editan con zona IANA de la casa, no del navegador; DST inexistente/ambiguo requiere corrección.

Fuentes: [bloqueos DTO](../../nodia-server/src/rental-block/dto/rental-block.dto.ts), [writers bloqueos](../../nodia-server/src/rental-block/use-case/), [preparación DTO](../../nodia-server/src/rental-turnover/dto/update-rental-turnover.dto.ts), [writers preparación](../../nodia-server/src/rental-turnover/use-case/) y [reglas de calendario](../../nodia-server/src/rental-common/rental-calendar.rules.ts).

## Autoridad, concurrencia y recuperación

Se exigen NodiaAI, rental_reservations y acceso nativo a property_id para usuarios ordinarios. Super_admin conserva actor real. Cada asociación se resuelve dentro de casa. El backend revalida autoridad y precondiciones; no hay SQL ni HTTP arbitrarios.

Paridad funcional del inventario44:21 lecturas publicadas,22 escrituras individuales internas tras AI-26 y1 endpoint nativo de coordinación `GET operations/:requestKey`. Esta última consulta conserva la identidad del actor original según28; no se convierte en herramienta del modelo ni expone requestKey/API key. Super_admin puede observar la ejecución y su recibo histórico autorizado desde el chat mediante GetExecution existente, sin confirmar ni reanudar como su dueño. Esta ampliación no cambia el permiso del journal nativo.

Preparación captura snapshots materiales; revisión cambia hash y exige nuevo botón. Worker reutiliza los escritores, journal, locks y transacción del recibo RentalEffectReceipt, ampliado a los cuatro recursos y operaciones exactas. Reanudar recupera recibo sin repetir efecto; timeout/COMMIT incierto exige conciliación. Conjuntos de entradas conocidas conservan lo completado; no incorporan bindings futuros nuevos. Cancelar ejecución no revierte dinero, bloqueos o preparación comprometidos.

Implementación vertical: [factory de dinero](../../nodia-server/src/nodia-ai-rental-money/use-case/build-nodia-ai-rental-money-operations.use-case.ts) y [proyecciones de dinero](../../nodia-server/src/nodia-ai-rental-money/nodia-ai-rental-money.service.ts); [factory de bloqueos/preparación](../../nodia-server/src/nodia-ai-rental-operations/use-case/build-nodia-ai-rental-operations.use-case.ts) y [proyecciones de ocupación](../../nodia-server/src/nodia-ai-rental-operations/nodia-ai-rental-operations.service.ts). Los adapters no duplican el ledger ni aceptan un writer genérico arbitrario.

## Client y contexto

Labels de diez operaciones, campos/estados/tipos ES/EN, CLP explícito, receipts con bigint intacto y enlace /tools/reservations. Editor usa DateInput para días civiles y DateTimeInput con zona readonly verificada para instantes. Linen_ready permite null explícito sin convertirlo a false. Platform_policy es readonly recursivo; no JSON libre. Mutaciones conservan formulario ante error y notifican con traducción; efectos completados invalidan caché rental por actor.

Fichas [dinero](../nodia-ai/knowledge/reservations/features/confirmed-money.md) y [bloqueos/preparación](../nodia-ai/knowledge/reservations/features/confirmed-occupancy-preparation.md), y [resumen de Reservas](../nodia-ai/knowledge/reservations/README.md) actualizados. Nueve documentos de lectura aprobados intactos. Las nuevas fichas permanecen draft/unregistered, approval null. Corpus verificado50 fuentes/23 excluidas y67 lecturas/27 fragmentos conservados.

## Verificación y pendientes

Implementación y laboratorio privado verificados; resultados trazados en la [evidencia consolidada](../evidence/nodia-ai-ai26-validation.json). QA de interfaz utiliza fixtures sintéticas, sin inferir estado operativo ni permiso Server. Publicación MCP y aceptación Gemini, AI-15/22/32 y aprobación documental siguen pendientes independientes.

- [Client verificado](../evidence/nodia-ai-ai26-client-validation.json): suite completa1.526 pruebas/203 archivos,481.94s con2workers; focal260/5,27.61s; tipado/lint correctos y build11.90s. Logs finales con hashes en la evidencia: `nodia-client/.tmp/ai26-client-focused-final.log`, `ai26-client-typecheck-final.log`, `ai26-client-lint-final.log`, `ai26-client-build-final.log` y `ai26-client-full-release.log`. Sin nuevas dependencias ni rutas. Build conserva el aviso histórico de chunks superiores a500kB; la suite registra cuatro avisos JSDOM de navegación, avisos de Emotion first-child, mocks undefined de React Query y HydrateFallback de React Router, con0 pruebas fallidas. No se repitió la suite tras pasar.
- Regresiones de Client: diez operaciones traducidas, cuatro recursos de recibos e invalidación por actor, monto CLP bigint exacto y rechazo de cero cuando mínimo1, días civiles e instantes con zona de casa, null/false/true de ropa independientes, horas sin editar conservadas, nulos de asociación y fecha prevista, rechazo de escritura con borrador intacto y mensajes nativos permitidos, diferencias void/refund y pay/nuevo gasto, política capturada readonly recursiva con etiquetas localizadas. Pruebas de reloj/DST inválido, zona ausente, servicio caído y metadata inválida se conservan del editor compartido.
- [QA raíz de interfaz](../evidence/nodia-ai-ai26-ui-validation.json):9 comprobaciones sintéticas/4 capturas para preparación, devolución, recibo EN y bloqueo. Selector de ropa conserva null/false/true; fecha inválida impide guardar y mantiene borrador, foco/valor conservados al solicitar viewport390×844; corrección produce revisión2/hash/toast sin cambiar ready_at null. Devolución diferencia dinero registrado/transferencia externa/anulación; recibo EN conserva ID9007199254740996 y enlace real /tools/reservations. Bloqueo muestra zona Santiago/preparaciones afectadas; editar sólo motivo conserva offsets y produce revisión2. Tab temporal cerrado, viewport restablecido y QA5194 detenido; no teléfono físico ni SQL/proveedor real. La inyección de rechazo HTTP se verificó en tests de componentes, no en este recorrido CUA.
- Server: **2.637 pruebas/194 archivos**,219.77s con2workers; build correcto y lint sin errores (tres avisos previos). Los nuevos factories aportan64 casos de dinero y53 de bloqueos/preparación;20 regresiones nativas y134 casos del coordinador focal comprobados. Las reglas de preparación se extrajeron a un helper puro compartido con los escritores nativos, sin alterar su semántica.
- [SQL/HTTP/worker](../evidence/nodia-ai-ai26-postgresql.json): **44 comprobaciones nuevas** sobre los diez puertos, devolución parcial/anulación, gastos, carreras de ocupación, preparación real/prevista, casa archivada, revocación, rollback, SIGKILL/reanudación y COMMIT perdido. [Regresiones](../evidence/nodia-ai-ai26-regressions.json): **266 comprobaciones**, incluidas282 peticiones HTTP nativas; total310. PostgreSQL desechable eliminado, cero inferencias y ningún cambio de datos de uso. El primer intento conservado tenía una expectativa del harness sobre dos workers del mismo actor; se corrigió drenando el segundo trabajo queued antes de comprobar su resultado final.
- Paridad44 de Reservas comprobada:21 lecturas publicadas,22 escrituras individuales internas y1 recuperación nativa. GET de journal retorna200 al actor original y404 a otro actor incluso super_admin; la observación autorizada de la ejecución ajena conserva el recibo y no permite confirmar/reanudar como su dueño. Snapshots omiten notas, ropa o fase del vecino que no cambian el efecto, y conservan los datos materiales y las validaciones nativas actuales.
- [Paridad del compilado](../evidence/nodia-ai-ai26-tested-release-parity.json):837 archivos dist idénticos entre paquete probado985059cc1f77d40d78d60b30d732132383982f7df7cfff974a9e6c10c4cefe45 y paquete final2c23a8589f05f7d5799d11a15bbb245cce842dd4db997741f788f8c76495ea7a; únicamente cambia el helper de prueba que drena el segundo trabajo. El harness final es el ejecutado con resultado correcto.
- [Backup y activación](../evidence/nodia-ai-ai26-lab-activation.json), [igualdad desplegada](../evidence/nodia-ai-ai26-deployed-equality.json), [runtime leído](../evidence/nodia-ai-ai26-lab-runtime.json) y [servicios](../evidence/nodia-ai-ai26-services.json):25 migraciones/18 tablas NodiaAI/241 columnas,48 ejecutores y0 jobs/intentos/slots pendientes. API/worker/nginx y tres contenedores base activos; Client5174 y túnel3100 retornan HTTP200. Cero tablas/columnas/migraciones nuevas y perfil, credenciales/configuración y dependencias conservados. Tiempos de evidencia de Windows y VM proceden de sus propios relojes; no se normalizan entre hosts.
- [Contratos estáticos](../evidence/nodia-ai-v1-catalog-contracts-validation.json):136 definiciones comunes,184 de dominio,134 contratos cerrados,450 fixtures y722 hashes productivos;72 módulos/43 controladores/204 handlers/323 rutas, sin endpoints nuevos en AI-26. [Conocimiento](../evidence/nodia-ai-ai26-knowledge-validation.json):53 checks,50 fuentes/23 excluidas,67 capacidades/27 fragmentos. [Delta de release](../evidence/nodia-ai-ai26-knowledge-delta.json) cambia sólo digest de registry y release por dos fichas draft explícitas, sin reescribir documentos/fragmentos/contratos publicados.

Siguiente desarrollo: **AI-27**, administración Core. Preparadores MCP de escritura y aceptación Gemini siguen pendientes; AI-15/22 conservan sus gates de dependencias externas/R2/routing y AI-32 el staging/adjuntos. No se aprueba automáticamente este documento ni sus fichas. No hay DELETE físico, escrituras por lote, ledger paralelo ni transferencias externas añadidas.
