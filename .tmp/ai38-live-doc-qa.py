from pathlib import Path
import hashlib,json,re,subprocess
root=Path(__file__).resolve().parents[1]
paths=['docs/evidence/nodia-ai-ai38-live-ui-r01.md','docs/mvp/84-nodia-ai-ai38-environment-acceptance.md','docs/nodia-ai/knowledge/nodia-ai/features/runtime-policy.md']
checked=0
for name in paths:
    source=root/name
    for ref in re.findall(r'\]\(([^)]+)\)',source.read_text(encoding='utf-8')):
        if ref.startswith(('https:','http:','#','app:')):continue
        target=(source.parent/ref.split('#')[0]).resolve()
        assert target.exists(),f'link_missing:{name}:{ref}'
        checked+=1
knowledge=subprocess.run(['node','scripts/build-nodia-ai-knowledge.mjs','--check'],cwd=root/'nodia-server',capture_output=True,text=True)
assert knowledge.returncode==0,knowledge.stderr
release=json.loads(knowledge.stdout)
assert release['releaseId']=='4189005373b4e6040a0e441d21c2978fe1d423ae568e53f74df1592e6f900130'
assert release['documents']==release['fragments']==31
ficha=(root/paths[2]).read_text(encoding='utf-8')
metadata=json.loads(ficha.split('---',2)[1])
assert metadata['revision']==15 and metadata['document_status']=='draft' and metadata['approval'] is None and metadata['integration_status']=='unregistered'
before=json.loads((root/'docs/evidence/nodia-ai-ai38-live-sql-reopened-r01.json').read_text())
closed=json.loads((root/'docs/evidence/nodia-ai-ai38-live-sql-closed-r01.json').read_text())
assert before['snapshot']==closed['snapshot'] and closed['global_quiet']=={'pending_jobs':0,'open_attempts':0,'retained_slots':0}
window=json.loads((root/'docs/evidence/nodia-ai-ai38-live-ui-close-r01.json').read_text())
assert window['status']=='passed' and window['API_worker_Gemini_restarted'] is False and window['scoped20m_preserved'] is True
tunnel=json.loads((root/'docs/evidence/nodia-ai-ai38-live-tunnel-close-r01.json').read_text(encoding='utf-8-sig'))
assert tunnel['status']=='passed' and tunnel['local_5174_listeners_after']==0 and tunnel['VM_services_stopped'] is False
record={'schema':'ai38-live-final-qa-v1','status':'passed','checked_local_links':checked,'knowledge_check':release,'draft_revision':15,'approval':None,'final_projection_unchanged_after_window_cleanup':True,'global_quiet':closed['global_quiet'],'window_closed':True,'VM_services_retained':True,'source_hashes':{name:hashlib.sha256((root/name).read_bytes()).hexdigest() for name in paths},'prior_metadata_check_failure':'evidence_paths exceeded32; references consolidated without relaxing schema or deleting historical evidence','runtime_requests':0}
dest=root/'docs/evidence/nodia-ai-ai38-live-final-qa-r01.json'
with dest.open('x',encoding='utf-8') as out:json.dump(record,out,indent=2)
print(json.dumps(record))
