import { Injectable } from '@nestjs/common';
import { AiGenerationPort, type AiGenerationExecutionContext } from './ai-generation-port.js';
import { ApiTextGenerationService } from './api-text-generation.service.js';
import { TeacherAgenticTextService } from './teacher-agentic-text.service.js';

/** Mode is an explicit persisted choice; transport failure never selects another lane. */
@Injectable()
export class RouteTextGenerationService extends AiGenerationPort {
  constructor(private readonly api: ApiTextGenerationService, private readonly agentic: TeacherAgenticTextService) { super(); }
  measure(prompt: string) {
    const api = this.api.measure(prompt), native = this.agentic.measure(prompt);
    return { utf8Bytes: api.utf8Bytes, maximumUtf8Bytes: Math.min(api.maximumUtf8Bytes, native.maximumUtf8Bytes) };
  }
  execute(context: AiGenerationExecutionContext, signal: AbortSignal) {
    if (context.selection.mode === 'api_key') return this.api.execute(context, signal);
    if (context.selection.mode === 'agentic') return this.agentic.execute(context, signal);
    throw Error('teacher:adapter_unqualified');
  }
}
