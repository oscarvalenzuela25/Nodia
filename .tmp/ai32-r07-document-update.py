from pathlib import Path
import json
r=Path.cwd()
report=json.loads((r/'docs/evidence/nodia-ai-ai32-r07-late-put-cleanup.json').read_text(encoding='utf-8-sig'))
assert report['status']=='passed' and report['cleanup_complete']
seconds=report['real_purge_to_get404_elapsed_ms']/1000
files={}
def edit(p,fn):
 s=(r/p).read_text(encoding='utf-8'); v=fn(s); assert v!=s,p; files[p]=v
anchor='revalidación-ai-32-r07--aceptación-técnica-y-recuperación-tras-put-tardío'
lead=f'Estado actual NodiaAI,2026-10-18: [AI-32-R07](78-nodia-ai-ai32-attachments-voice.md#{anchor}) cierra técnicamente adjuntos y notas de voz en laboratorio: R04 modalidades exactas, R05 app/micrófono, R06 R2/purga/copias y R07 inspector fallido/cancelado y PUT posterior a expiración recuperado en otro proceso. Aceptación productiva, publicación MCP y pruebas integrales conservan AI-36..38 y sus gates propios.'
edit('docs/mvp/README.md',lambda s:'\n'.join(lead if line.startswith('Estado actual NodiaAI,2026-10-18:') else line for line in s.split('\n')))
progress=f'- 2026-10-18: **AI-32-R07: cierre técnico de adjuntos y notas de voz en laboratorio.** [Entrega78](78-nodia-ai-ai32-attachments-voice.md#{anchor}) y [evidencia R07](../evidence/nodia-ai-ai32-r07-validation.json) trazan los criterios originales a R04/R05/R06 y completan dos huecos: cuatro pruebas nuevas del inspector con hijo real controlado en Windows/Linux y PUT real posterior a expiración, recuperado por janitor en otro proceso. Ventana70s intacta; un PUT y un DELETE, GET404 tras{seconds:.2f}s reales como cota superior del caso, sin SLA. Diez checks SQL/R2 y nueve guardas offline; Windows389 ejecutadas,387 correctas+dos omisiones históricas. Fallo inicial de composición del arnés antes de inspector/PUT preservado y corregido sin cambiar aplicación. Objeto y SQL desechables retirados, chat R05 conservado, servicios activos/paridad909/92 y cero pendientes. **AI-32 marcado completado técnicamente; siguiente AI-33.** AI-15 descarga binaria, publicación MCP, AI-36..38 integral/operación/backups/aceptación conservan sus etapas. Fichas draft/ADR propuesto; sin aprobación documental ni publicación nueva.\n\n'
def update_progress(s):
 pos=s.find('- 2026-10-18:'); assert pos>=0
 return s[:pos]+progress+s[pos:]
edit('docs/mvp/00-progress.md',update_progress)
def update_plan(s):
 assert s.count('- [ ] **AI-32 —')==1
 s=s.replace('- [ ] **AI-32 —','- [x] **AI-32 —',1)
 target='- [ ] **AI-33 —'
 assert target in s
 entry=f'  - [R07](../evidence/nodia-ai-ai32-r07-validation.json): cierre técnico del alcance AI-32 en laboratorio. Matriz de aceptación consolidada en[78](78-nodia-ai-ai32-attachments-voice.md#{anchor}); R04/R05/R06 conservan sus alcances históricos. Completa inspector muerto/timeout/cancelación (cuatro casos Windows y Linux) y PUT que empieza después de purgar el chat, con otro proceso janitor y ventana real70s: diez checks SQL/R2, un PUT/un DELETE, GET404 en cota superior{seconds:.2f}s; nueve guardas offline. Windows387 correctas+dos omisiones históricas. Intento inicial DI del arnés fallido con0PUT conservado; corrección sólo de pruebas. Objeto/sandbox retirados, datos operativos intactos, cero inferencias/reinicios. Esta casilla expresa implementación y aceptación técnica del adaptador actual; no aprobación documental, publicación MCP ni aceptación productiva de AI-38. Versionado/multipart requieren revalidar el gate si se incorporan; no forman parte del transporte R2 PutObject actual.\n'
 return s.replace(target,entry+target,1)
edit('docs/mvp/45-nodia-ai-implementation-plan.md',update_plan)
section=f'''
## Revalidación AI-32-R07 — aceptación técnica y recuperación tras PUT tardío

[Consolidado R07](../evidence/nodia-ai-ai32-r07-validation.json). La revisión final separó los criterios de AI-32 de publicación/operación/aceptación por entorno previstas en AI-36..38. Los pendientes históricos de R2, micrófono y formatos ya estaban cubiertos por R04/R05/R06; restaban dos combinaciones de fallo de [política50](50-nodia-ai-ai04-runtime-policy.md): ciclo del proceso inspector y expiración durante PUT con recuperación tras reiniciar el proceso de mantenimiento. No se añaden funcionalidades ni se cambian contratos de aplicación.

| Criterio de AI-32 | Evidencia y resultado |
|---|---|
| M3, intención antes de PUT, identidad, ownership, cuotas y revisión inmutable | [SQL original](../evidence/nodia-ai-ai32-sql-validation.json) y casos de uso; resultados históricos, no reejecutados en R07 |
| Firma, bytes, duración/páginas/píxeles y aislamiento del decoder | [Inspector original](../evidence/nodia-ai-ai32-parser-validation.json); el nuevo test de lifecycle no sustituye esa prueba de contenido/aislamiento |
| Modalidades por selección exacta y archivo+MCP Agentic | [R04](../evidence/nodia-ai-ai32-r04-validation.json), más [app Web R05](../evidence/nodia-ai-ai32-r05-validation.json); sólo formatos acreditados, sin extender PNG a JPEG ni WAV a otros audio |
| Micrófono físico, descarga privada, recarga y compositor | R05; transcripción confirmada por el usuario, sin exigir otra grabación |
| Purga, DELETE incierto, copias independientes, reemplazo y traslado legacy | [R06](../evidence/nodia-ai-ai32-r06-validation.json); copias de factura sobreviven al chat |
| Hijo inspector fallido, timeout y cancelación | [R07 inspector](../evidence/nodia-ai-ai32-r07-inspector-validation.json): cuatro pruebas nuevas correctas en Windows y Linux |
| PUT posterior a purga y recuperación en otro proceso | [R07 upload](../evidence/nodia-ai-ai32-r07-late-put-upload.json) y [cleanup](../evidence/nodia-ai-ai32-r07-late-put-cleanup.json): diez comprobaciones SQL/R2 correctas |
| Instrucciones recuperadas no conceden autoridad | Extracción sin revisión rechazada en SQL y barreras de confirmación/ejecución del gateway; no se publica un escritor por interpretar un archivo |

### Inspector y subida tardía

Las pruebas nuevas ejecutan receive/decode con procesos Python hijos reales y programas sintéticos controlados. Comprueban exit no exitoso, timeout, cancelación durante communicate y durante spawn: el hijo termina/se espera, el temporal queda vacío y ambos cupos vuelven a estar disponibles. El timeout de15s se comprime a0,05s sólo en el fixture, y el guard de plataforma se adapta sólo dentro del test Windows; no se atribuye seccomp o decodificación real al hijo sintético. Cuatro casos correctos en cada plataforma; suite completa Windows389 ejecutadas,387 correctas y dos omisiones históricas. Linux ejecutó los cuatro nuevos en un contenedor temporal de la imagen vigente con red deshabilitada; sus385 pruebas completas previas son evidencia R04, no una suite completa nueva. Producción Python permanece intacta.

El arnés de almacenamiento utiliza los casos de uso compilados vigentes, inspector HTTP privado y R2 reales, sobre PostgreSQL desechable con26 migraciones. Suspende la llamada antes del SDK PUT, expira el único chat sintético mediante el caso de uso real y comprueba el commit de purga antes de liberar un único PUT. R2 devuelve el contenido exacto, pero el upload no puede republicar ready porque el chat/adjunto ya no existen. Sólo sobrevive el job mínimo por generación. El primer proceso cierra sus recursos; otro PID reconstruye el janitor y recupera exclusivamente esa identidad durable, sin subir nuevamente.

No se alteran los deadlines de upload/job: se respeta la ventana real de70s del contrato, incluso para limpieza manual. Un DELETE y GET404/NoSuchKey cierran el objeto; otro intento ya asentado no repite DELETE. La cota superior monotónica medida desde antes de invocar la purga hasta GET404 fue **{seconds:.2f}s**; la evidencia conserva también la cota inferior desde el ACK de purga. Es tiempo realmente transcurrido en el mismo boot, no la edad preparada del fixture. Cumple el objetivo24h para este caso puntual; no acredita SLA, frecuencia del scheduler,90 días transcurridos ni tolerancia a todos los fallos remotos.

El [intento inicial](../evidence/nodia-ai-ai32-r07-late-put-upload-attempt01.json) falló al componer proveedores del arnés: el módulo padre no podía inyectar la política importada por AttachmentModule. Se preservan fuente y reporte; cero inspector/PUT/DELETE. La [verificación posterior](../evidence/nodia-ai-ai32-r07-di-failure-state.json) confirmó SQL vacío y ledger ausente. La corrección instancia los casos de mantenimiento como en R06, sin cambiar exports/DI de la aplicación. El segundo intento sí ejecutó ambas fases. Nueve [guardas offline](../evidence/nodia-ai-ai32-r07-late-put-guards.json) cubren namespace, colisiones, fallo de lectura/gate, PUT incierto sin replay y rechazo de un ledger ya existente; la revisión corrigió las salidas del arnés antes de la prueba cloud.

### Aplicabilidad del almacenamiento y cierre

El adaptador vigente usa una key inmutable por generación y un PutObject único; no inicia multipart. La [compatibilidad S3 oficial de R2](https://developers.cloudflare.com/r2/api/s3/api/) consultada el2026-10-18 marca GetBucketVersioning/PutBucketVersioning como no implementadas. No se consultó ni cambió configuración de buckets, ni se listaron objetos/versiones. La generación propia de Nodia no se presenta como un VersionId S3. El criterio de versiones/multipart de política50 conserva aplicación condicional: cambiar de backend o incorporar esos protocolos exige verificar su limpieza antes de habilitarlos; este cierre no certifica almacenamiento versionado ni copias internas del proveedor.

[Teardown](../evidence/nodia-ai-ai32-r07-sandbox-cleanup.json) y [preservación del chat R05](../evidence/nodia-ai-ai32-r07-configured-chat-preservation.json): objeto propio ausente, base/contenedor/descriptor/ledger de prueba retirados; los tres adjuntos, revisión/epoch y único dispatch anteriores permanecen idénticos. [Salud final R07](../evidence/nodia-ai-ai32-r07-final-health.json): servicios activos, HTTP200, paridad909 Node/92 fuentes Gemini y cero pendientes, sin reinicios. Health/paridad no equivalen a nueva autenticación ni inferencia; los canarios de modelos conservan las selecciones y fechas R04/R05. Cero inferencias y cambios de datos operativos en R07.

**AI-32 queda cerrado técnicamente para el alcance implementado en laboratorio**, y el plan marca esa casilla. Las aprobaciones documentales permanecen sin cambios: entrega en revisión, fichas draft/unregistered y ADR-057 propuesto. Corpus55 fuentes/28 excluidas,67 lecturas/27 fragmentos y release6c4f conservados, sin publicación MCP. Siguiente desarrollo AI-33, preferencias aceptadas.

Siguen en sus etapas: descarga binaria nativa de factura AI-15, publicación/aceptación integral de dominios AI-36, carga/drain/observabilidad AI-37, backups/restore y retención remota AI-36/38, aceptación productiva por entorno AI-38. No se exige completar esas etapas futuras para volver a demostrar los adjuntos de AI-32, ni se declaran ya completadas.
'''
def update78(s):
 assert '## Revalidación AI-32-R07' not in s
 s=s.replace('revalidaciones R01/R02/R03/R04/R05/R06:','revalidaciones R01/R02/R03/R04/R05/R06/R07:',1)
 lines=s.split('\n')
 for i,line in enumerate(lines):
  if line.startswith('> Estado técnico:'):
   lines[i]='> Estado técnico: R07 cierra AI-32 en laboratorio tras completar lifecycle del inspector y PUT posterior a expiración con limpieza en otro proceso. R04/R05/R06 conservan formatos, app/micrófono y purga/copias R2. Sin cambios de aplicación ni inferencias en R07; aceptación productiva/publicación mantienen sus etapas propias. La revisión documental no se aprueba automáticamente.'
   break
 return '\n'.join(lines).rstrip()+'\n\n'+section.strip()+'\n'
edit('docs/mvp/78-nodia-ai-ai32-attachments-voice.md',update78)
common=f'R07 cierra técnicamente AI-32 en laboratorio: cuatro casos nuevos de lifecycle del inspector correctos Windows/Linux; diez checks SQL/R2 sobre PUT posterior al commit de expiración y janitor en PID distinto, sin modificar ventana70s. Un PUT/un DELETE y GET404 en cota superior real{seconds:.2f}s; nueve guardas offline. Falla inicial de montaje DI del arnés antes de PUT preservada, corregida sólo en pruebas. Sin código/configuración/migraciones/inferencias de aplicación nuevos; base y objeto sintéticos retirados, chat R05 intacto. No prueba SLA/producción ni publica MCP. [Entrega78]({{link}}) y [consolidado R07]({{evidence}}).'
for p,link,ev in [
 ('docs/mvp/vps-local-vm-lab.md','78-nodia-ai-ai32-attachments-voice.md#'+anchor,'../evidence/nodia-ai-ai32-r07-validation.json'),
 ('docs/architecture/decisions/ADR-057-nodia-ai-attachment-lifecycle.md','../../mvp/78-nodia-ai-ai32-attachments-voice.md#'+anchor,'../../evidence/nodia-ai-ai32-r07-validation.json'),
 ('docs/nodia-ai/knowledge/README.md','../../mvp/78-nodia-ai-ai32-attachments-voice.md#'+anchor,'../../evidence/nodia-ai-ai32-r07-validation.json')]:
 edit(p,lambda s,link=link,ev=ev:s.rstrip()+'\n\n## Revalidación técnica AI-32-R07\n\n'+common.replace('{link}',link).replace('{evidence}',ev)+' Fichas y ADR conservan sus aprobaciones previas; el build de conocimiento no publica borradores.\n')
notes='R07 completa lifecycle del inspector (hijo muerto/timeout/cancelación, cuatro casos Windows/Linux) y expiración durante PUT con recuperación R2 en otro proceso y ventana70s real. Cierre técnico AI-32 en laboratorio; aceptación productiva/publicación separadas, sin aprobar la ficha.'
for p,rev,bodylink,evlink in [
 ('docs/nodia-ai/knowledge/nodia-ai/README.md',32,'../../../mvp/78-nodia-ai-ai32-attachments-voice.md#'+anchor,'../../../evidence/nodia-ai-ai32-r07-validation.json'),
 ('docs/nodia-ai/knowledge/nodia-ai/features/attachments-and-voice.md',8,'../../../../mvp/78-nodia-ai-ai32-attachments-voice.md#'+anchor,'../../../../evidence/nodia-ai-ai32-r07-validation.json')]:
 def fiche(s,rev=rev,bodylink=bodylink,evlink=evlink):
  _,raw,body=s.split('---',2); d=json.loads(raw)
  assert d['revision']==rev-1 and d['approval'] is None and d['document_status']=='draft' and d['integration_status']=='unregistered'
  d['revision']=rev;d['implementation']['notes']+=' '+notes
  d['verification']['notes']+=' R07: diez checks SQL/R2, nueve guardas offline y cuatro tests nuevos por plataforma; Windows387 correctos+dos omisiones. Un objeto y sandbox de prueba retirados; cero cambios operativos/inferencias.'
  d['verification']['checked_on']='2026-10-18';d['verification']['evidence_paths'].append('docs/evidence/nodia-ai-ai32-r07-validation.json')
  return '---\n'+json.dumps(d,ensure_ascii=False,indent=2)+'\n---'+body.rstrip()+'\n\n## Cierre técnico AI-32-R07\n\n'+notes+' [Entrega]('+bodylink+') y [evidencia]('+evlink+'). Las modalidades mantienen sus pruebas exactas R04/R05; R07 no añade inferencia ni disponibilidad.\n'
 edit(p,fiche)
assert len(files)==9
for p,s in files.items():
 assert '\ufffd' not in s
 (r/p).write_text(s,encoding='utf-8',newline='\n')
print(json.dumps({'stage':'AI-32-R07','documents_updated':len(files),'approval_changed':False,'technical_ai32_checkbox_closed':True}))
