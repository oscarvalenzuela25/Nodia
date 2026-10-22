# NodiaAI — segunda revisión del modelo de datos

> Continuidad AI-18: revisión4 del manifest conserva23/298/62 y concreta la unicidad del desafío por propuesta/revisión/actor/sesión, sin nuevas tablas frente al diseño. [64](64-nodia-ai-ai18-human-confirmation.md) implementa tres tablas M2 más referencias M1; admisión productiva cerrada hasta AI-19..20. Las referencias a revisión3 describen el baseline anterior.

> Continuidad AI-09: [persistencia55](55-nodia-ai-ai09-conversation-persistence.md) materializa contratos cerrados de esfuerzo/routing/etapas/presupuesto y migración M1, sin publicar rutas, worker o inferencias. Modelo completo revisión3:23 tablas/298 columnas/62 FKs; M1:11/151. La auditoría vinculada al chat pasa a CASCADE conforme50; pendientes mínimos siguen separados. Las menciones anteriores de wire/ERD pendiente describen el baseline anterior; runtime permanece AI-10..12.

> Estado: revisión técnica documentada; cambios de diseño propuestos, sin migraciones ni pruebas de BD
> Fecha: 2026-10-14
> Fuentes: [ERD42](42-nodia-ai-erd.md), [modelo JSON](nodia-ai-v1-data-model.json), [ejecución43](43-nodia-ai-execution-architecture.md), [contratos41](41-nodia-ai-v1-contracts.md), [inventario39](39-nodia-ai-current-capabilities-inventory.md)
> Decisión: [ADR-035](../architecture/decisions/ADR-035-nodia-ai-bounded-persistence-and-knowledge.md)

## Resultado de la revisión

La propuesta inicial contiene garantías necesarias, pero también persistencia redundante. Se revisa a **23 tablas previstas, 284 columnas y 62 FKs**, frente a24/290/65. De ellas, **22 corresponden al alcance completo de v1** y **una es condicional**: adapter_states sólo se incorpora si la viabilidad de un adaptador demuestra una continuación opaca durable. Estas cantidades no son la migración inicial: [el plan45](45-nodia-ai-implementation-plan.md) incorpora estructuras según el flujo que las necesita.

Mantener pocas tablas no justifica perder consentimiento, recuperación o retención. El criterio es tener un dueño claro de cada dato y separar sólo cuando su identidad, crecimiento o ciclo de vida lo exijan. Nuevos productos reutilizarán las mismas estructuras conversacionales y registrarán contratos/contexto; no requieren una tabla de chat o un motor de workflows propios.

La revisión permite avanzar con el plan de implementación. No permite afirmar que la ejecución, los locks o la escalabilidad estén probados. La viabilidad Web/Agentic, la idempotencia por dominio, los límites y políticas operativas permanecen como gates verificables.

## Simplificaciones incorporadas al diseño

| Hallazgo | Cambio | Garantía que se conserva |
|---|---|---|
| Tabla step_dependencies para un ejecutor secuencial que se detiene al fallar | Eliminarla. Conservar referencias en public_step.depends_on y bindings tipados, con validación de revisión y precedencia | Orden estable, rechazo de ciclos/referencias cruzadas y recuperación del paso pendiente |
| approval_envelope y public_preview replican los comandos y pasos de una revisión | Eliminar ambos JSONB. Reconstruir el envelope canónico y PublicProposal desde metadata de revisión/propuesta y pasos inmutables ordenados | Hash sobre contenido completo, preview exacta y comando independiente del texto del modelo |
| owner_id del adjunto duplica al dueño del chat | Derivar dueño desde conversation_id; quitar columna/FK redundantes | El uploader se autoriza/audita como actor; no puede cambiar el dueño del archivo |
| Índices adicionales cubiertos por claves existentes | Quitar índices de messages(chat,seq), events(chat,seq) y proposal_steps(proposal,revision) | Unicidad/orden y acceso por prefijos de claves conservados |
| Índice adicional de adapter_states para selección parcial | Quitar; la reutilización exige conexión/modo/modelo/generación exactos, cubiertos por su clave única | No reutilizar continuación de otro modelo ni conexión eliminada |
| UNIQUE conversations(id,owner_id) sin FK consumidora | Quitar; PK(id) y autorización por dueño permanecen | No introduce propiedad independiente en descendientes |
| Contexto funcional sin trazabilidad por turno | Añadir runs.context_manifest acotado con IDs/revisiones/hashes de documentos seleccionados y release del catálogo | Saber qué contexto se utilizó sin copiar todos los Markdown ni el prompt completo |
| Tabla de continuación asumida antes de demostrar protocolo | Marcar adapter_states como condicional y diferir su tabla/columna/FK | Historial canónico en Nodia siempre; continuación sólo cuando tiene utilidad y contrato real |
| Eventos pueden duplicar informes/resultados enteros | Guardar transiciones/deltas acotados y referencias; resultados completos en tool_calls/execution_payloads | Reconexión por secuencia durable sin multiplicar payload por evento |

Las dependencias no se sustituyen por confianza en JSON libre. Server valida IDs únicos de la misma revisión, posiciones menores que la del paso y outputs registrados/tipados. Todo binding debe corresponder a un antecedente declarado. El ejecutor procesa uno por vez y nunca salta el paso fallido para continuar. No se incorpora un scheduler de DAG paralelo.

La reconstrucción de aprobación usa exclusivamente filas de la revisión congelada y las proyecciones ya guardadas; no consulta valores actuales para reinterpretar lo confirmado. Defaults, reglas y bindings forman parte de lo que se firma. Inmutabilidad de contenido y cambios de estado son aspectos separados; implementar protección por las rutas de escritura y mecanismos SQL pertinentes, y comprobar modificación directa en DB aislada. Una revisión/hash viejo no confirma la nueva.

PostgreSQL crea índices para PK/UNIQUE; repetirlos añade estructuras de mantenimiento. Las FKs no indexan automáticamente el lado referenciador: los índices de joins/purga restantes se seleccionan por consultas reales y planes medidos. [Documentación de constraints PostgreSQL16](https://www.postgresql.org/docs/16/ddl-constraints.html).

## Separaciones que sí se justifican

| Estructuras | Por qué conservarlas |
|---|---|
| messages / message_parts / attachments | Orden multimodal y referencias a archivos del mismo chat mediante FKs; no base64 ni arrays de adjuntos sin pertenencia comprobada |
| drafts / proposals / revisions / steps | Datos incompletos y preguntas no son comandos ejecutables; cada preview necesita identidad, versión y pasos con efectos propios |
| executions / execution_steps / execution_payloads | Recibos sobreviven al chat; comandos/resultados completos caducan. Un único JSON dificultaría purga segura y recuperación por efecto |
| jobs / attempts | La entrega/lease es distinta del efecto; cada dispatch externo necesita fase e identidad propia para no reenviar una inferencia incierta |
| execution_grants | Vida acotada de sesión/autoridad y revocación independiente; no copiar JWT ni transformar snapshots de permisos en autoridad permanente |
| runtime_slots | Web, OCR, login y Agentic pueden compartir proceso/perfil. No se resuelve con exclusión sólo por chat o por connection_id |
| events / audit_events | Eventos públicos de contenido caducan; auditoría mínima tiene otra finalidad y política. No duplicar cada evento en audit |
| context_snapshots / preferences | Compactación derivada caduca con el chat; memoria explícitamente aceptada sobrevive y puede borrarse por separado |

Se conservan una BD y un proyecto Server. No añadir tabla de documentos de producto, vectores, ledger financiero paralelo, catálogos por modelo, EAV genérico, broker adicional o tabla por proveedor/producto. El registro de herramientas es código tipado y el conocimiento es un artefacto de despliegue versionado.

## Casos revisados

La siguiente matriz es análisis de diseño contrastado con contratos/código, **no una ejecución de estos casos en producción o en PostgreSQL**. Sus IDs son criterios de aceptación del plan45. Las fixtures estructurales de la evidencia verifican sólo propiedades comprobables del manifiesto.

| Caso | Solicitud o fallo | Resultado exigido / comprobación de diseño |
|---|---|---|
| NR-01 | «Voy a comprar comida por20.000» | Preguntar estado/categoría/nombre ambiguos y obligatorios faltantes; draft sin movimiento hasta preview/botón |
| NR-02 | «Registra el gasto» y doble clic en confirmar | Una execution por origin_proposal_id; receipt atómico con movimiento o recovery equivalente |
| NR-03 | Timeout después de COMMIT del gasto | Recuperar mismo efecto; no crear otro movimiento ni inferir rollback |
| NR-04 | Editar un gasto que cambió por otro cliente | Precondición/versionado por operación, conflicto y nueva preview; no sobreescribir silenciosamente |
| NR-05 | «Cuánto gasté en proveedor X este mes» | Aclarar factura vs dinero pagado, negocio y base temporal; Finanzas no tiene provider_id ni fecha económica propia, factura no prueba pago/moneda |
| NR-06 | Dos facturas de igual monto, cada una con varios productos | Agregar al grano factura antes de expandir; no SUM(DISTINCT amount) ni sumar sólo la página |
| NR-07 | Gastos personales y de una casa en el mismo informe | Separar procedencia y medidas compatibles; no sumar poblaciones solapadas ni monedas desconocidas |
| NR-08 | Crear proveedor y luego contacto | Pasos con orden, binding tipado al proveedor creado e identidad estable por efecto |
| NR-09 | Fallo del contacto tras crear proveedor | Conservar proveedor; recuperar contacto sin repetir paso1, ni confirmar también una propuesta individual reclamada |
| NR-10 | «Agrega este teléfono al proveedor» | Resolver contacto existente o pedir nombre para nuevo contacto; mostrar reemplazo/append real de teléfonos y versionado |
| NR-11 | Desactivar proveedor/contacto | No inventar DELETE ni borrar contactos al desactivar proveedor |
| NR-12 | Consultar disponibilidad y después crear reserva | La lectura no reserva cupo; creación reúne todos los requeridos y produce el estado que define el dominio |
| NR-13 | Otro usuario ocupa fechas antes de confirmar reserva | Revalidar disponibilidad y acuerdo en transacción nativa; rechazo sin éxito ficticio |
| NR-14 | «Crea una reserva» sin anticipo o datos de huésped | Preguntar mínimos; no registrar pago no solicitado ni confundir draft con confirmed. Confirmación comercial conserva requisitos de anticipo/plataforma |
| NR-15 | Cancelar reserva con pagos | Preview de cancelación/devolución y reglas nativas; no DELETE ni rollback del dinero |
| NR-16 | Super_admin opera una casa/Finanzas ajenas | Actor separado de destinatario, acceso transversal explícito; no cambiar propietario ni actuar como autor de otra propuesta |
| NR-17 | Ordinario tiene NodiaAI pero no módulo de destino | Rechazar descubrimiento/contexto/consulta/escritura/recuperación de ese destino también por backend |
| NR-18 | Revocar acceso durante inferencia o entre pasos | Revalidar antes de enviar/aceptar contexto y cada efecto; detener futuros pasos, conservar efectos comprometidos |
| NR-19 | Quitar el último superadministrador o editar clave reservada | NI-13 compartido con REST; invariantemente rechazar incluso con concurrencia |
| NR-20 | Crear usuario y asignar módulos/roles | Validar existencia/asociaciones y atomicidad del comando; no convertir endpoints de seed/login en herramienta genérica |
| NR-21 | Configurar clave o completar login Gemini | Canal seguro de la app; ni challenge de confirmación ni secretos quedan en tool_calls, mensajes o memoria |
| NR-22 | Salir del chat o perder SSE | Worker continúa; consultar secuencia/estado recupera resultado sin reenviar el mensaje o comando |
| NR-23 | Worker pierde lease y vuelve con respuesta tardía | Rechazar fence viejo; dispatch remoto incierto permanece unknown hasta reconciliar |
| NR-24 | Dos conexiones comparten perfil usado por OCR/login | Mismo runtime slot; no iniciar trabajo concurrente ni liberar por timeout. Evitar OCR anidado esperando su propio perfil |
| NR-25 | Cambio de conexión/modo/modelo | Sólo entre turnos; conservar historial/efectos, rehidratar desde Nodia y no migrar cookies/opaque state |
| NR-26 | PDF/voz solicita acciones o contiene instrucciones | Archivo autorizado del mismo chat, contenido tratado como dato; extracción revisable, aclaración y botón |
| NR-27 | Factura incorpora adjunto y el chat expira | Archivo del dominio con key independiente; purgar adjunto/transcripción sin borrar factura, gasto ni recibo |
| NR-28 | Chat cumple90 días mientras hay mensaje, job o PUT tardío | Reloj Server, lock/epoch, denegar chat vencido, cleanup durable previo al borrado de metadata; no esperar que vuelva el navegador |
| NR-29 | «Recuerda esta categoría» y después expira el chat | Consentimiento explícito; preference independiente con origen nullable, acceso actual y borrado propio |
| NR-30 | Compactar conversación y cambiar permisos | Resumen no concede autoridad ni reejecuta efectos; reconstruir fuentes autorizadas, conservar dudas/recibos e historial bajo retención |
| NR-31 | Nuevo producto o extensión compatible | Ficha y registro versionados; siguiente turno descubre contexto autorizado sin migración de tablas de chat |
| NR-32 | Cambio incompatible de funcionalidad con propuesta lista | Release de turno fija, invalidación de propuesta afectada, nueva preview y botón; no reescribir recibos |
| NR-33 | Buscar miles de chats/mensajes/reportes | Cursor, proyección y consultas acotadas; no descargar todo el historial ni producir evento por token |
| NR-34 | Restaurar backup con jobs y chats vencidos | Arranque en conciliación sin dispatch automático; caducidad/autoridad comprobadas antes de exponer contenido o ejecutar |

Fuentes de dominio contrastadas: [Finanzas22](22-personal-finance-contracts.md), [FinanceMovement](../../nodia-server/src/finance-movement/entities/finance-movement.entity.ts), [Invoice](../../nodia-server/src/invoice/entities/invoice.entity.ts), [Contactos31](31-provider-contacts-proposal.md), [DTO de contactos](../../nodia-server/src/provider-contact/dto/provider-contact.dto.ts), [Reservas28](28-rental-reservations-contracts.md), [DTO de reserva](../../nodia-server/src/rental-reservation/dto/create-rental-reservation.dto.ts), [confirmación de reserva](../../nodia-server/src/rental-reservation/use-case/confirm-rental-reservation.use-case.ts) e inventario39. Las lagunas no se arreglan agregando columnas al chat.

## Riesgos que requieren implementación o decisión

- Los checks del manifiesto incluyen SQL posible y protocolos de aplicación. Un CHECK no valida DAG, permisos, sesión o pertenencia consultando otras tablas. Las FKs y constraints pertinentes se ejecutarán en SQL; validaciones semánticas, inmutabilidad y correlación chat/run/execution/grant se comprobarán en casos de uso y pruebas aisladas.
- Ready implica contenido congelado, no hash inmutable por convención. Reconstrucción y validación de la revisión deben resistir cambios concurrentes; comparar hash normalizado y precondiciones reales, no sólo un token.
- Los permisos JSON del grant acotan trabajo pero no reemplazan autoridad actual. Barreras compartidas con todos los escritores REST de autorización y orden de locks necesitan pruebas reales.
- Jobs de limpieza no pueden quedar abandonados por el deadline de inferencia. Definir intent durable, presupuestos por intento, backoff y alerta/recuperación al agotar política; no borrar el intent antes de comprobar DELETE/PUT tardío.
- Retención definida posteriormente en[AI-04/50](50-nodia-ai-ai04-runtime-policy.md): cero archivo adicional de receipts resueltos/audit/attempts terminales; referencias mínimas unknown sólo hasta conciliar. El borrado debe rechazar comandos viejos/elevar epoch y cerrar workers, no reabrir duplicación por eliminar un journal demasiado pronto. Pruebas runtime y delta tipado de routing/contadores pendientes AI-09/12/20.
- Medir tamaño de JSONB, cola, informes, coste de contexto, índices de búsqueda y purga con cardinalidades representativas. No se atribuye una mejora de latencia a esta revisión estática.

## Continuidad y evidencia

- [x] Revisión de responsabilidades, redundancia, retención y evolución de productos.
- [x] Simplificar el manifiesto/DBML y actualizar42/43/ADR afectados.
- [x] Derivar34 casos de aceptación y el [plan por etapas45](45-nodia-ai-implementation-plan.md).
- [ ] Ejecutar garantías de permisos/transacción/concurrencia/archivos/proveedores según el plan.
- [ ] Confirmación explícita de aprobación documental.

La [evidencia estática actualizada](../evidence/nodia-ai-erd-execution-validation.json) y su [validador reproducible](../evidence/scripts/validate-nodia-ai-design.mjs) verifican estructura y consistencia. El avance del plan no marca automáticamente estos documentos como aprobados.
