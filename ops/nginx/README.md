# Límites HTTP de NodiaAI

`nodia-ai-attachment-content.conf` se incluye dentro del virtual server que ya
publica la API de Nodia. Su upstream y cabeceras conservan el transporte del
laboratorio Linux; al desplegarlo en otro entorno se debe comprobar su upstream
real. No añade listeners, autenticación, permisos ni rutas de aplicación.

El bloque sólo amplía a **20 MiB exactos** el cuerpo de la ruta
`/api/v1/nodia-ai/attachments/<UUID v4>/content`. Nginx interpreta `20m` como
20 × 1024 × 1024 bytes. El contrato usa un `PUT application/octet-stream` por
archivo: no hay envolvente multipart que necesite margen adicional. Los demás
endpoints conservan el límite existente del virtual server.

El backend sigue validando una intención JSON previa, tamaño reservado, bytes
realmente recibidos, tipo y contenido inspeccionados, autoridad y cuotas. Los
**40 MiB por mensaje** son la suma de hasta cuatro adjuntos ya cargados, no una
subida de 40 MiB. Este bloque no eleva esa suma ni los 64 KiB de JSON de NodiaAI.

Fuentes ejecutadas: [política](../../docs/mvp/nodia-ai-v1-runtime-policy.json),
[controlador](../../nodia-server/src/nodia-ai-attachment/nodia-ai-attachment.controller.ts),
[intención](../../nodia-server/src/nodia-ai-attachment/use-case/create-nodia-ai-attachment.use-case.ts)
y [subida](../../nodia-server/src/nodia-ai-attachment/use-case/upload-nodia-ai-attachment.use-case.ts).

Para el laboratorio, el [driver reversible](../../docs/evidence/scripts/nodia-ai-ai38-proxy.py)
inserta el bloque con pin SHA256, conserva el sitio previo, comprueba
`nginx -t` y recarga exclusivamente nginx. `revert` exige que nadie haya cambiado
la configuración adoptada y restituye los bytes originales. Una nueva aplicación
usa otro directorio de trabajo para preservar los recibos. Durante la recarga
graceful pueden terminar peticiones del worker anterior; la aceptación HTTP debe
esperar a que las respuestas del nuevo límite sean observables.

La [validación offline](../../docs/evidence/scripts/validate-nodia-ai-ai38-proxy-offline.py)
comprueba alcance, contratos y negativos de rutas. No acredita una subida real ni
la configuración efectiva. La aceptación exige además `nginx -t`, comparar
identidades de procesos, pasar un archivo válido de 20 MiB por el proxy real y
rechazar 20 MiB + 1 byte; verificar descarga/hash y limpieza de su objeto propio.
