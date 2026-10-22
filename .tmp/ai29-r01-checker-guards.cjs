// Synthetic filesystem overlay verifies the reconciler without changing any product/evidence files.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),script=path.join(root,'docs/evidence/scripts/reconcile-nodia-ai-ai29-r01-validation.cjs');
const routingFile='docs/evidence/nodia-ai-ai29-r01-gemini-web-routing.json',loginFile='docs/evidence/nodia-ai-ai29-r01-gemini-web-login.json',healthFile='docs/evidence/nodia-ai-ai29-r01-final-health.json';
const load=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
function scenario(mutator){
 const base=load('docs/evidence/nodia-ai-ai29-r01-gemini-agentic-mcp.json');
 const routing={...base,phase:'web-routing',observed_at_utc:'2026-10-18T01:00:00Z',checks:3,passed:['Web remains conversational with no MCP or delegation','Web delegates to the opted-in exact Agentic connection for a native SQL read','following turn returns to Web with canonical history and no MCP'],adapter_dispatch_requests:4,maximum_adapter_dispatch_requests:4,turns:[{state:'completed',dispatches:1,delegations:0,tool_calls:0},{state:'completed',dispatches:2,delegations:1,tool_calls:1,receipt_tools:[{name:'nodia_products_list',state:'completed'}]},{state:'completed',dispatches:1,delegations:0,tool_calls:0}]};
 const login={...load('docs/evidence/nodia-ai-ai29-r01-gemini-agentic-login.json'),observed_at_utc:'2026-10-18T00:59:00Z',reports:[{mode:'token_plan_web',authentication_observed:true}]};
 const health={...load(healthFile),observed_at_utc:'2026-10-18T01:01:00Z'};
 const model={routing,login,health,closeDoc:true,closePlan:true};mutator?.(model);
 const overlay=new Map([[routingFile,JSON.stringify(routing)],[loginFile,JSON.stringify(login)],[healthFile,JSON.stringify(health)]]);
 let plan=fs.readFileSync(path.join(root,'docs/mvp/45-nodia-ai-implementation-plan.md'),'utf8'),doc=fs.readFileSync(path.join(root,'docs/mvp/75-nodia-ai-ai29-secure-human-flows.md'),'utf8');
 if(model.closePlan)plan=plan.replace(/^- \[ \] \*\*AI-29/m,'- [x] **AI-29');
 if(model.closeDoc)doc=doc.replace(/^> Estado técnico:.*$/m,'> Estado técnico: AI-29-R01 cerrado.');
 overlay.set('docs/mvp/45-nodia-ai-implementation-plan.md',plan);overlay.set('docs/mvp/75-nodia-ai-ai29-secure-human-flows.md',doc);
 const relative=file=>path.relative(root,file).replaceAll('\\','/'),outputs=new Map();
 const fake={...fs,existsSync:file=>overlay.has(relative(file))||fs.existsSync(file),readFileSync:(file,encoding)=>overlay.has(relative(file))?(encoding?overlay.get(relative(file)):Buffer.from(overlay.get(relative(file)))):fs.readFileSync(file,encoding),statSync:file=>overlay.has(relative(file))?{mtime:new Date('2026-10-18T01:02:00Z')} :fs.statSync(file),readdirSync:dir=>relative(dir)==='docs/evidence'?[...new Set([...fs.readdirSync(dir),path.basename(routingFile),path.basename(loginFile)])]:fs.readdirSync(dir),writeFileSync:(file,data)=>outputs.set(relative(file),data)};
 vm.runInNewContext(fs.readFileSync(script,'utf8'),{require:name=>name==='node:fs'?fake:require(name),__dirname:path.dirname(script),process:{argv:[]},console:{log(){}},Buffer},{timeout:5000});
 return JSON.parse(outputs.get('docs/evidence/nodia-ai-ai29-r01-validation.json'));
}
assert.equal(scenario().stage_closed,true);
assert.equal(scenario(m=>{m.routing.cleanup=structuredClone(m.routing.cleanup);m.routing.cleanup.pending.jobs=1;}).stage_closed,false);
assert.equal(scenario(m=>{m.routing.turns[1].delegations=0;}).stage_closed,false);
assert.equal(scenario(m=>{m.routing.adapter_dispatch_requests=3;}).stage_closed,false);
assert.equal(scenario(m=>{m.login.cleanup_completed_without_reported_failure=false;}).stage_closed,false);
assert.equal(scenario(m=>{m.health.observed_at_utc='2026-10-18T00:58:00Z';}).stage_closed,false);
assert.equal(scenario(m=>{delete m.routing.observed_at_utc;}).stage_closed,false);
assert.equal(scenario(m=>{m.closeDoc=false;}).status,'evidence_ready_for_review');
assert.equal(scenario(m=>{m.closePlan=false;}).stage_closed,false);
assert.equal(scenario(m=>{m.routing.candidate_release_id='mismatched-fixture-pin';}).stage_closed,false);
console.log('Reconciler closed only with all proofs and manual closure: 10 synthetic guard scenarios passed');
