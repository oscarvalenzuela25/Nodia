# ADR-051 — Ejecución administrativa Core con frontera exclusiva

> Estado: propuesto; implementación AI-27, sin aprobación documental automática.
> Fecha: 2026-10-17.

## Contexto

AI-27 incorpora diecisiete operaciones individuales de usuarios, roles, acciones, acciones de negocio, módulos y grupos. Modifican autoridad o catálogos que la soportan. ADR-039 exige SHARE ROW EXCLUSIVE antes de cualquier lectura en esos escritores; anidarlos bajo la frontera SHARE de los efectos de dominio crea una elevación de bloqueo y puede producir interbloqueos. El efecto y su recibo deben compartir commit, sin una transacción nativa independiente.

## Opciones consideradas

### Elevar SHARE cuando el escritor descubre que modifica autoridad

Rechazada: dos escritores pueden conservar SHARE mientras esperan la elevación. Además, una lectura previa puede fijar un snapshot inadecuado. El contrato nativo de AI-08 excluye esta composición.

### Usar exclusión para todas las ejecuciones

Simplifica la selección pero serializa innecesariamente Finanzas, Negocios y Reservas. Rechazada porque extiende el costo global sin necesidad.

### Pista interna y comprobación dentro de una frontera elegida antes de leer

Elegida: consultar hasta nueve nombres de pasos persistidos para decidir si la ejecución contiene una operación del registro Core cerrado. La propuesta admite hasta ocho pasos; ese límite se verifica nuevamente. La consulta exterior sólo selecciona la frontera, nunca autoriza ni aporta comandos o datos al efecto.

## Decisión

Si existe algún paso Core, cada transacción de esa ejecución toma la barrera exclusiva de ADR-039 antes de consultar autoridad, cola, chat o dominio. Después relee y valida identidades, propuesta, pasos, permisos, sesión, grant, revisión y fence. Un paso Core bajo una pista obsoleta que eligió SHARE se rechaza antes del escritor; nunca eleva el lock. Las demás ejecuciones conservan SHARE.

El helper `withCoreAuthorityLock` expone una prueba interna acotada al callback. Los escritores heredados requieren manager activo y esa prueba, releen identidad y usan el mismo manager. No reinician timeouts ni abren commit propio. La prueba se retira en finally tanto al tener éxito como al fallar, por lo que no sobrevive al reutilizar un manager. No es un campo del actor ni una credencial persistida.

Los escritores REST conservan su frontera exclusiva raíz y la misma lógica de NI-13. Usuarios/asociaciones, catálogos/traducciones y recibo de NodiaAI se confirman o revierten juntos. BusinessActions reutiliza un caso de uso de guardado compartido; su DELETE conserva la desactivación nativa.

La invalidación de caché de navegación/autorización ocurre después de terminar la transacción, incluso al conciliar una respuesta incierta. Es una optimización best-effort, igual que en los escritores nativos; no concede permisos ni sustituye PostgreSQL. No se introduce un outbox de caché o una tabla adicional. La recuperación de recibos evita repetir un efecto comprometido. Cambiar el propio acceso no borra ese recibo ni permite continuar otros pasos con permisos anteriores.

## Consecuencias

- Se mantienen último super_admin activo, rol reservado, identidad inmutable de módulos y asociaciones atómicas bajo la misma exclusión que REST.
- Una ejecución mixta que incluya Core toma exclusión también para sus otros pasos; es un costo acotado y explícito que evita decidir la frontera desde datos parcialmente bloqueados.
- El bloqueo de autoridad sigue siendo global, con lock_timeout2s y statement_timeout5s como techo nativo. No acredita rendimiento productivo; medir contención antes de escalar.
- No hay inferencia, red, espera humana ni invalidación Redis dentro de esta transacción. Un crash tras commit puede dejar caché anterior hasta refrescar/expirar; las decisiones efectivas del backend se releen de la BD.
- No se añaden tablas, columnas, migraciones, rutas de administración ni permisos por acción. Registro interno, publicación MCP, aprobación de conocimiento y aceptación Gemini siguen siendo hitos distintos.

## Referencias

- [ADR-039](ADR-039-shared-authority-transactions.md), [AI-08/54](../../mvp/54-nodia-ai-ai08-transversal-authority.md), [plan45](../../mvp/45-nodia-ai-implementation-plan.md).
- [AI-27/73](../../mvp/73-nodia-ai-ai27-core-administration.md), [contratos41](../../mvp/41-nodia-ai-v1-contracts.md), [arquitectura43](../../mvp/43-nodia-ai-execution-architecture.md).
