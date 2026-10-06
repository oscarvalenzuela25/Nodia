import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthRequest } from '../auth/types/auth.types.js';
import { FinanceIdDto } from '../finance-common/dto/finance-id.dto.js';
import { FinanceQueryDto } from '../finance-common/dto/finance-query.dto.js';
import { CreateFinanceCategoryDto } from './dto/create-finance-category.dto.js';
import { UpdateFinanceCategoryDto } from './dto/update-finance-category.dto.js';
import {
  FINANCE_CATEGORY_PAGE_SCHEMA,
  FINANCE_CATEGORY_SCHEMA,
  FINANCE_CATALOG_ERROR_SCHEMA,
} from './dto/finance-category-response.schemas.js';
import { GetFinanceCategoriesUseCase } from './use-case/get-finance-categories.use-case.js';
import { GetFinanceCategoryUseCase } from './use-case/get-finance-category.use-case.js';
import { CreateFinanceCategoryUseCase } from './use-case/create-finance-category.use-case.js';
import { UpdateFinanceCategoryUseCase } from './use-case/update-finance-category.use-case.js';

@ApiTags('Finance categories')
@ApiCookieAuth()
@ApiBadRequestResponse({
  description: 'Invalid input, query, or positive bigint ID.',
  schema: FINANCE_CATALOG_ERROR_SCHEMA,
})
@ApiUnauthorizedResponse({
  description: 'A validated session is required.',
  schema: FINANCE_CATALOG_ERROR_SCHEMA,
})
@ApiNotFoundResponse({
  description: 'Category does not exist in the authenticated user scope.',
  schema: FINANCE_CATALOG_ERROR_SCHEMA,
})
@ApiConflictResponse({
  description: 'Duplicate key in this user scope or a conflicting association.',
  schema: FINANCE_CATALOG_ERROR_SCHEMA,
})
@Controller('finance/categories')
export class FinanceCategoryController {
  constructor(
    private readonly list: GetFinanceCategoriesUseCase,
    private readonly detail: GetFinanceCategoryUseCase,
    private readonly createCategory: CreateFinanceCategoryUseCase,
    private readonly updateCategory: UpdateFinanceCategoryUseCase,
  ) {}
  @Get()
  @ApiOperation({ summary: 'List personal categories with bounded pagination' })
  @ApiOkResponse({ schema: FINANCE_CATEGORY_PAGE_SCHEMA })
  findAll(@Req() request: AuthRequest, @Query() query: FinanceQueryDto) {
    return this.list.execute(request.auth.user.id, query);
  }
  @Get(':id')
  @ApiOperation({
    summary: 'Get an owned category, including archived selections',
  })
  @ApiOkResponse({ schema: FINANCE_CATEGORY_SCHEMA })
  findOne(@Req() request: AuthRequest, @Param() params: FinanceIdDto) {
    return this.detail.execute(request.auth.user.id, params.id);
  }
  @Post()
  @ApiOperation({ summary: 'Create a personal category' })
  @ApiCreatedResponse({ schema: FINANCE_CATEGORY_SCHEMA })
  create(@Req() request: AuthRequest, @Body() dto: CreateFinanceCategoryDto) {
    return this.createCategory.execute(request.auth.user.id, dto);
  }
  @Put(':id')
  @ApiOperation({ summary: 'Update or archive a personal category' })
  @ApiOkResponse({ schema: FINANCE_CATEGORY_SCHEMA })
  update(
    @Req() request: AuthRequest,
    @Param() params: FinanceIdDto,
    @Body() dto: UpdateFinanceCategoryDto,
  ) {
    return this.updateCategory.execute(request.auth.user.id, params.id, dto);
  }
}
