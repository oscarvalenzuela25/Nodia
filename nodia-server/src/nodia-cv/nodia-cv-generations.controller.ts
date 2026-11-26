import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiConflictResponse,
  ApiGoneResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';
import { actorReference } from '../authorization/authority-transaction.js';
import type { AuthRequest } from '../auth/types/auth.types.js';
import {
  StartNodiaCvAiEditDto,
  UpdateNodiaCvDraftDto,
} from './dto/nodia-cv-draft.dto.js';
import {
  NodiaCvSelectionDto,
  StartNodiaCvGenerationDto,
} from './dto/nodia-cv-generation.dto.js';
import { NodiaCvGenerationsUseCase } from './use-case/nodia-cv-generations.use-case.js';

class NodiaCvCatalogQueryDto {
  @ApiPropertyOptional({
    type: String,
    description: 'Last connection ID from the previous page.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[1-9][0-9]{0,18}$/)
  after?: string;
}

const privateResponse = 'private, no-store';
const generationUuid = new ParseUUIDPipe({ version: '4' });

@ApiTags('Nodia CV')
@Controller('nodia-cv')
export class NodiaCvGenerationsController {
  constructor(private readonly generations: NodiaCvGenerationsUseCase) {}

  @Get('ai-selection/catalog')
  @Header('Cache-Control', privateResponse)
  @ApiOkResponse({ description: 'Sanitized connection and model catalog.' })
  catalog(@Req() request: AuthRequest, @Query() query: NodiaCvCatalogQueryDto) {
    return this.generations.catalog(actorReference(request.auth), query.after);
  }

  @Get('ai-selection/eligibility')
  @Header('Cache-Control', privateResponse)
  @ApiOkResponse({
    description: 'Eligibility of the exact selection for CV generation.',
  })
  eligibility(
    @Req() request: AuthRequest,
    @Query() selection: NodiaCvSelectionDto,
  ) {
    return this.generations.eligibility(
      actorReference(request.auth),
      selection,
    );
  }

  @Post('generations')
  @HttpCode(HttpStatus.ACCEPTED)
  @Header('Cache-Control', privateResponse)
  @ApiAcceptedResponse({
    description: 'An idempotent generation request was admitted.',
  })
  start(@Req() request: AuthRequest, @Body() body: StartNodiaCvGenerationDto) {
    return this.generations.start(actorReference(request.auth), body);
  }

  @Get('generations/requests/:key')
  @Header('Cache-Control', privateResponse)
  @ApiOkResponse({
    description:
      'Generation status and accepted input by the owner’s request key.',
  })
  @ApiNotFoundResponse()
  statusByRequest(
    @Req() request: AuthRequest,
    @Param('key', generationUuid) key: string,
  ) {
    return this.generations.statusByRequest(actorReference(request.auth), key);
  }

  @Post('drafts/:id/ai-edits')
  @HttpCode(HttpStatus.ACCEPTED)
  @Header('Cache-Control', privateResponse)
  @ApiAcceptedResponse({
    description:
      'An idempotent AI edit of the specified CV draft revision was admitted.',
  })
  @ApiConflictResponse({
    description: 'The draft revision or request key has changed.',
  })
  @ApiGoneResponse({ description: 'The draft has expired.' })
  @ApiNotFoundResponse()
  startEdit(
    @Req() request: AuthRequest,
    @Param('id', generationUuid) id: string,
    @Body() body: StartNodiaCvAiEditDto,
  ) {
    return this.generations.startEdit(actorReference(request.auth), id, body);
  }

  @Put('drafts/:id')
  @Header('Cache-Control', privateResponse)
  @ApiOkResponse({ description: 'The generation with its updated review.' })
  @ApiConflictResponse({
    description: 'The draft is not ready or the review revision has changed.',
  })
  @ApiGoneResponse({ description: 'The draft has expired.' })
  @ApiNotFoundResponse()
  updateDraft(
    @Req() request: AuthRequest,
    @Param('id', generationUuid) id: string,
    @Body() body: UpdateNodiaCvDraftDto,
  ) {
    return this.generations.updateDraft(actorReference(request.auth), id, body);
  }

  @Get('generations/:id')
  @Header('Cache-Control', privateResponse)
  @ApiOkResponse({
    description: 'Current generation status and available draft.',
  })
  @ApiNotFoundResponse()
  status(@Req() request: AuthRequest, @Param('id', generationUuid) id: string) {
    return this.generations.status(actorReference(request.auth), id);
  }
}
