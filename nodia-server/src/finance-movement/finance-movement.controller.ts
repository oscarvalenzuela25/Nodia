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
import { CreateFinanceMovementDto } from './dto/create-finance-movement.dto.js';
import { UpdateFinanceMovementDto } from './dto/update-finance-movement.dto.js';
import { CreateFinanceMovementUseCase } from './use-case/create-finance-movement.use-case.js';
import { UpdateFinanceMovementUseCase } from './use-case/update-finance-movement.use-case.js';
import { GetFinanceMovementsUseCase } from './use-case/get-finance-movements.use-case.js';
import { GetFinanceMovementByIdUseCase } from './use-case/get-finance-movement-by-id.use-case.js';
import {
  FINANCE_MOVEMENT_PAGE_SCHEMA,
  FINANCE_MOVEMENT_SCHEMA,
} from './dto/finance-movement-response.schemas.js';

@ApiTags('Personal finance - movements')
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
    'Overpayment, invalid state transition, inactive association or concurrent conflict.',
})
@Controller('finance/movements')
export class FinanceMovementController {
  constructor(
    private readonly createMovement: CreateFinanceMovementUseCase,
    private readonly updateMovement: UpdateFinanceMovementUseCase,
    private readonly getMovements: GetFinanceMovementsUseCase,
    private readonly getMovement: GetFinanceMovementByIdUseCase,
  ) {}
  @Get()
  @ApiOkResponse({ schema: FINANCE_MOVEMENT_PAGE_SCHEMA })
  @ApiOperation({ summary: 'List movements owned by the authenticated user' })
  list(@Req() request: AuthRequest, @Query() query: FinanceQueryDto) {
    return this.getMovements.execute(request.auth.user.id, query);
  }
  @Get(':id')
  @ApiOkResponse({ schema: FINANCE_MOVEMENT_SCHEMA })
  @ApiOperation({
    summary: 'Get a personal movement, including archived records',
  })
  findOne(@Req() request: AuthRequest, @Param() params: FinanceIdDto) {
    return this.getMovement.execute(request.auth.user.id, params.id);
  }
  @Post()
  @ApiCreatedResponse({ schema: FINANCE_MOVEMENT_SCHEMA })
  @ApiOperation({
    summary: 'Create a movement or a partial obligation repayment',
  })
  create(@Req() request: AuthRequest, @Body() dto: CreateFinanceMovementDto) {
    return this.createMovement.execute(request.auth.user.id, dto);
  }
  @Put(':id')
  @ApiOkResponse({ schema: FINANCE_MOVEMENT_SCHEMA })
  @ApiOperation({ summary: 'Update, archive, confirm or cancel a movement' })
  update(
    @Req() request: AuthRequest,
    @Param() params: FinanceIdDto,
    @Body() dto: UpdateFinanceMovementDto,
  ) {
    return this.updateMovement.execute(request.auth.user.id, params.id, dto);
  }
}
