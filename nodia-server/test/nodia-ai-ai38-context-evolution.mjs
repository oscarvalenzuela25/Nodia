// Fixture-approved publication evolution; real compiled admission/checkpoints and
// isolated PostgreSQL, two separate Node processes, zero provider/operational IO.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { fork } from 'node:child_process';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { createNodiaAiIntegrationFixture, loadAi } from './nodia-ai.integration.fixture.mjs';

const hash = raw => createHash('sha256').update(raw).digest('hex');
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(here);
const childMode = process.argv.includes('--fixture-process');
const send = value => process.send(value);

async function childMain() {
  const configuration = await new Promise(resolve => process.once('message', resolve));
  const db = await new DataSource(configuration.options).initialize();
  let app, compiled;
  try {
    const names = [
      ['nodia-ai-conversation/nodia-ai-conversation.module','NodiaAiConversationModule'],
      ['nodia-ai-context/nodia-ai-processing.module','NodiaAiProcessingModule'],
      ['nodia-ai-runtime/nodia-ai-runtime.module','NodiaAiRuntimeModule'],
      ['nodia-ai-runtime/use-case/run-nodia-ai-stage.use-case','RunNodiaAiStageUseCase'],
      ['nodia-ai-adapter/types/nodia-ai-adapter.types','NodiaAiAdapterPort'],
      ['nodia-ai-tools/nodia-ai-tool-registry.module','NodiaAiToolRegistryModule'],
      ['nodia-ai-conversation/use-case/create-nodia-ai-conversation.use-case','CreateNodiaAiConversationUseCase'],
      ['nodia-ai-conversation/use-case/admit-nodia-ai-message.use-case','AdmitNodiaAiMessageUseCase'],
      ['nodia-ai-context/use-case/load-nodia-ai-knowledge.use-case','LoadNodiaAiKnowledgeUseCase'],
    ];
    const [Conversation,Processing,Runtime,Stage,Adapter,Registry,Create,Admit,Knowledge] = await Promise.all(names.map(([file,name])=>loadAi(file,name)));
    const tokens = await import('../dist/nodia-ai-context/types/knowledge.types.js');
    const toolTokens = await import('../dist/nodia-ai-tools/types/tool-registry.types.js');
    const schema = fs.readFileSync(path.join(root,'scripts/nodia-ai-knowledge/contracts.schema.json'));
    const manifest = configuration.manifest;
    const pin = {schema_version:1,release_id:manifest.release_id,catalog_release:manifest.catalog_release,schema_sha256:hash(schema)};
    const calls=[];
    const adapter={
      async verifyConfiguration(){},
      async observe(){return {available:true,observedAt:new Date(),source:'synthetic_evolution_fixture',
        resourceKey:'gemini-profile:'+'a'.repeat(64),configurationGeneration:'b'.repeat(64),
        sessionGeneration:'c'.repeat(32),adapterContractVersion:'nodia-ai-gemini-chat/1',supportsMcp:false,reason:null};},
      async measureContext(request){
        const canonicalUtf8Bytes=Buffer.byteLength(request.canonicalPrompt),catalogUtf8Bytes=0,overheadUtf8Bytes=1000;
        return {measurementContractVersion:'nodia-ai-context-budget/1',measurementScope:'initial_native_prompt',measurementKind:'exact',
          canonicalUtf8Bytes,catalogUtf8Bytes,overheadUtf8Bytes,totalUtf8Bytes:canonicalUtf8Bytes+overheadUtf8Bytes,
          firstMcpListingUpperBoundUtf8Bytes:0,maxUtf8Bytes:262144,modelContextTokens:null};
      },
      async execute(request){
        assert.equal(request.selection.mode,'agentic','Context evolution preserves the exact Agentic selection');
        const prompt=JSON.parse(request.canonicalPrompt);
        const proof={engine:'agentic',attemptId:request.attemptId,resourceKey:request.resourceKey,
          sessionGeneration:request.sessionGeneration,operationRef:request.attemptId,terminalProofId:randomUUID(),
          processClosed:true,outcome:'completed',observedAt:new Date()};
        calls.push({prompt,proof:{...proof,observedAt:proof.observedAt.toISOString()}});
        return {kind:'answer',text:'Synthetic answer from '+manifest.catalog_release,terminalProof:proof};
      },
    };
    let builder=Test.createTestingModule({imports:[TypeOrmModule.forRootAsync({useFactory:()=>configuration.options,dataSourceFactory:async()=>db}),Conversation,Processing,Runtime],providers:[Stage]});
    const imports=Reflect.getMetadata('imports',Registry);
    for(const [file,name] of [
      ['nodia-ai-products/nodia-ai-product-reads.module','NodiaAiProductReadsModule'],
      ['nodia-ai-write-tools/nodia-ai-write-tools.module','NodiaAiWriteToolsModule'],
      ['nodia-ai-invoice-analysis/nodia-ai-invoice-analysis.module','NodiaAiInvoiceAnalysisModule'],
      ['nodia-ai-common-reads/nodia-ai-common-reads.module','NodiaAiCommonReadsModule'],
      ['nodia-ai-common-preparation/nodia-ai-common-preparation.module','NodiaAiCommonPreparationModule'],
    ]){
      const Module=await loadAi(file,name),actual=imports.find(value=>value?.module===Module);
      assert.ok(actual);
      builder=builder.overrideModule(actual).useModule(Module.forPublication(name==='NodiaAiProductReadsModule'?[configuration.capabilityId]:[]));
    }
    builder.overrideProvider(tokens.NODIA_AI_KNOWLEDGE_ROOT).useValue(configuration.bundle);
    builder.overrideProvider(tokens.NODIA_AI_KNOWLEDGE_PIN).useValue(pin);
    builder.overrideProvider(tokens.NODIA_AI_KNOWLEDGE_SCHEMA).useValue(schema);
    builder.overrideProvider(toolTokens.NODIA_AI_CAPABILITIES_CATALOG_VERSION).useValue(manifest.catalog_release);
    compiled=await builder.overrideProvider(Adapter).useValue(adapter).compile();
    app=compiled.createNestApplication({logger:false});await app.init();
    const knowledge=compiled.get(Knowledge),create=compiled.get(Create),admit=compiled.get(Admit),stage=compiled.get(Stage);
    const identity=configuration.identity,selection=configuration.selection;
    send({kind:'ready',pid:process.pid,release:knowledge.manifest.release_id,catalog:manifest.catalog_release});
    for await (const message of messages()) {
      const {id,action}=message;
      try {
        let result;
        if(action==='admit'){
          const chat=message.chatId?{conversation_id:message.chatId}:await create.execute(identity,{client_request_id:randomUUID(),selection});
          const [row]=await db.query('SELECT revision FROM nodia_ai_conversations WHERE id=$1',[chat.conversation_id]);
          const admitted=await admit.execute(identity,chat.conversation_id,{client_message_id:randomUUID(),expected_conversation_revision:row.revision,
            parts:[{kind:'text',text:'Synthetic request under '+manifest.catalog_release}]});
          result={chatId:chat.conversation_id,runId:admitted.run.run_id};
        } else if(action==='stage') result={claimed:await stage.execute(randomUUID(),AbortSignal.timeout(20000)),calls};
        else if(action==='knowledge') result={index:knowledge.index(message.routes),detail:knowledge.execute(message.routes,message.ids)};
        else if(action==='close'){send({id,result:{closed:true}});break;}
        else throw Error('Unknown fixture command');
        send({id,result});
      }catch(error){send({id,error:{name:error.name,message:error.message}});}
    }
  } finally {
    if(app)await app.close();else if(compiled)await compiled.close();
    if(db.isInitialized)await db.destroy();
    process.disconnect?.();
  }
}
async function* messages(){
  const queued=[];let wake;
  const listener=value=>{queued.push(value);wake?.();wake=undefined;};
  process.on('message',listener);
  try{while(true){if(!queued.length)await new Promise(resolve=>{wake=resolve;});yield queued.shift();}}
  finally{process.off('message',listener);}
}

async function main(){
  const output=process.env.NODIA_AI_EVOLUTION_OUTPUT;
  assert.ok(output&&path.isAbsolute(output)&&!fs.existsSync(output),'Explicit new report required');
  const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'nodia-ai-evolution-'));
  const children=[],checks=[];
  let fixture;
  const report={stage:'AI-38',scope:'isolated_fixture_approved_product_context_evolution_two_processes',status:'running',checks,
    provider_generations:0,configured_database_access:false,operational_publication:false,operational_adoption:false,
    approvals:'synthetic fixtures only; never approval of repository documents',hot_reload:false};
  const save=()=>fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
  const check=(name,condition=true)=>{assert.ok(condition,name);checks.push(name);save();};
  const put=(file,value)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,value);};
  const getRun=async id=>(await fixture.db.query('SELECT * FROM nodia_ai_runs WHERE id=$1',[id]))[0];
  async function boot(bundle,manifest,capabilityId,selection){
    const child=fork(fileURLToPath(import.meta.url),['--fixture-process'],{cwd:root,env:{PATH:process.env.PATH,HOME:os.tmpdir(),NODE_ENV:'test',RATE_LIMIT_STORAGE:'memory',DOTENV_CONFIG_PATH:'/dev/null'},stdio:['ignore','pipe','pipe','ipc']});
    children.push(child);let diagnostic='';child.stderr.on('data',data=>{diagnostic=(diagnostic+data).slice(-16384);});child.stdout.resume();
    const pending=new Map();
    const ready=new Promise((resolve,reject)=>{
      child.on('message',message=>{if(message.kind==='ready')resolve(message);else if(message.id){const task=pending.get(message.id);pending.delete(message.id);if(message.error)task?.reject(Error(JSON.stringify(message.error)));else task?.resolve(message.result);}});
      child.once('exit',code=>{const error=Error('Fixture process exited '+code+' '+diagnostic);reject(error);for(const task of pending.values())task.reject(error);});
    });
    child.send({options:fixture.options,identity:fixture.identities.get('3'),selection,bundle,manifest,capabilityId});
    const info=await ready;
    return {info,child,request(action,other={}){const id=randomUUID();return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});child.send({id,action,...other});});}};
  }
  try{
    const compiler=await import('../scripts/nodia-ai-knowledge/compiler.mjs');
    const fm=(await import('../scripts/nodia-ai-knowledge/frontmatter.cjs')).default;
    const original=JSON.parse(fs.readFileSync(path.join(root,'dist/nodia-ai/knowledge/manifest.json'),'utf8'));
    const capability=structuredClone(original.capability_contracts.find(item=>item.capability_id==='nodia_actions_get'));
    assert.ok(capability,'Exact compiled read contract required');
    for(const source of [...capability.implementation_sources,capability.input_schema,capability.output_schema]){
      const bytes=fs.readFileSync(path.join(root,'fixture-contract-sources',source.path));
      assert.equal(hash(bytes),source.sha256);put(path.join(workspace,source.path),bytes);
    }
    for(const evidence of capability.evidence_paths)put(path.join(workspace,evidence),'{}\n');
    put(path.join(workspace,'docs/mvp/evolution-fixture.md'),'# Synthetic specification\n');
    put(path.join(workspace,'docs/evidence/evolution-fixture.json'),'{"fixture_only":true}\n');
    put(path.join(workspace,'docs/mvp/evolution-fixture-approval.md'),'# Synthetic approval; not a repository approval\n');
    const metadata=(id,kind,revision)=>({schema_version:1,document_id:id,product_id:'evolution',kind,revision,
      document_status:'approved',implementation:{status:'implemented',notes:'Synthetic publication fixture'},integration_status:'verified',maintainer:'FIXTURE_ONLY',
      sources:[{path:'docs/mvp/evolution-fixture.md',kind:'specification'}],verification:{checked_on:'2026-10-20',evidence_paths:['docs/evidence/evolution-fixture.json'],notes:'Isolated synthetic test'},
      approval:{reference:'docs/mvp/evolution-fixture-approval.md',revision,content_sha256:'a'.repeat(64)}});
    const requirement={capability_id:capability.capability_id,revision:capability.revision,input_schema_sha256:capability.input_schema.sha256,output_schema_sha256:capability.output_schema.sha256};
    const productPath='docs/nodia-ai/knowledge/evolution/README.md',featurePath='docs/nodia-ai/knowledge/evolution/features/new-feature.md';
    const binding=(document_id,purpose)=>({document_id,fragment_id:'overview',purpose,sections:['Overview'],requires:[requirement],required_module_routes:capability.required_module_routes});
    const writeDoc=(file,meta,body)=>{meta.approval.content_sha256=fm.contentHash(meta,body);put(path.join(workspace,file),fm.serializeDocument(meta,body));};
    const registry={schema_version:1,catalog_release:'synthetic-evolution/a',context_module_route:'/tools/nodia-ai',source_paths:[productPath],capabilities:[capability],bindings:[binding('evolution','product_summary')]};
    writeDoc(productPath,metadata('evolution','product',1),'# Fixture product\n\n## Overview\nSYNTHETIC_PRODUCT_A_CONTEXT\n');
    const compile=previous=>{put(path.join(workspace,compiler.registryPath),JSON.stringify(registry));return compiler.compileKnowledge(workspace,previous);};
    const a=compile(null),bundleA=compiler.emitBundle(workspace,a);
    const releaseA=path.join(workspace,'immutable-a');fs.renameSync(bundleA,releaseA);
    fixture=await createNodiaAiIntegrationFixture('ai3801');
    const [group]=await fixture.db.query("INSERT INTO module_groups(key) VALUES('synthetic_evolution_fixture') RETURNING id::text");
    for(const [index,route] of capability.required_module_routes.entries())await fixture.db.query(
      `INSERT INTO modules(key,link,module_group_id) SELECT $1::varchar,$2::varchar,$3::bigint WHERE NOT EXISTS(SELECT 1 FROM modules WHERE link=$2::varchar)`,
      ['synthetic_evolution_'+index,route,group.id]);
    const [provider]=await fixture.db.query("INSERT INTO ai_providers(name,fields) VALUES('Synthetic evolution transport','{}') RETURNING id::text");
    const selection={connection_id:provider.id,mode:'agentic',model_id:'synthetic-evolution-fixture-model',effort_id:null};
    const processA=await boot(releaseA,a.manifest,capability.capability_id,selection);
    const first=await processA.request('admit');
    const admittedA=await getRun(first.runId);
    check('run admitted in process A pins release A and catalog A before publication',admittedA.context_manifest.knowledge_release===a.manifest.release_id&&admittedA.catalog_version===registry.catalog_release);
    registry.catalog_release='synthetic-evolution/b';registry.source_paths.push(featurePath);registry.bindings.push(binding('evolution.new-feature','feature_explanation'));
    writeDoc(productPath,metadata('evolution','product',2),'# Fixture product\n\n## Overview\nSYNTHETIC_PRODUCT_B_CONTEXT\n');
    writeDoc(featurePath,metadata('evolution.new-feature','feature',1),'# Fixture extension\n\n## Overview\nSYNTHETIC_NEW_FEATURE_B_DETAIL\n');
    const b=compile(a.manifest),bundleB=compiler.emitBundle(workspace,b);
    check('compiler publishes a changed product revision and a new fixture-approved feature only in isolated bundle B',b.manifest.release_id!==a.manifest.release_id&&b.manifest.documents.length===2&&b.manifest.documents.find(item=>item.document_id==='evolution').revision===2);
    const processB=await boot(bundleB,b.manifest,capability.capability_id,selection);
    check('B starts in a genuinely different process while old A remains alive',processA.info.pid!==processB.info.pid&&processA.child.exitCode===null);
    check('new worker B refuses to claim old catalog A job',(await processB.request('stage')).claimed===false);
    const oldKnowledge=await processA.request('knowledge',{routes:['/nodia-ai',...capability.required_module_routes]});
    check('existing A loader retains its pinned product and does not hot-reload B',oldKnowledge.detail.releaseId===a.manifest.release_id&&oldKnowledge.detail.fragments[0].text.includes('SYNTHETIC_PRODUCT_A_CONTEXT')&&!oldKnowledge.index.some(item=>item.id==='evolution.new-feature:overview'));
    let firstStage;
    for(let pass=0;pass<5;pass++){firstStage=await processA.request('stage');if((await getRun(first.runId)).state==='completed')break;}
    const completedA=await getRun(first.runId);
    assert.equal(completedA.state,'completed',JSON.stringify(completedA));
    const [jobA]=await fixture.db.query('SELECT id FROM nodia_ai_jobs WHERE run_id=$1',[first.runId]);
    const receiptsA=await fixture.db.query('SELECT * FROM nodia_ai_job_attempts WHERE job_id=$1 ORDER BY id',[jobA.id]);
    const [nativeReceiptA]=await fixture.db.query("SELECT * FROM nodia_ai_jobs WHERE dedup_key=$1",['ack:'+firstStage.calls[0].proof.attemptId]);
    assert.ok(nativeReceiptA?.recovery_descriptor);
    const storedA={context:completedA.context_manifest,receipts:receiptsA,nativeReceipt:nativeReceiptA};
    const beforeHash=hash(JSON.stringify(storedA));
    check('old A completes exactly once with its original context and synthetic terminal receipt',firstStage.calls.length===1&&completedA.context_manifest.knowledge_release===a.manifest.release_id&&receiptsA.some(item=>item.ended_at!==null));
    check('in-flight A answer never receives B explanation or feature',JSON.stringify(firstStage.calls[0].prompt).includes('SYNTHETIC_PRODUCT_A_CONTEXT')&&!JSON.stringify(firstStage.calls[0].prompt).includes('SYNTHETIC_PRODUCT_B_CONTEXT'));
    const closedA=new Promise(resolve=>processA.child.once('exit',resolve));
    await processA.request('close');await closedA;
    const second=await processB.request('admit',{chatId:first.chatId});
    const admittedB=await getRun(second.runId);
    check('next human turn in the same chat is admitted under release B',admittedB.context_manifest.knowledge_release===b.manifest.release_id&&admittedB.catalog_version===b.manifest.catalog_release);
    let secondStage;
    for(let pass=0;pass<5;pass++){secondStage=await processB.request('stage');if((await getRun(second.runId)).state==='completed')break;}
    const completedB=await getRun(second.runId);assert.equal(completedB.state,'completed',JSON.stringify(completedB));
    const promptB=secondStage.calls[0].prompt;
    check('B prompt uses revised product summary and the new feature index',JSON.stringify(promptB.knowledge).includes('SYNTHETIC_PRODUCT_B_CONTEXT')&&promptB.knowledge_index.some(item=>item.id==='evolution.new-feature:overview'));
    check('B preserves the original human request and assistant answer from A as canonical history',promptB.messages.some(item=>item.content.includes('Synthetic request under synthetic-evolution/a'))&&promptB.messages.some(item=>item.content==='Synthetic answer from synthetic-evolution/a'));
    const detailB=await processB.request('knowledge',{routes:['/nodia-ai',...capability.required_module_routes],ids:['evolution.new-feature:overview']});
    check('new process resolves the exact new feature detail through the real compiled loader',detailB.detail.fragments[0].text.includes('SYNTHETIC_NEW_FEATURE_B_DETAIL'));
    const hidden=await processB.request('knowledge',{routes:['/nodia-ai']});
    check('new product detail is still hidden without its target module',hidden.index.length===0&&hidden.detail.fragments.length===0);
    const afterA=await getRun(first.runId),afterReceipts=await fixture.db.query('SELECT * FROM nodia_ai_job_attempts WHERE job_id=$1 ORDER BY id',[jobA.id]);
    const [afterNativeReceipt]=await fixture.db.query('SELECT * FROM nodia_ai_jobs WHERE id=$1',[nativeReceiptA.id]);
    check('B completion does not rewrite the old context manifest or terminal-attempt receipt',hash(JSON.stringify({context:afterA.context_manifest,receipts:afterReceipts,nativeReceipt:afterNativeReceipt}))===beforeHash);
    check('old admitted run remains completed and cannot be replayed by B',(await processB.request('stage')).claimed===false&&secondStage.calls.length===1);
    await processB.request('close');
    report.releases={a:{release_id:a.manifest.release_id,catalog:a.manifest.catalog_release},b:{release_id:b.manifest.release_id,catalog:b.manifest.catalog_release}};
    report.synthetic_dispatches=2;report.receipt_a_before_after_sha256=beforeHash;report.process_ids=[processA.info.pid,processB.info.pid];
    report.status='passed';
  }catch(error){report.status='failed';report.failure={name:error.name,message:error.message};throw error;}
  finally{
    for(const child of children)if(child.exitCode===null){child.kill('SIGTERM');await new Promise(resolve=>child.once('exit',resolve));}
    await fixture?.close();
    const absolute=fs.realpathSync(workspace);assert.ok(absolute.startsWith(path.join(fs.realpathSync(os.tmpdir()),'nodia-ai-evolution-')));
    fs.rmSync(absolute,{recursive:true,force:true});report.cleanup_complete=true;save();
  }
}
if(childMode)await childMain();else await main();
