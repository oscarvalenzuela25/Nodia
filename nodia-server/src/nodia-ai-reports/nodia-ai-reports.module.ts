import { Module } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NodiaAiAuthorizationModule } from '../nodia-ai/nodia-ai-authorization.module.js';
import { NodiaAiRuntimePolicyModule } from '../nodia-ai-runtime/config/runtime-policy.module.js';
import { RentalTransactionService } from '../rental-common/rental-transaction.service.js';
import { RentalClock } from '../rental-common/rental-clock.js';
import { RentalProperty } from '../rental-property/entities/rental-property.entity.js';
import { RentalCollaborator } from '../rental-collaborator/entities/rental-collaborator.entity.js';
import { User } from '../user/entities/user.entity.js';
import { CompileNodiaAiReportUseCase } from './use-case/compile-nodia-ai-report.use-case.js';
import {
  NodiaAiReportRegistryUseCase,
  NODIA_AI_PUBLISHED_REPORT_DOCUMENTS,
} from './use-case/nodia-ai-report-registry.use-case.js';
import { DescribeNodiaAiReportsUseCase } from './use-case/describe-nodia-ai-reports.use-case.js';
import { RunNodiaAiReportUseCase } from './use-case/run-nodia-ai-report.use-case.js';

import { ComposeNodiaAiReportUseCase } from './use-case/compose-nodia-ai-report.use-case.js';

/** Internal report engine. AI-31 owns public result assembly and tool publication gates. */
@Module({
  imports: [
    NodiaAiAuthorizationModule,
    NodiaAiRuntimePolicyModule,
    TypeOrmModule.forFeature([RentalProperty, RentalCollaborator, User]),
  ],
  providers: [
    {
      provide: NODIA_AI_PUBLISHED_REPORT_DOCUMENTS,
      useFactory: () => {
        const manifest = JSON.parse(
          readFileSync(
            new URL('../nodia-ai/knowledge/manifest.json', import.meta.url),
            'utf8',
          ),
        ) as { documents?: { document_id?: unknown }[] };
        if (
          !Array.isArray(manifest.documents) ||
          manifest.documents.some(
            (item) => typeof item.document_id !== 'string',
          )
        )
          throw new Error('nodia_ai:knowledge_release_invalid');
        return Object.freeze(
          manifest.documents.map((item) => String(item.document_id)),
        );
      },
    },
    RentalClock,
    RentalTransactionService,
    CompileNodiaAiReportUseCase,
    NodiaAiReportRegistryUseCase,
    DescribeNodiaAiReportsUseCase,
    RunNodiaAiReportUseCase,
    ComposeNodiaAiReportUseCase,
  ],
  exports: [
    CompileNodiaAiReportUseCase,
    NodiaAiReportRegistryUseCase,
    DescribeNodiaAiReportsUseCase,
    RunNodiaAiReportUseCase,
    ComposeNodiaAiReportUseCase,
  ],
})
export class NodiaAiReportsModule {}
