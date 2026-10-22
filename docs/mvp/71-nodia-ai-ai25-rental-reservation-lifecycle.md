# NodiaAI AI-25 — disponibilidad y ciclo comercial de Reservas

> Estado documental: en revisión; sin aprobación automática.
> Fecha: 2026-10-17.
> Estado técnico: implementado y verificado en laboratorio privado; preparadores MCP de escritura sin publicar y aceptación de escrituras con Gemini pendiente.
> Dependencias: [plan45](45-nodia-ai-implementation-plan.md), [contratos28](28-rental-reservations-contracts.md), [contratos41](41-nodia-ai-v1-contracts.md), [autoridad54](54-nodia-ai-ai08-transversal-authority.md), [confirmación64](64-nodia-ai-ai18-human-confirmation.md), [recuperación66](66-nodia-ai-ai20-execution-recovery.md), [conjuntos69](69-nodia-ai-ai23-dependent-workflows.md) y [configuración70](70-nodia-ai-ai24-rental-configuration.md).

## Alcance

AI-25 incorpora seis puertos internos de reservas al protocolo existente de preparación, revisión, botón humano y ejecución local con recibo atómico. No crea otro calendario ni sustituye las reglas del dominio.

| Preparador interno | Caso de uso nativo | Efecto |
|---|---|---|
| `nodia_rental_reservations_prepare_create` | `CreateRentalReservationUseCase` | Crea un borrador; no ocupa disponibilidad |
| `nodia_rental_reservations_prepare_update` | `UpdateRentalReservationUseCase` | Edita sólo campos admitidos por la fase del acuerdo |
| `nodia_rental_reservations_prepare_confirm` | `ConfirmRentalReservationUseCase` | Confirma tras validar acuerdo, anticipo/plataforma, disponibilidad y recambio |
| `nodia_rental_reservations_prepare_start` | `StartRentalReservationUseCase` | Inicia una estadía confirmada en su intervalo y con preparación efectiva |
| `nodia_rental_reservations_prepare_complete` | `CompleteRentalReservationUseCase` | Completa una estadía en curso después de la salida |
| `nodia_rental_reservations_prepare_cancel` | `CancelRentalReservationUseCase` | Cancela el acuerdo y registra su resolución; no paga una devolución |

Fuentes reales: [DTO de creación](../../nodia-server/src/rental-reservation/dto/create-rental-reservation.dto.ts), [DTO de edición](../../nodia-server/src/rental-reservation/dto/update-rental-reservation.dto.ts), [comandos](../../nodia-server/src/rental-reservation/dto/reservation-commands.dto.ts), [casos de uso](../../nodia-server/src/rental-reservation/use-case/) y [reglas de acuerdo](../../nodia-server/src/rental-reservation/types/rental-reservation.rules.ts).

Los pagos, devoluciones efectivas, gastos, bloqueos y preparación conservan AI-26. No se añaden DELETE, reaperturas, holds, integración externa Airbnb ni confirmación automática de cambios. Las lecturas existentes de disponibilidad, calendario y simulación de cancelación siguen siendo lecturas; consultar no congela fechas.

## Mínimos, estados y tiempo

Crear exige casa concreta, nombre/contacto del huésped, cantidad de huéspedes, canal, días civiles de entrada/salida, ambos horarios por reserva, tarifa nocturna y anticipo explícitos. Los campos opcionales del DTO no se convierten en obligatorios por el chat. Limpieza/descuento/comisión y actividad usan sólo defaults efectivos del contrato y quedan visibles en la propuesta. El total y las noches se derivan del acuerdo; las horas de la casa no sustituyen horarios de estadía.

La secuencia comercial es draft→confirmed→in_progress→completed, con cancelación sólo en las fases permitidas por el backend. El estado no se edita como campo libre. Un borrador no ocupa fechas. Acuerdos con historial monetario, incluso pagos anulados, y acuerdos ya confirmados restringen la edición; no se reescribe precio o política histórica con otro PUT.

Confirmar exige anticipo recibido y política de cancelación en el flujo directo. Airbnb conserva su contrato propio: referencia externa, anticipo cero y condiciones de plataforma explícitas; no se inventa un pago ni se consulta una plataforma externa. `same_day_approvals` contiene IDs de preparaciones concretas y vigentes; no es una autorización general de solapamiento. Inicio exige limpieza completada, ropa lista, hora real de preparación y ventana temporal; completar exige haber llegado a la salida. Server revalida condiciones y autoridad al ejecutar.

Fechas civiles `YYYY-MM-DD` y horas `HH:mm` conservan la zona IANA de la casa. Los vencimientos/cancelación son instantes con UTC u offset explícito. Una hora inexistente o ambigua por DST requiere corrección; nunca se elige el huso del navegador. Importes son enteros CLP como strings dentro del contrato bigint nativo, sin conversión flotante.

## Cancelación y efectos monetarios

La simulación no modifica el acuerdo. El preparador de cancelación incorpora instante efectivo, devolución/resolución cuando corresponda y cálculo nativo esperado; la ejecución recalcula bajo lock y rechaza un cálculo cambiado. La devolución aprobada pendiente y el saldo después de cancelar se muestran separados del dinero recibido y retenido. Cancelar no registra una salida de caja ni un nuevo movimiento de Finanzas personales.

`expected_refund_amount`, `received_amount`, `retained_amount`, `balance_due_after_cancellation` y `refund_due_after_cancellation` son valores derivados de Server. El editor no permite falsear esos importes ni el status. La fecha de cancelación no puede ser futura ni estar fuera de la fase/intervalo admitidos por el dominio. Una corrección material necesita otra revisión y confirmación exacta.

## Autoridad, snapshots y recuperación

Para usuarios ordinarios se requieren NodiaAI y el módulo `rental_reservations`, además de acceso nativo a la casa. `super_admin` conserva transversalidad con su actor real; ver un chat ajeno no permite confirmar como su dueño. El ámbito es `property_id` y cada reserva debe pertenecer a esa casa. Invitados, contactos y términos sólo se muestran al actor autorizado; no se incluyen credenciales ni acceso SQL libre.

La implementación reutiliza las transacciones y writers nativos, journal idempotente, locks y hash normalizado de comandos. La preparación captura precondiciones materiales; la admisión y el efecto comprueban compatibilidad. El comando confirmado y el recibo usan la misma transacción del coordinador, sin un commit anidado aparente. El recibo `RentalEffectReceipt` incorpora `rental_reservations` y las operaciones create/update/confirm/start/complete/cancel, conservando IDs bigint como strings.

El worker recupera desde el recibo sin repetir el efecto. Timeout o pérdida de respuesta de COMMIT requieren conciliación; cancelar una ejecución no deshace una reserva ya comprometida. Los conjuntos AI-23 pueden combinar operaciones con entradas conocidas, conservando los pasos completados ante fallo; AI-25 no añade un binding futuro de reserva creada→transición. Los datos técnicos resueltos se eliminan con el chat según50; el dominio mantiene su conservación nativa.

## Client

Preview y recibos traducen seis operaciones y estados/canales ES/EN; muestran la diferencia entre crear borrador, confirmar reserva y confirmar humanamente una propuesta. `same_day_approvals` y `platform_policy` se presentan recursivamente como datos readonly, sin textarea JSON; corregirlos requiere otra intención. Los campos escalares admitidos usan metadata registrada y la revisión mantiene el hash exacto.

Los controles temporales reutilizan DateInput, TimeInput y DateTimeInput dentro del editor secundario. La zona de un instante procede del campo readonly de Server; si falta no se supone una. Una edición explícita de fecha/hora genera el instante correspondiente a esa casa, mientras los valores sin editar permanecen exactos. Error/resize conserva controles y borrador, con toast/feedback traducido. Los recibos completados invalidan `['rental', actorId]` y enlazan `/tools/reservations`; admisión o resultado incierto no invalidan como efecto probado.

## Contexto y publicación

La [ficha de ciclo comercial](../nodia-ai/knowledge/reservations/features/confirmed-reservation-lifecycle.md) y el [resumen de Reservas](../nodia-ai/knowledge/reservations/README.md) explican esta ampliación interna. Los nueve documentos aprobados de lectura se conservan sin reescribir sus cuerpos. La ficha nueva permanece draft/unregistered y approval null; añadir su path explícito al registro no publica herramientas MCP ni habilita escrituras Web. El conjunto publicado sigue limitado a67 capacidades read/read_artifact y27 fragmentos. Registro objetivo de conocimiento:48 fuentes,21 excluidas.

## Verificación y pendientes

- Client: suite completa **1.488 pruebas/203 archivos**,420.90s con2workers; focal **222/5**,19.43s; tipado/lint correctos y build11,49s. Los logs finales están en `nodia-client/.tmp/ai25-client-full-release.log`, `ai25-client-focused-final.log`, `ai25-client-typecheck-final.log`, `ai25-client-lint-final.log` y `ai25-client-build-final.log`. El build mantiene el aviso histórico de chunks mayores a500kB y la suite cuatro avisos JSDOM de navegación sin fallos. No se añaden dependencias ni rutas.
- Regresión de Client: seis operaciones traducidas, IDs/importes exactos, CLP explícito, estados/canales localizados, approvals/plataforma readonly y cancelación separada de devolución efectiva. Los controles temporales rechazan fecha imposible/DST inexistente sin perder borrador; otro campo no reescribe el offset/instante original. Se verificó el cero permitido por metadata bigint min0, límites, decimales/signos/exponentes no admitidos y overflow sin convertir dinero a Number. Los límites positivos de Finanzas siguen aplicándose por metadata.
- [QA sintético de interfaz](../evidence/nodia-ai-ai25-ui-validation.json): **7 comprobaciones y3 capturas**. Fecha inválida2026-02-30 retenida, corrección2026-11-02 y foco al solicitar viewport390×844; guardado produce revisión2/hash/toast. Editar sólo resolución conserva instante2026-10-17T12:30:00.000Z y devolución0; recibo EN conserva bigint9007199254740994 y enlace real. Tab temporal cerrado, viewport restablecido y servicio5194 detenido. No acredita teléfono físico, SQL ni proveedor.
- Server: **2.487 pruebas/192 archivos**,197,53s. Casos de uso nativos, preparación, snapshots, contratos cerrados, composición, permisos y recibos; revisión material del acuerdo, disponibilidad, dinero y fase sin abrir una segunda transacción del dominio.
- [SQL/HTTP/worker AI-25](../evidence/nodia-ai-ai25-postgresql.json): **39 comprobaciones nuevas**, sobre las seis operaciones, disponibilidad, mínimos, acuerdo/anticipo/plataforma, tiempo/preparación, autoridad, snapshots, rollback y recuperación. [Regresiones](../evidence/nodia-ai-ai25-regressions.json): **227 comprobaciones**, incluidas282 peticiones HTTP nativas de Reservas. Total266. Usan PostgreSQL desechable y procesos compilados; cero inferencias y sin escrituras MCP publicadas. El intento inicial fallido por referencia Airbnb sintética repetida se conserva y se corrigió sólo en el harness.
- [Paridad del compilado probado](../evidence/nodia-ai-ai25-tested-release-parity.json):828 archivos dist idénticos entre paquete probado `d36ac0b2a9aeb99d93027cf25c1895db2745fbc7d371c5024e8896559e6d720e` y paquete final `869e0ea34896545db736422f54da1435bcf526d7df245d48eb43c3b995b73160`. El único cambio del paquete es el helper de referencia sintética del harness, cuya versión final es la realmente probada.
- [Backup y activación](../evidence/nodia-ai-ai25-lab-activation.json): backup real de284,695B, SHA256 `8ce3c5246fd8e88af3fcfca18480a65f7e2730fb01f6e5f80d419a31f41646fc`; API/worker activos, health200 y configuración/dependencias/perfil conservados. Sin reinicio de Gemini ni migraciones, tablas o columnas nuevas. [Igualdad del despliegue](../evidence/nodia-ai-ai25-deployed-equality.json):828 dist coinciden con el paquete final.
- [Runtime configurado](../evidence/nodia-ai-ai25-lab-runtime.json):25 migraciones,18 tablas NodiaAI/241 columnas,38 ejecutores internos y0 jobs/intentos/slots pendientes. [Conocimiento](../evidence/nodia-ai-ai25-knowledge-validation.json):53 comprobaciones,48 fuentes/21 excluidas y67 lecturas/27 fragmentos conservados; pin `fe96f76311b45096287f600108c242477146150653c4720687a11f6de230834f`. [Delta](../evidence/nodia-ai-ai25-knowledge-delta.json) conserva documentos aprobados, fragmentos y contratos, cambiando sólo digest del registry y release.
- Publicación MCP de escrituras y aceptación con Gemini: pendientes independientes. Un executor registrado no publica una herramienta ni demuestra inferencia.
- Documento y ficha: en revisión, sin aprobación automática. AI-15/22/32 mantienen sus gates independientes; el siguiente bloque de desarrollo es AI-26.

La evidencia de laboratorio privado y las fixtures no equivalen a aceptación productiva pública. Los registros del dominio conservan su política nativa y las escrituras por lotes siguen excluidas de v1.
