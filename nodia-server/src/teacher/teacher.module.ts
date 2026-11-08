import { Inject, Injectable, Module, type OnModuleInit } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { AiGenerationModule } from '../ai-generation/ai-generation.module.js';
import { TeacherService } from './teacher.service.js';
import { TeacherController } from './teacher.controller.js';
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
  controllers: [TeacherController],
  providers: [
    TeacherService,
    ExecuteTeacherCommandUseCase,
    ReadTeacherUseCase,
    PublishTeacherUseCase,
    TeacherPublisherRegistration,
    TeacherReceiptStatusInterceptor,
  ],
  exports: [TeacherService, PublishTeacherUseCase],
})
export class TeacherModule {}
