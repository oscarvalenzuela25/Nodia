// Offline reconciliation of R04 only. Historical validators and snapshots stay frozen.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..');
const destination = 'docs/evidence/nodia-ai-ai32-r04-validation.json';
const self = 'docs/evidence/scripts/reconcile-nodia-ai-ai32-r04-validation.cjs';
const nativeHarness = 'docs/evidence/scripts/nodia-ai-ai32-r04-native-probe.py';
const textHarness = 'docs/evidence/scripts/nodia-ai-ai32-r04-web-text-control.py';
const mcpHarness = 'docs/evidence/scripts/nodia-ai-ai32-r04-mcp-file-probe.py';
const mcpTest = 'docs/evidence/scripts/test_nodia_ai_ai32_r04_mcp_probe.py';
const mcpOfflineLog = '.tmp/ai32-r04-mcp-harness-offline.log';
const audioAnalysisPath = 'docs/evidence/nodia-ai-ai32-r04-audio-analysis.json';
const audioAnalysisScript = 'docs/evidence/scripts/nodia-ai-ai32-r04-audio-analysis.py';
const freshPath='docs/evidence/nodia-ai-ai32-r04-fresh-synthetic-audio.json';
const freshScript='docs/evidence/scripts/nodia-ai-ai32-r04-fresh-audio.py';
const appLayoutPath='docs/evidence/nodia-ai-ai32-r04-app-layout.json';
const appLayoutScript='.tmp/ai32-r04-app-layout.py';
const history = [{path:'docs/evidence/nodia-ai-ai32-r03-validation.json',sha256:'98e0a36ae77b912b0779f1de4205c5d5b131ac0a062f501dad39f39847423c60'},
  {path:'docs/evidence/nodia-ai-ai32-r02-validation.json',sha256:'bceb6f7ba1ce3212073c5803032c87e5ef5167148418ace0349f0764717c5fe2'}];
const safePath = value => {
  assert.equal(typeof value,'string'); const normalized=value.replaceAll('\\','/');
  assert(normalized.length>0&&normalized.length<=1024&&!path.posix.isAbsolute(normalized)&&!/^[a-z]:/i.test(normalized));
  assert.equal(path.posix.normalize(normalized),normalized);
  assert(!normalized.split('/').some(part=>['..','.env','browser_profile','session_state'].includes(part)||part.startsWith('.env.')));
  return normalized;
};
const bytes = file => fs.readFileSync(path.join(root,safePath(file)));
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const hash = file => digest(bytes(file));
const read = file => JSON.parse(bytes(file).toString('utf8').replace(/^\uFEFF/,''));
const receipt = file => ({path:safePath(file),sha256:hash(file)});
const time = value => {const result=Date.parse(value);assert(Number.isFinite(result));return result;};
const required = ['artifact_paths','baseline_health_path','gemini_activation_path','final_health_path','native_manifest_path',
  'build_path','current_native_probe_paths','mcp_probe_paths','text_control_paths','python_linux_log','python_windows_log','offline_native_log','offline_text_log'];
const arrayKeys = ['artifact_paths','current_native_probe_paths','mcp_probe_paths','text_control_paths'];
const check = process.argv.includes('--check'), arg = process.argv.indexOf('--inputs');
assert(!(check&&arg>=0),'Use saved inputs for --check.');
const saved=check?read(destination):null;
const inputs=arg>=0?read(safePath(process.argv[arg+1])):saved?.inputs;
assert(inputs,'Provide --inputs <repository-relative descriptor> for the first consolidation.');
assert.deepEqual(Object.keys(inputs).sort(),[...required].sort());
for(const key of required) {
  if(arrayKeys.includes(key)){assert(Array.isArray(inputs[key]));assert.equal(new Set(inputs[key]).size,inputs[key].length);inputs[key].forEach(safePath);}
  else safePath(inputs[key]);
}
const buildPath=inputs.build_path;
const artifactPaths=[...new Set([...required.flatMap(key=>Array.isArray(inputs[key])?inputs[key]:[inputs[key]]),self,buildPath,nativeHarness,textHarness,mcpHarness,mcpTest,mcpOfflineLog,audioAnalysisPath,audioAnalysisScript,freshPath,freshScript,appLayoutPath,appLayoutScript,...history.map(item=>item.path)])].sort();
assert(!artifactPaths.includes(destination));
const artifacts=artifactPaths.map(receipt);
for(const old of history)assert.equal(hash(old.path),old.sha256,'Historical evidence changed: '+old.path);
const priorR03=read(history[0].path), baseline=read(inputs.baseline_health_path), activation=read(inputs.gemini_activation_path), health=read(inputs.final_health_path);
for(const oldSnapshot of history.map(item=>read(item.path)))for(const item of oldSnapshot.artifacts)assert.equal(hash(item.path),item.sha256,'Historical artifact changed: '+item.path);
const r02=read(history[1].path);
assert.equal(activation.old_image,baseline.gemini_image);
assert.equal(health.gemini_image,activation.new_image); assert.match(health.gemini_image,/^sha256:[0-9a-f]{64}$/);
assert.equal(activation.container_restarted,true);
for(const key of ['credential_bytes_owner_mode_preserved','docker_limits_mounts_network_capabilities_namespace_preserved'])assert.equal(activation[key],true);
for(const key of ['provider_login_logout_or_inference_requested_by_activation','profile_files_copied_or_hashed','database_modified'])assert.equal(activation[key],false);
assert.equal(activation.health_http,200); assert.equal(health.status,'passed');
assert(time(health.observed_at_utc)>=time(activation.observed_at_utc));
assert.deepEqual(health.source_drift_files,[]);
assert(Object.values(health.units).length>=4&&Object.values(health.units).every(value=>value==='active'));
assert(Object.values(health.http).length>=2&&Object.values(health.http).every(value=>value===200));
for(const key of ['pending_jobs','open_attempts','held_or_unknown_slots'])assert.equal(health.quiet[key],0);
for(const [key,value] of Object.entries({migrations:26,nodia_ai_tables:19,nodia_ai_columns:267}))assert.equal(health.quiet[key],value);
for(const key of ['unknown_markers','armed_native_proofs','terminal_native_proofs','invalid_native_proofs','temporary_attachment_directories','temporary_cli_directories'])assert.equal(health.native_cleanup[key],0);
assert.equal(health.configured_database_written,false);assert.equal(health.profile_files_copied_or_hashed,false);
for(const key of ['dist_tree_sha256','final_package_archive_sha256','final_package_manifest_sha256','knowledge_release','compiled_dist_files_verified','final_package_files_verified']) {
  assert.equal(health[key],baseline[key],'R04 unexpectedly changed Node/knowledge: '+key);
}
assert.equal(health.compiled_stage_and_runtime_equal,true);
const inventoryPath=r02.current_runtime.node_inventory.path;
assert.equal(hash(inventoryPath),r02.current_runtime.node_inventory.sha256);
const inventory=read(inventoryPath);
assert(Array.isArray(priorR03.runtime.native_sources));assert.equal(priorR03.runtime.node_sources_checked,inventory.sourceChecksums.length);
for(const item of inventory.sourceChecksums)assert.equal(hash(item.file),item.sha256,'Node source drift: '+item.file);
const build=read(buildPath);
assert.equal(build.candidate_image,health.gemini_image);assert.equal(build.linux_test_exit_code,0);
assert.equal(build.provider_generations,0);assert.equal(build.credential_files_copied,false);
assert.equal(build.native_manifest_sha256,hash(inputs.native_manifest_path));assert.equal(build.linux_test_log_sha256,hash(inputs.python_linux_log));
const buildAttempts=[];
for(const file of artifactPaths.filter(file=>file.endsWith('.json')&&file.includes('ai32-r04'))) {
  const value=read(file);if(value.scope!=='candidate_staging_build_and_offline_tests')continue;
  assert.equal(value.provider_generations,0);assert.equal(value.credential_files_copied,false);
  assert.equal(value.active_container_restarted,false);assert.equal(value.active_image_retagged,false);
  if(value.linux_test_log)assert.equal(hash(value.linux_test_log),value.linux_test_log_sha256);
  if(value.status==='failed_offline_test')assert.notEqual(value.linux_test_exit_code,0);
  buildAttempts.push({artifact:receipt(file),status:value.status??'passed_offline_test',candidate_image:value.candidate_image,
    linux_test_exit_code:value.linux_test_exit_code,active_container_restarted:false,provider_generations:0});
}
const manifest=read(inputs.native_manifest_path);
const sources=Object.entries(manifest).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([file,sha256])=>{
  assert.match(sha256,/^[0-9a-f]{64}$/);const item=receipt('nodia-gemini-microservice/'+safePath(file));assert.equal(item.sha256,sha256,'Native source drift: '+file);return item;
});
assert(sources.length>=92);assert.equal(build.native_source_files,sources.length); assert.equal(health.native_source_files_verified,sources.length);
assert.equal(health.native_manifest_sha256,hash(inputs.native_manifest_path));
const appLayout=read(appLayoutPath);
assert.equal(appLayout.script_sha256,hash(appLayoutScript));assert.equal(appLayout.status,'passed');
assert.equal(appLayout.provider_generations,0);assert.equal(appLayout.configured_database_modified,false);
assert.equal(appLayout.manifest_source_files,sources.length);assert.equal(appLayout.source_and_configuration_mounts_exact,true);
assert.equal(appLayout.missing_source_file_count,0);
assert.equal(appLayout.nonruntime_regular_files,sources.length+appLayout.additional_mounted_configuration_file_count);
assert.equal(appLayout.unexpected_regular_file_count,appLayout.additional_mounted_configuration_file_count);
for(const key of ['operational_script_count','source_archive_count'])assert.equal(appLayout[key],0);
for(const key of ['temporary_build_directory_present','runtime_mounts_traversed','profile_or_credential_bytes_read'])assert.equal(appLayout[key],false);
function pythonTests(file) {
  const text=bytes(file).toString('utf8'), matches=[...text.matchAll(/Ran (\d+) tests? in ([\d.]+)s/g)];
  assert.equal(matches.length,1,'One completed suite required: '+file);
  const end=/\nOK(?: \(skipped=(\d+)\))?\s*$/.exec(text);assert(end,'Suite did not pass: '+file);
  const executed=Number(matches[0][1]),skipped=Number(end[1]??0);
  return {executed,passed:executed-skipped,skipped,log:receipt(file)};
}
const tests={linux:pythonTests(inputs.python_linux_log),windows:pythonTests(inputs.python_windows_log),native_harness:pythonTests(inputs.offline_native_log),text_harness:pythonTests(inputs.offline_text_log),mcp_harness:pythonTests(mcpOfflineLog)};
assert(tests.linux.executed>=385&&tests.linux.skipped===0);
assert.equal(tests.windows.executed,tests.linux.executed); assert(tests.windows.skipped<=2);
assert(tests.native_harness.executed>=16&&tests.text_harness.executed>=5&&tests.mcp_harness.executed>=5);
const exact=(report,probe,engine)=>{
  const observed=health.native_observations[engine];
  return time(report.observed_at_utc)>=time(activation.observed_at_utc)&&time(report.observed_at_utc)<=time(health.observed_at_utc)
    &&probe.reference?.resource_key===observed.resource_key&&probe.reference?.session_generation===observed.session_generation
    &&probe.model_id===observed.model_id&&probe.effort_id===observed.effort_id&&probe.configuration_generation===observed.configuration_generation;
};
const audioAnalysis=read(audioAnalysisPath);
assert.equal(audioAnalysis.script_sha256,hash(audioAnalysisScript));
for(const key of ['provider_generations'])assert.equal(audioAnalysis[key],0);
for(const key of ['configured_database_modified','original_fixture_files_modified','execution_transcoding_enabled','private_user_audio_used','physical_microphone_recording'])assert.equal(audioAnalysis[key],false);
assert.equal(audioAnalysis.isolation.network,'none');assert.equal(audioAnalysis.isolation.profile_or_credential_mounts,false);
const audioKinds={'audio/wav':'wav','audio/webm':'webm','audio/ogg':'ogg'};
const audioFixtures=new Map();
for(const [media,kind]of Object.entries(audioKinds)) {
  const prior=read('docs/evidence/nodia-ai-ai32-r03-web-audio-'+kind+'-es.json').probe;
  assert.equal(audioAnalysis.files[kind].file_sha256,prior.file_sha256);
  assert.equal(audioAnalysis.files[kind].file_bytes,prior.file_bytes);
  audioFixtures.set(prior.file_sha256,{media_type:media,bytes:prior.file_bytes,expected_sha256:prior.expected_answer_sha256,fixture_class:'initial_r03_identical'});
}
for(const key of ['canonical_pcm','encoded_packets']) {
  const left=audioAnalysis.files.webm[key],right=audioAnalysis.files.ogg[key];
  assert.deepEqual(left,right,'WebM/Ogg decoded samples/encoded payload comparison changed.');
}
assert.equal(audioAnalysis.comparisons.webm_vs_ogg.canonical_pcm_identical,true);
assert.equal(audioAnalysis.comparisons.webm_vs_ogg.encoded_packet_payloads_identical,true);
assert.equal(audioAnalysis.comparisons.webm_vs_ogg.sample_count_delta,0);
const fresh=read(freshPath);assert.equal(fresh.generator_sha256,hash(freshScript));
assert.equal(fresh.provider_calls,0);
for(const key of ['physical_microphone_recording','private_user_audio_used','expected_text_sent_to_provider_prompt','user_audio_conversion_path_modified'])assert.equal(fresh[key],false);
assert.match(fresh.speech_words_v1_sha256,/^[0-9a-f]{64}$/);assert.equal(fresh.voice.installed_and_enabled_observed,true);
for(const [media,kind]of Object.entries(audioKinds)) {
  const value=fresh.formats[kind];assert.match(value.sha256,/^[0-9a-f]{64}$/);assert(Number.isInteger(value.bytes)&&value.bytes>0);
  assert(Number.isFinite(value.duration_seconds)&&value.duration_seconds>0&&value.duration_seconds<=300);
  assert(!audioFixtures.has(value.sha256),'The fresh fixture must be distinct from historical files.');
  audioFixtures.set(value.sha256,{media_type:media,bytes:value.bytes,expected_sha256:fresh.speech_words_v1_sha256,fixture_class:'fresh_unpredictable'});
}
const syntaxCategories=new Set(['property_name','colon_delimiter','comma_delimiter','value','extra_data','unterminated_string','invalid_control','invalid_escape','other']);
const lexicalCategories=new Set(['boundary','double_quote','single_quote','object_open','object_close','array_open','array_close','colon','comma','backslash','equals','backtick','ampersand','paren_open','paren_close','slash','semicolon','angle_open','angle_close','control','whitespace','alphanumeric','other']);
const closed=(value,keys)=>{assert(value&&typeof value==='object'&&!Array.isArray(value));assert(Object.keys(value).every(key=>keys.includes(key)),'Unexpected diagnostic field.');};
const count=(value,max=2147483647)=>assert(Number.isInteger(value)&&value>=0&&value<=max);
const nullableCount=(value,max)=>{if(value!==null)count(value,max);};
const nullableBool=value=>assert(value===null||typeof value==='boolean');
function syntax(value) {
  if(value===null)return;
  closed(value,['category','position','line','column','document_chars','document_sha256','at_end','character_category','previous_category','next_category','ending_category','trailing_presentation_category']);
  if('category'in value)assert(syntaxCategories.has(value.category));
  for(const key of ['position','line','column','document_chars'])if(key in value)count(value[key]);
  for(const key of ['character_category','previous_category','next_category','ending_category'])if(key in value)assert(lexicalCategories.has(value[key]));
  if('document_sha256'in value)assert.match(value.document_sha256,/^[0-9a-f]{64}$/);
  if('at_end'in value)assert.equal(typeof value.at_end,'boolean');
  if('trailing_presentation_category'in value)assert(['citation_prefix','other'].includes(value.trailing_presentation_category));
}
function fingerprint(value,selected=false) {
  if(value===null)return;
  closed(value,selected?['text_bytes','sha256','json_parseable','top_level_kind','syntax','diagnostic_limit_exceeded']:['text_bytes','sha256','json_parseable']);
  nullableCount(value.text_bytes);nullableBool(value.json_parseable);
  if(value.sha256!==null)assert.match(value.sha256,/^[0-9a-f]{64}$/);
  if(selected) {
    assert(['object','array','string','number','boolean','null','invalid','unknown'].includes(value.top_level_kind));
    assert.equal(typeof value.diagnostic_limit_exceeded,'boolean');syntax(value.syntax);
    if(value.sha256!==null){assert(value.text_bytes<=65536);assert.equal(typeof value.json_parseable,'boolean');}
  }
}
function structured(value) {
  closed(value,['applied','last_equal','candidate_checks','protected_ampersands_total','unprotected_html_would_change_outputs','last_source','last_output','last_preparser','preparser_equal_to_source']);
  nullableBool(value.applied);nullableBool(value.last_equal);
  for(const key of ['candidate_checks','protected_ampersands_total','unprotected_html_would_change_outputs'])count(value[key]);
  fingerprint(value.last_source);fingerprint(value.last_output);
  if(value.last_equal===true)assert.deepEqual(value.last_source,value.last_output);
  const before=value.last_preparser;
  if(before!==null) {
    closed(before,['selection_source','card_prefix_detected','card_payload_available','selected_payload']);
    assert(['primary','card','fallback','unknown'].includes(before.selection_source));
    nullableBool(before.card_prefix_detected);nullableBool(before.card_payload_available);fingerprint(before.selected_payload,true);
  }
  nullableBool(value.preparser_equal_to_source);
  const selected=before?.selected_payload;
  if(selected?.sha256&&value.last_source)assert.equal(value.preparser_equal_to_source,
    selected.sha256===value.last_source.sha256&&selected.text_bytes===value.last_source.text_bytes);
  else assert.equal(value.preparser_equal_to_source,null);
}
function audioTransport(value) {
  closed(value,['scoped','applied','input_files','audio_files','audio_media_types','descriptor_version']);
  assert.equal(typeof value.scoped,'boolean');assert.equal(typeof value.applied,'boolean');
  nullableCount(value.input_files,4);nullableCount(value.audio_files,4);
  assert(Array.isArray(value.audio_media_types)&&value.audio_media_types.length<=4);
  assert.equal(new Set(value.audio_media_types).size,value.audio_media_types.length);
  assert(value.audio_media_types.every(media=>['audio/wav','audio/webm','audio/ogg','audio/mpeg','audio/mp4'].includes(media)));
  assert(value.descriptor_version===null||value.descriptor_version==='explicit-audio/1');
  if(value.applied){assert.equal(value.scoped,true);assert(value.audio_files>=1&&value.audio_files<=value.input_files);assert(value.audio_media_types.length>=1);assert.equal(value.descriptor_version,'explicit-audio/1');}
}
const attempts=new Map(),observationOnly=[],controls=[];
const scopes=['individual_real_gemini_synthetic_native_canary','real_agentic_mcp_and_attachment_synthetic_canary','real_gemini_web_text_control_no_attachments'];
for(const name of fs.readdirSync(path.join(root,'docs/evidence')).filter(name=>/^nodia-ai-ai32-r04-.*\.json$/.test(name))) {
  const file='docs/evidence/'+name,value=read(file);
  if(scopes.includes(value.scope))assert(artifactPaths.includes(file),'An R04 live attempt was omitted: '+file);
}
const forbiddenKeys=new Set(['raw','raw_response','provider_response','response_text','canonical_prompt','prompt','expected_text','rcid','url','filename']);
function noRaw(value) {
  if(Array.isArray(value)){value.forEach(noRaw);return;}
  if(!value||typeof value!=='object')return;
  for(const [key,item]of Object.entries(value)){assert(!forbiddenKeys.has(key),'Raw/provider identifier field persisted: '+key);noRaw(item);}
}
for(const file of artifactPaths.filter(file=>file.endsWith('.json')&&file.includes('ai32-r04'))) {
  const report=read(file);if(!scopes.includes(report.scope))continue;noRaw(report);
  for(const diagnostic of report.diagnostics??[]) {
    const generation=diagnostic.generation;
    if(generation?.structured_text)structured(generation.structured_text);
    if(generation?.audio_transport)audioTransport(generation.audio_transport);
    if(diagnostic.reply_format?.json_syntax)syntax(diagnostic.reply_format.json_syntax);
  }
  assert.equal(report.automatic_inference_retries,0);assert.equal(report.credentials_logged,false);assert.equal(report.provider_response_text_stored,false);
  for(const key of ['configured_database_modified','provider_configuration_modified'])if(key in report)assert.equal(report[key],false);
  if('business_writes' in report)assert.equal(report.business_writes,0);
  if(report.generation_requests===0){observationOnly.push({artifact:receipt(file),status:report.status});continue;}
  assert.equal(report.generation_requests,1);assert.equal(report.maximum_generations,1);
  const probe=report.probe??report;
  if(probe.kind==='audio'&&audioKinds[probe.media_type]) {
    const measured=audioFixtures.get(probe.file_sha256);
    assert(measured,'Unknown synthetic audio fixture: '+file);assert.equal(probe.media_type,measured.media_type);
    assert.equal(probe.file_bytes,measured.bytes);assert.equal(probe.expected_answer_sha256,measured.expected_sha256);
    assert.equal(probe.answer_normalization,'speech_words_v1');
  }
  assert.match(probe.attempt_id,/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);assert.equal(probe.native_acknowledged,true);
  assert.match(probe.expected_answer_sha256,/^[0-9a-f]{64}$/);
  if(probe.answer_sha256!==undefined&&probe.answer_sha256!==null)assert.match(probe.answer_sha256,/^[0-9a-f]{64}$/);
  const identity={engine:probe.engine??'agentic',scope:report.scope,model_id:probe.model_id,effort_id:probe.effort_id,
    configuration_generation:probe.configuration_generation,reference:probe.reference,file_sha256:probe.file_sha256??null,expected_answer_sha256:probe.expected_answer_sha256};
  if(attempts.has(probe.attempt_id))assert.deepEqual(attempts.get(probe.attempt_id).identity,identity);
  else attempts.set(probe.attempt_id,{identity,artifact:receipt(file),status:report.status,synthetic_audio_fixture:audioFixtures.get(probe.file_sha256)?.fixture_class??null,semantic_match:probe.semantic_canary_matches??probe.semantic_control_matches??null,native_outcome:probe.native_outcome??null,native_acknowledged:probe.native_acknowledged,final_selection_match:exact(report,probe,probe.engine??'agentic'),included_in_current_native_matrix:inputs.current_native_probe_paths.includes(file)});
  assert.equal(report.harness_sha256,hash(report.scope===scopes[2]?textHarness:report.scope===scopes[1]?mcpHarness:nativeHarness));
  if(report.scope===scopes[2]) {
    assert.equal(report.attachment_modalities_proved,false);assert.equal(report.native_harness_sha256,hash(nativeHarness));
    const passed=report.status==='passed';
    if(passed){assert.equal(probe.http_status,200);assert.equal(probe.semantic_control_matches,true);assert.equal(probe.answer_sha256,probe.expected_answer_sha256);assert.equal(probe.native_outcome,'completed');}
    let structuredPreservationExercised=false;
    if(passed&&report.literal_entities_control===true) {
      const proof=report.diagnostics?.find(item=>item.event==='web_success')?.generation?.structured_text;
      if(proof?.applied===true) {
        assert.equal(proof.last_equal,true);assert(proof.candidate_checks>0);assert.deepEqual(proof.last_source,proof.last_output);
        structuredPreservationExercised=proof.unprotected_html_would_change_outputs>0&&proof.protected_ampersands_total>=3&&proof.last_output.json_parseable===true;
      }
    }
    controls.push({artifact:receipt(file),attempt_id:probe.attempt_id,passed,literal_entities:report.literal_entities_control===true,
      verified_current:passed&&exact(report,probe,'web'),structured_preservation_exercised:structuredPreservationExercised,attachment_modalities_proved:false});
  }
}
const current=inputs.current_native_probe_paths.map(file=>{
  const report=read(file),probe=report.probe;assert.equal(report.scope,scopes[0]);assert(probe&&['web','agentic'].includes(probe.engine));assert(exact(report,probe,probe.engine),'Proof is not current: '+file);
  const passed=probe.http_status===200&&probe.native_outcome==='completed'&&probe.native_acknowledged===true
    &&probe.semantic_canary_matches===true&&probe.answer_sha256===probe.expected_answer_sha256;
  assert.equal(report.status==='passed',passed);assert.equal(probe.verified,passed);
  assert.equal(report.observation_after.resource_key,probe.reference.resource_key);assert.equal(report.observation_after.session_generation,probe.reference.session_generation);
  if(passed)assert.equal(probe.exact_format_verified,true);
  const generation=report.diagnostics?.find(item=>item.event==='web_success')?.generation;
  const state=generation?.structured_text,source=state?.last_source,transport=generation?.audio_transport;
  const audioObserved=probe.engine==='web'&&probe.kind==='audio'?transport?.applied===true
    &&transport.audio_files===1&&transport.audio_media_types?.includes(probe.media_type):null;
  if(passed&&probe.engine==='web'&&probe.kind==='audio')assert.equal(audioObserved,true,'The experimental audio descriptor was not observed.');
  return {artifact:receipt(file),engine:probe.engine,kind:probe.kind,media_type:probe.media_type,attempt_id:probe.attempt_id,verified:passed,
    synthetic_audio_fixture:audioFixtures.get(probe.file_sha256)?.fixture_class??null,
    full_json_source_parseable:source?.json_parseable??null,
    strict_parser_presentation_normalization_accepted:passed&&probe.engine==='web'&&source?.json_parseable===false,
    preparser_equal_to_source:state?.preparser_equal_to_source??null,explicit_audio_descriptor_observed:audioObserved};
});
const mediaTypes={};
for(const engine of ['web','agentic']) {
  const observed=health.native_observations[engine];
  mediaTypes[engine]=[...new Set(current.filter(item=>item.engine===engine&&item.verified).map(item=>item.media_type))].sort();
  assert.deepEqual([...observed.verified_attachment_media_types].sort(),mediaTypes[engine],'Final cache must have exact current successful canaries: '+engine);
  const kindTypes={image:['image/png','image/jpeg','image/webp'],pdf:['application/pdf'],audio:['audio/wav','audio/webm','audio/ogg','audio/mp4','audio/mpeg']};
  assert.deepEqual([...observed.verified_modalities].sort(),Object.keys(kindTypes).filter(kind=>mediaTypes[engine].some(type=>kindTypes[kind].includes(type))).sort());
}
const mcp=inputs.mcp_probe_paths.map(file=>{
  const report=read(file);assert.equal(report.scope,scopes[1]);assert.equal(report.generation_requests,1);assert(exact(report,report,'agentic'));
  const passed=report.status==='passed';
  if(passed){assert.equal(report.terminal_identity_verified,true);assert.equal(report.callbacks,1);assert.equal(report.native_hook_file_and_mcp_attested,true);assert.equal(report.semantic_canary_matches,true);assert.equal(report.answer_sha256,report.expected_answer_sha256);assert.equal(report.native_outcome,'completed');assert.equal(report.native_acknowledged,true);}
  return {artifact:receipt(file),verified:passed,attempt_id:report.attempt_id,callback:'synthetic_read_not_business_SQL'};
});
assert.equal(health.native_observations.agentic.supports_mcp,mcp.some(item=>item.verified));
assert.equal(health.native_observations.web.supports_mcp,false);
assert(inputs.text_control_paths.every(file=>controls.some(item=>item.artifact.path===file)));
let nodeObservation=null;
const nodeObservationPath='docs/evidence/nodia-ai-ai32-r04-node-observation.json';
if(artifactPaths.includes(nodeObservationPath)) {
  const value=read(nodeObservationPath);assert.equal(value.status,'passed');assert.equal(value.exit_code,0);
  assert.equal(value.provider_generations,0);assert.equal(value.database_writes,0);assert.equal(value.configured_database_read_only,true);
  assert.deepEqual(value.database_session,{default_read_only:'on',transaction_read_only:'on',pool_max:1});
  assert.equal(value.compiled_dist_files_verified,health.compiled_dist_files_verified);
  assert.equal(value.compiled_manifest_sha256,health.final_package_manifest_sha256);
  for(const key of ['script','log']){assert(artifactPaths.includes(value[key+'_path']));assert.equal(hash(value[key+'_path']),value[key+'_sha256']);}
  for(const [file,sha256]of Object.entries(value.source_hashes))assert.equal(hash('nodia-server/'+safePath(file)),sha256);
  assert.equal(value.selections.length,2);
  for(const selection of value.selections) {
    const engine=selection.mode==='token_plan_web'?'web':selection.mode==='token_plan_agentic'?'agentic':null;assert(engine);
    const observed=health.native_observations[engine];
    assert.equal(selection.connectionId,value.connection_id);assert.equal(selection.status,'contract_accepted');assert.equal(selection.available,true);
    for(const [nodeKey,nativeKey]of Object.entries({modelId:'model_id',effortId:'effort_id',resourceKey:'resource_key',sessionGeneration:'session_generation',configurationGeneration:'configuration_generation',supportsMcp:'supports_mcp'}))assert.equal(selection[nodeKey],observed[nativeKey]);
    assert.deepEqual([...selection.verifiedModalities].sort(),[...observed.verified_modalities].sort());
    assert.deepEqual([...selection.verifiedAttachmentMediaTypes].sort(),[...observed.verified_attachment_media_types].sort());
    assert.equal(selection.exactSessionMatched,true);assert.equal(selection.exactMediaTypesMatched,true);
  }
  nodeObservation={artifact:receipt(nodeObservationPath),source_files:Object.keys(value.source_hashes).length,exact_native_selection_and_MIME_projection_match:true,database_writes:0,provider_generations:0,configured_database_read_only:true};
}
const verificationLogs={};
const logPaths={knowledge_check:'.tmp/ai32-r04-knowledge-check.log',knowledge_build:'.tmp/ai32-r04-knowledge-build.log',catalog:'.tmp/ai32-r04-catalog-check.log',documentation:'.tmp/ai32-r04-doc-check.log'};
for(const [key,file]of Object.entries(logPaths))if(artifactPaths.includes(file)) {
  const lines=bytes(file).toString('utf8').trim().split(/\r?\n/);
  verificationLogs[key]={artifact:receipt(file),result:JSON.parse(lines.at(-1))};
}
for(const key of ['knowledge_check','knowledge_build'])if(verificationLogs[key]) {
  const value=verificationLogs[key].result;
  assert.equal(value.sources,55);assert.equal(value.excluded,28);assert.equal(value.documents,27);assert.equal(value.fragments,27);
  assert.equal(value.releaseId,health.knowledge_release);
}
if(verificationLogs.catalog){const value=verificationLogs.catalog.result;assert.equal(value.status,'passed');assert.equal(value.source_hashes,825);assert.equal(value.after_inventory_sha256,hash(inventoryPath));}
if(verificationLogs.documentation){const value=verificationLogs.documentation.result;assert.equal(value.status,'passed');assert.equal(value.documents,9);assert(value.r04_local_links_checked>=1);assert.equal(value.draft_approvals_preserved,true);assert.equal(value.ai32_acceptance_checkbox_open,true);}
const result={stage:'AI-32-R04',status:'private_lab_revalidation_with_explicit_acceptance_gates',documentary_approval:false,
  observed_at_utc:health.observed_at_utc,inputs,history:{preserved_artifacts:history,historical_sources_not_compared_to_current_tree:true},
  runtime:{gemini_image:health.gemini_image,activation:receipt(inputs.gemini_activation_path),health:receipt(inputs.final_health_path),
    native_sources:sources,node_sources_checked:inventory.sourceChecksums.length,node_and_knowledge_snapshot_unchanged_from_r02:true,
    node_adapter_observation:nodeObservation,application_layout:{artifact:receipt(appLayoutPath),script:receipt(appLayoutScript),source_and_configuration_mounts_exact:true,operational_scripts:0,source_archives:0},native_observations:health.native_observations,quiet:health.quiet,native_cleanup:health.native_cleanup,units:health.units,http:health.http},
  tests,build_attempts:buildAttempts,verification_logs:verificationLogs,audio_fixture_comparison:{artifact:receipt(audioAnalysisPath),initial_original_files_same_as_r03:true,initial_webm_ogg_encoded_payloads_and_decoded_PCM_identical:true,fresh_provenance:receipt(freshPath),fresh_generator:receipt(freshScript),execution_transcoding_enabled:false,physical_microphone_used:false},live:{current_verified_media_types:mediaTypes,current_native_probes:current,current_mcp_probes:mcp,text_controls:controls,
    generation_attempts:attempts.size,attempt_ids:[...attempts.keys()].sort(),attempts:[...attempts.values()],observation_only:observationOnly,
    automatic_inference_retries:0,business_writes:0,physical_microphone_used:false},
  acceptance:{r2_configuration_present:health.r2_configuration_present,r2_data_path_verified:health.r2_data_path_verified,
    physical_microphone_verified:false,productive_acceptance:false,approval:false,legacy_sql_and_recovery_verified_in_r02:true},artifacts};
if(check)assert.deepEqual(saved,result,'R04 evidence or sources changed.');
else fs.writeFileSync(path.join(root,destination),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({stage:result.stage,status:'passed',artifacts:artifacts.length,native_sources:sources.length,
  tests:{linux:tests.linux.passed,windows:tests.windows.passed,harnesses:tests.native_harness.passed+tests.text_harness.passed+tests.mcp_harness.passed},
  current_verified_media_types:mediaTypes,generation_attempts:attempts.size,documentary_approval:false}));
