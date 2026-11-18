# ADR-109 — Continuidad del servicio y recuperación del CD por fase

> Estado: propuesto, sin aprobación documental.
> Fecha: 2026-11-18

## Contexto

El CD de Listas de Market activó mantenimiento antes de solicitar el respaldo.
R2 devolvió un resultado incierto y la API quedó en mantenimiento aunque el
release y el ledger seguían intactos. En Caja, el verificador rechazó una
proyección virtual de TypeORM después de confirmar las migraciones. Los dos
incidentes requieren evidencia distinta para continuar.

## Opciones consideradas

### Opción A — Repetir la entrega completa

Es simple de operar. Depende de conocer el resultado de cada efecto de la
ejecución anterior. Una respuesta perdida puede ocultar una migración, un
respaldo o una publicación ya confirmados.

### Opción B — Recuperar disponibilidad y continuar por fase

Conserva identidades, evidencia y exclusión entre operaciones. Permite acotar
la recuperación al componente y al efecto pendientes. Requiere estados
durables, verificación independiente y ensayos de interrupción.

## Decisión propuesta

Adoptar B en etapas. Primero, recuperar disponibilidad antes de migrar si el
actualizador acredita que la barrera de migración sigue intacta, que current
y las rutas de respaldo coinciden con el release anterior y que el ledger
original coincide mediante solo lectura por TLS. Verificar API y worker y
retirar exclusivamente el mantenimiento del intento, confirmado con HTTPS
y CORS. Restaurar el estado de timers cuando las unidades de respaldo estén
inactivas. Si R2 queda incierto, conservar la evidencia del respaldo y
mantener la barrera de nuevas entregas hasta conciliar el efecto, aunque
HTTP esté operativo.

Un comando de continuación usaría el artefacto original y revalidaría SHA,
procedencia, vigencia del artefacto, baseline y locks. La admisión depende de
evidencia del último efecto observado:

- Antes de efectos, repetir lecturas transitorias con un presupuesto acotado y
  retomar transferencias por offset y digest. Una cuota o un contrato inválido
  devuelve el diagnóstico correspondiente y requiere corregir su causa.
- Ante respaldo incierto, leer por identidad de intento y comprobar catálogo,
  recibo y objeto. Un 404 aislado deja el resultado incierto. Una intención
  nueva exige conciliación y su propio respaldo fresco.
- Ante una migración solicitada, verificar el ledger y el esquema. Con el
  candidato confirmado, la continuación verifica o completa su activación
  bajo los locks. Un commit incierto requiere diagnóstico antes de cualquier
  escritura. El intento original y su historial conservan sus estados.
- Con backend confirmado, comprobar Pages por marcador y digest, volver a
  verificar assets si ya están publicados y continuar solo la fase de Client
  si se acredita que no hubo publicación. Una publicación incierta queda en
  conciliación.

Para cambios de esquema, mover al gate de CI el ensayo del actualizador SQL
usado por el host. Probar con los artefactos del release activo y del candidato
en PostgreSQL 16 desechable. Evaluar verificar ledger y columnas persistentes
dentro de la transacción, antes de commit, y conservar una lectura independiente
después. Mantener compatibilidad del release activo para cambios aditivos y
planificar retiros o backfills en entregas separadas según sus dependencias.

## Consecuencias

- La recuperación de tráfico y la autorización de una nueva entrega tienen
  resultados independientes.
- La disponibilidad ante una interrupción del runner o del proceso necesita
  verificación y recuperación desde estado durable, además del manejo normal
  de excepciones.
- El criterio de adopción incluye fallos inducidos del respaldo, interrupciones
  entre fases y durante el commit, y publicación parcial de Pages.

## Referencias

- [Plan99 §36](../../mvp/99-production-deployment-and-cicd-plan.md#36-continuidad-del-servicio-y-reintento-por-fase).
- [ADR099](ADR-099-pre-migration-deployment-reconciliation.md) y
  [ADR107](ADR-107-post-migration-deployment-reconciliation.md).
