import json
from pathlib import Path

root=Path(__file__).resolve().parents[1]
knowledge=root/'docs/nodia-ai/knowledge'
stage='docs/mvp/72-nodia-ai-ai26-rental-money-occupancy-preparation.md'
base=json.loads((knowledge/'reservations/features/confirmed-reservation-lifecycle.md').read_text(encoding='utf-8').split('---')[1])

def feature(slug,title,notes,sources,body):
    meta={**base,'document_id':'reservations.'+slug,'implementation':{'status':'partial','notes':notes},'sources':[{'path':p,'kind':'specification' if p.startswith('docs/') else 'implementation'} for p in ['docs/mvp/28-rental-reservations-contracts.md','docs/mvp/41-nodia-ai-v1-contracts.md',stage,*sources]],'verification':{'checked_on':'2026-10-17','evidence_paths':[stage],'notes':'Implementación AI-26 en curso; verificaciones SQL/Client y despliegue pendientes. No publica herramientas MCP ni acredita escrituras Gemini.'},'approval':None}
    (knowledge/('reservations/features/'+slug+'.md')).write_text('---\n'+json.dumps(meta,ensure_ascii=False,indent=2)+'\n---\n\n# '+title+'\n\n'+body,encoding='utf-8')

feature('confirmed-money','Dinero confirmado de Reservas — contexto funcional para NodiaAI','AI-26 integra seis operaciones internas de cobros/devoluciones y gastos mediante escritores nativos y confirmación exacta; verificación en curso. Ficha draft/unregistered, sin publicación MCP.',[
'nodia-server/src/rental-payment/dto/rental-payment.dto.ts','nodia-server/src/rental-payment/use-case/create-rental-payment.use-case.ts','nodia-server/src/rental-payment/use-case/void-rental-payment.use-case.ts','nodia-server/src/rental-expense/dto/rental-expense.dto.ts','nodia-server/src/rental-expense/use-case/create-rental-expense.use-case.ts','nodia-server/src/rental-expense/use-case/update-rental-expense.use-case.ts','nodia-server/src/rental-expense/use-case/pay-rental-expense.use-case.ts','nodia-server/src/rental-expense/use-case/void-rental-expense.use-case.ts'],'''## Qué resuelve

Registrar dinero ya recibido o devuelto por una reserva y gestionar gastos de la casa. No efectúa transferencias, cobros bancarios ni movimientos de Finanzas personales. [AI-26/72](../../../../mvp/72-nodia-ai-ai26-rental-money-occupancy-preparation.md) reutiliza el protocolo de propuesta, botón humano exacto, writer nativo y recibo atómico.

## Operaciones internas

| Preparador | Efecto nativo |
|---|---|
| `nodia_rental_payments_prepare_create` | Registra cobro (`type=payment`) o devolución efectiva (`type=refund`) |
| `nodia_rental_payments_prepare_void` | Anula por completo un registro monetario, conservando historial |
| `nodia_rental_expenses_prepare_create` | Crea gasto explícitamente pending o paid |
| `nodia_rental_expenses_prepare_update` | Modifica campos autorizados según estado |
| `nodia_rental_expenses_prepare_pay` | Registra el pago completo de un gasto pending existente |
| `nodia_rental_expenses_prepare_void` | Anula un gasto completo sin borrarlo |

Son preparadores internos; añadir esta ficha no publica herramientas MCP.

## Mínimos y aclaraciones

Un cobro/devolución exige casa, reserva de esa casa, tipo, monto entero positivo CLP y día efectivo. Medio, referencia y notas son opcionales/nulos conforme DTO. Anular exige registro y motivo. No inferir devolución a partir de anulación ni pago a partir de crear una reserva.

Un gasto exige casa, nombre, importe entero positivo, día de gasto y estado explícito pending/paid. Paid requiere día de pago no anterior al gasto ni futuro; pending no admite día de pago. Asociación de reserva, categoría y notas son opcionales y pueden ser null. Pagar exige gasto pending y día de pago; no crear un segundo gasto por pagar el primero. Si «compré comida» no define estado o casa, preguntar lo ambiguo.

Ejemplos ilustrativos: «Registra el abono que recibí» → resolver reserva, importe y día; «Devuelve lo aprobado» → aclarar si se solicita registrar dinero efectivamente devuelto; «Anula el cobro incorrecto» → resolver registro y motivo, no crear refund; «Paga el gasto de limpieza» → usar pay sobre el gasto pendiente concreto.

## Reglas y autoridad

DTOs y casos de uso enlazados en frontmatter son la fuente de verdad. Importes bigint se transportan como strings, sin Number ni redondeo. Días civiles usan la zona de la casa para validar hoy. Cobros no pueden superar el importe neto esperado; no se registran nuevos cobros sobre una reserva cancelada. El primer cobro fija las condiciones de cancelación, incluidas condiciones externas explícitas de Airbnb cuando corresponda; no consulta la plataforma. Registrar dinero no confirma una reserva.

Refund exige reserva cancelada y devolución aprobada; no puede superar lo aprobado pendiente ni lo recibido, ni anteceder al día local de cancelación. Anular conserva el registro, recalcula saldos conforme reglas y no transfiere dinero. Cobros de reservas canceladas no se anulan para eludir el acuerdo; el backend preserva el anticipo exigible de reservas directas confirmadas.

Gastos anulados no se editan. Un gasto pagado restringe importe y fecha del gasto; campos descriptivos/asociación siguen el DTO. No se cambian estados con un PUT genérico. No hay DELETE, anulación parcial, lote, pasarela bancaria ni espejo automático en Finanzas personales.

Usuarios ordinarios requieren NodiaAI, módulo rental_reservations y acceso nativo a la casa; super_admin conserva actor real. Cada asociación se resuelve dentro de property_id. Casa archivada conserva historial y liquidación conforme reglas nativas. No hay SQL libre ni permisos concedidos por Markdown.

## Informes, confirmación y recuperación

Las lecturas de [dinero](money.md) mantienen sus contratos publicados. Separar cobros, devoluciones efectivas, devolución aprobada pendiente, gastos pending/paid/voided y fechas efectivas; no sumar páginas ni mezclar monedas/productos sin procedencia. Informes cruzados conservan AI-30/31.

Propuesta y snapshots congelan comando, ámbito y precondiciones materiales. Cambiar importe/tipo/día exige nueva revisión/hash y botón exacto. Platform_policy se representa readonly recursivamente; no se usa editor JSON libre. Recibo RentalEffectReceipt identifica rental_payments o rental_expenses, operación, casa e ID; no afirma estado actual del recurso.

Writer nativo y recibo comparten transacción/journal; reanudación consulta lo comprometido antes de repetir. Timeout/COMMIT incierto exige conciliación. Cancelar ejecución no deshace dinero ya registrado. Conjuntos secuenciales conservan pasos completados y no añaden bindings futuros de Reservas. Contenido técnico resuelto expira con chat según50; registros de negocio mantienen conservación nativa.

## Integración y evolución

Implementación y verificación en curso; ver [72](../../../../mvp/72-nodia-ai-ai26-rental-money-occupancy-preparation.md). Ficha draft/unregistered y approval null. Publicación MCP y aceptación Gemini pendientes independientes. Los nueve cuerpos de lectura aprobados permanecen intactos.
''')

feature('confirmed-occupancy-preparation','Bloqueos y preparación confirmados — contexto funcional para NodiaAI','AI-26 integra cuatro operaciones internas de bloqueos y preparación mediante escritores nativos y confirmación exacta; verificación en curso. Ficha draft/unregistered, sin publicación MCP.',[
'nodia-server/src/rental-block/dto/rental-block.dto.ts','nodia-server/src/rental-block/use-case/create-rental-block.use-case.ts','nodia-server/src/rental-block/use-case/update-rental-block.use-case.ts','nodia-server/src/rental-turnover/dto/update-rental-turnover.dto.ts','nodia-server/src/rental-turnover/use-case/update-rental-turnover.use-case.ts','nodia-server/src/rental-turnover/use-case/approve-same-day-rental-turnover.use-case.ts','nodia-server/src/rental-common/rental-calendar.rules.ts'],'''## Qué resuelve

Bloquear un intervalo de una casa y registrar el plan o preparación real entre huéspedes; aprobar un recambio concreto del mismo día. [AI-26/72](../../../../mvp/72-nodia-ai-ai26-rental-money-occupancy-preparation.md) integra el protocolo existente; una aprobación prevista no acredita limpieza realizada ni confirma una reserva.

## Operaciones internas

| Preparador | Efecto |
|---|---|
| `nodia_rental_blocks_prepare_create` | Crea bloqueo con intervalo, motivo y actividad |
| `nodia_rental_blocks_prepare_update` | Edita intervalo/motivo/notas o activa/desactiva bloqueo |
| `nodia_rental_turnovers_prepare_update` | Edita ropa, limpieza, hora prevista/real o notas |
| `nodia_rental_turnovers_prepare_approve_same_day` | Aprueba el plan guardado del recambio concreto del mismo día |

No hay DELETE, creación manual de preparación, confirmación comercial implícita ni herramienta MCP publicada por esta ficha.

## Mínimos y dudas

Bloquear exige casa, instante inicial/final y motivo. El final debe ser posterior; notas son opcionales/nulas y actividad sólo usa el default nativo visible. Instantes necesitan UTC u offset; al editar se usa la zona IANA de la casa, nunca la del navegador. Preguntar por casa/horas si «bloquea el fin de semana» es ambiguo. Desactivar libera el bloqueo sin eliminar su historia.

Preparación exige casa/preparación existente y al menos un campo real. linen_ready es boolean nullable: null significa sin dato, distinto de false y true. cleaning_status admite pending/in_progress/completed; planned_ready_at y ready_at son instantes opcionales/nulos, notas opcionales/nulas. No convertir ausencia en false ni hora prevista en realizada. «Ya está limpio» puede requerir preguntar por ropa y hora real para completar el mínimo de preparación efectiva.

Aprobar mismo día exige preparación concreta vigente y comando vacío; el backend resuelve reserva entrante y vecino inmediato. No reutilizar un ID ajeno ni tratarlo como aprobación general de solapamiento.

## Reglas, tiempo y acceso

Los escritores/DTOs enlazados y rental-calendar.rules definen las reglas. Bloqueos activos revalidan conflictos con estadías/bloqueos y pueden invalidar planes intersectados. Casa archivada no admite nuevos bloqueos ni activar/cambiar intervalo activo; desactivar o editar notas preserva contrato nativo. Archivar casa o reserva no borra ocupación histórica.

Preparación se refresca con vecino inmediato. Cambiar ropa, hora prevista o vecino puede invalidar la aprobación previa; hay que volver a revisar. Plan debe caber entre estadías y respetar minutos mínimos de recambio. Ready_at requiere ropa true, limpieza completed, instante no futuro ni anterior a la salida del huésped previo. Aprobar mismo día requiere reserva entrante draft/confirmed, vecino del mismo día, ropa true y plan válido. No equivale a marcar ready_at ni permite iniciar una estadía sin preparación efectiva.

Usuarios ordinarios requieren módulos NodiaAI/Reservas y acceso nativo a la casa; super_admin mantiene actor real. IDs bigint conservan strings; cada registro/reserva vecina pertenece a property_id. No se amplían permisos ni se expone SQL.

## Consultas, revisión y recuperación

Lecturas de [disponibilidad](availability.md) y [calendario/preparación](calendar-preparation.md) mantienen autoridad/contratos publicados. Consultar cupo no congela fechas. Esta ampliación no crea informes nuevos; datos y zona conservan procedencia.

Snapshots capturan intervalos, actividad, plan, vecinos y precondiciones materiales. Revisión humana muestra datos readonly derivados y edita sólo campos registrados; botón exacto sobre revisión/hash. Concurrencia puede exigir otra propuesta, sin aprobar silenciosamente un plan cambiado. Writer y recibo RentalEffectReceipt comparten transacción/journal; receipt identifica rental_blocks o rental_turnovers con casa/ID y operación.

Reanudar recupera recibos y conserva pasos completados. Timeout/COMMIT incierto requiere conciliación; cancelar ejecución no elimina un bloqueo comprometido ni revierte preparación. Conjuntos de entradas conocidas no incorporan bindings futuros nuevos. Contenido técnico resuelto caduca con chat según50; dominio conserva historial.

## Integración y evolución

Implementación/verificación AI-26 en curso; evidencia en [72](../../../../mvp/72-nodia-ai-ai26-rental-money-occupancy-preparation.md). Ficha draft/unregistered y approval null; publicación MCP/Gemini pendientes independientes. Las nueve fichas aprobadas de lectura no se reescriben por esta ampliación.
''')

p=knowledge/'reservations/README.md'
parts=p.read_text(encoding='utf-8').split('---',2); meta=json.loads(parts[1]); meta['revision']=8
meta['implementation']['notes']='21 lecturas publicadas desde nueve fichas. AI-24/25 verifican doce puertos internos de configuración y ciclo comercial; AI-26 incorpora diez de dinero, bloqueos y preparación, con verificación en curso. Todas las fichas de efectos mantienen draft/unregistered y publicación MCP/Gemini pendiente.'
meta['sources'].append({'path':stage,'kind':'specification'})
parts[1]='\n'+json.dumps(meta,ensure_ascii=False,indent=2)+'\n'
p.write_text('---'.join(parts)+'\n\nAI-26 incorpora [dinero confirmado](features/confirmed-money.md) y [bloqueos/preparación](features/confirmed-occupancy-preparation.md), conforme [72](../../../mvp/72-nodia-ai-ai26-rental-money-occupancy-preparation.md). Diez preparadores internos en desarrollo; los nueve cuerpos de lectura aprobados se mantienen intactos. Publicación MCP y aceptación Gemini pendientes.\n',encoding='utf-8')
p=knowledge/'README.md'; s=p.read_text(encoding='utf-8').replace('Corpus actual:48 fichas','Corpus actual:50 fichas').replace('y21 documentos excluidos','y23 documentos excluidos').replace('las cuatro fichas de efectos confirmados','las seis fichas de efectos confirmados').replace('Corpus actual48 fuentes/21 excluidas','Ese build verificó48 fuentes/21 excluidas')
p.write_text(s+'\n\nAI-26 añade [dinero confirmado](reservations/features/confirmed-money.md) y [bloqueos/preparación](reservations/features/confirmed-occupancy-preparation.md), conforme [72](../../mvp/72-nodia-ai-ai26-rental-money-occupancy-preparation.md). Diez puertos internos en implementación; corpus objetivo50 fuentes/23 excluidas y67 capacidades/27 fragmentos conservados. Fichas draft/unregistered y approval null, sin publicación MCP ni escritura Gemini acreditada.\n',encoding='utf-8')

(root/stage).write_text('''# NodiaAI AI-26 — dinero, bloqueos y preparación de Reservas

> Estado documental: en revisión; sin aprobación automática.
> Fecha: 2026-10-17.
> Estado técnico: implementación y verificación en curso; escrituras MCP sin publicar.
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

Preparación captura snapshots materiales; revisión cambia hash y exige nuevo botón. Worker reutiliza los escritores, journal, locks y transacción del recibo RentalEffectReceipt, ampliado a los cuatro recursos y operaciones exactas. Reanudar recupera recibo sin repetir efecto; timeout/COMMIT incierto exige conciliación. Conjuntos de entradas conocidas conservan lo completado; no incorporan bindings futuros nuevos. Cancelar ejecución no revierte dinero, bloqueos o preparación comprometidos.

## Client y contexto

Labels de diez operaciones, campos/estados/tipos ES/EN, CLP explícito, receipts con bigint intacto y enlace /tools/reservations. Editor usa DateInput para días civiles y DateTimeInput con zona readonly verificada para instantes. Linen_ready permite null explícito sin convertirlo a false. Platform_policy es readonly recursivo; no JSON libre. Mutaciones conservan formulario ante error y notifican con traducción; efectos completados invalidan caché rental por actor.

Fichas [dinero](../nodia-ai/knowledge/reservations/features/confirmed-money.md) y [bloqueos/preparación](../nodia-ai/knowledge/reservations/features/confirmed-occupancy-preparation.md), y [resumen de Reservas](../nodia-ai/knowledge/reservations/README.md) actualizados. Nueve documentos de lectura aprobados intactos. Las nuevas fichas permanecen draft/unregistered, approval null. Corpus objetivo50 fuentes/23 excluidas y67 lecturas/27 fragmentos conservados.

## Verificación y pendientes

Verificación de Client, Server, SQL/procesos y despliegue en curso; registrar resultados efectivos al cierre. QA de interfaz utiliza fixtures sintéticas, sin inferir estado operativo ni permiso Server. Publicación MCP y aceptación Gemini, AI-15/22/32 y aprobación documental siguen pendientes independientes.
''',encoding='utf-8')
