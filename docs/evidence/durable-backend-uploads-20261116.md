# Upload v2 y retención del inbox — 2026-11-16

## Alcance y estado

Implementación autorizada de [99§32](../mvp/99-production-deployment-and-cicd-plan.md#32-retención-automática-y-continuación-de-uploads--solicitud2026-11-16)
y [ADR104 propuesto](../architecture/decisions/ADR-104-durable-upload-continuation-and-incoming-retention.md).
El transporte v2 está adoptado mediante operación root y postchecks reales;
la aplicación conserva la entrega6ba. La adopción no ejecutó deploy/restart ni
acredita todavía transferencia/retención reales. No se repiten CI/CD43791568791,
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

- Corte actual `2309037cedf5e497f7736cece0512868d60b6146`, posterior a
  `4a5709629a708043e90a1a0958ffbfa58f3ba54f`. El job
  [Changes and pipeline checks133313305566](https://github.com/oscarvalenzuela25/Nodia/actions/runs/43871419155/job/133313305566)
  de [CI43871419155](https://github.com/oscarvalenzuela25/Nodia/actions/runs/43871419155)
  terminó correcto:173Node CI,15Node de políticas atómicas y206Python root
  con POSIX real en contenedor aislado, sin skips. CI43871419155 ya terminó
  completa correcta para2309037c, incluidas las apps. Es un resultado del corte
  exacto: no acredita la CI del gate adicional todavía sin commit.
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
- Gate adicional local del cliente: GitHub vuelve a comprobar CI de origen y
  master después de la transferencia y antes de registrar/enviar deploy,
  mediante callback cd-release→cd-vps. La regresión de master cambiado durante
  los bytes y72focales en tres archivos pasaron. Requiere commit/CI nuevos;
  no se asignan todavía SHA o run, ni se hereda el éxito de2309037c. Los cuatro
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
Current esperado6ba/c01; lectura SSH deployment_ready/blocked:false con API/worker
activos. La aplicación permanece en esa entrega; los cambios live de esta
intervención están acotados a los cuatro assets del transporte y su pin. Una
discrepancia requiere inspección, no sobrescritura.

El bundle histórico697171b00b30e79b7a07d125c47145e5fbc44d57c9d687f1cc0f052284fc7288
preparado para9533 fue sustituido y nunca aplicado. Su módulo upload tenía SHA256
`a90a168492d192f88283760570fe63a12757b3f6627b73feeb6c7503c7a9829e`;
los demás assets y el operador permanecen iguales. El JSON conserva ese objeto
histórico separado del bundle actual; ninguno acredita adopción.

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

El estado consolidado es `transport_adopted`; `delivery` permanece null. Faltan
CI del nuevo HEAD, promoción normal, transferencia y retención reales con sus
recibos y entrega nueva de aplicación. No cerrar OPS-001 por instalar el transporte
ni presentar el retorno de capabilities como un upload ejecutado. No se declara
cierre administrativo todavía: el acceso sigue en uso para pre/postchecks de la
intervención autorizada. El bundle697 histórico sigue sin aplicación.

Evaluación NodiaAI: infraestructura; ningún cambio de contrato funcional,
ownership, permisos, herramientas, modelo o inferencia. No se publican fichas ni
se aprueba el ADR por implementar o adoptar un transporte.
