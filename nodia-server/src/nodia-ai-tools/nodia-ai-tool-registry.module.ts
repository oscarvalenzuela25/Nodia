import { Module } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { NodiaAiToolRegistryUseCase } from './use-case/nodia-ai-tool-registry.use-case.js';
import {
  NODIA_AI_CAPABILITIES_CATALOG_VERSION,
  NODIA_AI_TOOL_FAMILIES,
  type NodiaAiToolFamily,
} from './types/tool-registry.types.js';
import { NODIA_AI_TOOL_COMMON_SCHEMA } from './use-case/discover-nodia-ai-tools.use-case.js';
import { parseNodiaAiStrictJson } from '../nodia-ai-context/strict-json.js';
import {
  NodiaAiProductReadsModule,
  NODIA_AI_CANDIDATE_READ_FAMILIES,
  compiledNodiaAiCapabilityIds,
} from '../nodia-ai-products/nodia-ai-product-reads.module.js';
import {
  NodiaAiWriteToolsModule,
  NODIA_AI_CANDIDATE_WRITE_FAMILIES,
} from '../nodia-ai-write-tools/nodia-ai-write-tools.module.js';
import {
  loadNodiaAiSecureContracts,
  loadNodiaAiWriteContracts,
} from '../nodia-ai-write-tools/types/write-tool-contract.types.js';
import {
  NodiaAiInvoiceAnalysisModule,
  NODIA_AI_CANDIDATE_INVOICE_ANALYSIS_FAMILIES,
} from '../nodia-ai-invoice-analysis/nodia-ai-invoice-analysis.module.js';
import { NODIA_AI_INVOICE_ANALYSIS_TOOL } from '../nodia-ai-invoice-analysis/types/invoice-analysis-contract.types.js';
import { ComposeNodiaAiPublishedFamiliesUseCase } from './use-case/compose-nodia-ai-published-families.use-case.js';
import {
  NodiaAiCommonReadsModule,
  NODIA_AI_CANDIDATE_COMMON_READ_FAMILIES,
} from '../nodia-ai-common-reads/nodia-ai-common-reads.module.js';
import { NODIA_AI_COMMON_READ_TOOLS } from '../nodia-ai-common-reads/types/common-read-tools.types.js';
import {
  NodiaAiCommonPreparationModule,
  NODIA_AI_CANDIDATE_COMMON_PREPARATION_FAMILIES,
} from '../nodia-ai-common-preparation/nodia-ai-common-preparation.module.js';
import { NODIA_AI_COMMON_PREPARATION_TOOL_NAMES } from '../nodia-ai-common-preparation/types/common-preparation-contract.types.js';

const publishedIds = compiledNodiaAiCapabilityIds();
const writeCandidates = new Set(
  [...loadNodiaAiWriteContracts(), ...loadNodiaAiSecureContracts()].flatMap(
    (bundle) => bundle.tools.map((tool) => tool.tool_name),
  ),
);
const writeIds = publishedIds.filter((id) => writeCandidates.has(id));
const analysisIds = publishedIds.filter(
  (id) => id === NODIA_AI_INVOICE_ANALYSIS_TOOL,
);
const commonReads = new Set<string>(NODIA_AI_COMMON_READ_TOOLS);
const commonPreparations = new Set<string>(
  NODIA_AI_COMMON_PREPARATION_TOOL_NAMES,
);
const commonReadIds = publishedIds.filter((id) => commonReads.has(id));
const commonPreparationIds = publishedIds.filter((id) =>
  commonPreparations.has(id),
);
const readIds = publishedIds.filter(
  (id) =>
    !writeCandidates.has(id) &&
    id !== NODIA_AI_INVOICE_ANALYSIS_TOOL &&
    !commonReads.has(id) &&
    !commonPreparations.has(id),
);

@Module({
  imports: [
    NodiaAiProductReadsModule.forPublication(readIds),
    NodiaAiWriteToolsModule.forPublication(writeIds),
    NodiaAiInvoiceAnalysisModule.forPublication(analysisIds),
    NodiaAiCommonReadsModule.forPublication(commonReadIds),
    NodiaAiCommonPreparationModule.forPublication(commonPreparationIds),
  ],
  providers: [
    {
      provide: NODIA_AI_TOOL_FAMILIES,
      inject: [
        NODIA_AI_CANDIDATE_READ_FAMILIES,
        NODIA_AI_CANDIDATE_WRITE_FAMILIES,
        NODIA_AI_CANDIDATE_INVOICE_ANALYSIS_FAMILIES,
        NODIA_AI_CANDIDATE_COMMON_READ_FAMILIES,
        NODIA_AI_CANDIDATE_COMMON_PREPARATION_FAMILIES,
        ComposeNodiaAiPublishedFamiliesUseCase,
      ],
      useFactory: (
        reads: readonly NodiaAiToolFamily[],
        writes: readonly NodiaAiToolFamily[],
        analyses: readonly NodiaAiToolFamily[],
        commonReadFamilies: readonly NodiaAiToolFamily[],
        commonPreparationFamilies: readonly NodiaAiToolFamily[],
        compose: ComposeNodiaAiPublishedFamiliesUseCase,
      ) =>
        compose.execute(reads, [
          ...writes,
          ...analyses,
          ...commonReadFamilies,
          ...commonPreparationFamilies,
        ]),
    },
    {
      provide: NODIA_AI_CAPABILITIES_CATALOG_VERSION,
      useFactory: () => {
        const pin = parseNodiaAiStrictJson(
          readFileSync(
            new URL(
              '../nodia-ai-context/config/knowledge-pin.json',
              import.meta.url,
            ),
            'utf8',
          ),
        );
        if (
          !pin ||
          typeof pin !== 'object' ||
          Array.isArray(pin) ||
          !('catalog_release' in pin) ||
          typeof pin.catalog_release !== 'string'
        )
          throw new Error('nodia_ai:knowledge_release_invalid');
        return pin.catalog_release;
      },
    },
    {
      provide: NODIA_AI_TOOL_COMMON_SCHEMA,
      useFactory: () =>
        readFileSync(
          new URL('./config/common-schema.json', import.meta.url),
          'utf8',
        ),
    },
    ComposeNodiaAiPublishedFamiliesUseCase,
    NodiaAiToolRegistryUseCase,
  ],
  exports: [NodiaAiToolRegistryUseCase, NODIA_AI_TOOL_COMMON_SCHEMA],
})
export class NodiaAiToolRegistryModule {}
