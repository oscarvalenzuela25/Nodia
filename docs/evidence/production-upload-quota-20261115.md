# CD: cuota de recepción de backend — 2026-11-15

## Causa confirmada y alcance

[CI43753748903](https://github.com/oscarvalenzuela25/Nodia/actions/runs/43753748903)
de master422f823e pasó. [CD43754640640](https://github.com/oscarvalenzuela25/Nodia/actions/runs/43754640640)
se detuvo durante upload de backend con `backend_upload_outcome_unknown`, después
de verificar los baselines y el preflight Pages. Frontend no se publicó.

El recibo original identifica operación `df43e4475de09c49dad98e773279fe93`, estado
upload_requested y deployment_requested:false. Lecturas SSH restringidas
confirmaron operation_not_found, current e2c2eca3 y API/worker activos, sin bloqueo.
La inspección root posterior confirmó ZIP/partial/submission/request ausentes;
no se deduce ausencia de ZIP únicamente de operation_not_found.

La carpeta incoming tenía9ZIPs y1943818981bytes. El artefacto oficial14177268691
ocupa215982270bytes: total2159801251, que supera MAX_INCOMING2147483648
por12317603bytes. El disco disponía de102381137920bytes; no era falta de disco.
El receiver instalado tenía SHA256b2880ea7… idéntico al código inspeccionado:
su gate de cuota rechaza antes de crear la carpeta/ZIP. No se reenvió la subida
para provocar el rechazo de nuevo.

## Reparación operativa, sin despliegue

El operador autenticó la sesión tmux privada conforme al runbook. Se inspeccionaron
operaciones/referencias sin capturar contraseña ni logs privados libres.

Se revisó y ensayó `archive-completed-backend-upload.py`, operador root con
dry-run por defecto y apply explícito. Un dry-run real validó la operación
cf77431152a9416d2b27b55f17f598c4 (complete), artefacto14088269914 y su digest.
Era una versión histórica174c2ca5, distinta de current. Tras pruebas y revisión
se archivó sólo ese ZIP:215976268bytes, sin borrar su contenido. El archivo está
en `archived-incoming/server-43535099739-1/14088269914.zip`, con SHA256
80dabe812df7731d606f248137f4a1d1a0f2bdfaee89846918f41d6f2378626f intacto.

El helper toma locks receiver→installation; verifica pins, inode/permisos/hash,
operación completa, request/submission y toda referencia compartida. Excluye el
paquete actual, parciales, operaciones fallidas/inciertas y colisiones. Intent
durable precede a renameat2 NOREPLACE; fsync y recibo confirman el movimiento.
Una interrupción exige inspección: no hay replay ni sobreescritura implícitos.
No cambia requests/attempts/submissions o su evidencia histórica.

Postcheck:8ZIPs/1727842713bytes en incoming; el original nuevo cabe bajo la cuota.
El archivo preservado conserva tamaño/hash; los dos paquetes de intentos fallidos
permanecen en recepción. Current sigue backend-e2c2eca346a2-d096d1b33274,
API/worker activos y blocked:false. Sin deploy, SQL, backup/restore, migración,
reinicio, cambio de credenciales o publicación Pages. sudo fue invalidado y la
sesión administrativa cerrada.

El archivado no libera disco: retira un paquete de la cuota activa y lo conserva
para auditoría/recuperación. No se eleva el límite ni introduce retención automática.
Una futura política de almacenamiento debe distinguir recepción, archivo y releases.

## Corrección del diagnóstico — candidata de código

Se detectaron dos pérdidas de información: gateway podía descartar la respuesta
root ante BrokenPipe al rechazar antes de consumir el ZIP; cd-vps colapsaba cualquier
respuesta no exitosa en unknown. El gateway ahora recoge una única respuesta
acotada tras EPIPE y detiene la transmisión, sin reenviar bytes.

Sólo se reconocen cuatro rechazos con esquema exacto y exit no cero:
cuota, headroom, actualización pendiente de conciliación y upload ya registrado.
Node guarda upload_rejected/operation_id/deployment_requested:false y el recibo
durable conserva sólo códigos permitidos. Campos extra, código ajeno, éxito
contradictorio, JSON inválido o pérdida de conexión mantienen resultado incierto.
Todos los casos conservan automatic_retry_allowed:false y no envían deploy.

Esta corrección no está instalada en el gateway productivo: sigue SHA256877fe548…
original. Su adopción operatoria con pin es independiente del despliegue de app;
el CD no instala automáticamente este gateway por cambiar código del repositorio.

## Verificación y continuidad

- Node24.22.2/Linux:130/130checks de ops/ci, sin omisiones. La corrida Windows
  tuvo120correctos/10omitidos por contratos POSIX; la Linux cierra esas omisiones.
- Linux root en copia privada WSL:27/27de receiver/gateway y16/16de archivado,
  sin omisiones. Tuberías reales reproducen rechazo antes de leer un ZIP mayor
  al buffer; incluye límites, códigos no seguros, locks, parciales, no-replay,
  referencias compartidas e interrupciones antes/después del movimiento.
- No es ensayo en contenedor/systemd ni ejecución generativa. El runner de CI
  incorpora las16regresiones del operador al contenedor root existente.
- UTF-8/LF, sintaxis Python/Node y diff comprobados; pruebas no dependen del VPS.

Los ensayos iniciales de Linux sobre filesystem Windows o una copia sin archivos
Server fallaron por propiedad/rutas incompletas; se corrigió el harness y se
repitieron las suites completas en copias privadas Linux, sin relajar pruebas.

[Recibo consolidado](production-upload-quota-20261115.json) conserva IDs/digests,
inventarios, archivo, estado final y límites. Logs/ZIPs temporales en output ignorado.

No reejecutar CD43754640640 ni su upload, ni borrar su recibo. La continuidad
normal requiere corrección versionada, promoción y un CI/CD nuevo confiable;
la liberación de cuota no convierte un intento fallido en exitoso. El Teacher
nuevo todavía no está desplegado por esta intervención. Evaluación NodiaAI:
operación de infraestructura, sin cambio funcional, permisos, herramientas o
fichas de producto; no se publica conocimiento por diagnosticar el CD.
