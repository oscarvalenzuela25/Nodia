import { Module, type DynamicModule } from '@nestjs/common';
import { NodiaAiProposalModule } from '../nodia-ai-proposal/nodia-ai-proposal.module.js';
import { NodiaAiRuntimePolicyModule } from '../nodia-ai-runtime/config/runtime-policy.module.js';
import type { NodiaAiToolFamily } from '../nodia-ai-tools/types/tool-registry.types.js';
import { ComposeNodiaAiReadFamiliesUseCase } from '../nodia-ai-products/use-case/compose-nodia-ai-read-families.use-case.js';
import { BuildNodiaAiCommonPreparationToolsUseCase } from './use-case/build-nodia-ai-common-preparation-tools.use-case.js';
import { NODIA_AI_COMMON_PREPARATION_TOOL_NAMES } from './types/common-preparation-contract.types.js';
export const NODIA_AI_CANDIDATE_COMMON_PREPARATION_FAMILIES = Symbol(
  'NODIA_AI_CANDIDATE_COMMON_PREPARATION_FAMILIES',
);
@Module({})
export class NodiaAiCommonPreparationModule {
  static forPublication(ids: readonly string[]): DynamicModule {
    if (!ids.length)
      return {
        module: NodiaAiCommonPreparationModule,
        providers: [
          {
            provide: NODIA_AI_CANDIDATE_COMMON_PREPARATION_FAMILIES,
            useValue: [],
          },
        ],
        exports: [NODIA_AI_CANDIDATE_COMMON_PREPARATION_FAMILIES],
      };
    if (
      new Set(ids).size !== ids.length ||
      ids.some(
        (id) =>
          !NODIA_AI_COMMON_PREPARATION_TOOL_NAMES.some((name) => name === id),
      )
    )
      throw Error('nodia_ai:knowledge_release_invalid');
    return {
      module: NodiaAiCommonPreparationModule,
      imports: [NodiaAiProposalModule, NodiaAiRuntimePolicyModule],
      providers: [
        BuildNodiaAiCommonPreparationToolsUseCase,
        {
          provide: NODIA_AI_CANDIDATE_COMMON_PREPARATION_FAMILIES,
          inject: [BuildNodiaAiCommonPreparationToolsUseCase],
          useFactory: (
            builder: BuildNodiaAiCommonPreparationToolsUseCase,
          ): readonly NodiaAiToolFamily[] =>
            new ComposeNodiaAiReadFamiliesUseCase().execute(
              builder.execute(),
              ids,
            ),
        },
      ],
      exports: [NODIA_AI_CANDIDATE_COMMON_PREPARATION_FAMILIES],
    };
  }
}
