import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NodiaAiRun } from './entities/nodia-ai-run.entity.js';
import { NodiaAiToolCall } from './entities/nodia-ai-tool-call.entity.js';
import { NodiaAiEvent } from './entities/nodia-ai-event.entity.js';
import { NodiaAiRunService } from './nodia-ai-run.service.js';
@Module({
  imports: [
    TypeOrmModule.forFeature([NodiaAiRun, NodiaAiToolCall, NodiaAiEvent]),
  ],
  providers: [NodiaAiRunService],
  exports: [NodiaAiRunService],
})
export class NodiaAiRunModule {}
