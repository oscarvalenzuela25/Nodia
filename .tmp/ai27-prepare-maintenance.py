from pathlib import Path
import json
root=Path(__file__).resolve().parents[1]
source='docs/nodia-ai/knowledge/general-settings/features/confirmed-administration.md';assert(root/source).is_file()
p=root/'nodia-server/config/nodia-ai-knowledge.registry.json';r=json.loads(p.read_text(encoding='utf-8'));r['source_paths']=sorted(set(r['source_paths']+[source]));p.write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
p=root/'docs/evidence/scripts/validate-nodia-ai-ai06.cjs';s=p.read_text(encoding='utf-8')
s=s.replace('through AI-26','through AI-27').replace("read('docs/evidence/nodia-ai-ai25-validation.json')","read('docs/evidence/nodia-ai-ai26-validation.json')")
s=s.replace("const previousRegistry =", "const coreDraftSource = '"+source+"';\n        const previousRegistry =")
s=s.replace('![moneyDraftSource, preparationDraftSource].includes(source)','![coreDraftSource].includes(source)')
s=s.replace('AI-26 changed published knowledge or contracts beyond indexing two excluded drafts','AI-27 changed published knowledge or contracts beyond indexing one excluded draft')
s=s.replace('corpus.counts.sources, 50','corpus.counts.sources, 51').replace('corpus.counts.excluded, 23','corpus.counts.excluded, 24').replace('registry.source_paths.length, 50','registry.source_paths.length, 51').replace('currentEvidence.knowledge.sources, 48','currentEvidence.knowledge.sources, 50').replace('currentEvidence.knowledge.excluded_drafts, 21','currentEvidence.knowledge.excluded_drafts, 23')
s=s.replace("[preparationDraftSource, 'reservations.confirmed-occupancy-preparation'],", "[preparationDraftSource, 'reservations.confirmed-occupancy-preparation'],\n          [coreDraftSource, 'general-settings.confirmed-administration'],")
p.write_text(s,encoding='utf-8')
p=root/'docs/mvp/nodia-ai-v1-data-model.json';m=json.loads(p.read_text(encoding='utf-8'));m['execution']['localCoreAdministration']={'implementedIn':'AI-27','nativeOperations':17,'resources':['users','roles','actions','business_actions','modules','module_groups'],'newTables':0,'newColumns':0,'newMigrations':0,'sourceDocument':'docs/mvp/73-nodia-ai-ai27-core-administration.md','note':'Exclusive authority transaction inherited by native writers; atomic existing execution receipt. No new ledger or permission store.'};p.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
p=root/'nodia-server/package.json';m=json.loads(p.read_text(encoding='utf-8'));m['scripts']['test:nodia-ai:core-administration']='npm run build && node test/nodia-ai-ai27.integration.mjs';p.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
p=root/'nodia-server/scripts/package-nodia-ai-lab-release.mjs';s=p.read_text(encoding='utf-8');needle="'test/nodia-ai-ai26-worker.fixture.mjs',";assert needle in s;s=s.replace(needle,needle+"\n    'test/nodia-ai-ai27.integration.mjs',\n    'test/nodia-ai-ai27-worker.fixture.mjs',");p.write_text(s,encoding='utf-8')
p=root/'docs/evidence/scripts/validate-nodia-ai-catalog-contracts.cjs';s=p.read_text(encoding='utf-8').replace("validations.size,136,'AI-26", "validations.size,137,'AI-27").replace("reconciledThrough:'AI-26'","reconciledThrough:'AI-27'")
needle="check('Selection',{...sample('Selection'),model_id:''}"
at=s.index(needle)
s=s[:at]+'''for(const resource_key of ['users','roles','actions','business_actions','modules','module_groups'])for(const operation of ['create','update','delete'])
 check('CoreEffectReceipt',{schema_version:1,resource_key,operation,resource_id:'9007199254740993'},!(resource_key==='users'&&operation==='delete'),`AI27 Core exact receipt ${resource_key}/${operation}`);
for(const delta of [{resource_id:1},{resource_id:'0'},{resource_key:'auth_sessions'},{operation:'execute'},{command:{roles:[]}},{subject_user_id:'1'}])
 check('CoreEffectReceipt',{schema_version:1,resource_key:'roles',operation:'delete',resource_id:'1',...delta},false,'Core receipt excludes invented action scope or payload '+JSON.stringify(delta));
for(const kind of ['core_id_list','core_translations'])check('ProposalEditableField',{...sample('ProposalEditableField'),kind},true,`Core closed structured editor ${kind}`);
'''+s[at:]
s=s.replace("const docPaths=['docs/mvp/72", "const docPaths=['docs/mvp/73-nodia-ai-ai27-core-administration.md','docs/nodia-ai/knowledge/general-settings/features/confirmed-administration.md','docs/architecture/decisions/ADR-051-nodia-ai-core-exclusive-execution.md','docs/mvp/72")
s=s.replace('rentalMoneyOccupancyPreparation:inv.ai26,currentAstCounts','rentalMoneyOccupancyPreparation:inv.ai26,coreAdministration:inv.ai27,currentAstCounts')
p.write_text(s,encoding='utf-8')
print('AI27 draft registry/schema checks/model metadata/package maintenance ready')
