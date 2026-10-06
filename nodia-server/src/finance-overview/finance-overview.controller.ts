import { Controller, Get, Query, Req } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthRequest } from '../auth/types/auth.types.js';
import {
  FinanceOverviewQueryDto,
  FinanceSummaryQueryDto,
} from './dto/finance-overview-query.dto.js';
import {
  FINANCE_GROUP_SUMMARY_SCHEMA,
  FINANCE_OVERVIEW_SCHEMA,
  FINANCE_SUMMARY_SCHEMA,
} from './dto/finance-overview-response.schemas.js';
import { GetFinanceOverviewUseCase } from './use-case/get-finance-overview.use-case.js';
import { GetFinanceCategorySummaryUseCase } from './use-case/get-finance-category-summary.use-case.js';
import { GetFinanceGroupSummaryUseCase } from './use-case/get-finance-group-summary.use-case.js';

@ApiTags('Personal finance overview')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'A validated session is required.' })
@ApiBadRequestResponse({ description: 'finance:invalid_query' })
@Controller('finance/overview')
export class FinanceOverviewController {
  constructor(
    private readonly getOverview: GetFinanceOverviewUseCase,
    private readonly getCategories: GetFinanceCategorySummaryUseCase,
    private readonly getGroups: GetFinanceGroupSummaryUseCase,
  ) {}

  @Get()
  @ApiOkResponse({
    schema: FINANCE_OVERVIEW_SCHEMA,
    description:
      'Exact movement totals, catalogue counts and historical obligation balances with explicit scope.',
  })
  overview(
    @Req() request: AuthRequest,
    @Query() query: FinanceOverviewQueryDto,
  ) {
    return this.getOverview.execute(request.auth.user.id, query);
  }

  @Get('categories')
  @ApiOkResponse({
    schema: FINANCE_SUMMARY_SCHEMA,
    description:
      'Paged category totals including zero activity; catalogue name/key search.',
  })
  categories(
    @Req() request: AuthRequest,
    @Query() query: FinanceSummaryQueryDto,
  ) {
    return this.getCategories.execute(request.auth.user.id, query);
  }

  @Get('category-groups')
  @ApiOkResponse({
    schema: FINANCE_GROUP_SUMMARY_SCHEMA,
    description:
      'Paged group totals including zero activity; overlapping groups are not additive.',
  })
  groups(@Req() request: AuthRequest, @Query() query: FinanceSummaryQueryDto) {
    return this.getGroups.execute(request.auth.user.id, query);
  }
}
