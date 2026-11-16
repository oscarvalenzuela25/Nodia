# CD43791568791 — upload incierto y conciliación de lectura

Fecha inicial: 2026-11-15; cierre: **2026-11-16, America/Santiago**. Alcance:
conciliación del recibo fallido, inspección root, archivo/gateway y entrega nueva.
**CD43799433169 completado: backend y Client6ba publicados, SSH/HTTPS y10recursos
PWA verificados.** El recibo original de CD43791568791 conserva
`backend_upload_outcome_unknown`, sin reescritura/replay. El mantenimiento del
gateway no reinició servicios; el deploy nuevo normal sí activó otro release
y reinició conforme al protocolo. Los cortes siguientes conservan su historia.

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
- [Recibo durable de conciliación y operadores](deploy-upload-reconciliation-20261115.json):
  inventarios antes/después, referencias del ZIP archivado, refresh del gateway,
  hashes y estado final; `new_delivery.status:complete` en el cierre16nov.
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

## Primera lectura restringida, anterior a la autorización operatoria

La investigación principal obtuvo `deployment_ready`, `blocked:false`, API y
worker activos, con el release/fuente/árbol20ba/c01 anteriores. La consulta de
la operación5668d201c5bf57899b0aefe71f490ef7 devolvió `operation_not_found`.
Esto acredita ausencia de submission visible por ese ID, **no ausencia de ZIP,
partial o bytes recibidos**: las submissions se crean después del upload.

Hashes instalados observados en esa primera lectura:

- Gateway: `877fe548164b127d8f3820bafa4b0c44797a8a732a9a829c1c82de098b8e2ab8`.
- Receiver: `b2880ea7af6dd5e29d469d93b718a0a407ec5189488cce902150fa4ce2d75bd4`.

Ese gateway corresponde al original anterior a la corrección diagnóstica de99§30.
Cambiar el código del repositorio no lo instala automáticamente ni actualiza pins.
`sudo -n` no estaba disponible y no había sesión tmux administrativa; no se hizo
inventario root actual de incoming. No repetir ni presentar el inventario del
incidente previo como si describiera este intento.

No se solicitó un nuevo upload/deploy, reinicio, migración, restauración, cambio
de credenciales o publicación Pages durante esta conciliación. Servicios activos
no prueban modalidades IA, aceptación funcional de UI o ausencia de parciales.

## Interpretación del corte inicial

Confirmado: candidato y backend registrado tienen payload idéntico, pero fuente
y manifiesto distintos. No hay motivo para reescribir el SHA real como si el
candidato estuviera ejecutándose. En ese corte no estaban confirmados la causa del fallo de
recepción, inventario/cuota actual, existencia/tamaño de un posible parcial o
resultado local del receiver durante la transferencia.

La cuota de CD43754640640 no demostraba la de éste sin inspección nueva. Los plazos distintos
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

Este corte local precedió a la adopción operatoria del gateway descrita abajo.
Sin cambio UI/backend funcional. Esta promoción modifica
`ops/**`, por lo que su propio flag no permite omitir el backend. La entrega
normal que entonces faltaba se completó después y se registra en el cierre final.

Continuar desde99§31 tras la conciliación operatoria documentada abajo:
preflight de capacidad/protocolo instalado; journal consultable de upload y
reanudación de bytes sin replay de deploy; política de archivo/retención con
terminalidad, pins y referencias comprobados. Mantener recibos originales.

## Continuación operatoria autorizada — cuota y gateway adoptados

El usuario autorizó inspeccionar el upload actual y actualizar el gateway para
continuar con una entrega nueva, sin repetir operaciones inciertas. El
[recibo JSON consolidado](deploy-upload-reconciliation-20261115.json) conserva
los resultados y hashes de las fuentes operatorias. Los timestamps de archivo
02:55UTC y gateway02:59UTC del16 corresponden al15 de noviembre en Santiago.

Inspección root:9ZIPs/1.943.825.000bytes, 101.190.762.496bytes de disco libre y
las cinco ausencias objetivo verificadas (ZIP, partial, submission, request y
attempt del ID5668d201c5bf57899b0aefe71f490ef7). Con215.982.276bytes del artefacto
original14192845449, la recepción sumaría2.159.807.276bytes: excede en12.323.628
la cuota2.147.483.648. El receiver instalado aplica ese gate antes de crear los
paths de recepción; no se reenvió la subida para reproducir el rechazo. Esta
evidencia nueva cierra la ausencia de inspección del corte inicial. El error
original se conserva y no se inventa un nuevo estado remoto de esa operación.

El helper manual de archivo hizo dry-run y apply de la operación complete
`64c9a2f383709ee93ca5e584a9bc5b52`, fuente histórica0f69d505, distinta de current.
Movió exclusivamente el ZIP14094113962, 215.976.251bytes y SHA256
`1bdc378056085d6f0c89b7521aaf4d89113739d64adb01090e626eb1439e96d1`, a
`archived-incoming/server-43546497935-1/14094113962.zip`. Locks, referencias
complete, pins, originales e intent/recibo durables comprobados; sin borrar datos.
Incoming final:8ZIPs/1.727.848.749bytes. El archivo no libera disco ni establece
retención automática; sólo recupera cuota activa para una nueva entrega.

`refresh-deploy-gateway.py` revisado, SHA256
`193e286d0c40f871ca2470bd2c49bb339cc53cb86623fafdf5c7247800e3dd14`, pasó14pruebas
Linux. Receiver/gateway27, archivo16 y refresh previo10 dan67casos correctos,
sin skips. Revisión independiente sin hallazgos accionables. No se modificaron
los helpers anteriores o su política IO fijada857d9203… .

El dry-run/apply operatorio actualizó sólo gateway y su pin, con CAS del settings
completo e intent/originales durables. Resultado observado:

| Dato | Postcheck |
| --- | --- |
| Gateway adoptado | `6b794263ad129ff45ed8752374d55a9c69cde789ae903a33cc2097fd91406e9f` |
| Receiver intacto | `b2880ea7af6dd5e29d469d93b718a0a407ec5189488cce902150fa4ce2d75bd4` |
| Receiver-settings nuevo | `52768ca169a119594efbaf73374f547ea3857a65a68db769a7bff26e85fce59d` |
| Updater-settings intacto | `9556cd0353679c780df5e893221cd691d75c2c5695334bbb43bea411696725bb` |
| API / worker PID | `1018075` / `1018078`, conservados |
| Current | `backend-20baee851cc3-c01d5047410c`, conservado |
| SSH restringido nuevo | `deployment_ready`, `blocked:false` |

Inventario root posterior al gateway volvió a comprobar8ZIPs/1.727.848.749bytes,
pin52768ca1…, gateway6b794263…, receiverb2880ea7… y current/PIDs iguales;
el JSON durable conserva ese postcheck en `after_gateway`.

BLOCKED histórico y su ACK se preservaron: existencia bruta no equivale a bloqueo
efectivo; la política instalada verifica la conciliación. Ningún restart,
migración, upload/deploy antiguo o publicación acompañó este mantenimiento.

OPS-01 queda cerrado para esta conciliación y OPS-06 para la adopción diagnóstica
concreta; capacidad/versión del protocolo y ledger/reanudación siguen pendientes.
OPS-05 es parcial/manual. Este corte operatorio precedió al CI/CD nuevo del
apartado siguiente; los cambios ops impidieron omitir su primer backend aunque
el payload coincidiera. No relanzar CI43790183498, CD43791568791 o su operación.

## Cierre de entrega nueva — 2026-11-16 America/Santiago

[PR36](https://github.com/oscarvalenzuela25/Nodia/pull/36) integrada en development
b934b4ca y [PR37](https://github.com/oscarvalenzuela25/Nodia/pull/37) en master
`6ba2afb7d258548ca68c245fb8282759a30d0ce4`.
[CI PR36/43796059914](https://github.com/oscarvalenzuela25/Nodia/actions/runs/43796059914),
[CI PR37/43797447887](https://github.com/oscarvalenzuela25/Nodia/actions/runs/43797447887)
y [CI push master43798403214](https://github.com/oscarvalenzuela25/Nodia/actions/runs/43798403214)
terminaron correctamente. [CD43799433169](https://github.com/oscarvalenzuela25/Nodia/actions/runs/43799433169)
terminó con backend/Client `complete`, `failure:null` y `prior_cd_run:false`.

[Recibo oficial14196161759](https://github.com/oscarvalenzuela25/Nodia/actions/runs/43799433169/artifacts/14196161759):
ZIP SHA256`68e2f4a36bb412b785307c21a85db281f0afcc0ac32fbe295511217c07a92098`.
JSON extraído SHA256`849dfa7a6bffcecb4c9ebe44c3fcbd100ac9ea35224db59a9e8c49cc95c77261`.
El [JSON durable](deploy-upload-reconciliation-20261115.json) conserva el recibo
completo y los postchecks en `new_delivery`, aparte del intento anterior.

| Resultado | Identidad comprobada |
| --- | --- |
| Backend complete | operación`95a1e365c9b294773a082b2b7f30db7c` |
| Backend adoptado | `backend-6ba2afb7d258-c01d5047410c` |
| Árbol backend | `c01d5047410c7288a7d3fa47db35876ef7ebbd3d0c6bb94acdf51633a38f882d` |
| Artefacto backend nuevo | `14196015685`, ZIP215.982.269bytes |
| Client complete | Pages`bcf7cb3c-3bfd-4efd-93fb-fac3a3afbe8a` |
| Client adoptado | `client-6ba2afb7d258-bbb5c0a0fa85` |
| Árbol Client | `bbb5c0a0fa85a0c219516946378022d03cc7f33e86b9f941c16f0a9ecf509c47` |
| Artefacto Client nuevo | `14195228381` |
| Preflight Pages | 215assets/65faltantes |
| PWA público | 10recursos verificados,1intento |

Backend y Client conservaron los payloads del candidato fallido, pero esta es
otra intención/CI/artefactos/releases. No se reejecutó el CI43790183498, el
CD43791568791 o la operación5668d201c5bf57899b0aefe71f490ef7. Consulta final de
esa operación: `operation_not_found`; el recibo original unknown sigue intacto.

La promoción modificó ops y `server_content_equivalence_allowed` fue falso:
hubo upload y activación backend normales, con reinicio coordinado de servicios.
La conservación de PIDs1018075/1018078 del mantenimiento anterior no se atribuye
al deploy posterior. Código de equivalencia integrado; no-op remoto elegible aún
sin ensayar, sin otra entrega artificial para demostrarlo.

SSH restringido nuevo: `deployment_ready`, current6ba/c01, API/worker activos y
`blocked:false`. HTTPS con verificación TLS estándar: API200, endpoint anónimo
de autenticación401 y Client200; TLS no se deshabilitó. Estas pruebas no acreditan
login, inferencia IA, comprensión humana o teléfono físico.

Validación previa y CI:155Node Linux locales,67Python focales sin skips,
145comprobaciones root de políticas en CI y checks de aplicación correctos;
Client del CI push/master terminó3013pruebas/363archivos correctos. Postdeploy
conserva gateway6b794263… y receiverb2880ea7… con hashes exactos de la tabla anterior.
Las cifras son alcances distintos, no una cobertura total sumable del producto.

Cierre administrativo observado: sudo invalidado por el job
`close-upload-operator-2ec47231daf74e3499f3a826dbf735e7`, complete/exit0; sesión tmux
setup cerrada y comprobación SSH exit0. No se conservaron sesiones sudo/tmux
abiertas por este mantenimiento.

NodiaAI UX/UI queda entregado operativamente mediante este Client. NAIUX-07
conserva revisión humana/UI real y teléfono/teclado físico; sin inferencias o
aceptación humana nuevas. OPS-02/03/04 y política automáticaOPS-05 permanecen
pendientes. Documentación final por PR a development; no requiere repetir el
CD exitoso ni otra promoción productiva por registrar estos hechos.

## Impacto en contexto NodiaAI

Cambio de infraestructura de entrega, sin modificación de contratos funcionales,
ownership, grants, propuestas, confirmación, idempotencia, modelos o herramientas
NodiaAI. No requiere nuevas fichas funcionales ni publicación del corpus. No se
apruebaADR103 ni se heredan aceptaciones productivas por este análisis.

El cierre documental16nov actualiza las fichas draft existentes de producto y
compositor (revisiones79/15) para registrar la adopción operativa, conservando
unregistered/approval:null y los límites de pruebas humanas/inferencia. Knowledge
check/build finales correctos:95fuentes,51excluidas,44documentos/46fragmentos;
release publicable `9f7cb7e13becc051f1c90d6f2e0014eb18f78e4711a2a820971c38a2df4c77e8`
intacta. No se publica el borrador ni se atribuye aprobación por desplegar Client.
