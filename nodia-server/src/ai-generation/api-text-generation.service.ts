import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ApiNodiaAiCredentialsService } from '../nodia-ai-adapter/api-nodia-ai-credentials.service.js';
import { executeApiChat } from '../nodia-ai-adapter/api-nodia-ai-chat-transport.js';
import { NODIA_AI_RUNTIME_POLICY,type NodiaAiRuntimePolicy } from '../nodia-ai-runtime/config/runtime-policy.js';
import { AiGenerationPort,type AiGenerationExecutionContext } from './ai-generation-port.js';

/** Restricted text lane: no native runtime, tools, attachments, callbacks or continuations. */
@Injectable()
export class ApiTextGenerationService extends AiGenerationPort {
  constructor(private readonly credentials:ApiNodiaAiCredentialsService,
    @Inject(NODIA_AI_RUNTIME_POLICY) private readonly policy:NodiaAiRuntimePolicy){super();}
  measure(prompt:string){return {utf8Bytes:Buffer.byteLength(prompt,'utf8'),maximumUtf8Bytes:Math.min(131072,this.policy.results.assembled_context_utf8_bytes)};}
  async execute(context:AiGenerationExecutionContext,signal:AbortSignal){
    const measured=this.measure(context.prompt);
    if(!context.prompt.trim()||measured.utf8Bytes>measured.maximumUtf8Bytes||context.selection.mode!=='api_key') throw Error('teacher:adapter_unqualified');
    const config=await this.credentials.configuration(context.selection);
    if(config.configurationGeneration!==context.configurationGeneration||config.sessionGeneration!==context.sessionGeneration||config.resourceKey!==context.resourceKey) throw Error('teacher:configuration_changed');
    const secret=await this.credentials.secret(context.selection,config);
    const boundedPolicy={...this.policy,budget:{...this.policy.budget,provider_dispatches_per_run:1},results:{...this.policy.results,assistant_text_utf8_bytes:32768,json_depth:12,json_collection_items:128}};
    const text=await executeApiChat({provider:config.providerKey,secret,policy:boundedPolicy,signal,
      beforeExchange:()=>context.beforeExchange(),request:{attemptId:context.operationId,selection:context.selection,
        canonicalPrompt:context.prompt,deadlineAt:context.deadlineAt,resourceKey:context.resourceKey,
        configurationGeneration:context.configurationGeneration,sessionGeneration:context.sessionGeneration,
        tools:[],attachments:[],onLeaseCheck:()=>context.checkLease(),onProtocolProgress:async(_n,_s,requests)=>{if(requests)throw Error('teacher:tools_forbidden');}}});
    return {text,responseHash:createHash('sha256').update(text).digest('hex'),localClosed:true as const,remoteOutcome:'completed' as const};
  }
}
