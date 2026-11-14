# Pages: verificación pública con convergencia acotada — 2026-11-14

Continuación de [plan99§27](../mvp/99-production-deployment-and-cicd-plan.md#27-pages-publicado-verificación-pública-durante-la-transición--2026-11-14).
Rama `codex/fix-production-deploy`, desde development59118f99.

## Incidente y evidencia original

- [CI43620970891](https://github.com/oscarvalenzuela25/Nodia/actions/runs/43620970891),
  master `bb83fd262a1028f1c9a384a0bd0bb34346f1ff06`: correcto.
- [CD43622185230](https://github.com/oscarvalenzuela25/Nodia/actions/runs/43622185230),
  job132530137890: preflight correcto, backend completo y publicación Pages
  confirmada; después falla con `pwa_public_asset_digest_mismatch`.
- [Recibo original](https://github.com/oscarvalenzuela25/Nodia/actions/runs/43622185230/artifacts/14124423082):
  ZIP SHA256 `e1653a7c870b191ab1a4f9e840df7fbcad33dd1f4c5fd6e5b552e5a216a2e60e`,
  comprobado al descargar. Registra backend `complete`, operación
  `017edb5724bd1f86c6835130c7cc97cd`, y Client
  `published_assets_verification_failed`, deployment
  `16468e24-1873-4728-8c4a-58a353fa0ae1`, `deployment_requested:true`.
  No describe un upload rechazado ni autoriza repetir efectos.
- ZIP Client original14125035031, SHA256 oficial
  `dccae41dc34afdfccf8b46a8c8de343d7dafb2b97728597bec7be789eb2a0b31`,
  comprobado antes de extraer. Paquete
  `client-bb83fd262a10-d7e91a0f7e7a`, sin reconstruir aplicación.

La comprobación HTTPS posterior, sólo GET anónimos, valida los diez recursos
del `dist` de ese paquete: HTTP200, MIME permitido, tamaño y SHA256 exactos.
Incluye `/`:3595bytes, SHA256
`5f0f147407de2336393ac89f8f289234dd7b732286404505b7fcba022592c8eb`.
El verificador corregido devuelve `pwa_assets_verified:true`,
`pwa_assets_count:10`, `pwa_verification_attempts:1` en esa lectura posterior.

**Hecho:** el desacuerdo de bytes observado por CD ya no persiste; el artefacto
original está servido correctamente en la comprobación posterior.
**Diagnóstico:** el gate anterior exigía que el alias público ya coincidiera en
su primera lectura tras confirmar publicación por API. No toleraba una
transición del alias/edge. El HTML es el candidato principal, pero el error
histórico no conservaba el archivo afectado: no se atribuye esa ruta como un
hecho del log original ni se inventa cuánto tardó la convergencia.

[Cloudflare: Serving Pages](https://developers.cloudflare.com/pages/configuration/serving-pages/)
describe el servicio de assets y su caché;
[Get project](https://developers.cloudflare.com/api/resources/pages/subresources/projects/methods/get/)
describe la identidad canónica consultada por el gate. El plazo siguiente es
una política de Nodia, no un SLA de propagación atribuido a Cloudflare.

## Corrección y garantías

- La verificación posterior a publicación dispone de120segundos globales,
  medidos con reloj monotónico, hasta25intentos y pausas de hasta5segundos.
  Cada GET usa como timeout el menor de20segundos y el presupuesto restante;
  se comprueba el plazo también después de leer el cuerpo.
- Cada intento recorre el conjunto completo desde el manifiesto hasta el
  HTML. No acumula archivos aprobados en rondas distintas. Se mantienen
  HTTP200, MIME, límites de tamaño y SHA256 exactos del artefacto original.
- Las repeticiones son exclusivamente GET sin credenciales al origen fijo,
  con `cache:no-store` y redirecciones rechazadas. No hay upload, POST,
  recompilación, nuevo deployment ni llamada al updater desde este verificador.
- Un desacuerdo permanente conserva `published_assets_verification_failed`,
  deployment/source y `automatic_retry_allowed:false`. Ahora persiste la ruta
  pública de una lista cerrada y el contador acotado de comprobaciones.
  Los cuerpos remotos, URLs arbitrarias, tokens y mensajes de transporte no
  entran al estado ni al recibo durable.
- La validación local del perfil PWA ocurre antes del polling; un paquete
  inválido no se convierte en una espera de propagación.

## Validación

28pruebas enfocadas correctas: PWA, confirmación posterior y recibo. El conjunto
Windows pasa98casos de108;10requieren Linux y conservan su comprobación propia.
Regresiones de convergencia con HTML anterior, snapshots incompletos que no
pueden combinarse, contenido antiguo persistente, límite de lecturas y plazo
global, fallos HTTP/transporte/MIME/tamaño, conservación del deployment y
exclusión de datos privados. Revisión independiente del diff sin bloqueantes.

Comprobación final en WSL Ubuntu, filesystem nativo y Node24.22.2 Linux x64:
108/108correctas, sin fallos ni omisiones, incluido empaquetado y extracción
reales. Runtime descargado desde nodejs.org con SHA256 oficial comprobado;
dependencias de hashing/MIME fijadas, instaladas sin scripts. El snapshot
aislado incluye los consumidores reales que inspecciona el clasificador.
Control de valor en ese snapshot: limitar el bucle a una sola ronda hace
fallar las regresiones de convergencia/snapshot; se restauran los bytes exactos
del módulo y su suite vuelve a pasar. El checkout de trabajo no se mutó para
ese control. Diffcheck, UTF-8/LF y enlaces locales correctos.
GitHub Actions y el nuevo CD conservan resultados independientes.

## Continuidad y alcance

Promover por PR hacia development y después development→master. No reejecutar
CD43622185230 ni la operación backend completa; el recibo original permanece
intacto. Una comprobación HTTPS posterior correcta no reescribe el resultado
fallido de Actions. El cierre del arreglo requiere CI del nuevo SHA y un CD
nuevo con su propia evidencia.

No cambian assets, sesión, autenticación, backend, migraciones ni contratos de
producto. Impacto en fichas NodiaAI: ninguno; no se añaden capacidades,
herramientas, publicación de conocimiento o inferencias. Instalación física,
standalone y Android/iOS conservan sus verificaciones PWA separadas.
Scripts, ZIPs y logs intermedios quedan en `.tmp/` ignorado; no se versionan
credenciales o respuestas privadas.
