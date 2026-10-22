# AI-38 — Revisión actual por alcance del entorno Linux local

Fecha: 2026-10-20. **Revisión documental offline con recibos operativos nuevos enlazados**. Esta auditoría no efectúa operaciones remotas, aprueba documentación, autoriza entrega o cierra AI-38. Conserva los alcances de cada snapshot de runtime, configuración/red, TCP desde el host y conservación. Sucede al corte histórico de la matriz R03 sin modificarlo.

La aceptación ya no está bloqueada por el límite de proxy, el ingreso humano, el drawer o el ensayo A→B→A en sus alcances comprobados. Tampoco basta resolver infraestructura para cerrar la etapa: falta la aceptación generativa y de efectos del paquete completo ofrecido, la cobertura/publicación restante de AI-36 y las garantías de conservación/restauración del entorno.

## Criterios actuales

| Criterio | Estado y alcance comprobado | Qué falta o qué no acredita |
| --- | --- | --- |
| `immutable_packages` | **probado**. Artefactos congelados, no adopción permanente. Server candidato01 y Client de 171 outputs tienen manifiestos y pines comprobados; instalación física fresca probada. | El paquete completo no es el runtime operativo final. |
| `authenticated_UI_and_drawer` | **probado**. UI humana bajo túnel y activación temporal del candidato completo. Login Google legítimo, identidad, historial, drawer, salida/vuelta y recarga profunda del candidato; viewport móvil sin overflow. | No acredita origen público, teléfono físico o una generación nueva. |
| `rollback_read_continuity` | **probado**. Lectura de historial desde SPA retenida después de revertir. GET nuevos a API original y hashes DOM/SQL del chat iguales después del rollback. | La raíz original devuelve 404; no se verificó recargar el shell revertido ni generar otro turno entre versiones. |
| `deployment_and_rollback` | **parcial**. Ensayo real A→B→A sin efectos comerciales ni trabajo activo. Paquetes completos y procesos efectivos adoptados temporalmente; reversión exacta y cuatro servicios originales recuperados. | Falta adopción permanente del objetivo ofrecido y drenaje de trabajo activo; el ensayo sólo detuvo consumidores quietos. |
| `proxy_and_real_attachment_transport` | **probado**. PUT binario de PDF sintético de 20 MiB, UI autenticada e integridad R2 privada. 20.971.520 bytes admitidos, +1 byte rechazado; borrador preservado; SHA/tamaño exactos en R2 y eliminación del objeto propio comprobada. | No es descarga autenticada UI/API, envío de original de 20 MiB a Gemini, cuatro archivos/40 MiB agregados o garantía de borrado físico. |
| `provider_text_routing_and_formats` | **parcial**. Gemini real con selección High y época registrada; adaptador candidato y arneses. 17 solicitudes generativas con ACK: C05 delta, delegación Web→Agentic→Web y PNG/PDF/WAV/WebM en ambos modos. | No equivale a una nueva generación end-to-end desde la UI autenticada sobre el paquete completo adoptado; cualquier cambio de época exige revisar atestaciones afectadas. |
| `published_capability_acceptance` | **parcial**. Primer lote representativo C05 acumulado. 7/7 acumuladas: cuatro históricas no reejecutadas y tres nuevas en la época AI-38. | No son siete reaceptadas en una única época ni aceptación de las 74 herramientas. AI-36 conserva 77 candidatas sin publicar. |
| `human_confirmation_and_native_effect` | **parcial**. UI/API/SQL y efecto financiero desechables; preparación MCP representativa real. Revisión/hash/botón, gasto visible, cancelación y autoridad comprobados en entorno aislado; preparación real del modelo sin efecto comercial operativo. | Falta recorrido generativo sobre candidato completo: preparación MCP→propuesta exacta→botón humano→efecto autorizado visible en la app, sin duplicación. |
| `authority_and_revocation` | **parcial**. Casos HTTP/SQL aislados y sesión humana de super_admin. Autoridad vigente y revocación probadas con actores fixture; UI autenticada acredita el acceso ordinario observado. | No se heredó aceptación de todos los roles/módulos y revocación del entorno operativo usando sesiones legítimas equivalentes. |
| `product_context_evolution` | **parcial**. Compilador/PostgreSQL y dos procesos reales con dispatches sintéticos. A termina con su contexto fijado, B no reclama ese trabajo y el próximo turno utiliza B con producto revisado/función nueva. | No acredita hot reload, publicación/aprobación de un producto nuevo ni su uso generativo operativo. No modificar fichas aprobadas para fabricar aceptación. |
| `encrypted_backup_and_isolated_restore` | **probado**. Copia puntual de BD propia y restore desechable sin red o consumidores. AES256/MDC, restore lógico de 62 tablas/29 migraciones y limpieza de copia/clave/unidades temporales verificados. | No es rotación continua, restore operativo liberado o restore de versiones cloud con journal externo. |
| `backup_inventory_rotation_and_expiry` | **pendiente**. Todas las copias propias capaces de reconstruir contenido NodiaAI. Inventario fresco acotado encuentra 29 archivos .dump, 7.561.623 bytes y mtimes del 16 al 18 de octubre, sin abrirlos; no identifica cifrado/fecha real de captura. PostgreSQL observado: archive_mode off, cero slots, dos WAL/32 MiB. No apareció timer Nodia de backup/journal en unidades/paths seleccionados. | Inventariar todos los destinos, snapshots, WAL/exportaciones; acreditar cifrado/acceso y máximo 7 días aplicado. Los mtimes no prueban captura, contenido o copias vencidas. No se concluye inexistencia global del mecanismo por esta observación. |
| `external_deletion_journal_and_restore_reconciliation` | **pendiente**. Cobertura externa íntegra de borrados desde captura hasta cuarentena. Preparador aislado fail-closed valida manifiesto/head y mantiene incertidumbre; siempre release_authorized false. | Falta acreditar productor continuo de todas las rutas de borrado, head externo confiable, expiración acotada e inventario/conciliación actual de dominio/runtime y generaciones ausentes del backup. No reconstruir cobertura desde backup o logs parciales ni inferir inexistencia global de un productor desde paths seleccionados. |
| `storage_versions_and_cleanup_guarantee` | **parcial**. Objeto vivo propio R2 eliminado en un ensayo. HEAD/GET 404 y cero trabajos del objeto; no se borraron objetos ajenos o promovidos. | Falta condición real de versionado/multipart, inventario aplicable y evidencia continua del objetivo de limpieza de 24 horas. Retención/borrado remoto de chats nativos del proveedor siguen desconocidos salvo contrato verificado y ownership; no borrar perfiles/chats ajenos. Ausencia del objeto vivo no acredita borrado físico de discos/WAL/copias del proveedor. |
| `public_origin_TLS_and_exposure` | **pendiente**. Entrega pública del entorno de destino. Inspección fresca: nginx sólo escucha en loopback sin directivas TLS/certificado; políticas INPUT DROP IPv4/IPv6. Host→IP privada: SSH acepta; puertos 80/443/3000/5432/6379/8000/8080 agotan plazo TCP, sin bytes de aplicación. | Falta dominio/origen público elegido, TLS, cookies/OAuth/CORS allí y verificación desde Internet/IPv6. Los timeouts no prueban una regla de firewall particular ni el aislamiento desde todas las rutas. |

Los estados describen alcances distintos; no son un porcentaje de cierre. Un «probado» restringido no pasa automáticamente un gate operativo más amplio.

## Dependencia de AI-36 y recorrido completo

El primer lote C05 suma **7/7 representativas acumuladas**: cuatro históricas (`attachments_describe`, `operations_get`, `proposals_get`, `workflows_prepare`) y tres nuevas (`preferences_prepare`, `preferences_list`, `finance_movements_prepare_create`). No fueron siete reaceptadas en una sola época. El catálogo candidato conserva 74 herramientas; **77 candidatas siguen sin publicar**. La aprobación y publicación selectiva permanecen explícitas.

Las verificaciones de Gemini real usan el adaptador candidato y arneses con datos desechables; la ventana de UI autenticada del paquete completo no produjo mensajes o generaciones nuevas. Falta el recorrido completo del objetivo entregado: lenguaje natural → MCP publicado → propuesta/revisión exacta → botón humano → efecto con recibo visible en la app → salir/volver, sin duplicación. Las pruebas aisladas de autoridad, revocación y contexto conservan su alcance, aunque la sesión humana y el shell ya hayan pasado.

## Trabajo realizable y dependencias externas

En la VM se puede avanzar con un inventario actual de servicios, listeners, nginx, jobs de backup/expiración y productor de journal; probar configuración y controles de cuarentena existentes; y preparar aceptación del candidato completo con datos propios de prueba. No hace falta repetir la subida de 20 MiB o las copias puntuales ya verificadas para descubrir esos huecos.

Cifrado y restore puntual están acreditados; **rotación continua y journal íntegro no lo están**. La política exige máximo siete días para todas las copias propias con contenido, identificadores mínimos de borrado fuera del backup sólo durante su horizonte y cuarentena sin replay. Un head inventado después de capturar una copia, un timer recién creado o un nuevo dump no demuestran historial continuo. La ausencia en un inventario acotado tampoco demuestra que no exista un mecanismo en otro host.

Los destinos de backup, snapshots del hipervisor, R2/versiones/multipart y red pública requieren sus configuraciones y observaciones propias. Sin un origen público elegido no se puede certificar TLS/OAuth/cookies/CORS/firewall de entrega pública. La VM local sigue siendo el primer entorno; API de pago y Codex conservan sus etapas separadas.

## Inspecciones nuevas y límites

El [snapshot runtime R02](nodia-ai-ai38-environment-runtime-r02.json), observado en la VM a las 23:15:39 UTC, acredita cuatro servicios originales activos, Node932, época Gemini y proxy scoped conservados, con cero pendientes en ese instante. R01 falló al ejecutar el inspector por stdin porque `__file__` no era un archivo hasheable; fue un `FileNotFoundError` del arnés, sin mutación o diagnóstico de fallo del runtime. R02 ejecutó el archivo exacto y pasó. La revisión no convierte ese snapshot en disponibilidad continua.

La [inspección nueva R02](nodia-ai-ai38-environment-inspection-r02.json), a las 23:17:03 UTC de la VM, conserva servicios/PID y nginx con una directiva de escucha loopback, sin TLS/certificados y con el scoped de 20 MiB/hash 2f96 intacto. Observa políticas INPUT DROP en ambas familias sin publicar reglas ni inferir su alcance efectivo. Declara NTP y sincronización activos; no corrige relojes ni demuestra sincronía entre hosts. R01 se conserva: su consulta de propiedades horarias quedó vacía y R02 corrige esa consulta, sin cambios de reloj.

El [sondeo TCP desde Windows](nodia-ai-ai38-environment-host-network-r01.json) acepta 22 y agota plazo en 80, 443, 3000, 5432, 6379, 8000 y 8080, enviando cero bytes de aplicación. Es la ruta privada host→VM; no verifica Internet, IPv6 o una regla concreta de firewall. Sus timestamps son del host desfasado y no se usan para ordenar eventos frente a la VM. No acredita HTTP, autenticación o inferencia.

La [inspección acotada de conservación R02](nodia-ai-ai38-environment-retention-r02.json), a las 23:18:06 UTC de la VM, encuentra 29 archivos `.dump`, 7.561.623 bytes y mtimes del 16 al 18 de octubre. No abre contenido o claves y no demuestra su cifrado, fecha de captura o expiración; no se clasifican como vencidos ni se eliminan. En unidades/cron/paths seleccionados no aparece un mecanismo específico Nodia de backup/journal. `dpkg-db-backup` y `systemd-journald` no acreditan esos contratos. Es una observación acotada, sin concluir inexistencia en otro path/host/destino.

PostgreSQL informa `archive_mode=off`, cero slots y dos archivos WAL de 32 MiB en total. No se interpreta el sentinel deshabilitado de `archive_command` como un comando de archivado configurado. Estos agregados no prueban destinos de archivo, ausencia de snapshots, recuperabilidad o purga física. La inspección conserva identidades de servicios y no cambia datos, relojes o configuraciones, ni consulta Hyper-V, R2 o proveedor.

No se certifican la retención ni el borrado remoto de chats del proveedor: sólo un contrato verificado del adaptador con ownership permitiría limpiar lo propio; no se borran perfiles o chats ajenos. Las nuevas observaciones locales no acreditan rotación, journal, versiones cloud, objetivo continuo de limpieza de 24 horas o exposición efectiva desde Internet.

## Procedencia y cortes históricos

El [JSON de esta revisión](nodia-ai-ai38-environment-current-r01.json) conserva los SHA-256 completos y la clasificación de cada criterio. Fuentes principales:

- [plan](../mvp/45-nodia-ai-implementation-plan.md) — `34480ffead82efdc5355b4cad01155c8726d8f1eea0aacc3e6dc987bb28ae6a1`.
- [retention_policy](../mvp/50-nodia-ai-ai04-runtime-policy.md) — `5f41f630ffe164fc343aa8cc4235433eb38822aa303b32c1e41995b46193fccd`.
- [gates_historical](nodia-ai-ai38-gates-linux-lab-r03.json) — `50dd9736f9c437ac2ce30b87e2ba0a33168a7cef498f6aedb0c46aad0676e055`.
- [package](nodia-ai-ai38-candidate01.json) — `bdb9b27b0983adaca01b5dcc73d11428fa3c6c31c1a4fdcd2b417b5a0d8d552d`.
- [isolated_UI](nodia-ai-ai38-acceptance-r06.json) — `c5d31c30a7e8140b7d1e7b435ca552a7423fceb6cd6e4985c2d2a0825aafb3bb`.
- [functional](nodia-ai-ai38-verifications-r01.json) — `c6eab39d2da3ce3e9c5d2488d884f017f248dd0107ca4adb8be70a6227a11501`.
- [adoption](nodia-ai-ai38-adoption-validation.json) — `d3317ee551307fab73c4219eddc4e8fdd769a73336efec9358f99303dbb4d77c`.
- [UI](nodia-ai-ai38-ui-retry-validation.json) — `758c6b18cbc77b41213853512c398e5ad56e875a64364d21a052b229c39391ac`.
- [proxy](nodia-ai-ai38-proxy-attachments-validation.json) — `b76fdf2b6c729a9d40daabbbec9daed1c13e29c4386dc2b14191217543d8f73c`.
- [backup](nodia-ai-ai38-adoption-backup-r04.json) — `4d9d13494c5d864e1da6b00ea16e767070a365f0de451e4517cad71012e4690e`.
- [backup_cleanup](nodia-ai-ai38-adoption-backup-purge-r04.json) — `b35bdc9d50726802402ad3f87138ffae9533cc3b6ea9b081500b5a2e58669698`.
- [infrastructure_historical](nodia-ai-ai38-infrastructure-observation-r01.json) — `3f42ce40b04c33d3c3e8d283b887857c8d9c7e73054129b60bd3579a88cb9c18`.
- [restore_contract](nodia-ai-ai37-recovery-runbook.md) — `c747b7a88ccf772e034a0541b6ad3c4ee72c9b21316e6ee7ab26e91feda1bfe8`.
- [runtime_fresh](nodia-ai-ai38-environment-runtime-r02.json) — `4bf0814f5020465ad51d33133bfb7cb29e1b3642557291ba3b00c4feb3241c2e`.
- [runtime_harness_failure](nodia-ai-ai38-environment-runtime-r01.json) — `4c8fa65f5ab095603a2f83fd7453876a8bc87af7ddd4a9122963ee31ae138110`.
- [inspection_fresh](nodia-ai-ai38-environment-inspection-r02.json) — `d3d8600da6ebaf26602d95ac4c03aac6b9d26141a0cc62e679099ebde94a9cbb`.
- [host_network](nodia-ai-ai38-environment-host-network-r01.json) — `83c5f9bd577d0e90121795aee14d74b67ade5f454abf4a061ff3e5ad6f6d8d3b`.
- [retention_fresh](nodia-ai-ai38-environment-retention-r02.json) — `13370e9eed7dd00220bd4cf28158a897739225a27e33793f7bf864098ff224c4`.
- [retention_inspector](scripts/nodia-ai-ai38-environment-retention-inspect.py) — `f249b1379be3d16d58fcc60ed05cf86055475be739f550a64dbfc46043fea9da`.

La matriz Linux R03 y los runbooks iniciales contienen cortes anteriores al éxito MCP, la UI autenticada y el ajuste de 20 MiB. Sus razones y conteos se conservan históricamente; no deben presentarse como la fotografía actual. El encabezado de 84 describe el estado final sin adopción permanente y sus continuaciones detallan la adopción temporal; no confundir ambos hechos.

Se mantienen plan45, las 31 fichas aprobadas y la publicación c703. Este documento no reescribe contratos, aprueba fichas, publica herramientas o habilita tráfico.
