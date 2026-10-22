import { NestFactory } from '@nestjs/core';
import { NodiaAiWorkerModule } from './nodia-ai-worker.module.js';
import { AssertNodiaAiOperationModeUseCase } from './nodia-ai-runtime/use-case/assert-nodia-ai-operation-mode.use-case.js';

// No listener, public endpoint, migrations or provider calls at startup.
new AssertNodiaAiOperationModeUseCase().execute(process.env);
const application =
  await NestFactory.createApplicationContext(NodiaAiWorkerModule);
application.enableShutdownHooks(['SIGINT', 'SIGTERM']);
