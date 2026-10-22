// Reconcile AI-29 R01 evidence only. Does not execute tests, logins, inference or publication.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const sqlDestination = 'docs/evidence/nodia-ai-ai29-r01-postgresql.json';
const destination = 'docs/evidence/nodia-ai-ai29-r01-validation.json';
const expectedStages = ['r01','main','28','27','26','25','24','23','22','20','18','08','rental','modules','actions','roles','api','agentic','codexNative','codexHttp'];
const sources = new Map();
const checkOnly=process.argv.includes('--check');
function source(file) {
  if (!fs.existsSync(path.join(root,file))) return null;
  const bytes = fs.readFileSync(path.join(root,file)), stat = fs.statSync(path.join(root,file));
  const value = { path:file, sha256:crypto.createHash('sha256').update(bytes).digest('hex'), bytes:bytes.length, modified_at_utc:stat.mtime.toISOString() };
  sources.set(file,value); return value;
}
function read(file) { const ref=source(file); return ref ? fs.readFileSync(path.join(root,file),'utf8').replace(/\u001b\[[0-9;]*m/g,'') : null; }
function json(file) { const raw=read(file); if(raw===null)return null;try{return JSON.parse(raw);}catch{return null;} }
function checkCount(value) { return Number.isSafeInteger(value?.checks) ? value.checks : Array.isArray(value?.checks) ? value.checks.length : null; }
function ref(file) { return source(file); }
function write(file,value) { const output=JSON.stringify(value,null,2)+'\n'; if(fs.existsSync(path.join(root,file))&&fs.readFileSync(path.join(root,file),'utf8')===output)return;if(checkOnly)throw new Error('Evidence requires reconciliation: '+file);fs.writeFileSync(path.join(root,file),output); }
function sourceClock() { return [...sources.values()].map(s=>s.modified_at_utc).sort().at(-1)??null; }

const statuses=json('.tmp/ai29-r01-sql-status.json');
const suiteRows=Array.isArray(statuses)?statuses:[];
const suites=expectedStages.map(stage=>{
  const row=suiteRows.filter(r=>r.stage===stage).at(-1);
  if(!row)return{stage,status:'missing',exit_code:null,checks:null};
  const log=read(row.log),parsed=json(row.log),count=checkCount(parsed);
  const logAffirmsSuccess=parsed?.passed===true||parsed?.result==='passed'||Array.isArray(parsed?.passed)||Array.isArray(parsed?.checks)||/\b(passed|verified)\b/i.test(log??'');
  return{stage,file:row.file,status:row.exit_code===0&&log!==null&&logAffirmsSuccess?'passed':row.exit_code===0?'incomplete_evidence':'failed',exit_code:row.exit_code,started_utc:row.started_utc,elapsed_seconds:row.elapsed_seconds,checks:count,scope:stage==='codexNative'?'native_process_fixture':'sql_http_or_compiled_transport',log:ref(row.log),result:parsed??null};
});
const sqlChecks=suites.filter(r=>r.stage!=='codexNative').reduce((sum,r)=>sum+(r.checks??0),0);
const nativeChecks=suites.find(r=>r.stage==='codexNative')?.checks??null;
const sqlEvidence={
  schema_version:1,stage:'AI-29-R01',scope:'Disposable PostgreSQL, compiled HTTP, private synthetic transport and native process regression suites',
  status:suites.every(r=>r.status==='passed')?'passed':'partial',
  source_clock_latest_mtime_utc:sourceClock(),status_source:ref('.tmp/ai29-r01-sql-status.json'),
  suite_count:suites.length,passed_suites:suites.filter(r=>r.status==='passed').length,
  failed_suites:suites.filter(r=>r.status==='failed').length,
  sql_http_numbered_checks:sqlChecks,native_process_checks:nativeChecks,
  total_numbered_checks:sqlChecks+(nativeChecks??0),
  passing_suites_without_numbered_counter:suites.filter(r=>r.status==='passed'&&r.checks===null).map(r=>r.stage),
  suites,
  limitations:[
    'The 502-style subtotal is SQL/HTTP/compiled transport checks; native Codex process checks are counted separately, never as SQL checks.',
    'Native/provider responses in these regression suites are synthetic; real provider acceptance belongs to separate evidence.',
    'The final per-suite status file supersedes earlier failed attempts; old attempt logs remain untouched.',
    'No configured business database, real account credentials or provider inference is implied by passing fixtures.',
  ],
};
write(sqlDestination,sqlEvidence);

const fullLog=read('.tmp/ai29-r01-server-tests-final.log')??'';
const filesMatch=fullLog.match(/Test Files\s+(\d+) passed\s+\((\d+)\)/),testsMatch=fullLog.match(/Tests\s+(\d+) passed\s+\((\d+)\)/),durationMatch=fullLog.match(/Duration\s+([\d.]+)s/);
const fullSuite={status:filesMatch&&testsMatch&&!/\d+ failed/.test(fullLog)?'passed':'missing_or_failed',tests:testsMatch?Number(testsMatch[1]):null,files:filesMatch?Number(filesMatch[1]):null,duration_seconds:durationMatch?Number(durationMatch[1]):null,log:ref('.tmp/ai29-r01-server-tests-final.log')};
const typesResult=json('.tmp/ai29-r01-types-result.json'),lintResult=json('.tmp/ai29-r01-lint-result.json');
function commandEvidence(result,fallback) {
  const logFile=result?.log??fallback,output=read(logFile);
  return{status:result?.exit_code===0?'passed':result?.exit_code!=null?'failed':'exit_code_unrecorded',exit_code:result?.exit_code??null,command:result?.command??null,result:result??null,log:ref(logFile),output_bytes:output===null?null:Buffer.byteLength(output)};
}
const lint=commandEvidence(lintResult,'.tmp/ai29-r01-lint-final.log');
const lintText=read(lintResult?.log??'.tmp/ai29-r01-lint-final.log')??'';
lint.warning_count=[...lintText.matchAll(/\bwarning\b/g)].length;
lint.error_count=[...lintText.matchAll(/:\s*error\b/g)].length;
const buildResult=json('.tmp/ai29-r01-build-result.json');
const buildLog=buildResult?.log??'.tmp/ai29-r01-build-final.log';
const buildText=read(buildLog)??'';
const buildJsonLines=buildText.split(/\r?\n/).flatMap(line=>{try{return[JSON.parse(line)];}catch{return[];}});
const contextBuild=buildJsonLines.findLast(v=>v.task==='AI-12'&&typeof v.release==='string');
const build={...commandEvidence(buildResult,buildLog),status:buildResult?.exit_code===0&&contextBuild?'passed':buildResult?.exit_code!=null&&buildResult.exit_code!==0?'failed':contextBuild?'completion_marker_observed':'incomplete_evidence',exit_code_note:buildResult?'Process exit is recorded in the command result receipt.':'The build log records final context emission; no process-exit receipt was supplied.',context_build:contextBuild??null};

const excluded=new Set([destination,sqlDestination]);
const permanentFiles=fs.readdirSync(path.join(root,'docs/evidence')).filter(name=>/^nodia-ai-ai29-r01-.*\.json$/.test(name)).map(name=>'docs/evidence/'+name).filter(file=>!excluded.has(file));
const artifacts=permanentFiles.map(file=>({file,value:json(file)})).filter(row=>row.value);
function sourceHashValidation(value){const entries=Array.isArray(value.source_hashes)?value.source_hashes:[];return{checked:entries.length,mismatches:entries.flatMap(entry=>{const file=entry.path??entry.file,actual=typeof file==='string'?ref(file):null;return actual?.sha256===entry.sha256?[]:[{path:file,expected_sha256:entry.sha256,actual_sha256:actual?.sha256??null}];})};}

const artifact=(suffix)=>artifacts.find(row=>row.file.endsWith(suffix))??null;
const geminiNative=artifact('-gemini-native.json'),codexNative=artifact('-codex-native.json'),hostContainment=artifact('-cgroup-host-validation.json');
const realLogFiles=fs.readdirSync(path.join(root,'.tmp')).filter(name=>/^ai29-r01-gemini-real.*\.log$/.test(name)).map(name=>'.tmp/'+name);
const realCandidates=artifacts.filter(row=>row.value?.provider_transport_mocked===false&&Array.isArray(row.value?.reports)&&row.value.process_exit_code===0&&row.value.cleanup_completed_without_reported_failure===true);
const engineProofs=['token_plan_web','token_plan_agentic'].map(mode=>{
  const successful=realCandidates.filter(row=>row.value.reports.some(r=>r.mode===mode&&r.authentication_observed===true)&&checkCount(row.value)!==null&&Array.isArray(row.value.passed)&&checkCount(row.value)===row.value.passed.length).sort((a,b)=>(a.value.observed_at_utc??'').localeCompare(b.value.observed_at_utc??''));
  const chosen=successful.at(-1);
  return{mode,status:chosen?'passed':'requires_real_human_login_or_evidence',checks:chosen?checkCount(chosen.value):null,evidence:chosen?ref(chosen.file):null,result:chosen?.value??null};
});
const webPriorFailure=realLogFiles.find(file=>/token_plan_web: existing real account completes authentication/.test(read(file)??''));
function cleanNative(value){
  const cleanup=value?.cleanup,pending=cleanup?.pending;
  const counters=['jobs','attempts','runtime_slots','diagnostic_requests','diagnostic_proofs'];
  return cleanup?.completed===true&&cleanup.inference_replayed===false&&pending&&counters.every(key=>pending[key]===0)&&Object.values(pending).every(count=>count===0);
}
function realInference(value,phase){return value?.phase===phase&&value.status==='passed'&&value.real_gemini_inference===true&&value.adapter_mocked===false&&value.product_readers_mocked===false&&Array.isArray(value.passed)&&checkCount(value)===value.passed.length&&cleanNative(value);}
const realMcp=artifacts.find(row=>row.file.endsWith('-gemini-agentic-mcp.json')&&realInference(row.value,'local'))??null;
const routingCandidate=artifact('-gemini-web-routing.json');
const routingAssertions=[
 'Web remains conversational with no MCP or delegation',
 'Web delegates to the opted-in exact Agentic connection for a native SQL read',
 'following turn returns to Web with canonical history and no MCP',
];
function routingVerified(value){
  const turns=value?.turns;
  return realInference(value,'web-routing')&&value.adapter_dispatch_requests===4&&value.maximum_adapter_dispatch_requests===4&&routingAssertions.every(label=>value.passed.includes(label))&&Array.isArray(turns)&&turns.length===3&&turns.every(turn=>turn.state==='completed')&&turns[0].dispatches===1&&turns[0].delegations===0&&turns[0].tool_calls===0&&turns[1].dispatches===2&&turns[1].delegations===1&&turns[1].receipt_tools?.some(receipt=>receipt.name==='nodia_products_list'&&receipt.state==='completed')&&turns[2].dispatches===1&&turns[2].delegations===0&&turns[2].tool_calls===0;
}
const webRouting=routingCandidate&&routingVerified(routingCandidate.value)?routingCandidate:null;
const healthCandidate=artifact('-final-health.json');
const requiredUnits=['nodia-api','nodia-ai-worker','nodia-gemini-lab','nginx'];
const requiredQuiet=['pending_jobs','open_attempts','held_or_unknown_slots'];
const finalHealth=healthCandidate&&(healthCandidate.value.status==='passed'||healthCandidate.value.passed===true)&&requiredUnits.every(unit=>healthCandidate.value.units?.[unit]==='active')&&['api','gemini'].every(key=>healthCandidate.value.http?.[key]===200)&&requiredQuiet.every(key=>healthCandidate.value.quiet?.[key]===0)&&healthCandidate.value.compiled_stage_and_runtime_equal===true?healthCandidate:null;
// These exact JSON observed_at_utc fields are produced on the VM. Never compare their times to Windows mtime/desktop timestamps.
const webAcceptance=engineProofs.find(row=>row.mode==='token_plan_web');
const vmHealthAt=Date.parse(finalHealth?.value.observed_at_utc??''),vmWebAt=Date.parse(webAcceptance?.result?.observed_at_utc??''),vmRoutingAt=Date.parse(webRouting?.value.observed_at_utc??'');
const healthFreshness={clock_domain:'VM observed_at_utc JSON only',health_at:finalHealth?.value.observed_at_utc??null,web_auth_at:webAcceptance?.result?.observed_at_utc??null,web_routing_at:webRouting?.value.observed_at_utc??null,status:Number.isFinite(vmHealthAt)&&Number.isFinite(vmWebAt)&&Number.isFinite(vmRoutingAt)?vmHealthAt>=Math.max(vmWebAt,vmRoutingAt)?'passed':'stale':'unproven'};
const artifactHashes=artifacts.map(row=>({file:row.file,...sourceHashValidation(row.value)}));
const hashMismatches=artifactHashes.flatMap(row=>row.mismatches.map(mismatch=>({evidence:row.file,...mismatch})));
const knowledgeDelta=artifact('-knowledge-delta.json');
const releaseObservations=[contextBuild?.release,knowledgeDelta?.value.release,realMcp?.value.candidate_release_id,realMcp?.value.provenance?.knowledge_release_id,webRouting?.value.candidate_release_id,webRouting?.value.provenance?.knowledge_release_id,finalHealth?.value.knowledge_release].filter(value=>typeof value==='string');
const distObservations=[realMcp?.value.provenance?.dist_tree_sha256,webRouting?.value.provenance?.dist_tree_sha256,finalHealth?.value.dist_tree_sha256].filter(value=>typeof value==='string');
const hashConsistency={source_mismatches:hashMismatches,knowledge_release_observations:releaseObservations,knowledge_release_consistent:releaseObservations.length>0&&new Set(releaseObservations).size===1,dist_tree_observations:distObservations,dist_tree_consistent:distObservations.length>1?new Set(distObservations).size===1:null,dist_note:'Compare only explicitly recorded same-algorithm tree hashes. File counts or Windows mtimes are not hashes.'};
const planPath='docs/mvp/45-nodia-ai-implementation-plan.md',closureDocPath='docs/mvp/75-nodia-ai-ai29-secure-human-flows.md';
const planText=read(planPath)??'',closureText=read(closureDocPath)??'';
const manualClosure={plan_evidence:ref(planPath),doc_evidence:ref(closureDocPath),checklist_ai29_completed:/^- \[[xX]\] \*\*AI-29(?:\s|—|–)/m.test(planText),doc_r01_closed:/^>\s*Estado técnico:.*\bAI-29-R01\s+(?:queda\s+)?cerrado\b/im.test(closureText),document_approval:'independent; never inferred from technical closure'};
const historicalClient=json('docs/evidence/nodia-ai-ai29-client-validation.json');
const historicalUi=json('docs/evidence/nodia-ai-ai29-ui-validation.json');
const gates=[];
if(sqlEvidence.status!=='passed')gates.push('SQL/HTTP/process regression evidence is incomplete or failed.');
if(fullSuite.status!=='passed')gates.push('Final full Server test evidence is incomplete or failed.');
if(typesResult?.exit_code!==0||lintResult?.exit_code!==0||lint.error_count!==0||build.status!=='passed')gates.push('Production typecheck, lint or build command evidence is missing or failed.');
if(geminiNative?.value.status!=='passed'||codexNative?.value.status!=='passed'||hostContainment?.value.real_kernel!==true)gates.push('Durable native or real-kernel host containment evidence is missing or failed.');
if(engineProofs.some(row=>row.status!=='passed'))gates.push('Gemini Web real human login/acceptance is still required; Agentic evidence is evaluated independently.');
if(!realMcp)gates.push('Agentic local real MCP evidence or its complete cleanup proof is missing.');
if(!webRouting)gates.push('Real Web conversation, opt-in Agentic read and return-to-Web routing proof is missing or invalid.');
if(!finalHealth)gates.push('Final post-verification runtime health evidence has not been supplied or is invalid.');
if(healthFreshness.status!=='passed')gates.push('VM health must be observed after real Web authentication and Web routing; freshness is stale or unproven.');
if(hashMismatches.length||!hashConsistency.knowledge_release_consistent||hashConsistency.dist_tree_consistent===false)gates.push('Source hashes, knowledge release or recorded dist tree hashes are inconsistent.');
const validation={
  schema_version:1,stage:'AI-29-R01',status:gates.length?'partial':manualClosure.checklist_ai29_completed&&manualClosure.doc_r01_closed?'technically_closed':'evidence_ready_for_review',stage_closed:gates.length===0&&manualClosure.checklist_ai29_completed&&manualClosure.doc_r01_closed,
  source_clock_latest_mtime_utc:sourceClock(),
  reconciliation:{script:ref('docs/evidence/scripts/reconcile-nodia-ai-ai29-r01-validation.cjs'),side_effects:'Evidence JSON only; no test execution, runtime changes, login, inference, database mutation or publication.',historical_ai29_evidence_preserved:true},
  server:{full_suite:fullSuite,production_typecheck:commandEvidence(typesResult,'.tmp/ai29-r01-types-final.log'),lint,build},
  postgresql:{evidence:sqlDestination,status:sqlEvidence.status,suites:sqlEvidence.suite_count,passed_suites:sqlEvidence.passed_suites,sql_http_numbered_checks:sqlChecks,codex_native_process_checks:nativeChecks,passing_suites_without_numbered_counter:sqlEvidence.passing_suites_without_numbered_counter},
  native:{gemini:geminiNative?{evidence:ref(geminiNative.file),status:geminiNative.value.status,linux_tests:geminiNative.value.unit_tests?.linux??null,windows_tests:geminiNative.value.unit_tests?.windows??null,checks:geminiNative.value.check_count??null}:null,codex:codexNative?{evidence:ref(codexNative.file),status:codexNative.value.status,unit_tests:codexNative.value.unit_tests??null,checks:codexNative.value.check_count??null}:null,cgroup_host:hostContainment?{evidence:ref(hostContainment.file),checks:checkCount(hostContainment.value),real_kernel:hostContainment.value.real_kernel??null}:null},
  real_gemini:{engines:engineProofs,prior_web_attempt_failure:webPriorFailure?ref(webPriorFailure):null,real_mcp:realMcp?ref(realMcp.file):null,web_routing:webRouting?ref(webRouting.file):null,web_routing_candidate:routingCandidate?ref(routingCandidate.file):null,final_health:finalHealth?ref(finalHealth.file):null,health_freshness:healthFreshness},
  inherited_client:{evidence:ref('docs/evidence/nodia-ai-ai29-client-validation.json'),full_suite:historicalClient?.full_suite??null,ui_evidence:ref('docs/evidence/nodia-ai-ai29-ui-validation.json'),ui_checks:Array.isArray(historicalUi?.checks)?historicalUi.checks.length:historicalUi?.checks??null,note:'Historical AI-29 Client evidence; not presented as a new R01 Client test run.'},
  artifacts:artifacts.map(row=>({evidence:ref(row.file),status:row.value.status??null,scope:row.value.scope??null,source_hash_validation:sourceHashValidation(row.value)})),
  hash_consistency:hashConsistency,manual_closure:manualClosure,
  open_gates:gates,
  limitations:['A reconciled evidence report never approves product documents or publishes capabilities.','Fixture process/native success does not prove a real provider account or inference.','Codex real account login and inference remain unverified; final health does not imply either. Its native proof covers only owned PGID descendants.', 'Durable Gemini starts require Linux cgroup v2, exact root-owned host attestation and current scope identity. Missing or untrusted closure remains unknown, without replay. Same-UID malicious cgroup migration is outside this trust boundary; ordinary setsid descendants are covered.','Host and Windows timestamps retain separate provenance; source mtime is a file observation, not a fabricated test execution time.'],
};
validation.sources=[...sources.values()].sort((a,b)=>a.path.localeCompare(b.path));
write(destination,validation);
console.log(JSON.stringify({status:validation.status,suites:sqlEvidence.suite_count,passed_suites:sqlEvidence.passed_suites,sql_http_checks:sqlChecks,codex_native_checks:nativeChecks,server_tests:fullSuite.tests,server_files:fullSuite.files,real_engines:engineProofs.map(v=>({mode:v.mode,status:v.status,checks:v.checks})),open_gates:gates.length,outputs:[sqlDestination,destination]}));
