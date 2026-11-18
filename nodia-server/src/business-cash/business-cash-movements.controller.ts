import {
  Body,
  Controller,
  Get,
  Header,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { actorReference } from '../authorization/authority-transaction.js';
import type { AuthRequest } from '../auth/types/auth.types.js';
import { CreateCashMovementDto } from './dto/create-cash-movement.dto.js';
import {
  CashMovementParamsDto,
  QueryCashMonthlySummaryDto,
  QueryCashMovementsDto,
} from './dto/query-cash-movements.dto.js';
import { UpdateCashMovementDto } from './dto/update-cash-movement.dto.js';
import type { CashMutationResult } from './types/cash.types.js';
import { MutateCashMovementUseCase } from './use-case/mutate-cash-movement.use-case.js';
import { ReadCashMovementsUseCase } from './use-case/read-cash-movements.use-case.js';

@Controller('business-cash-movements')
export class BusinessCashMovementsController {
  constructor(
    private readonly read: ReadCashMovementsUseCase,
    private readonly mutate: MutateCashMovementUseCase,
  ) {}

  @Get()
  list(@Query() query: QueryCashMovementsDto, @Req() request: AuthRequest) {
    return this.read.list(query, actorReference(request.auth));
  }

  @Get('monthly-summary')
  monthly(
    @Query() query: QueryCashMonthlySummaryDto,
    @Req() request: AuthRequest,
  ) {
    return this.read.monthly(query.business_id, actorReference(request.auth));
  }

  @Get(':id')
  detail(@Param() params: CashMovementParamsDto, @Req() request: AuthRequest) {
    return this.read.detail(params.id, actorReference(request.auth));
  }

  @Post()
  @Header('Cache-Control', 'no-store')
  async create(
    @Body() body: CreateCashMovementDto,
    @Req() request: AuthRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CashMutationResult<'movement_create'>> {
    const result = await this.mutate.create(body, actorReference(request.auth));
    if (result.status === 'processing') response.status(HttpStatus.ACCEPTED);
    return result;
  }

  @Put(':id')
  @Header('Cache-Control', 'no-store')
  async update(
    @Param() params: CashMovementParamsDto,
    @Body() body: UpdateCashMovementDto,
    @Req() request: AuthRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CashMutationResult<'movement_update'>> {
    const result = await this.mutate.update(
      params.id,
      body,
      actorReference(request.auth),
    );
    if (result.status === 'processing') response.status(HttpStatus.ACCEPTED);
    return result;
  }
}
