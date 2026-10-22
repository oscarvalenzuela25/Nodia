# AI-38 — retirada autorizada de los 29 dumps históricos

**Limpieza completada y verificada:** se retiraron exclusivamente los 29 archivos del [manifiesto revisado](nodia-ai-ai38-legacy-backups-cleanup-plan-r01.json), por autorización expresa del usuario. Total: **7.561.623 bytes**. Se conservaron 26.118 entradas de código/evidencia, incluidas las 29 carpetas originales, las cuatro copias cifradas actuales y el entorno operativo. Este cierre resuelve el retiro de esos 29 dumps; no equivale al cierre global de AI-38.

## Alcance autorizado y ejecución

La [autorización](nodia-ai-ai38-legacy-delete-authorization-r01.json) fija el texto de la solicitud y el SHA del plan `dd9421d7339e13408c972f3fbd4424bae2253eb85141789fe01081fc9433526b`. No aprueba automáticamente fichas, ADR o publicación. El plan y la [revisión anterior](nodia-ai-ai38-legacy-backups-review-r01.md) conservan sus estados históricos; el recibo actual acredita su ejecución sucesora.

La [guardia ejecutada](scripts/nodia-ai-ai38-legacy-backups-delete.py), SHA `94c1e2540208952571fb1f464d6df9a8aaf09f3ca6467a89ba48d632f9c24a1e`, verifica el manifiesto completo antes del primer unlink: padres canónicos exclusivos de root, archivos regulares root/0600 y de un enlace, dispositivo/inodo/tamaño/timestamps/SHA y ausencia puntual de descriptores/mapeos ajenos. Mantiene FDs seguros, revalida el nombre y contenido inmediatamente antes de cada retirada y usa unlink por descriptor de carpeta. No borra directorios, no sigue symlinks, no usa glob ni recursión para eliminar.

El ledger privado guarda intención y hace fsync antes de cada unlink; después sincroniza el directorio y confirma ausencia. Una carpeta de trabajo existente impide replay automático: un fallo parcial exige conciliación del ledger, no reconstruir la selección desde el sistema de archivos. No se creó otra copia de los dumps ni se importaron al catálogo cifrado para extender su horizonte.

Las [diez pruebas de seguridad Linux](nodia-ai-ai38-legacy-backups-delete-tests-r02.json) pasan sobre archivos sintéticos privados: selección exacta y conservación de vecinos, hash cambiado, archivo faltante, symlink de archivo/padre, hardlink, FD abierto, padre escribible por otros, path externo y fallo parcial con intención durable/replay denegado. No tocaron los backups operativos. R01 y R02 de tests se preservan; R02 añade refresco de uso tras inventariar vecinos y corrige el cierre de un descriptor en un fallo excepcional.

## Resultado y verificación independiente

El [recibo de eliminación](nodia-ai-ai38-legacy-delete-result-r01.json) registra **29/29 eliminados**, 7.561.623 bytes, cero dumps retenidos por descriptores/mapeos y mismo hash del inventario vecino antes y después:

`875569bcee70ac56011be587c31ed19b0f8f8bdd862c43944aafc05f993a9d96`

Un [segundo proceso verificador](nodia-ai-ai38-legacy-delete-verification-r01.json) vuelve a comprobar ausencia de los 29 paths, las 29 carpetas originales y la igualdad exacta del snapshot de **26.118 entradas preservadas en total, incluidas esas carpetas: 19.822 archivos y 6.296 directorios**. El snapshot excluye únicamente los 29 dumps autorizados y compara hashes/identidades de archivos y metadata estable de directorios; no publica sus contenidos. El ledger tiene 29 intenciones y 29 confirmaciones de ausencia, en orden, y termina completo. No se retiró ningún archivo adicional de ese inventario.

## Copias cifradas y entorno conservados

Las observaciones R2 [anterior](nodia-ai-ai38-legacy-delete-protection-before-r01.json) y [posterior](nodia-ai-ai38-legacy-delete-protection-after-r01.json) verifican por HEAD/GET tamaño y SHA de las **cuatro mismas copias cifradas**, con iguales IDs, fechas de captura/vencimiento, bytes y digests. La era y la identidad de clave pública tampoco cambian. Al iniciar esta ejecución había cuatro copias; la revisión previa había observado tres. Esta limpieza no subió, eliminó o mutó backups/journal en R2. La custodia local de claves se comprobó por existencia/ACL protegida, sin leer sus bytes ni enviarlos a la VM; el restore real previo conserva su evidencia y no se repite aquí.

El estado del entorno [antes](nodia-ai-ai38-legacy-delete-environment-before-r01.json) y [después](nodia-ai-ai38-legacy-delete-environment-after-r01.json) coincide en servicios/PIDs/cwd, configuración privada por hash, época Gemini, esquema/ledger de migraciones y selección de proveedor. API/worker continúan desde el paquete R02 (2.851 outputs y manifiesto `c8f49aa3…`); originales932 y nginx permanecen idénticos. Timers activos y endpoint de salud200. Cero jobs, intentos, slots o artefactos nativos pendientes en el corte. Sin cambios de servicio, SQL operativo de escritura, migraciones, inferencias o efectos comerciales.

## Límites del cierre

- La ausencia de esos archivos y sus FDs/mapeos no demuestra borrado físico de bloques, WAL, snapshots del hipervisor o copias remotas. El inventario del proveedor/otras exportaciones y las observaciones continuadas de retención siguen siendo alcances distintos.
- Los compilados, manifiestos y proyecciones técnicas vecinas solicitados se conservaron. Su clasificación/ciclo de metadata no se transforma en retención indefinida de contenido; tampoco se presume inventario global por este barrido acotado.
- Desaparecen los 29 puntos históricos de SQL autorizados; la BD viva y los backups cifrados vigentes no se restauraron ni modificaron. No se promete recrear los estados exactos históricos desde una captura nueva.
- Ficha operativa revisión14 permanece draft/unregistered/approval null; 31 documentos aprobados, 74 capacidades y conocimiento418900… conservados. Plan45 no cambia. El gate local de retirada de estos 29 archivos queda satisfecho; **AI-38 mantiene sus gates funcionales, publicación y entorno restantes**.

[Validación consolidada y procedencia](nodia-ai-ai38-legacy-delete-validation-r01.json).
