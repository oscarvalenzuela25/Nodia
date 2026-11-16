# Upload v2 y retención del inbox — 2026-11-16

## Alcance y estado

Implementación autorizada de [99§32](../mvp/99-production-deployment-and-cicd-plan.md#32-retención-automática-y-continuación-de-uploads--solicitud2026-11-16)
y [ADR104 propuesto](../architecture/decisions/ADR-104-durable-upload-continuation-and-incoming-retention.md).
La entrega previa6ba permanece completa. No se repiten CI/CD43791568791,
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

## Verificación local e integración de código

- Primer corte `9533bc9b5fb2713d33c510facc0fb60f4d9ce204`,
  [PR39](https://github.com/oscarvalenzuela25/Nodia/pull/39),
  [CI43867659803](https://github.com/oscarvalenzuela25/Nodia/actions/runs/43867659803).
- Job `Changes and pipeline checks`133300276596 correcto:173Node CI,15Node de
  políticas atómicas y204Python root en contenedor aislado, sin omisiones. Los
 204 incluyen archivo30, recepción25 y refresco19, además de regresiones previas.
- Windows173Node:163correctos/10omisiones POSIX. Revisión independiente encontró
  y corrigió admisión legacy sin reservas, guard de archivo saltado sin presión,
  ausencia de operación demasiado permisiva, códigos/límite de intento y fsync
  final tras un append interrumpido. Las regresiones se incorporaron al corte CI.
- Corte posterior del cliente: los ACK completos siguen validando identidad,
  cursor/hash y origen, evitando consultas SSH redundantes. Sólo las respuestas
  ambiguas requieren consultar antes de continuar; los reintentos son lecturas
  acotadas con espera, nunca submit.60pruebas focales correctas; requiere su CI
  final. El caso sintético normal baja de18a10llamadas con seis bloques; no se
  atribuye ese resultado a latencia o throughput productivos.
- WSL no inicia por `ERROR_NO_SYSTEM_RESOURCES`; Docker local no está activo.
  No se reiniciaron procesos/servicios del usuario ni se usó producción para
  ejecutar tests. La validación POSIX anterior proviene del contenedor del CI.
- UTF-8/LF, AST y diff correctos. El IO compartido histórico conserva SHA256
  `857d9203ea243f2049ffbf55864f35a3853238d18b3a086b803c41989289bc97`.
  El operador previo de gateway conserva su candidato histórico6b794263; la
  fixture versionada captura sus bytes originales del commit6ba2afb7, sin
  reescribir hashes o evidencias para acomodarlos al protocolo nuevo.

## Bundle revisado y siguiente gate

Copiado a staging privado, sin aplicación root todavía:

| Asset | SHA256 |
| --- | --- |
| receiver | `cc71b34bbdf3d8e4603aaaecf9161d62110f01ac33d202ac61eb5f9b9d37d6d3` |
| gateway | `b37048070631d3705c2946fb70c15e4fb2483edd412655326a49db80c5cda7fb` |
| módulo upload | `a90a168492d192f88283760570fe63a12757b3f6627b73feeb6c7503c7a9829e` |
| archivo | `3a0f596d20d6df5b3b88f680dee5c6f2c63d8792bb4c1d1ce56c2d05b7f7d968` |

Manifest SHA256`697171b00b30e79b7a07d125c47145e5fbc44d57c9d687f1cc0f052284fc7288`;
operador`31617ac07563b9da099798d6a8615d8db3c26a6dc9133f3e862def9e5560596d`.
CAS esperado de receiver-settings:
`52768ca169a119594efbaf73374f547ea3857a65a68db769a7bff26e85fce59d`.
Current esperado6ba/c01; lectura SSH nueva deployment_ready/blocked:false con
API/worker activos. Una discrepancia requiere inspección, no sobrescritura.

Primero autenticación administrativa privada/dry-run/adopción/postcheck de
capabilities y aplicación intacta; después promoción y CI/CD nuevos. No se
declara aún instalado v2, retención real ejecutada o reanudación remota probada.

Evaluación NodiaAI: infraestructura; ningún cambio de contrato funcional,
ownership, permisos, herramientas, modelo o inferencia. No se publican fichas ni
se aprueba el ADR por implementar o adoptar un transporte.
