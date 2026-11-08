# ADR-071 — Observaciones Agentic serializadas y acotadas

> Estado: propuesto; implementación autorizada dentro de AI-38, aceptación operativa documentada por separado
> Fecha: 2026-10-22

## Contexto

Al recargar NodiaAI se consultan salud y elegibilidad. Ambas podían reservar el mismo perfil físico mediante `ProfileAdmission`, que rechazaba inmediatamente cualquier segunda operación. La salud ejecuta comandos de metadatos del CLI; no es una inferencia, pero puede renovar credenciales o escribir su home. No corresponde ejecutar dos CLI simultáneos sobre ese perfil.

La [prueba real DIAG](../../evidence/nodia-ai-ai38-profile-reservation-diag-probe-a-r01.json) y su [cadena de dueño](../../evidence/nodia-ai-ai38-profile-reservation-diag-probe-a-events-r01.json) identifican `health_status`: adquirió la reserva, rechazó `eligibility`113ms después y la liberó tras4736ms. Los tres eventos comparten el nonce del dueño; no había cuarentena ni trabajo SQL activo. La inferencia no falló: el aviso trataba esa contención entre comprobaciones como sesión ocupada.

## Opciones consideradas

### Opción A: conservar rechazo inmediato y reconsulta manual

- Ventaja: conserva exclusión y recursos acotados.
- Desventaja: recargar puede rechazar el chat por el propio sondeo de salud de la aplicación.

### Opción B: coordinar Client con su consulta de salud

- Ventaja: puede ordenar dos solicitudes de una ventana.
- Desventajas: acopla elegibilidad a la salud agregada de otras conexiones, puede sumar45s y no arbitra otras ventanas o consumidores.

### Opción C: permitir lecturas simultáneas o encolar toda operación

- Ventajas: evita algunos rechazos inmediatos.
- Desventajas: metadatos del CLI no son acceso puramente funcional a memoria; dos procesos pueden modificar la sesión. Encolar login/inferencias confunde admisión, plazos e incertidumbre y puede retener trabajos que no deben reenviarse.

### Opción D: contexto explícito de observación en el dueño del perfil

- Ventajas: serializa el CLI entre comprobaciones del mismo perfil, sin dependencia del cliente; no cambia admisión de escrituras, generaciones o login.
- Costos: introduce espera limitada y requiere conservar ownership durante cancelación/cierre, probar colas y distinguir un timeout de una reserva realmente exclusiva.

## Decisión

Implementar D para salud y elegibilidad Agentic, manteniendo el servicio de un proceso/un worker. `ProfileAdmission.observation` es una API interna distinta de `operation`/`reserve`; una etiqueta de diagnóstico no concede política observacional. El perfil se identifica físicamente como antes, sin multiplicar capacidad por conexión.

Cada perfil tiene un mutex FIFO para esas observaciones y admite como máximo cinco participantes: un dueño y cuatro solicitudes pendientes. El contador se incrementa antes de esperar y se reduce en `finally`, sin depender de los atributos privados de `asyncio.Lock`. Si se alcanza capacidad, se rechaza antes de invocar CLI. Son límites operativos de Nodia, no cuotas del proveedor.

La presencia de una reserva exclusiva o cuarentena se comprueba antes de esperar y después de adquirir el mutex. Login, OCR, ejecución conversacional/MCP, refresh, logout y las entradas legacy conservan su rechazo inmediato y sus recibos. Un escritor que gane la reserva durante un traspaso conserva su autoridad; una observación pendiente no lo desplaza. `release` sólo puede liberar al dueño exacto de su lease y nunca borra cuarentena.

El presupuesto total de trabajo incluye espera y cuerpo:12s para salud Agentic y18s para elegibilidad Agentic, frente a sus transportes existentes de15s y20s del cliente. Se conservan los límites de comandos internos y el transporte Server de30s, sin ampliar inferencia o plazos de jobs. El timeout de este contexto se clasifica como `agentic_timeout` sólo cuando venció su propio scope; un `TimeoutError` ajeno y `CancelledError` mantienen su significado. Elegibilidad responde una observación negativa tipada ante ese vencimiento, sin convertirlo en un resultado de generación incierto.

Cancelar un solicitante en espera no cancela al dueño ni libera su reserva. Cancelar al dueño espera el cierre real del CLI antes de liberar. El cleanup puede superar el presupuesto de trabajo: no se promete un límite duro de respuesta liberando un perfil que aún tiene un proceso activo. Salud puede vencer detrás de una observación lenta; no se convierte ese fallo en sesión disponible ni se agrandan plazos para ocultarlo.

No se comparten resultados entre modelos, esfuerzos, configuración o generaciones de sesión. Cada comprobación conserva las validaciones existentes y un solo CLI físico activo. No se añade polling, retry de inferencias, fallback, cambio de conexión/modelo, permisos, esquema SQL o publicación MCP.

## Consecuencias

- El sondeo de salud y la elegibilidad pueden completarse en serie, conservando estado de carga durante la comprobación.
- La ocupación por una ejecución, login, cuarentena o saturación real sigue bloqueando el chat. Observar disponibilidad no reserva un turno futuro.
- Diagnóstico mínimo: categorías cerradas, nonce de reserva y duración monotónica; sin rutas/perfiles, mensajes, modelos, cuentas o credenciales. Un evento `wait` identifica al dueño bloqueante; no demuestra por sí solo qué nonce adquirirá después ese solicitante.
- Regresiones con barreras: ambos órdenes, límites/cancelación/FIFO, selección distinta, deadline y cleanup, reservas exclusivas/cuarentena, perfiles independientes y lease obsoleta.
- La aceptación real requiere comparar el escenario identificado antes/después y verificar UI/MCP en la época final. Recrear Gemini invalida las pruebas MCP/modalidades en memoria; no se reutilizan como vigentes los recibos de otra época.
- El workspace contiene funciones aún no adoptadas en B8. Los paquetes operativos aplican sólo este delta sobre fuentes congeladas del runtime; la suite de ese paquete se distingue de la suite completa local. No se usa este arreglo para adoptar cambios ajenos.

## Referencias

### Ampliación solicitada: admisión Teacher frente a observaciones — 2026-11-05

La QA del curso de entrevistas técnicas observó una carrera distinta: elegibilidad adquirió el perfil32ms antes de la ejecución Teacher, que recibió409/runtime_busy con prueba de exclusión previa a proceso/proveedor. Serializar sólo las lecturas no resuelve esa transición. Coordinar ventanas en Client no arbitra otros consumidores; reintentar una inferencia o encolar ejecuciones/login de forma general ampliaría indebidamente el alcance.

La corrección añade una API interna exclusiva de Teacher que espera sólo al dueño observacional real, identificado por su lease y flag interno; una etiqueta de diagnóstico no concede ese trato. Un único turno Teacher pendiente por perfil impide que observaciones posteriores se adelanten; no expulsa al dueño actual ni crea capacidad extra. Adquiere el mutex observacional, obtiene la reserva exclusiva y conserva esa reserva hasta el cierre existente. Cancelación/timeout elimina sólo su turno, sin liberar reservas ajenas o limpiar cuarentena. Los consumidores legacy/login/chat/OCR conservan su admisión inmediata; la API nueva no se aplica a ellos.

La espera consume el preflight18s existente y el deadline firmado más corto; después se revalidan generación, perfil, runtime/política, selección y tiempo antes de armar. No hay bucle de reenvío, cambio de modelo/credencial, ampliación del plazo o relajación de fences. Esta excepción Teacher amplía el comportamiento original descrito arriba; no lo presenta como si hubiera esperado desde el inicio. [96§31](../../mvp/96-nodia-teacher-implementation-plan.md#31-definición-clara-y-estado-de-preparación-estable--2026-11-05) separa pruebas y adopción. El ADR conserva estado propuesto, sin aprobación documental inferida.

Aceptación local 2026-10-22: ambos órdenes controlados y tres recargas autenticadas completan salud/elegibilidad sin rechazo; la versión FIX pasa474 pruebas Linux y503 Windows aplicables. El canario MCP posterior falla conciliado sin contención con salud, por lo que este ADR no acredita disponibilidad generativa/MCP ni modalidades en la nueva época. Estado propuesto y límites de aprobación conservados.

- [AI-38 y evidencias de reserva](../../evidence/nodia-ai-ai38-profile-reservation-r01.md)
- [Contrato funcional IA](../../mvp/ai-provider-feature-contract.md), [arquitectura43](../../mvp/43-nodia-ai-execution-architecture.md) y [política50](../../mvp/50-nodia-ai-ai04-runtime-policy.md)
- [ADR-068](ADR-068-nodia-ai-pre-dispatch-observation-timeout.md), [ADR-064](ADR-064-nodia-ai-dispatch-deadline-boundary.md)
