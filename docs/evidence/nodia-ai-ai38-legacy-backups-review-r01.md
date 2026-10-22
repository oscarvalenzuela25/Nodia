# AI-38 — revisión y disposición de las 29 copias históricas

Solicitud: revisar las 29 copias históricas y definir su limpieza. **Revisión completada; eliminación no ejecutada.** El alcance solicitado no autoriza expresamente destruir estos puntos de recuperación. Se deja una propuesta exacta y verificable para esa decisión irreversible, sin una aprobación adicional de desarrollo ni atribuirla a un requisito de una skill.

## Resultado confirmado

La [inspección real](nodia-ai-ai38-legacy-backups-inspection-r01.json), observada a 2026-10-21T02:17:45Z en la VM Linux local, abrió exclusivamente los 29 archivos del [inventario previo](nodia-ai-ai38-environment-retention-r02.json), bajo `/opt/nodia/verification-backups/`. Conservan tamaño/mtime anteriores y suman **7.561.623 bytes** (aprox. 7,21 MiB). Son archivos regulares root/0600, con un enlace, padres canónicos sin symlinks, y huellas/identidades estables antes y después. No hubo descriptores abiertos observados ni fallos de permiso al inspeccionar `/proc`; es una observación puntual, no una garantía para una ejecución futura. Sus29 hashes son diferentes.

Los 29 tienen firma `PGDMP`: **formato custom de PostgreSQL sin envoltura criptográfica de aplicación**. No se afirma conocer cifrado del disco o snapshots del hipervisor. `pg_restore --list` terminó correctamente en todos:28 contienen 410–614 entradas de catálogo y el archivo inicial AI-15 de 1.032 bytes contiene **cero entradas**. Se clasifica como archivo de catálogo vacío, no como corrupción demostrada ni respaldo completo útil. El listado no ejecutó SQL ni se publicaron tablas, filas, nombres de BD, payloads o stderr.

Las fechas embebidas declaran capturas entre 2026-10-16T18:36:26Z y2026-10-18T23:01:33Z. El listado se ejecutó con TZ=UTC. Son fechas declaradas/renderizadas por el catálogo, no atestaciones firmadas de captura ni prueba independiente de la zona horaria original. **Ninguna declara haber superado siete días al inspeccionarla**; sus fronteras declaradas estarían entre23 y25 de octubre. No se las etiqueta como vencidas sólo por mtime. El motivo de retiro propuesto es su obsolescencia/custodia, no un vencimiento inventado.

## Procedencia y dependencias

Son capturas previas a activaciones/migraciones AI15–35. La [trazabilidad local con JSON pointers y hashes](nodia-ai-ai38-legacy-backups-provenance-r01.json) identifica referencias exactas en recibos de 24 directorios; cinco sólo figuran en los inventarios: los AI15 `183626Z` y `183638Z`, AI17 `1792194498`, AI22 `1792251286` y AI32-R02 `1792296716`. No se inventa autoría para esos cinco.

Los productores públicos [AI33](scripts/nodia-ai-ai33-migrate.mjs), [AI34](scripts/nodia-ai-ai34-migrate.mjs) y [AI35](scripts/nodia-ai-ai35-migrate.mjs) invocan `pg_dump --format=custom` sin cifrado y conservan el dump privado. El [verificador AI33](scripts/nodia-ai-ai33-backup-verify.mjs) referencia una ruta histórica para listar su catálogo; eso no constituye una dependencia del runtime. API/worker, Gemini, nginx y timers mantuvieron sus estados/épocas durante esta revisión.

Los directorios también contienen compilados de rollback, manifiestos y, en AI33–35, proyecciones técnicas del chat y recibos de migración. Por contrato de sus productores, esas proyecciones excluyen mensajes, transcripciones, títulos, claves y storage keys, pero sí conservan IDs/huellas/estados. Sólo se leyó metadata de esos archivos vecinos en la VM; no se acredita su contenido real ni una clasificación global de retención. **Se preservan: no borrar directorios, prefijos o todos sus JSON.** Su metadata identificable tiene un inventario/ciclo separado; no se convierte en archivo eterno por quedar fuera de estos29 dumps.

## Respaldo vigente y disposición recomendada

La [observación actual del reemplazo](nodia-ai-ai38-legacy-current-protection-r01.json) volvió a verificar por HEAD/GET, tamaño y SHA las **tres copias cifradas ready de R2**, sin subir, borrar o modificar el catálogo. No hay testigos sin confirmar. Se conserva la misma era externa iniciada a 2026-10-20T23:52:27.154Z y la identidad de clave pública esperada. El [descifrado](nodia-ai-ai38-backup-decrypt-r01.json) y [restore aislado](nodia-ai-ai38-backup-restore-r01.json) anteriores acreditan recuperación de una de esas copias (62 tablas/29 migraciones); no se repitió el restore ni se atribuye a las 29 capturas antiguas.

**Recomendación: retirar los 29 archivos exactos después de autorizar el manifiesto.** No recifrarlos para conservarlos otra semana ni importarlos al catálogo actual: la política50 fija un máximo, no una conservación mínima de siete días, y hacerlo no reconstruiría el journal anterior a la era. El reemplazo protege el estado actual, no garantiza recuperar cada estado histórico de las activaciones de16–18 de octubre. La retirada pierde esos29 puntos históricos de SQL; no modifica la BD viva ni los paquetes de código de rollback.

Una conservación temporal alternativa necesitaría un motivo de recuperación concreto, custodia cifrada y vencimiento desde captura original acreditada; copiar/recifrar no reinicia el plazo ni sana la falta de cobertura. No se programa una eliminación futura sin autorización, ni se modifica el schedule de los backups nuevos.

## Plan exacto preparado

El [manifiesto de limpieza](nodia-ai-ai38-legacy-backups-cleanup-plan-r01.json) enumera29 paths,7.561.623bytes, SHA256 e identidad de cada archivo. Estado `review_ready_execution_not_authorized`; **cero archivos eliminados**. Su SHA256 es `dd9421d7339e13408c972f3fbd4424bae2253eb85141789fe01081fc9433526b`.

1. Verificar nuevamente las copias cifradas vigentes y la custodia de clave; no crear un respaldo nuevo de los dumps que se pretenden retirar.
2. Revalidar la totalidad del manifiesto antes del primer borrado: padres canónicos, archivo regular root/0600 y de un enlace, dev/inodo/tamaño/timestamps/SHA y ausencia puntual de uso. Si algo cambió o falta, detener y volver a revisar; no reconstruir la lista con un glob.
3. Tras autorización expresa de esta lista, retirar sólo cada archivo exacto con controles por descriptor, recibo durable de avance y fsync del padre. Ante fallo parcial, conservar el resultado conocido por archivo, conciliar y no repetir a ciegas. No recursión, movimientos a otro archivo de respaldo ni borrado por prefijo.
4. Verificar ausencia de los 29 paths y conservación de carpetas/vecinos, catálogo R2, configuración, claves, servicios y estado SQL/nativo. Registrar el recibo sucesor. La ausencia del path no demuestra borrado físico de bloques, WAL, snapshots o copias remotas.

## Estado de aceptación

Esta entrega define y hace revisable la limpieza; **no cierra su ejecución ni AI-38**. Las copias históricas continúan existiendo hasta autorizar y ejecutar el plan. Tampoco se inventariaron versiones ajenas, snapshots del hipervisor u otras exportaciones del sistema. El runtime R02, sus2851outputs, publicación418900…,31 fichas aprobadas y74 capacidades se conservan, sin inferencias, migraciones o cambios de negocio. La ficha de operación sigue borrador y no se aprueba por documentar esta revisión.


La [validación consolidada](nodia-ai-ai38-legacy-backups-validation-r01.json) fija fuentes, recibos y comprobaciones. La [custodia de claves](nodia-ai-ai38-legacy-key-custody-r01.json) se revisó sólo por existencia y ACL protegida en Windows, sin abrir las claves ni enviarlas a la VM. No se repiten suites de producto porque no cambió comportamiento de producción; se validaron la inspección real, sintaxis de las fuentes de operador, links y compilación de conocimiento.
