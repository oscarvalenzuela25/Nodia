import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
def read(path):
    return (ROOT / path).read_text(encoding='utf-8-sig')
def write(path, value):
    (ROOT / path).write_text(value, encoding='utf-8', newline='\n')
def append(path, value):
    source = read(path)
    assert '## Revalidación AI-32-R05' not in source
    write(path, source.rstrip() + '\n\n' + value.strip() + '\n')

for origin, target in [
    ('.tmp/ai32-r05-storage-code-validation.json', 'docs/evidence/nodia-ai-ai32-r05-storage-code-validation.json'),
    ('.tmp/ai32-r05-ui-before.json', 'docs/evidence/nodia-ai-ai32-r05-ui-before.json'),
    ('.tmp/ai32-r05-ui-layout.json', 'docs/evidence/nodia-ai-ai32-r05-ui-layout.json'),
    ('.tmp/ai32-r05-private-download-hashes.json', 'docs/evidence/nodia-ai-ai32-r05-private-download-hashes.json'),
]:
    write(target, json.dumps(json.loads(read(origin)), ensure_ascii=False, indent=2) + '\n')

flow = {
    'stage': 'AI-32-R05', 'scope': 'real_app_r2_worker_gemini_web_and_user_microphone',
    'status': 'passed', 'conversation_id': '33d6c32d-19a3-4533-8077-3ca7299d30cb',
    'run_id': 'a7ed643b-e1f2-4d07-98e2-c1e0a79759fb',
    'browser': 'ChatGPT in-app browser', 'origin': 'http://localhost:5174',
    'mode': 'token_plan_web', 'connection_id': 2, 'model_id': '56fdd199312815e2', 'effort': None,
    'capture': {'physical_microphone_user_confirmed': True, 'virtual_microphone_used': False,
        'user_started_and_stopped_capture': True, 'record_control_returned_to_idle': True,
        'track_release_directly_instrumented': False, 'media_type_decoded': 'audio/webm',
        'bytes': 99755, 'duration_seconds': 6.18,
        'sha256': '91160741102cef1bbf0edc84e8d5bd96f0a3107a112af8b8a4dccb974faa4652',
        'transcription_confirmed_by_user_after_response': True,
        'suggested_test_phrase_was_spoken': False},
    'originals': {'count': 3, 'kinds': ['image', 'pdf', 'audio'], 'upload_clicks': 3,
        'manual_interpretations_accepted': 0, 'original_parts_linked_once': True,
        'private_ui_downloads_completed': 3, 'download_hashes_match_sql_and_r2': True},
    'generation': {'send_clicks': 1, 'provider_dispatches': 1, 'tools': 0, 'delegations': 0,
        'run_state': 'completed', 'user_messages': 1, 'assistant_messages': 1,
        'internal_completed_stages': ['context', 'inference'],
        'expected_attachment_text_in_user_message': False,
        'image_text_matches_fixture': True, 'pdf_text_matches_fixture': True,
        'audio_semantics_user_confirmed': True, 'automatic_inference_replay': False},
    'persistence': {'reload_kept_response': True, 'reload_kept_three_references': True,
        'configuration_applied_after_reload': False,
        'availability_false_observed_after_reload': True,
        'availability_false_cause': 'not_observed',
        'explicit_metadata_recheck_restored_composer': True,
        'extra_provider_generations_for_recheck': 0},
    'layout': {'before_overflow_pixels': 398.140625, 'viewports_checked': [320,599,600,900,1440],
        'three_drafts_preserved_through_resize': True, 'horizontal_overflow': False,
        'composer_contained': True, 'send_action_keyboard_reachable': True,
        'viewport_override_reset': True, 'phone_or_virtual_keyboard_tested': False},
    'not_verified_in_this_run': ['real_chat_expiry_and_janitor_deletion',
        'real_r2_invoice_promotion_or_legacy_transfer', 'production_acceptance',
        'other_native_media_formats', 'agentic_generation_in_this_run'],
    'services_left_running': True, 'document_approval_granted': False,
}
write('docs/evidence/nodia-ai-ai32-r05-ui-flow.json', json.dumps(flow, ensure_ascii=False, indent=2)+'\n')

delivery = 'docs/mvp/78-nodia-ai-ai32-attachments-voice.md'
text = read(delivery)
text = text.replace('revalidaciones R01/R02/R03/R04: 2026-10-18.', 'revalidaciones R01/R02/R03/R04/R05: 2026-10-18.')
old = next(line for line in text.splitlines() if line.startswith('> Estado técnico:'))
text = text.replace(old, '> Estado técnico: R05 configura R2 y verifica desde la app PNG/PDF y voz grabada por el usuario con Gemini Web, descarga privada y persistencia. Corrige desbordamiento del compositor y PUT sin repetición automática en NodiaAI. R04 conserva la matriz nativa vigente; no hubo reinicio Gemini. Aceptación productiva, purga real por retención y copia a factura con R2 se distinguen del flujo de chat comprobado. R05 es el estado actual; las secciones previas conservan sus snapshots históricos.')
write(delivery, text)
append(delivery, '''## Revalidación AI-32-R05 — R2, micrófono y contención del compositor

[Consolidado R05](../evidence/nodia-ai-ai32-r05-validation.json) y [flujo de la app](../evidence/nodia-ai-ai32-r05-ui-flow.json). Se reutilizaron exclusivamente las cuatro variables R2 existentes en el entorno local ignorado, transferidas por stdin SSH al entorno privado de la VM. Respaldo privado, reemplazo atómico y conservación del resto de la configuración; reinicios sólo de API/worker, sin reiniciar Gemini ni nginx. No se publican valores, huellas de credenciales, bucket o URLs. [Activación de configuración](../evidence/nodia-ai-ai32-r05-r2-configuration.json).

El [canario final](../evidence/nodia-ai-ai32-r05-r2-canary-final.json) usa el adaptador compilado real: PUT200, GET200 con bytes/SHA exactos, DELETE204 y GET404/NoSuchKey del mismo objeto sintético. Sin listados ni enlaces firmados. Se conservan por separado el canario previo y el preflight fallido del despliegue, ocurrido antes de detener servicios. La [activación final](../evidence/nodia-ai-ai32-r05-r2-storage-activation.json) instala dos JS y cuatro mapas/declaraciones; 909 outputs verificados, los otros903 previos idénticos, sin migraciones o dependencias nuevas. Cloudflare documenta el [acceso S3](https://developers.cloudflare.com/r2/get-started/s3/) y [región auto](https://developers.cloudflare.com/r2/api/s3/api/); la app sigue pasando por la API autenticada, sin introducir acceso público o CORS directo.

### PUT sin repetición implícita

La revisión reprodujo que el SDK podía emitir tres PUT aun cuando la primera petición ya había persistido el objeto antes de responder503. StorageService conserva su cliente normal para facturas nativas, GET y DELETE; añade un cliente reutilizable con maxAttempts1 exclusivamente para uploadFileOnce, utilizado por el adaptador NodiaAI en subidas/promociones. Ambos clientes se cierran al destruir el módulo. No se muta configuración compartida por petición. [Doce comprobaciones](../evidence/nodia-ai-ai32-r05-storage-code-validation.json) con SDK real y HTTP sintético acreditan un único PUT NodiaAI ante resultado incierto/aborto y preservan los reintentos de los consumidores anteriores. El canario cloud observa la configuración; no dispone de un contador de peticiones recibidas por R2.

### App, voz física y persistencia

El usuario inició y detuvo la grabación desde el botón real de NodiaAI. voice.webm mide99.755 bytes, MIME decodificado audio/webm y6,18s. No se usó un micrófono virtual ni una voz sintetizada. La transcripción quedó vacía y no se aceptó ninguna interpretación antes de enviar; la extracción automática del PDF tampoco se aceptó. La frase que finalmente grabó fue distinta de la sugerida inicialmente; la respuesta de Gemini fue contrastada después con el usuario, que confirmó su coincidencia. No se introdujo el contenido esperado en el mensaje al proveedor.

La [proyección previa](../evidence/nodia-ai-ai32-r05-r2-app-uploads.json) confirma tres adjuntos ready y tres GET R2 con tamaños/hashes exactos. Una única pulsación de Enviar procesó PNG, PDF y el audio originales en un turno Web: texto de ambos documentos correcto y transcripción confirmada. [SQL posterior](../evidence/nodia-ai-ai32-r05-r2-app-after-run.json) muestra un mensaje del dueño, uno del asistente, tres referencias enlazadas una vez y provider_dispatches_used1. Las dos etapas internas completadas son contexto e inferencia; no representan dos inferencias. Cero herramientas, delegaciones o efectos de negocio.

Los [tres archivos descargados desde la UI](../evidence/nodia-ai-ai32-r05-private-download-hashes.json) coinciden con SQL y R2; recargar conserva respuesta y referencias. Tras la recarga se observó disponibilidad falsa sin causa exacta capturada. Una consulta compilada de la selección exacta mostró disponibilidad real y el botón existente Volver a comprobar la restauró en UI; no se aplicó configuración ni se generó otro turno. El resultado transitorio no se presenta como una sesión cerrada ni como un nuevo fallo de inferencia.

### Corrección visual y captura estable

El usuario detectó el compositor fuera de la tarjeta. La [medición anterior](../evidence/nodia-ai-ai32-r05-ui-before.json) muestra398px de desbordamiento con tres borradores. El Workspace limitado coexistía con un formulario que no podía contraerse. El compositor ahora comparte el scroll transparente de la página, puede reducir su altura y contiene todas sus acciones; Adjuntos elimina su scroll anidado. Chat admite minHeight0, la cabecera no se comprime y xs permite crecimiento natural sin maxHeight heredado. No se oculta el defecto con overflowhidden. [Geometría real](../evidence/nodia-ai-ai32-r05-ui-layout.json):320/599/600/900/1440px, sin desbordamiento horizontal, tres borradores conservados y formulario contenido; Enviar alcanzable por teclado. [Captura corregida](../evidence/nodia-ai-ai32-r05-ui-fixed.jpg) y [resultado](../evidence/nodia-ai-ai32-r05-ui-response.jpg). Navegador redimensionado, sin atribuir teclado virtual o teléfono físico.

Además, Cargar mensajes anteriores se bloquea durante la grabación: antes podía lanzar un refetch y descartar silenciosamente la nota. La regresión comprueba que no consulta/interrumpe la captura y que el borrador permanece al detenerla. No cambia la política de revocación ni el hook.

### Calidad, operación y límites

56 pruebas focales Client,50 casos de uso Server y12 comprobaciones SDK/HTTP correctos; tipado, lint afectado y builds correctos. Los fallos iniciales de prueba/CSSObject y del preflight permanecen registrados. No se reejecutaron las suites completas históricas ni Python: sus385 pruebas Linux/383 Windows+2 omisiones y la matriz nativa corresponden a R04, sin cambios Python en R05. La [salud final](../evidence/nodia-ai-ai32-r05-r2-final-health.json) verifica909 outputs Node/92 fuentes Gemini, API/worker/Gemini/nginx activos, HTTP200 y cero jobs/intentos/slots/resultados inciertos/pruebas nativas/temporales pendientes. No existe contador ACK observado: queda null, con cero pruebas terminales restantes.

R2 y micrófono físico cierran sus gates del flujo de chat en laboratorio. Esto no verifica por sí solo el janitor al expirar un chat, promoción/traslado legacy con R2 ni aceptación productiva; las pruebas SQL anteriores y los gates de AI-15/22 se conservan separados. AI-32 mantiene su casilla de aceptación abierta, sin aprobar documentos, ADR o fichas. Corpus55 fuentes/28 excluidas,67 lecturas/27 fragmentos sin publicación nueva. Servicios encendidos y chat de prueba conservado con su retención normal.
''')

progress = 'docs/mvp/00-progress.md'
text = read(progress)
entry = '- 2026-10-18: **AI-32-R05: R2 y micrófono físico verificados desde la app; compositor corregido.** [Entrega78](78-nodia-ai-ai32-attachments-voice.md#revalidación-ai-32-r05--r2-micrófono-y-contención-del-compositor) y [evidencia](../evidence/nodia-ai-ai32-r05-validation.json): configuración privada R2 existente activada; PUT/GET/hash/DELETE/404 real. PNG/PDF y voz WebM99.755B/6,18s completan un único turno Gemini Web con transcripción confirmada por el usuario, sin interpretación aceptada, replay o efectos. Tres descargas privadas exactas y recarga persistente. Compositor contenido con scroll único y borradores conservados en cinco anchos; historial bloqueado durante captura. NodiaAI PUT usa un intento SDK, sin alterar facturas nativas/GET/DELETE.56 Client,50 Server y12 checks SDK/HTTP, tipado/lint/builds correctos.909 outputs Node/92 fuentes Gemini; servicios activos y cero pendientes. R2/micrófono cierran sus gates de chat en laboratorio; retención/purga y copia a factura R2 no se extrapolan, aceptación productiva sigue pendiente. Corpus/publicación conservados y documentos sin aprobación automática.\n\n'
write(progress, text.replace('# Progreso del MVP — Nodia\n\n', '# Progreso del MVP — Nodia\n\n'+entry, 1))

index = 'docs/mvp/README.md'
text = read(index)
note = '\nEstado actual NodiaAI,2026-10-18: [AI-32-R05](78-nodia-ai-ai32-attachments-voice.md#revalidación-ai-32-r05--r2-micrófono-y-contención-del-compositor) verifica R2 y micrófono desde la app con Gemini Web, descarga privada y recarga; corrige desbordamiento del formulario. Aceptación productiva y pruebas cloud de purga/promoción siguen separadas.\n'
write(index, text.replace('# Especificación del MVP — Nodia\n', '# Especificación del MVP — Nodia\n'+note, 1))

plan = 'docs/mvp/45-nodia-ai-implementation-plan.md'
text = read(plan)
marker = '- [ ] **AI-33 —'
bullet = '  - [R05](../evidence/nodia-ai-ai32-r05-validation.json): R2 activado y canario PUT/GET/DELETE/404 real; PNG/PDF y micrófono WebM físico completan un turno Web sin texto revisado ni replay, con tres descargas privadas exactas y recarga. Corrige contención responsive del compositor y pérdida de captura al cargar historial. PUT NodiaAI usa un intento SDK; consumidores nativos conservados.56 Client,50 Server y12 checks SDK/HTTP;909 outputs Node/92 fuentes Gemini, servicios activos/cero pendientes. Gates R2/micrófono del chat cerrados en laboratorio; casilla abierta de aceptación, sin extrapolar a purga real90d, copia/legacy cloud o producción. Corpus y publicación intactos.\n'
assert marker in text
write(plan, text.replace(marker, bullet+marker, 1))

adr = 'docs/architecture/decisions/ADR-057-nodia-ai-attachment-lifecycle.md'
append(adr, '''## Revalidación AI-32-R05 — almacenamiento y compositor

El SDK no repite PUT de NodiaAI aunque haya persistencia previa a una respuesta perdida: cliente reutilizable con maxAttempts1, separado del cliente nativo de facturas/GET/DELETE, con cierre de ambos en shutdown. La intención durable conserva conciliación y compensación. HTTP sintético con SDK real prueba la no repetición; canario R2 y app verifican bytes exactos, no un contador cloud inexistente.

El compositor contiene su contenido con un scroll propio en pantallas desde600px, sin scroll adicional de Adjuntos; móvil crece naturalmente. No cambia ownership, mounts, revisión o autorización. R2 y micrófono físico confirmados en el flujo Web desde la app, sin atribuir esa prueba a retención, promoción o producción. [Entrega/evidencia R05](../../mvp/78-nodia-ai-ai32-attachments-voice.md#revalidación-ai-32-r05--r2-micrófono-y-contención-del-compositor). Estado propuesto conservado.
''')

for path in ['docs/nodia-ai/knowledge/nodia-ai/features/attachments-and-voice.md', 'docs/nodia-ai/knowledge/nodia-ai/README.md']:
    text = read(path)
    assert text.startswith('---\n')
    front, body = text[4:].split('\n---\n', 1)
    meta = json.loads(front)
    assert meta['document_status'] == 'draft' and meta['approval'] is None and meta['integration_status'] == 'unregistered'
    meta['revision'] += 1
    meta['implementation']['notes'] += ' R05 configura R2 real y verifica PNG/PDF y audio WebM grabado por el usuario desde la app con Gemini Web, descarga privada y recarga. PUT NodiaAI sin repetición SDK; compositor contenido y captura protegida al consultar historial. Purga/promoción cloud y producción no se dan por verificadas.'
    meta['verification']['evidence_paths'].append('docs/evidence/nodia-ai-ai32-r05-validation.json')
    meta['verification']['notes'] += ' R05:56 Client,50 casos de uso Server,12 checks SDK/HTTP; R2 y micrófono físico de app comprobados, sin nueva publicación.'
    body += '\n\n## Revalidación AI-32-R05\n\nR2 y voz física verificadas en el flujo Web desde la app, con originales sin interpretación aceptada, respuesta, descarga privada y recarga. El formulario mantiene contenido y acciones dentro del chat; cargar historial se bloquea durante captura. Evaluación de impacto visual: no cambia contratos, herramientas, permisos o significado de los datos. [Entrega R05](../../../mvp/78-nodia-ai-ai32-attachments-voice.md) documenta los límites; esta ficha permanece draft/unregistered y sin aprobación.\n'
    # Feature and product live at different depths.
    if '/features/' in path:
        body = body.replace('[Entrega R05](../../../mvp/', '[Entrega R05](../../../../mvp/')
    write(path, '---\n'+json.dumps(meta, ensure_ascii=False, indent=2)+'\n---\n'+body)

append('docs/nodia-ai/knowledge/README.md', '''## Revalidación AI-32-R05

[Entrega78](../../mvp/78-nodia-ai-ai32-attachments-voice.md#revalidación-ai-32-r05--r2-micrófono-y-contención-del-compositor) verifica R2, grabación física y lectura Web desde la app, descarga privada y recarga; corrige contención del formulario y captura durante consultas del historial. Se actualizan sólo borradores de producto y adjuntos/voz, sin aprobación o nuevos bindings. El ajuste visual no cambia permisos, herramientas ni semántica. Corpus55/28 y67 lecturas/27 fragmentos conservados; purga/promoción cloud y aceptación productiva separados.
''')

lab = 'docs/mvp/vps-local-vm-lab.md'
text = read(lab)
note = '\n## R2 y micrófono NodiaAI — actualización 2026-10-18\n\n[R05](78-nodia-ai-ai32-attachments-voice.md#revalidación-ai-32-r05--r2-micrófono-y-contención-del-compositor) configura R2 privado en el entorno de la VM con las cuatro variables existentes R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET_NAME; valores nunca en repositorio o frontend. Backup privado y activación API/worker; Gemini y nginx preservados. Canario real PUT/GET/hash/DELETE/404 y chat real PNG/PDF/audio del micrófono comprobados, con descarga privada y recarga. R2 ya no está ausente en este laboratorio; las menciones posteriores a R2 pendiente corresponden a snapshots históricos. No acredita automáticamente promoción/legacy cloud, purga al vencer ni producción. Frontend5174 y túnel3100 encendidos; secretos sólo en los entornos privados.\n'
write(lab, text.replace('# Ensayo de VPS en una VM Linux local\n', '# Ensayo de VPS en una VM Linux local\n'+note, 1))

design = 'nodia-client/DESIGN.md'
text = read(design)
text += '\n\n### 10.8 Contención del compositor de NodiaAI (2026-10-18)\n\nEn un chat de altura limitada, el formulario debe admitir contracción y minHeight0, con un scroll propio y acciones alcanzables; la cabecera no se comprime. El panel secundario de adjuntos comparte ese scroll en lugar de introducir otro anidado. En xs el workspace crece con el contenido, sin maxHeight heredado. No ocultar desbordamientos con overflowhidden ni remontar borradores al cambiar anchos. [R05](../docs/mvp/78-nodia-ai-ai32-attachments-voice.md#revalidación-ai-32-r05--r2-micrófono-y-contención-del-compositor) verifica tres borradores en320/599/600/900/1440px y Enviar alcanzable; geometría de navegador, sin afirmar teléfono/teclado virtual o mejora de performance. Cargar historial se bloquea durante grabación para evitar descartar la captura por un refetch iniciado por ese control.\n'
write(design, text)
print(json.dumps({'documents_updated': 10, 'feature_revision':6,'product_revision':30,'approval_changed':False},ensure_ascii=False))
