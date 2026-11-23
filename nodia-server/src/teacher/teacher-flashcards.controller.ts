import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  StreamableFile,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthRequest } from '../auth/types/auth.types.js';
import { actorReference } from '../authorization/authority-transaction.js';
import {
  CreateFlashcardDeckDto,
  CreateFlashcardDto,
  CreateFlashcardReviewDto,
  FlashcardCardsQueryDto,
  ImportFlashcardsDto,
  PatchFlashcardDto,
} from './dto/teacher-flashcards.dto.js';
import { TeacherFlashcardsUseCase } from './use-case/teacher-flashcards.use-case.js';

@ApiTags('Teacher')
@Controller('teacher/flashcards')
export class TeacherFlashcardsController {
  constructor(private readonly flashcards: TeacherFlashcardsUseCase) {}

  @Get('decks')
  @Header('Cache-Control', 'no-store')
  decks(@Req() request: AuthRequest) {
    return this.flashcards.decks(actorReference(request.auth));
  }

  @Post('decks')
  @Header('Cache-Control', 'no-store')
  createDeck(
    @Req() request: AuthRequest,
    @Body() body: CreateFlashcardDeckDto,
  ) {
    return this.flashcards.createDeck(actorReference(request.auth), body);
  }

  @Post('imports')
  @Header('Cache-Control', 'no-store')
  importCards(@Req() request: AuthRequest, @Body() body: ImportFlashcardsDto) {
    return this.flashcards.importCards(actorReference(request.auth), body);
  }

  @Get('cards')
  @Header('Cache-Control', 'no-store')
  cards(@Req() request: AuthRequest, @Query() query: FlashcardCardsQueryDto) {
    return this.flashcards.cards(
      actorReference(request.auth),
      query.deck_id,
      query.page,
    );
  }

  @Post('cards')
  @Header('Cache-Control', 'no-store')
  createCard(@Req() request: AuthRequest, @Body() body: CreateFlashcardDto) {
    return this.flashcards.createCard(actorReference(request.auth), body);
  }

  @Patch('cards/:id')
  @Header('Cache-Control', 'no-store')
  patchCard(
    @Req() request: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PatchFlashcardDto,
  ) {
    return this.flashcards.patchCard(actorReference(request.auth), id, body);
  }

  @Delete('cards/:id')
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  deleteCard(
    @Req() request: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.flashcards.deleteCard(actorReference(request.auth), id);
  }

  @Get('cards/:id/image')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async image(
    @Req() request: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const bytes = await this.flashcards.image(actorReference(request.auth), id);
    return new StreamableFile(bytes, {
      type: 'image/webp',
      length: bytes.length,
    });
  }

  @Post('cards/:id/reviews')
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  review(
    @Req() request: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateFlashcardReviewDto,
  ) {
    return this.flashcards.review(actorReference(request.auth), id, body);
  }
}
