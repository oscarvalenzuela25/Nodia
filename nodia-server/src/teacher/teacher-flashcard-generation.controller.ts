import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthRequest } from '../auth/types/auth.types.js';
import { actorReference } from '../authorization/authority-transaction.js';
import { GenerateFlashcardTextDto } from './dto/teacher-flashcard-generation.dto.js';
import { TeacherFlashcardGenerationUseCase } from './use-case/teacher-flashcard-generation.use-case.js';

@ApiTags('Teacher')
@Controller('teacher/flashcards/generations')
export class TeacherFlashcardGenerationController {
  constructor(
    private readonly generations: TeacherFlashcardGenerationUseCase,
  ) {}

  @Post()
  @HttpCode(202)
  @Header('Cache-Control', 'no-store')
  generate(
    @Req() request: AuthRequest,
    @Body() body: GenerateFlashcardTextDto,
  ) {
    return this.generations.generate(actorReference(request.auth), body);
  }

  @Get('requests/:key')
  @Header('Cache-Control', 'no-store')
  statusByRequest(
    @Req() request: AuthRequest,
    @Param('key', ParseUUIDPipe) key: string,
  ) {
    return this.generations.statusByRequest(actorReference(request.auth), key);
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  status(@Req() request: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.generations.status(actorReference(request.auth), id);
  }
}
