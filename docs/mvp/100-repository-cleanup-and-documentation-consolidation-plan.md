# Limpieza del repositorio y consolidación documental

> Estado: en revisión; ejecución parcial L02 de índices/progreso el 2026-11-09, descrita al final. No se ejecutan borrados de temporales/código, normalización de evidencia histórica ni cambios de runtime.
> Fecha: 2026-11-09.
> Dependencias: [reglas raíz](../../AGENTS.md), [progreso](00-progress.md), [índice](README.md), [mantenimiento](../../ops/maintenance/README.md), [estándar de conocimiento](../nodia-ai/knowledge/README.md), [producción/CI99](99-production-deployment-and-cicd-plan.md).

## 1. Objetivo y alcance

Reducir documentación repetida, rutas de lectura innecesarias, experimentos descartables y fuentes obsoletas sin perder decisiones, evidencia, recuperación ni dependencias del producto. Centralizar la información vigente en menos documentos mantenidos por tema; conservar la historia útil mediante referencias y archivos catalogados, sin convertir cada intento en otra fuente activa.

Se distinguen tres trabajos: **consolidar texto vigente**, **archivar historia útil** y **eliminar material demostrado como prescindible**. Un archivo antiguo, ignorado por Git, sin import estático o sin enlaces Markdown visibles no es automáticamente descartable. Este plan no reescribe la historia de Git ni cambia aprobaciones.

## 2. Inventario preliminar comprobado

Lectura local del 2026-11-09 con `git ls-files` y metadatos de archivos presentes, antes de escribir este plan. Se excluyen documentos nuevos aún sin commit, temporales ignorados, dependencias y datos remotos. Bytes lógicos, no espacio físico recuperable ni tamaño del historial Git.

| Grupo versionado | Archivos presentes | Markdown | Bytes |
| --- | ---: | ---: | ---: |
| `docs/mvp` | 115 | 105 | 5.448.782 |
| `docs/architecture` | 100 | 98 | 602.776 |
| `docs/features` | 13 | 13 | 147.943 |
| `docs/nodia-ai` | 84 | 84 | 1.679.012 |
| `docs/evidence` | 2.989 | 71 | 68.943.718 |
| `ops/maintenance` | 6 | 1 | 2.790.145 |

- `docs/mvp/README.md` y `00-progress.md` comparten **129 párrafos exactos de al menos 200 bytes**, que suman 106.881 bytes de texto compartido. Es señal de repetición, no permiso para quitar cualquiera de sus copias sin reconciliar funciones y enlaces.
- Entre los Markdown versionados examinados no se encontraron archivos completos con el mismo SHA-256. La oportunidad principal observada es consolidar fragmentos/historiales, no borrar supuestos duplicados completos.
- Documentos grandes candidatos a simplificar: `00-progress.md`, `README.md`, planes94/96/86/19 y `docs/nodia-ai/knowledge/README.md`. Su tamaño no demuestra obsolescencia; varios contienen contratos o evidencia vigente.
- Sólo se enumeró el primer nivel de salidas: `.tmp` tiene 249 directorios/2.925 archivos; `output`, 18/145; `.playwright-cli`, 60 archivos. No se midió su tamaño recursivo ni se verificó qué procesos los usan. No prometer ahorro a partir de esas cantidades.
- `ops/lab/artifacts` tiene 293 directorios/40 archivos inmediatos: inventario de recuperación, no papelera. `ops/maintenance` documenta originales/hashes y material privado aún útil.
- La limpieza del 2026-10-23 y la auditoría del 2026-10-27 son antecedentes distintos: esta última dejó borrado masivo **bloqueado por el control automático**, no completado. No reutilizar sus cifras como ahorro o autorización de una ejecución nueva.

La revisión del registry/compiler confirma que los índices MVP README,00-progress y el README raíz del conocimiento no figuran en `source_paths` ni en `metadata.sources` de las fichas inspeccionadas: son candidatos iniciales de menor riesgo, todavía sujetos a enlaces/consumidores. Los seis README de producto del conocimiento están draft; conservar identidades, revisiones y aprobación nula si se reorganizan.

Se ejecutó únicamente `compileKnowledge()` en memoria, sin emitir bundle: 44 documentos/46 fragmentos/153 capacidades. Baseline del checkout: registry `3b924e70d850a455a72d24c409f5a630ffb6788f354373f95294076235e0f758`, release `e6ae42867985c95eade143a8e9e548b80f33b4a8aa5324555e1fefcfc450f0c7`. No identifica el paquete activo de la VM ni equivale a un build/inferencia/despliegue nuevo. La fase de índices sin fuentes hasheadas debe conservar manifiesto y fragmentos; refrescar baseline al ejecutar el lote.

## 3. Candidatos y tratamiento propuesto

| Grupo | Acción candidata | Qué demostrar primero |
| --- | --- | --- |
| `.tmp/`, `output/`, `.playwright-cli/`, cachés propias y metadatos incrementales | Retirar salidas regenerables de intentos cerrados | Procesos sin uso, ausencia de evidencia única, procedimiento de regeneración y referencias revisadas; inventario por lote |
| Experimentos y scripts de una sola intervención | Retirar o archivar el intento; extraer sólo el helper mantenido | No usados en empaquetado, CI, operación, recuperación ni reproducción de una evidencia vigente |
| `docs/mvp/README.md` | Índice breve con destinos canónicos | El estado detallado vive en progreso/plan del tema; conservar enlaces que todavía consumen personas/herramientas |
| `docs/mvp/00-progress.md` | Estado actual y pendientes con enlaces | Separar cronología de entregas sin perder qué corte sustituye a cuál, sus límites y estado de aprobación |
| Planes funcionales con muchas rondas históricas (94, 96, 86, 82, 45, 19) | Contrato/plan vigente por tema y una historia consolidada cuando aporte valor | Matriz de requisitos/gates trasladados; referencias por heading, números de sección y hashes preservadas o migradas de forma verificable |
| Despliegue: 10, 11, 18, guía histórica y99 | 99 como pendientes/promoción; runbook mantenido como ejecución; 10/11 como resumen enlazado | No mantener tres recetas distintas de los mismos comandos; no hacer99 fuente de reglas de negocio |
| `docs/features/**` y especificaciones MVP | Eliminar repetición literal; conservar guías de implementación donde agreguen detalle | Definir fuente canónica por dato y referencias, sin fusionar aprobaciones de producto con QA/operación |
| Evidencias en `docs/evidence/**` | Catalogar por entrega/capacidad; preservar evidencia útil y bytes originales | Distinguir pruebas duraderas, scripts congelados y salidas intermedias; comprobar referencias/hashes y necesidad de reproducción |
| Código, configs, scripts y dependencias presuntamente sin uso | Auditoría específica antes de retirar | Entradas dinámicas, CLI, imports indirectos, assets, migrations, Compose/systemd, tests y consumidores externos |

Las filas son **candidatos a evaluación**, no una lista de paths autorizados para borrar. Mantener cada dominio vertical del código; no reducir archivos fuente juntando responsabilidades sólo para disminuir el contador.

## 4. Organización documental objetivo

Propuesta de responsabilidades sobre las rutas actuales, sin imponer una reorganización física masiva:

- **README raíz:** entrada a instalación/desarrollo y enlaces al producto; no historial de cada entrega.
- **MVP README:** mapa de especificaciones y puntos de entrada; no repetir el diario de progreso.
- **00-progress:** pendientes actuales, bloqueos y último estado por alcance; enlaces al plan correspondiente y a evidencia, sin copiar narraciones completas.
- **Documento de cada tema:** reglas vigentes, contratos, decisiones y checklist propio. Integrar documentos superados sólo si la matriz demuestra cobertura y compatibilidad de referencias.
- **Runbooks mantenidos:** procedimientos ejecutables y configuración por entorno; la receta antigua queda identificada como historia y no como alternativa vigente.
- **ADRs:** decisiones técnicas versionadas e independientes; no fusionarlos en un documento gigante ni cambiar propuesto a aprobado por consolidación.
- **Historia/evidencia:** un registro consolidado por tema/entrega cuando sea necesario, separado de la entrada vigente. Elegir destinos concretos en el mapa de movimientos antes de crearlos; no multiplicar archivos de archivo por cada intento.
- **Conocimiento NodiaAI:** corpus publicado conforme a su estándar y registry, enlazando fuentes canónicas. No mezclar su contenido operativo con los logs de mantenimiento.

Reducir el número de **fuentes activas** y la repetición es el objetivo; no existe una cuota arbitraria de documentos. Una tabla de contenido navegable vale más que un único Markdown inmanejable.

## 5. Límites de conservación y dependencias comprobadas

### Material que no se elimina por patrón

No tocar secretos, `.env`, perfiles/sesiones/keyrings, volúmenes/BD, credenciales, privada de backup, dependencias instaladas, dist o cachés de procesos activos, migraciones históricas, lockfiles, pruebas existentes o paquetes de recuperación sin una evaluación propia. La selección es por paths exactos e inventario, no por nombres como old, backup, temp o una fecha de modificación.

Los originales de finales de línea y sus manifiestos en `ops/maintenance` conservan sus bytes. Un hash histórico sigue describiendo su original; no editar evidencia/registro para aparentar que una limpieza conserva un hash que cambió. Tampoco reescribir reportes de fallos para simular éxito.

### Conocimiento, contratos y empaquetado

`nodia-server/config/nodia-ai-knowledge.registry.json` usa paths explícitos; el compiler valida fuentes/referencias y hashes. Build Server consume también políticas/schemas bajo docs y validadores bajo `docs/evidence/scripts`. Mover prosa puede invalidar una publicación o un enlace aunque no cambie el negocio.

Antes de mover/fusionar una fuente registrada: identificar su contrato/pin, estado de aprobación y consumidores; conservar rutas/cuerpos aprobados si el alcance no permite modificarlos. Si procede una nueva revisión, actualizar especificación/fichas/registry con sus validaciones y aprobación documental real, sin editar el registro sólo para silenciar el mismatch. Un stub con enlace no reemplaza automáticamente el cuerpo que el compiler espera. Si la reorganización cambia el contrato de publicación o la autoridad de varias fuentes, registrar el ADR correspondiente antes de implementarla.

### Recuperación y utilidades mantenidas

La auditoría encontró utilidades que aún dependen de material preservado: `nodia-server/scripts/canonical-module-links-local.mjs` usa `database_snapshot.py` desde el paquete `canonical-module-links-20261101-r01`; `ops/lab/teacher-vm-private-volumes.mjs` conserva blobs cifrados en `teacher-vm-deployment-20261101-r01/storage`. Los empaquetadores AI40 consumen el tar base `ops/lab/artifacts/ai38-owner-deploy-r01.tar.gz`. Comprobar sus rutas exactas durante L01 antes de tocar esos paquetes. Un helper reutilizable debería migrar a fuente mantenida versionada y verificarse antes de retirar su dependencia del paquete; los originales de recuperación se conservan sin reescribir.

Candidatos regenerables comprobados, sin autorización de retiro todavía: salidas de `nodia-server/scripts/package-nodia-ai-lab-release.mjs` en `nodia-server/.tmp/ai11-ai12-release`, transpiles de la herramienta de rutas en `.tmp/canonical-module-links` bajo Server y ensamblados de `ops/lab/assemble-nodia-ai-selective-knowledge-r01.py`. Este último crea junction/symlink `nodia-server/node_modules` hacia dependencias reales: nunca recorrer el destino al limpiar el ensamblado. Archivos `*.tmp` pueden ser checkpoints o reemplazos atómicos de operaciones interrumpidas; clasificarlos antes de quitarlos.

No dejar `.tmp` u otro directorio descartable como única dependencia de un proceso mantenido. Esto exige revisar también las recetas archivadas que aún leen builds antiguos, no asumir que todas son utilizadas ni que ninguna lo es. Reconciliar con el catálogo de recuperación y mantener acceso a los originales necesarios.

## 6. Procedimiento por lote

1. Capturar estado Git y baseline del alcance, incluidos cambios previos del usuario; no resetear ni borrar trabajo sin commit. Registrar uso real por procesos/servicios sin volcar argumentos, entornos o contenidos secretos.
2. Preparar un manifiesto de candidatos con path absoluto/resuelto, tipo/versionado/ignorado, tamaño/hash cuando corresponda, razón, referencias, reemplazo/regeneración, propietario funcional y acción propuesta. El informe público no contiene datos privados ni payloads; los inventarios sensibles permanecen locales/protegidos.
3. Buscar referencias en enlaces/anchors Markdown, código/config, scripts, tests, registry, contratos, pipelines y operación. «No aparece en rg» no demuestra ausencia de carga dinámica o consumidores externos.
4. Para consolidar, construir mapa **fuente/sección → destino/sección**, verificar que se conservan reglas, aprobaciones por alcance, pendientes y evidencia. Preservar enlaces antiguos/anchors cuando sea viable y revisar consumidores; no dejar stubs incompatibles con hashes o build.
5. Antes de retirar material único o privado, conservarlo sólo cuando su necesidad de recuperación lo justifique, con catálogo/hash y destino protegido. No duplicar cada intento innecesariamente ni publicar archivos privados para poder borrarlos localmente. En archivos versionados, Git aporta historia del código, no sustituye backups de datos.
6. Ejecutar un lote pequeño y acotado: cambios documentales separados de eliminación de código/temporales para facilitar revisión y reversión. Medir el resultado real, no inferir bytes liberados del tamaño lógico candidato.
7. Validar enlaces/referencias/build afectados y comparar estado/outputs relevantes antes/después. Si una validación ya fallaba, conservar el hecho y aislarlo; no declararla nueva ni arreglarla alterando la evidencia. No generar inferencias para verificar una limpieza de prosa.
8. Registrar qué se consolidó, archivó, eliminó o conservó y por qué. Actualizar el catálogo/resumen de mantenimiento existente; evitar otro informe por cada reintento sin valor duradero.

En Windows, antes de cualquier movimiento o borrado recursivo comprobar que el path absoluto resuelto pertenece al workspace/destino exacto previsto y detectar symlinks/junctions/reparse points, sin recorrer sus destinos. Usar una sola shell y operaciones literales; no montar comandos de borrado pasando paths entre PowerShell y cmd. No se proporciona ni ejecuta un borrado masivo por extensión/antigüedad. Una revisión automática histórica rechazada no equivale a autorización actual ni se elude con otra shell.

## 7. Checklist y prioridades

### L01 — Inventario y mapa de conservación

- [x] Registrar la solicitud de plan y medir un inventario preliminar gestionado sin borrar.
- [x] Detectar repetición de bloques y distinguir temporales de paquetes de recuperación.
- [ ] Inventariar por lote paths, consumidores, procesos activos, capacidad de regeneración y evidencia única; tamaños recursivos sólo donde sea útil y sin seguir reparse points.
- [ ] Mapear helpers mantenidos que dependen de paquetes ignorados/temporales y preparar su sustitución antes de retirar originales.
- [ ] Crear matriz de documentación vigente/histórica, sección canónica, aprobación, hashes/anchors y destino propuesto. No usar edad como decisión automática.
- [x] Completar el mapa del lote acotado README/00-progress: consumidores, exclusión de fuentes publicadas, párrafos conservados, anclas antiguas y destinos de historia; ver recibo L02.

### L02 — Entradas y progreso

- [x] Simplificar README MVP a índice y mover estado actual a00-progress mediante enlaces, conservando contratos/paths registrados.
- [x] Consolidar las cronologías de estos dos índices sin perder límites, incidencias o pendientes; historia única y métricas en el recibo L02. Los demás planes temáticos se evalúan en L03.
- [x] Revisar README raíz y navegación: sus rutas estables a MVP/progreso/ADRs/instalación siguen siendo válidas, sin requerir cambios en raíz. Las entradas de dominio, producción y mantenimiento están en el índice simplificado.

### L03 — Documentación funcional y despliegue

- [ ] Reconciliar planes94/96/86/19 y sus manuales por tema: fuentes activas, historial útil y documentos realmente superados. Revalidar alcance con los checklists funcionales antes de fusionar.
- [ ] Posponer ediciones de fuentes completas hasheadas (por ejemplo19/94 o PRD de Negocios) hasta conocer el efecto sobre manifiesto/publicación; no tratarlas como fase inicial segura por ser prosa. La referencia visual de Teacher bajo `docs/design` tiene enlace desde98 y no es huérfana.
- [ ] Centralizar receta vigente de despliegue y enlazarla desde10/11/18/99; preservar la guía de ensayo como historia mientras tenga referencias útiles.
- [ ] Tratar corpus/registry/ADRs como fuentes con contratos propios; comprobar build/pins y enlaces si se modifica su entorno documental.

### L04 — Temporales, experimentos y código candidato

- [ ] Clasificar `.tmp`, output, capturas, cachés propias y logs; separar experimentos cerrados de procesos/recuperación activos.
- [ ] Evaluar scripts/configs/dependencias supuestamente retirados por referencias y comportamiento; conservar pruebas/contratos aún necesarios. Web retirado no convierte automáticamente todos sus archivos históricos en borrables.
- [ ] Retirar lotes demostrados prescindibles con manifiesto, protecciones de paths y comprobación antes/después; sin tocar datos de negocio o reiniciar servicios por rutina.

### L05 — Verificación y prevención

- [ ] Verificar enlaces/anchors de origen y destino; revisar enlaces dinámicos/referencias de número de sección y fuentes incluidas en publicaciones.
- [ ] Ejecutar checks de conocimiento/assets/build sólo cuando el alcance lo requiera; tests atómicos/integración para código retirado según la garantía afectada. No suites masivas por una corrección de índice.
- [ ] Confirmar que fuentes, secretos, sesiones, datos y recuperación conservan integridad; medir ahorro real y repetición eliminada. Quitar archivos del working tree no reduce por sí solo el historial/clon completo de Git.
- [ ] Enlazar la política de salidas en CI99: empaquetar fuentes/artefactos explícitos, no todo el workspace con `.tmp`, perfiles o dumps. No automatizar GC destructivo por calendario sin inventario/exclusiones comprobadas.
- [ ] Registrar cierre por lote en `ops/maintenance`, sin marcar documentos aprobados ni publicar corpus por limpiar.

**Primer paso incompleto:** completar L01 para los siguientes lotes y salidas cerradas; L02 de README/00-progress está cerrado por el alcance registrado abajo. L03 funcional/conocimiento y L04 temporales/código no están ejecutados. La limpieza documental puede avanzar junto a ramas/CI de99; no bloquear todo el piloto por reorganizar historia, pero resolver dependencias temporales y exclusiones que afecten al release antes de publicar.

## 8. Evaluación de impacto y entrega de esta revisión

Esta revisión sólo crea el plan y enlaces de continuidad. No cambian UI, backend, contratos, permisos ni herramientas NodiaAI; no requiere nuevas fichas/publicación. La ejecución posterior debe evaluar cada fuente y sus fichas conforme al estándar, especialmente si cambia paths/cuerpos compilados o disponibilidad operativa.

Inventario preliminar parcial y comprobaciones documentales diferenciados de ejecución: al crear el plan no se borraron/movieron temporales ni se verificó recuperación o capacidad de un entorno. La ejecución documental posterior tiene su propio recibo; las cifras preliminares de posibles temporales no acreditan ahorro conseguido.

## 9. L02 ejecutado: README y 00-progress — 2026-11-09

Solicitud explícita de retomar la limpieza empezando por estos dos documentos. [README](README.md) queda como índice con estados/jerarquía y [00-progress](00-progress.md) como síntesis vigente/pendientes; [historial único](00-progress-history.md) conserva todos los párrafos previos no encabezado y el contexto de sus secciones, sin repetir 132 bloques compartidos del antiguo índice. Es una consolidación de texto propio editable, no una edición de evidencias originales firmadas o sus manifiestos.

Los dos índices pasan de 564.078 a 38.965 bytes (93,09% menos texto de entrada), conservando 120 anclas antiguas entre secciones vigentes y enlaces explícitos a historia. Índices más historia suman 502.524 bytes: la reducción de las entradas no equivale a borrar toda la historia ni a reducir el historial Git. No se eliminan fuentes funcionales, contratos, ADRs, evidencia, originales de LF, temporales, sesiones o backups.

[Recibo de conservación y verificación](../../ops/maintenance/docs-index-cleanup-2026-11-09.json): cobertura de párrafos, mapa de anclas, comprobaciones de archivos/enlaces/fragments, integridad del resto de fuentes y baseline del compiler. No se introduce ningún problema nuevo de enlace; un fragmento histórico previo hacia86 queda registrado para revisión posterior, sin modificar esa fuente hasheada. El registry, release, manifiesto y assets de conocimiento compilados sólo en memoria son idénticos al baseline (44 documentos/46 fragmentos/153 capacidades); no se emite bundle ni se repiten reconciliadores históricos.

La síntesis no convierte en pendientes actuales las antiguas instrucciones Web/login, instalaciones ya sucedidas o cierres anteriores; conserva los bloqueadores OCR R16, Teacher96§32, aceptación de recuperación y preparación productiva por sus fuentes vigentes. No se cambia aprobación documental ni se acredita nueva aceptación de producto/entorno.
