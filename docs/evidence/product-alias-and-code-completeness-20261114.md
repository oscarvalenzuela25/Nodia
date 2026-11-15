# Alias de productos, revisión OCR y códigos — VM development2026-11-14

La solicitud se implementa y adopta separada del snapshot inmutable de chat
probado primero en VM. Rama `codex/nodia-ai-chat-space-gpt-selection`, base
`fe56f57de9e4c6c8a34c5183579916aade43931b`. Migración y delta de productos
adoptados sólo en development; sin producción, extracción OCR nueva o cambios
de ventas acreditados.

## Comportamiento

- Alias independiente nullable/max255, normalizado por trim; omitir conserva,
  null/vacío/blancos limpia. Actualizaciones con alias exigen revisión exacta.
- Alta/edición manual permite alias opcional. Checkbox «Utilizar el nombre como
  alias» materializa una copia explícita; sin bool persistido ni backfill.
- OCR sólo toma alias ya existente del catálogo. Nuevos/existentes sin alias
  requieren revisión explícita, con celda remarcada, lápiz y modal de nombre/alias.
  Guardar modal sólo cambia borrador. Se construyen y validan todos los comandos
  antes del primer POST de factura. La vinculación por producto conserva su ID,
  revisión, alias existente y campos elegidos; alias no decide el matching.
- Productos sin código se rotulan «(Sin código)» en el selector de vinculación.
- Buscadores de productos usan `q.search`, nombre OR alias escapados; criterios
  literales existentes se conservan. Los dos selectores de presencia son
  independientes y aplican antes del paginado, con Todos sin predicado.
- CSV exporta alias y el importador preserva valores cuando la columna se omite.
  La recuperación de guardado incorpora alias sin repetir escrituras inciertas.

## Verificación local consolidada

Client:2964 pruebas en360 archivos, todas correctas; build con tipos y lint del
código correctos. El lint general conserva un fallo previo de un experimento
ignorado en `.tmp/teacher-upgrade-browser/main.tsx`; el comando de cierre excluyó
`.tmp/**`. Server:6063 pruebas en353 archivos y una omitida en Windows por
requerir identidad de procesos Linux. Ese caso se comprobó aparte en WSL con el
código compilado, sin proveedor. Build correcto y lint con el warning previo
`no-unsafe-finally` en `test/nodia-ai-live-unknown.fixture.mjs`.

Después de la suite global se afinó la ausencia de identificadores para que
SQL trate NBSP/BOM y el resto de whitespace igual que `String.trim()`. Pasaron
48 regresiones Server en dos archivos y un nuevo build. No se presenta esa
corrección como una segunda ejecución de la suite completa.

`npm run test:product-alias:http` pasó cuatro gates con servidor HTTP Nest real,
parser qs y ValidationPipe del recurso. Verifica búsqueda/filtros anidados,
rechazo de arrays/enums/campos desconocidos antes del caso de uso, y contratos
create/update/bulk para omisión/null/trim/Unicode. Usa actor sintético y frontera
de persistencia aislada; no acredita autorización, DB o proveedor real.

Chromium157 aislado con transporte sintético:320/600/1280px, ES/dark y EN/light.
El ancho del documento coincide con cada viewport; a600 la tabla conserva su
scroll local (831,67px dentro de550px). Checkbox44px en la derecha del label,
alias visible, borrador y nombre original conservados al redimensionar y tras
409, con reintento explícito. Los filtros conservan las tres opciones y su
selección al reabrir; Limpiar restaura actividad Activo. Se comprobó búsqueda
por alias y revisión OCR local bloqueada hasta elección explícita, sin HTTP.
Medidas/capturas intermedias en `output/playwright/product-alias/`; este recibo
consolida los hechos duraderos. No acredita teléfono físico, teclado virtual,
autorización, escritura real o inferencia OCR.

## SQL y HTTP en Linux aislado

Pasaron cinco gates SQL sobre el snapshot inmutable de productos: migración
aditiva sin backfill ni pérdida de campos/IDs bigint; búsqueda literal por alias
OR nombre con autoridad de negocio; presencia Unicode antes de paginar y ceros
reales; límites/unicidad preservados; snapshots históricos y rechazo de down
que eliminaría datos. Pasaron también los cuatro gates HTTP anteriores en Linux.
PostgreSQL descartable con imagen fijada, network none/TCP desactivado, socket
Unix privado0700 y rol/base `product_alias_test`; sin `.env`, credenciales o DB
de la aplicación. Contenedor y socket propios eliminados al cerrar.

Recibo local `ops/lab/artifacts/product-alias-vm-20261114-r01/isolated-result.json`,
SHA256 `69dd482f5ff55b50adc96c13925be890c63df78454b7d4014feaff9ceafc5cd9`.
Snapshot fuente6876archivos SHA256
`089d01d4825b82057d450499a0e807dfe0d2fe282216c65a48628fa97ddcb43f`;
Server3454archivos `3346e941b25087c3fcf294a0dd82908cb8d296924024d4ffdd62dd10f26155dc`;
Client213archivos `70d759eeb4a0c26dc63c3d8f597154bb5391ad981d49734120fcd9451380db4d`.
El snapshot preserva la versión previa a las notas finales de cierre.

Se añadió SQL al fixture de instalación CI y HTTP al pipeline Server; estas
ejecuciones no acreditan CI remoto ni el fixture completo de instalación Docker,
que no se ejecutó localmente.

## Adopción separada en VM

La fase chat/Teacher pasó antes una creación normal GPT/medium: propuesta ready
con dos secciones, un dispatch reservado/iniciado, cierre Native/local y ACK,
sin aceptar plan, qualification probe, fallback, credenciales nuevas o replay.
[Recibo de chat](chat-gpt-development-vm-20261114-r01.json).

Checkpoint posterior al canario y previo a alias cifrado/restaurado:102tablas,
37secuencias y48migraciones, valores/columnas/restricciones iguales;
configuración8878entradas/562457193bytes, con contenido y metadatos exactos.
La restauración usó recursos descartables propios, eliminados al cerrar.

Overlay estricto12unidades,55miembros y16nuevos, preservando el resto del Server
y el host de IA. Archivo Server final SHA256
`98b0227df65b0367039205575811d2c2ba182190e4a79a1816a14219e785a2ba`;
Client `38cdf836e2bb9df763c439e566205c2968ce76394445bc7c77ad8405f50117db`.
Son paquetes de adopción sobre la release previa, distintos del build completo
de referencia anterior. Migración179366 comprometida una sola vez:48→49.
El primer comprobador terminó sin recibo porque ordenaba IDs convertidos a texto
y esperaba49 en último lugar. Se reconcilió ledger/columnas/release por lectura,
se corrigió sólo el comprobador y se continuó sin repetir DDL.

Reconciliación de102tablas:13productos y33logs mantienen sus campos históricos,
aliasNULL; las demás tablas/columnas/restricciones iguales y sólo la secuencia
de migrations incrementada. API200, Teacher anónimo401, API/worker/keyrings
activos;213recursos Client exactos con cadena histórica preservada. Checkpoint
final postalias cifrado y restaurado correctamente:102tablas,37secuencias y
49migraciones, todos los datos/columnas/restricciones iguales;
configuración8880entradas/562457709bytes exactos y recursos descartables
eliminados. Reanudación final comprobada: API,worker,dos keyrings,Nginx y dos
timers activos; PostgreSQL/Redis healthy y trabajos/slots/owners activos0. Host
GPT intacto. Se conservan fallos previos de NativeGemini y backup principal,
sin atribuirlos a esta entrega ni resetearlos. La rotación programada terminó
success/inactive/PID0 y ambos timers quedaron active/waiting.
[Recibo operativo final](product-alias-development-vm-20261114-r01.json).
No se hizo otra inferencia para alias.

Los recibos distinguen `date -u` de VM y observación Python Windows: se detectó
VM aproximadamente449segundos adelantada, incluyendo latencia de transferencia.
El orden operativo se acredita por secuencia/intents/recibos, sin ordenar marcas
de relojes distintos. Se conservaron los timestamps y no se ajustaron relojes;
su sincronización queda como mantenimiento separado.

El build documental final local pasó con release de conocimiento
`9bfe02f1341e2c101c441fac7e4ea7a142071f8cc08980b1856df979f4c57c17`,
92fuentes/48excluidas/44documentos/46fragmentos. Las notas posteriores no se
readoptaron en VM: su release exacta queda fijada por el recibo del overlay.
`git diff --check` correcto y archivos editables UTF-8/LF sin BOM comprobados.

La revisión automática bloqueó el control del Chrome personal al no poder
determinar su URL con confianza y rechazó por política la creación de un túnel
SSH. No se reintentaron mediante otro mecanismo. La revisión de UI real en VM
queda manual; la QA visual sintética local anterior tiene su alcance propio.

El flujo OCR actual tiene varias peticiones; prevalidar alias evita empezar con
un alias pendiente, pero no lo convierte en una transacción global. No hubo
inferencia OCR real por implementar alias ni se modificaron prompts/modelos.

## Conocimiento y límites

[Plan94§38](../mvp/94-business-point-of-sale-and-product-refactor.md#38-alias-humano-de-productos-y-revisión-ocr--solicitud2026-11-14),
[ADR102 propuesto](../architecture/decisions/ADR-102-human-product-alias-and-code-completeness.md)
y [ficha candidata](../nodia-ai/knowledge/businesses/features/product-alias-and-code-completeness.md).
Fichas aprobadas y contratos publicados cerrados se conservan. Alias necesita
la migración179366 en cada entorno antes de adoptar el código. La prueba
Teacher/chat de VM usa el snapshot anterior sin esa migración; productos tuvo
su fase y evidencia separadas. No se hereda aceptación de producción ni OCR.
