import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NodiaAiContextSnapshot } from './entities/nodia-ai-context-snapshot.entity.js';
import { NodiaAiContextSnapshotService } from './nodia-ai-context-snapshot.service.js';
import { LoadNodiaAiContextHistoryUseCase } from './use-case/load-nodia-ai-context-history.use-case.js';

@Module({
  imports: [TypeOrmModule.forFeature([NodiaAiContextSnapshot])],
  providers: [NodiaAiContextSnapshotService, LoadNodiaAiContextHistoryUseCase],
  exports: [NodiaAiContextSnapshotService, LoadNodiaAiContextHistoryUseCase],
})
export class NodiaAiContextSnapshotModule {}
