import {
  Controller,
  Get,
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
import { GetAllInvoicesUseCase } from './use-case/get-all-invoices.use-case.js';
import { GetInvoiceByIdUseCase } from './use-case/get-invoice-by-id.use-case.js';
import { GetInvoiceViewUrlUseCase } from './use-case/get-invoice-view-url.use-case.js';
import { CreateInvoiceUseCase } from './use-case/create-invoice.use-case.js';
import { UpdateInvoiceUseCase } from './use-case/update-invoice.use-case.js';
import { AnalyzeInvoiceUseCase } from './use-case/analyze-invoice.use-case.js';
import { VerifyIaProvidersUseCase } from './use-case/verify-ia-providers.use-case.js';
import type { Response } from 'express';
import { AnalysisObservationsUseCase } from './use-case/analysis-observations.use-case.js';
import { ReserveAnalysisObservationDto } from './dto/reserve-analysis-observation.dto.js';
import {
  AnalysisObservationInterceptor,
  type ObservedAnalysisRequest,
} from './analysis-observation.interceptor.js';
import type { AuthRequest } from '../auth/types/auth.types.js';
import { actorReference } from '../authorization/authority-transaction.js';

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
    private readonly observations: AnalysisObservationsUseCase,
  ) {}

  @Get()
  findAll(@Query() queryParams: GetInvoicesDto, @Req() request: AuthRequest) {
    return this.getAllInvoicesUseCase.execute(
      queryParams,
      actorReference(request.auth),
    );
  }

  @Get(['verify-ia-providers', 'verify-ia-provider'])
  verifyIaProviders(@Query() query: VerifyIaProvidersQueryDto) {
    return this.verifyIaProvidersUseCase.execute(undefined, query.mode);
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
    return this.getInvoiceByIdUseCase.execute(id, actorReference(request.auth));
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

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 12 },
    }),
  )
  create(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() createInvoiceDto: CreateInvoiceDto,
    @Req() request: AuthRequest,
  ) {
    return this.createInvoiceUseCase.execute(
      createInvoiceDto,
      file,
      undefined,
      actorReference(request.auth),
    );
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updateInvoiceDto: UpdateInvoiceDto,
    @Req() request: AuthRequest,
  ) {
    return this.updateInvoiceUseCase.execute(
      id,
      updateInvoiceDto,
      undefined,
      actorReference(request.auth),
    );
  }
}
