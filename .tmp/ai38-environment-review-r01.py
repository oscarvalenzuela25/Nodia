from pathlib import Path
import hashlib
import json

ROOT = Path('C:/Users/Oscar/Desktop/Nodia')
OUT = ROOT / 'docs/evidence'
sources = {
    'plan': 'docs/mvp/45-nodia-ai-implementation-plan.md',
    'retention_policy': 'docs/mvp/50-nodia-ai-ai04-runtime-policy.md',
    'gates_historical': 'docs/evidence/nodia-ai-ai38-gates-linux-lab-r03.json',
    'package': 'docs/evidence/nodia-ai-ai38-candidate01.json',
    'isolated_UI': 'docs/evidence/nodia-ai-ai38-acceptance-r06.json',
    'functional': 'docs/evidence/nodia-ai-ai38-verifications-r01.json',
    'adoption': 'docs/evidence/nodia-ai-ai38-adoption-validation.json',
    'UI': 'docs/evidence/nodia-ai-ai38-ui-retry-validation.json',
    'proxy': 'docs/evidence/nodia-ai-ai38-proxy-attachments-validation.json',
    'backup': 'docs/evidence/nodia-ai-ai38-adoption-backup-r04.json',
    'backup_cleanup': 'docs/evidence/nodia-ai-ai38-adoption-backup-purge-r04.json',
    'infrastructure_historical': 'docs/evidence/nodia-ai-ai38-infrastructure-observation-r01.json',
    'restore_contract': 'docs/evidence/nodia-ai-ai37-recovery-runbook.md',
    'runtime_fresh': 'docs/evidence/nodia-ai-ai38-environment-runtime-r02.json',
    'runtime_harness_failure': 'docs/evidence/nodia-ai-ai38-environment-runtime-r01.json',
    'inspection_fresh': 'docs/evidence/nodia-ai-ai38-environment-inspection-r02.json',
    'host_network': 'docs/evidence/nodia-ai-ai38-environment-host-network-r01.json',
    'retention_fresh': 'docs/evidence/nodia-ai-ai38-environment-retention-r02.json',
    'retention_inspector': 'docs/evidence/scripts/nodia-ai-ai38-environment-retention-inspect.py',
}

def criterion(id, status, scope, facts, missing, location, refs):
    return dict(id=id, status=status, scope=scope, confirmed=facts,
                outstanding=missing, remaining_work_location=location,
                evidence_ids=refs)

criteria = [
criterion('immutable_packages', 'probado', 'Artefactos congelados, no adopción permanente',
          'Server candidato01 y Client de 171 outputs tienen manifiestos y pines comprobados; instalación física fresca probada.',
          'El paquete completo no es el runtime operativo final.', 'none_for_artifact_scope', ['package','adoption','functional']),
criterion('authenticated_UI_and_drawer', 'probado', 'UI humana bajo túnel y activación temporal del candidato completo',
          'Login Google legítimo, identidad, historial, drawer, salida/vuelta y recarga profunda del candidato; viewport móvil sin overflow.',
          'No acredita origen público, teléfono físico o una generación nueva.', 'none_for_restricted_UI_scope', ['UI']),
criterion('rollback_read_continuity', 'probado', 'Lectura de historial desde SPA retenida después de revertir',
          'GET nuevos a API original y hashes DOM/SQL del chat iguales después del rollback.',
          'La raíz original devuelve 404; no se verificó recargar el shell revertido ni generar otro turno entre versiones.', 'VM', ['UI']),
criterion('deployment_and_rollback', 'parcial', 'Ensayo real A→B→A sin efectos comerciales ni trabajo activo',
          'Paquetes completos y procesos efectivos adoptados temporalmente; reversión exacta y cuatro servicios originales recuperados.',
          'Falta adopción permanente del objetivo ofrecido y drenaje de trabajo activo; el ensayo sólo detuvo consumidores quietos.', 'VM', ['adoption','UI']),
criterion('proxy_and_real_attachment_transport', 'probado', 'PUT binario de PDF sintético de 20 MiB, UI autenticada e integridad R2 privada',
          '20.971.520 bytes admitidos, +1 byte rechazado; borrador preservado; SHA/tamaño exactos en R2 y eliminación del objeto propio comprobada.',
          'No es descarga autenticada UI/API, envío de original de 20 MiB a Gemini, cuatro archivos/40 MiB agregados o garantía de borrado físico.', 'none_for_transport_scope', ['proxy']),
criterion('provider_text_routing_and_formats', 'parcial', 'Gemini real con selección High y época registrada; adaptador candidato y arneses',
          '17 solicitudes generativas con ACK: C05 delta, delegación Web→Agentic→Web y PNG/PDF/WAV/WebM en ambos modos.',
          'No equivale a una nueva generación end-to-end desde la UI autenticada sobre el paquete completo adoptado; cualquier cambio de época exige revisar atestaciones afectadas.', 'VM', ['functional','UI']),
criterion('published_capability_acceptance', 'parcial', 'Primer lote representativo C05 acumulado',
          '7/7 acumuladas: cuatro históricas no reejecutadas y tres nuevas en la época AI-38.',
          'No son siete reaceptadas en una única época ni aceptación de las 74 herramientas. AI-36 conserva 77 candidatas sin publicar.', 'AI36_and_VM', ['functional']),
criterion('human_confirmation_and_native_effect', 'parcial', 'UI/API/SQL y efecto financiero desechables; preparación MCP representativa real',
          'Revisión/hash/botón, gasto visible, cancelación y autoridad comprobados en entorno aislado; preparación real del modelo sin efecto comercial operativo.',
          'Falta recorrido generativo sobre candidato completo: preparación MCP→propuesta exacta→botón humano→efecto autorizado visible en la app, sin duplicación.', 'VM_after_AI36_publication', ['isolated_UI','functional','UI']),
criterion('authority_and_revocation', 'parcial', 'Casos HTTP/SQL aislados y sesión humana de super_admin',
          'Autoridad vigente y revocación probadas con actores fixture; UI autenticada acredita el acceso ordinario observado.',
          'No se heredó aceptación de todos los roles/módulos y revocación del entorno operativo usando sesiones legítimas equivalentes.', 'VM', ['isolated_UI','functional','UI']),
criterion('product_context_evolution', 'parcial', 'Compilador/PostgreSQL y dos procesos reales con dispatches sintéticos',
          'A termina con su contexto fijado, B no reclama ese trabajo y el próximo turno utiliza B con producto revisado/función nueva.',
          'No acredita hot reload, publicación/aprobación de un producto nuevo ni su uso generativo operativo. No modificar fichas aprobadas para fabricar aceptación.', 'VM_controlled_context_scenario', ['functional']),
criterion('encrypted_backup_and_isolated_restore', 'probado', 'Copia puntual de BD propia y restore desechable sin red o consumidores',
          'AES256/MDC, restore lógico de 62 tablas/29 migraciones y limpieza de copia/clave/unidades temporales verificados.',
          'No es rotación continua, restore operativo liberado o restore de versiones cloud con journal externo.', 'none_for_point_in_time_scope', ['backup','backup_cleanup','adoption','UI']),
criterion('backup_inventory_rotation_and_expiry', 'pendiente', 'Todas las copias propias capaces de reconstruir contenido NodiaAI',
          'Inventario fresco acotado encuentra 29 archivos .dump, 7.561.623 bytes y mtimes del 16 al 18 de octubre, sin abrirlos; no identifica cifrado/fecha real de captura. PostgreSQL observado: archive_mode off, cero slots, dos WAL/32 MiB. No apareció timer Nodia de backup/journal en unidades/paths seleccionados.',
          'Inventariar todos los destinos, snapshots, WAL/exportaciones; acreditar cifrado/acceso y máximo 7 días aplicado. Los mtimes no prueban captura, contenido o copias vencidas. No se concluye inexistencia global del mecanismo por esta observación.', 'VM_and_external_storage_or_hypervisor', ['retention_policy','retention_fresh','infrastructure_historical']),
criterion('external_deletion_journal_and_restore_reconciliation', 'pendiente', 'Cobertura externa íntegra de borrados desde captura hasta cuarentena',
          'Preparador aislado fail-closed valida manifiesto/head y mantiene incertidumbre; siempre release_authorized false.',
          'Falta acreditar productor continuo de todas las rutas de borrado, head externo confiable, expiración acotada e inventario/conciliación actual de dominio/runtime y generaciones ausentes del backup. No reconstruir cobertura desde backup o logs parciales ni inferir inexistencia global de un productor desde paths seleccionados.', 'implementation_plus_VM_and_external_journal', ['retention_policy','restore_contract','retention_fresh']),
criterion('storage_versions_and_cleanup_guarantee', 'parcial', 'Objeto vivo propio R2 eliminado en un ensayo',
          'HEAD/GET 404 y cero trabajos del objeto; no se borraron objetos ajenos o promovidos.',
          'Falta condición real de versionado/multipart, inventario aplicable y evidencia continua del objetivo de limpieza de 24 horas. Retención/borrado remoto de chats nativos del proveedor siguen desconocidos salvo contrato verificado y ownership; no borrar perfiles/chats ajenos. Ausencia del objeto vivo no acredita borrado físico de discos/WAL/copias del proveedor.', 'R2_provider_contract_and_VM', ['proxy','retention_policy','retention_fresh']),
criterion('public_origin_TLS_and_exposure', 'pendiente', 'Entrega pública del entorno de destino',
          'Inspección fresca: nginx sólo escucha en loopback sin directivas TLS/certificado; políticas INPUT DROP IPv4/IPv6. Host→IP privada: SSH acepta; puertos 80/443/3000/5432/6379/8000/8080 agotan plazo TCP, sin bytes de aplicación.',
          'Falta dominio/origen público elegido, TLS, cookies/OAuth/CORS allí y verificación desde Internet/IPv6. Los timeouts no prueban una regla de firewall particular ni el aislamiento desde todas las rutas.', 'external_target_and_network_plus_VM', ['inspection_fresh','host_network','UI']),
]

document = {
    'schema_version': 1, 'stage': 'AI-38',
    'status': 'offline_scope_review_with_fresh_receipts_environment_release_incomplete',
    'review_date': '2026-10-20', 'review_kind': 'offline_document_and_receipt_audit_not_new_operational_observation',
    'environment_id': 'linux_lab',
    'package_manifest_sha256': '0751160bb8cb146acec9dda21daa0226875a2c40f1c898a9c649e69a9583b8e3',
    'AI38_complete': False, 'AI36_complete': False, 'release_authorized': False,
    'productive_acceptance': False, 'documentation_approved': False,
    'offline_review_only': True, 'new_remote_operations': 0, 'new_provider_generations': 0,
    'historical_gate_counts_reused_as_current': False,
    'criteria': criteria,
    'counts_by_scoped_status': {status: sum(c['status']==status for c in criteria) for status in ['probado','parcial','pendiente']},
    'count_warning': 'Los estados corresponden a scopes diferentes y no son un porcentaje de cierre ni la matriz histórica de diez gates.',
    'C05_cohorts': {
        'historical_not_reexecuted': ['nodia_attachments_describe','nodia_operations_get','nodia_proposals_get','nodia_workflows_prepare'],
        'new_AI38_epoch': ['nodia_preferences_prepare','nodia_preferences_list','nodia_finance_movements_prepare_create'],
        'accumulated_representative': 7, 'all_seven_reaccepted_same_epoch': False,
        'published_capabilities': 74, 'remaining_unpublished_candidates': 77,
    },
    'fresh_operational_inspection': {
        'status': 'runtime_network_and_bounded_retention_receipts_bound_not_release_acceptance',
        'expected_paths': [],
        'source_ids': ['runtime_fresh','runtime_harness_failure','inspection_fresh','host_network','retention_fresh','retention_inspector'],
        'runtime_status': 'passed_read_only_runtime_snapshot_not_full_release_acceptance',
        'runtime_observed_at_utc': '2026-10-20T23:15:39.732265+00:00',
        'runtime_facts': 'Cuatro servicios originales activos, Node932 y época Gemini conservados, proxy scoped 20 MiB y cero pendientes en el instante R02.',
        'inspection_observed_at_utc': '2026-10-20T23:17:03.557864+00:00',
        'retention_observed_at_utc': '2026-10-20T23:18:06.062540+00:00',
        'retention_facts': {'bounded_dump_files': 29, 'bounded_dump_bytes': 7561623, 'dump_mtime_range_UTC_dates': ['2026-10-16','2026-10-18'], 'dump_contents_read': False, 'dump_capture_or_encryption_proven': False, 'dump_expiration_inferred': False, 'postgres_archive_mode': 'off', 'replication_slots': 0, 'WAL_files': 2, 'WAL_bytes': 33554432, 'global_absence_of_backup_or_journal_claimed': False},
        'network_limits': 'TCP privado sólo desde el host Windows; no tráfico HTTP, Internet ni IPv6. R01 de inspección no recuperó propiedades horarias; R02 corrigió el arnés de consulta y conserva NTP declarado yes/synchronized yes, sin cambiar relojes.',
        'prior_harness_failure': 'R01 ejecutó el inspector por stdin y no pudo hashear __file__; FileNotFoundError del arnés, sin mutación ni diagnóstico de fallo del runtime. R02 ejecutó el archivo exacto y pasó.',
        'claim_current_service_state_from_offline_review_alone': False,
    },
    'next_verifications': [
        'Inventario acotado y actual de servicios/listeners/nginx, mecanismos de backup/expiración/journal y red, sin copiar secretos ni contenidos.',
        'Contrastar mecanismos existentes con política 7 días y journal externo: distinguir ausencia comprobada en paths concretos de inexistencia global.',
        'Definir/implementar lo ausente antes de pretender probar rotación o continuidad; repetir un dump puntual no cierra ese gate.',
        'Programar aceptación generativa del paquete completo y efecto con botón sólo para capacidades publicadas y datos de prueba autorizados; preservar operación incierta y no replay.',
    ],
    'sources': {id: {'path': path, 'sha256': hashlib.sha256((ROOT/path).read_bytes()).hexdigest()} for id,path in sources.items()},
    'limitations': [
        'Auditoría semántica offline; no ejecución del viejo validador ni actualización de matrices históricas.',
        'SHA verifica los bytes enlazados, no honestidad del productor ni aceptación automática de otro entorno/época.',
        'API key y Codex son etapas propias; no bloquean por sí solos el alcance Gemini de AI-38 ni se habilitan como fallback.',
        'No se aprueba documentación, se publican herramientas ni se adoptan paquetes por esta revisión.',
    ],
}

def write(path, data):
    path.write_text(data, encoding='utf-8', newline='\n')

write(OUT/'nodia-ai-ai38-environment-current-r01.json', json.dumps(document, ensure_ascii=False, indent=2)+'\n')
lines = ['# AI-38 — Revisión actual por alcance del entorno Linux local', '',
'Fecha: 2026-10-20. **Revisión documental offline con recibos operativos nuevos enlazados**. Esta auditoría no efectúa operaciones remotas, aprueba documentación, autoriza entrega o cierra AI-38. Conserva los alcances de cada snapshot de runtime, configuración/red, TCP desde el host y conservación. Sucede al corte histórico de la matriz R03 sin modificarlo.', '',
'La aceptación ya no está bloqueada por el límite de proxy, el ingreso humano, el drawer o el ensayo A→B→A en sus alcances comprobados. Tampoco basta resolver infraestructura para cerrar la etapa: falta la aceptación generativa y de efectos del paquete completo ofrecido, la cobertura/publicación restante de AI-36 y las garantías de conservación/restauración del entorno.', '',
'## Criterios actuales', '', '| Criterio | Estado y alcance comprobado | Qué falta o qué no acredita |', '| --- | --- | --- |']
for c in criteria:
    lines.append(f"| `{c['id']}` | **{c['status']}**. {c['scope']}. {c['confirmed']} | {c['outstanding']} |")
lines += ['', 'Los estados describen alcances distintos; no son un porcentaje de cierre. Un «probado» restringido no pasa automáticamente un gate operativo más amplio.', '',
'## Dependencia de AI-36 y recorrido completo', '',
'El primer lote C05 suma **7/7 representativas acumuladas**: cuatro históricas (`attachments_describe`, `operations_get`, `proposals_get`, `workflows_prepare`) y tres nuevas (`preferences_prepare`, `preferences_list`, `finance_movements_prepare_create`). No fueron siete reaceptadas en una sola época. El catálogo candidato conserva 74 herramientas; **77 candidatas siguen sin publicar**. La aprobación y publicación selectiva permanecen explícitas.', '',
'Las verificaciones de Gemini real usan el adaptador candidato y arneses con datos desechables; la ventana de UI autenticada del paquete completo no produjo mensajes o generaciones nuevas. Falta el recorrido completo del objetivo entregado: lenguaje natural → MCP publicado → propuesta/revisión exacta → botón humano → efecto con recibo visible en la app → salir/volver, sin duplicación. Las pruebas aisladas de autoridad, revocación y contexto conservan su alcance, aunque la sesión humana y el shell ya hayan pasado.', '',
'## Trabajo realizable y dependencias externas', '',
'En la VM se puede avanzar con un inventario actual de servicios, listeners, nginx, jobs de backup/expiración y productor de journal; probar configuración y controles de cuarentena existentes; y preparar aceptación del candidato completo con datos propios de prueba. No hace falta repetir la subida de 20 MiB o las copias puntuales ya verificadas para descubrir esos huecos.', '',
'Cifrado y restore puntual están acreditados; **rotación continua y journal íntegro no lo están**. La política exige máximo siete días para todas las copias propias con contenido, identificadores mínimos de borrado fuera del backup sólo durante su horizonte y cuarentena sin replay. Un head inventado después de capturar una copia, un timer recién creado o un nuevo dump no demuestran historial continuo. La ausencia en un inventario acotado tampoco demuestra que no exista un mecanismo en otro host.', '',
'Los destinos de backup, snapshots del hipervisor, R2/versiones/multipart y red pública requieren sus configuraciones y observaciones propias. Sin un origen público elegido no se puede certificar TLS/OAuth/cookies/CORS/firewall de entrega pública. La VM local sigue siendo el primer entorno; API de pago y Codex conservan sus etapas separadas.', '',
'## Inspecciones nuevas y límites', '',
'El [snapshot runtime R02](nodia-ai-ai38-environment-runtime-r02.json), observado en la VM a las 23:15:39 UTC, acredita cuatro servicios originales activos, Node932, época Gemini y proxy scoped conservados, con cero pendientes en ese instante. R01 falló al ejecutar el inspector por stdin porque `__file__` no era un archivo hasheable; fue un `FileNotFoundError` del arnés, sin mutación o diagnóstico de fallo del runtime. R02 ejecutó el archivo exacto y pasó. La revisión no convierte ese snapshot en disponibilidad continua.', '',
'La [inspección nueva R02](nodia-ai-ai38-environment-inspection-r02.json), a las 23:17:03 UTC de la VM, conserva servicios/PID y nginx con una directiva de escucha loopback, sin TLS/certificados y con el scoped de 20 MiB/hash 2f96 intacto. Observa políticas INPUT DROP en ambas familias sin publicar reglas ni inferir su alcance efectivo. Declara NTP y sincronización activos; no corrige relojes ni demuestra sincronía entre hosts. R01 se conserva: su consulta de propiedades horarias quedó vacía y R02 corrige esa consulta, sin cambios de reloj.', '',
'El [sondeo TCP desde Windows](nodia-ai-ai38-environment-host-network-r01.json) acepta 22 y agota plazo en 80, 443, 3000, 5432, 6379, 8000 y 8080, enviando cero bytes de aplicación. Es la ruta privada host→VM; no verifica Internet, IPv6 o una regla concreta de firewall. Sus timestamps son del host desfasado y no se usan para ordenar eventos frente a la VM. No acredita HTTP, autenticación o inferencia.', '',
'La [inspección acotada de conservación R02](nodia-ai-ai38-environment-retention-r02.json), a las 23:18:06 UTC de la VM, encuentra 29 archivos `.dump`, 7.561.623 bytes y mtimes del 16 al 18 de octubre. No abre contenido o claves y no demuestra su cifrado, fecha de captura o expiración; no se clasifican como vencidos ni se eliminan. En unidades/cron/paths seleccionados no aparece un mecanismo específico Nodia de backup/journal. `dpkg-db-backup` y `systemd-journald` no acreditan esos contratos. Es una observación acotada, sin concluir inexistencia en otro path/host/destino.', '',
'PostgreSQL informa `archive_mode=off`, cero slots y dos archivos WAL de 32 MiB en total. No se interpreta el sentinel deshabilitado de `archive_command` como un comando de archivado configurado. Estos agregados no prueban destinos de archivo, ausencia de snapshots, recuperabilidad o purga física. La inspección conserva identidades de servicios y no cambia datos, relojes o configuraciones, ni consulta Hyper-V, R2 o proveedor.', '',
'No se certifican la retención ni el borrado remoto de chats del proveedor: sólo un contrato verificado del adaptador con ownership permitiría limpiar lo propio; no se borran perfiles o chats ajenos. Las nuevas observaciones locales no acreditan rotación, journal, versiones cloud, objetivo continuo de limpieza de 24 horas o exposición efectiva desde Internet.', '',
'## Procedencia y cortes históricos', '',
'El [JSON de esta revisión](nodia-ai-ai38-environment-current-r01.json) conserva los SHA-256 completos y la clasificación de cada criterio. Fuentes principales:', '']
for id,s in document['sources'].items():
    relative = Path(s['path']).relative_to('docs')
    href = '../'+relative.as_posix() if not s['path'].startswith('docs/evidence/') else Path(s['path']).relative_to('docs/evidence').as_posix()
    lines.append(f"- [{id}]({href}) — `{s['sha256']}`.")
lines += ['', 'La matriz Linux R03 y los runbooks iniciales contienen cortes anteriores al éxito MCP, la UI autenticada y el ajuste de 20 MiB. Sus razones y conteos se conservan históricamente; no deben presentarse como la fotografía actual. El encabezado de 84 describe el estado final sin adopción permanente y sus continuaciones detallan la adopción temporal; no confundir ambos hechos.', '',
'Se mantienen plan45, las 31 fichas aprobadas y la publicación c703. Este documento no reescribe contratos, aprueba fichas, publica herramientas o habilita tráfico.', '']
write(OUT/'nodia-ai-ai38-environment-current-r01.md', '\n'.join(lines))
print(json.dumps({'created': ['docs/evidence/nodia-ai-ai38-environment-current-r01.json','docs/evidence/nodia-ai-ai38-environment-current-r01.md'], 'counts': document['counts_by_scoped_status'], 'fresh_inspection': document['fresh_operational_inspection']['status']}))
