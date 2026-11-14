# Pages — contrato real de assets y preflight anterior al backend

Diagnóstico y corrección del 2026-11-14, America/Santiago. Fuente operativa:
[plan99§25](../mvp/99-production-deployment-and-cicd-plan.md#25-pages-respuesta-válida-rechazada-y-preflight-antes-del-backend--2026-11-14).

## Incidente y efectos confirmados

[CI43546497935](https://github.com/oscarvalenzuela25/Nodia/actions/runs/43546497935)
pasó para master `0f69d505f2826f97c5f54b14a0acbe74daea248e`.
[CD43547384570, número4](https://github.com/oscarvalenzuela25/Nodia/actions/runs/43547384570)
falló en el job132301791374. El backend terminó complete, operación
`64c9a2f383709ee93ca5e584a9bc5b52`. Pages terminó en
`asset_check_requested` con `pages_response_unsuccessful`: no alcanzó upload,
registro de hashes ni solicitud de deployment.

SSH restringido con host pin confirmó después `deployment_ready`, blocked=false,
API/worker activos y release `backend-0f69d505f282-ff076a0afc23`, árbol
`ff076a0afc23b513d1762b39f8da9c90957cc1a0f844f5e7b2e8a188ecbfeb86`.
La operación conserva complete, effects_started=true, migration_requested=true,
deployment_performed=true y automatic_retry_allowed=false. Este diagnóstico no
ejecutó apply, migraciones, reinicios o restauración.

Consulta real Pages: canónico `214e120b-b6e5-400f-a70a-5cb77aa4d3d7`, fuente
f01b493336883403a84b1c80759ce4fc43cbd370, deploy/success. Historial productivo:
10filas, página terminal, **cero marcadores nodia-ci del CI43546497935/1**.
Existe una fila Git de fuente0f69d505, `7512a31f-a883-481d-8782-6b50f1714116`,
queued/idle sin marcador nodia-ci. Esa fila no acredita publicación del CD y no
se modificó la integración Git deshabilitada.

## Causa reproducida

Se reutilizó la sesión OAuth local de Wrangler en memoria para consultar
proyecto, obtener su upload-token y realizar POST check-missing, que consulta
hashes y no sube/publica assets. Una consulta vacía y otra con el hash del
favicon devolvieron HTTP200 y este envelope, con resultado correspondiente:

```json
{"success": true, "result": []}
```

`errors` no estaba presente. El validador propio exigía
`Array.isArray(value.errors) && value.errors.length === 0`, por lo que rechazaba
una respuesta correcta. Los fixtures previos siempre añadían errors:[] y
ocultaban la diferencia. No fue el HTTP400 de paginación del intento anterior,
ni una caída o nuevo bloqueo del backend.

La fuente primaria de Wrangler4.161.0 confirma `success`/`result` sin exigir
errors y normalización de204/205 vacíos:
[transporte, commit1e688bae](https://github.com/cloudflare/workers-sdk/blob/1e688baedfe8b61b091043832b438c362590953a/packages/workers-utils/src/cfetch/index.ts#L169).
Se revisó también el flujo completo, no sólo el paso que falló:
[JWT/check-missing](https://github.com/cloudflare/workers-sdk/blob/1e688baedfe8b61b091043832b438c362590953a/packages/wrangler/src/pages/upload.ts#L110),
[upload y upsert](https://github.com/cloudflare/workers-sdk/blob/1e688baedfe8b61b091043832b438c362590953a/packages/wrangler/src/pages/upload.ts#L231),
[multipart](https://github.com/cloudflare/workers-sdk/blob/1e688baedfe8b61b091043832b438c362590953a/packages/wrangler/src/api/pages/deploy.ts#L271)
y [hash](https://github.com/cloudflare/workers-sdk/blob/1e688baedfe8b61b091043832b438c362590953a/packages/deploy-helpers/src/deploy/helpers/hash.ts#L5).
No se encontró otra incompatibilidad concreta de payload.

## Prueba con el artefacto original

Artefacto Client14094084434 del CI43546497935/1, ZIP2564478bytes, SHA256
`237492aba53e3c9aa9e31cb96865a981735c18217d8e1505e52158dcbdab02b1`.
Se comprobó el digest oficial de GitHub y los hashes de metadata, manifiesto,
tar y211archivos extraídos; fuente/CI exactos. Tar SHA256
`05fe0a7f05e677971a6398e51086217f76c714a94531f110479802751033c546`,
árbol Client `0009d1c5358b445210d7b187880a17e674db50ec2b32c807c699d7a154d67772`.
No hubo rebuild ni ejecución de la aplicación.

El nuevo `preflightPages` pasó contra Cloudflare con ese mismo dist:
proyecto, historial, upload-token y check-missing, las cuatro respuestas200.
Inventario de210assets únicos y80faltantes en esa consulta. El wrapper del
diagnóstico prohibía todo POST excepto check-missing, haciendo imposible
alcanzar upload/upsert/submit. Resultado preflight_verified,
deployment_requested=false, asset_upload_requested=false, backend_accessed=false.
Se revalidó master antes y después. La consulta OAuth no acredita por sí sola
los permisos de escritura del token distinto de GitHub Actions.

## Corrección y garantías

- Aceptar ausencia de errors en éxito; si aparece, exigir array vacío. Rechazar
  success falso, errors no vacío, tipos inválidos o resultado requerido ausente.
- Admitir204/205 vacíos exclusivamente en ACK upload/upsert. Check-missing,
  upload-token y deployment conservan resultado validado. ACK JSON null/true
  son válidos; no se inventa una identidad de deployment.
- Leer respuestas con límite2MiB durante streaming; diagnósticos contienen
  operación fija, HTTP y hasta tres códigos numéricos Cloudflare, nunca cuerpos,
  mensajes, cabeceras, URLs privadas o JWTs. No se añaden reintentos.
- Instalar herramientas, verificar/extraer una vez y probar el protocolo Pages
  **antes** del backend. Comprobante atado a CI/artefacto/configuración/hash del
  dist; backend y publicación rechazan ausencia, sustitución o cambios tardíos.
  Publicación revalida fuente/baseline y consulta un JWT nuevo, sin reutilizarlo
  desde el comprobante. El preflight no prueba que el deploy vaya a completarse.
- Guardar siempre delivery-receipt.json con allowlist y adjuntarlo como artefacto
  del CD. Conserva identidades/estados parciales y flags, sin subir el directorio
  privado. Hereda retención del repositorio y no autoriza reenvíos.

Pruebas directas Pages13/13 y conjunto Windows Node91correctas/10omisiones por
Linux. Comprobación final adicional en WSL con Node24.22.2 Linux x64:
**101correctas, cero fallos y cero omisiones**, incluidos empaquetado/ZIP y la
regresión PWA que Windows no ejecuta. Runtime descargado del origen oficial y
contrastado con SHASUMS256; SHA256
`48cc0e21e048790e54c0cf5749c2725005313d652651c40b7a21feb9697aaf75`.
Se usó filesystem Linux nativo con snapshot de las fuentes de operaciones,
workflows y consumidores nativos reales, más dependencias fijadas de hash/MIME.
El primer recorrido sobre temporales NTFS heredó EACCES; el primer snapshot
reducido omitía los11consumidores que valida el clasificador. Se corrigió el
entorno/snapshot sin cambiar assertions o permisos de los originales; el
resultado final incluye todas las unidades. Esto no sustituye GitHub Actions.
Incluyen formas reales de respuestas, límites, errores, preflight antes de
efectos, dist cambiado, recibo sin secretos y pérdida de respuesta sin replay.
Cuatro vectores oficiales de hash coinciden. Como control de valor se restauró
temporalmente la exigencia antigua de errors: las regresiones de publicación y
preflight fallaron exactamente en asset_check_http_200. Se restauraron los bytes
originales del arreglo y volvieron a pasar. Actionlint correcto; TypeScript y
builds de aplicación no se repiten por este cambio de operaciones.

## Pendiente y continuidad

Revisión/PR hacia development, promoción por PR a master, CI del SHA final y un
CD nuevo. No reejecutar CD43547384570, borrar su historial o aplicar otra vez la
operación completada. La aceptación final exige publicación canónica y respuesta
HTTPS de los recursos del mismo artefacto; no se atribuye ese resultado a este
diagnóstico. PWA conserva instalación física/standalone/auth como gates propios.
Impacto NodiaAI: ninguno en capacidades, herramientas, modelos o fichas aprobadas.
Los reportes y scripts intermedios quedan en output/ y .tmp/ ignorados, sin tokens.
