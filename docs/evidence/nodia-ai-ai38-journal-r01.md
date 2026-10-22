# AI-38 — journal externo y backups cifrados de siete días

Continuación de la [revisión del entorno](nodia-ai-ai38-environment-current-r01.md), por solicitud del usuario. Alcance: VM Linux local, productor de borrados y nuevo catálogo de backups. **AI-38 sigue parcial**; no se aprueban documentos ni se publica una herramienta nueva. [ADR-070 propuesto](../architecture/decisions/ADR-070-external-deletion-journal-and-encrypted-backups.md), [guía operativa](../../ops/nodia-ai-backups/journal.md) y [contrato de backups](../../ops/nodia-ai-backups/README.md).

## Implementación

Journal fuera de la BD/VM, cifrado AES-256-GCM en R2, con CAS y estado cerrado/era explícita. Registra intención antes del borrado de chat, adjunto independiente o preferencia; confirma después del commit. Un resultado incierto conserva el testigo mínimo y bloquea nuevas capturas hasta conciliar. Las llamadas externas quedan fuera de locks SQL prolongados. El consumidor de restore v2 aplica IDs/generaciones, conserva cuarentena y no autoriza ejecución. Sin tablas, migraciones, endpoints o herramientas MCP nuevos.

Backup `pg_dump` en streaming hacia spool exclusivamente cifrado; DEK nueva por copia, AES-256-GCM y RSA-OAEP-SHA256 con pública SPKI de al menos3072 bits. Reserva externa antes de la captura, plazo fijo de siete días, receipt/digest durable antes del único PUT condicional y verificación HEAD/GET antes de ready. La privada RSA permanece en Windows. Las claves/configuración no están en el repositorio, logs o recibos públicos.

Pending con receipt y404 no equivale a copia inexistente definitivamente: conserva testigo sin replay. La rotación sólo elimina keys UUID propias e inmutables y concilia ausencia; no lista buckets ni borra prefijos. **R2 ignoró DELETE If-Match** en la [sonda real](nodia-ai-ai38-journal-r2-probe-r01.json): la protección se basa en propiedad exclusiva, PUT único condicional, catálogo/digest y un scheduler con flock. No se promete DELETE condicional atómico.

## Aceptación inicial y correcciones

El [paquete R01](nodia-ai-ai38-journal-package-r01.json) contiene3874 archivos/2848 outputs compilados. La primera [activación](nodia-ai-ai38-journal-activation-r01.json) falló cerrado: `99-ai38-journal.conf` se cargaba antes de `ai15-release.conf`, que sobrescribía el cwd de API aunque argv/env ya apuntaban al código nuevo. Se detuvieron ambos consumidores sin arrancar legacy ni repetir bootstrap. El [diagnóstico](nodia-ai-ai38-journal-start-diagnostic-r01.json) y la [continuación](nodia-ai-ai38-journal-resumed-r01.json) acreditan corrección mediante `zz-ai38-journal.conf` y procesos efectivos exactos. Gemini y nginx no se reiniciaron.

La era comienza **2026-10-20T23:52:27.154Z**, no antes. Los intervalos con consumidores detenidos no introducen escritores legacy. El bootstrap no se repite y no se fabrica cobertura histórica.

| Evidencia | Resultado y límite |
|---|---|
| [SQL aislado](nodia-ai-ai38-journal-sql-r01.json) |17 casos: rollback tras intención, cambio de generación, reintento sin duplicar, adjunto/preferencia independientes, restore y cuarentena. CAS/storage simulados en esta primera ejecución.|
| [CAS real R2](nodia-ai-ai38-journal-live-cas-r01.json) |9 controles: concurrencia, precondiciones, cifrado, clave incorrecta, bloqueo por pendiente y cierre de era; namespace propio retirado.|
| [SQL + journal R2](nodia-ai-ai38-journal-combined-r01.json) |Los mismos17 casos, reutilizados con PostgreSQL desechable y transporte cifrado real. No se suman como17 casos distintos. Eliminación de objetos comerciales simulada; preferencia origen eliminada mediante SQL controlado.|
| [Backup operativo real](nodia-ai-ai38-backup-create-r01.json) |Ready,384388 bytes cifrados y SHA fijado; reserva23:58:20.785Z, vencimiento2026-10-27T23:58:20.785Z.|
| [Descifrado Windows](nodia-ai-ai38-backup-decrypt-r01.json) |Tag GCM verificado,383591 bytes de dump. Clave privada no enviada a VM.|
| [Restore aislado](nodia-ai-ai38-backup-restore-r01.json) |62 tablas/29 migraciones, PostgreSQL sin red/puertos y contenedor retirado. No ejecuta el consumidor AI de cuarentena sobre esta copia operativa ni acredita equivalencia lógica completa de todos los datos.|
| [Rotación real R2](nodia-ai-ai38-backup-live-rotation-r01.json) |5 controles con archivo sintético cifrado y reloj inyectado: conserva a−1ms y elimina al vencer exactamente siete días; HEAD/GET404. No transcurrieron siete días reales. Namespace, ledger y spool propios retirados.|
| [Servicios endurecidos](nodia-ai-ai38-backup-service-acceptance-r01.json) |Captura y rotación oneshot reales correctas con sandbox systemd. Dos copias ready en catálogo, temporizadores activos: captura02:30UTC diaria y rotación cada cinco minutos.|
| [Limpieza del operador](nodia-ai-ai38-backup-operator-cleanup-r01.json) |Dump privado temporal y copia cifrada de verificación retirados; privada RSA y clave del journal conservadas fuera del workspace. Ausencia de archivos no demuestra borrado físico.|

El [corte operativo inicial](nodia-ai-ai38-journal-operational-final-r01.json) confirma mismo Gemini/nginx, esquema/modelo/intensidad intactos, cero pendientes y spool sin copias. Los932 outputs originales permanecen idénticos, pero **ya no son el proceso API/worker activo**. La publicación cambia legítimamente de c703 a418900… por dos pins de implementación de preferencias, sin cambiar las31 fichas aprobadas ni las74 capacidades: [delta exacto](nodia-ai-ai38-journal-registry-delta.json). Los77 candidatos conservan su gate de publicación.

La revisión final detectó y corrigió antes de entregar la limpieza de eras cerradas después de ocho días, la validación estricta de pública SPKI y la conciliación sin inanición detrás de los primeros100 pendientes. El [paquete sucesor R02](nodia-ai-ai38-journal-package-r02.json),3879 archivos/2851 outputs, conserva el ABI y la misma release de conocimiento. Su [delta exacto](nodia-ai-ai38-journal-package-delta-r02.json) sólo incorpora esas correcciones, su caso de uso/arnés de conciliación y documentación operativa. R01 y sus recibos permanecen históricos.

La [adopción R02](nodia-ai-ai38-journal-upgrade-r02.json) verifica el paquete y los procesos efectivos, conserva la era y sus dos copias anteriores sin repetir bootstrap, ejecuta otra captura cifrada real y rotación mediante systemd, y reactiva ambos timers. Quedan **tres copias ready**, cero vencidas o no confirmadas y spool vacío. Misma época Gemini, nginx, modelo/intensidad, esquema y originales932; sin inferencias, SQL operativo de escritura o efectos comerciales. No se cerró la era ni se ejecutaron consumidores legacy durante la transición.

La [QA final](nodia-ai-ai38-journal-qa-r02.json) registra **4387/4387 pruebas en244 archivos**, tipado de producción/build correctos y lint sin errores, con tres warnings históricos. Las regresiones cubren la era cerrada tras nueve días, claves privadas/bloques extra/DER inválido y conciliación completa acotada. El [arnés SQL R02](nodia-ai-ai38-journal-reconcile-sql-r02.json) añade cinco controles reales sobre105 pendientes y tres tipos: selecciona los tres ausentes aunque la preferencia101 siga a100 presentes, conserva102 recursos existentes y usa sólo tres SELECT por conjuntos en transacción read-only. No confirma externamente esos testigos de fixture ni opera sobre la BD configurada.

El [consolidado verificable](nodia-ai-ai38-journal-validation-r02.json) fija recibos y hashes de fuentes. La documentación posterior al congelado se clasifica por separado del código adoptado; no se altera el paquete histórico para acomodar la narrativa final.

## Límites y continuación

- La protección empieza en la era real. Los29 dumps históricos observados, snapshots del hipervisor, versiones ajenas y copias remotas fuera del namespace **no quedan inventariados ni rotados por este catálogo**; no se eliminaron automáticamente.
- La eliminación lógica vence a siete días. La física depende de VM/red/R2; intervalos de cinco minutos y frontera con reloj inyectado no acreditan siete días observados ni el objetivo físico24h bajo indisponibilidad. Pendientes mínimos no se descartan para ocultar incertidumbre.
- Antes de iniciar un consumidor legacy sin journal se detienen escritores y captura, se cierra/verifica la era. No se reabre para simular continuidad: requiere nueva era/destino. Mantener configuración/clave mientras haya conciliación o copias por limpiar.
- No hubo inferencias, efectos comerciales, migraciones o UI en esta ventana. La adopción del productor no traslada la aceptación generativa de otros paquetes. HTTPS/origen público, inventario histórico y publicación/aceptación restante siguen separados.
- Ficha runtime-policy rev12 permanece draft/unregistered/approval null. Plan45 y los31 documentos aprobados se conservan; no declarar AI-38 completo.
