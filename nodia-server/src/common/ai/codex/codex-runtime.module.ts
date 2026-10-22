import { Module } from '@nestjs/common';
import { CodexRuntimeService } from './codex-runtime.service.js';

/** One native profile supervisor shared by HTTP and background readers. */
@Module({ providers: [CodexRuntimeService], exports: [CodexRuntimeService] })
export class CodexRuntimeModule {}
