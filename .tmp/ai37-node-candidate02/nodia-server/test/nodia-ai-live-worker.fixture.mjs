// Explicit real worker entrypoint; all SQL state and credentials are disposable fixtures.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

export async function runWorkerMatrix({db,options,create,admit,identity,modeSelection,check,reserveGeneration,drainProofCleanup}){
  assert.equal(options.host,'127.0.0.1');
  assert.equal(options.database,'ai12');
  assert.notEqual(options.port,5432,'Never start a diagnostic worker against the configured database');
  const chat=await create.execute(identity,{client_request_id:randomUUID(),selection:modeSelection('token_plan_agentic')});
  const accepted=await admit.execute(identity,chat.conversation_id,{client_message_id:randomUUID(),
    expected_conversation_revision:chat.revision,parts:[{kind:'text',text:'Consulta nodia_knowledge_index para conocer qué fichas publicadas tienes y dime cuántas son. No inventes funcionalidades.'}]});
  reserveGeneration();
  const child=spawn(process.execPath,[fileURLToPath(new URL('../dist/nodia-ai-worker.js',import.meta.url))],{
    cwd:fileURLToPath(new URL('..',import.meta.url)),windowsHide:true,stdio:['ignore','pipe','pipe'],
    env:{...process.env,DOTENV_CONFIG_PATH:process.platform==='win32'?'NUL':'/dev/null',NODE_ENV:'test',RATE_LIMIT_STORAGE:'memory',
      POSTGRES_HOST:options.host,POSTGRES_PORT:String(options.port),POSTGRES_DB:options.database,
      POSTGRES_USER:options.username,POSTGRES_PASSWORD:options.password},
  });
  let exit,outputBytes=0,outputLimit=false;
  const exited=new Promise(resolve=>{
    child.once('error',()=>{exit={spawnError:true};resolve(exit);});
    child.once('exit',(code,signal)=>{exit={code,signal};resolve(exit);});
  });
  for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{
    outputBytes+=chunk.byteLength;
    if(outputBytes>1048576&&!outputLimit){outputLimit=true;child.kill('SIGTERM');}
  });
  let run,failure,stopFailed=false;
  try{
    const deadline=Date.now()+180000;
    while(Date.now()<deadline){
      [run]=await db.query('SELECT * FROM nodia_ai_runs WHERE id=$1',[accepted.run.run_id]);
      if(['completed','failed','unknown','cancelled'].includes(run.state))break;
      assert.equal(exit,undefined,'The standalone worker exited before sealing its admitted turn');
      assert.equal(outputLimit,false,'Standalone worker output exceeded its diagnostic budget');
      await delay(250);
    }
    check('standalone compiled worker completes the real Agentic run',run?.state==='completed');
    check('standalone worker performs one dispatch and bounded technical MCP',run.provider_dispatches_used===1&&run.tool_calls_used>=1&&run.mcp_rpc_messages_used>=1);
    const slots=await db.query('SELECT state FROM nodia_ai_runtime_slots');
    check('standalone worker releases every reserved SQL runtime slot',slots.length===1&&slots.every(slot=>slot.state==='free'));
  }catch(error){failure=error;}
  finally{
    if(!exit)child.kill('SIGTERM');
    let timer;
    try{
      const stopped=await Promise.race([exited.then(()=>true),new Promise(resolve=>{timer=setTimeout(()=>resolve(false),20000);})]);
      if(!stopped){child.kill('SIGKILL');await exited;stopFailed=true;}
    }finally{clearTimeout(timer);}
  }
  if(stopFailed)throw new AggregateError(failure?[failure]:[],'Worker drain exceeded the diagnostic wait; preserve unresolved runtime identities');
  if(failure)throw failure;
  check('standalone worker shuts down without another inference',!exit.spawnError&&(exit.code===0||exit.signal==='SIGTERM')&&outputLimit===false);
  await drainProofCleanup();
  const pending=await db.query("SELECT id FROM nodia_ai_jobs WHERE kind='reconcile'");
  check('standalone worker terminal receipts are acknowledged and removed',pending.length===0);
  return {worker_entrypoint:'dist/nodia-ai-worker.js',output_bytes:outputBytes,run_id:run.id};
}
