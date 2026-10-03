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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CreateInvoiceDto } from './dto/create-invoice.dto.js';
import { UpdateInvoiceDto } from './dto/update-invoice.dto.js';
import { GetInvoicesDto } from './dto/get-invoices.dto.js';
import { AnalyzeInvoiceDto } from './dto/analyze-invoice.dto.js';
import { GetAllInvoicesUseCase } from './use-case/get-all-invoices.use-case.js';
import { GetInvoiceByIdUseCase } from './use-case/get-invoice-by-id.use-case.js';
import { GetInvoiceViewUrlUseCase } from './use-case/get-invoice-view-url.use-case.js';
import { CreateInvoiceUseCase } from './use-case/create-invoice.use-case.js';
import { UpdateInvoiceUseCase } from './use-case/update-invoice.use-case.js';
import { AnalyzeInvoiceUseCase } from './use-case/analyze-invoice.use-case.js';
import { VerifyIaProvidersUseCase } from './use-case/verify-ia-providers.use-case.js';
import { RequireAction } from '../authorization/action-permission.guard.js';

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
  ) {}

  @Get()
  findAll(@Query() queryParams: GetInvoicesDto) {
    return this.getAllInvoicesUseCase.execute(queryParams);
  }

  @Get(['verify-ia-providers', 'verify-ia-provider'])
  @RequireAction('invoice:analyze')
  verifyIaProviders() {
    return this.verifyIaProvidersUseCase.execute();
  }

  @Get(':id/view-url')
  getViewUrl(@Param('id') id: string) {
    return this.getInvoiceViewUrlUseCase.execute(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.getInvoiceByIdUseCase.execute(id);
  }

  @Post('analyze')
  @RequireAction('invoice:analyze')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 15 },
    }),
  )
  analyze(
    @UploadedFile() file: Express.Multer.File,
    @Body() analyzeInvoiceDto: AnalyzeInvoiceDto,
    @Query() queryParams?: Partial<AnalyzeInvoiceDto>,
  ) {
    const mergedDto: AnalyzeInvoiceDto = {
      ...queryParams,
      ...analyzeInvoiceDto,
    };
    return this.analyzeInvoiceUseCase.execute(file, mergedDto);
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
  ) {
    return this.createInvoiceUseCase.execute(createInvoiceDto, file);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateInvoiceDto: UpdateInvoiceDto) {
    return this.updateInvoiceUseCase.execute(id, updateInvoiceDto);
  }
}
