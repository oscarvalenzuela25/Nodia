import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  StreamableFile,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthRequest } from '../auth/types/auth.types.js';
import { actorReference } from '../authorization/authority-transaction.js';
import {
  FlashcardLibraryEligibilityDto,
  GenerateFlashcardLibraryDto,
} from './dto/teacher-flashcard-library.dto.js';
import { TeacherFlashcardLibraryUseCase } from './use-case/teacher-flashcard-library.use-case.js';

@ApiTags('Teacher')
@Controller('teacher/flashcards/proposals')
export class TeacherFlashcardLibraryController {
  constructor(private readonly library: TeacherFlashcardLibraryUseCase) {}

  @Post()
  @HttpCode(202)
  @Header('Cache-Control', 'private, no-store')
  generate(
    @Req() request: AuthRequest,
    @Body() body: GenerateFlashcardLibraryDto,
  ) {
    return this.library.generate(actorReference(request.auth), body);
  }

  @Get('eligibility')
  @Header('Cache-Control', 'private, no-store')
  eligibility(
    @Req() request: AuthRequest,
    @Query() query: FlashcardLibraryEligibilityDto,
  ) {
    return this.library.eligibility(actorReference(request.auth), query);
  }

  @Get('requests/:key')
  @Header('Cache-Control', 'private, no-store')
  byRequest(
    @Req() request: AuthRequest,
    @Param('key', ParseUUIDPipe) key: string,
  ) {
    return this.library.byRequest(actorReference(request.auth), key);
  }

  @Get(':id/image')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async image(
    @Req() request: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const image = await this.library.image(actorReference(request.auth), id);
    return new StreamableFile(image.bytes, {
      type: image.mime,
      length: image.bytes.length,
    });
  }

  @Get(':id')
  @Header('Cache-Control', 'private, no-store')
  byId(@Req() request: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.library.byId(actorReference(request.auth), id);
  }
}
