# Upload v2 y retención del inbox — 2026-11-16

## Alcance y estado

Implementación autorizada de [99§32](../mvp/99-production-deployment-and-cicd-plan.md#32-retención-automática-y-continuación-de-uploads--solicitud2026-11-16)
y [ADR104 propuesto](../architecture/decisions/ADR-104-durable-upload-continuation-and-incoming-retention.md).
Transporte v2 adoptado y entrega nueva95b completada por CD43879692520. La
transferencia real v2, retención automática y postchecks SSH/HTTPS verificados;
intervención administrativa cerrada. El mantenimiento de adopción conservó6ba/PIDs
sin deploy/restart; la entrega posterior sí activó el release normal95b. No se repiten CI/CD43791568791,
43799433169 ni sus operaciones; sus recibos mantienen su significado original.

V2 separa intención/transferencia de autorización de app. Identidad CI/artifact/
digest/tamaño, reserva total, consulta pura y CAS de offset+prefijo contra ZIP
original. Append8MiB máximo verifica EOF/hash antes de escribir; no trunca ni
sobrescribe. Finish hace fsync del propio archivo antes de rename NOREPLACE y
recibo durable; un destino ya completo puede sellarse sin otro rename.

Retención automática mínima del inbox: sólo ZIPs complete/no-current, todas las
referencias coherentes/completas, ningún parcial, pins y hashes verificados.
Intents de archivo se comprueban incluso cuando la cuota ya cabe. Archivo
reversible conserva bytes; **no libera disco físico ni aplica una purga global**.
Si falta headroom o no hay candidatos seguros, falla cerrado.

La barrera de un refresh de transporte incompleto impide nuevas mutaciones
cuando el receiver v2 está activo. Antes de sustituir el receiver, las primeras
dos escrituras sólo añaden módulos: el transporte anterior conserva sus bytes/
pins y no ofrece v2. Ambas fases se realizan bajo locks; ninguna se presenta
como una transacción atómica de cinco archivos.

## Verificación e integración de código

- Corte final `0c30a767f3deab17d361fcf8db5fe5c86cfb027c`,
  [CI43873970183](https://github.com/oscarvalenzuela25/Nodia/actions/runs/43873970183)
  completa correcta:174Node CI,15Node de políticas y206Python root sin skips,
  además de las apps. Incluye el gate de revalidación posterior a transferir.
- Corte anterior `2309037cedf5e497f7736cece0512868d60b6146`, posterior a
  `4a5709629a708043e90a1a0958ffbfa58f3ba54f`. El job
  [Changes and pipeline checks133313305566](https://github.com/oscarvalenzuela25/Nodia/actions/runs/43871419155/job/133313305566)
  de [CI43871419155](https://github.com/oscarvalenzuela25/Nodia/actions/runs/43871419155)
  terminó correcto:173Node CI,15Node de políticas atómicas y206Python root
  con POSIX real en contenedor aislado, sin skips. CI43871419155 ya terminó
  completa correcta para2309037c, incluidas las apps; conservada como corte
  anterior, distinto de la CI final0c30. Los assets root del bundle siguen iguales.
- El módulo de upload tiene27casos. El borde final reconoce un ZIP archivado
  aunque el upload todavía carezca de recibo propio, conservando su identidad
  y estado archived; nunca vuelve a receiving/offset0 ni inicia otra transferencia.
- Corte histórico `9533bc9b5fb2713d33c510facc0fb60f4d9ce204`,
  [PR39](https://github.com/oscarvalenzuela25/Nodia/pull/39),
  [CI43867659803](https://github.com/oscarvalenzuela25/Nodia/actions/runs/43867659803)
  completo correcto. Su job133300276596 probó173Node CI,15Node de políticas y
  204Python root sin omisiones; esos204 incluían archivo30, recepción25 y
  refresco19. Esta evidencia se conserva y no sustituye la del candidato actual.
- Windows173Node:163correctos/10omisiones POSIX en el corte local histórico.
  La revisión independiente corrigió admisión legacy sin reservas, guard de
  archivo saltado sin presión, ausencia de operación demasiado permisiva,
  códigos/límite de intento y fsync final tras un append interrumpido.
- El ajuste del cliente de4a570962 valida identidad, cursor/hash y origen de los
  ACK completos y evita consultas SSH redundantes. Sólo una respuesta ambigua
  requiere consultar antes de continuar. El fixture normal con seis bloques
  baja18→10llamadas; no se atribuye mejora productiva de latencia o throughput.
  Las lecturas admiten máximo8intentos con espera, bajo presupuesto común de
  256llamadas por transferencia, sin replay de aplicación. Sus regresiones
  forman parte del job actual confirmado.
- Gate del cliente: GitHub vuelve a comprobar CI de origen y master después
  de la transferencia y antes de registrar/enviar deploy, mediante callback
  cd-release→cd-vps. La regresión de master cambiado durante los bytes y72focales
  pasaron; ahora está committed y validado en CI0c30/43873970183. Los cuatro
  assets root y el operador31617 no cambiaron por este gate del cliente.
- WSL no inicia por `ERROR_NO_SYSTEM_RESOURCES`; Docker local no está activo.
  No se reiniciaron procesos/servicios del usuario ni se usó producción para
  ejecutar tests. La validación POSIX actual proviene del contenedor root de CI;
  no queda pendiente por el fallo de WSL local.
- UTF-8/LF, AST y diff correctos. El IO compartido histórico conserva SHA256
  `857d9203ea243f2049ffbf55864f35a3853238d18b3a086b803c41989289bc97`.
  El operador previo de gateway conserva su candidato histórico6b794263; la
  fixture versionada captura sus bytes originales del commit6ba2afb7, sin
  reescribir hashes o evidencias para acomodarlos al protocolo nuevo.

## Bundle revisado y siguiente gate

Bundle final del candidato2309037c copiado a staging privado
`/home/nodia-admin/nodia-setup/backend/upload-v2-2309037c`: siete archivos con
hash coincidente (cuatro assets, manifest, operador e IO857). Este bundle ya se
aplicó mediante el operador revisado. El objeto exacto del manifest se conserva
en el JSON compañero;
su preparación local usa `output/durable-uploads-20261116/bundle/upload-transport.json`.
Los hashes actuales son:

| Asset | SHA256 |
| --- | --- |
| receiver | `cc71b34bbdf3d8e4603aaaecf9161d62110f01ac33d202ac61eb5f9b9d37d6d3` |
| gateway | `b37048070631d3705c2946fb70c15e4fb2483edd412655326a49db80c5cda7fb` |
| módulo upload | `25bc905248373aacd250f086ebf8d00e25df67d53612b0d8da39701057066c68` |
| archivo | `3a0f596d20d6df5b3b88f680dee5c6f2c63d8792bb4c1d1ce56c2d05b7f7d968` |

Manifest final SHA256`5d5a150ba591514e953269d1f72ef463bef9f7aee10cd670aee716e3e57df2e4`;
operador`31617ac07563b9da099798d6a8615d8db3c26a6dc9133f3e862def9e5560596d`.
CAS esperado de receiver-settings:
`52768ca169a119594efbaf73374f547ea3857a65a68db769a7bff26e85fce59d`.
Current esperado por el mantenimiento de adopción:6ba/c01, deployment_ready/
blocked:false y API/worker activos. Ese mantenimiento sólo cambió los cuatro
assets del transporte y su pin; la entrega posterior95b se documenta por separado.
Una discrepancia requiere inspección, no sobrescritura.

El bundle histórico697171b00b30e79b7a07d125c47145e5fbc44d57c9d687f1cc0f052284fc7288
preparado para9533 fue sustituido y nunca aplicado. Su módulo upload tenía SHA256
`a90a168492d192f88283760570fe63a12757b3f6627b73feeb6c7503c7a9829e`;
los demás assets y el operador permanecen iguales. El JSON conserva ese objeto
histórico separado del bundle actual; la adopción de este último tiene su
recibo independiente siguiente.

## Adopción operativa comprobada

Dry-run `upload-v2-dry-run-cbaa60893aa94ff6aa93308974eb18ff` y apply
`upload-v2-adopt-597438dcc5e54144bcde5c0765727373`, ambos complete/exit0.
El recibo original de apply terminó `2026-11-16T13:08:12.635460+00:00`:
`upload_transport_refreshed`, transport_changed/capabilities_verified true,
deployment_requested/deployment_performed/application_services_restarted false.
El JSON compañero conserva ambos recibos, el hash de sus archivos fuente y los
postchecks; no depende únicamente de los logs temporales.

- Receiver-settings:52768ca1→
  `206fcbd95a997babbf39094fef9eb08b51c3ba206d281ccc7df0e19da16162ee`.
- Updater-settings intacto:
  `9556cd0353679c780df5e893221cd691d75c2c5695334bbb43bea411696725bb`.
- Evidencia de conciliaciones intacta:
  `7ae2f6080dd1946b271d4766b63606f77e1c1f825324ae9efababd1a881fba4a`.
- Current6ba/c01 y PIDs API1076642/worker1076645 iguales antes/después;
  mantenimiento sin reinicios o deploy. Estado por SSH nuevo deployment_ready,
  blocked:false y ambos writers activos.
- Capabilities por otra conexión SSH, posteriores al recibo del refresh,
  aceptadas también por el validador Node: protocolo2, máximo8388608bytes/bloque,
  upload805306368bytes, cuota2147483648bytes/10slots. Observación lógica
  1943831018bytes/9slots y disco libre99803844608bytes. Son mediciones de ese
  postcheck, no cifras por defecto o disponibilidad futura supuesta.

SHA256 del stdout original del apply:
`767267ca688022cd9d7665f75e85136c18916af8fe88d7985e6892636ba82bcd`.
SHA256 del archivo de capabilities por SSH nuevo:
`5284e099cafff1e0aa1baa3ea2d4a315d966e495c96c63c153e791931fae22c3`.
El digest de capabilities internas del recibo corresponde a su propia consulta;
no se reemplaza por el de una lectura posterior con métricas de disco distintas.

La adopción queda acreditada por sus propios recibos; la entrega nueva posterior
se acredita abajo. No cerrar OPS-001 por instalar el transporte ni presentar el
retorno de capabilities como prueba de retención automática. La prueba root y
el cierre administrativo posteriores se registran al final. El bundle697
histórico sigue sin aplicación.

## Promoción e inventario anterior a nuevos bytes

[PR39](https://github.com/oscarvalenzuela25/Nodia/pull/39) integrado en development
`363365c58bc9925d3fc8c28cb2419c530f8e81f5`.
[PR40 development→master](https://github.com/oscarvalenzuela25/Nodia/pull/40)
integrado con merge `95b6189303df939c901ea6afe64d531180a441c8`.
[CI43876278159](https://github.com/oscarvalenzuela25/Nodia/actions/runs/43876278159)
completa correcta, incluidas las apps y las comprobaciones agregadas de CI.
[CI push/master43878077045](https://github.com/oscarvalenzuela25/Nodia/actions/runs/43878077045)
completa correcta, todos los jobs. [CD43879692520](https://github.com/oscarvalenzuela25/Nodia/actions/runs/43879692520)
completo correcto; entrega y recibo propio descritos abajo. Sin replay de CI/CD
anteriores ni dispatch CD manual.

Inspección root de sólo lectura
`upload-v2-promotion-prestate-5ec1cae904044a868e58d074d1301138`, complete/exit0:
9ZIPs/1943831018bytes, dos archivos históricos con recibo y ningún ledger de
upload. Current6ba/c01 y PIDs1076642/1076645 iguales; receiver-settings206fcbd9
y los cuatro assets adoptados coinciden. Disco libre99803340800bytes en esa
lectura, independiente de la métrica del postcheck anterior. El JSON conserva el
inventario íntegro y SHA256 de su stdout. No se movió otro ZIP ni se inició una
transferencia por esta inspección; los dos archivos previos no acreditan una
retención automática nueva. Es el inventario previo al CD posterior y no se
reescribe para simular un estado final.

## Entrega nueva completa y postchecks

Origen `95b6189303df939c901ea6afe64d531180a441c8`,
[CI43878077045](https://github.com/oscarvalenzuela25/Nodia/actions/runs/43878077045)
y [CD43879692520](https://github.com/oscarvalenzuela25/Nodia/actions/runs/43879692520)
completos correctos. [Artefacto de recibo14232226510](https://github.com/oscarvalenzuela25/Nodia/actions/runs/43879692520/artifacts/14232226510),
ZIP SHA256`a88d02158283b224cc17db07b9b843fb6e1f34cd6157cd751e6c29c9677c024b`.
El JSON consolidado conserva el recibo original completo, sin corregir sus campos,
y SHA256 del archivo fuente:
`c2af9081048e3ff2a7b16f63002352ef70ceb03053c7a2aa219b8aabf6f23fa6`.

- Backend complete, operación`f9a133f56fb74ea337256b530602c073`; upload v2
  `bf288031e60fe4c529b85a14e55547ad20cebbafc435163a07e1a0325fceec20`,
  215982275bytes, fase verified. `upload_recovered:false`: no se inyectaron
  fallos en producción ni se afirma una recuperación remota ejercitada.
- Release`backend-95b6189303df-c01d5047410c` y Client95b/bbb5; árboles iguales
  a la entrega anterior, procedencias nuevas explícitas. Backend sí registra
  deployment_requested/deployment_performed true; no confundir esta entrega
  normal con el mantenimiento sin restart de adopción del transporte.
- Client complete, Pages`01ee1156-11c2-4eac-a07d-07e02ef8a245`;215assets y0faltantes
  en preflight, PWA10recursos verificados en1intento. Failure null y prior_cd_run false.
- SSH nuevo: deployment_ready, current95b/c01, blocked:false y API/worker activos.
  Capabilities v2 y cuatro hashes coincidentes; métrica lógica1943826973bytes/
  9slots, disco libre98418917376bytes en ese postcheck.
- HTTPS API200, auth/me401 y Client200, todos con verificación TLS0. El JSON
  conserva observaciones exactas y sus hashes; SHA256 de su archivo fuente:
  `4871625fd5018479a6f147f84f94414b63bb492b23c10d5d80919697469c9e40`.

## Retención automática verificada y cierre administrativo

Job root `upload-v2-final-proof-close-66706cce6b8940778280effbd41f7fb0`,
complete/exit0; script revisado SHA256
`d573d1d601096b01ca193a0aba2e5db405833dbfe34d241bc647b84c64d06bb2`.
Su stdout contiene tres JSON completos (inventario, prueba con recibos y
sudo invalidado), conservados íntegros en el JSON compañero. SHA256 del stdout:
`6630b80a591db2f63fb864eb31e95226b233bc140409e5f04e35d88b7b6c2803`.
La lectura root resuelve el bloqueo previo de autenticación y acredita:

- Un archivo automático nuevo, operación`78663186e98d9775592edc22455c47d2`,
  artifact14127640136 de source`307ffbccc5101b563a97f8e5c52d518262cd3a29`.
  ZIP215986320bytes, SHA256
  `baf3806dd0fb74b97818b24fe020450b0962d9ddcc30eaea2a54f2e802400723`;
  receipt SHA256`76a4cfbb5b1c7ee8556d95c39965418c593d04f733513b210cbe7903c3669ee3`.
  Bytes archivados y referencias originales verificados, sin cambios en éstas.
  El recibo registra current6ba al archivar antes del deploy normal95b y conserva
  deployment_requested/application_services_restarted false.
- Ledger bf288031… verified para215982275bytes; recibo e intent originales
  completos/digests conservados. SHA256 del recibo
  `a89640b6dd0b3ea6b6b307e06cdac5c2ea4fdbeda2ad6de44c720ce9cc8274d5`,
  intent`949462eaef9b80920f6121b15412de38b8a58a8a84302762811b6dbc72672f67`.
  ZIP completo verificado y parcial ausente.
- Inventario final9ZIPs/1943826973bytes, tres archivos (dos históricos y uno
  automático nuevo) y un ledger. Current95b/c01, API1168037/worker1168046 running;
  settings206fcbd9 y los cuatro assets intactos. Conciliaciones SHA7ae2f608…
  sin variación; operación histórica5668d201… sigue ausente en attempts,
  submissions y requests: sin replay.
- `sudo_timestamp_invalidated:true` dentro del mismo job. Después, cierre de
  tmux setup exit0; has-session exit1 con no server running. SSH nuevo después
  del cierre: deployment_ready95b/c01, blocked:false, API/worker activos.

Estado `v2_delivered_and_administratively_closed`: recepción normal, archivo
reversible automático y cierre administrativo comprobados. Fallos y reanudación
probados en CI aislado; esta transferencia productiva fue normal (recovered:false).
El archivo libera cuota del inbox, no espacio físico. Queda por especificar la
política de disco físico/offload y retención global de releases/diagnósticos. ADR104 sigue propuesto; ningún
success operativo aprueba documentos, genera inferencia IA o acepta una UI humana.

Evaluación NodiaAI: infraestructura; ningún cambio de contrato funcional,
ownership, permisos, herramientas, modelo o inferencia. No se publican fichas ni
se aprueba el ADR por implementar o adoptar un transporte.
