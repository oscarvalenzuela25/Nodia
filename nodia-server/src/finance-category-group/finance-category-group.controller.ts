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
import { CreateFinanceCategoryGroupDto } from './dto/create-finance-category-group.dto.js';
import { UpdateFinanceCategoryGroupDto } from './dto/update-finance-category-group.dto.js';
import {
  FINANCE_CATEGORY_GROUP_DETAIL_SCHEMA,
  FINANCE_CATEGORY_GROUP_PAGE_SCHEMA,
} from './dto/finance-category-group-response.schemas.js';
import { FINANCE_CATALOG_ERROR_SCHEMA } from '../finance-category/dto/finance-category-response.schemas.js';
import { GetFinanceCategoryGroupsUseCase } from './use-case/get-finance-category-groups.use-case.js';
import { GetFinanceCategoryGroupUseCase } from './use-case/get-finance-category-group.use-case.js';
import { CreateFinanceCategoryGroupUseCase } from './use-case/create-finance-category-group.use-case.js';
import { UpdateFinanceCategoryGroupUseCase } from './use-case/update-finance-category-group.use-case.js';

@ApiTags('Finance category groups')
@ApiCookieAuth()
@ApiBadRequestResponse({
  description: 'Invalid input, query, bigint ID, or category selection.',
  schema: FINANCE_CATALOG_ERROR_SCHEMA,
})
@ApiUnauthorizedResponse({
  description: 'A validated session is required.',
  schema: FINANCE_CATALOG_ERROR_SCHEMA,
})
@ApiNotFoundResponse({
  description:
    'Group or associated category does not exist in the authenticated user scope.',
  schema: FINANCE_CATALOG_ERROR_SCHEMA,
})
@ApiConflictResponse({
  description:
    'Duplicate user-scoped key, new inactive category selection, or association conflict.',
  schema: FINANCE_CATALOG_ERROR_SCHEMA,
})
@Controller('finance/category-groups')
export class FinanceCategoryGroupController {
  constructor(
    private readonly list: GetFinanceCategoryGroupsUseCase,
    private readonly detail: GetFinanceCategoryGroupUseCase,
    private readonly createGroup: CreateFinanceCategoryGroupUseCase,
    private readonly updateGroup: UpdateFinanceCategoryGroupUseCase,
  ) {}
  @Get()
  @ApiOperation({
    summary: 'List personal category groups with bounded pagination',
  })
  @ApiOkResponse({ schema: FINANCE_CATEGORY_GROUP_PAGE_SCHEMA })
  findAll(@Req() request: AuthRequest, @Query() query: FinanceQueryDto) {
    return this.list.execute(request.auth.user.id, query);
  }
  @Get(':id')
  @ApiOperation({
    summary: 'Hydrate a personal category group and historical selections',
  })
  @ApiOkResponse({ schema: FINANCE_CATEGORY_GROUP_DETAIL_SCHEMA })
  findOne(@Req() request: AuthRequest, @Param() params: FinanceIdDto) {
    return this.detail.execute(request.auth.user.id, params.id);
  }
  @Post()
  @ApiOperation({
    summary: 'Create a personal category group and its memberships atomically',
  })
  @ApiCreatedResponse({ schema: FINANCE_CATEGORY_GROUP_DETAIL_SCHEMA })
  create(
    @Req() request: AuthRequest,
    @Body() dto: CreateFinanceCategoryGroupDto,
  ) {
    return this.createGroup.execute(request.auth.user.id, dto);
  }
  @Put(':id')
  @ApiOperation({
    summary:
      'Update or archive a group; optional category_ids replaces selections',
  })
  @ApiOkResponse({ schema: FINANCE_CATEGORY_GROUP_DETAIL_SCHEMA })
  update(
    @Req() request: AuthRequest,
    @Param() params: FinanceIdDto,
    @Body() dto: UpdateFinanceCategoryGroupDto,
  ) {
    return this.updateGroup.execute(request.auth.user.id, params.id, dto);
  }
}
