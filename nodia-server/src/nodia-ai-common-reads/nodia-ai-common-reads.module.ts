import { Module, type DynamicModule } from '@nestjs/common';
import { NodiaAiProposalModule } from '../nodia-ai-proposal/nodia-ai-proposal.module.js';
import { NodiaAiConfirmationModule } from '../nodia-ai-confirmation/nodia-ai-confirmation.module.js';
import { NodiaAiAttachmentModule } from '../nodia-ai-attachment/nodia-ai-attachment.module.js';
import { NodiaAiPreferenceModule } from '../nodia-ai-preference/nodia-ai-preference.module.js';
import { BuildNodiaAiCommonReadToolsUseCase } from './use-case/build-nodia-ai-common-read-tools.use-case.js';
import { NODIA_AI_COMMON_READ_TOOLS } from './types/common-read-tools.types.js';
import { ComposeNodiaAiReadFamiliesUseCase } from '../nodia-ai-products/use-case/compose-nodia-ai-read-families.use-case.js';
export const NODIA_AI_CANDIDATE_COMMON_READ_FAMILIES = Symbol(
  'NODIA_AI_CANDIDATE_COMMON_READ_FAMILIES',
);
@Module({})
export class NodiaAiCommonReadsModule {
  static forPublication(ids: readonly string[]): DynamicModule {
    if (!ids.length)
      return {
        module: NodiaAiCommonReadsModule,
        providers: [
          { provide: NODIA_AI_CANDIDATE_COMMON_READ_FAMILIES, useValue: [] },
        ],
        exports: [NODIA_AI_CANDIDATE_COMMON_READ_FAMILIES],
      };
    if (
      new Set(ids).size !== ids.length ||
      ids.some(
        (id) => !(NODIA_AI_COMMON_READ_TOOLS as readonly string[]).includes(id),
      )
    )
      throw new Error('nodia_ai:knowledge_release_invalid');
    return {
      module: NodiaAiCommonReadsModule,
      imports: [
        NodiaAiProposalModule,
        NodiaAiConfirmationModule,
        NodiaAiAttachmentModule,
        NodiaAiPreferenceModule,
      ],
      providers: [
        BuildNodiaAiCommonReadToolsUseCase,
        ComposeNodiaAiReadFamiliesUseCase,
        {
          provide: NODIA_AI_CANDIDATE_COMMON_READ_FAMILIES,
          inject: [
            BuildNodiaAiCommonReadToolsUseCase,
            ComposeNodiaAiReadFamiliesUseCase,
          ],
          useFactory: (
            builder: BuildNodiaAiCommonReadToolsUseCase,
            compose: ComposeNodiaAiReadFamiliesUseCase,
          ) => compose.execute(builder.execute(), ids),
        },
      ],
      exports: [NODIA_AI_CANDIDATE_COMMON_READ_FAMILIES],
    };
  }
}
