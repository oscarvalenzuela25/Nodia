// Explicit operator canary. No HTTP/tool entry point, auth impersonation, auto-selection or retry.
// Requires an owned dedicated draft for setup, or active session + unused anchored thread for helper, created via
// the UI or explicitly authorized operator setup under the same validated actor reference.
// Neither setup path creates auth sessions, impersonates another actor or forges JWTs.
import 'reflect-metadata';
import {readFile} from 'node:fs/promises';
import {parseTeacherQualificationArgs} from './teacher-qualification-args.mjs';
import source from '../dist/config/data-source.js';
import {TeacherGenerationRuntimeService} from '../dist/ai-generation/teacher-generation-runtime.service.js';
import {ApiTextGenerationService} from '../dist/ai-generation/api-text-generation.service.js';
import {GenerationWorkerSourceRegistry} from '../dist/ai-generation/worker-source-registry.js';
import {ApiNodiaAiCredentialsService} from '../dist/nodia-ai-adapter/api-nodia-ai-credentials.service.js';
import {NodiaAiConnectionsService} from '../dist/nodia-ai-conversation/nodia-ai-connections.service.js';
import {CheckModuleAccessUseCase} from '../dist/authorization/use-case/check-module-access.use-case.js';
import {ValidateNodiaAiRuntimePolicyUseCase} from '../dist/nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case.js';
import {PublishTeacherUseCase} from '../dist/teacher/use-case/publish-teacher.use-case.js';
import {TeacherService} from '../dist/teacher/teacher.service.js';
import {AssertNodiaAiOperationModeUseCase} from '../dist/nodia-ai-runtime/use-case/assert-nodia-ai-operation-mode.use-case.js';

let parsed;
try { parsed=parseTeacherQualificationArgs(process.argv.slice(2)); } catch { parsed=null; }
const {sessionId,userId,authSession,originalJobId,purpose,threadId}=parsed??{};
let codexRuntime, codexTeacher;
if(!parsed){
  console.error('Required: --session-id=<owned dedicated session UUID> --user-id=<authenticated owner bigint> --auth-session-public-id=<their current session UUID>; optional --purpose=setup_reply|contextual_reply, --complete-job-id=<original UUID>; a new contextual probe also requires --thread-id=<unused anchored thread UUID>');
  process.exitCode=2;
}else try{
  new AssertNodiaAiOperationModeUseCase().execute(process.env);
  await source.initialize();
  const policy=new ValidateNodiaAiRuntimePolicyUseCase().execute(JSON.parse(await readFile(new URL('../dist/nodia-ai-runtime/config/runtime-policy.json',import.meta.url),'utf8')));
  const access=new CheckModuleAccessUseCase(source),credentials=new ApiNodiaAiCredentialsService(source);
  const actor={userId,sessionId:authSession};
  const store=new TeacherService(source,access);
  const selection=await store.scope(actor,sessionId,async({session})=>session.selection);
  if(!selection)throw Error('teacher:no_model');
  const api=new ApiTextGenerationService(credentials,policy);
  let agentic, route;
  if(selection.mode==='agentic'){
    const {TeacherAgenticTextService}=await import('../dist/ai-generation/teacher-agentic-text.service.js');
    const {GeminiTeacherTextTransport}=await import('../dist/ai-generation/gemini-teacher-text-transport.js');
    const {CodexTeacherTextTransport}=await import('../dist/ai-generation/codex-teacher-text-transport.js');
    const {RouteTextGenerationService}=await import('../dist/ai-generation/route-text-generation.service.js');
    const {NodiaAiAdapterTransport}=await import('../dist/nodia-ai-adapter/nodia-ai-adapter.service.js');
    const {CodexRuntimeService}=await import('../dist/common/ai/codex/codex-runtime.service.js');
    const {CodexChatRuntime}=await import('../dist/common/ai/codex/codex-chat-runtime.js');
    codexRuntime=new CodexRuntimeService();
    codexTeacher=new CodexTeacherTextTransport(codexRuntime,new CodexChatRuntime(codexRuntime));
    codexTeacher.onModuleInit();
    agentic=new TeacherAgenticTextService(source,new GeminiTeacherTextTransport(new NodiaAiAdapterTransport()),codexTeacher);
    route=new RouteTextGenerationService(api,agentic);
  }
  const runtime=new TeacherGenerationRuntimeService(source,access,credentials,new NodiaAiConnectionsService(source),new GenerationWorkerSourceRegistry(),route??api,policy,agentic);
  const publisher=new PublishTeacherUseCase();runtime.setPublisher(publisher.publish.bind(publisher));
  const result=originalJobId
    ?await (purpose==='contextual_reply'
      ?runtime.completeContextualQualification(actor,sessionId,originalJobId,AbortSignal.timeout(40000))
      :runtime.completeTextQualification(actor,sessionId,originalJobId,AbortSignal.timeout(40000)))
    :await (purpose==='contextual_reply'
      ?runtime.qualifyContextualReply(actor,sessionId,selection,threadId,AbortSignal.timeout(125000))
      :runtime.qualifyText(actor,sessionId,selection,AbortSignal.timeout(125000)));
  console.log(JSON.stringify({contract:selection.mode==='agentic'?'teacher-agentic-text/1':'teacher-text/1',...result,
    ...(selection.mode==='agentic'?{posts:null,native_dispatches:1,provider_internal_generation_posts:null}:{}),
    dispatched_now:!originalJobId}));
}catch(error){
  if(error instanceof Error&&['nodia_ai:quarantine_blocks_startup','nodia_ai:invalid_operation_mode'].includes(error.message)){
    console.error(JSON.stringify({code:error.message,retry:false,stage:'operation_mode',dispatched:false}));process.exitCode=1;
  }else{
    const code=error instanceof Error&&/^teacher:[a-z_]+$/.test(error.message)?error.message:'teacher:qualification_failed';
    console.error(JSON.stringify({code,retry:false,action:'inspect the original Teacher job; unknown must never be replayed'}));process.exitCode=1;
  }
}finally{
  await codexTeacher?.onModuleDestroy();
  await codexRuntime?.onModuleDestroy();
  if(source.isInitialized)await source.destroy();
}
