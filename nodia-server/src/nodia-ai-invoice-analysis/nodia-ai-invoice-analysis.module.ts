import { NodiaAiAdapterModule } from '../nodia-ai-adapter/nodia-ai-adapter.module.js';
import { Module, type DynamicModule } from '@nestjs/common';
import { NodiaAiRuntimePolicyModule } from '../nodia-ai-runtime/config/runtime-policy.module.js';
import {
  NodiaAiInvoiceAnalysisContract,
  NODIA_AI_INVOICE_ANALYSIS_TOOL,
} from './types/invoice-analysis-contract.types.js';
import { HttpNodiaAiInvoiceAnalysisContract } from './adapters/http-nodia-ai-invoice-analysis-contract.js';
import { SnapshotNodiaAiInvoiceAnalysisUseCase } from './use-case/snapshot-nodia-ai-invoice-analysis.use-case.js';
import { BuildNodiaAiInvoiceAnalysisToolUseCase } from './use-case/build-nodia-ai-invoice-analysis-tool.use-case.js';
export const NODIA_AI_CANDIDATE_INVOICE_ANALYSIS_FAMILIES = Symbol(
  'NODIA_AI_CANDIDATE_INVOICE_ANALYSIS_FAMILIES',
);
@Module({})
export class NodiaAiInvoiceAnalysisModule {
  static forPublication(ids: readonly string[]): DynamicModule {
    if (!ids.length)
      return {
        module: NodiaAiInvoiceAnalysisModule,
        providers: [
          {
            provide: NODIA_AI_CANDIDATE_INVOICE_ANALYSIS_FAMILIES,
            useValue: [],
          },
        ],
        exports: [NODIA_AI_CANDIDATE_INVOICE_ANALYSIS_FAMILIES],
      };
    if (ids.length !== 1 || ids[0] !== NODIA_AI_INVOICE_ANALYSIS_TOOL)
      throw new Error('nodia_ai:knowledge_release_invalid');
    return {
      module: NodiaAiInvoiceAnalysisModule,
      imports: [NodiaAiRuntimePolicyModule, NodiaAiAdapterModule],
      providers: [
        {
          provide: NodiaAiInvoiceAnalysisContract,
          useClass: HttpNodiaAiInvoiceAnalysisContract,
        },
        SnapshotNodiaAiInvoiceAnalysisUseCase,
        BuildNodiaAiInvoiceAnalysisToolUseCase,
        {
          provide: NODIA_AI_CANDIDATE_INVOICE_ANALYSIS_FAMILIES,
          inject: [BuildNodiaAiInvoiceAnalysisToolUseCase],
          useFactory: (builder: BuildNodiaAiInvoiceAnalysisToolUseCase) =>
            builder.execute(),
        },
      ],
      exports: [NODIA_AI_CANDIDATE_INVOICE_ANALYSIS_FAMILIES],
    };
  }
}
