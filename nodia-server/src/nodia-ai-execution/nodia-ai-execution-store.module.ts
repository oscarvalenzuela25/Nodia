import { Module } from '@nestjs/common';
import { NodiaAiExecutionService } from './nodia-ai-execution.service.js';

/** Shared persistence boundary; no worker, HTTP or provider dependencies. */
@Module({
  providers: [NodiaAiExecutionService],
  exports: [NodiaAiExecutionService],
})
export class NodiaAiExecutionStoreModule {}
