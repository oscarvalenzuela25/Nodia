import { Module } from '@nestjs/common';
import { BuildNodiaAiHistoricalSalesReadersUseCase } from './use-case/build-nodia-ai-historical-sales-readers.use-case.js';

/** Read-only access to retired sales proposals; no active preparer or sale writer is registered. */
@Module({
  providers: [BuildNodiaAiHistoricalSalesReadersUseCase],
  exports: [BuildNodiaAiHistoricalSalesReadersUseCase],
})
export class NodiaAiSalesModule {}
