# ADR-088 — Identidad de carritos locales y recuperación del POS

> Estado: propuesto
> Fecha: 2026-10-29
> Alcance: plan94 R13 autorizado funcionalmente; implementado, suite/QA sintética y Client R02 activo/verificado por alcance. UI autenticada final R02 verificada. No aprobación documental ni publicación IA.

## Contexto

El usuario solicita varias ventas locales simultáneas en la UI POS. Cada carrito conserva datos y una operación pendiente aunque se cambie de pestaña. Una respuesta puede llegar cuando otro carrito está activo; por eso el índice visible o el título VentaN no identifican con seguridad el destino del resultado. La recuperación previa tiene un journal por actor/negocio; trasladarlo a varios carritos sin una escritura coherente puede perder la identidad de una petición ya enviada o repetir una venta.

El checkout Server de ADR087 ya confirma completed en una transacción. Este cambio no requiere otro endpoint, tabla, migración o herramienta IA. La retirada de Other afecta sólo a nueva selección manual; historia y recuperación conservan el contrato existente.

## Opciones consideradas

### Opción A — Un hook y árbol POS independientes por pestaña

- Ventajas: reutiliza visualmente el formulario individual.
- Desventajas: multiplica consultas/catálogos y efectos montados; dificulta cerrar el carrito que originó una respuesta y coordinar journals. Un índice mutable no sirve como identidad de una mutación.

### Opción B — Motor único con IDs estables y snapshot local versionado

- Ventajas: un catálogo compartido, mutaciones ligadas al ID de carrito y una escritura atómica del conjunto de carritos e identidades pendientes antes del transporte. Conserva la recuperación en la misma pestaña al recargar.
- Desventajas: exige parser estricto, tratamiento de fallos de storage, migración del journal anterior y pruebas de respuestas fuera de orden. No es sincronización ni persistencia multiusuario.

### Opción C — Borradores persistidos de Server para cada carrito local

- Ventajas: recuperación independiente del almacenamiento de la pestaña.
- Desventajas: modifica dominio/APIs y vuelve a persistir borradores para el flujo de nuevas ventas que el usuario retiró en R12. Excede el alcance pedido.

## Decisión

Aplicar B mediante un motor único expuesto por useSyncExternalStore/useSaleDraft. Cada carrito tiene ID estable, número visible y estado propio; activo y próximo número pertenecen al workspace actor+negocio. Confirmar o conciliar cierra sólo el ID originario, sin renumerar los demás. Cerrar el último crea Venta1 y reinicia el siguiente número a2. Un carrito con petición activa o resultado pendiente no puede descartarse; cero partidas cierra directamente, incluso con datos locales residuales, y una o más partidas exigen confirmación.

Persistir un snapshot versionado mediante una única escritura sessionStorage que contiene todos los carritos y sus journals. La identidad/payload del carrito debe estar escrito con éxito antes de cualquier transporte comercial. Si falla la escritura, bloquear el envío; ante respuesta incierta conservar la misma identidad y aplicar consulta/reintento explícito bajo el contrato existente, sin replay automático o clave nueva.

Migrar el journal anterior con write-before-remove: validar, incorporar, escribir el snapshot y sólo después retirar el original. Una entrada inválida o storage inaccesible bloquea mutaciones, sin descartar silenciosamente una posible intención. Logout/cambio de identidad limpia el ámbito local existente e invalida resultados tardíos. El estado se conserva al recargar la misma pestaña; no se promete continuidad entre navegadores/dispositivos o después de una nueva sesión.

## Consecuencias

- Los datos comerciales siguen naciendo sólo al confirmar el checkout vigente; los carritos no crean ventas/borradores en Server.
- La numeración es presentación local, no ID persistido, contador comercial o identificador de idempotencia.
- El snapshot guarda información del carrito y request_keys, sin credenciales; necesita validación y cleanup de sesión. No garantiza durabilidad frente a cierre del navegador o borrado de sus datos.
- El catálogo se consulta una vez por el árbol compartido, sin replicarlo por pestaña. Controles y precios mantienen contratos, CLP y selección de importe por flag.
- Concurrencia UI, storage fallido/corrupto, migración, logout y recuperación de cada carrito tienen pruebas por alcance en el recibo R13. Implementación/pruebas/adopción no aprueban este ADR o la ficha draft ni publican capacidades.
- Volver a R12 después del uso requiere revisar/conservar carritos y pendientes: esa UI no entiende el snapshot multicarrito. El rollback de esta entrega sólo se verificó antes del uso; conservar el release antiguo no garantiza recuperar una intención R13.

## Verificación por alcance

Suite Client2305/277 correcta en213.08s; después de los dos ajustes visuales finales pasan80focales/10archivos en8.5s, lint global y build R02 con TypeScript correctos. QA sintética8perfiles320/390/600/1569px ESoscuro/ENclaro verifica numeración/cierre originario, cantidades, aislamiento, recarga y recuperación503 mediante1GET del mismo recibo sin replay; tres POST sólomock, sin ventas reales en VM. R01 quedó privado sin activar por una cola vacía del catálogo; R02 corrige y queda activo/verificado con manifiesto3145c385…7f37,173archivos/169assets actuales/88previos. Server73be…/KBcde…, API2263533/worker2263534, Native/keyring/timers conservados,sin SQL directo/inferencias/reinicios de aplicación. UI autenticada final R02 verificada; no aceptación de lector/teléfono físico o rendimiento productivo. Las44 fichas aprobadas siguen byteidénticas; ADR propuesto y ficha draft/unregistered/approval:null.

La UI autenticada real R02 verifica autofocus y dos GETbarcode reales con una partida/cantidad2/2400CLP en Venta1, otra venta local con medio/barcode aislados y restauración de Venta1/pestañas2400/1200. Total28px, Confirmar56px, cuatro medios y códigos ocultos, imagen cargada; sin pulsar Confirmar venta o mutación comercial. No acredita checkout real, inferencia o hardware; el recibo final consolida limpieza/cierre/captura de la pestaña propia, preservando el trabajo del usuario.

## Referencias

- [Plan94 R13, sección22](../../mvp/94-business-point-of-sale-and-product-refactor.md#22-varias-ventas-locales-y-presentación-del-pos-r13--2026-10-29).
- [Ficha candidata](../../nodia-ai/knowledge/businesses/features/multi-sale-workspace.md) y [ADR087 propuesto](ADR-087-atomic-point-of-sale-checkout.md).
- [useSaleDraft](../../../nodia-client/src/modules/business/infrastructure/useSaleDraft.ts), [motor](../../../nodia-client/src/modules/business/infrastructure/saleWorkspaceEngine.ts) y [snapshot](../../../nodia-client/src/config/businessSaleWorkspaceStorage.ts).
- [Journal anterior](../../../nodia-client/src/config/businessSaleRecoveryStorage.ts), [authStore](../../../nodia-client/src/store/authStore.tsx) y [recibo R13](../../evidence/business-pos-multi-sale-20261029-r01.json).
