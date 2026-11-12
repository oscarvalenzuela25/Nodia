# Mantenimiento del workspace — 2026-10-23

## Original del instalador productivo — 2026-11-11

El [ZIP del helper original](production-first-install-original-20261111.zip) conserva los bytes que se ejecutaron antes de corregir la limpieza de su unidad temporal. El [manifiesto](production-first-install-original-20261111.json) registra origen, tamaño y SHA256 original6fd3ba48, comprobado desde el VPS antes de reemplazarlo; el helper corregido tiene hash distinto. No contiene configuración, credenciales o claves, ni constituye un rollback de base de datos. La incidencia y reconciliación READ ONLY se siguen en [evidencia de primera instalación](../../docs/evidence/production-first-install-20261111-r01.json).

## Índices del MVP consolidados — 2026-11-09

Lote L02 del [plan100](../../docs/mvp/100-repository-cleanup-and-documentation-consolidation-plan.md): [README MVP](../../docs/mvp/README.md) como índice, [progreso](../../docs/mvp/00-progress.md) con estado/pendientes e [historia única](../../docs/mvp/00-progress-history.md) para cortes anteriores. Se preservan los párrafos previos no encabezado, 120 anclas y el contexto de las secciones; 132 bloques compartidos no se duplican en los complementos del índice.

Las entradas pasan de 564.078 a 38.965 bytes (−93,09%); entradas más historia suman 502.524 bytes, sin atribuir reducción del historial Git o espacio físico liberado. El [recibo](docs-index-cleanup-2026-11-09.json) registra fuentes, cobertura, referencias y verificación. Ningún problema nuevo de enlace; un fragmento histórico previo hacia86 queda identificado, sin alterar la fuente o su evidencia. Registry/release/manifiesto/assets compilados en memoria permanecen idénticos, con 44 documentos, 46 fragmentos y 153 capacidades.

No se borran temporales, código, dependencias, perfiles, sesiones, backups o evidencia, ni se cambian runtime/VM/aprobaciones. Los originales y hashes anteriores aLF de las secciones inferiores siguen intactos. L03/L04 y el inventario general L01 continúan pendientes; sus cifras históricas no describen esta ejecución.

## Plan de limpieza y consolidación — 2026-11-09

El [plan100](../../docs/mvp/100-repository-cleanup-and-documentation-consolidation-plan.md) centraliza candidatos, límites de conservación, mapa documental y checklist L01–L05. La revisión actual sólo inventaría/prepara: no ejecuta limpieza ni convierte los tamaños de auditorías anteriores en ahorro. Conservar originales, catálogos y dependencias mantenidas en `ops/lab/artifacts` hasta clasificarlos. Registrar cierres consolidados por lote aquí sin duplicar reportes intermedios.

## Verificación de finales de línea — 2026-11-08

Se revisaron los archivos versionados presentes y los nuevos archivos elegibles para Git. Los 3838 archivos de texto UTF-8 propios examinados ya estaban en LF: no fue necesario convertir CRLF ni cambiar su codificación. `.gitattributes` y `.editorconfig` conservan la política LF existente.

Se preservaron los bytes de evidencias y originales históricos, binarios, secretos, perfiles, sesiones y paquetes locales de recuperación. Las capturas y logs temporales de `.playwright-cli/` se excluyen de Git sin borrarlos. Esta comprobación de formato no acredita pruebas funcionales nuevas ni modifica los estados documentales de aprobación.

## Recuperación local de rutas y Teacher — 2026-11-01

La corrección incremental179359 tiene respaldo/recibo propios en `ops/lab/artifacts/teacher-archive-local-20261101-r01` y [evidencia](../../docs/evidence/teacher-local-archive-frame-20261101-r01.json). Conserva89tablas, añade el frame nullable sin inferir estados y lleva el historial local a36migraciones; no activa workers ni califica selecciones. Se comprobó en restauración descartable el rechazo de transiciones ambiguas o que descartarían continuidad.

Se conservan los paquetes privados ignorados `ops/lab/artifacts/canonical-module-links-20261101-r01` y `ops/lab/artifacts/teacher-domain-local-20261101-r01`, cada uno con README/catálogo, respaldos DPAPI CurrentUser before/after y recibos. El primero acredita inventario, restauración íntegra descartable, migración179356 y repetición; el segundo la aplicación local179357/179358 bajo runtime sin trabajo abierto, sin reinicios o calificaciones operacionales nuevas. Las evidencias duraderas [rutas](../../docs/evidence/canonical-module-routes-20261101-r01.json) y [Teacher](../../docs/evidence/teacher-local-schema-20261101-r01.json) distinguen DB de trabajo, ensayo y adopción de procesos. No son backups de producción ni publicación de conocimiento; no borrar por tratarlos como temporales.

Se eliminaron 27.837 archivos descartables (1.101.987.786 bytes, aproximadamente 1,10 GB): experimentos de `.tmp/` y `.temp/`, capturas sin referencias, logs intermedios, cobertura generada, cachés Python y metadatos incrementales de TypeScript. El [informe](cleanup-2026-10-23.json) contiene los grupos y verificaciones. Los patrones se ignoran en Git para próximas ejecuciones.

Se conservan pruebas existentes, evidencia consolidada, dependencias, caché del Vite activo, compilados, sesiones y credenciales. No se reiniciaron servicios, desplegaron cambios ni modificaron datos de negocio. Los scripts históricos de evidencia conservan rutas temporales de origen que ya no existen; no son dependencias operativas mantenidas. Los empaquetadores AI40 sí usan ahora el paquete preservado.

## Finales de línea e integridad histórica

797 archivos se normalizaron mediante reemplazo exacto CRLF→LF; otro AGENTS ya fue normalizado por la edición de política. `.gitattributes` y `.editorconfig` ya exigían LF. El análisis final de texto propio gestionado no encontró CRLF. Se excluyen binarios, dependencias, secretos, perfiles y sesiones.

El [manifiesto de normalización](lf-normalization-manifest.json) registra hashes y tamaños anteriores/posteriores. [El ZIP de originales](pre-lf-originals-2026-10-23.zip) conserva los 797 originales, verificados por entrada. Estos originales permiten comprobar hashes históricos; no se reescribieron recibos ni aprobaciones antiguas. Una copia LF no acredita el hash de sus bytes CRLF originales. Las ediciones deliberadas posteriores (política, rutas y procedencia técnica activa) se distinguen en el informe de limpieza.

El registro activo de conocimiento requiere 85 hashes técnicos nuevos: conserva 74 capacidades, 31 bindings y 31 fragmentos, permisos, revisiones y aprobación documental. El build local calcula `06bf13b7fd4dc03f1ba7334bf42e96ffa8deb4091092cdae15830d2b43226474`; no se adoptó en la VM. No hay nueva funcionalidad ni modificación semántica de las fichas.

## Recuperación conservada

`ops/lab/artifacts/` es local e ignorado: contiene el paquete base AI38, los tres paquetes AI40 aún útiles, el plan de adopción y el respaldo previo a contactos de proveedores. Sus tamaños y SHA256 están en el informe. No contiene material para publicar; el respaldo puede contener datos privados. La limpieza de estos elementos requiere evaluar su utilidad de recuperación, no tratarlos como temporales.

El [catálogo de entradas de aceptación](retained-acceptance-inputs.json) identifica nueve originales conservados en un ZIP local, incluidos los reportes finales AI40 y el log AI32 enlazado por hash. La herramienta compartida de acceso a la VM quedó en `ops/lab/remote.py`; su original también está archivado. La imagen AI15 enlazada se trasladó a `docs/evidence/` y se corrigió su enlace. El respaldo de contactos se referencia desde su especificación31 con la ubicación nueva.

## Pruebas y verificación

Los AGENTS raíz y de Client, Server y Gemini priorizan lógica atómica, funciones, validadores, hooks y componentes con comportamiento observable. Las páginas y secciones compuestas no requieren suites por defecto. La integración se reserva para garantías concretas entre unidades (permisos, transacciones, concurrencia, idempotencia). No se eliminaron ni desactivaron pruebas existentes por esta política.

Pasaron ambos builds, `knowledge:check`, `knowledge:build`, la comprobación de hashes archivados y el análisis sintáctico de 120 Python normalizados. Client conserva un aviso de tamaño de chunks. No se repitieron inferencias reales ni suites generales por un cambio de formato. El validador histórico de conocimiento mantiene su incompatibilidad previa: reconstruye el corte congelado AI32-R02 (67 capacidades/27 fragmentos), anterior al registro vigente. No se modificó esa evidencia para aparentar una aceptación nueva.

## Corrección posterior: arranque con `npm run dev`

El arranque de desarrollo expuso una omisión en `nodia-server/nest-cli.json`: `prepare:chat` genera `common-schema.json` en `src`, pero el compilador limpiaba `dist` y sólo copiaba los esquemas de selección de herramientas. El build completo regeneraba el esquema al final, por lo que su éxito no verificaba el camino `dev`. El origen canónico no fue eliminado.

Se añadió el asset explícito `nodia-ai-tools/config/common-schema.json` con vigilancia de cambios. `npm run test:build-assets` reproduce la preparación y compilación limpia de Nest sin la reparación posterior de `context:build`; compara el asset emitido con el contrato canónico y compila el esquema de confirmación real. La comprobación falló inicialmente con el mismo ENOENT y pasó tras la corrección. Es una regresión acotada de empaquetado, sin DB, red ni efectos comerciales. No se modificaron contratos, permisos, lógica del producto o contenido de fichas; no requiere una nueva aprobación/publicación de conocimiento.

Verificación posterior: `npm run dev` compiló sin errores, inicializó `NodiaAiConfirmationModule` y arrancó en el puerto3000. El watcher local que había fallado fue reemplazado; los demás servicios se conservaron. Lint terminó sin errores, con tres avisos preexistentes.

Corrección de conexión local: `.env.development.local` del Client conservaba `NODIA_API_PROXY_TARGET=http://127.0.0.1:3100` del entorno VM y prevalecía sobre `.env`. Se cambió únicamente ese destino local a `http://127.0.0.1:3000`, correspondiente al backend de desarrollo activo. Vite recargó su configuración; `GET /api/v1/auth/me` devuelve401 sin credenciales tanto directo como mediante5174, acreditando transporte hacia la API, no un login de usuario completado. No se modificaron credenciales, autenticación ni configuración versionada del proxy.


## Auditoría de limpieza — 2026-10-27 (borrado masivo bloqueado)

El [informe](cleanup-2026-10-27.json) distingue inventario de ejecución: se identificaron aproximadamente 1,258 GB descartables, pero el control automático rechazó el borrado recursivo, la desconexión de junctions y el borrado masivo de archivos comunes con `blocked by policy`, sin detalle adicional. Sólo se eliminó un log vacío. Los temporales y cachés inventariados permanecen; esta ronda no acredita una limpieza completada.

Se preservaron 436 originales referenciados y logs históricos en un único [paquete local catalogado](../lab/artifacts/cleanup-2026-10-27/catalog.json), ignorado y privado. Archivo y entradas verificados por SHA256. No publicar este material ni reescribir las evidencias históricas. Las fuentes mantenidas usan temporales como salida regenerable; algunas recetas históricas conservadas en `artifacts` aún leen builds de `.tmp`, que siguen disponibles.

Los 6.139 archivos propios gestionados conservan exactamente sus bytes previos y el análisis UTF-8 no encontró CRLF; no fue necesario convertirlos. También se comprobó LF en los JSON generados de runtime. Se excluyen binarios, dependencias, secretos, perfiles, sesiones y originales históricos. Las verificaciones puntuales de dependencias y configuración local permanecen intactas. No cambian UI, contratos, comportamiento, fichas, permisos ni publicación de conocimiento.

`npm run knowledge:check` ya fallaba **antes** de la limpieza con `implementation_hash_mismatch`. No se alteró el registro para encubrirlo ni se ejecutaron inferencias, despliegues o cambios de datos de negocio.

## Original del helper client16 — 2026-11-11

`production-client16-original-20261111.zip` conserva los bytes del script que
configuró el repositorio pero se detuvo antes de instalar: el parser Candidate
cerraba el pipe y propagaba SIGPIPE141 bajo pipefail. El manifiesto homónimo
registra SHA original y reemplazo; no contiene secretos ni datos de PostgreSQL.
El reemplazo consume toda la salida y conserva las restricciones del plan APT.

## Original del configurador de backups — 2026-11-11

`production-backup-configuration-original-20261111.zip` conserva el helper fe2af13c
anterior a la corrección del lock vacío; el manifiesto homónimo registra hashes.
El validador de archivos de configuración exigía contenido y rechazaba el archivo
installation.lock legítimo de cero bytes. La corrección valida por fstat el FD
abierto root:root0600/regular/nlink1 y acepta cero bytes, sin relajar otros archivos.
No contiene secretos/configuración real, sólo código fuente original.
