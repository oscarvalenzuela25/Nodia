# ADR-070 — Journal externo de borrados y backups cifrados con retención acotada

> Estado: propuesto
> Fecha: 2026-10-20

## Contexto

Restaurar PostgreSQL puede recuperar chats, adjuntos retirados o preferencias borradas después de la captura. Un registro contenido en la misma BD o VM restaurada pierde precisamente los borrados posteriores que debe impedir. AI-37 ya exige cuarentena, un head externo confiable y conciliación sin replay; AI-38 necesita producir ese historial y operar las copias de forma continua. La política fija siete días de admisión de backups y un objetivo de limpieza física de 24 h, sin convertirlos en una garantía de disponibilidad del proveedor.

El paquete se adoptó en la VM Linux local con los recibos delimitados al final de este ADR. El documento conserva estado propuesto; esa adopción no acredita continuidad histórica, rotación durante siete días transcurridos ni aprobación documental. La aceptación completa y sus demás gates corresponden a [AI-38](../../mvp/84-nodia-ai-ai38-environment-acceptance.md), que permanece parcial.

## Opciones consideradas

### Opción A — Tombstones o outbox exclusivamente en PostgreSQL

- Ventaja: atomizar con el borrado local sin una dependencia externa síncrona.
- Desventaja: una restauración de la misma BD pierde los eventos posteriores. Replicarlos después del DELETE deja una ventana de pérdida; una tarea de mantenimiento no demuestra cobertura continua.

### Opción B — Journal externo por objeto/evento y listado remoto

- Ventaja: escritura distribuida con menor contención por registro.
- Desventaja: requiere demostrar secuencia completa, head, inventario, compactación y expiración de muchos objetos. El listado por prefijo no es por sí mismo un registro completo ni autoriza borrar objetos ajenos.

### Opción C — Estado externo cifrado con CAS y catálogo de copias

- Ventaja: un estado acotado vincula borrados, cobertura, secuencia y copias retenidas; el GC conoce las copias que aún pueden recuperar contenido.
- Desventaja: hay contención de CAS, límites de capacidad y dependencia de R2 para admitir borrados protegidos y nuevas copias. Su indisponibilidad debe ser observable y fallar cerrada.

## Decisión

Se implementa la opción C dentro del backend y sus CLI de operador, sin otro microservicio, endpoint público o herramienta MCP. El objeto `nodia-ai-recovery/<deployment_id>/state.bin` vive fuera de la BD/VM restaurada. Su JSON validado se cifra con AES-256-GCM; nonce y tag acompañan al ciphertext, y el AAD liga era y deployment. La clave simétrica procede de un archivo privado de configuración, nunca de mensajes, fixtures o logs. El estado se actualiza con `PUT If-Match` al ETag leído; su creación usa `If-None-Match: *`. Sólo los conflictos CAS definidos permiten recalcular y reintentar una mutación pura, dentro de un deadline común. Una respuesta de escritura incierta se concilia leyendo el mismo contenido, sin repetirla a ciegas.

La configuración explícita `NODIA_AI_RECOVERY_CONFIG_FILE` habilita el puerto obligatorio de journal; configuración inválida o servicio inaccesible no degradan a NOOP. La composición `DisabledNodiaAiDeletionJournal` conserva compatibilidad legacy y operación offline/cuarentena, y **no protege ni autoriza backups**. El runner de copias exige verificar que ambos escritores operativos usan el mismo archivo y paquete; ello complementa, sin sustituir, la comprobación del paquete adoptado.

Los eventos contienen únicamente identidades opacas y generaciones: `conversation`, `attachment` y `preference`. No almacenan mensajes, transcripciones, claves R2 ni valores de preferencias. El manifiesto de restore versión 2 distingue los tres recursos; el consumidor conserva compatibilidad con la versión 1, limitada a chats. Un borrado individual de adjunto no se interpreta como borrar todo su chat.

Cada flujo protegido usa fases separadas: preparar y verificar identidad bajo locks SQL; liberar locks; registrar intención externa; revalidar autoridad, estado, lease y generación dentro de una nueva transacción; confirmar el borrado/recibo local; confirmar después el journal fuera de SQL. Ningún acceso R2 mantiene el lock de cola. La confirmación de preferencias usa una prueba efímera interna ligada al step y objetivo exactos, sin ampliar el contrato HTTP/modelo. Un ACK incierto o un fallo SQL posterior puede dejar una intención externa pendiente; no autoriza resucitar el recurso ni repetir un efecto incierto.

`confirmed_at:null` bloquea la reserva de nuevas copias. Tras el commit, un fallo al confirmar el journal deja esa metadata pendiente y no transforma el efecto ya completado en un fallo reejecutable. El CLI de conciliación puede acreditar ausencia SQL con consultas de sólo lectura y confirmar después el estado externo. No declara ausente un recurso aún presente ni ejecuta su borrado para resolver el testigo.

Las copias usan un DEK AES-256-GCM aleatorio por archivo, envuelto con RSA-OAEP-SHA256. Sólo la clave RSA pública se entrega a la VM; la privada permanece bajo custodia del operador en Windows, fuera de la VM y del backup. R02 admite estrictamente un único bloque PEM SPKI `PUBLIC KEY`, con DER/base64 canónicos y RSA de al menos 3072 bits: rechaza PEM privados, texto adicional o múltiples bloques aunque el parser criptográfico genérico pudiera aceptarlos. El dump se cifra por streaming hacia un spool cifrado acotado. Su UUID/key, captura y expiración fija se reservan antes de `pg_dump`; tamaño y digest esperados se hacen durables antes del único PUT del artefacto.

Los artefactos usan keys UUID inmutables, `PUT If-None-Match: *`, SDK sin replay automático, un scheduler por destino y exclusión local con `flock`. HEAD y GET de la key exacta verifican metadata, tamaño y SHA-256 antes de ready o de borrar. El [probe real R01](../../evidence/nodia-ai-ai38-journal-r2-probe-r01.json) rechazó precondiciones incorrectas de PUT/GET, pero R2 **ignoró un `DELETE If-Match` incorrecto**. Por ello no se promete un DELETE condicional atómico: la seguridad depende del ownership y ausencia de sobrescrituras de esa key. VersionId observado, digest distinto o escritor ajeno impiden acreditar esa garantía.

La expiración lógica de una copia ocurre a siete días. La rotación conserva `pending`/`deleting` hasta conciliación y ausencia acreditada. Un pending con receipt durable y 404 puede corresponder a un PUT aún incierto: su testigo no expira automáticamente ni permite otro PUT de esa identidad. La metadata puede sobrevivir a los siete días mientras el objeto sigue siendo inadmisible para restore.

El GC del journal elimina sólo un prefijo contiguo confirmado, después de ocho días desde `confirmed_at` y cuando ya no existen entradas de copias registradas cuya captura pueda recuperar ese recurso. R02 limita el avance de `coverage_from` a `closed_at` si la era está cerrada, evitando producir un estado inválido al hacer prune más de ocho días después del cierre. No filtra manifiestos únicamente por `deleted_at >= captured_at`: una intención anterior puede preceder a un snapshot que todavía contiene el recurso. Los eventos pendientes bloquean el GC y las nuevas capturas, aunque hayan pasado ocho días.

La nueva era se inicializa una vez con API y worker detenidos. `coverage_from` comienza en ese instante real; no se reconstruye una cobertura anterior desde dumps o logs. Las 29 copias históricas observadas por metadata quedan fuera del catálogo nuevo: no se adoptan, migran ni eliminan automáticamente. Su inventario, custodia y disposición siguen siendo un pendiente independiente del entorno.

### Reversión a consumidores sin journal

Antes de arrancar un paquete legacy o una composición NOOP que pueda borrar sin publicar eventos, se detienen API y worker y se cierra la era externa mediante el CLI `close`. El cierre fija `closed_at` y no se revierte: bloquea nuevos eventos protegidos, checkpoints, reservas de copias y exportación de manifiestos. La lectura, conciliación de pendientes y rotación de copias registradas conservan su utilidad operativa. Una era cerrada no acredita cobertura después de volver a consumidores legacy.

Un cierre sin respuesta comprobable no habilita el arranque legacy: debe observarse `coverage_closed_at` desde el estado externo; ante error se mantienen los escritores detenidos. Se conserva el journal y su configuración para conciliar y limpiar las copias existentes, sin borrar el objeto para simular un reinicio. Recuperar protección exige una era y un namespace nuevos, con bootstrap bajo escritores detenidos y cobertura desde ese nuevo instante; no se une documentalmente el intervalo legacy a la era anterior. Las copias de una era cerrada no recuperan admisión mediante un head fabricado ni un override de cuarentena.

Esta sección de reversión y su procedimiento en el runbook son una actualización documental posterior al congelado del runtime. No acreditan por sí mismos que los servicios hayan ejecutado una reversión; esa ejecución requiere su recibo del entorno. El ensayo sintético de rotación con reloj inyectado ya tiene el resultado acotado que se referencia debajo; no equivale a siete días transcurridos ni a cambiar el reloj de la VM.

### Verificación de este corte en la VM Linux local

El [recibo de reanudación R01](../../evidence/nodia-ai-ai38-journal-resumed-r01.json) acredita API y worker desde el paquete congelado `fb4c52fc…`, paths/configuración efectivos y era externa abierta desde **2026-10-20T23:52:27.154Z**. Conserva Gemini, nginx, esquema y selección; no ejecuta nuevas inferencias ni efectos comerciales. La [observación operacional posterior](../../evidence/nodia-ai-ai38-journal-operational-final-r01.json) y la [aceptación de servicios/timers](../../evidence/nodia-ai-ai38-backup-service-acceptance-r01.json) acreditan ambos timers activos y los oneshots endurecidos de captura/rotación con salida 0. El catálogo llega a dos copias ready; la programación es captura diaria a las 02:30 UTC y rotación cada cinco minutos. Estos recibos acreditan ejecución actual de R01, sin afirmar siete días de continuidad observada.

La [captura operativa](../../evidence/nodia-ai-ai38-backup-create-r01.json) produjo una copia ready cifrada de 384.388 bytes, capturada a `2026-10-20T23:58:20.785Z` y con expiración fija a `2026-10-27T23:58:20.785Z`. El [descifrado autenticado](../../evidence/nodia-ai-ai38-backup-decrypt-r01.json) se realizó bajo custodia de la clave privada en Windows, sin enviarla a la VM ni dejar plaintext en el workspace. El [restore aislado de esa copia](../../evidence/nodia-ai-ai38-backup-restore-r01.json) comprobó 62 tablas y 29 migraciones, sin red/puertos ni escrituras en la BD configurada; el contenedor desechable se retiró. Ese restore de la copia operativa **no ejecutó el consumidor completo de cuarentena NodiaAI**; no se le traslada la aceptación de otro dump.

La [rotación sintética con R2 real](../../evidence/nodia-ai-ai38-backup-live-rotation-r01.json) pasó cinco controles: creación exclusiva de estado, subida cifrada y HEAD/GET/digest, conservación a expiración−1 ms, eliminación en el borde exacto y retiro del estado propio. La prueba usó un reloj inyectado, sin cambiar el host, esperar siete días, ejecutar `pg_dump` o acceder a SQL productivo. Acreditó catálogo vacío, HEAD/GET 404 y retiro de su ledger/spool exclusivos.

El [ensayo combinado](../../evidence/nodia-ai-ai38-journal-combined-r01.json) reutilizó 17 casos existentes sobre PostgreSQL desechable y journal CAS cifrado real en R2: cambios de generación, rollback, bloqueo de snapshot por pendiente, reintento, manifiesto v2 y conservación de recursos ajenos. No son 17 casos nuevos. La eliminación de preferencias de origen fue SQL controlado y el puerto de objetos de negocio permaneció sintético; no se declara un recorrido comercial completo. Su restore verificó el consumidor de cuarentena sobre su propio dump desechable, con release no autorizada y sin dispatch. Estado/ledger exclusivos del ensayo quedaron retirados con observación positiva previa; el recibo conserva la limitación de DELETE no condicional.

Estos resultados no incorporan las 29 copias históricas al catálogo, no acreditan que estén cifradas/rotadas y no rellenan cobertura anterior al inicio real de era. Tampoco prueban limpieza física interna del proveedor ni los plazos durante una caída. AI-38 conserva sus pendientes de continuidad y los demás requisitos del entorno.

### Correcciones R02 y límite de aceptación

R02 incorpora tres correcciones implementadas y cubiertas por pruebas focales: límite de cobertura de GC en eras cerradas; admisión PEM exclusivamente pública descrita arriba; y conciliación por conjuntos de todos los pendientes del estado, hasta 10.000, mediante un máximo de tres SELECT parametrizados de sólo lectura, uno por tipo de recurso. Un testigo inicial todavía presente ya no deja sin revisar los posteriores. La confirmación remota sigue fuera de la transacción SQL y sólo acredita IDs ausentes.

La **adopción de R02 está pendiente** del [recibo de upgrade R02](../../evidence/nodia-ai-ai38-journal-upgrade-r02.json), reservado para la ejecución del operador. Esta sección se congela antes de empaquetar R02: no constituye ese recibo, no traslada a R02 las pruebas remotas de R01 y no afirma cambios de servicios ya realizados. El upgrade previsto conserva la era iniciada a las 23:52:27.154Z y sus copias; no ejecuta bootstrap ni reinicia su cobertura. El estado propuesto de este ADR y la aceptación parcial de AI-38 se mantienen.

## Consecuencias

- Beneficios: el restore conserva un origen independiente de borrados, separa recursos, falla cerrado si falta cobertura y permite conciliar resultados inciertos sin repetir efectos. El catálogo vincula GC y copias verificadas.
- Costos y riesgos: R2 pasa a ser una dependencia de los borrados protegidos y del backup; el CAS es acotado y puede saturarse. Deben observarse capacidad, conflictos, pendientes y antigüedad. El namespace debe quedar reservado a sus escritores autorizados; la clave simétrica y la RSA privada requieren custodia independiente.
- Alcance: los controles no acreditan desaparición física interna de Cloudflare, versiones desconocidas, multipart de otros escritores ni snapshots del hipervisor. Una caída de VM/red/proveedor puede superar el intervalo del timer y el objetivo físico de 24 h. Las copias históricas externas al catálogo impiden afirmar retención global de siete días.
- Trabajo posterior: adoptar R02 con recibo del entorno, observar continuidad del schedule, inventariar copias antiguas y mantener los demás gates de AI-38. Las pruebas puntuales de R01 permanecen acotadas a sus recibos. No habilitar una restauración normal desde la cuarentena sin conciliación actual de dominio y runtimes.

## Referencias

- [AI-37: rendimiento y recuperación](../../mvp/83-nodia-ai-ai37-performance-recovery.md).
- [AI-38: aceptación por entorno](../../mvp/84-nodia-ai-ai38-environment-acceptance.md).
- [Runbook del journal](../../../ops/nodia-ai-backups/journal.md) y [backups](../../../ops/nodia-ai-backups/README.md).
- [Puerto y recursos](../../../nodia-server/src/nodia-ai-recovery/types/deletion-journal.ts), [estado externo](../../../nodia-server/src/nodia-ai-recovery/use-case/update-nodia-ai-external-state.use-case.ts) y [transporte cifrado](../../../nodia-server/src/nodia-ai-recovery/nodia-ai-external-recovery.factory.ts).
- [Cloudflare: compatibilidad S3 de R2](https://developers.cloudflare.com/r2/api/s3/api/), consultada el 2026-10-20: documenta condiciones de PUT/HEAD/GET; no se extrapola esa garantía a DELETE.

## Adenda posterior al congelado de R02 — adopción comprobada

Esta adenda documental sucede al paquete congelado y conserva las secciones anteriores como registro de su estado previo. El pendiente de adopción descrito allí queda resuelto por el [recibo de upgrade R02](../../evidence/nodia-ai-ai38-journal-upgrade-r02.json), observado a `2026-10-21T00:09:10.755495Z`: API y worker ejecutan R02, con 2.851 outputs compilados y manifiesto `c8f49aa3…`. Los timers siguen activos, ambos oneshots concluyen con salida 0 y el catálogo registra tres copias ready. Se conserva la misma era abierta desde `2026-10-20T23:52:27.154Z`, sin bootstrap repetido, interrupción legacy o reinicio de cobertura. Gemini, nginx, esquema, selección y outputs originales permanecen iguales; no hay pendientes SQL/nativos, inferencias, migraciones ni efectos comerciales nuevos.

La [QA final R02](../../evidence/nodia-ai-ai38-journal-qa-r02.json) acredita 4.387 pruebas correctas en 244 archivos, build y tipado de producción correctos, y lint sin errores con tres advertencias históricas. La [integración de conciliación SQL R02](../../evidence/nodia-ai-ai38-journal-reconcile-sql-r02.json) añade cinco comprobaciones sobre 105 pendientes desechables: tres lecturas por conjuntos identifican los tres recursos ausentes y conservan 102 presentes; un ausente en la posición 101 no queda bloqueado por los cien anteriores. Ese ensayo es SQL de sólo lectura y no realiza confirmaciones R2 ni acceso a la BD operativa; no se cuenta como otra prueba de transporte externo.

El cambio de estos dos documentos posterior al congelado no altera las fuentes/runtime del paquete aceptado ni reescribe sus pruebas. El ADR continúa propuesto y AI-38 parcial: quedan fuera del catálogo las 29 copias históricas, no se acreditan siete días transcurridos, borrado físico interno del proveedor ni los plazos durante una caída. El recorrido comercial completo y los demás gates del entorno conservan su aceptación independiente.
