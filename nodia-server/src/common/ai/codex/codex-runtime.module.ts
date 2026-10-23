import { Module } from '@nestjs/common';
import { CodexRuntimeService } from './codex-runtime.service.js';
import { CodexChatRuntime } from './codex-chat-runtime.js';

/** One native profile supervisor shared by HTTP and background readers. */
@Module({
  providers: [CodexRuntimeService, CodexChatRuntime],
  exports: [CodexRuntimeService, CodexChatRuntime],
})
export class CodexRuntimeModule {}
