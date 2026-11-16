# CD43791568791 — upload incierto y conciliación de lectura

Fecha: 2026-11-15. Alcance: recibo oficial, lectura restringida del estado y
auditoría de código. **Causa del upload no confirmada; sin despliegue ni
publicación por esta intervención.** Este corte no sustituye el incidente de
cuota anterior ni declara adoptada la corrección candidata.

## Fuentes y preservación

- [CI43790183498, intento1](https://github.com/oscarvalenzuela25/Nodia/actions/runs/43790183498).
- [CD43791568791, intento1](https://github.com/oscarvalenzuela25/Nodia/actions/runs/43791568791).
- [Recibo oficial14193021375](https://github.com/oscarvalenzuela25/Nodia/actions/runs/43791568791/artifacts/14193021375),
  `delivery-receipt-43791568791-1`; SHA256 del ZIP original:
  `0a27792ae46256bc8d92763ed85fdd0fac38be741acf697a220632303baf1aea`.
- SHA256 de los bytes originales del JSON extraído:
  `e2fa05386d6528c97013bb538c1635be7dd933e32ac3194a89d021150912b59f`.
  Copias de trabajo en `output/deploy-43791568791/`, ignorado; esta evidencia
  consolida los hechos sin depender de ese temporal para continuar.
- [Incidente y reparación anteriores](production-upload-quota-20261115.md),
  [plan99§31](../mvp/99-production-deployment-and-cicd-plan.md#31-upload-incierto-y-equivalencia-acotada-de-payload--2026-11-15)
  y [ADR103 propuesto](../architecture/decisions/ADR-103-backend-payload-equivalence-with-preserved-source.md).

## Hechos del recibo oficial

| Dato | Valor conservado |
| --- | --- |
| Fuente candidata | `538c67f5ceed4de22cc4d47f629b0ab90ceacbf3` |
| Fuente backend observada | `20baee851cc36b01d51705b6af80913ccf757baa` |
| Release backend observado | `backend-20baee851cc3-c01d5047410c` |
| Release candidato | `backend-538c67f5ceed-c01d5047410c` |
| Árbol backend actual y candidato | `c01d5047410c7288a7d3fa47db35876ef7ebbd3d0c6bb94acdf51633a38f882d` |
| Artefacto backend original | `14192845449` |
| Digest ZIP backend | `sha256:7c7089187da9f30832b0bdb9351c9266dcb4e08a09aa74f187e38e91265a93cc` |
| Operación derivada | `5668d201c5bf57899b0aefe71f490ef7` |
| Último estado backend registrado | `upload_requested`, `deployment_requested:false` |
| Fallo | `backend_upload_outcome_unknown` |
| Reintento automático | `false` |

El preflight Pages pasó con215assets/65faltantes y sin upload/publicación
solicitados. El artefacto Client14192895814 tiene árbol
`bbb5c0a0fa85a0c219516946378022d03cc7f33e86b9f941c16f0a9ecf509c47` y release
`client-538c67f5ceed-bbb5c0a0fa85`. El recibo no acredita publicación de ese Client.

La proyección `baselines.server.status` del recibo dice `not_confirmed`, aunque
conserva release/fuente/árbol. No convertir esa etiqueta del serializer en una
observación de caída: la lectura SSH posterior tiene evidencia y alcance propios.

## Lectura restringida posterior

La investigación principal obtuvo `deployment_ready`, `blocked:false`, API y
worker activos, con el release/fuente/árbol20ba/c01 anteriores. La consulta de
la operación5668d201c5bf57899b0aefe71f490ef7 devolvió `operation_not_found`.
Esto acredita ausencia de submission visible por ese ID, **no ausencia de ZIP,
partial o bytes recibidos**: las submissions se crean después del upload.

Hashes instalados observados:

- Gateway: `877fe548164b127d8f3820bafa4b0c44797a8a732a9a829c1c82de098b8e2ab8`.
- Receiver: `b2880ea7af6dd5e29d469d93b718a0a407ec5189488cce902150fa4ce2d75bd4`.

El gateway corresponde al original anterior a la corrección diagnóstica de99§30.
Cambiar el código del repositorio no lo instala automáticamente ni actualiza pins.
`sudo -n` no estaba disponible y no había sesión tmux administrativa; no se hizo
inventario root actual de incoming. No repetir ni presentar el inventario del
incidente previo como si describiera este intento.

No se solicitó un nuevo upload/deploy, reinicio, migración, restauración, cambio
de credenciales o publicación Pages durante esta conciliación. Servicios activos
no prueban modalidades IA, aceptación funcional de UI o ausencia de parciales.

## Interpretación y pendientes

Confirmado: candidato y backend registrado tienen payload idéntico, pero fuente
y manifiesto distintos. No hay motivo para reescribir el SHA real como si el
candidato estuviera ejecutándose. No confirmado: causa concreta del fallo de
recepción, inventario/cuota actual, existencia/tamaño de un posible parcial o
resultado local del receiver durante la transferencia.

La cuota fue causa demostrada de CD43754640640, no de éste. Los plazos distintos
del emisor180s y receiver/gateway240s son un hallazgo de código, no causa probada
de este fallo. Tampoco `operation_not_found` autoriza reenviar bytes.

La corrección candidata propone omitir efectos backend sólo con elegibilidad
Git calculada y árbol completo idéntico conforme aADR103. No concilia el CD
fallido ni sustituye la reparación del transporte. Cambios `ops/**` de su primera
promoción impiden usarla para omitir su propia entrega. Pruebas/código/adopción
se registran por separado a continuación; no equivalen a adopción remota.

## Implementación y pruebas locales

Rama `codex/fix-deploy-upload-reconciliation`, desde developmente57e3151.
Selección calcula `server_content_equivalence_allowed` desde el baseline Server
completo. El transporte exige flag booleano estricto, árbol completo idéntico,
status saludable/baseline exacto e intención nueva permitida antes de omitir
upload/deploy. Resultado, gate Pages, recibo y resumen conservan fuente/release
reales y candidato separado. No cambia ni concilia el recibo histórico fallido.

- `node --test ops/ci/*.test.mjs`: Windows155casos,145correctos/10omisiones
  propias de plataforma; Linux nativo WSL con Node24.22.2:155correctos, sin
  fallos/omisiones. Copia de fuentes en filesystem Linux y fixtures sintéticas,
  sin red o credenciales productivas durante las pruebas.
- Regresiones: diff completo/renombre de fuera hacia docs, runtime/packager/CI
  aunque hubiera hash idéntico, flag ausente/falso/no booleano, hashes completos
  diferentes con prefijo común, baseline cambiado, operación previa y CD incierto.
- Integración focal: Pages acepta payload equivalente conservando SHA anterior;
  prueba rechaza evidencia incompleta/inconsistente antes de credenciales/HTTP.
  Recibo/resumen distinguen actual y candidato, eliminan campos privados y no
  habilitan reintento automático.
- Primeros ensayos focales detectaron dos limitaciones de fixtures (preflight
  fijado a CD previo y repositorio mínimo sin fuentes de dependencias); se
  corrigieron las fixtures, conservando los gates y assertions de producción.
  La suite final completa pasó en ambas plataformas.

Sin cambio UI/backend funcional ni adopción del gateway. Esta promoción modifica
`ops/**`, por lo que su propio flag será falso y necesita entrega normal después
de la conciliación operatoria. No se ha ejecutado nuevo CI/CD remoto.

Continuar desde99§31: conciliación operatoria exacta antes de nueva intención;
preflight de capacidad/protocolo instalado; journal consultable de upload y
reanudación de bytes sin replay de deploy; política de archivo/retención con
terminalidad, pins y referencias comprobados. Mantener recibos originales.

## Impacto en contexto NodiaAI

Cambio de infraestructura de entrega, sin modificación de contratos funcionales,
ownership, grants, propuestas, confirmación, idempotencia, modelos o herramientas
NodiaAI. No requiere nuevas fichas funcionales ni publicación del corpus. No se
apruebaADR103 ni se heredan aceptaciones productivas por este análisis.
