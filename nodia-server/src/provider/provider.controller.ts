import type { AuthRequest } from '../auth/types/auth.types.js';
import { actorReference } from '../authorization/authority-transaction.js';
import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Header,
  Req,
} from '@nestjs/common';
import { CreateProviderDto } from './dto/create-provider.dto.js';
import { BulkCreateProviderDto } from './dto/bulk-create-provider.dto.js';
import { UpdateProviderDto } from './dto/update-provider.dto.js';
import { BulkUpdateProviderDto } from './dto/bulk-update-provider.dto.js';
import { GetProvidersDto } from './dto/get-providers.dto.js';
import { ExportProvidersCsvDto } from './dto/export-providers-csv.dto.js';
import { GetAllProvidersUseCase } from './use-case/get-all-providers.use-case.js';
import { GetProviderByIdUseCase } from './use-case/get-provider-by-id.use-case.js';
import { CreateProviderUseCase } from './use-case/create-provider.use-case.js';
import { CreateBulkProvidersUseCase } from './use-case/create-bulk-providers.use-case.js';
import { UpdateProviderUseCase } from './use-case/update-provider.use-case.js';
import { UpdateBulkProvidersUseCase } from './use-case/update-bulk-providers.use-case.js';
import { ExportProvidersCsvUseCase } from './use-case/export-providers-csv.use-case.js';
import { ImportProvidersUseCase } from './use-case/import-providers.use-case.js';
import { ImportProvidersDto } from './dto/import-providers.dto.js';

@Controller(['provider', 'providers'])
export class ProviderController {
  constructor(
    private readonly getAllProvidersUseCase: GetAllProvidersUseCase,
    private readonly getProviderByIdUseCase: GetProviderByIdUseCase,
    private readonly createProviderUseCase: CreateProviderUseCase,
    private readonly createBulkProvidersUseCase: CreateBulkProvidersUseCase,
    private readonly updateProviderUseCase: UpdateProviderUseCase,
    private readonly updateBulkProvidersUseCase: UpdateBulkProvidersUseCase,
    private readonly exportProvidersCsvUseCase: ExportProvidersCsvUseCase,
    private readonly importProvidersUseCase: ImportProvidersUseCase,
  ) {}

  @Get()
  findAll(@Query() queryParams: GetProvidersDto, @Req() request: AuthRequest) {
    return this.getAllProvidersUseCase.execute(
      queryParams,
      actorReference(request.auth),
    );
  }

  @Post('bulk')
  createBulk(
    @Body() bulkCreateProviderDto: BulkCreateProviderDto,
    @Req() request: AuthRequest,
  ) {
    return this.createBulkProvidersUseCase.execute(
      bulkCreateProviderDto,
      actorReference(request.auth),
    );
  }

  @Post('import')
  importCsv(@Body() dto: ImportProvidersDto, @Req() request: AuthRequest) {
    return this.importProvidersUseCase.execute(
      dto,
      actorReference(request.auth),
    );
  }

  @Put('bulk')
  updateBulk(
    @Body() bulkUpdateProviderDto: BulkUpdateProviderDto,
    @Req() request: AuthRequest,
  ) {
    return this.updateBulkProvidersUseCase.execute(
      bulkUpdateProviderDto,
      actorReference(request.auth),
    );
  }

  @Get('export-csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="providers.csv"')
  exportCsv(@Query() dto: ExportProvidersCsvDto, @Req() request: AuthRequest) {
    return this.exportProvidersCsvUseCase.execute(
      dto,
      undefined,
      actorReference(request.auth),
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() request: AuthRequest) {
    return this.getProviderByIdUseCase.execute(
      id,
      actorReference(request.auth),
    );
  }

  @Post()
  create(
    @Body() createProviderDto: CreateProviderDto,
    @Req() request: AuthRequest,
  ) {
    return this.createProviderUseCase.execute(
      createProviderDto,
      undefined,
      actorReference(request.auth),
    );
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updateProviderDto: UpdateProviderDto,
    @Req() request: AuthRequest,
  ) {
    return this.updateProviderUseCase.execute(
      id,
      updateProviderDto,
      undefined,
      actorReference(request.auth),
    );
  }
}
