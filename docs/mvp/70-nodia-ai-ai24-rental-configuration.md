# NodiaAI AI-24 — casas, configuración y acceso de Reservas

> Estado documental: en revisión; sin aprobación automática.
> Fecha: 2026-10-17.
> Estado técnico: implementado y verificado en laboratorio privado; publicación de preparadores MCP y aceptación de escrituras con Gemini pendientes.
> Dependencias: [plan45](45-nodia-ai-implementation-plan.md), [contratos28](28-rental-reservations-contracts.md), [contratos41](41-nodia-ai-v1-contracts.md), [autoridad54](54-nodia-ai-ai08-transversal-authority.md), [confirmación64](64-nodia-ai-ai18-human-confirmation.md), [recuperación66](66-nodia-ai-ai20-execution-recovery.md) y [conjuntos69](69-nodia-ai-ai23-dependent-workflows.md).

## Alcance

AI-24 incorpora seis operaciones individuales de configuración de Reservas al protocolo de borrador, revisión, confirmación humana y ejecución local de NodiaAI. Reutiliza los casos de uso nativos y sus reglas; no crea un segundo catálogo de alojamientos ni otra política de acceso.

| Recurso | Preparadores internos | Escritores nativos |
|---|---|---|
| Alojamientos | `nodia_rental_properties_prepare_create`, `nodia_rental_properties_prepare_update` | `CreateRentalPropertyUseCase`, `UpdateRentalPropertyUseCase` |
| Colaboradores del alojamiento | `nodia_rental_collaborators_prepare_create`, `nodia_rental_collaborators_prepare_update` | `CreateRentalCollaboratorUseCase`, `UpdateRentalCollaboratorUseCase` |
| Políticas de cancelación | `nodia_rental_cancellation_policies_prepare_create`, `nodia_rental_cancellation_policies_prepare_update` | `CreateRentalCancellationPolicyUseCase`, `UpdateRentalCancellationPolicyUseCase` |

Crear o modificar reservas/estadías y transiciones, pagos/devoluciones/gastos, bloqueos y preparación conserva AI-25/26. AI-24 no añade DELETE ausentes del contrato nativo ni cambia colaboradores por borrado físico. Cambiar actividad es una edición explícita, con la misma vista previa.

Los seis preparadores son internos: añadirlos al registro de ejecutores no los publica como herramientas MCP. La aceptación de escrituras por Gemini sigue siendo un gate independiente. Las 67 lecturas/referencias y 27 fragmentos aprobados conservan su alcance; las fichas nuevas de escritura permanecen draft y fuera del contexto publicado.

## Datos y reglas nativas

### Alojamientos

Crear requiere nombre y capacidad máxima de huéspedes, entero entre 1 y 1000. Los opcionales conservan el contrato de `CreateRentalPropertyDto`: dueño autorizado, zona IANA, horas históricas opcionales como metadatos, ubicación, tarifa nocturna entera como string, anticipo porcentual como string, preparación mínima, notas y actividad. Los defaults efectivos del servidor deben estar resueltos y visibles en la propuesta antes del botón; no se adivinan al ejecutar.

Editar requiere el alojamiento y un cambio real admitido por `UpdateRentalPropertyDto`. No permite transferir el dueño por un campo adicional. La política predeterminada debe existir, pertenecer al alojamiento y estar activa; puede quitarse con null. Una zona horaria no puede cambiar con historial. Reducir capacidad debe respetar los huéspedes de acuerdos vigentes; aumentar la preparación mínima conserva las transiciones ya aprobadas y su viabilidad. Las horas de la casa no sustituyen los horarios explícitos de una nueva estadía.

### Colaboradores

Agregar requiere un usuario existente y el alojamiento concreto. Cargo es opcional/nullable; actividad es una decisión visible del comando. No puede agregarse al dueño como colaborador ni duplicarse el par alojamiento/usuario, incluso si la asociación anterior está inactiva. Reactivar un vínculo existente es una edición, no otra creación.

Editar conserva el usuario y alojamiento de la asociación. Cambiar cargo o actividad no transfiere el vínculo a otra persona. Al reactivar se verifica que la casa siga activa y el usuario siga siendo válido. Ser colaborador no concede administración de configuración ni permiso implícito para modificar colaboradores.

### Políticas de cancelación

Crear requiere nombre y 1..100 reglas. Cada regla lleva `min_days_before` entero 0..36500 y `refund_percent` string de 0..100 con hasta dos decimales. Se exige una regla con umbral 0 y umbrales únicos. El backend normaliza porcentajes y ordena por días; el contrato nativo no exige porcentajes monótonos ni orden previo de la entrada.

Editar conserva la identidad y alojamiento; reemplaza el conjunto de reglas sólo cuando se solicita. No puede desactivarse la política que siga siendo predeterminada de la casa. Las políticas capturadas en acuerdos existentes conservan su snapshot: modificar la configuración no reescribe contratos históricos ni registra devoluciones de dinero.

Fuentes: DTOs y casos de uso de [alojamientos](../../nodia-server/src/rental-property/), [colaboradores](../../nodia-server/src/rental-collaborator/), [políticas](../../nodia-server/src/rental-cancellation-policy/) y [reglas monetarias](../../nodia-server/src/rental-common/rental-money.ts).

## Autoridad y ámbito

NodiaAI exige su módulo y el destino `rental_reservations` (`/tools/reservations`) para usuarios ordinarios. La configuración de casas, colaboradores y políticas conserva los controles de dueño del dominio; `super_admin` mantiene transversalidad bajo su actor real conforme54. La visibilidad de un chat ajeno no autoriza a confirmar como su dueño.

La autorización y las precondiciones se comprueban al preparar, confirmar y antes del efecto. Se resuelven los IDs de usuario, alojamiento, colaborador y política desde fuentes autorizadas; nunca por interpolar una respuesta textual del modelo. No hay SQL libre ni llamadas HTTP arbitrarias. La existencia de una ficha no concede permiso ni prueba disponibilidad de Agentic.

## Comando, confirmación y recibo

Cada propuesta congela el comando normalizado, scope, efectos visibles y snapshot material. Editar crea otra revisión/hash; el botón confirma la revisión exacta. El writer nativo y el recibo se coordinan con el EntityManager de la transacción de ejecución, conservando la idempotencia y los locks del dominio. La aceptación humana no equivale a efecto completado.

El recibo interno `RentalEffectReceipt` es un objeto cerrado: `schema_version`, `resource_key`, `resource_id`, `operation` y `property_id`. Los recursos permitidos son `rental_properties`, `rental_collaborators` y `rental_cancellation_policies`; operación es create/update y los IDs bigint siguen siendo strings. La proyección pública conserva el actor real como destinatario, sin almacenar credenciales o datos privados adicionales en el recibo.

El resultado público acredita el efecto original; el registro puede cambiar posteriormente. Recuperar consulta el recibo y la identidad original sin repetir el writer. Una pérdida de respuesta de COMMIT exige conciliación; sólo un rollback local comprobado permite reanudar conforme66. Cancelar no deshace casas o asociaciones ya comprometidas. Los conjuntos de69 pueden combinar operaciones registradas; AI-24 no inventa nuevos bindings entre una casa futura y otros pasos.

## Client

La preview y los recibos identifican las seis operaciones con traducciones ES/EN y respetan la precisión de IDs, importes y porcentajes. Los enlaces de recibos usan la ruta real del producto `/tools/reservations`. Después de cada recibo completado se invalida el prefijo nativo `rental/actor`, que cubre listados, detalles, autoridad, selectores y resúmenes de Reservas. La invalidación conserva el deduplicado por paso/recurso/ID y el aislamiento de sesión de69.

Las reglas usan metadata confiable `kind: rental_cancellation_rules`, no inferencia por nombre de campo. El editor muestra filas con días/porcentaje y agregar/quitar; no expone JSON técnico. Los mínimos/máximos de metadata son 1/100, nullable false, max_length null y sin opciones. El payload de edición conserva `ReviewValue` etiquetado; Server lo normaliza antes de validar el comando de dominio.

Los inputs de filas tienen IDs estables: quitar una fila anterior, cambiar ancho o rechazar la revisión no reemplaza los controles ni pierde sus valores. En xs se apilan días/porcentaje y las acciones usan ancho completo. Una petición en curso deshabilita inputs y acciones; un error muestra toast y feedback, conserva borrador/editor y no confirma valores parcialmente válidos. Las nuevas reglas no incluyen valores monetarios supuestos.

## Contexto y conservación

La [ficha nueva de configuración confirmada](../nodia-ai/knowledge/reservations/features/confirmed-configuration.md) y el [índice de Reservas](../nodia-ai/knowledge/reservations/README.md) distinguen implementación interna, aprobación y publicación. Las nueve fichas de lectura aprobadas no cambian su cuerpo por esta entrega. El path explícito ya está registrado: [53 comprobaciones del compilador y release](../evidence/nodia-ai-ai24-knowledge-validation.json) verifican47 fuentes/20 excluidas y conservan exactamente67 capacidades de lectura/referencia y27 fragmentos. El pin `6f8233b3d7a6b57af5fe3317b7cf11a01a2ecedf5977a92216d79d447cf803c3` sólo cambia por el hash del registro y el identificador de release; el nuevo borrador queda excluido del bundle publicado.

Los 90 días desde el último mensaje del dueño siguen eliminando chat/adjuntos y datos técnicos resueltos. Expirar un chat no elimina casas, colaboradores, políticas ni preferencias aceptadas. Sólo los pendientes inciertos conservan el mínimo necesario hasta conciliarlos, sin crear un archivo permanente.

## Verificación y pendientes

- Client: suite completa **1.441 pruebas/202 archivos**, con2workers y537,88s; focal178/5 archivos, tipado/lint correctos y build final13,71s. Se comprueban seis etiquetas, previews recursivas de reglas, controles estructurados y validación, foco/borradores, errores de servidor, metadata malformada, recibos de tres recursos e invalidación nativa. Logs reales en `nodia-client/.tmp/ai24-client-full-release.log`, `ai24-client-focused-final.log`, `ai24-client-typecheck.log`, `ai24-client-lint-final.log` y `ai24-client-build-final.log`. La suite mantiene cuatro avisos JSDOM de navegación sin fallos; build conserva el aviso histórico de chunks mayores a500kB.
- [QA de interfaz sintética](../evidence/nodia-ai-ai24-ui-validation.json): editor ES mantiene porcentaje75.00 y foco al cambiar al viewport solicitado390×844; un umbral0 duplicado se rechaza sin perder borradores y al corregirlo se guarda revisión2 con toast. Recibo EN conserva ID bigint y destino real. Tres capturas trazables; tab temporal cerrado, viewport restablecido y servicio5194 detenido. Es Chromium con viewport redimensionado, no un teléfono físico ni una prueba SQL/proveedor.
- Server: **2.418 pruebas/191 archivos**,119,76s; preparación, escritores nativos, autorización, precondiciones, idempotencia, relaciones, concurrencia y recuperación. Los seis puertos de configuración se integran en el mismo coordinador y registry de ejecutores existente.
- [SQL/HTTP/worker AI-24](../evidence/nodia-ai-ai24-postgresql.json): **36 comprobaciones nuevas**, con las seis operaciones, reglas canónicas, defaults, precisión, mínimos, autoridad, revisiones exactas, rollback/recibo y recuperación sin duplicar efectos. [Regresiones](../evidence/nodia-ai-ai24-regressions.json): **191 comprobaciones** sobre AI-18/20/22/23 y contratos nativos de Reservas, incluidas282 peticiones HTTP nativas. Total:227 comprobaciones. Se usan bases PostgreSQL desechables y procesos compilados; no inferencia ni escritura por MCP. Los artefactos registran el archivo compilado39c24… y los hashes de harness usados, separadamente del paquete final activado.
- [Activación del laboratorio](../evidence/nodia-ai-ai24-lab-activation.json): backup real de284.695B, SHA256 `095c3e2a5a097a8ef96a4e2d6c8439a9c45c01556d0439247369a9ef0d7f698e`, previo al cambio; API y worker activos, health200, entorno/dependencias/perfil de proveedor conservados y contenedor Gemini sin reinicio. No se aplican migraciones ni se añaden tablas o columnas.
- [Igualdad del despliegue](../evidence/nodia-ai-ai24-deployed-equality.json):824 archivos dist coinciden con el paquete final `1cc2a0ea6b5499b8588e87ff423669763e674dded1459a0837e33f4d9c4a9b1d`, de862 archivos. [Runtime configurado](../evidence/nodia-ai-ai24-lab-runtime.json):25 migraciones,18 tablas NodiaAI/241 columnas y32 ejecutores internos —26 anteriores y seis nuevos—;0 ejecuciones, jobs, intentos o slots pendientes. Conserva67 capacidades de lectura/referencia y27 fragmentos publicados.
- Publicación MCP y aceptación de escrituras con Gemini: pendientes; no inferirlas de autenticación o de un registro interno disponible.
- Aprobación documental de esta entrega y de la ficha: pendiente; no se deriva de tests ni despliegue privado.

No se atribuye aceptación productiva pública a las fixtures de UI ni al laboratorio privado. AI-15/22 y AI-32 conservan sus gates independientes de archivos y modalidades.
