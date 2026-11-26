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
  Query,
  Req,
  Res,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiGoneResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import type { AuthRequest } from '../auth/types/auth.types.js';
import { actorReference } from '../authorization/authority-transaction.js';
import {
  ListNodiaCvVersionsDto,
  NodiaCvPreparedPdfDto,
  NodiaCvVersionDetailDto,
  NodiaCvVersionPageDto,
  PrepareNodiaCvPdfDto,
  SaveNodiaCvVersionDto,
} from './dto/nodia-cv-pdf-version.dto.js';
import { NodiaCvPdfVersionsUseCase } from './use-case/nodia-cv-pdf-versions.use-case.js';

const uuid = new ParseUUIDPipe({ version: '4' });
const privateResponse = 'private, no-store';
const binarySchema = { type: 'string', format: 'binary' };

function servePdf(
  response: Response,
  pdf: { bytes: Buffer; sha256: string; filename: string },
) {
  response.setHeader('X-Content-SHA256', pdf.sha256);
  response.setHeader('X-Content-Type-Options', 'nosniff');
  return new StreamableFile(pdf.bytes, {
    type: 'application/pdf',
    disposition: `attachment; filename="${pdf.filename}"`,
    length: pdf.bytes.length,
  });
}

@ApiTags('Nodia CV')
@Controller('nodia-cv')
export class NodiaCvPdfVersionsController {
  constructor(private readonly pdfVersions: NodiaCvPdfVersionsUseCase) {}

  @Post('drafts/:id/pdf')
  @HttpCode(200)
  @Header('Cache-Control', privateResponse)
  @ApiOkResponse({ type: NodiaCvPreparedPdfDto })
  @ApiConflictResponse({
    description: 'Draft revision changed or is not ready.',
  })
  @ApiGoneResponse({ description: 'Draft has expired.' })
  prepare(
    @Req() request: AuthRequest,
    @Param('id', uuid) id: string,
    @Body() input: PrepareNodiaCvPdfDto,
  ) {
    return this.pdfVersions.prepare(actorReference(request.auth), id, input);
  }

  @Get('drafts/:id/pdf/:artifactId')
  @Header('Cache-Control', privateResponse)
  @ApiProduces('application/pdf')
  @ApiOkResponse({
    schema: binarySchema,
    description: 'Private bytes used for the draft diagnostics.',
  })
  @ApiNotFoundResponse()
  @ApiGoneResponse({ description: 'Draft has expired.' })
  async draftPdf(
    @Req() request: AuthRequest,
    @Res({ passthrough: true }) response: Response,
    @Param('id', uuid) id: string,
    @Param('artifactId', uuid) artifactId: string,
  ) {
    return servePdf(
      response,
      await this.pdfVersions.draftPdf(
        actorReference(request.auth),
        id,
        artifactId,
      ),
    );
  }

  @Get('versions')
  @Header('Cache-Control', privateResponse)
  @ApiOkResponse({ type: NodiaCvVersionPageDto })
  list(@Req() request: AuthRequest, @Query() query: ListNodiaCvVersionsDto) {
    return this.pdfVersions.list(actorReference(request.auth), query);
  }

  @Get('versions/:id')
  @Header('Cache-Control', privateResponse)
  @ApiOkResponse({ type: NodiaCvVersionDetailDto })
  @ApiNotFoundResponse()
  detail(@Req() request: AuthRequest, @Param('id', uuid) id: string) {
    return this.pdfVersions.detail(actorReference(request.auth), id);
  }

  @Get('versions/:id/pdf')
  @Header('Cache-Control', privateResponse)
  @ApiProduces('application/pdf')
  @ApiOkResponse({
    schema: binarySchema,
    description: 'Private bytes of the saved version.',
  })
  @ApiNotFoundResponse()
  async versionPdf(
    @Req() request: AuthRequest,
    @Res({ passthrough: true }) response: Response,
    @Param('id', uuid) id: string,
  ) {
    return servePdf(
      response,
      await this.pdfVersions.versionPdf(actorReference(request.auth), id),
    );
  }

  @Post('versions')
  @Header('Cache-Control', privateResponse)
  @ApiCreatedResponse({ type: NodiaCvVersionDetailDto })
  @ApiConflictResponse({
    description:
      'Draft revision or digest changed, or the request key belongs to a different save.',
  })
  @ApiGoneResponse({ description: 'Draft has expired.' })
  save(@Req() request: AuthRequest, @Body() input: SaveNodiaCvVersionDto) {
    return this.pdfVersions.save(actorReference(request.auth), input);
  }

  @Delete('versions/:id')
  @HttpCode(204)
  @Header('Cache-Control', privateResponse)
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  remove(@Req() request: AuthRequest, @Param('id', uuid) id: string) {
    return this.pdfVersions.remove(actorReference(request.auth), id);
  }
}
