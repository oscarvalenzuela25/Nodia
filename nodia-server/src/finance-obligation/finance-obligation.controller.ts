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
  ApiBearerAuth,
  ApiConflictResponse,
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
import { CreateFinanceObligationDto } from './dto/create-finance-obligation.dto.js';
import { UpdateFinanceObligationDto } from './dto/update-finance-obligation.dto.js';
import { CreateFinanceObligationUseCase } from './use-case/create-finance-obligation.use-case.js';
import { UpdateFinanceObligationUseCase } from './use-case/update-finance-obligation.use-case.js';
import { GetFinanceObligationsUseCase } from './use-case/get-finance-obligations.use-case.js';
import { GetFinanceObligationByIdUseCase } from './use-case/get-finance-obligation-by-id.use-case.js';
import {
  FINANCE_OBLIGATION_PAGE_SCHEMA,
  FINANCE_OBLIGATION_SCHEMA,
} from './dto/finance-obligation-response.schemas.js';

@ApiTags('Personal finance - obligations')
@ApiBearerAuth()
@ApiBadRequestResponse({
  description: 'Invalid personal finance input or query.',
})
@ApiUnauthorizedResponse({ description: 'A validated session is required.' })
@ApiNotFoundResponse({
  description:
    'The record or association does not exist for the authenticated user.',
})
@ApiConflictResponse({
  description:
    'Duplicate key, principal below repayments, inactive association or concurrent conflict.',
})
@Controller('finance/obligations')
export class FinanceObligationController {
  constructor(
    private readonly createObligation: CreateFinanceObligationUseCase,
    private readonly updateObligation: UpdateFinanceObligationUseCase,
    private readonly getObligations: GetFinanceObligationsUseCase,
    private readonly getObligation: GetFinanceObligationByIdUseCase,
  ) {}
  @Get()
  @ApiOkResponse({ schema: FINANCE_OBLIGATION_PAGE_SCHEMA })
  @ApiOperation({
    summary: 'List personal loans and debts with exact remaining balances',
  })
  list(@Req() request: AuthRequest, @Query() query: FinanceQueryDto) {
    return this.getObligations.execute(request.auth.user.id, query);
  }
  @Get(':id')
  @ApiOkResponse({ schema: FINANCE_OBLIGATION_SCHEMA })
  @ApiOperation({ summary: 'Get an owned obligation and its initial movement' })
  findOne(@Req() request: AuthRequest, @Param() params: FinanceIdDto) {
    return this.getObligation.execute(request.auth.user.id, params.id);
  }
  @Post()
  @ApiCreatedResponse({ schema: FINANCE_OBLIGATION_SCHEMA })
  @ApiOperation({
    summary: 'Atomically create a loan or debt and its initial movement',
  })
  create(@Req() request: AuthRequest, @Body() dto: CreateFinanceObligationDto) {
    return this.createObligation.execute(request.auth.user.id, dto);
  }
  @Put(':id')
  @ApiOkResponse({ schema: FINANCE_OBLIGATION_SCHEMA })
  @ApiOperation({
    summary:
      'Update or archive an obligation; principal updates its initial movement',
  })
  update(
    @Req() request: AuthRequest,
    @Param() params: FinanceIdDto,
    @Body() dto: UpdateFinanceObligationDto,
  ) {
    return this.updateObligation.execute(request.auth.user.id, params.id, dto);
  }
}
