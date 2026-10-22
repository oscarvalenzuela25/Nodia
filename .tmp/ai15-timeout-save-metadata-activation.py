import json
from pathlib import Path
stage=Path('.tmp/ai15-timeout-deploy')
def read(name):return json.loads((stage/name).read_text(encoding='utf-8-sig'))
report={'preparation':read('server-metadata-preparation.json'),'activation':read('server-metadata-activation.json'),'metadata_reproduction_after_activation':{'for_feature_entities':48,'built_entity_metadata':48,'database_connected':False,'nest_application_initialized':False,'worker_started':False,'all_checked_targets_have_metadata':True,'targets':['Business','BusinessCollaborator','BusinessAction','Product','ProductLog','Provider','ProviderContact','Invoice','UserRole','Translation','AiProvider','AiApiKey','AiProviderCatalog','FinanceCategory']},'scope':'Runtime distribution updated atomically after a quiet preflight, preserving current provider proof and knowledge release. The archive package.json differs only in two known development test scripts; it was validated but deliberately not copied into the runtime release. No dependency change was made.'}
Path('docs/evidence/nodia-ai-ai15-timeout-worker-metadata-fix-activation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'evidence':'docs/evidence/nodia-ai-ai15-timeout-worker-metadata-fix-activation.json','json_valid':True}))
