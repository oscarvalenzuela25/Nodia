from pathlib import Path
import json,re
root=Path('C:/Users/Oscar/Desktop/Nodia')
full=(root/'nodia-client/.tmp/ai25-client-full-release.log').read_text(encoding='utf-8')
focal=(root/'nodia-client/.tmp/ai25-client-focused-final.log').read_text(encoding='utf-8')
def metrics(log):
 files=re.search(r'Test Files\s+(\d+) passed \((\d+)\)',log)
 tests=re.search(r'Tests\s+(\d+) passed \((\d+)\)',log)
 duration=re.search(r'Duration\s+([\d.]+)s',log)
 assert files and tests and duration and files[1]==files[2] and tests[1]==tests[2],log[-500:]
 return int(tests[1]),int(files[1]),float(duration[1])
ct,cf,cd=metrics(full); ft,ff,fd=metrics(focal)
ct_display=f'{ct:,}'.replace(',','.')
runtime=json.loads((root/'docs/evidence/nodia-ai-ai25-lab-runtime.json').read_text(encoding='utf-8'))
activation=json.loads((root/'docs/evidence/nodia-ai-ai25-lab-activation.json').read_text(encoding='utf-8'))
equality=json.loads((root/'docs/evidence/nodia-ai-ai25-deployed-equality.json').read_text(encoding='utf-8'))
knowledge=json.loads((root/'docs/evidence/nodia-ai-ai25-knowledge-validation.json').read_text(encoding='utf-8'))
assert runtime['production_executor_registrations']==38 and runtime['pending_jobs']==0 and equality['deployed_matches_final_archive']
assert knowledge['sourceDocuments']==48 and knowledge['excludedDocuments']==21 and knowledge['publishedCapabilities']==67 and knowledge['publishedFragments']==27
p=root/'docs/mvp/71-nodia-ai-ai25-rental-reservation-lifecycle.md'; text=p.read_text(encoding='utf-8')
text=text.replace('> Estado técnico: implementación y verificación en curso; preparadores MCP de escritura sin publicar y aceptación de escrituras con Gemini pendiente.','> Estado técnico: implementado y verificado en laboratorio privado; preparadores MCP de escritura sin publicar y aceptación de escrituras con Gemini pendiente.')
start=text.index('## Verificación y pendientes')
text=text[:start]+f'''## Verificación y pendientes

- Client: suite completa **{ct_display} pruebas/{cf} archivos**,{cd:.2f}s con2workers; focal **{ft}/{ff}**,{fd:.2f}s; tipado/lint correctos y build11,49s. Los logs finales están en `nodia-client/.tmp/ai25-client-full-release.log`, `ai25-client-focused-final.log`, `ai25-client-typecheck-final.log`, `ai25-client-lint-final.log` y `ai25-client-build-final.log`. El build mantiene el aviso histórico de chunks mayores a500kB y la suite cuatro avisos JSDOM de navegación sin fallos. No se añaden dependencias ni rutas.
- Regresión de Client: seis operaciones traducidas, IDs/importes exactos, CLP explícito, estados/canales localizados, approvals/plataforma readonly y cancelación separada de devolución efectiva. Los controles temporales rechazan fecha imposible/DST inexistente sin perder borrador; otro campo no reescribe el offset/instante original. Se verificó el cero permitido por metadata bigint min0, límites, decimales/signos/exponentes no admitidos y overflow sin convertir dinero a Number. Los límites positivos de Finanzas siguen aplicándose por metadata.
- [QA sintético de interfaz](../evidence/nodia-ai-ai25-ui-validation.json): **7 comprobaciones y3 capturas**. Fecha inválida2026-02-30 retenida, corrección2026-11-02 y foco al solicitar viewport390×844; guardado produce revisión2/hash/toast. Editar sólo resolución conserva instante2026-10-17T12:30:00.000Z y devolución0; recibo EN conserva bigint9007199254740994 y enlace real. Tab temporal cerrado, viewport restablecido y servicio5194 detenido. No acredita teléfono físico, SQL ni proveedor.
- Server: **2.487 pruebas/192 archivos**,197,53s. Casos de uso nativos, preparación, snapshots, contratos cerrados, composición, permisos y recibos; revisión material del acuerdo, disponibilidad, dinero y fase sin abrir una segunda transacción del dominio.
- [SQL/HTTP/worker AI-25](../evidence/nodia-ai-ai25-postgresql.json): **39 comprobaciones nuevas**, sobre las seis operaciones, disponibilidad, mínimos, acuerdo/anticipo/plataforma, tiempo/preparación, autoridad, snapshots, rollback y recuperación. [Regresiones](../evidence/nodia-ai-ai25-regressions.json): **227 comprobaciones**, incluidas282 peticiones HTTP nativas de Reservas. Total266. Usan PostgreSQL desechable y procesos compilados; cero inferencias y sin escrituras MCP publicadas. El intento inicial fallido por referencia Airbnb sintética repetida se conserva y se corrigió sólo en el harness.
- [Paridad del compilado probado](../evidence/nodia-ai-ai25-tested-release-parity.json):828 archivos dist idénticos entre paquete probado `d36ac0b2a9aeb99d93027cf25c1895db2745fbc7d371c5024e8896559e6d720e` y paquete final `{equality['archive_sha256']}`. El único cambio del paquete es el helper de referencia sintética del harness, cuya versión final es la realmente probada.
- [Backup y activación](../evidence/nodia-ai-ai25-lab-activation.json): backup real de{activation['backup_bytes']:,}B, SHA256 `{activation['backup_sha256']}`; API/worker activos, health200 y configuración/dependencias/perfil conservados. Sin reinicio de Gemini ni migraciones, tablas o columnas nuevas. [Igualdad del despliegue](../evidence/nodia-ai-ai25-deployed-equality.json):828 dist coinciden con el paquete final.
- [Runtime configurado](../evidence/nodia-ai-ai25-lab-runtime.json):25 migraciones,18 tablas NodiaAI/241 columnas,38 ejecutores internos y0 jobs/intentos/slots pendientes. [Conocimiento](../evidence/nodia-ai-ai25-knowledge-validation.json):53 comprobaciones,48 fuentes/21 excluidas y67 lecturas/27 fragmentos conservados; pin `{knowledge['releaseId']}`. [Delta](../evidence/nodia-ai-ai25-knowledge-delta.json) conserva documentos aprobados, fragmentos y contratos, cambiando sólo digest del registry y release.
- Publicación MCP de escrituras y aceptación con Gemini: pendientes independientes. Un executor registrado no publica una herramienta ni demuestra inferencia.
- Documento y ficha: en revisión, sin aprobación automática. AI-15/22/32 mantienen sus gates independientes; el siguiente bloque de desarrollo es AI-26.

La evidencia de laboratorio privado y las fixtures no equivalen a aceptación productiva pública. Los registros del dominio conservan su política nativa y las escrituras por lotes siguen excluidas de v1.
'''
p.write_text(text,encoding='utf-8')
p=root/'docs/nodia-ai/knowledge/reservations/features/confirmed-reservation-lifecycle.md'; text=p.read_text(encoding='utf-8'); _,raw,body=text.split('---',2); data=json.loads(raw)
data['implementation']={'status':'implemented','notes':'AI-25 implementa y verifica en laboratorio privado seis puertos internos de reservas/ciclo comercial, reutilizando casos de uso nativos, revisión exacta y recibo atómico. Preparadores MCP sin publicar y aceptación de escrituras Gemini pendiente; dinero/bloqueos/preparación conservan AI-26.'}
data['verification']={'checked_on':'2026-10-17','evidence_paths':['docs/mvp/71-nodia-ai-ai25-rental-reservation-lifecycle.md','docs/evidence/nodia-ai-ai25-postgresql.json','docs/evidence/nodia-ai-ai25-regressions.json','docs/evidence/nodia-ai-ai25-ui-validation.json','docs/evidence/nodia-ai-ai25-tested-release-parity.json','docs/evidence/nodia-ai-ai25-lab-activation.json','docs/evidence/nodia-ai-ai25-deployed-equality.json','docs/evidence/nodia-ai-ai25-lab-runtime.json','docs/evidence/nodia-ai-ai25-knowledge-validation.json'],'notes':f'Server2487/192, Client{ct}/{cf}, focal{ft}/{ff};266 checks SQL/HTTP/procesos (39 nuevos+227 regresiones,282 HTTP nativas), tipado/lint/build y7 checks QA sintéticos. Laboratorio privado activo con38 ejecutores,25 migraciones/18 tablas NodiaAI/241 columnas y0 pendientes, sin esquema nuevo. Draft/unregistered y approvalnull; no publica MCP ni acredita escritura Gemini.'}
body=body.replace('- [ ] Preparadores/ejecutores y contratos comprobados mediante tests de casos de uso.','- [x] Preparadores/ejecutores y contratos comprobados mediante tests de casos de uso.')
body=body.replace('- [ ] Disponibilidad, acceso, atomicidad y recuperación verificados con PostgreSQL/HTTP/worker reales.','- [x] Disponibilidad, acceso, atomicidad y recuperación verificados con PostgreSQL/HTTP/worker reales sobre bases desechables.')
body=body.replace('- [ ] Client y QA ES/EN/móvil comprobados con fixtures identificadas.','- [x] Client y QA ES/EN/móvil comprobados con fixtures identificadas; no teléfono físico.')
p.write_text('---\n'+json.dumps(data,ensure_ascii=False,indent=2)+'\n---'+body,encoding='utf-8')
p=root/'docs/nodia-ai/knowledge/reservations/README.md'; text=p.read_text(encoding='utf-8'); _,raw,body=text.split('---',2); data=json.loads(raw)
data['implementation']['notes']='21 lecturas publicadas desde nueve fichas. AI-24 verifica seis puertos internos de configuración y AI-25 seis de reservas/ciclo comercial, con confirmación exacta, recibos y recuperación. Este resumen y ambas fichas conservan draft/unregistered; preparación MCP y aceptación Gemini de escrituras pendientes. Dinero, bloqueos y preparación conservan AI-26.'
data['verification']['evidence_paths'] += [p for p in ['docs/mvp/71-nodia-ai-ai25-rental-reservation-lifecycle.md','docs/evidence/nodia-ai-ai25-postgresql.json','docs/evidence/nodia-ai-ai25-regressions.json','docs/evidence/nodia-ai-ai25-ui-validation.json','docs/evidence/nodia-ai-ai25-lab-runtime.json','docs/evidence/nodia-ai-ai25-knowledge-validation.json'] if p not in data['verification']['evidence_paths']]
data['verification']['notes']+=f' AI-25: Server2487/192, Client{ct}/{cf},266 comprobaciones SQL/HTTP/procesos y7 QA sintéticas. Lab privado con38 ejecutores y0 pendientes; no crecimiento de esquema ni publicación MCP/escrituras Gemini.'
body=body.replace('Seis puertos internos en implementación/verificación','Seis puertos internos implementados/verificados en laboratorio privado')
body=body.replace('AI-25 incorpora el ciclo comercial y conserva verificaciones en curso;', 'AI-25 verifica el ciclo comercial;')
body=body.replace('Implementación y verificaciones en curso; no se acredita despliegue o escritura Gemini.',f'Implementación y laboratorio privado verificados: Server2487/192, Client{ct}/{cf},266 comprobaciones SQL/HTTP/procesos y7 QA sintéticas;38 ejecutores y0 pendientes, sin esquema nuevo. No se acredita publicación MCP o escritura Gemini.')
p.write_text('---\n'+json.dumps(data,ensure_ascii=False,indent=2)+'\n---'+body,encoding='utf-8')
p=root/'docs/nodia-ai/knowledge/README.md'; text=p.read_text(encoding='utf-8').replace('registra seis puertos internos y sus verificaciones en curso;', 'registra seis puertos internos verificados en laboratorio privado;')
p.write_text(text,encoding='utf-8')
print(json.dumps({'client_full':{'tests':ct,'files':cf,'seconds':cd},'client_focal':{'tests':ft,'files':ff,'seconds':fd},'documents_updated':4,'approval_changed':False},ensure_ascii=False,indent=2))
