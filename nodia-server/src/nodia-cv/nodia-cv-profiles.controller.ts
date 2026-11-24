import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import type { AuthRequest } from '../auth/types/auth.types.js';
import { actorReference } from '../authorization/authority-transaction.js';
import {
  CreateNodiaCvProfileDto,
  DeleteNodiaCvProfileQueryDto,
  NodiaCvProfileInputDto,
  NodiaCvProfileListQueryDto,
  UpdateNodiaCvProfileDto,
} from './dto/nodia-cv-profile.dto.js';
import { NodiaCvProfilesUseCase } from './use-case/nodia-cv-profiles.use-case.js';

class NodiaCvProfileSummaryDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: Number }) revision!: number;
  @ApiProperty({ type: Number }) schema_version!: number;
  @ApiProperty({ type: String, format: 'date-time' }) created_at!: string;
  @ApiProperty({ type: String, format: 'date-time' }) updated_at!: string;
  @ApiProperty({ type: String }) profile_name!: string;
  @ApiProperty({ type: String }) full_name!: string;
  @ApiPropertyOptional({ type: String }) professional_title?: string;
}

class NodiaCvProfilePageDto {
  @ApiProperty({ type: [NodiaCvProfileSummaryDto] })
  items!: NodiaCvProfileSummaryDto[];
  @ApiProperty({ type: Number }) total!: number;
  @ApiProperty({ type: Number }) page!: number;
  @ApiProperty({ type: Number }) page_size!: number;
}

const detailSchema = {
  allOf: [
    { $ref: getSchemaPath(NodiaCvProfileSummaryDto) },
    { $ref: getSchemaPath(NodiaCvProfileInputDto) },
    {
      type: 'object',
      required: [
        'contact',
        'main_stack',
        'experiences',
        'projects',
        'skill_areas',
        'education',
        'certifications',
        'languages',
        'additional_sections',
      ],
    },
  ],
};

const privateResponse = 'private, no-store';
const profileUuid = new ParseUUIDPipe({ version: '4' });

@ApiTags('Nodia CV')
@ApiExtraModels(NodiaCvProfileSummaryDto, NodiaCvProfileInputDto)
@Controller('nodia-cv')
export class NodiaCvProfilesController {
  constructor(private readonly profiles: NodiaCvProfilesUseCase) {}

  @Get('profiles')
  @Header('Cache-Control', privateResponse)
  @ApiOkResponse({ type: NodiaCvProfilePageDto })
  list(
    @Req() request: AuthRequest,
    @Query() query: NodiaCvProfileListQueryDto,
  ) {
    return this.profiles.list(actorReference(request.auth), query);
  }

  @Get('profiles/:id')
  @Header('Cache-Control', privateResponse)
  @ApiOkResponse({ schema: detailSchema })
  @ApiNotFoundResponse()
  detail(@Req() request: AuthRequest, @Param('id', profileUuid) id: string) {
    return this.profiles.detail(actorReference(request.auth), id);
  }

  @Post('profiles')
  @Header('Cache-Control', privateResponse)
  @ApiCreatedResponse({ schema: detailSchema })
  @ApiConflictResponse({
    description: 'The request key belongs to a different creation.',
  })
  create(@Req() request: AuthRequest, @Body() body: CreateNodiaCvProfileDto) {
    return this.profiles.create(actorReference(request.auth), body);
  }

  @Put('profiles/:id')
  @Header('Cache-Control', privateResponse)
  @ApiOkResponse({ schema: detailSchema })
  @ApiConflictResponse({ description: 'The expected revision is stale.' })
  @ApiNotFoundResponse()
  update(
    @Req() request: AuthRequest,
    @Param('id', profileUuid) id: string,
    @Body() body: UpdateNodiaCvProfileDto,
  ) {
    return this.profiles.update(actorReference(request.auth), id, body);
  }

  @Delete('profiles/:id')
  @HttpCode(204)
  @Header('Cache-Control', privateResponse)
  @ApiNoContentResponse()
  @ApiConflictResponse({
    description: 'The revision shown in the confirmation is stale.',
  })
  @ApiNotFoundResponse()
  delete(
    @Req() request: AuthRequest,
    @Param('id', profileUuid) id: string,
    @Query() query: DeleteNodiaCvProfileQueryDto,
  ) {
    return this.profiles.delete(
      actorReference(request.auth),
      id,
      query.revision,
    );
  }
}
