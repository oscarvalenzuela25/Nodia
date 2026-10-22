const fs=require('node:fs'),crypto=require('node:crypto');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')), write=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const invPath='docs/mvp/nodia-ai-current-endpoints.json',inv=read(invPath);
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(dir+'/'+e.name):[dir+'/'+e.name]);}
for(const file of [...files('nodia-server/src/nodia-ai-proposal').filter(p=>p.endsWith('.ts')&&!p.endsWith('.spec.ts')),'nodia-server/src/nodia-ai-observation/use-case/observe-nodia-ai-proposals.use-case.ts','nodia-server/src/nodia-ai-conversation/nodia-ai-conversation-body-parser.ts','nodia-server/src/migrations/1792400000000-CreateNodiaAiProposalPersistence.ts'])if(!inv.sourceChecksums.some(s=>s.file===file))inv.sourceChecksums.push({file,sha256:''});
for(const s of inv.sourceChecksums)s.sha256=crypto.createHash('sha256').update(fs.readFileSync(s.file)).digest('hex');
inv.categoryCounts={};for(const c of inv.controllers)for(const o of c.operations){const k=o.nodiaAiProposal.category;inv.categoryCounts[k]=(inv.categoryCounts[k]||0)+1;}
const ts=require('../nodia-server/node_modules/typescript'),mf='nodia-server/src/nodia-ai-proposal/nodia-ai-proposal.module.ts';const sf=ts.createSourceFile(mf,fs.readFileSync(mf,'utf8'),ts.ScriptTarget.Latest,true);const mc=sf.statements.find(n=>ts.isClassDeclaration(n)&&n.name?.text==='NodiaAiProposalModule');inv.modules.find(m=>m.module==='NodiaAiProposalModule').line=sf.getLineAndCharacterOfPosition(mc.getStart(sf)).line+1;
write(invPath,inv);
const modelPath='docs/mvp/nodia-ai-v1-data-model.json',model=read(modelPath),draft=model.tables.find(t=>t.name==='nodia_ai_drafts');
for(const index of [{columns:['tool_call_id','conversation_id'],where:'tool_call_id IS NOT NULL'},{columns:['claimed_proposal_id','conversation_id'],where:'claimed_proposal_id IS NOT NULL'}])if(!draft.indexes.some(i=>i.columns.join(',')===index.columns.join(',')))draft.indexes.push(index);
write(modelPath,model);
for(const p of ['docs/mvp/45-nodia-ai-implementation-plan.md','docs/mvp/63-nodia-ai-ai17-drafts-revisions.md'])fs.writeFileSync(p,fs.readFileSync(p,'utf8').replaceAll('AI-18/19','AI-18..20'));
const evidencePath='docs/evidence/nodia-ai-ai17-validation.json',e=read(evidencePath);e.limitations[0]='AI18 human confirmation, AI19 first native effect and AI20 execution recovery/cancellation remain pending';
for(const a of e.artifacts)a.sha256=crypto.createHash('sha256').update(fs.readFileSync(a.file)).digest('hex');
write(evidencePath,e);
