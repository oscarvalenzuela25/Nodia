import { rentalResponseSchema } from '../rental-common/rental-response.schemas.js';
import { RentalMutationResultDto } from '../rental-common/dto/rental-mutation-result.dto.js';
import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Headers,
  HttpCode,
  Param,
  Query,
  Req,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiHeader,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
} from '@nestjs/swagger';
import type { AuthRequest } from '../auth/types/auth.types.js';
import {
  RentalPropertyParamsDto,
  RentalResourceParamsDto,
} from '../rental-common/dto/rental-params.dto.js';
import { RentalTransportGuard } from '../rental-common/rental-transport.guard.js';
import { CreateRentalExpenseUseCase } from './use-case/create-rental-expense.use-case.js';
import {
  GetRentalExpensesUseCase,
  GetRentalExpenseUseCase,
} from './use-case/get-rental-expenses.use-case.js';
import { PayRentalExpenseUseCase } from './use-case/pay-rental-expense.use-case.js';
import { UpdateRentalExpenseUseCase } from './use-case/update-rental-expense.use-case.js';
import { VoidRentalExpenseUseCase } from './use-case/void-rental-expense.use-case.js';
import {
  CreateRentalExpenseDto,
  RentalExpenseQueryDto,
  PayRentalExpenseDto,
  UpdateRentalExpenseDto,
  VoidRentalExpenseDto,
} from './dto/rental-expense.dto.js';
@ApiTags('Rental - expense')
@ApiBearerAuth()
@ApiBadRequestResponse({ description: 'Invalid rental command or query' })
@ApiNotFoundResponse({ description: 'Missing record or inaccessible house' })
@ApiConflictResponse({
  description: 'Availability, state, money or idempotency conflict',
})
@UseGuards(RentalTransportGuard)
@Controller('rental/properties/:propertyId/expenses')
export class RentalExpenseController {
  constructor(
    private readonly createRentalExpenseUseCase: CreateRentalExpenseUseCase,
    private readonly getRentalExpensesUseCase: GetRentalExpensesUseCase,
    private readonly getRentalExpenseUseCase: GetRentalExpenseUseCase,
    private readonly payRentalExpenseUseCase: PayRentalExpenseUseCase,
    private readonly updateRentalExpenseUseCase: UpdateRentalExpenseUseCase,
    private readonly voidRentalExpenseUseCase: VoidRentalExpenseUseCase,
  ) {}
  @Post()
  @ApiOperation({ summary: 'CreateRentalExpense' })
  @ApiCreatedResponse({
    type: RentalMutationResultDto,
    description: 'Persisted acknowledgement; replay returns original result',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'UUID v4 for this intent; preserve on retry',
  })
  createRentalExpense(
    @Req() request: AuthRequest,
    @Param() params: RentalPropertyParamsDto,
    @Body() dto: CreateRentalExpenseDto,
    @Headers('idempotency-key') requestKey: string,
  ) {
    return this.createRentalExpenseUseCase.execute(
      request.auth.user.id,
      params.propertyId,
      dto,
      requestKey,
    );
  }
  @Get()
  @ApiOperation({ summary: 'GetRentalExpenses' })
  @SetMetadata('rental:query', true)
  @ApiOkResponse({ schema: rentalResponseSchema('expense', true) })
  getRentalExpenses(
    @Req() request: AuthRequest,
    @Param() params: RentalPropertyParamsDto,
    @Query() dto: RentalExpenseQueryDto,
  ) {
    return this.getRentalExpensesUseCase.execute(
      request.auth.user.id,
      params.propertyId,
      dto,
    );
  }
  @Get(':id')
  @ApiOperation({ summary: 'GetRentalExpense' })
  @ApiOkResponse({ schema: rentalResponseSchema('expense', false) })
  getRentalExpense(
    @Req() request: AuthRequest,
    @Param() params: RentalResourceParamsDto,
  ) {
    return this.getRentalExpenseUseCase.execute(
      request.auth.user.id,
      params.propertyId,
      params.id,
    );
  }
  @Post(':id/pay')
  @ApiOperation({ summary: 'PayRentalExpense' })
  @HttpCode(200)
  @ApiOkResponse({
    type: RentalMutationResultDto,
    description: 'Persisted acknowledgement; replay returns original result',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'UUID v4 for this intent; preserve on retry',
  })
  payRentalExpense(
    @Req() request: AuthRequest,
    @Param() params: RentalResourceParamsDto,
    @Body() dto: PayRentalExpenseDto,
    @Headers('idempotency-key') requestKey: string,
  ) {
    return this.payRentalExpenseUseCase.execute(
      request.auth.user.id,
      params.propertyId,
      params.id,
      dto,
      requestKey,
    );
  }
  @Put(':id')
  @ApiOperation({ summary: 'UpdateRentalExpense' })
  @ApiOkResponse({
    type: RentalMutationResultDto,
    description: 'Persisted acknowledgement; replay returns original result',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'UUID v4 for this intent; preserve on retry',
  })
  updateRentalExpense(
    @Req() request: AuthRequest,
    @Param() params: RentalResourceParamsDto,
    @Body() dto: UpdateRentalExpenseDto,
    @Headers('idempotency-key') requestKey: string,
  ) {
    return this.updateRentalExpenseUseCase.execute(
      request.auth.user.id,
      params.propertyId,
      params.id,
      dto,
      requestKey,
    );
  }
  @Post(':id/void')
  @ApiOperation({ summary: 'VoidRentalExpense' })
  @HttpCode(200)
  @ApiOkResponse({
    type: RentalMutationResultDto,
    description: 'Persisted acknowledgement; replay returns original result',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'UUID v4 for this intent; preserve on retry',
  })
  voidRentalExpense(
    @Req() request: AuthRequest,
    @Param() params: RentalResourceParamsDto,
    @Body() dto: VoidRentalExpenseDto,
    @Headers('idempotency-key') requestKey: string,
  ) {
    return this.voidRentalExpenseUseCase.execute(
      request.auth.user.id,
      params.propertyId,
      params.id,
      dto,
      requestKey,
    );
  }
}
