const fs=require('node:fs');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const modelPath='docs/mvp/nodia-ai-v1-data-model.json',model=read(modelPath);
model.status='m1_and_ai17_m2_subset_implemented_full_v1_proposed';
model.migrationStages.M1.note='Full-v1 manifest includes future fields/checks; M1 permits text parts and run grants, no execution jobs. AI-17 adds only the first four M2 tables; later groups remain pending.';
model.migrationStages.M2_AI17={migration:'1792400000000-CreateNodiaAiProposalPersistence',tables:4,columns:40,tableNames:['nodia_ai_drafts','nodia_ai_proposals','nodia_ai_proposal_revisions','nodia_ai_proposal_steps'],verified:'docs/evidence/nodia-ai-ai17-postgres-integration.json',excluded:['nodia_ai_confirmation_challenges','nodia_ai_executions','nodia_ai_execution_steps','nodia_ai_execution_payloads'],note:'Internal native preparation plus immutable revisions only; no MCP prepare publication or effects. TTL 900s capped by chat, unchanged by PATCH. Conversation cascade removes all four tables content.'};
model.reconciliations=model.reconciliations.filter(r=>r.task!=='AI-17');
model.reconciliations.push({date:'2026-10-16',task:'AI-17',description:'Implement existing 4 M2 draft/proposal tables with 40 columns, no envelope/preview duplication or workflow-edge table. Frozen step insert/update/delete constraints preserve chat cascade. Challenges/execution remain future.'});
write(modelPath,model);
const evidence='docs/evidence/nodia-ai-ai17-validation.json';
if(!fs.existsSync(evidence))write(evidence,{task:'AI-17',status:'verification_in_progress',scope:'internal_drafts_and_revisions; not MCP prepare publication or business execution'});
for(const [file,revision] of [['docs/nodia-ai/knowledge/nodia-ai/features/conversation-coordination.md',7],['docs/nodia-ai/knowledge/nodia-ai/README.md',17]]){
 let text=fs.readFileSync(file,'utf8');const match=/^---\r?\n([\s\S]*?)\r?\n---/.exec(text);const meta=JSON.parse(match[1]);
 meta.revision=revision;meta.implementation.notes+=' AI-17 incorpora cuatro tablas M2, preparación financiera interna sin efectos, revisiones inmutables JCS/hash, GET/PATCH/cancel y preview readonly bajo intención; no publica MCP prepare ni confirmación.';
 const source={path:'docs/mvp/63-nodia-ai-ai17-drafts-revisions.md',kind:'specification'};if(!meta.sources.some(s=>s.path===source.path))meta.sources.push(source);
 if(!meta.verification.evidence_paths.includes(evidence))meta.verification.evidence_paths.push(evidence);
 meta.verification.notes+=' AI-17 diferencia casos de uso/PostgreSQL desechable/QA sintético de publicación y cuenta real.';
 text='---\n'+JSON.stringify(meta,null,2)+'\n---'+text.slice(match[0].length);
 if(file.includes('/features/'))text=text.replace('distingue18 implementadas y12 pendientes','distingue21 implementadas y9 pendientes').replace('Adjuntos, organización avanzada y previews/confirmaciones conservan sus etapas futuras.','AI-17 añade vista previa de sólo lectura por revisión exacta; adjuntos, organización avanzada y confirmación conservan sus etapas futuras.').replace('Propuestas/confirmaciones/escrituras conservan las etapas siguientes.','AI-17 guarda borradores/propuestas y revisiones; confirmación y efectos conservan las etapas siguientes.').replace('- [ ] Modalidades, propuestas/confirmación/escrituras y gates productivos independientes.','- [x] AI-17: preparación financiera interna, borradores/revisiones/hash y preview readonly, sin publicar MCP prepare.\n- [ ] Modalidades, confirmación/escrituras y gates productivos independientes.');
 text+='\n[AI-17/63]('+ (file.includes('/features/')?'../../../../':'../../../')+'mvp/63-nodia-ai-ai17-drafts-revisions.md): mínimo obligatorio→aclaración→revisión congelada, con CAS y autoridad actual. La ficha sigue draft/unregistered, sin aprobación ni herramientas nuevas.\n';
 fs.writeFileSync(file,text);
}
