import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NodiaAiAuthorizationModule } from '../nodia-ai/nodia-ai-authorization.module.js';
import { NodiaAiRuntimePolicyModule } from '../nodia-ai-runtime/config/runtime-policy.module.js';
import { RentalTransactionService } from '../rental-common/rental-transaction.service.js';
import { RentalClock } from '../rental-common/rental-clock.js';
import { RentalProperty } from '../rental-property/entities/rental-property.entity.js';
import { RentalCollaborator } from '../rental-collaborator/entities/rental-collaborator.entity.js';
import { User } from '../user/entities/user.entity.js';
import { CompileNodiaAiReportUseCase } from './use-case/compile-nodia-ai-report.use-case.js';
import { NodiaAiReportRegistryUseCase } from './use-case/nodia-ai-report-registry.use-case.js';
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
