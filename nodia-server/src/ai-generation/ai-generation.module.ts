import { Global,Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { NodiaAiRuntimePolicyModule } from '../nodia-ai-runtime/config/runtime-policy.module.js';
import { ApiNodiaAiCredentialsService } from '../nodia-ai-adapter/api-nodia-ai-credentials.service.js';
import { NodiaAiConnectionsService } from '../nodia-ai-conversation/nodia-ai-connections.service.js';
import { TEACHER_GENERATION_PORT } from '../teacher/types/teacher.types.js';
import { AiGenerationPort } from './ai-generation-port.js';
import { ApiTextGenerationService } from './api-text-generation.service.js';
import { GenerationWorkerSourceRegistry } from './worker-source-registry.js';
import { TeacherGenerationRuntimeService } from './teacher-generation-runtime.service.js';
import { CodexRuntimeModule } from '../common/ai/codex/codex-runtime.module.js';
import { NodiaAiAdapterTransport } from '../nodia-ai-adapter/nodia-ai-adapter.service.js';
import { TeacherAgenticTextService } from './teacher-agentic-text.service.js';
import { GeminiTeacherTextTransport } from './gemini-teacher-text-transport.js';
import { CodexTeacherTextTransport } from './codex-teacher-text-transport.js';
import { CODEX_TEACHER_TEXT_TRANSPORT } from './agentic-text-contract.js';
import { RouteTextGenerationService } from './route-text-generation.service.js';

@Global()
@Module({imports:[AuthorizationModule,NodiaAiRuntimePolicyModule,CodexRuntimeModule],providers:[
  ApiNodiaAiCredentialsService,NodiaAiConnectionsService,ApiTextGenerationService,
  NodiaAiAdapterTransport,GeminiTeacherTextTransport,CodexTeacherTextTransport,
  {provide:CODEX_TEACHER_TEXT_TRANSPORT,useExisting:CodexTeacherTextTransport},TeacherAgenticTextService,RouteTextGenerationService,
  {provide:AiGenerationPort,useExisting:RouteTextGenerationService},GenerationWorkerSourceRegistry,TeacherGenerationRuntimeService,
  {provide:TEACHER_GENERATION_PORT,useExisting:TeacherGenerationRuntimeService},
],exports:[TEACHER_GENERATION_PORT,AiGenerationPort,TeacherGenerationRuntimeService,GenerationWorkerSourceRegistry]})
export class AiGenerationModule {}
