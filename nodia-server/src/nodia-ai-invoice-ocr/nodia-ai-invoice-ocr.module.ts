import { Module } from '@nestjs/common';
import { AiProviderModule } from '../ai-provider/ai-provider.module.js';
import { NodiaAiAdapterModule } from '../nodia-ai-adapter/nodia-ai-adapter.module.js';
import { NodiaAiAdapterTransport } from '../nodia-ai-adapter/nodia-ai-adapter.service.js';
import { NodiaAiAuthorizationModule } from '../nodia-ai/nodia-ai-authorization.module.js';
import { NodiaAiAttachmentModule } from '../nodia-ai-attachment/nodia-ai-attachment.module.js';
import { NodiaAiRuntimeModule } from '../nodia-ai-runtime/nodia-ai-runtime.module.js';
import { ProductsInvoiceOcrAdapter } from './adapters/products-invoice-ocr.adapter.js';
import { NodiaAiInvoiceOcrPort } from './types/invoice-ocr-port.js';
import { SnapshotNodiaAiInvoiceOcrUseCase } from './use-case/snapshot-nodia-ai-invoice-ocr.use-case.js';
import { BuildNodiaAiInvoiceOcrToolUseCase } from './use-case/build-nodia-ai-invoice-ocr-tool.use-case.js';
import { ProcessNodiaAiInvoiceOcrStageUseCase } from './use-case/process-nodia-ai-invoice-ocr-stage.use-case.js';
import { ApiInvoiceOcrExecutor } from './adapters/api-invoice-ocr-executor.js';

/** Candidate only. Publishing the new family remains an explicit catalog operation. */
@Module({
  imports: [AiProviderModule, NodiaAiAdapterModule, NodiaAiAuthorizationModule, NodiaAiAttachmentModule, NodiaAiRuntimeModule],
  providers: [NodiaAiAdapterTransport, ApiInvoiceOcrExecutor, { provide: NodiaAiInvoiceOcrPort, useClass: ProductsInvoiceOcrAdapter },
    SnapshotNodiaAiInvoiceOcrUseCase, BuildNodiaAiInvoiceOcrToolUseCase, ProcessNodiaAiInvoiceOcrStageUseCase],
  exports: [BuildNodiaAiInvoiceOcrToolUseCase, ProcessNodiaAiInvoiceOcrStageUseCase],
})
export class NodiaAiInvoiceOcrModule {}
