/** Private VM operation. Receives only selected R2 values through SSH stdin. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const runtime = '/opt/nodia/releases/nodia-server-ai15-20261016';
const target = path.join(runtime, '.env');
const require = createRequire(path.join(runtime, 'package.json'));
const { parse } = require('dotenv');
const required = ['R2_ACCOUNT_ID','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','R2_BUCKET_NAME'];
const permitted = new Set([...required,'R2_ENDPOINT']);
const report = { stage:'AI-32-R05',scope:'private_r2_environment_activation',status:'running',
  observed_at_utc:new Date().toISOString(),configuration_modified:false,
  provider_generations:0,r2_object_operations:0,credential_values_exported:false,
  endpoint_or_bucket_values_exported:false,credential_fingerprints_exported:false };
let phase='input', oldText, stat, stopped=false, changed=false;
const run=(binary,args,timeout=30000)=>execFileSync(binary,args,{encoding:'utf8',timeout,stdio:['ignore','pipe','pipe']}).trim();
const quiet=()=>JSON.parse(run('/usr/local/bin/node',['/tmp/nodia-ai32-r04-native-candidate/quiet.mjs']));
const assertQuiet=(value)=>{if(['pending_jobs','open_attempts','held_or_unknown_slots'].some(key=>value[key]!==0))throw new Error('not_quiet');};
function writeAtomic(text){
  const temporary=target+'.ai32-r05-'+randomUUID();
  let descriptor;
  try{
    descriptor=fs.openSync(temporary,'wx',0o600);
    fs.writeFileSync(descriptor,text);fs.fsyncSync(descriptor);
    fs.fchownSync(descriptor,stat.uid,stat.gid);fs.fchmodSync(descriptor,stat.mode&0o777);
    fs.closeSync(descriptor);descriptor=undefined;fs.renameSync(temporary,target);
    const directory=fs.openSync(runtime,'r');try{fs.fsyncSync(directory);}finally{fs.closeSync(directory);}
  }finally{if(descriptor!==undefined)fs.closeSync(descriptor);if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
}
async function ready(){
  for(let attempt=0;attempt<45;attempt++){
    try{
      if(run('systemctl',['is-active','nodia-api'])==='active' && run('systemctl',['is-active','nodia-ai-worker'])==='active'){
        const response=await fetch('http://127.0.0.1:3000/api/v1/',{signal:AbortSignal.timeout(2000)});
        await response.body?.cancel();if(response.status===200)return;
      }
    }catch{}
    await new Promise(resolve=>setTimeout(resolve,1000));
  }
  throw new Error('readiness_failed');
}
try{
  let input=Buffer.alloc(0);
  for await(const chunk of process.stdin){input=Buffer.concat([input,chunk]);if(input.length>16384)throw new Error('input_limit');}
  const incoming=JSON.parse(input.toString('utf8'));
  if(!incoming || typeof incoming!=='object' || Array.isArray(incoming) || Object.keys(incoming).some(key=>!permitted.has(key)) ||
    required.some(key=>typeof incoming[key]!=='string'||!incoming[key].trim()) ||
    Object.values(incoming).some(value=>typeof value!=='string'||value.length>8192||/[\r\n\0]/.test(value)))throw new Error('invalid_input');
  phase='preflight';stat=fs.statSync(target);oldText=fs.readFileSync(target,'utf8');
  const before=parse(oldText);
  if(required.some(key=>typeof before[key]==='string' && before[key].trim()))throw new Error('existing_r2_configuration');
  const keys=Object.keys(incoming),seen=new Set();
  let nextText=oldText.split(/(?<=\n)/).map(line=>{
    const match=line.match(/^\s*(?:export\s+)?(R2_[A-Z0-9_]+)\s*=/);
    if(!match || !Object.hasOwn(incoming,match[1]))return line;
    const key=match[1];if(seen.has(key))return '';seen.add(key);
    return key+'='+JSON.stringify(incoming[key])+'\n';
  }).join('');
  for(const key of keys)if(!seen.has(key)){if(nextText && !nextText.endsWith('\n'))nextText+='\n';nextText+=key+'='+JSON.stringify(incoming[key])+'\n';}
  const after=parse(nextText);
  if(keys.some(key=>after[key]!==incoming[key]))throw new Error('dotenv_roundtrip_failed');
  const other=(values)=>Object.fromEntries(Object.entries(values).filter(([key])=>!keys.includes(key)).sort(([a],[b])=>a.localeCompare(b)));
  if(JSON.stringify(other(before))!==JSON.stringify(other(after)))throw new Error('unrelated_configuration_changed');
  const baseline=quiet();assertQuiet(baseline);
  const native=JSON.parse(run('python3',['/tmp/ai32-r04-cleanup.py']));
  if(['unknown_markers','armed_native_proofs','terminal_native_proofs','invalid_native_proofs','temporary_attachment_directories','temporary_cli_directories'].some(key=>native[key]!==0))throw new Error('native_not_quiet');
  const geminiBefore=run('docker',['inspect','--format','{{.Id}} {{.State.StartedAt}} {{.Image}}','nodia-gemini-microservice']);
  const nginxBefore=run('systemctl',['show','nginx','--property=MainPID','--property=ActiveEnterTimestampMonotonic','--value']);
  const backup='/opt/nodia/verification-backups/ai32-r05-r2-'+Date.now();
  fs.mkdirSync(backup,{mode:0o700});
  const backupFile=path.join(backup,'.env.before');const fd=fs.openSync(backupFile,'wx',0o600);
  try{fs.writeFileSync(fd,oldText);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  phase='stop_api_worker';stopped=true;run('systemctl',['stop','nodia-api','nodia-ai-worker'],60000);
  assertQuiet(quiet());if(fs.readFileSync(target,'utf8')!==oldText)throw new Error('configuration_raced');
  phase='atomic_configuration';writeAtomic(nextText);changed=true;
  phase='start_api_worker';run('systemctl',['start','nodia-api','nodia-ai-worker'],60000);await ready();stopped=false;
  phase='postflight';const finalQuiet=quiet();assertQuiet(finalQuiet);
  if(finalQuiet.migrations!==baseline.migrations)throw new Error('schema_changed');
  const finalStat=fs.statSync(target);
  if(finalStat.uid!==stat.uid||finalStat.gid!==stat.gid||(finalStat.mode&0o777)!==(stat.mode&0o777))throw new Error('environment_metadata_changed');
  if(run('docker',['inspect','--format','{{.Id}} {{.State.StartedAt}} {{.Image}}','nodia-gemini-microservice'])!==geminiBefore)throw new Error('gemini_changed');
  if(run('systemctl',['show','nginx','--property=MainPID','--property=ActiveEnterTimestampMonotonic','--value'])!==nginxBefore)throw new Error('nginx_changed');
  Object.assign(report,{status:'passed',configuration_modified:true,backup_directory:backup,backup_mode_private:true,
    copied_variable_names:keys,other_environment_values_preserved:true,environment_owner_mode_preserved:true,
    api_and_worker_restarted:true,gemini_container_identity_preserved:true,nginx_identity_preserved:true,
    quiet_before:baseline,quiet_after:finalQuiet,credential_validity_verified:false});
}catch{
  report.status='failed';report.safe_error_category=phase;
  if(changed&&oldText!==undefined){try{writeAtomic(oldText);report.configuration_rolled_back=true;}catch{report.configuration_rolled_back=false;}}
  if(stopped||changed){try{run('systemctl',['start','nodia-api','nodia-ai-worker'],60000);await ready();report.services_recovered=true;}catch{report.services_recovered=false;}}
  process.exitCode=1;
}
report.completed_at_utc=new Date().toISOString();console.log(JSON.stringify(report,null,2));
