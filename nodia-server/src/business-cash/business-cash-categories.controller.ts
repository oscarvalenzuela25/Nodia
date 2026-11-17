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
import { CashCategoryParamsDto } from './dto/cash-category-params.dto.js';
import { CreateCashCategoryDto } from './dto/create-cash-category.dto.js';
import { QueryCashCategoriesDto } from './dto/query-cash-categories.dto.js';
import { UpdateCashCategoryDto } from './dto/update-cash-category.dto.js';
import type { CashMutationResult } from './types/cash.types.js';
import { MutateCashCategoryUseCase } from './use-case/mutate-cash-category.use-case.js';
import { ReadCashCategoriesUseCase } from './use-case/read-cash-categories.use-case.js';

@Controller('business-cash-categories')
export class BusinessCashCategoriesController {
  constructor(
    private readonly read: ReadCashCategoriesUseCase,
    private readonly mutate: MutateCashCategoryUseCase,
  ) {}

  @Get()
  list(@Query() query: QueryCashCategoriesDto, @Req() request: AuthRequest) {
    return this.read.list(query, actorReference(request.auth));
  }

  @Get(':id')
  detail(@Param() params: CashCategoryParamsDto, @Req() request: AuthRequest) {
    return this.read.detail(params.id, actorReference(request.auth));
  }

  @Post()
  @Header('Cache-Control', 'no-store')
  async create(
    @Body() body: CreateCashCategoryDto,
    @Req() request: AuthRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CashMutationResult<'category_create'>> {
    const result = await this.mutate.create(body, actorReference(request.auth));
    if (result.status === 'processing') response.status(HttpStatus.ACCEPTED);
    return result;
  }

  @Put(':id')
  @Header('Cache-Control', 'no-store')
  async update(
    @Param() params: CashCategoryParamsDto,
    @Body() body: UpdateCashCategoryDto,
    @Req() request: AuthRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CashMutationResult<'category_update'>> {
    const result = await this.mutate.update(
      params.id,
      body,
      actorReference(request.auth),
    );
    if (result.status === 'processing') response.status(HttpStatus.ACCEPTED);
    return result;
  }
}
