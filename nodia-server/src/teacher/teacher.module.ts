import { Inject, Injectable, Module, type OnModuleInit } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { AiGenerationModule } from '../ai-generation/ai-generation.module.js';
import { TeacherService } from './teacher.service.js';
import { TeacherController } from './teacher.controller.js';
import { TeacherLearningController } from './teacher-learning.controller.js';
import { TeacherEnrichmentController } from './teacher-enrichment.controller.js';
import { TeacherRequestsController } from './teacher-requests.controller.js';
import { TeacherCalendarController } from './teacher-calendar.controller.js';
import { TeacherCalendarStore } from './teacher-calendar.store.js';
import { TeacherCalendarUseCase } from './use-case/teacher-calendar.use-case.js';
import { TeacherFlashcardsController } from './teacher-flashcards.controller.js';
import { TeacherFlashcardGenerationController } from './teacher-flashcard-generation.controller.js';
import { TeacherFlashcardsStore } from './teacher-flashcards.store.js';
import { TeacherFlashcardsUseCase } from './use-case/teacher-flashcards.use-case.js';
import { TeacherFlashcardGenerationUseCase } from './use-case/teacher-flashcard-generation.use-case.js';
import { TeacherLearningUseCase } from './use-case/teacher-learning.use-case.js';
import { TeacherEnrichmentUseCase } from './use-case/teacher-enrichment.use-case.js';
import { TeacherReceiptStatusInterceptor } from './teacher-receipt-status.interceptor.js';
import { ExecuteTeacherCommandUseCase } from './use-case/execute-teacher-command.use-case.js';
import { ReadTeacherUseCase } from './use-case/read-teacher.use-case.js';
import { PublishTeacherUseCase } from './use-case/publish-teacher.use-case.js';
import {
  TEACHER_GENERATION_PORT,
  type TeacherGenerationPort,
} from './types/teacher.types.js';

@Injectable()
class TeacherPublisherRegistration implements OnModuleInit {
  constructor(
    @Inject(TEACHER_GENERATION_PORT)
    private readonly port: TeacherGenerationPort,
    private readonly publisher: PublishTeacherUseCase,
  ) {}
  onModuleInit() {
    this.port.setPublisher(this.publisher.publish.bind(this.publisher));
  }
}
@Module({
  imports: [AuthorizationModule, AiGenerationModule],
  controllers: [
    TeacherController,
    TeacherLearningController,
    TeacherEnrichmentController,
    TeacherRequestsController,
    TeacherCalendarController,
    TeacherFlashcardsController,
    TeacherFlashcardGenerationController,
  ],
  providers: [
    TeacherService,
    TeacherCalendarStore,
    TeacherCalendarUseCase,
    TeacherFlashcardsStore,
    TeacherFlashcardsUseCase,
    TeacherFlashcardGenerationUseCase,
    TeacherLearningUseCase,
    TeacherEnrichmentUseCase,
    ExecuteTeacherCommandUseCase,
    ReadTeacherUseCase,
    PublishTeacherUseCase,
    TeacherPublisherRegistration,
    TeacherReceiptStatusInterceptor,
  ],
  exports: [TeacherService, PublishTeacherUseCase],
})
export class TeacherModule {}
