# AI-37 — preparación de una restauración en cuarentena

Guía técnica de laboratorio. No acredita rotación de backups, journal externo histórico, aislamiento de red ni aceptación productiva. El resultado de preparación nunca autoriza abrir el servicio.

## Frontera operativa

1. Detener API y worker y retirar el acceso del proxy antes de restaurar. Aislar la copia de proveedores/storage y credenciales operativas. `NODIA_AI_OPERATION_MODE=quarantine` bloquea el arranque nuevo de API/worker, pero no cambia procesos ya iniciados ni constituye un firewall.
2. Restaurar sólo en una base nueva `nodia_restore_<identificador>`. El CLI exige ese prefijo y configuración explícita; no importa `config/data-source`, `AppModule`, `.env` ni adaptadores de proveedor. Nunca apuntar la prueba a la BD configurada.
3. Conservar fuera de la copia el journal mínimo de borrados recientes y su head confiable. Sin esa fuente completa, conservar cuarentena. Un hash creado desde el backup o un booleano `complete` no demuestra completitud.

## Entradas independientes

El CLI recibe cuatro archivos privados, distintos, con permisos del operador:

- `target.json`: exactamente `host`, `port`, `username`, `password`, `database`. El password es sólo de la copia aislada, no se registra en consola ni se pasa como argumento.
- `metadata.json`: exactamente `backup: {id, captured_at}` y `quarantined_at`, tiempos UTC ISO con milisegundos. El ID debe identificar la copia; `quarantined_at` se observa una vez detenidos los escritores de la fuente que produce el journal.
- `manifest.json`: `schema_version: 1`, `backup_id`, `coverage_from`, `coverage_through`, `first_sequence`, `entries`. Cada entrada contiene exclusivamente `sequence`, `conversation_id`, `deleted_at`, `storage_generations` (UUID opacos; sin texto, propietario o motivo).
- `external-head.json`: exactamente `sha256` de los bytes UTF-8 del manifest y `last_sequence`, obtenido del almacén externo confiable. No se reconstruye buscando filas que sobrevivieron en el backup.

El manifest debe cubrir desde antes o en el instante de captura hasta la cuarentena. Su secuencia es contigua y llega al head externo; el intervalo vacío conserva el cero real. Se rechazan cambios de digest, huecos, fechas inválidas/futuras, IDs/propiedades adicionales, copias de más de siete días y ausencia de cobertura. La procedencia y registro completo del journal siguen siendo responsabilidad de la infraestructura externa: el código no puede detectar un borrado que jamás se registró.

Límites técnicos del archivo: 8 MiB, 10.000 entradas, generaciones por entrada limitadas por la política de adjuntos por chat. Si se supera ese volumen, mantener cuarentena y diseñar paginado autenticado antes de ampliar el contrato. No truncar ni descartar entradas para pasar la validación. Retirar estas identidades cuando no quede ninguna copia capaz de resucitarlas; horizonte máximo de backup más limpieza, sin historial indefinido.

En Linux, desde el paquete compilado:

```sh
NODIA_AI_OPERATION_MODE=quarantine node scripts/prepare-nodia-ai-restore.mjs \
  --execute /ruta/privada/target.json /ruta/privada/metadata.json \
  /ruta/externa/manifest.json /ruta/externa/external-head.json
```

## Qué cambia y qué no prueba

La preparación revoca grants NodiaAI, elimina challenges y caduca propuestas ejecutables/invalida borradores. Todo trabajo foreground pendiente queda `unknown`, con fence nuevo y `restore_quarantined` en su descriptor privado. Un `ready` del backup pudo haber sido enviado después de la captura; no se clasifica como «nunca enviado». Se preservan receipts completados e identidades nativas originales. Los slots existentes, incluso libres en la copia, quedan inciertos.

La marca impide claims, checkpoints, conciliación automática SQL/nativa, ACKs y reanudación/login ordinarios. La purga conserva esa marca en sus testigos mínimos. El reloj actual elimina chats vencidos y los borrados del journal por el mismo caso de uso de retención del producto; los trabajos de borrado conservan generación/clave hasta confirmar su eliminación. Las copias de factura independientes y registros de negocio no se eliminan con el chat.

Los encabezados históricos terminales conservan su estado observado en la copia. Sus pasos fallidos pasan a inciertos y su marca impide reutilizar un rollback antiguo para reanudar; `can_resume` queda deshabilitado. Sus jobs de ejecución fallidos pasan a `unknown` para conservar el testigo mínimo también si luego caduca el chat. No se convierten todos los encabezados fallidos en ejecuciones activas `unknown`: pueden existir varios en un chat junto a una ejecución nueva y debe conservarse su restricción de una sola ejecución activa. Los jobs `done` y `cancelled` no se convierten en pendientes.

No se invoca proveedor, escritor de dominio ni receipt como comando. La preparación no llama a storage; conserva tareas para borrado posterior con propiedad comprobada. Los IDs de generaciones del journal que no estén en la copia requieren inventario externo; la salida no afirma borrado físico.

La salida contiene `release_authorized: false`. Antes de cualquier apertura se debe conciliar contra el dominio actual y el runtime actual, no sólo contra el backup; inventariar también perfiles/operaciones ausentes en la copia y revalidar sesiones/autoridad. No borrar la marca ni liberar slots para conseguir que el worker avance. Esta entrega no incorpora un liberador automático de cuarentena ni acredita rotación real de snapshots/WAL/versiones de objetos. Ese cierre operativo conserva su gate de despliegue.

Un descriptor histórico que ya ocupe el máximo de 8.192 bytes puede impedir añadir la marca. El CHECK revierte la preparación transaccional y la instancia permanece en cuarentena. No truncar ni eliminar la identidad para hacerlo pasar: requiere una conciliación operativa explícita o una evolución de contrato independiente. La preparación informa fallo, nunca un éxito parcial que permita abrir el servicio.

## Verificación aislada

`test/nodia-ai-ai37-recovery.integration.mjs` crea PostgreSQL16 desechable con las migraciones reales, mata workers sintéticos antes/después de armar dispatch, comprueba fences y compatibilidad de catálogo, genera `pg_dump`, restaura con `pg_restore` en otra BD y ejecuta el CLI en otro proceso. Las eliminaciones de objetos usan un puerto sintético que falla hasta agotar el presupuesto; el testigo y backoff se persisten en PostgreSQL real. Esto no es una prueba R2/proveedor ni de restore de datos operativos.

La ejecución R01 sobre el paquete compilado04 pasó **33 comprobaciones SQL/procesos**, incluido el contraejemplo de unicidad y el fallo cerrado de un descriptor al límite. [recovery.json](nodia-ai-ai37-recovery.json) conserva procedencia, hashes, el intento inicial sin acceso a Docker y sus límites; [resultado SQL original](nodia-ai-ai37-recovery-sql-r01.json) conserva los resultados completos. Los 17 casos unitarios del manifest y cuatro regresiones de guards complementan esta integración; la suite general y el build pertenecen a la evidencia consolidada AI-37. Ninguna de estas pruebas acredita una restauración operativa ni abre el servicio.
