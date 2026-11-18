import {
  BadRequestException,
  Controller,
  Get,
  Header,
  HttpStatus,
  PayloadTooLargeException,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  Res,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CreateInvoiceDto } from './dto/create-invoice.dto.js';
import { UpdateInvoiceDto } from './dto/update-invoice.dto.js';
import { GetInvoicesDto } from './dto/get-invoices.dto.js';
import { AnalyzeInvoiceDto } from './dto/analyze-invoice.dto.js';
import { VerifyIaProvidersQueryDto } from './dto/verify-ia-providers-query.dto.js';
import { GetInvoiceSelectableModelsQueryDto } from './dto/get-invoice-selectable-models-query.dto.js';
import { GetAllInvoicesUseCase } from './use-case/get-all-invoices.use-case.js';
import { GetInvoiceByIdUseCase } from './use-case/get-invoice-by-id.use-case.js';
import { GetInvoiceViewUrlUseCase } from './use-case/get-invoice-view-url.use-case.js';
import { CreateInvoiceUseCase } from './use-case/create-invoice.use-case.js';
import { UpdateInvoiceUseCase } from './use-case/update-invoice.use-case.js';
import { AnalyzeInvoiceUseCase } from './use-case/analyze-invoice.use-case.js';
import { VerifyIaProvidersUseCase } from './use-case/verify-ia-providers.use-case.js';
import {
  GetInvoiceSelectableModelsUseCase,
  type InvoiceSelectableModelsResult,
} from './use-case/get-invoice-selectable-models.use-case.js';
import type { Response } from 'express';
import { AnalysisObservationsUseCase } from './use-case/analysis-observations.use-case.js';
import { ReserveAnalysisObservationDto } from './dto/reserve-analysis-observation.dto.js';
import {
  AnalysisObservationInterceptor,
  type ObservedAnalysisRequest,
} from './analysis-observation.interceptor.js';
import type { AuthRequest } from '../auth/types/auth.types.js';
import { actorReference } from '../authorization/authority-transaction.js';
import {
  hasIdentifiedInvoiceFields,
  parseLegacyInvoiceBody,
} from './dto/cash-invoice-command.js';
import { SaveCashInvoiceUseCase } from './use-case/save-cash-invoice.use-case.js';
import { InvoiceOcrConfirmationInterceptor } from './invoice-ocr-confirmation.interceptor.js';
import { MAX_INVOICE_FILE_BYTES } from './invoice-file-validation.js';

@Controller(['invoice', 'invoices'])
export class InvoiceController {
  constructor(
    private readonly getAllInvoicesUseCase: GetAllInvoicesUseCase,
    private readonly getInvoiceByIdUseCase: GetInvoiceByIdUseCase,
    private readonly getInvoiceViewUrlUseCase: GetInvoiceViewUrlUseCase,
    private readonly createInvoiceUseCase: CreateInvoiceUseCase,
    private readonly updateInvoiceUseCase: UpdateInvoiceUseCase,
    private readonly analyzeInvoiceUseCase: AnalyzeInvoiceUseCase,
    private readonly verifyIaProvidersUseCase: VerifyIaProvidersUseCase,
    private readonly getInvoiceSelectableModelsUseCase: GetInvoiceSelectableModelsUseCase,
    private readonly observations: AnalysisObservationsUseCase,
    private readonly saveCashInvoice: SaveCashInvoiceUseCase,
  ) {}

  @Get()
  findAll(@Query() queryParams: GetInvoicesDto, @Req() request: AuthRequest) {
    return this.getAllInvoicesUseCase.executeNative(
      queryParams,
      actorReference(request.auth),
    );
  }

  @Get(['verify-ia-providers', 'verify-ia-provider'])
  verifyIaProviders(@Query() query: VerifyIaProvidersQueryDto) {
    return this.verifyIaProvidersUseCase.execute(undefined, query.mode);
  }

  @Get('selectable-models')
  @Header('Cache-Control', 'no-store')
  getSelectableModels(
    @Query() query: GetInvoiceSelectableModelsQueryDto,
  ): Promise<InvoiceSelectableModelsResult[]> {
    return this.getInvoiceSelectableModelsUseCase.execute(query);
  }

  @Get(':id/view-url')
  getViewUrl(@Param('id') id: string, @Req() request: AuthRequest) {
    return this.getInvoiceViewUrlUseCase.execute(
      id,
      actorReference(request.auth),
    );
  }

  @Post('analysis-observations')
  reserveObservation(
    @Req() request: ObservedAnalysisRequest,
    @Body() dto: ReserveAnalysisObservationDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return this.observations.reserve(request.auth.user.id, dto);
  }

  @Get('analysis-observations/:id')
  readObservation(
    @Req() request: ObservedAnalysisRequest,
    @Param('id') id: string,
    @Query('after') after: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return this.observations.read(
      request.auth.user.id,
      id,
      after === undefined ? 0 : Number(after),
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() request: AuthRequest) {
    return this.getInvoiceByIdUseCase.executeNative(
      id,
      actorReference(request.auth),
    );
  }

  @Post('analyze')
  @UseInterceptors(
    AnalysisObservationInterceptor,
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 15 },
    }),
  )
  analyze(
    @UploadedFile() file: Express.Multer.File,
    @Body() analyzeInvoiceDto: AnalyzeInvoiceDto,
    @Res({ passthrough: true }) response: Response,
    @Req() request: ObservedAnalysisRequest,
    @Query() queryParams?: Partial<AnalyzeInvoiceDto>,
  ) {
    const mergedDto: AnalyzeInvoiceDto = {
      ...queryParams,
      ...analyzeInvoiceDto,
    };
    return this.analyzeInvoiceUseCase.execute(
      file,
      mergedDto,
      request.analysisSignal,
      request.analysisProgress,
      actorReference(request.auth),
    );
  }

  @Post('ocr-confirmations')
  @Header('Cache-Control', 'no-store')
  @UseInterceptors(InvoiceOcrConfirmationInterceptor)
  async confirmOcr(
    @Body() body: unknown,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: AuthRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (
      !request.is('multipart/form-data') ||
      !file ||
      !body ||
      typeof body !== 'object' ||
      Object.keys(body).length !== 1 ||
      !Object.hasOwn(body, 'command')
    )
      throw new BadRequestException('business:cash_invalid_command');
    if (file.size > MAX_INVOICE_FILE_BYTES)
      throw new PayloadTooLargeException('business:cash_invalid_command');
    const result = await this.saveCashInvoice.confirmOcr(
      (body as { command: unknown }).command,
      file,
      actorReference(request.auth),
    );
    if (result.status === 'processing') response.status(HttpStatus.ACCEPTED);
    return result;
  }

  @Post()
  @Header('Cache-Control', 'no-store')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 12 },
    }),
  )
  async create(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: unknown,
    @Req() request: AuthRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const actor = actorReference(request.auth);
    if (hasIdentifiedInvoiceFields(body)) {
      const result = await this.saveCashInvoice.create(
        body,
        !!request.is('multipart/form-data'),
        file,
        actor,
      );
      if (result.status === 'processing') response.status(HttpStatus.ACCEPTED);
      return result;
    }
    const { version: _version, ...invoice } =
      await this.createInvoiceUseCase.execute(
        await parseLegacyInvoiceBody(body, CreateInvoiceDto),
        file,
        undefined,
        actor,
      );
    return invoice;
  }

  @Put(':id')
  @Header('Cache-Control', 'no-store')
  async update(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: AuthRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const actor = actorReference(request.auth);
    if (hasIdentifiedInvoiceFields(body)) {
      const result = await this.saveCashInvoice.update(id, body, actor);
      if (result.status === 'processing') response.status(HttpStatus.ACCEPTED);
      return result;
    }
    const { version: _version, ...invoice } =
      await this.updateInvoiceUseCase.execute(
        id,
        await parseLegacyInvoiceBody(body, UpdateInvoiceDto),
        undefined,
        actor,
      );
    return invoice;
  }
}
