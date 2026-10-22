import { Module, type DynamicModule } from '@nestjs/common';
import { NodiaAiProposalModule } from '../nodia-ai-proposal/nodia-ai-proposal.module.js';
import { NodiaAiRuntimePolicyModule } from '../nodia-ai-runtime/config/runtime-policy.module.js';
import type { NodiaAiToolFamily } from '../nodia-ai-tools/types/tool-registry.types.js';
import { ComposeNodiaAiReadFamiliesUseCase } from '../nodia-ai-products/use-case/compose-nodia-ai-read-families.use-case.js';
import { BuildNodiaAiWriteToolsUseCase } from './use-case/build-nodia-ai-write-tools.use-case.js';
import {
  loadNodiaAiSecureContracts,
  loadNodiaAiWriteContracts,
} from './types/write-tool-contract.types.js';

export const NODIA_AI_CANDIDATE_WRITE_FAMILIES = Symbol(
  'NODIA_AI_CANDIDATE_WRITE_FAMILIES',
);

@Module({})
export class NodiaAiWriteToolsModule {
  /** Only an approved compiled manifest can select candidates; no writer is enabled by its registration. */
  static forPublication(ids: readonly string[]): DynamicModule {
    if (!ids.length)
      return {
        module: NodiaAiWriteToolsModule,
        providers: [
          { provide: NODIA_AI_CANDIDATE_WRITE_FAMILIES, useValue: [] },
        ],
        exports: [NODIA_AI_CANDIDATE_WRITE_FAMILIES],
      };
    const published = new Set(ids),
      bundles = [
        ...loadNodiaAiWriteContracts(),
        ...loadNodiaAiSecureContracts(),
      ];
    const candidates = new Set(
      bundles.flatMap((bundle) => bundle.tools.map((tool) => tool.tool_name)),
    );
    if (published.size !== ids.length || ids.some((id) => !candidates.has(id)))
      throw new Error('nodia_ai:knowledge_release_invalid');
    return {
      module: NodiaAiWriteToolsModule,
      imports: [NodiaAiProposalModule, NodiaAiRuntimePolicyModule],
      providers: [
        BuildNodiaAiWriteToolsUseCase,
        {
          provide: NODIA_AI_CANDIDATE_WRITE_FAMILIES,
          inject: [BuildNodiaAiWriteToolsUseCase],
          useFactory: (
            builder: BuildNodiaAiWriteToolsUseCase,
          ): readonly NodiaAiToolFamily[] =>
            new ComposeNodiaAiReadFamiliesUseCase().execute(
              // Keep exact source bytes/hashes from the complete trusted candidate bundle.
              // Selection only removes exports; it must not rewrite a schema document.
              builder.execute(bundles),
              ids,
            ),
        },
      ],
      exports: [NODIA_AI_CANDIDATE_WRITE_FAMILIES],
    };
  }
}
