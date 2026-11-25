# Nodia CV Agentic — línea base en la VM

Fecha 2026-11-25, America/Santiago. Laboratorio Hyper-V Linux
`nodia-vps-lab`, identificado por SSH estricto. Rama `codex/nodia-cv-agentic`,
merge `eb3faa8d22a276b2017d1c3a17248ad0d1fbe3ae` con
`development` en `e7c4432648e4b4e77d907f673bb137d8a5be3ce9`.
[Plan113 §17](../mvp/113-nodia-cv-implementation-plan.md#17-continuación-de-cv-03--generación-agentic--2026-11-25).

## Observaciones

| Comprobación | Resultado |
| --- | --- |
| Catálogo del binario fijado por la rama | Codex Linux x64 `0.171.0` devolvió 11 modelos con `model/list`, incluido `gpt-6.2-sol`. Publicó `low`, `medium`, `high`, `xhigh`, `max` y `ultra`. Prueba en la VM con perfil desechable y red aislada. |
| Servicio activo del laboratorio | API con paquete Codex `0.161.0-linux-x64`. En la base de laboratorio, OpenAI conexión `1` tenía Agentic habilitado y el modelo solicitado ausente del catálogo guardado. El host nativo configurado para Teacher existía en disco. |
| Sesión de la conexión `1`, primera lectura | El sondeo de operador devolvió `authenticated:false` y `codex_session_required`. Se ejecutó fuera del namespace de montajes de la API y no pudo acceder a su alias del llavero. La lectura posterior en el namespace correcto confirma la sesión existente. |
| Elegibilidad de Nodia CV | La clase compilada del piloto CV-06 recibió `1 / agentic / gpt-6.2-sol / high`. Devolvió `eligible:false`, `qualified:false`, `configured:null`, `checked_at:null` y `agentic_transport_unavailable`. La comprobación de configuración devolvió HTTP 503 como excepción de servicio. |
| Intercambios y cierre | Cero despachos. SQL en modo de sólo lectura reportó cero operaciones y cero intercambios de CV antes y después. La base del release activo carecía de la tabla de generaciones de CV. Las pruebas de CV usaron la clase compilada del piloto en la misma VM. |

El binario temporal se extrajo del paquete `@openai/codex` para Linux x64 tras
verificar el SHA-512 del lockfile. SHA-256 del ejecutable:
`b76a027d6b210f9a8da7aaf321dd235c700f0ef7a794d4a5314b9af6c134f0f0`.
La prueba aislada usó `initialize`, `config/read` y `model/list`.
Para la cuenta existente se usó el lease de perfil y se comprobó su liberación.
La prueba cerró los procesos y retiró el binario de prueba. API, worker,
keyring y nginx quedaron activos. La ventana no incluyó llamadas de generación.

## Actualización a Codex 0.171.0 y catálogo autenticado

El binario Linux x64 del lockfile se activó en el laboratorio. El paquete
anterior `0.161.0` se conserva bajo el montaje de sólo lectura
`/opt/nodia/nodia-server/node_modules/@openai/codex-linux-x64`. Se usó
SquashFS por el espacio libre del disco. La imagen ocupa 170741760 bytes y
su SHA-256 es `cdaf16748c7392bf3164101b17a6729bbdb24c62bd8f86ed9dc00eda264007b1`.
El binario montado conserva el SHA-256 del ejecutable citado arriba.
API y worker usan la misma dependencia nativa. El host de Teacher y el
release de Server se conservaron. API y Client devolvieron HTTP 200.

El sondeo sucesor se ejecutó como usuario de servicio dentro del namespace
de montajes de la API, con el alias de llavero accesible y desbloqueado.
`account/read` confirmó `authenticated:true` para la conexión OpenAI `1`.
`model/list` devolvió diez modelos y confirmó la selección exacta
`gpt-6.2-sol` con `high` (Alto). También publicó `low`, `medium`, `xhigh`,
`max` y `ultra`. La cuenta existente siguió conectada.

El sondeo liberó el perfil y cerró Codex. `lastInferenceAt` quedó en
`null`. La consulta de sólo lectura registró 68 operaciones acumuladas
antes y después, sin operaciones pendientes de ACK y con los tres slots
libres. El catálogo fue una lectura en vivo. La generación Agentic de CV
sigue pendiente del transporte y su aceptación propia.

Para revertir en el laboratorio, detener `nodia-ai-worker.service` y
`nodia-api.service`, deshabilitar y desmontar la unidad del paquete
obtenida con `systemd-escape --path --suffix=mount` sobre la ruta de
montaje, y retirar esa unidad y los dos drop-ins
`91-cv-agentic-codex-package.conf`. Recargar systemd, iniciar ambos
servicios y verificar el binario `0.161.0` y la salud HTTP. El perfil y
la base de datos se conservan.

SHA-256 del artefacto CV-06 `server-final.tgz`:
`df27f133a5c8b5023b2b03244603845e9b7a78b8239773d7c7617c5365e6c2ea`.
SHA-256 de `nodia-cv-selection.service.js` en ese piloto:
`8aaa9d26df14f3aebf2791f6c98c7d19cae19e23bc6ea7e7fe3b5cd8eb28be07`.
La selección, el worker y el store comprobados conservan el código fuente de
`a08ed9d5` en la rama actual. Pasaron las diez pruebas focales de selección
y motor y `knowledge:check`.

## Puntos de integración para el paso 2

| Frontera | API key actual | Trabajo para CV Agentic |
| --- | --- | --- |
| Configuración y calificación | `NodiaCvSelectionService.configure` resuelve la clave por selección explícita y liga la calificación a CV. | Resolver la observación de sesión y catálogo mediante el transporte nativo. Amarrar calificación a la tupla y al recibo propio de CV. |
| Admisión | El caso de uso valida el perfil y admite la intención. `NodiaCvGenerationStore.hold` reserva el slot, fence y un intercambio para el dueño `cv`. | Conservar dueño, perfil y presupuesto. Usar identidad del recurso Agentic y persistir su descriptor antes del envío. |
| Despacho | `NodiaCvGenerationWorker.execute` llama a `ApiTextGenerationService` después de fijar autoridad y el intercambio. | Agregar la ruta nativa de texto de CV con selección exacta y entregar la salida al verificador actual de CV. |
| Cierre, conciliación y ACK | El worker registra retorno del ejecutor y concilia usando `api_owner_identity`. | Añadir prueba nativa, reconciliación y ACK ligados a CV. Preservar el resultado remoto incierto sin reenvío. |

La migración `1793980000000` admite dueño `cv` con FK compuesta y modo
`agentic` en `selection_snapshot`. La migración `1793600000000` ya añade
`agentic_transport_descriptor` y `agentic_acknowledged_at`, pero el CHECK
`ck_teacher_agentic_descriptor` solo permite descriptor para `teacher`.
La tabla `ai_generation_agentic_qualifications` también se limita a Teacher.
Si se reutilizan esas columnas, hace falta una rama de validación por dueño
en una migración nueva. El recibo y la calificación de CV deben conservar su
identidad propia.

El candidato para el siguiente corte es un transporte textual restringido que
reutilice la sesión y las primitivas nativas de Codex. El laboratorio ya
acredita la pareja modelo/esfuerzo en su catálogo autenticado y reproduce
el bloqueo de CV.

## Paso 2. Transporte y pruebas sintéticas

| Frontera | Comportamiento en la rama |
| --- | --- |
| Selección | Lee la configuración, observa sesión y catálogo con el lease común y vuelve a comprobar la generación de configuración. Exige el modelo exacto, su esfuerzo y la política Agentic de la conexión. La observación declara `qualified:false`. |
| Identidad | El descriptor `cv-agentic-text/1` liga actor, perfil y revisión, generación e intento, huella del payload, recurso, configuración, sesión y selección. También liga propósito, prompt, esquema, política y runtime. El recibo valida esa identidad exacta y la huella de la respuesta. |
| Envío y cierre | El supervisor verifica el host y usa el perfil compartido bajo exclusión. La barrera se ejecuta antes de escribir una sola trama. Se verifican binding, nonce, huella de texto y cierre del grupo. La salida separa rechazo previo, resultado remoto incierto, respuesta fuera del esquema y borrador válido. La barrera terminal precede a la liberación del perfil. |
| Datos | Se usan el minimizador y el verificador existentes de `cv-tailoring/1`. El host recibe sólo texto. Su protocolo limita el prompt a 128 KiB y la respuesta a 32 KiB. Carece de herramientas, adjuntos y entornos, y bloquea continuaciones y reintentos. |

El adaptador privado usa el protocolo compilado de
[teacher-codex-host](../../nodia-server/native/teacher-codex-host/README.md).
CV conserva sus propios descriptor y recibo. El binario restringido se
compila contra Codex Core `0.161.0` en
`979011409de0a60b52f179721948e65531d26144`. Su [catálogo incorporado](https://github.com/openai/codex/blob/979011409de0a60b52f179721948e65531d26144/codex-rs/models-manager/models.json)
carece de `gpt-6.2-sol`. El host consulta el catálogo inicial y rechaza
metadatos de respaldo antes de generar. El catálogo de sesión confirmado en
`0.171.0` y la huella del host actual acreditan fases distintas. El paso 3
debe preparar una versión restringida que resuelva la selección exacta,
además de integrar la cola, las barreras persistentes y la recuperación.

- **TypeScript.** 111 pruebas en siete suites. El proceso sintético
  cubre una habilidad respaldada y una brecha, identidades cambiadas,
  rechazo de admisión, una sola trama, salida inválida, aborto y cierre
  sin prueba. Pasaron lint focalizado, formato y compilación de Server.
- **Rust.** 11 pruebas del host en Docker `--network none`, con
  `cargo test --locked --offline` y proveedor sintético de loopback.
  Comprueban herramientas vacías, selección exacta, un único envío y cierre.
- **Regresión de CV.** PostgreSQL 16 desechable con transporte API key
  sintético. Cumplió calificación acotada, generación, revocación,
  recuperación y purga. El acceso público Agentic siguió bloqueado
  antes de la admisión y con cero despachos. La base se descartó al terminar.

La entrega del paso 2 conserva la UI y el despliegue del laboratorio.
Durante la validación se ejecutaron cero inferencias reales.

## Paso 3. Host, cola y recuperación en PostgreSQL aislado

El host de CV se compila con la feature `cv` del host restringido, con
protocolo y huella propios. Usa Codex Core del commit fijado y recibe
sólo el `ModelInfo` exacto del CLI oficial `0.171.0`. El Server exige
la intersección con el catálogo autenticado de la conexión y su política.
El host vuelve a comprobar el ID y esfuerzo y rechaza cualquier sustitución.
El carril Teacher conserva su capacidad y configuración.

El sondeo del CLI Linux de la VM con perfil temporal y espacio de red
aislado confirmó `gpt-6.2-sol` y `high`. El registro exacto de metadatos
ocupa 90028 bytes y tiene SHA-256
`bc5d36fea1b17e349916309743eb51787953bd5d883e5e93905eea7a45c94a0e`.
El binario del CLI tiene SHA-512
`52f18aa24deab36a9c8f12983fac45e859710db3642b9af79544e1afb7c9c35ac978767a98b7e8481cda15e2c0d9dad787341227524adb88623cc609e087b7f6`.
La consulta leyó el catálogo incorporado, sin usar una cuenta ni ejecutar
generaciones. La observación autenticada del catálogo corresponde al paso 1.

El [empaquetado reproducible](../../nodia-server/native/teacher-codex-host/README.md#private-protocol)
generó el candidato Linux x64 de desarrollo `nodia-cv-codex-host-cee7aca95a10ef68`
con 238776160 bytes, GLIBC máxima 2.34, SHA-256
`cee7aca95a10ef6848ca721856113d69315f53575a59436fc037ecadcf1563f0`
y SHA-512
`99c618bc6c99aec7f7f9334125d3794457224e3810c97702054811eff614ba451dfdb08d0b13e00766f60129e7949694ac681e5494f595fe1e3432a814896c31`.
Binario y manifiesto quedan en `nodia-server/native/teacher-codex-host/.cache/artifacts/cv/dev/`.

| Comprobación | Resultado |
| --- | --- |
| Aislamiento nativo | 24 pruebas entre CV y Teacher en Docker sin red externa. Codex Core emitió un solo POST sintético en loopback con `gpt-6.2-sol / high`, sin herramientas ni continuación. La inspección offline rechazó un alias. |
| Migración y concurrencia | Las 81 migraciones de Server aplicaron en PostgreSQL 16 desechable. Doble admisión y doble reclamo convergieron en el mismo intento, con una sola trama. El CHECK rechazó un recibo de otro actor. |
| Publicación y ACK | El worker registra la custodia antes de iniciar el proceso, guarda la identidad nativa antes del presupuesto y comprueba contrato y permisos antes de despachar y publicar. Un fallo simulado de ACK mantuvo el recibo y el slot. Un worker nuevo cerró el ACK exacto y liberó el slot, sin reenviar. El probe sólo calificó después del ACK. |
| Pérdida de respuesta | Sin prueba de cierre, la operación conservó el slot `unknown`. Una prueba posterior de cierre permitió conciliar el resultado remoto `unknown` y liberar, con el contador de intercambios intacto. La recuperación autónoma verifica el grupo en el mismo arranque Linux, o conserva la reserva si falta evidencia de custodia. |
| Copia restaurada | PostgreSQL clonó una base con un terminal cerrado y ACK pendiente. La preparación de restore se detuvo para conciliación del dueño y conservó el recibo exacto. La cola operativa resolvió el ACK sin repetir el intercambio. |
| Autoridad y regresiones | Se revocó el módulo antes del envío y antes de publicar. La primera revocación conservó cero intercambios. La segunda impidió publicar el borrador. Cambiar la generación de sesión invalidó la calificación. Pasaron 126 pruebas TypeScript, lint, compilación y las integraciones de API key y PDF en bases independientes. |

La VM mantiene su release y esquema operativos. El paso 4 debe adoptar
el host y el Server con la migración, ejecutar el probe con una cuenta
real y habilitar la selección en la interfaz según el recibo. El paso 3
no lanzó inferencias reales ni cambió la configuración de la cuenta.
