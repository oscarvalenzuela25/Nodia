import { Body, Controller, Header, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthRequest } from '../auth/types/auth.types.js';
import { actorReference } from '../authorization/authority-transaction.js';
import { ImportFlashcardSetDto } from './dto/teacher-flashcards.dto.js';
import { TeacherFlashcardSetImportUseCase } from './use-case/teacher-flashcard-set-import.use-case.js';

@ApiTags('Teacher')
@Controller('teacher/flashcards/imports/sets')
export class TeacherFlashcardSetImportController {
  constructor(private readonly importer: TeacherFlashcardSetImportUseCase) {}

  @Post()
  @Header('Cache-Control', 'no-store')
  importSet(@Req() request: AuthRequest, @Body() body: ImportFlashcardSetDto) {
    return this.importer.execute(actorReference(request.auth), body);
  }
}
